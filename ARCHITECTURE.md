# adverb — system architecture

This document expands on the root **README**: how the **recommendation plane** (edge, Go, ML) relates to the **product plane** (FastAPI, Postgres, serving).

## Recommendation plane

1. **`edge-worker/`** (Cloudflare Worker) accepts `POST /ad`, checks **KV** for a cached creative, optionally routes to a regional origin, and on miss calls the Go service.
2. **`decision-engine/`** (Go) exposes `POST /recommend` (and engagement endpoints). It loads **`templates/catalog.json`**, **`asset_index.json`**, and **`query_embeddings.json`**, scores overlays with dot-product similarity, and can blend **UCB** statistics from Redis.
3. **`ml/`** holds offline tooling (embedding scripts, filters) and **`ml/creative_cache_service/`** — a small FastAPI app backed by **FAISS** + Redis for “similar user → reuse creative” experiments.
4. **`templates/`** is the catalog volume mounted into the decision-engine container.

Deploy the Worker with **Wrangler**; it is not started by the root `docker compose` file.

## Product plane (default compose)

When you run **`docker compose up`** from the repository root:

- **`brand-api`** manages brands, campaigns, products, and **creative generation** (Groq copy + local PIL or Pollinations backgrounds + Cloudinary).
- **`ad-serving`** serves ads to the user feed, maintains **MAB** weights in Redis, and appends **Redis stream** events.
- **`analytics-worker`** consumes `ad_events` and updates PostgreSQL (and Redis aggregates where applicable).

The brand portal **does not** HTTP-call the Go decision engine in this layout; the Go service is the architectural sibling used for RTB-style demos and optional `recommendation-stack` profile.

## Compose profiles

| Command | What starts |
|---------|-------------|
| `docker compose up --build` | Postgres, Redis, RabbitMQ, brand-api, ad-serving, analytics-worker, frontends, Prometheus, Grafana |
| `docker compose --profile recommendation-stack up --build` | Above **plus** `decision-engine` (:8080) and `creative-cache-service` (:8001) |

## Creative image pipeline (brand-api)

- **Copy**: Groq (`GROQ_API_KEY`).
- **Raster background**: Docker defaults to **`AD_IMAGE_BACKEND=adverb`** (local PIL via `adverb_creative_gen`). Set **`AD_IMAGE_BACKEND=pollinations`** for Pollinations; repeated **429** responses can bail to local PIL when `POLLINATIONS_FAST_429_TO_LOCAL` is on.
- **Composite**: Product image + logo fetched over HTTPS, composed in Pillow, uploaded to Cloudinary under `adverb/…` folders.

There is **no** “plain background only” shortcut in code: every generated creative uses the Pollinations or local-PIL path.
