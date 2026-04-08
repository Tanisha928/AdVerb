import json
import random
import time

EPSILON = 0.15


async def get_approved_creatives_redis_or_db(redis, pool, campaign_id: str) -> list[dict]:
    cache_key = f"campaign_creatives:{campaign_id}"
    raw = await redis.get(cache_key)
    if raw:
        return json.loads(raw)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT c.id, c.headline, c.subheadline, c.cta, c.angle, c.layout,
                   c.background_color, c.assembled_image_url, c.campaign_id,
                   p.image_url as product_image_url,
                   b.name as brand_name, b.logo_url as brand_logo_url, b.color_primary
            FROM creatives c
            JOIN products p ON p.id = c.product_id
            JOIN campaigns ca ON ca.id = c.campaign_id
            JOIN brands b ON b.id = ca.brand_id
            WHERE c.campaign_id = $1::uuid AND c.status = 'approved'
            """,
            campaign_id,
        )
    out = [dict(r) for r in rows]
    for o in out:
        o["id"] = str(o["id"])
        o["campaign_id"] = str(o["campaign_id"])
    if out:
        await redis.setex(cache_key, 120, json.dumps(out))
    return out


async def is_fatigued(redis, user_id: str, creative_id: str) -> bool:
    seen = await redis.get(f"seen:{user_id}:{creative_id}")
    return seen is not None and int(seen) >= 3


async def mab_select_variant(redis, campaign_id: str, user_id: str, creatives: list[dict]) -> dict | None:
    if not creatives:
        return None

    unseen = [c for c in creatives if not await is_fatigued(redis, user_id, c["id"])]
    candidates = unseen if unseen else creatives

    if random.random() < EPSILON:
        return random.choice(candidates)

    weights = await redis.hgetall(f"mab:{campaign_id}")
    best = max(candidates, key=lambda c: float(weights.get(c["id"], "0.25")))
    return best


async def update_mab_weights(redis, campaign_id: str, creative_id: str, clicked: bool):
    pipe = redis.pipeline()
    if clicked:
        pipe.hincrby(f"clicks:{campaign_id}", creative_id, 1)
    else:
        pipe.hincrby(f"impressions:{campaign_id}", creative_id, 1)
    await pipe.execute()

    impressions = await redis.hgetall(f"impressions:{campaign_id}")
    clicks = await redis.hgetall(f"clicks:{campaign_id}")

    new_weights: dict[str, str] = {}
    for cid_s, imp_raw in impressions.items():
        imp = max(int(imp_raw or 1), 1)
        clk = int(clicks.get(cid_s, 0) or 0)
        ctr = clk / imp
        new_weights[cid_s] = str(round(ctr + 0.01, 4))

    if new_weights:
        await redis.hset(f"mab:{campaign_id}", mapping=new_weights)
        ts = time.time()
        snapshot = {
            "timestamp": ts,
            "weights": {k: float(v) for k, v in new_weights.items()},
        }
        await redis.rpush(f"mab_history:{campaign_id}", json.dumps(snapshot))
        await redis.ltrim(f"mab_history:{campaign_id}", -500, -1)
