import { NextResponse } from "next/server";

import { getAllVariantMeta } from "../../../lib/variantRegistry";

const DECISION_ENGINE_URL = process.env.DECISION_ENGINE_URL || "http://localhost:8080";

type GoAnalyticsEntry = {
  template_slug: string;
  overlay_key: string;
  age_group: string;
  interest: string;
  impressions: number;
  clicks: number;
  ctr: number;
  ucb_score: number;
};

export async function GET() {
  let goEntries: GoAnalyticsEntry[] = [];
  try {
    const resp = await fetch(`${DECISION_ENGINE_URL}/analytics`, { cache: "no-store" });
    if (resp.ok) {
      goEntries = (await resp.json()) as GoAnalyticsEntry[];
    }
  } catch {
    // Redis may be empty; continue with variant registry only.
  }

  const variantMetas = getAllVariantMeta();

  // Build a lookup: overlayKey → variantId + overlayUrl from registry.
  const overlayToVariant = new Map(variantMetas.map((m) => [m.overlayKey, m]));

  // Merge Go analytics entries with variant registry for thumbnail URLs and variantIds.
  const enriched = goEntries.map((e) => {
    const meta = overlayToVariant.get(e.overlay_key);
    return {
      variantId: meta?.variantId ?? null,
      templateSlug: e.template_slug,
      brand: meta?.brand ?? e.template_slug,
      category: meta?.category ?? "",
      overlayKey: e.overlay_key,
      overlayUrl: meta?.overlayUrl ?? null,
      backgroundUrl: meta?.backgroundUrl ?? null,
      colorScheme: meta?.colorScheme ?? null,
      ageGroup: e.age_group,
      interest: e.interest,
      impressions: e.impressions,
      clicks: e.clicks,
      ctr: e.ctr,
      ucbScore: e.ucb_score,
    };
  });

  // Also include variants from registry that haven't been simulated yet (zero impressions).
  const seenKeys = new Set(goEntries.map((e) => e.overlay_key));
  for (const meta of variantMetas) {
    if (!seenKeys.has(meta.overlayKey)) {
      enriched.push({
        variantId: meta.variantId,
        templateSlug: meta.templateSlug,
        brand: meta.brand,
        category: meta.category,
        overlayKey: meta.overlayKey,
        overlayUrl: meta.overlayUrl,
        backgroundUrl: meta.backgroundUrl,
        colorScheme: meta.colorScheme,
        ageGroup: meta.ageGroup,
        interest: meta.interest,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        ucbScore: 0,
      });
    }
  }

  // Sort by UCB score descending, then by impressions descending.
  enriched.sort((a, b) => b.ucbScore - a.ucbScore || b.impressions - a.impressions);

  return NextResponse.json(enriched);
}
