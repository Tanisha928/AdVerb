"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getJson } from "@/lib/api";

type Variant = {
  id: string;
  headline: string | null;
  angle: string | null;
  impressions: number;
  clicks: number;
  status: string;
};

type Snap = { timestamp: number; weights: Record<string, string | number> };

export default function CampaignDeepDive() {
  const { id } = useParams<{ id: string }>();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [history, setHistory] = useState<Snap[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [v, h] = await Promise.all([
          getJson<Variant[]>(`/admin/campaign/${id}/variants`),
          getJson<Snap[]>(`/admin/mab-history/${id}`),
        ]);
        setVariants(v);
        setHistory(h);
      } catch {
        setVariants([]);
        setHistory([]);
      }
    }
    if (id) void load();
    const i = setInterval(load, 8000);
    return () => clearInterval(i);
  }, [id]);

  const barData = variants.map((v) => ({
    name: (v.headline || v.id).slice(0, 18),
    ctr: v.impressions ? v.clicks / v.impressions : 0,
  }));

  const last = history[history.length - 1];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <Link href="/" className="text-sm text-teal-400 hover:underline">
        ← Overview
      </Link>
      <h1 className="text-2xl font-semibold mt-2">Campaign deep dive</h1>
      <p className="text-xs text-zinc-500 font-mono">{id}</p>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold mb-4">Variant CTR (database)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis stroke="#a1a1aa" fontSize={11} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #27272a" }}
                formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, "CTR"]}
              />
              <Bar dataKey="ctr" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold mb-4">Latest MAB weights (Redis)</h2>
        {!last ? (
          <p className="text-sm text-zinc-500">No history yet.</p>
        ) : (
          <ul className="space-y-2 text-sm font-mono">
            {Object.entries(last.weights || {}).map(([cid, w]) => (
              <li key={cid} className="flex justify-between border-b border-zinc-800 py-1">
                <span className="text-zinc-400 truncate">{cid}</span>
                <span className="text-teal-400">{Number(w).toFixed(4)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold mb-3">Variants</h2>
        <div className="overflow-x-auto text-sm">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
                <th className="pb-2">Angle</th>
                <th className="pb-2">Headline</th>
                <th className="pb-2">Impr.</th>
                <th className="pb-2">Clicks</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-b border-zinc-800/80">
                  <td className="py-2 capitalize text-zinc-400">{v.angle}</td>
                  <td className="py-2 max-w-xs truncate">{v.headline}</td>
                  <td className="py-2 font-mono text-xs">{v.impressions}</td>
                  <td className="py-2 font-mono text-xs">{v.clicks}</td>
                  <td className="py-2 text-xs">{v.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
