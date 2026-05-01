import OpenAI from "openai";

const NEBIUS_BASE = "https://api.studio.nebius.ai/v1/";
const MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct";
const MAX_TOKENS = 30;
const TIMEOUT_MS = 600;

// Seasonal events keyed by month (1-based). Overlapping months take the first match.
const SEASONAL_EVENTS: Array<{ months: number[]; days?: [number, number]; label: string }> = [
  { months: [2], days: [1, 14],  label: "Super Bowl season"         },
  { months: [3, 4], days: [15, 7], label: "March Madness"           },
  { months: [6],                   label: "NBA Finals"               },
  { months: [11], days: [20, 30],  label: "Black Friday deals"       },
  { months: [12],                  label: "holiday gift season"      },
  { months: [1],                   label: "New Year fitness rush"    },
  { months: [9],                   label: "back-to-school season"    },
  { months: [7, 8],                label: "summer fitness season"    },
  // Hyrox major race months (Oct–May covers most events)
  { months: [10, 11, 12, 1, 2, 3, 4, 5], label: "Hyrox racing season" },
];

function seasonalContext(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  for (const ev of SEASONAL_EVENTS) {
    if (!ev.months.includes(m)) continue;
    if (ev.days) {
      const [start, end] = ev.days;
      if (m === ev.months[0] && (d < start || d > end)) continue;
    }
    return ev.label;
  }
  return "";
}

// eventWeek changes weekly so cache rotates as seasons shift.
function eventWeek(date: Date): string {
  const week = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));
  return `${seasonalContext(date)}_w${week}`;
}

type CopyKey = string;
const cache = new Map<CopyKey, string>();

function cacheKey(category: string, ageGroup: string, interest: string, date: Date, variantId?: string): CopyKey {
  const base = variantId ?? category;
  return `${base}|${ageGroup}|${interest}|${eventWeek(date)}`;
}

function fallback(brand: string, category: string): string {
  const map: Record<string, string> = {
    shoes:     "Built for the road ahead.",
    nutrition: "Fuel the grind.",
    wearable:  "Track every heartbeat.",
    yoga:      "Find your flow.",
    cycling:   "Own the road.",
    apparel:   "Train harder. Look sharper.",
  };
  return map[category] ?? `Discover ${brand}.`;
}

function buildPrompt(brand: string, category: string, ageGroup: string, interest: string, location: string, event: string): string {
  const contextLine = event ? ` The timing context is: ${event}.` : "";
  return (
    `Write a single punchy ad tagline (max 10 words) for ${brand} ${category} targeting a ${ageGroup} ${interest} enthusiast in ${location}.${contextLine} ` +
    `Be energetic and specific. Return only the tagline, no punctuation at the end, no quotes.`
  );
}

let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = new OpenAI({ baseURL: NEBIUS_BASE, apiKey });
  }
  return client;
}

async function generateViaApi(prompt: string): Promise<string> {
  const c = getClient();
  if (!c) throw new Error("NEBIUS_API_KEY not set");
  const resp = await c.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: MAX_TOKENS,
    temperature: 0.8,
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * Returns a personalized ad tagline.
 * Cache hit  → instant (0 ms).
 * Cache miss → calls Nebius; if it exceeds TIMEOUT_MS returns fallback
 *              and populates cache in the background.
 */
export async function getAdCopy(opts: {
  brand: string;
  category: string;
  ageGroup: string;
  primaryInterest: string;
  location: string;
  variantId?: string;
}): Promise<{ copy: string; fromCache: boolean; generatedMs: number }> {
  const { brand, category, ageGroup, primaryInterest, location, variantId } = opts;
  const now = new Date();
  const key = cacheKey(category, ageGroup, primaryInterest, now, variantId);

  if (cache.has(key)) {
    return { copy: cache.get(key)!, fromCache: true, generatedMs: 0 };
  }

  const event = seasonalContext(now);
  const prompt = buildPrompt(brand, category, ageGroup, primaryInterest, location, event);
  const t0 = Date.now();

  try {
    const text = await Promise.race([
      generateViaApi(prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
    ]);
    const generatedMs = Date.now() - t0;
    const copy = text || fallback(brand, category);
    cache.set(key, copy);
    return { copy, fromCache: false, generatedMs };
  } catch {
    // Populate cache in background so next request is instant.
    generateViaApi(prompt)
      .then((t) => t && cache.set(key, t))
      .catch(() => {});
    return { copy: fallback(brand, category), fromCache: false, generatedMs: Date.now() - t0 };
  }
}

/**
 * Pre-warms the cache for every (category × ageGroup × interest) combination.
 * Call once at server startup. Runs in the background — does not block boot.
 * Concurrency-limited to avoid hammering the API.
 */
export async function warmCopyCache(
  combinations: Array<{ brand: string; category: string; ageGroup: string; primaryInterest: string; location: string }>,
  concurrency = 10,
): Promise<void> {
  const queue = [...combinations];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.pop()!;
      await getAdCopy(item).catch(() => {});
    }
  });
  await Promise.all(workers);
}
