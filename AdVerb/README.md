# AdVerb

Real-time personalized ad creative generation pipeline targeting sub-100ms RTB windows.

## Components

- `ml/`: offline training for two-tower recommender and ONNX export
- `decision-engine/`: Go service for template recommendation using Triton user embeddings
- `worker/`: Cloudflare Worker orchestration, caching, and AI copy generation
- `ui/`: Next.js demo frontend for request submission and latency visualization
- `templates/`: ad template catalog
- `infra/`: deployment configs for Fly.io
- `assets/`: static creative assets upload helper

## End-to-end flow

1. UI sends `POST /ad` to Worker.
2. Worker checks KV cache.
3. On miss, Worker calls Go `/recommend`.
4. Go gets user embedding from Triton and scores templates.
5. Worker generates copy via Workers AI fallback guard.
6. Worker returns creative with latency breakdown and asynchronously caches it.
