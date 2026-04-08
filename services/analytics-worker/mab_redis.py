import json
import time


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
