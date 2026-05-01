const CREATIVE_CACHE_URL = (process.env.CREATIVE_CACHE_URL ?? "").trim();

export type FaissCachedCreative = {
  logo_url: string;
  background_url: string;
  overlay_url: string;
  template_slug?: string;
  brand?: string;
};

/** Must match CLIP query embedding size from the decision engine. */
export const PROFILE_EMBEDDING_DIM = 512;

function baseUrl(): string {
  return CREATIVE_CACHE_URL.replace(/\/$/, "");
}

/**
 * Find a pre-cached creative for a similar user embedding (FAISS inner product on L2-normalized CLIP vectors).
 */
export async function lookupSimilarCreative(embedding: number[]) {
  if (!CREATIVE_CACHE_URL || embedding.length !== PROFILE_EMBEDDING_DIM) {
    return { hit: false as const, searchMs: 0 };
  }
  const t0 = performance.now();
  try {
    const res = await fetch(`${baseUrl()}/v1/lookup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ embedding }),
      signal: AbortSignal.timeout(120),
      cache: "no-store",
    });
    const elapsed = Number((performance.now() - t0).toFixed(2));
    if (!res.ok) {
      return { hit: false as const, searchMs: elapsed };
    }
    const data = (await res.json()) as {
      hit?: boolean;
      creative?: FaissCachedCreative;
      search_ms?: number;
      similarity?: number;
    };
    const searchMs = typeof data.search_ms === "number" ? data.search_ms : elapsed;
    if (data.hit && data.creative) {
      return {
        hit: true as const,
        creative: data.creative,
        searchMs,
        similarity: data.similarity,
      };
    }
    return { hit: false as const, searchMs };
  } catch {
    return { hit: false as const, searchMs: Number((performance.now() - t0).toFixed(2)) };
  }
}

/**
 * Registers this user's embedding and assembled creative for future similar-user lookups.
 * Fire-and-forget; failures are ignored so the ad response is never blocked.
 */
export function storeCreativeForSimilarUsers(embedding: number[], creative: FaissCachedCreative): void {
  if (!CREATIVE_CACHE_URL || embedding.length !== PROFILE_EMBEDDING_DIM) {
    return;
  }
  void fetch(`${baseUrl()}/v1/store`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      embedding,
      creative: {
        logo_url: creative.logo_url,
        background_url: creative.background_url,
        overlay_url: creative.overlay_url,
        template_slug: creative.template_slug ?? null,
        brand: creative.brand ?? null,
      },
    }),
    cache: "no-store",
  }).catch(() => {});
}
