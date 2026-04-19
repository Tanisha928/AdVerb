"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AngleBadge } from "@/components/AngleBadge";
import { CreativePreview } from "@/components/CreativePreview";
import { Shell } from "@/components/Shell";
import { apiGet, apiPatch } from "@/lib/api";
import type { Creative, Product } from "@/lib/types";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        apiGet<Product[]>(`/campaigns/${id}/products`),
        apiGet<Creative[]>(`/campaigns/${id}/creatives`),
      ]);
      setProducts(p);
      setCreatives(c);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const byProduct = useMemo(() => {
    const m: Record<string, Creative[]> = {};
    for (const c of creatives) {
      m[c.product_id] = m[c.product_id] || [];
      m[c.product_id].push(c);
    }
    return m;
  }, [creatives]);

  const reviewed = creatives.filter((c) => c.status !== "pending").length;
  const total = creatives.length;

  async function review(cid: string, status: "approved" | "rejected", rejection_note?: string) {
    try {
      await apiPatch(`/creatives/${cid}/review`, { status, rejection_note });
      toast.success(status === "approved" ? "Approved" : "Rejected");
      setRejectId(null);
      setNote("");
      await load();
    } catch (e) {
      toast.error(String(e));
    }
  }

  const canLaunch = useMemo(() => {
    if (!products.length) return false;
    return products.every((p) => {
      const list = byProduct[p.id] || [];
      return list.filter((c) => c.status === "approved").length >= 2;
    });
  }, [products, byProduct]);

  async function launch() {
    if (!canLaunch) return;
    try {
      await apiPatch(`/campaigns/${id}/status`, { status: "live" });
      toast.success("Campaign live");
      router.push(`/campaigns/${id}`);
    } catch {
      toast.error("Could not launch");
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="p-10 space-y-4 max-w-6xl mx-auto animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="p-10 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <Link href={`/campaigns/${id}`} className="text-sm text-indigo-600 hover:underline">
              ← Back to campaign
            </Link>
            <h1 className="font-display text-3xl font-bold mt-2">Creative review</h1>
            <p className="text-slate-500 text-sm mt-1">
              {reviewed} of {total} reviewed
            </p>
          </div>
          <button
            disabled={!canLaunch}
            onClick={launch}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Launch campaign
          </button>
        </div>

        {products.map((p) => (
          <div key={p.id} className="mb-12">
            <h2 className="font-display text-lg font-semibold mb-4">{p.name}</h2>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {(byProduct[p.id] || []).map((c) => (
                <div
                  key={c.id}
                  className="relative rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 hover:shadow-md transition duration-200"
                >
                  {c.status === "approved" && (
                    <div className="absolute right-3 top-3 z-20 rounded-full bg-emerald-500 text-white text-xs font-bold px-2 py-1">
                      ✓
                    </div>
                  )}
                  <CreativePreview
                    imageUrl={p.image_url}
                    assembledUrl={c.assembled_image_url}
                    headline={c.headline}
                    subheadline={c.subheadline}
                    cta={c.cta}
                    backgroundColor={c.background_color}
                    layout={c.layout}
                  />
                  {c.assembled_image_url ? (
                    <a
                      href={c.assembled_image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      Open full image
                    </a>
                  ) : null}
                  <div className="mt-3 flex items-center gap-2">
                    <AngleBadge angle={c.angle} />
                    <span className="text-[10px] uppercase text-slate-400">{c.layout}</span>
                  </div>
                  <p className="font-semibold mt-2 line-clamp-2">{c.headline}</p>
                  <p className="text-xs text-slate-500 line-clamp-2">{c.subheadline}</p>
                  {c.status === "pending" ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => review(c.id, "approved")}
                        className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        ✓ Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectId(rejectId === c.id ? null : c.id)}
                        className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white hover:bg-red-500"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                      {c.status === "approved" ? "Approved" : "Rejected"}
                    </div>
                  )}
                  {c.status === "pending" && rejectId === c.id && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full rounded border border-slate-200 text-xs p-2"
                        placeholder="Rejection note"
                      />
                      <button
                        type="button"
                        onClick={() => review(c.id, "rejected", note)}
                        className="w-full rounded bg-slate-900 py-1.5 text-xs text-white"
                      >
                        Submit rejection
                      </button>
                    </div>
                  )}
                  {c.status === "rejected" && c.rejection_note ? (
                    <p className="mt-2 text-xs text-red-600">Reason: {c.rejection_note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
