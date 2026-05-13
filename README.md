# Adverb

End-to-end **personalized ad creative** platform: an **edge + Go + ML** recommendation layer (template scoring, embeddings, optional FAISS cache) plus a **Python product** for brands (campaigns, creative generation, review) and **real-time serving** with MAB, Redis streams, and analytics.

---

## Deployed demo

| App / Service | URL |
|---------------|-----|
| adverb app | `https://your-vercel-app.vercel.app` |
| brand-api health | `https://your-brand-api.onrender.com/health` |
| ad-serving health | `https://your-ad-serving.onrender.com/health` |

Demo flow:

1. Open the deployed adverb app.
2. Use **Brand Portal** to create/review/launch creatives.
3. Use **User Feed** to generate impressions and clicks.
4. Use **Admin** to view KPIs, live events, campaign performance, and MAB weights.

---

## Local Docker run

Start the full local stack:

```bash
docker compose up --build
```

Open:

| URL | App |
|-----|-----|
| http://localhost:3000 | Merged adverb app |
| http://localhost:3010 | Brand portal |
| http://localhost:3001 | User feed |
| http://localhost:3002 | Admin dashboard |
| http://localhost:8800 | brand-api (`/docs`) |
| http://localhost:8801 | ad-serving (`/docs`) |
| http://localhost:9091 | Prometheus |
| http://localhost:3004 | Grafana (`admin` / `admin`) |

Creative generation requires `GROQ_API_KEY` and Cloudinary credentials in `.env`.

---

## Architecture

### High level

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Edge: Cloudflare Worker (`edge-worker/`)                                │
│  POST /ad · KV cache · regional routing · Workers AI copy guard          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ cache miss
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Decision engine — Go (`decision-engine/`)                                │
│  POST /recommend · template + overlay scoring · UCB / Redis engagement   │
│  CLIP-style scores over precomputed asset & query embeddings              │
└───────────────┬───────────────────────────────┬─────────────────────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────┐     ┌─────────────────────────────────────────┐
│  ML (`ml/`)               │     │  Catalog (`templates/`)               │
│  Offline embeddings,      │     │  JSON templates + asset keys          │
│  filters, ONNX export;     │     │  Mounted into decision-engine image   │
│  FAISS cache (`creative_   │     │                                         │
│   cache_service`)          │     │                                         │
└───────────────────────────┘     └─────────────────────────────────────────┘

        Brand & serving stack (default `docker compose` at repo root)

┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Brand Portal│   │  User Feed  │   │    Admin    │
│   :3010     │   │   :3001     │   │   :3002     │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                  │
       ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────────────────────────┐
│  brand-api   │  │  ad-serving · MAB · Redis cache    │
│  :8800       │  │  :8801                             │
└──────┬───────┘  └───────────────┬──────────────────┘
       │                          │  XADD ad_events
       ▼                          ▼
┌──────────────┐         ┌────────────────┐
│  PostgreSQL  │◄────────│ analytics-worker│
│  :5433 host  │         └────────┬───────┘
└──────────────┘                  │
       ▲                          │
       └──────────────────────────┘
                    Redis :6379
              (streams, MAB, user signals)
```

---

## Repository layout

| Path | Purpose |
|------|---------|
| `edge-worker/` | Cloudflare Worker (TypeScript) |
| `decision-engine/` | Go HTTP recommendation service |
| `ml/` | Python ML scripts + FAISS creative cache Dockerfile |
| `templates/` | Template catalog JSON for the Go service |
| `services/brand-api/` | FastAPI — brands, campaigns, products, creatives |
| `services/ad-serving/` | FastAPI — `/serve-ad`, events, MAB |
| `services/analytics-worker/` | Redis stream / RabbitMQ → Postgres event worker |
| `apps/adpulse/` | Merged Next.js UI for Brand Portal, User Feed, and Admin |
| `apps/brand-portal`, `apps/user-feed`, `apps/admin` | Separate Next.js UIs kept for local/dev demos |
| `assets/` | Static backgrounds + helpers for `ml/` |
| `db/init.sql` | Schema + seed data |
| `monitoring/` | Prometheus + Grafana for the Python services |

---

## Features

- Unified **Brand Portal**, **User Feed**, and **Admin Dashboard** in one deployed app.
- Brand and campaign management with product setup and creative review.
- AI-assisted creative generation with copy variants, composed ad images, and Cloudinary-hosted assets.
- Real-time ad serving with user/profile signals and campaign targeting.
- Multi-armed bandit learning for creative selection and weight updates.
- Admin visibility for KPIs, live events, campaign performance, and MAB weights.
- Local Docker stack with Postgres, Redis, RabbitMQ, Prometheus, and Grafana.

---

## Conclusion

Adverb demonstrates an end-to-end ad platform workflow: brands create campaigns, users receive personalized ads, and admins can observe performance and learning behavior in real time. The project can be demoed through the hosted Vercel/Render deployment or run fully locally with Docker.




