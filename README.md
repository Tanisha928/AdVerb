# adverb

End-to-end **personalized ad creative** platform: an **edge + Go + ML** recommendation layer (template scoring, embeddings, optional FAISS cache) plus a **Python product** for brands (campaigns, creative generation, review) and **real-time serving** with MAB, Redis streams, and analytics.

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

- **Brand creative generation** (hot path today): **Groq** writes copy variants; **Pollinations** generates scene backgrounds (HTTPS), then **Pillow** composites product + logo and **Cloudinary** stores the final asset (`AD_IMAGE_BACKEND=pollinations` by default). Set `AD_IMAGE_BACKEND=adverb` to use **local PIL** gradients only (no image API).
- **Go + FAISS** services are available via a **Docker Compose profile** (see below); they illustrate the full recommendation architecture alongside the product APIs.

More detail: **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

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
| `services/analytics-worker/` | Redis stream → Postgres |
| `apps/brand-portal`, `apps/user-feed`, `apps/admin` | Next.js UIs |
| `assets/` | Static backgrounds + helpers for `ml/` |
| `db/init.sql` | Schema + seed data |
| `monitoring/` | Prometheus + Grafana for the Python services |

---

## Prerequisites

- **Docker Desktop** (or Docker Engine + Compose v2)
- API keys in `.env` (see below). Creative generation needs network access to **Pollinations** and **Groq**, plus your **Cloudinary** account.

---

## How to run (main product)

1. **Environment**

   ```bash
   cp .env.example .env
   ```

   Set at minimum:

   - `GROQ_API_KEY` — ad copy variants  
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — uploads  

   Defaults: `AD_IMAGE_BACKEND=pollinations` (remote backgrounds). Optional: `AD_IMAGE_BACKEND=adverb` for local-only backgrounds.

2. **Start the stack** (from repository root)

   ```bash
   docker compose up --build
   ```

3. **Open the apps**

   | URL | App |
   |-----|-----|
   | http://localhost:3010 | Brand portal |
   | http://localhost:3001 | User feed |
   | http://localhost:3002 | Admin dashboard |
   | http://localhost:8800 | brand-api (`/docs`) |
   | http://localhost:8801 | ad-serving (`/docs`) |
   | http://localhost:9091 | Prometheus |
   | http://localhost:3004 | Grafana (`admin` / `admin`) |

4. **Database (host machine)**

   - Host: `localhost` port **5433**  
   - User: **`adaptai`**
   - Password: **`adaptai_secret`**
   - Database: **`adaptai`**

   Containers use `postgres:5432` with the same credentials.

---

## Optional: Go decision engine + FAISS cache

Same Redis instance, isolated DB indexes:

```bash
docker compose --profile recommendation-stack up --build
```

- Decision engine: http://localhost:8080/health  
- Creative cache: http://localhost:8001/health  

Deploy **`edge-worker/`** separately with **Wrangler** (not included in root compose).

---

## Demo flow (suggested)

1. **Admin** — confirm KPIs; generate a little traffic later.  
2. **User feed** — pick a demo user, refresh, click ads.  
3. **Admin** — watch events, CTR, MAB history.  
4. **Brand portal** — open a seeded brand → campaign → **Generate creatives** (requires `.env` keys) → review → launch.

Seeded **approved** creatives exist if you skip generation.

---

## Troubleshooting

- **`password authentication failed for user "adaptai"`** — Postgres volume was initialized with different credentials. Remove the `postgres_data` volume and re-run compose so `db/init.sql` applies again, or fix the password inside Postgres.  
- **`TypeError: failed to fetch`** — CORS or wrong `NEXT_PUBLIC_*` URL; rebuild the affected frontend image after env changes.  
- **Creative generation errors** — Confirm `GROQ_API_KEY`, Cloudinary vars, and outbound HTTPS to `image.pollinations.ai`. For air-gapped dev, set `AD_IMAGE_BACKEND=adverb`.  
- **Postgres version mismatch on volume** — Align the `postgres:` image with the volume’s major version, or remove the volume and re-init.

---

## Development notes

- Server-side Next.js uses internal Docker URLs (`BRAND_API_URL`, `AD_SERVING_INTERNAL_URL`); browsers use `NEXT_PUBLIC_*` `localhost` ports.  
- User feed stores profile keys under **`adverb_*`** in `localStorage`.
