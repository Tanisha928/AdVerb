import type { AdRequest, AdResponse } from "./types";

function interestsMask(interests: number[]): string {
  return interests.map((v) => (v >= 0.5 ? "1" : "0")).join("");
}

export function buildCacheKey(req: AdRequest): string {
  return `creative:v1:${req.ageBucket}:${interestsMask(req.interests)}:${req.locationId}:${req.device}`;
}

export async function getCached(cache: KVNamespace, key: string): Promise<AdResponse | null> {
  const raw = await cache.get(key);
  return raw ? (JSON.parse(raw) as AdResponse) : null;
}

export async function setCached(cache: KVNamespace, key: string, response: AdResponse, ttlSeconds: number): Promise<void> {
  const clone: AdResponse = {
    ...response,
    latency: {
      ...response.latency,
      totalMs: 0,
    },
  };
  await cache.put(key, JSON.stringify(clone), { expirationTtl: ttlSeconds });
}
