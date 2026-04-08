"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { StatusBadge } from "@/components/StatusBadge";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Campaign, Creative, Product } from "@/lib/types";

const steps = ["draft", "generating", "review", "live"];

export function CampaignManage({
  initialCampaign,
  initialProducts,
  initialCreatives,
}: {
  initialCampaign: Campaign;
  initialProducts: Product[];
  initialCreatives: Creative[];
}) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [products, setProducts] = useState(initialProducts);
  const [creatives, setCreatives] = useState(initialCreatives);
  const [busy, setBusy] = useState(false);

  const stepIndex = Math.max(0, steps.indexOf(campaign.status));

  const approvedByProduct = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of creatives) {
      if (c.status === "approved") m[c.product_id] = (m[c.product_id] || 0) + 1;
    }
    return m;
  }, [creatives]);

  const canLaunch = useMemo(() => {
    if (!products.length) return false;
    return products.every((p) => (approvedByProduct[p.id] || 0) >= 2);
  }, [products, approvedByProduct]);

  async function refresh() {
    const [c, p, cr] = await Promise.all([
      apiGet<Campaign>(`/campaigns/${campaign.id}`),
      apiGet<Product[]>(`/campaigns/${campaign.id}/products`),
      apiGet<Creative[]>(`/campaigns/${campaign.id}/creatives`),
    ]);
    setCampaign(c);
    setProducts(p);
    setCreatives(cr);
  }

  async function generate() {
    setBusy(true);
    try {
      await apiPost(`/campaigns/${campaign.id}/generate-creatives`);
      toast.success("Creatives generated");
      await refresh();
      router.push(`/campaigns/${campaign.id}/review`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function launch() {
    if (!canLaunch) return;
    setBusy(true);
    try {
      await apiPatch(`/campaigns/${campaign.id}/status`, { status: "live" });
      toast.success("Campaign is live");
      await refresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  const showGenerate =
    products.length > 0 && (campaign.status === "draft" || campaign.status === "review" || campaign.status === "generating");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-bold">{campaign.name}</h1>
            <StatusBadge status={campaign.status} />
          </div>
          <div className="mt-4 flex gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2 text-xs">
                <span
                  className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold ${
                    i <= stepIndex ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="capitalize text-slate-600 hidden sm:inline">{s}</span>
                {i < steps.length - 1 && <span className="text-slate-300">—</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {showGenerate && (
            <button
              disabled={busy || campaign.status === "generating"}
              onClick={generate}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {campaign.status === "generating" ? "Generating…" : "Generate creatives"}
            </button>
          )}
          <Link
            href={`/campaigns/${campaign.id}/review`}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          >
            Review
          </Link>
          <button
            disabled={!canLaunch || busy}
            onClick={launch}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Launch campaign
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">Products</h2>
        <Link
          href={`/campaigns/${campaign.id}/products/new`}
          className="text-sm font-semibold text-indigo-600 hover:underline"
        >
          Add product
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <div key={p.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="h-36 rounded-xl bg-slate-100 overflow-hidden mb-3">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <p className="font-semibold">{p.name}</p>
            <p className="text-xs text-slate-500 line-clamp-2 mt-1">{p.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(p.key_benefits || []).map((b) => (
                <span key={b} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">
                  {b}
                </span>
              ))}
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
            Add products to enable creative generation.
          </div>
        )}
      </div>
    </div>
  );
}
