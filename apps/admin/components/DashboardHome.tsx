"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getJson } from "@/lib/api";

type Kpis = {
  impressions_today: number;
  clicks_today: number;
  ctr_today: number;
  active_campaigns: number;
  delta_impressions_pct: number;
  delta_clicks_pct: number;
  serve_p50_ms: number;
  serve_p95_ms: number;
};

type LiveEv = {
  event_type: string;
  user_name: string;
  creative_headline: string;
  campaign_name: string;
  timestamp: string;
};

type CampRow = {
  campaign_id: string;
  campaign_name: string;
  brand_name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  status: string;
};

type Snap = { timestamp: number; weights: Record<string, string | number> };

const PALETTE = ["#2dd4bf", "#fbbf24", "#f87171", "#a78bfa", "#34d399", "#fb7185", "#38bdf8", "#facc15"];

function buildChartRows(snaps: Snap[], topIds: string[]) {
  return snaps.map((s) => {
    const row: Record<string, string | number> = {
      t: s.timestamp * 1000,
    };
    for (const id of topIds) {
      row[id] = Number(s.weights[id] ?? 0);
    }
    return row;
  });
}

export function DashboardHome() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [events, setEvents] = useState<LiveEv[]>([]);
  const [campaigns, setCampaigns] = useState<CampRow[]>([]);
  const [liveList, setLiveCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [selectedCamp, setSelectedCamp] = useState<string>("");
  const [history, setHistory] = useState<Snap[]>([]);
  const [sortCtr, setSortCtr] = useState<"desc" | "asc">("desc");

  const loadKpis = useCallback(async () => {
    try {
      const k = await getJson<Kpis>("/admin/kpis");
      setKpis(k);
    } catch {
      /* ignore */
    }
  }, []);

  const loadTable = useCallback(async () => {
    try {
      const t = await getJson<CampRow[]>("/admin/campaign-performance");
      setCampaigns(t);
    } catch {
      /* ignore */
    }
  }, []);

  const loadLive = useCallback(async () => {
    try {
      const e = await getJson<LiveEv[]>("/admin/live-events");
      setEvents(e);
    } catch {
      /* ignore */
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!selectedCamp) return;
    try {
      const h = await getJson<Snap[]>(`/admin/mab-history/${selectedCamp}`);
      setHistory(h);
    } catch {
      setHistory([]);
    }
  }, [selectedCamp]);

  useEffect(() => {
    void loadKpis();
    const i = setInterval(loadKpis, 5000);
    return () => clearInterval(i);
  }, [loadKpis]);

  useEffect(() => {
    void loadTable();
    const i = setInterval(loadTable, 15000);
    return () => clearInterval(i);
  }, [loadTable]);

  useEffect(() => {
    void loadLive();
    const i = setInterval(loadLive, 3000);
    return () => clearInterval(i);
  }, [loadLive]);

  useEffect(() => {
    (async () => {
      try {
        const c = await getJson<{ id: string; name: string }[]>("/admin/campaigns");
        setLiveCampaigns(c);
        setSelectedCamp((prev) => prev || c[0]?.id || "");
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    void loadHistory();
    const i = setInterval(loadHistory, 5000);
    return () => clearInterval(i);
  }, [loadHistory]);

  const { topIds, rows } = useMemo(() => {
    if (!history.length) return { topIds: [] as string[], rows: [] as Record<string, string | number>[] };
    const scores: Record<string, number> = {};
    for (const s of history) {
      for (const [k, v] of Object.entries(s.weights || {})) {
        scores[k] = Math.max(scores[k] || 0, Number(v));
      }
    }
    const topIds = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k]) => k);
    const rows = buildChartRows(history, topIds);
    return { topIds, rows };
  }, [history]);

  const sortedCampaigns = useMemo(() => {
    const arr = [...campaigns];
    arr.sort((a, b) => (sortCtr === "desc" ? b.ctr - a.ctr : a.ctr - b.ctr));
    return arr;
  }, [campaigns, sortCtr]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
          <p className="text-sm text-zinc-500 mt-1">Live metrics · MAB learning · Event stream</p>
        </div>
        <div className="text-xs text-zinc-500 font-mono">
          Serve p50: {kpis?.serve_p50_ms ?? "—"}ms · p95: {kpis?.serve_p95_ms ?? "—"}ms
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Impressions (today)", kpis?.impressions_today, "#2dd4bf", kpis?.delta_impressions_pct],
          ["Clicks (today)", kpis?.clicks_today, "#fbbf24", kpis?.delta_clicks_pct],
          ["CTR (today)", kpis ? `${(kpis.ctr_today * 100).toFixed(2)}%` : "—", "#f87171", null],
          ["Active campaigns", kpis?.active_campaigns, "#a78bfa", null],
        ].map(([label, val, color, delta]) => (
          <div key={String(label)} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-3 font-mono text-3xl font-medium" style={{ color: color as string }}>
              {typeof val === "number" ? val.toLocaleString() : val ?? "—"}
            </p>
            {delta != null && (
              <p className="text-[11px] text-zinc-500 mt-2 font-mono">vs yesterday: {delta as number}%</p>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold">MAB convergence</h2>
            <p className="text-xs text-zinc-500">Variant weights over recent updates (Redis history)</p>
          </div>
          <select
            value={selectedCamp}
            onChange={(e) => setSelectedCamp(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
          >
            {liveList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="h-80 w-full">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">Generate traffic in the user feed to populate learning curves.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  type="number"
                  dataKey="t"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  stroke="#71717a"
                  fontSize={11}
                />
                <YAxis domain={[0, 1]} stroke="#71717a" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #27272a", fontSize: 12 }}
                  labelFormatter={(v) => new Date(v as number).toLocaleString()}
                />
                <Legend />
                {topIds.map((id, idx) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={`Variant ${idx + 1}`}
                    stroke={PALETTE[idx % PALETTE.length]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-lg font-semibold mb-4">Live events</h2>
          <ul className="space-y-2 max-h-96 overflow-auto pr-1">
            {events.map((e, i) => (
              <li
                key={`${e.timestamp}-${i}`}
                className={`animate-slide-in flex gap-3 rounded-lg bg-zinc-950/80 px-3 py-2 text-sm border-l-4 ${
                  e.event_type === "click" ? "border-emerald-500" : "border-zinc-600"
                }`}
              >
                <span className="text-lg">{e.event_type === "click" ? "◎" : "○"}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{e.creative_headline || "Creative"}</p>
                  <p className="text-xs text-zinc-500">
                    {e.user_name} · {e.campaign_name}
                  </p>
                </div>
                <span className="text-[10px] text-zinc-500 whitespace-nowrap font-mono">
                  {e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : ""}
                </span>
              </li>
            ))}
            {events.length === 0 && <li className="text-sm text-zinc-500">Waiting for events…</li>}
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Campaign performance</h2>
            <button
              type="button"
              onClick={() => setSortCtr((s) => (s === "desc" ? "asc" : "desc"))}
              className="text-xs text-zinc-400 hover:text-white font-mono"
            >
              Sort CTR {sortCtr === "desc" ? "↓" : "↑"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
                  <th className="pb-2">Campaign</th>
                  <th className="pb-2">Brand</th>
                  <th className="pb-2">Impr.</th>
                  <th className="pb-2">Clicks</th>
                  <th className="pb-2">CTR</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedCampaigns.map((c) => (
                  <tr key={c.campaign_id} className="border-b border-zinc-800/80">
                    <td className="py-2 pr-2">
                      <Link href={`/campaigns/${c.campaign_id}`} className="text-teal-400 hover:underline">
                        {c.campaign_name}
                      </Link>
                    </td>
                    <td className="py-2 text-zinc-400">{c.brand_name}</td>
                    <td className="py-2 font-mono text-xs">{c.impressions}</td>
                    <td className="py-2 font-mono text-xs">{c.clicks}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${Math.min(100, c.ctr * 400)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs">{(c.ctr * 100).toFixed(2)}%</span>
                      </div>
                    </td>
                    <td className="py-2 text-xs capitalize text-zinc-400">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
