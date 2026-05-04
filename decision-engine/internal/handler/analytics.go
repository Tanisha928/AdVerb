package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"

	"github.com/redis/go-redis/v9"
)

type AnalyticsEntry struct {
	TemplateSlug string  `json:"template_slug"`
	OverlayKey   string  `json:"overlay_key"`
	AgeGroup     string  `json:"age_group"`
	Interest     string  `json:"interest"`
	Impressions  int64   `json:"impressions"`
	Clicks       int64   `json:"clicks"`
	CTR          float64 `json:"ctr"`
	UcbScore     float64 `json:"ucb_score"`
}

type AnalyticsHandler struct {
	RDB *redis.Client
}

func (h AnalyticsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	entries := h.scan(r.Context())

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(entries)
}

func (h AnalyticsHandler) scan(ctx context.Context) []AnalyticsEntry {
	if h.RDB == nil {
		return []AnalyticsEntry{}
	}

	raw := make([]AnalyticsEntry, 0)
	var totalImpr int64

	var cursor uint64
	for {
		keys, next, err := h.RDB.Scan(ctx, cursor, "eng:v2:*", 200).Result()
		if err != nil {
			break
		}
		for _, key := range keys {
			// key format: eng:v2:{slug}:{overlayPart}:{ageGroup}:{interest}
			parts := strings.SplitN(key, ":", 6)
			if len(parts) < 6 {
				continue
			}
			vals, err := h.RDB.HMGet(ctx, key, "impressions", "clicks").Result()
			if err != nil {
				continue
			}
			impressions := analyticsParseInt(vals, 0)
			clicks := analyticsParseInt(vals, 1)
			totalImpr += impressions
			raw = append(raw, AnalyticsEntry{
				TemplateSlug: parts[2],
				OverlayKey:   parts[3],
				AgeGroup:     parts[4],
				Interest:     parts[5],
				Impressions:  impressions,
				Clicks:       clicks,
			})
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}

	// Second pass: compute CTR and UCB now that we know total impressions.
	for i := range raw {
		e := &raw[i]
		if e.Impressions > 0 {
			e.CTR = float64(e.Clicks) / float64(e.Impressions)
		}
		e.UcbScore = analyticsUCB(e.Clicks, e.Impressions, totalImpr)
	}
	return raw
}

func analyticsUCB(clicks, impressions, total int64) float64 {
	mean := 0.0
	if impressions > 0 {
		mean = float64(clicks) / float64(impressions)
	}
	t := float64(total)
	if t < 1 {
		t = 1
	}
	n := float64(impressions)
	if n < 1 {
		n = 1
	}
	ucb := mean + math.Sqrt((2*math.Log(t))/n)
	if ucb > 1 {
		return 1
	}
	if ucb < 0 {
		return 0
	}
	return ucb
}

func analyticsParseInt(vals []interface{}, idx int) int64 {
	if idx >= len(vals) || vals[idx] == nil {
		return 0
	}
	switch v := vals[idx].(type) {
	case int64:
		return v
	case string:
		var n int64
		fmt.Sscan(v, &n)
		return n
	case []byte:
		var n int64
		fmt.Sscan(string(v), &n)
		return n
	}
	return 0
}
