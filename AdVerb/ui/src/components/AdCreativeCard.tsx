"use client";

import { useEffect, useState } from "react";

import { trackClick } from "../lib/api";
import { INTEREST_LABELS } from "../lib/interests";
import type { AdCreative, AdRequest, AdResponse, SimulateVariant } from "../lib/types";

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function isUsableAsset(url?: string): boolean {
  if (!url) return false;
  if (url.includes("pub-XXXX")) return false;
  return true;
}

const FALLBACK_VISUAL = {
  background: svgDataUri(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 420'><defs><linearGradient id='g' x1='0' x2='1'><stop stop-color='#0f172a'/><stop offset='1' stop-color='#1e3a8a'/></linearGradient></defs><rect width='800' height='420' fill='url(#g)'/></svg>`,
  ),
  logo: svgDataUri(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' rx='20' fill='#1e40af'/><rect x='24' y='22' width='72' height='78' rx='13' fill='#dbeafe'/></svg>`,
  ),
  overlay: svgDataUri(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'><rect width='300' height='300' rx='24' fill='#f1f5f9'/><rect x='60' y='80' width='180' height='160' rx='18' fill='#94a3b8'/></svg>`,
  ),
};

export function AdCreativeCard({
  data,
  lastPayload,
  loading,
  onRefresh,
  onRebuild,
  onSimulate,
}: {
  data: AdResponse;
  lastPayload: AdRequest | null;
  loading: boolean;
  onRefresh: () => void;
  onRebuild: (feedback: string) => void;
  onSimulate?: (variant: SimulateVariant) => void;
}) {
  const creative: AdCreative = data.creative;
  const [feedback, setFeedback] = useState("");
  const [tracking, setTracking] = useState(false);
  const [backgroundBroken, setBackgroundBroken] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const [overlayBroken, setOverlayBroken] = useState(false);

  useEffect(() => {
    setBackgroundBroken(false);
    setLogoBroken(false);
    setOverlayBroken(false);
  }, [creative.backgroundUrl, creative.logoUrl, creative.overlayUrl]);

  const backgroundSrc =
    isUsableAsset(creative.backgroundUrl) && !backgroundBroken
      ? creative.backgroundUrl
      : FALLBACK_VISUAL.background;
  const logoSrc =
    isUsableAsset(creative.logoUrl) && !logoBroken ? creative.logoUrl : FALLBACK_VISUAL.logo;
  const overlaySrc =
    isUsableAsset(creative.overlayUrl) && !overlayBroken
      ? creative.overlayUrl
      : FALLBACK_VISUAL.overlay;

  const primary = creative.colorScheme?.primary ?? "#0f172a";

  const interest = (() => {
    if (!lastPayload?.interests?.length) return "fitness";
    const idx = lastPayload.interests.findIndex((v) => v >= 0.5);
    return idx >= 0 ? (INTEREST_LABELS[idx] ?? "fitness").toLowerCase() : "fitness";
  })();

  const handleSimulate = () => {
    if (!onSimulate || !lastPayload) return;
    const interestIdx = lastPayload.interests.findIndex((v) => v >= 0.5);
    const interestLabel =
      interestIdx >= 0 ? (INTEREST_LABELS[interestIdx] ?? "fitness").toLowerCase() : "fitness";
    onSimulate({
      variantId: creative.variantId,
      templateSlug: creative.templateSlug,
      brand: creative.brand,
      category: creative.category,
      overlayKey: creative.overlayKey ?? "",
      overlayUrl: creative.overlayUrl,
      backgroundUrl: creative.backgroundUrl,
      logoUrl: creative.logoUrl,
      copyText: creative.copyText,
      cta: creative.cta,
      colorScheme: creative.colorScheme,
      ageGroup: lastPayload.ageGroup,
      interest: interestLabel,
    });
  };

  return (
    <section className="panel overflow-hidden">
      {/* Ad creative canvas */}
      <div className="relative h-[380px] overflow-hidden">
        <img
          src={backgroundSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setBackgroundBroken(true)}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={overlaySrc}
            alt={`${creative.brand} product`}
            className="h-64 w-64 object-contain drop-shadow-2xl"
            style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.45))" }}
            onError={() => setOverlayBroken(true)}
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-8">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <img
                  src={logoSrc}
                  alt={`${creative.brand} logo`}
                  className="h-6 w-6 rounded bg-white/90 object-contain p-0.5"
                  onError={() => setLogoBroken(true)}
                />
                <span className="text-xs font-semibold uppercase tracking-widest text-white/70">
                  {creative.brand}
                </span>
              </div>
              <p className="text-xl font-bold leading-tight text-white drop-shadow">
                {creative.copyText}
              </p>
            </div>
            <button
              type="button"
              disabled={tracking}
              onClick={async () => {
                if (!lastPayload || !creative.overlayKey) return;
                setTracking(true);
                try {
                  await trackClick({
                    templateSlug: creative.templateSlug,
                    overlayKey: creative.overlayKey,
                    ageGroup: lastPayload.ageGroup,
                    interest,
                    locationStr: lastPayload.locationStr,
                  });
                } finally {
                  setTracking(false);
                }
              }}
              className="shrink-0 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
              style={{ backgroundColor: primary }}
            >
              {creative.cta}
            </button>
          </div>
        </div>

        {/* Variant ID + cache badges */}
        <div className="absolute left-3 top-3">
          <span className="rounded-md bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white/80 backdrop-blur-sm">
            #{creative.variantId}
          </span>
        </div>
        <div className="absolute right-3 top-3 flex gap-1.5">
          {data.latency.copyFromCache && (
            <span className="rounded-md bg-emerald-600/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
              Copy cached
            </span>
          )}
        </div>
      </div>

      {/* Simulate button */}
      {onSimulate && lastPayload && (
        <div className="border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={handleSimulate}
            className="w-full rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/20"
          >
            Simulate user view
          </button>
        </div>
      )}
    </section>
  );
}
