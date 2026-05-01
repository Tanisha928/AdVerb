# AdVerb Project Guide

## Purpose

AdVerb is a real-time personalized ad creative demo built around RTB-style latency constraints.  
Given a user profile (age, interests, location, device), it recommends an ad template, assembles creative metadata, and shows a latency breakdown in the UI.

The project demonstrates:
- fast recommendation flow (`/recommend`)
- creative assembly fields (brand, category, asset URLs, CTA)
- observable latency metrics for each request

## High-Level Architecture

### Core flow (primary design)
1. UI submits ad request payload.
2. Edge worker handles cache/routing/AI copy orchestration.
3. Worker calls Go decision engine `/recommend`.
4. Decision engine scores templates and returns creative spec + latency.
5. UI renders creative card and latency dashboard.

### Docker-local flow (current local convenience path)
1. UI calls Next.js API route `ui/src/app/api/ad/route.ts`.
2. Route forwards request to decision engine (`DECISION_ENGINE_URL`).
3. Route normalizes response shape for UI.
4. UI renders response directly.

## Key Components

- `ui/` — Next.js frontend (dashboard, form, ad card, latency visuals)
- `worker/` — Cloudflare Worker orchestration (`/ad`, KV cache, AI fallback)
- `decision-engine/` — Go recommendation service (`/recommend`, `/health`)
- `ml/` — offline synthetic data generation, model training, ONNX export
- `templates/` — template catalog metadata (`catalog.json`)
- `infra/` — deployment assets for Fly/Triton style setup
- `assets/` — R2 asset upload script

## Important Files and Directories

- `README.md` — project overview and component summary
- `DEPLOYMENT.md` — deployment runbook (ML, worker, Fly, UI)
- `DOCKER_RUN.md` — Docker Compose run instructions
- `docker-compose.yml` — local stack (decision-engine + UI)
- `.gitignore` — ignored generated/build artifacts

### UI
- `ui/src/app/page.tsx` — main dashboard screen
- `ui/src/app/api/ad/route.ts` — local API bridge to decision engine
- `ui/src/lib/api.ts` — frontend request wrapper
- `ui/src/components/AdForm.tsx` — profile input form
- `ui/src/components/AdCreativeCard.tsx` — creative rendering (with demo visual fallbacks)
- `ui/src/components/LatencyDashboard.tsx` — latency metrics UI

### Worker
- `worker/src/index.ts` — worker request pipeline and cache logic
- `worker/src/cache.ts` — cache key + KV helpers
- `worker/src/ai.ts` — Workers AI call + fallback
- `worker/src/router.ts` — location-to-region routing
- `worker/wrangler.toml` — Worker bindings and vars

### Decision Engine
- `decision-engine/cmd/server/main.go` — service startup and route registration
- `decision-engine/internal/handler/recommend.go` — recommendation endpoint logic
- `decision-engine/internal/scoring/scorer.go` — dot-product template scoring
- `decision-engine/internal/catalog/catalog.go` — catalog and embedding loaders
- `decision-engine/internal/catalog/types.go` — request/response contract structs

### ML
- `ml/data/generate_dataset.py` — synthetic training data generation
- `ml/model/train.py` — training script
- `ml/model/export_onnx.py` — ONNX and embedding export
- `ml/requirements.txt` — Python dependencies

## Setup and Installation

## Prerequisites
- Node.js 18+
- npm
- Python 3.10+
- (Optional full edge path) Wrangler CLI and Cloudflare account
- (Optional local container path) Docker Desktop

### Option A: Docker (recommended for local demo)

From repo root:

```bash
docker compose up --build
```

Then open:
- UI: `http://localhost:3000`
- Decision engine health: `http://localhost:8080/health`

Stop:

```bash
docker compose down
```

### Option B: Local services

1. **ML prep (optional for full model artifacts)**
```bash
cd ml
pip install -r requirements.txt
python data/generate_dataset.py
python model/train.py
python model/export_onnx.py
```

2. **Decision engine**
```bash
cd decision-engine
go mod tidy
go run ./cmd/server
```

3. **Worker**
```bash
cd worker
npm install
wrangler dev --remote
```

4. **UI**
```bash
cd ui
npm install
npm run dev
```

## Run, Test, and Deploy

### Run
- UI dev: `cd ui && npm run dev`
- UI prod build check: `cd ui && npm run build`
- Decision engine: `cd decision-engine && go run ./cmd/server`
- Worker dev: `cd worker && wrangler dev --remote`
- Docker stack: `docker compose up --build`

### Test
There is no formal automated test suite committed yet. Current validation is:
- compile/build checks (`npm run build` in `ui`)
- endpoint smoke checks (`/health`, UI request path)
- manual UI flow testing

### Deploy
Follow `DEPLOYMENT.md`:
- train/export ML artifacts
- upload assets to R2
- deploy decision engine to Fly
- deploy Worker via Wrangler
- deploy UI to hosting (Cloudflare Pages or equivalent)

## Design Decisions and Patterns

- **Latency-first design**: responses include timing metrics for transparency.
- **Separation of concerns**:
  - UI handles presentation and interaction.
  - Worker handles edge orchestration and cache policy.
  - Decision engine handles recommendation/scoring logic.
- **Contract-driven payloads**:
  - Go and TS model request/response structures explicitly.
- **Graceful fallback behavior**:
  - Decision engine can use deterministic fallback embeddings when artifact file is missing.
  - UI supports demo visual fallbacks when remote asset URLs are placeholders/unavailable.
- **Modular frontend components**:
  - `AdForm`, `AdCreativeCard`, `LatencyDashboard`, `AuctionAnimation`, etc.

## Dependencies, Environment Variables, and External Services

### Major dependencies
- UI: Next.js, React, Tailwind, TypeScript
- Worker: Wrangler, TypeScript
- Decision engine: Go 1.22, gRPC package
- ML: numpy, pandas, scikit-learn, torch, onnx

### Key environment variables

#### Decision engine
- `CATALOG_PATH` (default: `../templates/catalog.json`)
- `ITEM_EMBEDDINGS_PATH` (default: `./item_embeddings.json`)
- `TRITON_ADDR` (default: `localhost:8001`)
- `R2_PUBLIC_BASE` (default placeholder; set real public asset base in production)

#### UI
- `DECISION_ENGINE_URL` (used by `ui/src/app/api/ad/route.ts`, default `http://localhost:8080`)
- `NEXT_PUBLIC_WORKER_URL` (used in direct worker mode)

#### Worker (`worker/wrangler.toml`)
- `FLY_IAD_URL`
- `FLY_SJC_URL`
- `CACHE_TTL_SECONDS`
- Cloudflare bindings:
  - `CREATIVE_CACHE` (KV)
  - `AD_ASSETS` (R2)
  - `AI` (Workers AI)

### External services
- Cloudflare Workers / KV / R2 / Workers AI
- Fly.io (decision engine hosting)
- Triton Inference Server (target design for embedding inference)

## Contributor Conventions

- Keep request/response contracts synchronized between Go (`types.go`) and UI/worker TS types.
- Prefer small, modular UI components with clear props.
- Preserve latency fields when modifying request flow.
- Avoid committing generated artifacts (`node_modules`, `.next`, parquet/model outputs).
- Use deterministic fallbacks for local/dev experience where external services may be unavailable.
- Update docs (`README.md`, `DOCKER_RUN.md`, `DEPLOYMENT.md`, this file) when behavior or run flow changes.
