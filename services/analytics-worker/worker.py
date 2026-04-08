import asyncio
import json
import os
import traceback

import asyncpg
import redis.asyncio as redis

from mab_redis import update_mab_weights

DATABASE_URL = os.environ["DATABASE_URL"]
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")


def _decode_field(data: dict, key: str) -> str:
    v = data.get(key) or data.get(key.encode() if isinstance(key, str) else key)
    if v is None:
        return ""
    if isinstance(v, bytes):
        return v.decode()
    return str(v)


async def push_live_event(pool: asyncpg.Pool, redis_client: redis.Redis, fields: dict):
    try:
        user_id = fields.get("user_id")
        creative_id = fields.get("creative_id")
        campaign_id = fields.get("campaign_id")
        async with pool.acquire() as conn:
            u = await conn.fetchrow("SELECT name FROM users WHERE id = $1::uuid", user_id)
            c = await conn.fetchrow(
                "SELECT headline FROM creatives WHERE id = $1::uuid", creative_id
            )
            ca = await conn.fetchrow(
                "SELECT name FROM campaigns WHERE id = $1::uuid", campaign_id
            )
        payload = {
            "event_type": fields.get("event_type"),
            "user_name": u["name"] if u else user_id,
            "creative_headline": c["headline"] if c else "",
            "campaign_name": ca["name"] if ca else "",
            "timestamp": fields.get("timestamp"),
        }
        await redis_client.lpush("live_events", json.dumps(payload))
        await redis_client.ltrim("live_events", 0, 19)
    except Exception:
        traceback.print_exc()


async def process_event(data: dict, redis_client: redis.Redis, pg: asyncpg.Pool):
    event_type = _decode_field(data, "event_type")
    creative_id = _decode_field(data, "creative_id")
    campaign_id = _decode_field(data, "campaign_id")
    user_id = _decode_field(data, "user_id")
    device_type = _decode_field(data, "device_type")
    page_category = _decode_field(data, "page_category")

    async with pg.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO ad_events (user_id, creative_id, campaign_id, event_type, device_type, page_category)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)
            """,
            user_id,
            creative_id,
            campaign_id,
            event_type,
            device_type,
            page_category,
        )

    clicked = event_type == "click"
    await update_mab_weights(redis_client, campaign_id, creative_id, clicked)

    if event_type == "impression":
        k = f"seen:{user_id}:{creative_id}"
        await redis_client.incr(k)
        await redis_client.expire(k, 86400)

    await redis_client.hincrby(f"stats:{campaign_id}", event_type, 1)
    await redis_client.hincrby("global_stats", event_type, 1)

    await push_live_event(
        pg,
        redis_client,
        {
            "user_id": user_id,
            "creative_id": creative_id,
            "campaign_id": campaign_id,
            "event_type": event_type,
            "timestamp": _decode_field(data, "timestamp"),
        },
    )


async def consume_loop():
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    pg = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)

    while True:
        try:
            last_id = await redis_client.get("worker:last_stream_id") or "0-0"
            resp = await redis_client.xread({"ad_events": last_id}, count=100, block=5000)
            if not resp:
                await asyncio.sleep(0.05)
                continue
            for _stream, messages in resp:
                for msg_id, data in messages:
                    try:
                        await process_event(data, redis_client, pg)
                    except Exception:
                        traceback.print_exc()
                    await redis_client.set("worker:last_stream_id", msg_id)
        except Exception:
            traceback.print_exc()
            await asyncio.sleep(1)


def main():
    asyncio.run(consume_loop())


if __name__ == "__main__":
    main()
