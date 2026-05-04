# System architecture

This repository implements a **layered ad-tech stack**: real-time recommendation and creative assembly (Go, ML, edge), plus a **brand and campaign platform** (Python) and **serving / analytics** (Python, Redis streams).

## Logical pipeline (full stack)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Edge: Cloudflare Worker (`edge-worker/`)                                │
│  POST /ad  ·  KV cache  ·  regional routing  ·  Workers AI copy guard    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ cache miss
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Decision engine: Go (`decision-engine/`)                                │
│  POST /recommend  ·  template + overlay scoring  ·  UCB / engagement     │
│  CLIP-style dot products over precomputed asset & query embeddings       │
└───────────────┬───────────────────────────────┬─────────────────────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────┐     ┌─────────────────────────────────────────┐
│  ML (`ml/`)               │     │  Template catalog (`templates/`)        │
│  Offline embeddings,      │     │  JSON catalog + asset keys              │
│  filters, ONNX export;    │     │  Mounted into decision-engine image     │
│  FAISS cache service      │     │                                         │
└───────────────────────────┘     └─────────────────────────────────────────┘
```

Optional **user embedding** service (e.g. Triton) sits upstream of scoring in deployments that use live user vectors; the Go service consumes fixed `query_embeddings.json` for demos.

## Demo runtime (AdaptAI / adverb product)

The **default Docker Compose** stack (`docker compose up` at repo root) runs the **brand portal + feed + admin** product:

- **brand-api** (FastAPI): brands, campaigns, products, creative generation.
- **ad-serving** (FastAPI): personalized feed, MAB, Redis stream events.
- **analytics-worker**: consumes `ad_events`, writes PostgreSQL aggregates.
- **PostgreSQL + Redis + RabbitMQ** as in `docker-compose.yml`.

### Creative generation on that path (current default)

1. **Copy**: Groq (`GROQ_API_KEY`) produces headline / subheadline / CTA variants.
2. **Image**: When `AD_PLAIN_BACKGROUND_ONLY` is **false**, backgrounds are fetched from **Pollinations** (`image.pollinations.ai`), then composed with product and logo and uploaded to **Cloudinary**. When **true** (compose default), backgrounds are **local PIL** “studio” plates (no third-party image API).

3. **Recommendation stack** (Go + FAISS cache + reference UI) is **not** on the hot path for that compose file; it ships in-repo for the architecture above and can be run separately (see below).

## Running the Go + ML reference stack

From `AdVerb/` (legacy RTB-style UI against the decision engine):

```bash
cd AdVerb
docker compose up --build
```

- Reference UI: `http://localhost:3100` (mapped from container `:3000`)
- Decision engine: `http://localhost:8080/health`
- Creative cache (FAISS): `http://localhost:8001/health`

Root compose can also start the Go service beside the main stack:

```bash
docker compose --profile recommendation-stack up --build
```

See `docker-compose.yml` for the `recommendation-stack` profile (decision-engine + shared Redis).

## Repository map

| Path | Role |
|------|------|
| `decision-engine/` | Go HTTP `/recommend`, `/click`, metrics |
| `ml/` | Python tooling: embeddings, filters, FAISS cache service Dockerfile |
| `edge-worker/` | Cloudflare Worker (TypeScript): `/ad`, cache, Workers AI |
| `templates/` | Catalog JSON consumed by decision-engine |
| `services/brand-api/` | FastAPI brand + creative generation |
| `services/ad-serving/` | FastAPI serving + MAB |
| `services/analytics-worker/` | Stream consumer |
| `AdVerb/ui/` | Next.js reference client for latency / simulation |

This split keeps **production-style demos** (Python stack) and **edge + Go reference** (sub-100 ms path) both visible in one GitHub project.
