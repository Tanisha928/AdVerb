package engagement

import (
	"fmt"
	"os"

	"github.com/redis/go-redis/v9"
)

func NewRedisClientFromEnv() (*redis.Client, error) {
	// Prefer standard REDIS_URL. Upstash commonly provides rediss:// URLs.
	url := os.Getenv("REDIS_URL")
	if url == "" {
		// Optional compatibility with Upstash naming.
		url = os.Getenv("UPSTASH_REDIS_URL")
	}
	if url == "" {
		return nil, fmt.Errorf("missing REDIS_URL (or UPSTASH_REDIS_URL)")
	}

	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}
	return redis.NewClient(opts), nil
}

