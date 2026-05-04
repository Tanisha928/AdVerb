import { generateWithFallback } from "./ai";
import { buildCacheKey, getCached, setCached } from "./cache";
import { LatencyTracker } from "./latency";
import { flyUrlForLocation, servedFromLabel } from "./router";
import type { AdRequest, AdResponse, Env } from "./types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const { pathname } = new URL(request.url);
    if (request.method !== "POST" || (pathname !== "/ad" && pathname !== "/click")) {
      return new Response("Not found", { status: 404, headers: CORS_HEADERS });
    }

    if (pathname === "/click") {
      const body = (await request.json()) as any;
      const templateSlug = body.templateSlug || body.template_slug;
      const overlayKey = body.overlayKey || body.overlay_key;
      const ageGroup = body.ageGroup || body.age_group;
      const interest = body.interest;
      const locationStr = body.locationStr || "New York";

      if (!templateSlug || !overlayKey || !ageGroup || !interest) {
        return Response.json({ error: "missing required fields" }, { status: 400, headers: CORS_HEADERS });
      }

      const flyUrl = flyUrlForLocation(locationStr, env);
      const resp = await fetch(`${flyUrl}/click`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          template_slug: templateSlug,
          overlay_key: overlayKey,
          age_group: ageGroup,
          interest,
        }),
      });
      if (!resp.ok) {
        return Response.json({ error: "click tracking failed" }, { status: 502, headers: CORS_HEADERS });
      }
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const tracker = new LatencyTracker();
    const req = (await request.json()) as AdRequest;
    const key = buildCacheKey(req);
    const cached = await getCached(env.CREATIVE_CACHE, key);
    if (cached) {
      cached.cacheStatus = "HIT";
      cached.servedFrom = servedFromLabel(req.locationStr);
      cached.latency.kvCacheHit = true;
      cached.latency.totalMs = Number(tracker.total().toFixed(2));
      return Response.json(cached, { headers: CORS_HEADERS });
    }

    const fetchStart = tracker.now();
    const flyUrl = flyUrlForLocation(req.locationStr, env);
    const goResp = await fetch(`${flyUrl}/recommend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...req, top_k: 1 }),
    });
    const fetchEnd = tracker.now();
    if (!goResp.ok) {
      return Response.json({ error: "recommendation failed" }, { status: 502, headers: CORS_HEADERS });
    }
    const goData = (await goResp.json()) as {
      creative: {
        template_id: number;
        template_slug: string;
        brand: string;
        category: string;
        r2_overlay_key: string;
        r2_logo_url: string;
        r2_background_url: string;
        r2_overlay_url: string;
        copy_prompt: string;
        cta: string;
        color_scheme: { primary: string; secondary: string };
        score: number;
        ucb_ctr: number;
      };
      triton_latency_ms: number;
      total_latency_ms: number;
    };

    const ucbCtr = Number(goData.creative.ucb_ctr ?? 0);
    const minCacheUcbCtr = Number(env.MIN_CACHE_UCB_CTR || "0.005");

    const aiStart = tracker.now();
    const fallbackCopy = `Discover ${goData.creative.brand} - built for athletes like you.`;
    const copyText = await generateWithFallback(env.AI, goData.creative.copy_prompt, fallbackCopy);
    const workersAiMs = tracker.elapsedSince(aiStart);

    const goRoundTrip = fetchEnd - fetchStart;
    const total = tracker.total();
    const response: AdResponse = {
      creative: {
        templateId: goData.creative.template_id,
        templateSlug: goData.creative.template_slug,
        brand: goData.creative.brand,
        category: goData.creative.category,
        logoUrl: goData.creative.r2_logo_url,
        backgroundUrl: goData.creative.r2_background_url,
        overlayUrl: goData.creative.r2_overlay_url,
        copyText,
        cta: goData.creative.cta,
        colorScheme: goData.creative.color_scheme,
        score: goData.creative.score,
        ucbCtr,
      },
      latency: {
        totalMs: Number(total.toFixed(2)),
        networkTransitMs: Number(Math.max(0, goRoundTrip - goData.total_latency_ms).toFixed(2)),
        edgeServingMs: Number(Math.max(0, total - goRoundTrip).toFixed(2)),
        kvCacheHit: false,
        goDecisionMs: goData.total_latency_ms,
        tritonMs: goData.triton_latency_ms,
        workersAiMs: Number(workersAiMs.toFixed(2)),
      },
      servedFrom: servedFromLabel(req.locationStr),
      cacheStatus: "MISS",
    };

    if (ucbCtr >= minCacheUcbCtr) {
      ctx.waitUntil(setCached(env.CREATIVE_CACHE, key, response, Number(env.CACHE_TTL_SECONDS || "300")));
    }
    return Response.json(response, { headers: CORS_HEADERS });
  },
};
