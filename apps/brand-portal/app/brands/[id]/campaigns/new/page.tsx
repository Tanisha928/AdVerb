"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import { Shell } from "@/components/Shell";
import { apiPost } from "@/lib/api";
import type { Campaign } from "@/lib/types";

export default function NewCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("clicks");
  const [budget, setBudget] = useState("5000");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const c = await apiPost<Campaign>(`/brands/${id}/campaigns`, {
        name,
        objective,
        budget: budget ? Number(budget) : null,
        start_date: null,
        end_date: null,
      });
      toast.success("Campaign created — add products next");
      router.push(`/campaigns/${c.id}`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="p-10 max-w-3xl mx-auto">
        <h1 className="font-display text-3xl font-bold mb-8">New campaign</h1>
        <form onSubmit={submit} className="space-y-6 bg-white rounded-2xl p-8 shadow-sm ring-1 ring-slate-100">
          <div>
            <label className="text-sm font-medium">Campaign name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-3 block">Objective</label>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                ["awareness", "Reach new audiences"],
                ["clicks", "Drive qualified traffic"],
                ["conversions", "Optimize for outcomes"],
              ].map(([k, d]) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setObjective(k)}
                  className={`rounded-xl border p-4 text-left text-sm ${
                    objective === k ? "border-indigo-600 bg-indigo-50" : "border-slate-200"
                  }`}
                >
                  <p className="font-semibold capitalize">{k}</p>
                  <p className="text-slate-500 text-xs mt-1">{d}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Budget (USD)</label>
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
          <button
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create campaign"}
          </button>
        </form>
      </div>
    </Shell>
  );
}
