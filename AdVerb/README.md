# AdVerb reference UI (RTB-style latency demo)

Real-time personalized ad creative pipeline targeting sub-100 ms style windows. **Source of truth for components** now lives at the **repository root** next to the AdaptAI product stack.

## Components (repo root)

| Path | Role |
|------|------|
| `../decision-engine/` | Go service: `POST /recommend`, engagement-aware scoring |
| `../ml/` | Offline embeddings, filters, **FAISS** creative cache (`creative_cache_service`) |
| `../edge-worker/` | Cloudflare Worker: `/ad`, KV cache, Workers AI copy |
| `../templates/` | Template catalog (JSON) for the decision engine |
| `ui/` | Next.js client: latency breakdown, simulation |
| `infra/` | Prometheus / Grafana for this bundle |
| `assets/` | Static creative helpers |

## End-to-end flow (this subsystem)

1. UI (or Worker) issues a recommendation request.
2. Edge Worker checks KV cache (when deployed).
3. On miss, Worker calls Go **`/recommend`** on `decision-engine`.
4. Go scores templates / overlays using precomputed embeddings (and optional UCB from Redis).
5. Copy can be refined with **Workers AI** on the edge path.
6. Response includes creative asset URLs and latency metadata.

## Run this bundle only

From **this directory**:

```bash
docker compose up --build
```

- Reference UI: **http://localhost:3100**
- Decision engine: **http://localhost:8080/health**
- Creative cache: **http://localhost:8001/health**

The **main product** (brand portal, feed, admin) starts from the **repo root**: `docker compose up --build` there. See **[`../ARCHITECTURE.md`](../ARCHITECTURE.md)** for how both stacks relate.
