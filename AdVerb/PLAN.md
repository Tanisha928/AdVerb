# AdVerb — Real-Time Personalized Ad Creative Generation

> Demonstrate the creative serving layer of a DSP: given a user profile arriving in an RTB bid request, assemble and serve the most relevant personalized ad creative within the 100ms auction window — with full latency transparency.

**Framing correction from original plan:** We are NOT running the auction. Amazon/Meta/Google run auctions; advertisers participate. AdVerb is the **creative serving layer** — what a DSP does once it wins a slot: semantic matching, creative assembly, copy generation, and edge serving. The "Run Ad Auction" UI simulates receiving a bid request and responding within the window.

---

## Architecture (Current — Local Docker Stack)

```
Browser (Next.js UI)
  └─► POST /api/ad → Next.js route (ui/src/app/api/ad/route.ts)
        ├─► POST /recommend → Go Decision Engine (docker, :8080)
        │     ├─► lookup precomputed CLIP query embedding (age_group × primary_interest)
        │     ├─► dot_product(query_emb, asset_embs) filtered by template category
        │     └─► returns CreativeSpec + { matchingLatencyMs, totalLatencyMs }
        ├─► getAdCopy() → Nebius AI (Llama 3.1 8B) OR in-memory cache
        │     ├─► cache key: category|ageGroup|primaryInterest|eventWeek
        │     ├─► cache HIT  → 0ms
        │     └─► cache MISS → Nebius API (~300–600ms), 600ms timeout + fallback
        └─► Return AdResponse { creative, latency, imageGeneration }
```

## Architecture (Target — Cloudflare Production)

```
Browser (Next.js UI on Cloudflare Pages)
  └─► POST /ad → Cloudflare Worker (selected PoP)
        ├─► KV cache CHECK (key: category|ageGroup|interest|device — only if CTR ≥ threshold)
        │     HIT  → return immediately (~5ms total)
        │     MISS → continue
        ├─► POST /recommend → Fly.io Go Decision Engine (same region)
        ├─► Nebius AI copy (via fetch, parallel) OR warm cache hit
        ├─► CTR check: UCB score(variant) ≥ min_threshold → write to KV
        └─► Return AdResponse
```

### Latency Budget (cold cache, production)

| Step | Time |
|---|---|
| KV miss check | ~2ms |
| Network: Worker → Fly.io + back | ~10ms |
| Go: CLIP dot products | <1ms |
| Nebius copy (parallel, warm cache) | 0ms (hit) / ~400ms (miss, background) |
| Worker edge overhead | ~3ms |
| **Total (warm copy cache)** | **~16ms** |

---

## Tech Stack

| Layer | Technology | Status |
|---|---|---|
| Demo UI | Next.js 16 (TypeScript), Tailwind | ✅ Running locally |
| Local API bridge | Next.js route `/api/ad` | ✅ Proxies to Go, wires Nebius copy |
| Edge worker | Cloudflare Workers (TypeScript) | ⚠ Implemented, not deployed |
| LLM copy | **Nebius AI — Llama 3.1 8B** (OpenAI-compatible API) | ✅ Wired, in-memory cache |
| Asset storage | **Supabase Storage** (`adverb-assets` bucket) | ✅ 300 assets uploaded |
| Asset storage (prod target) | Cloudflare R2 | ⬜ Not yet |
| Creative cache | Cloudflare KV (CTR-gated) | ⚠ Wired in Worker, not deployed |
| CTR state | **Upstash Redis** (sorted sets + counters) | ✅ Wired — click endpoint + UCB scorer live |
| Decision engine | Go, docker-local / Fly.io target | ✅ Running locally |
| Semantic matching | CLIP ViT-B-32, precomputed offline | ✅ Complete |
| Embedding pipeline | Python + open-clip-torch | ✅ Complete |

### Architecture Decisions (locked)

| Decision | Choice | Reason |
|---|---|---|
| Inference at serving time | ❌ None | All embeddings precomputed offline; serving is pure dot products <1ms |
| Two-tower PyTorch + Triton | ❌ Dropped | CLIP ViT-B-32 better out-of-the-box with no training data |
| Workers AI for copy | ❌ Dropped | Workers AI latency unpredictable; Nebius gives OpenAI-compatible API with faster P95 |
| Copy caching strategy | eventWeek × (category, ageGroup, interest) | Rotates with seasonal context; cache hit = 0ms |
| Creative caching strategy | CTR-gated UCB | Only cache variants above minimum engagement threshold |
| CTR state store | Upstash Redis | Atomic INCR, sorted sets for UCB ranking, HTTP API works with CF Workers |
| Asset serving (local) | Supabase Storage CDN | Wired and working; free tier sufficient for demo |
| Asset serving (prod) | Cloudflare R2 | Free egress, co-located with Workers |

---

## Repository Structure (Current State)

```
adverb/
  ui/                             ✅ COMPLETE
    src/app/api/ad/route.ts       ✅ Wires Go + Nebius copy, propagates UCB fields
    src/app/api/click/route.ts    ✅ POST /api/click — forwards to Go /click endpoint
    src/lib/copyGen.ts            ✅ Nebius API + seasonal context + in-memory cache
    src/lib/api.ts                ✅ recordClick() helper
    src/lib/types.ts              ✅ copyFromCache + UCB fields in latency type
    src/components/
      AdCreativeCard.tsx          ✅ Thumbs up/down fires recordClick(); redesigned layout
      LatencyDashboard.tsx        ✅ Shows all components including server overhead

  decision-engine/                ✅ COMPLETE
    cmd/server/main.go            ✅ Loads catalog, asset_index, query_embeddings, Redis store
    internal/catalog/types.go     ✅ AssetEntry, QueryEmbedding, UCB fields in RecommendResponse
    internal/catalog/catalog.go   ✅ LoadAssetIndex, LoadQueryEmbeddings
    internal/scoring/scorer.go    ✅ ScoreAssets with category filter + UCB adjustment
    internal/handler/recommend.go ✅ primary_interest → query_emb → filter → UCB-adjusted dot product
    internal/handler/click.go     ✅ POST /click — increments Redis impression/click counters
    internal/engagement/store.go  ✅ UCB scorer: CTR + sqrt(2 ln(N) / n) per variant
    internal/engagement/redis_client.go ✅ Upstash Redis HTTP client (atomic INCR)
    asset_index.json              ✅ 310 entries with full metadata + 512-dim CLIP embeddings
    query_embeddings.json         ✅ 60 entries (5 age groups × 12 interests)

  worker/                         ⚠ IMPLEMENTED, NOT DEPLOYED
    src/index.ts                  ⚠ CTR-gated KV write implemented; needs wrangler.toml IDs filled
    wrangler.toml                 ⚠ REPLACE_WITH_KV_ID still placeholder

  ml/                             ✅ COMPLETE
    generate_backgrounds.py       ✅ 10 plain-color background JPEGs
    embed_assets.py               ✅ Reads metadata.yaml, outputs asset_index.json with full metadata
    embed_queries.py              ✅ 60 CLIP text embeddings
    upload_assets.py              ✅ Uploads to Supabase Storage (upsert-safe)
    organize_assets.py            ✅ Extracts zip archives, renames to semantic names, appends metadata.yaml
    gen_label_studio_tasks.py     ✅ Generates Label Studio import JSON + label config XML from Supabase URLs
    apply_label_studio_export.py  ✅ Writes label_studio_id back to metadata.yaml after labeling
    requirements.txt              ✅ open-clip-torch, pillow, pyyaml, supabase, python-dotenv

  assets/
    overlays/                     ✅ 300 PNGs across 5 categories (gitignored — stored in Supabase)
    backgrounds/                  ✅ 10 plain-color JPEGs
    metadata.yaml                 ✅ Source of truth for asset category, tags, brand_hint (310 entries)

  templates/
    catalog.json                  ✅ 12 brand/category templates (added fashion: UrbanLux, GlimmerCo)

  .env                            ✅ SUPABASE_URL, SUPABASE_SERVICE_KEY, NEBIUS_API_KEY
  .env.example                    ✅ Documents required vars
  docker-compose.yml              ✅ decision-engine + ui, R2_PUBLIC_BASE → Supabase
```

---

## Completed Phases

### ✅ Phase 1 — CLIP Embedding Pipeline
- `generate_backgrounds.py` → 10 background JPEGs
- `embed_assets.py` — reads `assets/metadata.yaml`, outputs `asset_index.json` with category/tags/brand_hint/label_studio_id + 512-dim embeddings
- `embed_queries.py` — 60 text embeddings (5 age_groups × 12 interests)
- `upload_assets.py` — pushes all assets to Supabase Storage bucket `adverb-assets`
- **To re-run when adding new products:** drop image in `assets/overlays/`, add entry to `assets/metadata.yaml`, run `embed_assets.py --incremental`, run `upload_assets.py`

### ✅ Phase 2 — Go Decision Engine (CLIP Rewrite)
- Removed Triton/gRPC entirely
- `ScoreAssets` filters by `template.Category` before dot-product scoring — ensures running template only selects shoe overlays
- `AssetEntry` carries `category`, `brand_hint`, `tags`, `label_studio_id` for future scoring hooks
- Template selected by `compatible_interests`, assets selected by CLIP — decoupled

### ✅ Phase 3 — LLM Copy Generation
- Nebius AI (Llama 3.1 8B, OpenAI-compatible) via `ui/src/lib/copyGen.ts`
- Seasonal context auto-detected from date: Super Bowl, March Madness, NBA Finals, Hyrox season, Black Friday, holiday, New Year fitness rush, etc.
- In-memory cache keyed by `category|ageGroup|primaryInterest|eventWeek`
- 600ms timeout → template fallback; background cache population on miss
- `warmCopyCache()` exported for pre-warming all segment combinations at startup
- `copyFromCache` flag exposed in latency response

### ✅ Phase 4 — UI + Card Redesign
- `AdCreativeCard`: product image centered and large on full-bleed canvas; copy/CTA overlaid on image with gradient vignette
- `LatencyDashboard`: "Server overhead" bar added so all components sum to total RTT
- Local docker stack running end-to-end: form → Go CLIP matching → Nebius copy → real Supabase images

---

## ✅ Phase 5 — CTR Tracking + UCB-Gated Caching

- ✅ `decision-engine/internal/engagement/store.go` — UCB scorer: `CTR + sqrt(2 ln(N) / n)` per variant
- ✅ `decision-engine/internal/engagement/redis_client.go` — Upstash Redis HTTP client (atomic INCR)
- ✅ `POST /click` endpoint in Go — increments impression/click counters in Redis
- ✅ UCB score returned in `RecommendResponse` so Worker can gate KV writes
- ✅ `ml/scripts/seed_synthetic_engagement.py` — Beta distribution synthetic CTR seeder for cold start
- ✅ `worker/src/index.ts` — gates KV write on `UCB_score ≥ 0.005` (0.5% floor)
- ✅ UI: thumbs up/down on `AdCreativeCard` → fires `POST /api/click` → Go `/click`
- ⬜ Seed Redis with synthetic data before demo: `python ml/scripts/seed_synthetic_engagement.py`
- ⬜ Add UCB score + impression count to `LatencyDashboard` for demo transparency

---

## Phase 6 — Product Images (Diversity)  ✅ COMPLETE

- ✅ 300 product PNGs across 5 categories: shoes-running (51), wearable-watch (70), apparel-shirt (70), fashion-handbag (39), fashion-earring (70)
- ✅ All entries added to `assets/metadata.yaml` with correct `category` and `tags`
- ✅ `organize_assets.py` — extracts zips, renames to semantic names, appends metadata automatically
- ✅ `embed_assets.py` — full rebuild, 300 CLIP embeddings in `decision-engine/asset_index.json`
- ✅ `upload_assets.py` — all 300 assets in Supabase Storage `adverb-assets` bucket
- ✅ Added `fashion` catalog templates (ids 10 + 11: UrbanLux handbag, GlimmerCo jewelry) to `templates/catalog.json`
- ✅ Label Studio pipeline: `gen_label_studio_tasks.py` + `apply_label_studio_export.py` for quality QA
- ⬜ Fix copy cache key in `copyGen.ts`: include `brand` so SwiftStride and CourtKing don't share taglines

---

## Phase 7 — Cloudflare + Fly.io Deployment  ← YOU ARE HERE

- [ ] `wrangler kv:namespace create CREATIVE_CACHE` → paste ID into `worker/wrangler.toml`
- [ ] Add Upstash Redis bindings to `wrangler.toml`
- [ ] Update `worker/src/index.ts` to call Nebius for copy (replace Workers AI reference)
- [ ] `flyctl deploy` → Go service on Fly.io `iad` + `sjc`
- [ ] Set `R2_PUBLIC_BASE` in `fly.toml` to Cloudflare R2 public URL (migrate from Supabase)
- [ ] `wrangler deploy` → Worker live
- [ ] Deploy UI to Cloudflare Pages with `NEXT_PUBLIC_WORKER_URL` pointing to Worker

---

## Phase 8 — Demo Scenarios

| Scenario | How | Talking Point |
|---|---|---|
| Interest personalization | Select running vs yoga | "CLIP picks different product; not hardcoded rules — semantic distance in 512-dim space" |
| Seasonal copy | Run in February vs June | "Copy references Super Bowl season vs NBA Finals — context-aware, not static strings" |
| Cache hit | Submit same profile twice | "Second request: copy served in 0ms from in-memory cache; creative in <5ms from KV" |
| CTR gating | New creative vs established one | "New variant gets exploration bonus via UCB; cache slot only awarded after minimum engagement" |
| Latency breakdown | Show dashboard | "Each component accounted for: Go <1ms, copy 0ms (cached), network ~10ms — total well under 100ms window" |
| Multi-region | NYC vs Los Angeles | "Worker routes to nearest Fly.io region; ~5ms NYC, ~12ms LA — co-located decision engine" |

---

## Known Gaps

| Gap | Impact | Fix |
|---|---|---|
| Brand not in copy cache key | SwiftStride and CourtKing share taglines | Add `brand` to `cacheKey()` in `copyGen.ts` |
| Copy gen not parallel with recommend | Adds serial latency on cache miss | Restructure `route.ts` to fire both simultaneously |
| Cloudflare Worker not deployed | KV cache and edge routing inactive | Phase 7 |
| Redis not seeded | UCB has no signal until seed script runs | Run `python ml/scripts/seed_synthetic_engagement.py` |
| No nutrition/yoga/cycling images | Templates for those categories have no matching assets | Download product PNGs for remaining categories and run pipeline |
