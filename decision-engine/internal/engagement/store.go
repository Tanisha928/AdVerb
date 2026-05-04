package engagement

import (
	"crypto/sha1"
	"encoding/hex"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type SegmentKey struct {
	TemplateSlug string
	OverlayKey   string
	AgeGroup     string
	Interest     string
}

func (k SegmentKey) RedisKey() string {
	// v2 shortens high-cardinality fields (especially long overlay keys)
	// so Redis keys remain compact and robust for downstream tooling.
	// Hash key: eng:v2:<templateSlug>:<overlayKey>:<ageGroup>:<interest>
	parts := []string{
		"eng", "v2",
		sanitize(k.TemplateSlug),
		shortenPart(sanitize(k.OverlayKey)),
		sanitize(k.AgeGroup),
		sanitize(k.Interest),
	}
	return strings.Join(parts, ":")
}

func sanitize(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ":", "_")
	if s == "" {
		return "unknown"
	}
	return s
}

func shortenPart(s string) string {
	if len(s) <= 64 {
		return s
	}
	sum := sha1.Sum([]byte(s))
	return "h-" + hex.EncodeToString(sum[:8])
}

type Store interface {
	IncrementImpression(ctx context.Context, key SegmentKey, by int64) error
	IncrementClick(ctx context.Context, key SegmentKey, by int64) error
	GetCounts(ctx context.Context, keys []SegmentKey) (map[SegmentKey]Counts, error)
}

type Counts struct {
	Impressions int64
	Clicks      int64
}

type RedisStore struct {
	rdb     *redis.Client
	timeout time.Duration
}

func NewRedisStore(rdb *redis.Client) *RedisStore {
	return &RedisStore{rdb: rdb, timeout: 30 * time.Millisecond}
}

func (s *RedisStore) withTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	if s.timeout <= 0 {
		return context.WithCancel(ctx)
	}
	return context.WithTimeout(ctx, s.timeout)
}

func (s *RedisStore) IncrementImpression(ctx context.Context, key SegmentKey, by int64) error {
	ctx, cancel := s.withTimeout(ctx)
	defer cancel()
	return s.rdb.HIncrBy(ctx, key.RedisKey(), "impressions", by).Err()
}

func (s *RedisStore) IncrementClick(ctx context.Context, key SegmentKey, by int64) error {
	ctx, cancel := s.withTimeout(ctx)
	defer cancel()
	return s.rdb.HIncrBy(ctx, key.RedisKey(), "clicks", by).Err()
}

func (s *RedisStore) GetCounts(ctx context.Context, keys []SegmentKey) (map[SegmentKey]Counts, error) {
	out := make(map[SegmentKey]Counts, len(keys))
	if len(keys) == 0 {
		return out, nil
	}

	ctx, cancel := s.withTimeout(ctx)
	defer cancel()

	pipe := s.rdb.Pipeline()
	cmds := make([]*redis.SliceCmd, 0, len(keys))
	for _, k := range keys {
		cmds = append(cmds, pipe.HMGet(ctx, k.RedisKey(), "impressions", "clicks"))
	}
	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return nil, fmt.Errorf("redis pipeline exec: %w", err)
	}

	for i, k := range keys {
		vals, err := cmds[i].Result()
		if err != nil && err != redis.Nil {
			return nil, fmt.Errorf("redis hmget: %w", err)
		}
		out[k] = Counts{
			Impressions: toInt64(vals, 0),
			Clicks:      toInt64(vals, 1),
		}
	}
	return out, nil
}

func toInt64(vals []any, idx int) int64 {
	if idx < 0 || idx >= len(vals) || vals[idx] == nil {
		return 0
	}
	switch v := vals[idx].(type) {
	case int64:
		return v
	case string:
		// go-redis may return strings for some codepaths
		var n int64
		_, _ = fmt.Sscan(v, &n)
		return n
	case []byte:
		var n int64
		_, _ = fmt.Sscan(string(v), &n)
		return n
	default:
		return 0
	}
}

