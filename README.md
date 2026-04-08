# AdaptAI

Distributed creative intelligence platform for coursework demos: brand portal, personalized feed, and admin analytics — all wired through PostgreSQL, Redis Streams, and FastAPI services.

## Quick start

1. Copy environment variables and add API keys (Groq + Cloudinary are required for **generating** new creatives; the seeded DB runs demos without them).

```bash
cp .env.example .env
# Edit .env — set GROQ_API_KEY and Cloudinary credentials for AI + uploads
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

## Architecture (ASCII)

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

## Distributed systems concepts (where they appear)

- **Event-driven pipeline**: Ad Serving writes impressions/clicks to a Redis Stream (`ad_events`); the Analytics Worker consumes asynchronously and persists to PostgreSQL and updates Redis aggregates — *decoupling* producers from storage.
- **Caching & latency**: User profiles, live campaigns, and “last served” creative are cached in Redis; `/serve-ad` logs `perf_counter` latency and exposes p50/p95 to the admin UI — *read-through / TTL caching* on the hot path.
- **Online learning**: Epsilon-greedy MAB over creative variants with weights in Redis hashes; history appended for dashboard charts — *explore/exploit* without batch training.
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
