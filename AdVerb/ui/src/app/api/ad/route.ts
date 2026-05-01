import { createHash } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { getAdCopy } from "../../../lib/copyGen";
import { INTEREST_LABELS } from "../../../lib/interests";
import { recordAdApi } from "../../../lib/prometheus";
import type { AdCreative, AdRequest, AdResponse } from "../../../lib/types";
import { registerVariant } from "../../../lib/variantRegistry";

const DECISION_ENGINE_URL = process.env.DECISION_ENGINE_URL || "http://localhost:8080";

type GoCreativeSpec = {
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

type RecommendResponse = {
  creative: GoCreativeSpec;
  variants: GoCreativeSpec[];
  matching_latency_ms: number;
  total_latency_ms: number;
  profile_embedding?: number[];
};

function variantId(templateSlug: string, overlayKey: string, backgroundKey: string): string {
  return createHash("sha256")
    .update(`${templateSlug}|${overlayKey}|${backgroundKey}`)
    .digest("hex")
    .slice(0, 8);
}

function primaryInterestLabel(interests: number[]): string {
  let best = 0;
  for (let i = 1; i < interests.length; i++) {
    if (interests[i] > interests[best]) best = i;
  }
  return INTEREST_LABELS[best] ?? "fitness";
}

export async function POST(req: NextRequest) {
  const started = performance.now();
  let body: AdRequest;
  try {
    body = (await req.json()) as AdRequest;
  } catch {
    recordAdApi("400", (performance.now() - started) / 1000);
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  try {
    return await handleAdRequest(body, started);
  } catch {
    recordAdApi("500", (performance.now() - started) / 1000);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

async function handleAdRequest(body: AdRequest, started: number) {
  const primaryInterest = primaryInterestLabel(body.interests);

  const recommendPayload = {
    user_id: body.userId,
    age_bucket: body.ageBucket,
    interests: body.interests,
    location_id: body.locationId,
    device: body.device,
    location_str: body.locationStr,
    age_group: body.ageGroup,
    top_k: 3,
  };

  const response = await fetch(`${DECISION_ENGINE_URL}/recommend`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(recommendPayload),
    cache: "no-store",
  });

  if (!response.ok) {
    recordAdApi("502", (performance.now() - started) / 1000);
    return NextResponse.json({ error: "Decision engine request failed" }, { status: 502 });
  }

  const recommend = (await response.json()) as RecommendResponse;
  const goVariants = recommend.variants?.length ? recommend.variants : [recommend.creative];

  // Compute variant IDs and generate copy for each variant in parallel.
  const variantIds = goVariants.map((v) =>
    variantId(v.template_slug, v.r2_overlay_key, extractBackgroundKey(v.r2_background_url)),
  );

  const copyResults = await Promise.all(
    goVariants.map((v, i) =>
      getAdCopy({
        brand: v.brand,
        category: v.category,
        ageGroup: body.ageGroup,
        primaryInterest,
        location: body.locationStr,
        variantId: variantIds[i],
      }),
    ),
  );

  // Assemble final variant objects.
  const variants: AdCreative[] = goVariants.map((v, i) => {
    const vid = variantIds[i];
    const copy = copyResults[i];

    // Register in server-side registry for analytics joins.
    registerVariant({
      variantId: vid,
      templateSlug: v.template_slug,
      brand: v.brand,
      category: v.category,
      overlayKey: v.r2_overlay_key,
      overlayUrl: v.r2_overlay_url,
      backgroundUrl: v.r2_background_url,
      colorScheme: v.color_scheme,
      interest: primaryInterest,
      ageGroup: body.ageGroup,
      registeredAt: Date.now(),
    });

    return {
      variantId: vid,
      templateId: v.template_id,
      templateSlug: v.template_slug,
      brand: v.brand,
      category: v.category,
      overlayKey: v.r2_overlay_key,
      logoUrl: v.r2_logo_url,
      backgroundUrl: v.r2_background_url,
      overlayUrl: v.r2_overlay_url,
      copyText: copy.copy,
      cta: v.cta,
      colorScheme: v.color_scheme,
      score: v.score,
      ucbCtr: v.ucb_ctr,
    };
  });

  const primary = variants[0];
  const totalMs = Math.max(1, Math.round(performance.now() - started));
  const edgeMs = 3;
  const copyMs = Math.max(...copyResults.map((c) => c.generatedMs));
  const networkTransitMs = Math.max(0, totalMs - recommend.total_latency_ms - copyMs - edgeMs);

  const adResponse: AdResponse = {
    creative: primary,
    variants,
    servedFrom: "Local docker stack",
    cacheStatus: "MISS",
    latency: {
      totalMs,
      networkTransitMs,
      edgeServingMs: edgeMs,
      kvCacheHit: false,
      goDecisionMs: recommend.total_latency_ms,
      tritonMs: recommend.matching_latency_ms,
      workersAiMs: copyMs,
      copyFromCache: copyResults[0]?.fromCache ?? false,
      faissCacheHit: false,
      faissSearchMs: 0,
    },
    imageGeneration: {
      mode: body.imageRebuildMode ?? "initial",
      feedbackApplied: Boolean(body.imageFeedback?.trim()),
    },
  };

  recordAdApi("200", (performance.now() - started) / 1000);
  return NextResponse.json(adResponse);
}

function extractBackgroundKey(backgroundUrl: string): string {
  const idx = backgroundUrl.lastIndexOf("/");
  return idx >= 0 ? backgroundUrl.slice(idx + 1) : backgroundUrl;
}
