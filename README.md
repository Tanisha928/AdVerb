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

## Testing

The project includes a full automated test suite covering both the frontend Next.js app and the backend FastAPI service.

### Frontend — Vitest + React Testing Library (`apps/adpulse`)

**Tools:** [Vitest](https://vitest.dev/), [React Testing Library](https://testing-library.com/), jsdom, MSW

**What is tested:**

| Area | File | Coverage |
|------|------|----------|
| `StatusBadge` component | `__tests__/components/StatusBadge.test.tsx` | Renders correct label and CSS class for every status |
| `AngleBadge` component | `__tests__/components/AngleBadge.test.tsx` | Text transformation, colour variants |
| `AdCard` component | `__tests__/components/AdCard.test.tsx` | Headline/CTA render, click tracking, localStorage, brand colour |
| `CampaignManage` component | `__tests__/components/CampaignManage.test.tsx` | Campaign load, product list, launch gate, creative generation flow |
| `lib/api` utilities | `__tests__/lib/api.test.ts` | `apiGet`, `apiPost`, `apiPatch` — correct URLs, headers, error handling |
| `lib/ad` utilities | `__tests__/lib/ad.test.ts` | `fetchFeed`, `trackClick` — parameter passing and API calls |
| `lib/demoUsers` | `__tests__/lib/demoUsers.test.ts` | Structure and uniqueness of demo user data |

**Run the frontend tests:**

```bash
cd apps/adpulse
npm install              # first time only
npm run test:run         # single run (CI-friendly)
npm test                 # watch mode
npm run test:coverage    # with lcov/text coverage report
```

---

### Backend — Pytest (`services/brand-api`)

**Tools:** [pytest](https://pytest.org/), [pytest-mock](https://pytest-mock.readthedocs.io/), FastAPI `TestClient`, `unittest.mock.MagicMock`

All database calls are mocked via a `mock_db` fixture — no real Postgres needed to run the tests.

**What is tested:**

| Router | File | Coverage |
|--------|------|----------|
| `/brands` | `tests/test_brands.py` | Create, list, get, stats calculation |
| `/campaigns` | `tests/test_campaigns.py` | Create, list, status transitions, analytics, error handling |
| `/creatives` | `tests/test_creatives.py` | List, approve, reject, validation |
| `/products` | `tests/test_products.py` | Create, list, duplicate detection, key benefit parsing |

**Run the backend tests:**

```bash
cd services/brand-api
pip install -r requirements.txt
pip install -r requirements-test.txt   # pytest + pytest-mock
pytest tests/ -v                        # all tests, verbose
pytest tests/test_brands.py -v         # single file
pytest tests/ -v --tb=short            # compact tracebacks
```

---

### Manual / End-to-End Testing (application flow)

With the full stack running (`docker compose up --build`), walk through these flows in the browser:

**1 — Brand Portal** (`http://localhost:3000` → Brand Portal tab)
- Create a new brand with logo, colours, and target audience.
- Add a campaign and set it to **live**.
- Add a product with key benefits.
- Click **Generate Creatives** — verify AI copy and composed images appear.
- Review creatives: approve one, reject another with a note.

**2 — User Feed** (`http://localhost:3000` → User Feed tab)
- Select a demo user profile (or browse anonymously).
- Scroll the feed — confirm personalised ads render with correct brand colours and CTA.
- Click an ad — verify the click event registers (check Admin dashboard).

**3 — Admin Dashboard** (`http://localhost:3000` → Admin tab)
- Check the **KPIs** panel for impression and click counts.
- Open **Live Events** — confirm real-time stream updates on each feed interaction.
- Check **Campaign Performance** table for per-campaign CTR.
- Check **MAB Weights** chart — weights should shift after enough clicks.

**4 — API docs** (optional, for inspecting raw responses)
- brand-api Swagger: `http://localhost:8800/docs`
- ad-serving Swagger: `http://localhost:8801/docs`

---

## Conclusion

Adverb demonstrates an end-to-end ad platform workflow: brands create campaigns, users receive personalized ads, and admins can observe performance and learning behavior in real time. The project can be demoed through the hosted Vercel/Render deployment or run fully locally with Docker.




