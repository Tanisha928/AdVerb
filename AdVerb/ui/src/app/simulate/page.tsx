"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { SimulateVariant } from "../../lib/types";

const SIMULATE_VARIANT_KEY = "adverb_simulate_variant";

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const FALLBACK_BG = svgDataUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 520'><defs><linearGradient id='g' x1='0' x2='1'><stop stop-color='#0f172a'/><stop offset='1' stop-color='#1e3a8a'/></linearGradient></defs><rect width='800' height='520' fill='url(#g)'/></svg>`,
);
const FALLBACK_OVERLAY = svgDataUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'><rect width='300' height='300' rx='24' fill='#f1f5f9'/><rect x='60' y='80' width='180' height='160' rx='18' fill='#94a3b8'/></svg>`,
);

type FeedbackState = "idle" | "clicked" | "skipped";

export default function SimulatePage() {
  const router = useRouter();
  const [variant, setVariant] = useState<SimulateVariant | null>(null);
  const [bgBroken, setBgBroken] = useState(false);
  const [overlayBroken, setOverlayBroken] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const impressionFired = useRef(false);

  useEffect(() => {
    const raw = localStorage.getItem(SIMULATE_VARIANT_KEY);
    if (!raw) return;
    try {
      setVariant(JSON.parse(raw) as SimulateVariant);
    } catch {
      // ignore
    }
  }, []);

  // Record impression once when the ad is shown.
  useEffect(() => {
    if (!variant || impressionFired.current) return;
    impressionFired.current = true;
    void fetch("/api/impression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateSlug: variant.templateSlug,
        overlayKey: variant.overlayKey,
        ageGroup: variant.ageGroup,
        interest: variant.interest,
      }),
    }).catch(() => {});
  }, [variant]);

  async function handleClick() {
    if (!variant || feedback !== "idle") return;
    setFeedback("clicked");
    await fetch("/api/click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        templateSlug: variant.templateSlug,
        overlayKey: variant.overlayKey,
        ageGroup: variant.ageGroup,
        interest: variant.interest,
        locationStr: "",
      }),
    }).catch(() => {});
  }

  function handleSkip() {
    if (feedback !== "idle") return;
    setFeedback("skipped");
  }

  if (!variant) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="panel max-w-sm p-8 text-center">
          <p className="text-slate-300">No variant selected.</p>
          <button
            type="button"
            onClick={() => router.push("/studio")}
            className="mt-4 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Back to Studio
          </button>
        </div>
      </main>
    );
  }

  const primary = variant.colorScheme?.primary ?? "#6d28d9";
  const bgSrc = bgBroken || !variant.backgroundUrl ? FALLBACK_BG : variant.backgroundUrl;
  const overlaySrc = overlayBroken || !variant.overlayUrl ? FALLBACK_OVERLAY : variant.overlayUrl;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4">
      {/* Header */}
      <div className="mb-4 flex w-full max-w-md items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/studio")}
          className="text-sm text-slate-400 hover:text-white transition"
        >
          ← Back to Studio
        </button>
        <span className="font-mono text-xs text-slate-500">
          variant #{variant.variantId}
        </span>
      </div>

      {/* Simulated device frame */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
        {/* Context bar — simulates a social feed */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900 px-4 py-2">
          <div className="h-6 w-6 rounded-full bg-slate-600" />
          <span className="text-xs text-slate-400">Sponsored · {variant.brand}</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-600">Ad</span>
        </div>

        {/* Ad canvas */}
        <div className="relative h-72">
          <img
            src={bgSrc}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setBgBroken(true)}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={overlaySrc}
              alt={`${variant.brand} product`}
              className="h-52 w-52 object-contain drop-shadow-2xl"
              onError={() => setOverlayBroken(true)}
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
            <p className="text-lg font-bold leading-snug text-white drop-shadow">
              {variant.copyText}
            </p>
          </div>
        </div>

        {/* CTA row */}
        <div className="flex items-center justify-between border-t border-white/10 bg-slate-900 px-4 py-3">
          <span className="text-xs text-slate-400">{variant.brand} · {variant.category}</span>
          <button
            type="button"
            onClick={handleClick}
            disabled={feedback !== "idle"}
            className="rounded-lg px-4 py-1.5 text-sm font-bold text-white transition disabled:opacity-60"
            style={{ backgroundColor: primary }}
          >
            {variant.cta}
          </button>
        </div>
      </div>

      {/* Feedback buttons */}
      {feedback === "idle" ? (
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleClick}
            className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-6 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            I'd click this
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
          >
            Not for me
          </button>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-center">
          {feedback === "clicked" ? (
            <p className="text-sm font-semibold text-emerald-300">
              Click recorded for variant #{variant.variantId}
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              Impression recorded. No click for variant #{variant.variantId}
            </p>
          )}
          <button
            type="button"
            onClick={() => router.push("/studio")}
            className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition"
          >
            Return to Studio →
          </button>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-600">
        Audience: {variant.ageGroup} · {variant.interest}
      </p>
    </main>
  );
}
