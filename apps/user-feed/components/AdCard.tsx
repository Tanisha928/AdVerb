"use client";

import { useState } from "react";
import type { ServedAd } from "@/lib/ad";
import { trackClick } from "@/lib/ad";

function recordClick(userId: string, ad: ServedAd) {
  try {
    const key = `adverb_clicks_${userId}`;
    const prev = JSON.parse(localStorage.getItem(key) || "[]") as { id: string; at: string; headline?: string }[];
    prev.unshift({ id: ad.id, at: new Date().toISOString(), headline: ad.headline || undefined });
    localStorage.setItem(key, JSON.stringify(prev.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

export function AdCard({
  ad,
  userId,
  category,
}: {
  ad: ServedAd;
  userId: string;
  category: string;
}) {
  const [visited, setVisited] = useState(false);
  const [busy, setBusy] = useState(false);
  const brandColor = ad.color_primary || "#6366f1";
  const img = ad.assembled_image_url || ad.product_image_url;

  async function onCta() {
    if (visited || busy) return;
    setBusy(true);
    try {
      await trackClick(userId, ad.id, ad.campaign_id);
      recordClick(userId, ad);
      setVisited(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="w-[380px] rounded-2xl bg-white shadow-md hover:shadow-xl hover:-translate-y-1 transition duration-200 overflow-hidden border border-slate-100"
      style={{ height: 500 }}
    >
      <div className="relative h-[55%] bg-slate-100">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center text-white text-sm p-6 text-center"
            style={{
              backgroundImage: ad.product_image_url ? `url(${ad.product_image_url})` : undefined,
              backgroundSize: "cover",
              backgroundColor: ad.background_color || "#0f172a",
            }}
          >
            <div className="bg-black/50 p-3 rounded-lg">
              <p className="font-bold text-lg">{ad.headline}</p>
            </div>
          </div>
        )}
        {ad.brand_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.brand_logo_url}
            alt=""
            className="absolute left-3 top-3 h-10 w-10 rounded-full border border-white/80 object-cover bg-white"
          />
        ) : (
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-800">
            {ad.brand_name?.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white capitalize">
          {category}
        </span>
      </div>
      <div className="p-5 flex flex-col h-[45%]">
        <p className="text-lg font-bold leading-snug line-clamp-2">{ad.headline}</p>
        <p className="text-sm text-slate-500 mt-2 line-clamp-3">{ad.subheadline}</p>
        <div className="mt-auto">
          <button
            type="button"
            disabled={visited}
            onClick={() => {
              void onCta();
              const el = document.getElementById(`cta-${ad.id}`);
              el?.classList.add("cta-pulse");
              setTimeout(() => el?.classList.remove("cta-pulse"), 400);
            }}
            id={`cta-${ad.id}`}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-70"
            style={{ backgroundColor: brandColor }}
          >
            {visited ? "✓ Visited" : ad.cta || "Learn more"}
          </button>
        </div>
      </div>
    </div>
  );
}
