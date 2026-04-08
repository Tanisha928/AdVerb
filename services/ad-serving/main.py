import json
import logging
import os
import random
import time
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Any
import asyncpg
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from mab import get_approved_creatives_redis_or_db, mab_select_variant, update_mab_weights
from scorer import score_campaigns

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ad-serving")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://adaptai:adaptai_secret@localhost:5432/adaptai",
)
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")

pool: asyncpg.Pool | None = None
rds: redis.Redis | None = None


async def log_event(
    user_id: str,
    creative_id: str,
    campaign_id: str,
    event_type: str,
    device_type: str,
    page_category: str,
):
    if not rds:
        return
    await rds.xadd(
        "ad_events",
        {
            "user_id": user_id,
            "creative_id": creative_id,
            "campaign_id": campaign_id,
            "event_type": event_type,
            "device_type": device_type,
            "page_category": page_category,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


async def init_mab_state():
    if not pool or not rds:
        return
    async with pool.acquire() as conn:
        campaigns = await conn.fetch(
            "SELECT id FROM campaigns WHERE status = 'live'"
        )
    for row in campaigns:
        cid = str(row["id"])
        exists = await rds.exists(f"mab:{cid}")
        if exists:
            continue
        async with pool.acquire() as conn:
            cr = await conn.fetch(
                "SELECT id FROM creatives WHERE campaign_id = $1::uuid AND status = 'approved'",
                cid,
            )
        if not cr:
            continue
        mapping = {str(x["id"]): "0.25" for x in cr}
        await rds.hset(f"mab:{cid}", mapping=mapping)


async def fetch_fallback_creative() -> dict | None:
    if not pool:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT c.id, c.headline, c.subheadline, c.cta, c.angle, c.layout,
                   c.background_color, c.assembled_image_url, c.campaign_id,
                   p.image_url as product_image_url,
                   b.name as brand_name, b.logo_url as brand_logo_url, b.color_primary
            FROM creatives c
            JOIN products p ON p.id = c.product_id
            JOIN campaigns ca ON ca.id = c.campaign_id
            JOIN brands b ON b.id = ca.brand_id
            WHERE c.status = 'approved' AND ca.status = 'live'
            ORDER BY random() LIMIT 1
            """
        )
    if not row:
        return None
    d = dict(row)
    d["id"] = str(d["id"])
    d["campaign_id"] = str(d["campaign_id"])
    return d


async def get_user_cached(user_id: str) -> dict | None:
    assert rds and pool
    key = f"user:{user_id}"
    cached = await rds.get(key)
    if cached:
        return json.loads(cached)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, name, email, age, gender, interests, location_city FROM users WHERE id = $1::uuid",
            user_id,
        )
    if not row:
        return None
    u = dict(row)
    u["id"] = str(u["id"])
    u["interests"] = list(u["interests"] or [])
    await rds.setex(key, 300, json.dumps(u, default=str))
    return u


async def get_live_campaigns_cached() -> list[dict]:
    assert rds and pool
    ck = "live_campaigns_payload"
    raw = await rds.get(ck)
    if raw:
        return json.loads(raw)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT ca.id, ca.name, ca.objective, ca.status, ca.brand_id,
                   b.name as brand_name, b.logo_url as brand_logo_url, b.color_primary,
                   b.target_interests, b.target_age_min, b.target_age_max, b.tone
            FROM campaigns ca
            JOIN brands b ON b.id = ca.brand_id
            WHERE ca.status = 'live'
            """
        )
    out = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        d["brand_id"] = str(d["brand_id"])
        d["brand"] = {
            "name": d.pop("brand_name", ""),
            "logo_url": d.pop("brand_logo_url"),
            "color_primary": d.pop("color_primary"),
            "target_interests": list(d.pop("target_interests") or []),
            "target_age_min": d.pop("target_age_min"),
            "target_age_max": d.pop("target_age_max"),
            "tone": d.pop("tone"),
        }
        out.append(d)
    await rds.setex(ck, 45, json.dumps(out, default=str))
    return out


def shape_campaign_for_scorer(c: dict) -> dict:
    return {
        "id": c["id"],
        "name": c["name"],
        "objective": c["objective"],
        "status": c["status"],
        "brand_id": c["brand_id"],
        "brand": c["brand"],
    }


class ServeBody(BaseModel):
    user_id: str
    page_category: str = "general"
    device_type: str = "mobile"


class TrackBody(BaseModel):
    user_id: str
    creative_id: str
    campaign_id: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool, rds
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)
    rds = redis.from_url(REDIS_URL, decode_responses=True)
    await init_mab_state()
    yield
    if rds:
        await rds.close()
    if pool:
        await pool.close()


app = FastAPI(title="AdaptAI Ad Serving", lifespan=lifespan)
_LOCAL_ORIGIN = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=_LOCAL_ORIGIN,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/serve-ad")
async def serve_ad(body: ServeBody):
    t0 = time.perf_counter()
    creative: dict | None = None
    try:
        assert pool and rds
        cache_key = f"served:{body.user_id}:{body.page_category}"
        cached = await rds.get(cache_key)
        if cached:
            creative = json.loads(cached)
            dt_ms = (time.perf_counter() - t0) * 1000
            await rds.lpush("serve_latency_ms", str(int(dt_ms)))
            await rds.ltrim("serve_latency_ms", 0, 99)
            return creative

        user = await get_user_cached(body.user_id)
        if not user:
            creative = await fetch_fallback_creative()
            if not creative:
                return {"error": "no_inventory", "message": "No ads available"}
            await log_event(
                body.user_id,
                creative["id"],
                creative["campaign_id"],
                "impression",
                body.device_type,
                body.page_category,
            )
            await rds.setex(cache_key, 60, json.dumps(creative, default=str))
            dt_ms = (time.perf_counter() - t0) * 1000
            await rds.lpush("serve_latency_ms", str(int(dt_ms)))
            await rds.ltrim("serve_latency_ms", 0, 99)
            return creative

        campaigns = await get_live_campaigns_cached()
        scored = score_campaigns(
            user,
            [shape_campaign_for_scorer(c) for c in campaigns],
            body.page_category,
        )
        if not scored:
            creative = await fetch_fallback_creative()
        else:
            best = scored[0]
            if best.get("score", 0) <= 0:
                best = random.choice(scored)
            creatives = await get_approved_creatives_redis_or_db(rds, pool, best["id"])
            creative = await mab_select_variant(rds, best["id"], body.user_id, creatives)
            if not creative:
                creative = await fetch_fallback_creative()

        if not creative:
            creative = await fetch_fallback_creative()
        if not creative:
            return {"error": "no_inventory", "message": "No ads available"}

        await log_event(
            body.user_id,
            creative["id"],
            creative["campaign_id"],
            "impression",
            body.device_type,
            body.page_category,
        )
        await rds.setex(cache_key, 60, json.dumps(creative, default=str))
    except Exception as e:
        logger.exception("serve_ad error: %s", e)
        creative = await fetch_fallback_creative()
        if creative and rds:
            try:
                await log_event(
                    body.user_id,
                    creative["id"],
                    creative["campaign_id"],
                    "impression",
                    body.device_type,
                    body.page_category,
                )
            except Exception:
                pass

    dt_ms = (time.perf_counter() - t0) * 1000
    logger.info("serve_ad ms=%.1f", dt_ms)
    if rds:
        await rds.lpush("serve_latency_ms", str(int(dt_ms)))
        await rds.ltrim("serve_latency_ms", 0, 99)
    return creative or {"error": "no_inventory"}


@app.post("/track-click")
async def track_click(body: TrackBody):
    try:
        assert rds
        await log_event(
            body.user_id,
            body.creative_id,
            body.campaign_id,
            "click",
            "unknown",
            "feed",
        )
        await rds.incr(f"clicks:creative:{body.creative_id}")
        await rds.delete(f"seen:{body.user_id}:{body.creative_id}")
        return {"success": True}
    except Exception as e:
        logger.exception("track_click: %s", e)
        return {"success": True}


@app.get("/user/{user_id}/feed")
async def user_feed(user_id: str):
    out: list[dict] = []
    seen_ids: set[str] = set()
    cats = ["coffee", "fitness", "beauty", "tech", "travel", "gaming", "food", "fashion"]
    for i in range(20):
        if len(out) >= 10:
            break
        body = ServeBody(
            user_id=user_id,
            page_category=f"{cats[i % len(cats)]}-{i}-{time.time_ns()}",
            device_type="mobile",
        )
        ad = await serve_ad(body)
        if isinstance(ad, dict) and ad.get("id") and "error" not in ad and ad["id"] not in seen_ids:
            seen_ids.add(ad["id"])
            out.append(ad)
    return out


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/metrics/latency")
async def metrics_latency():
    if not rds:
        return {"p50_ms": 0, "p95_ms": 0, "recent": []}
    vals = await rds.lrange("serve_latency_ms", 0, 99)
    nums = sorted(int(x) for x in vals if x.isdigit())
    if not nums:
        return {"p50_ms": 0, "p95_ms": 0, "recent": []}
    p50 = nums[len(nums) // 2]
    p95 = nums[int(len(nums) * 0.95) - 1] if len(nums) > 1 else nums[-1]
    return {"p50_ms": p50, "p95_ms": p95, "recent": nums[:20]}


@app.get("/admin/kpis")
async def admin_kpis():
    if not pool:
        raise HTTPException(status_code=503, detail="db down")
    today = date.today()
    start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
              COALESCE(SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END), 0) AS imp,
              COALESCE(SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END), 0) AS clk
            FROM ad_events
            WHERE created_at >= $1
            """,
            start,
        )
        active = await conn.fetchval(
            "SELECT COUNT(*) FROM campaigns WHERE status = 'live'"
        )
        yesterday = start - timedelta(days=1)
        prev = await conn.fetchrow(
            """
            SELECT
              COALESCE(SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END), 0) AS imp,
              COALESCE(SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END), 0) AS clk
            FROM ad_events
            WHERE created_at >= $1 AND created_at < $2
            """,
            yesterday,
            start,
        )
    imp = int(row["imp"])
    clk = int(row["clk"])
    ctr = (clk / imp) if imp else 0.0
    p_imp = int(prev["imp"]) if prev else 0
    p_clk = int(prev["clk"]) if prev else 0
    def pct_delta(cur, prev_v):
        if not prev_v:
            return 0.0
        return round((cur - prev_v) / prev_v * 100, 1)

    lat = await metrics_latency()
    return {
        "impressions_today": imp,
        "clicks_today": clk,
        "ctr_today": round(ctr, 4),
        "active_campaigns": int(active or 0),
        "delta_impressions_pct": pct_delta(imp, p_imp),
        "delta_clicks_pct": pct_delta(clk, p_clk),
        "serve_p50_ms": lat["p50_ms"],
        "serve_p95_ms": lat["p95_ms"],
    }


@app.get("/admin/live-events")
async def admin_live_events():
    if not rds:
        return []
    items = await rds.lrange("live_events", 0, 19)
    return [json.loads(x) for x in items]


@app.get("/admin/mab-history/{campaign_id}")
async def admin_mab_history(campaign_id: str):
    if not rds:
        return []
    items = await rds.lrange(f"mab_history:{campaign_id}", -200, -1)
    return [json.loads(x) for x in items]


@app.get("/admin/campaign-performance")
async def admin_campaign_performance():
    if not pool:
        raise HTTPException(status_code=503, detail="db down")
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT ca.id, ca.name, ca.status, b.name AS brand_name,
                   COALESCE(SUM(CASE WHEN ae.event_type = 'impression' THEN 1 ELSE 0 END), 0) AS impressions,
                   COALESCE(SUM(CASE WHEN ae.event_type = 'click' THEN 1 ELSE 0 END), 0) AS clicks
            FROM campaigns ca
            JOIN brands b ON b.id = ca.brand_id
            LEFT JOIN ad_events ae ON ae.campaign_id = ca.id
            GROUP BY ca.id, ca.name, ca.status, b.name
            ORDER BY ca.created_at DESC
            LIMIT 50
            """
        )
    out = []
    for r in rows:
        imp = int(r["impressions"])
        clk = int(r["clicks"])
        ctr = (clk / imp) if imp else 0.0
        out.append(
            {
                "campaign_id": str(r["id"]),
                "campaign_name": r["name"],
                "brand_name": r["brand_name"],
                "impressions": imp,
                "clicks": clk,
                "ctr": round(ctr, 4),
                "status": r["status"],
            }
        )
    return out


@app.get("/admin/campaign/{campaign_id}/variants")
async def admin_campaign_variants(campaign_id: str):
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id::text, headline, angle, impressions, clicks, status
            FROM creatives
            WHERE campaign_id = $1::uuid
            ORDER BY created_at
            """,
            campaign_id,
        )
    return [dict(r) for r in rows]


@app.get("/admin/campaigns")
async def admin_campaigns_list():
    if not pool:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, name FROM campaigns WHERE status = 'live' ORDER BY name"
        )
    return [{"id": str(r["id"]), "name": r["name"]} for r in rows]
