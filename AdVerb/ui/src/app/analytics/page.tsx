"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Sidebar } from "../../components/Sidebar";
import { TopBar } from "../../components/TopBar";

type AnalyticsRow = {
  variantId: string | null;
  templateSlug: string;
  brand: string;
  category: string;
  overlayKey: string;
  overlayUrl: string | null;
  backgroundUrl: string | null;
  colorScheme: { primary: string; secondary: string } | null;
  ageGroup: string;
  interest: string;
  impressions: number;
  clicks: number;
  ctr: number;
  ucbScore: number;
};

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function ScoreBar({ value, max = 1 }: { value: number; max?: number }) {
  const w = Math.min(100, (value / max) * 100);
  return (
    <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-violet-400"
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/analytics", { cache: "no-store" });
      if (resp.ok) {
        const data = (await resp.json()) as AnalyticsRow[];
        setRows(data);
        setLastFetched(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const maxUcb = Math.max(...rows.map((r) => r.ucbScore), 0.01);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <TopBar signedIn onSignOut={() => router.push("/")} />
      <div className="flex gap-6">
        <Sidebar />
        <section className="min-w-0 flex-1 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Campaign Analytics</h1>
              <p className="mt-1 text-sm text-slate-400">
                Per-variant CTR and UCB scores from Redis engagement store
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchData()}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="panel p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Variants</p>
              <p className="mt-2 text-3xl font-bold text-white">{rows.length}</p>
            </div>
            <div className="panel p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Impressions</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {rows.reduce((s, r) => s + r.impressions, 0).toLocaleString()}
              </p>
            </div>
            <div className="panel p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Clicks</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {rows.reduce((s, r) => s + r.clicks, 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Variant table */}
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    <th className="px-4 py-3">Variant</th>
                    <th className="px-4 py-3">Template</th>
                    <th className="px-4 py-3">Audience</th>
                    <th className="px-4 py-3 text-right">Impr.</th>
                    <th className="px-4 py-3 text-right">Clicks</th>
                    <th className="px-4 py-3 text-right">CTR</th>
                    <th className="px-4 py-3">UCB Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                        {loading
                          ? "Loading…"
                          : "No data yet. Run an auction in Studio and simulate ads to generate engagement data."}
                      </td>
                    </tr>
                  )}
                  {rows.map((row, i) => (
                    <tr key={`${row.variantId ?? row.overlayKey}-${row.ageGroup}-${i}`} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {row.overlayUrl ? (
                            <img
                              src={row.overlayUrl}
                              alt=""
                              className="h-10 w-10 rounded-lg object-contain bg-slate-800"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-slate-800" />
                          )}
                          <div>
                            <p className="font-mono text-[11px] text-slate-300">
                              #{row.variantId ?? "—"}
                            </p>
                            <p className="text-[10px] text-slate-500">{row.brand}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-200">{row.templateSlug}</p>
                        <p className="text-[10px] text-slate-500">{row.category}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-300">{row.ageGroup}</p>
                        <p className="text-[10px] text-slate-500">{row.interest}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                        {row.impressions.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                        {row.clicks.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-300">
                        {pct(row.ctr)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ScoreBar value={row.ucbScore} max={maxUcb} />
                          <span className="tabular-nums text-xs text-violet-300">
                            {row.ucbScore.toFixed(3)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {lastFetched && (
            <p className="text-right text-xs text-slate-600">
              Last updated: {lastFetched.toLocaleTimeString()}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
