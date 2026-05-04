# adverb (AdaptAI)

Distributed creative intelligence platform for demos: brand portal, personalized feed, and admin analytics — wired through PostgreSQL, Redis Streams, and FastAPI services.

## Quick start

1. Copy environment variables and add API keys.
   - **Brand portal creative generation**: `GROQ_API_KEY` (ad copy), **Cloudinary** credentials (upload composed creatives). For **AI backgrounds** (not the default plain studio mode), set `AD_PLAIN_BACKGROUND_ONLY=false` and allow outbound HTTPS to **Pollinations**; optional `AD_IMAGE_BACKEND=adverb` uses local PIL only (no image API).
   - Seeded data still runs demo serving without generation keys.

```bash
cp .env.example .env
# Edit .env — at minimum GROQ_API_KEY + Cloudinary for generate-creatives
```

2. Build and run everything:

```bash
docker compose up --build
```

3. Open the apps:

| URL | App |
|-----|-----|
| http://localhost:3010 | Brand Portal |
| http://localhost:3001 | User Feed |
| http://localhost:3002 | Admin Dashboard |
| http://localhost:8800 | Brand API (docs: `/docs`) |
| http://localhost:8801 | Ad Serving API (`/docs`) |

Backends: PostgreSQL on host **`localhost:5433`**, Redis on host **`localhost:6380`** (in-cluster services use `redis:6379` and `postgres:5432` unchanged).

## Full platform layout (code + docs)

The repo includes the **edge + Go + ML** recommendation stack **and** the **AdaptAI** Python product:

| Area | Path |
|------|------|
| Go decision engine | `decision-engine/` |
| ML / embeddings / FAISS cache service | `ml/` |
| Cloudflare Worker (edge) | `edge-worker/` |
| Template catalog | `templates/` |
| Brand + serving + analytics | `services/`, `apps/` |

**How it fits together** (diagrams, hot path vs demo path): **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**.

Optional: start the Go service and FAISS cache **next to** the main stack (shared Redis, separate DB indexes):

```bash
docker compose --profile recommendation-stack up --build
```

- Decision engine: `http://localhost:8080/health`
- Creative cache: `http://localhost:8001/health`

The brand portal **does not** call these by default; they demonstrate the architecture and support the reference UI under `AdVerb/ui/`.

## Architecture (ASCII) — demo product

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Brand Portal│   │  User Feed  │   │    Admin    │
│   :3010     │   │   :3001     │   │   :3002     │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                  │
       ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────────────────────────┐
│  Brand API   │  │        Ad Serving API            │
│  host :8800  │  │  host :8801 · MAB · Redis cache  │
└──────┬───────┘  └───────────────┬────────────────┘
       │                          │
       ▼                          │  XADD ad_events
┌──────────────┐                  ▼
│  PostgreSQL  │         ┌────────────────┐
│ host :5433   │◄────────│ Analytics      │
└──────────────┘         │ Worker         │
       ▲                 └────────┬───────┘
       │                          │
       └──────────────────────────┘
                    Redis :6379
              (streams, MAB state, cache)
```

## What’s implemented now

- **Brand workflow updates**
  - Creative cards that are already reviewed now show status instead of showing Approve/Reject again.
  - Campaign page supports generating creatives for already-added products (including per-product generate action).
  - If a campaign is already live and you generate creatives for a new product, it returns to `live` after generation (does not get stuck in review).

- **Personalized feed updates**
  - Feed API accepts interest categories and uses user-interest/category matching in scoring.
  - Per-user click history is stored in Redis (`user_clicks:{user_id}`) and boosts campaign ranking.
  - User profile local interest edits are used by the feed request path.

- **Brand analytics fix**
  - Brand-level impressions/clicks are aggregated from `ad_events` (event pipeline), not stale creative counters.

- **Frontend naming**
  - User-visible frontend branding is updated to **adverb**.

## Distributed systems concepts (where they appear)

- **Event-driven pipeline**: Ad Serving writes impressions/clicks to a Redis Stream (`ad_events`); the Analytics Worker consumes asynchronously and persists to PostgreSQL and updates Redis aggregates — *decoupling* producers from storage.
- **Caching & latency**: User profiles, live campaigns, and “last served” creative are cached in Redis; `/serve-ad` logs `perf_counter` latency and exposes p50/p95 to the admin UI — *read-through / TTL caching* on the hot path.
- **Online learning**: Epsilon-greedy MAB over creative variants with weights in Redis hashes; history appended for dashboard charts — *explore/exploit* without batch training.
- **Personalization memory**: Per-user campaign click history (`user_clicks:{user_id}`) influences ranking in `score_campaigns` — *session-to-session preference adaptation*.
- **Fatigue / suppression**: Per-user per-creative view counts in Redis (`seen:user:creative`) — *rate limiting* style guardrails.
- **Container orchestration**: One compose stack; services scale independently in principle (stateless APIs + shared Redis/Postgres).

## Demo script (suggested order)

1. **Admin** (`:3002`): Confirm KPI cards and empty/low MAB chart until traffic exists.
2. **User Feed** (`:3001`): Pick a demo user → refresh feed → click several CTAs.
3. **Admin**: Watch live events, CTR table, and MAB weight history updating; check serve latency line in the header.
4. **Brand Portal** (`:3010`): Open a seeded brand → campaign → optional “Generate creatives” (needs `.env` keys) → review → launch.

## Development notes

- Server-side Next.js fetches from Docker use internal URLs (`BRAND_API_URL`, `AD_SERVING_INTERNAL_URL`); the browser still uses `NEXT_PUBLIC_*` `localhost` ports.
- If creative generation fails without keys, seed data still includes approved creatives for serving.

## Troubleshooting

- **Connect from your machine** (psql, GUI): use `localhost:5433`, user `adaptai`, password `adaptai_secret`, database `adaptai`. Services in Docker still use `postgres:5432` and do not need a change.

- **Postgres fails with “data directory was initialized by PostgreSQL version X”**: Your Docker volume was created by a different major version. Either align `postgres:` image in `docker-compose.yml` with that version, or remove the volume and re-init (destructive): `docker compose down -v` then `docker compose up --build` (only removes compose-named volumes when no longer referenced).

- **`password authentication failed for user "adaptai"`** (brand-api, ad-serving, analytics-worker): The `postgres_data` volume was first created with a **different** password than `adaptai_secret`. Changing `POSTGRES_PASSWORD` in compose does not update an existing database. **Fix:** remove the Postgres volume and let Docker re-init (see above), *or* run `ALTER USER adaptai PASSWORD 'adaptai_secret';` **inside** Postgres if you can still connect with the old password.

- **`invalid input syntax for type uuid`** during `init.sql` / Postgres exits: Seed IDs must be valid **hex** UUIDs (only `0-9` and `a-f`). After fixing `init.sql`, **recreate the DB volume** so init runs again: `docker compose down` then `docker volume rm <project>_postgres_data` and `docker compose up --build`.

- **`TypeError: failed to fetch` on Brand Portal / User Feed forms**: Usually **CORS** (API must allow the browser’s origin, including non-default ports like `http://localhost:3010`) or the **wrong API URL** (e.g. `NEXT_PUBLIC_BRAND_API_URL` must match the host port you published for `brand-api`, such as `http://localhost:8800`). Rebuild the Brand API image after CORS changes: `docker compose up -d --build brand-api`. Rebuild the brand-portal image if you change public API URL env: `docker compose build brand-portal`.

- **`Connection refused` to Postgres on first boot**: API services can start before Postgres accepts connections. This compose file uses a **Postgres healthcheck** and `depends_on: condition: service_healthy` so clients wait until the DB is ready. If you still see races, `docker compose restart ad-serving analytics-worker brand-api` after Postgres is up.
