package main

import (
	"log"
	"net/http"
	"os"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"

	"adverb/decision-engine/internal/catalog"
	"adverb/decision-engine/internal/engagement"
	"adverb/decision-engine/internal/handler"
	"adverb/decision-engine/internal/metrics"
)

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	catalogPath := getenv("CATALOG_PATH", "../templates/catalog.json")
	assetIndexPath := getenv("ASSET_INDEX_PATH", "./asset_index.json")
	queryEmbeddingsPath := getenv("QUERY_EMBEDDINGS_PATH", "./query_embeddings.json")

	templates, err := catalog.LoadTemplates(catalogPath)
	if err != nil {
		log.Fatalf("load catalog: %v", err)
	}

	assets, err := catalog.LoadAssetIndex(assetIndexPath)
	if err != nil {
		log.Fatalf("load asset index: %v", err)
	}

	queries, err := catalog.LoadQueryEmbeddings(queryEmbeddingsPath)
	if err != nil {
		log.Fatalf("load query embeddings: %v", err)
	}

	log.Printf("loaded %d templates, %d assets, %d query embeddings", len(templates), len(assets), len(queries))

	var store engagement.Store
	var rdb *redis.Client
	if os.Getenv("REDIS_URL") != "" || os.Getenv("UPSTASH_REDIS_URL") != "" {
		rdb, err = engagement.NewRedisClientFromEnv()
		if err != nil {
			log.Fatalf("redis: %v", err)
		}
		store = engagement.NewRedisStore(rdb)
		log.Println("engagement store: redis enabled")
	} else {
		log.Println("engagement store: redis disabled (set REDIS_URL)")
	}

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.Handle("/recommend", metrics.InstrumentHandler("recommend", handler.NewRecommendHandler(templates, assets, queries, store)))
	mux.Handle("/health", metrics.InstrumentHandler("health", handler.HealthHandler{}))
	mux.Handle("/click", metrics.InstrumentHandler("click", handler.ClickHandler{Store: store}))
	mux.Handle("/impression", metrics.InstrumentHandler("impression", handler.ImpressionHandler{Store: store}))
	mux.Handle("/analytics", handler.AnalyticsHandler{RDB: rdb})

	log.Println("decision-engine listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
