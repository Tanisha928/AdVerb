import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { StatusBadge } from "@/components/StatusBadge";
import { apiGet } from "@/lib/api";
import type { Brand, Campaign } from "@/lib/types";

type Stats = {
  total_impressions: number;
  total_clicks: number;
  avg_ctr: number;
  active_campaigns: number;
};

export default async function BrandDashboard({ params }: { params: { id: string } }) {
  let brand: Brand;
  let campaigns: Campaign[] = [];
  let stats: Stats | null = null;
  try {
    brand = await apiGet<Brand>(`/brands/${params.id}`);
    campaigns = await apiGet<Campaign[]>(`/brands/${params.id}/campaigns`);
    stats = await apiGet<Stats>(`/brands/${params.id}/stats`);
  } catch {
    notFound();
  }

  return (
    <Shell accent={brand.color_primary}>
      <div className="p-10 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-6 mb-10">
          <div className="flex gap-4">
            <div
              className="h-16 w-16 rounded-2xl overflow-hidden ring-2 ring-white shadow"
              style={{ backgroundColor: `${brand.color_primary}33` }}
            >
              {brand.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center font-display font-bold text-slate-600">
                  {brand.name[0]}
                </div>
              )}
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold">{brand.name}</h1>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium capitalize">
                  {brand.tone}
                </span>
                <span
                  className="h-6 w-6 rounded-full border border-slate-200"
                  style={{ backgroundColor: brand.color_primary }}
                />
              </div>
            </div>
          </div>
          <Link
            href={`/brands/${brand.id}/campaigns/new`}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500"
          >
            Create campaign
          </Link>
        </div>

        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
            {[
              ["Total impressions", stats.total_impressions.toLocaleString()],
              ["Total clicks", stats.total_clicks.toLocaleString()],
              ["Avg CTR", `${(stats.avg_ctr * 100).toFixed(2)}%`],
              ["Active campaigns", String(stats.active_campaigns)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <p className="text-xs uppercase tracking-wide text-slate-500">{k}</p>
                <p className="mt-2 font-display text-2xl font-bold text-slate-900">{v}</p>
              </div>
            ))}
          </div>
        )}

        <h2 className="font-display text-xl font-semibold mb-4">Campaigns</h2>
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="flex items-center justify-between rounded-xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-100 hover:ring-indigo-200 transition"
            >
              <div>
                <p className="font-semibold text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-500 capitalize">{c.objective}</p>
              </div>
              <StatusBadge status={c.status} />
            </Link>
          ))}
          {campaigns.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
              No campaigns yet.
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
