# ML tooling

- **Offline**: CLIP-style embeddings (`embed_assets.py`, `embed_queries.py`), catalog hygiene, synthetic engagement seeds.
- **Online (optional)**: **`creative_cache_service/`** — FastAPI + FAISS + Redis for similarity-based creative reuse.

Docker for the cache service: repository root `docker compose --profile recommendation-stack`, or **`AdVerb/docker-compose.yml`**.

See **[`../ARCHITECTURE.md`](../ARCHITECTURE.md)**.
