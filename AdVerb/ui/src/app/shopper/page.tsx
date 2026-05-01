"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { TopBar } from "../../components/TopBar";

type ShopperItem = {
  campaignId: string;
  campaignName: string;
  category: string;
  subcategory: string;
  brandName: string;
  creative: {
    id: string;
    variantKey: string;
    previewImageUrl: string;
    impressions: number;
    clicks: number;
  };
};

export default function ShopperPage() {
  const router = useRouter();
  const [items, setItems] = useState<ShopperItem[]>([]);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [best, setBest] = useState<{
    creativeId: string;
    variantKey: string;
    impressions: number;
    clicks: number;
    ctr: number;
    campaignId: string;
    campaignName: string;
    brandName: string;
  } | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (subcategory) params.set("subcategory", subcategory);
    const res = await fetch(`/api/workflow/shopper/creatives?${params.toString()}`);
    const data = await res.json();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, subcategory]);

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category))), [items]);
  const subcategories = useMemo(() => Array.from(new Set(items.map((i) => i.subcategory))), [items]);

  async function interact(creativeId: string, action: "impression" | "click") {
    await fetch("/api/workflow/shopper/interaction", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ creativeId, action }),
    });
    load();
  }

  async function recommendBest() {
    const res = await fetch("/api/workflow/shopper/recommend-best", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const data = await res.json();
    setBest(data.best ?? null);
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <TopBar signedIn onSignOut={() => router.push("/")} />
        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">Shopper Browse</h2>
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={recommendBest}>
              Recommend best creative
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select className="input-control" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select className="input-control" value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
              <option value="">All subcategories</option>
              {subcategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          {best && (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Best current creative:&nbsp;
              <span className="font-semibold">
                {best.variantKey}
              </span>{" "}
              from{" "}
              <span className="font-semibold">
                {best.brandName || "Unknown brand"}
              </span>{" "}
              ({best.campaignName || "Unnamed campaign"}) — highest CTR among running campaigns:{" "}
              {(best.ctr * 100).toFixed(1)}% ({best.impressions} impressions / {best.clicks} clicks).
            </p>
          )}
          {items.length === 0 && <p className="mt-4 text-sm text-slate-600">No running campaign creatives match this filter.</p>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <article key={item.creative.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium">{item.brandName}</p>
                <p className="text-xs text-slate-500">
                  {item.campaignName} - {item.category}/{item.subcategory}
                </p>
                <img src={item.creative.previewImageUrl} alt={item.creative.variantKey} className="mt-2 h-44 w-full rounded object-cover" />
                <p className="mt-2 text-xs text-slate-500">
                  {item.creative.variantKey} • {item.creative.impressions} impressions • {item.creative.clicks} clicks
                </p>
                <div className="mt-2 flex gap-2">
                  <button className="rounded border border-slate-300 px-3 py-1 text-xs" onClick={() => interact(item.creative.id, "impression")}>
                    View impression
                  </button>
                  <button className="rounded border border-slate-300 px-3 py-1 text-xs" onClick={() => interact(item.creative.id, "click")}>
                    Click creative
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
