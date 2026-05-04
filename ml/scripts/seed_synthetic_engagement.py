import argparse
import json
import os
from dataclasses import dataclass

import numpy as np
import redis


def sanitize(s: str) -> str:
    s = (s or "").strip().replace(":", "_")
    return s if s else "unknown"


@dataclass(frozen=True)
class SegmentKey:
    template_slug: str
    overlay_key: str
    age_group: str
    interest: str

    def redis_key(self) -> str:
        return ":".join(
            [
                "eng",
                "v1",
                sanitize(self.template_slug),
                sanitize(self.overlay_key),
                sanitize(self.age_group),
                sanitize(self.interest),
            ]
        )


def beta_params(mean: float, concentration: float) -> tuple[float, float]:
    mean = float(np.clip(mean, 1e-6, 1 - 1e-6))
    a = mean * concentration
    b = (1.0 - mean) * concentration
    return a, b


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Redis with synthetic impression/click counters.")
    parser.add_argument("--catalog", default="../templates/catalog.json", help="Path to templates catalog JSON.")
    parser.add_argument("--redis-url", default=os.environ.get("REDIS_URL") or os.environ.get("UPSTASH_REDIS_URL"), help="Redis URL.")
    parser.add_argument("--seed", type=int, default=7, help="RNG seed.")
    parser.add_argument("--min-impressions", type=int, default=250, help="Min impressions per segment/variant.")
    parser.add_argument("--max-impressions", type=int, default=2500, help="Max impressions per segment/variant.")
    parser.add_argument("--good-ctr", type=float, default=0.02, help="Mean CTR when template is compatible with interest.")
    parser.add_argument("--bad-ctr", type=float, default=0.002, help="Mean CTR when template is incompatible with interest.")
    parser.add_argument("--concentration", type=float, default=600.0, help="Beta concentration (higher = less variance).")
    args = parser.parse_args()

    if not args.redis_url:
        raise SystemExit("Missing --redis-url (or set REDIS_URL / UPSTASH_REDIS_URL).")

    with open(args.catalog, "r", encoding="utf-8") as f:
        templates = json.load(f)

    age_groups = ["18-24", "25-34", "35-44", "45-54", "55+"]
    interest_indices = list(range(12))

    rng = np.random.default_rng(args.seed)
    r = redis.Redis.from_url(args.redis_url)

    pipe = r.pipeline(transaction=False)
    writes = 0

    for t in templates:
        template_slug = t["slug"]
        overlay_key = t["r2_overlay_key"]
        compatible = set(t.get("compatible_interests") or [])

        for age_group in age_groups:
            for idx in interest_indices:
                interest = f"interest-{idx}"
                base = args.good_ctr if idx in compatible else args.bad_ctr
                a, b = beta_params(base, args.concentration)
                ctr = float(rng.beta(a, b))
                impressions = int(rng.integers(args.min_impressions, args.max_impressions + 1))
                clicks = int(rng.binomial(impressions, ctr))

                key = SegmentKey(
                    template_slug=template_slug,
                    overlay_key=overlay_key,
                    age_group=age_group,
                    interest=interest,
                ).redis_key()

                pipe.hincrby(key, "impressions", impressions)
                pipe.hincrby(key, "clicks", clicks)
                writes += 2

                if writes >= 10_000:
                    pipe.execute()
                    pipe = r.pipeline(transaction=False)
                    writes = 0

    if writes:
        pipe.execute()

    print("done")


if __name__ == "__main__":
    main()

