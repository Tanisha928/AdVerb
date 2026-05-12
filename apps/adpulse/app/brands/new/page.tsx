"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Shell } from "@/components/Shell";
import { brandApi } from "@/lib/api";

const INTERESTS = ["fitness", "tech", "coffee", "travel", "gaming", "beauty", "food", "fashion"];

export default function NewBrandPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("Technology");
  const [tone, setTone] = useState("professional");
  const [primary, setPrimary] = useState("#6366f1");
  const [secondary, setSecondary] = useState("#a5b4fc");
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(45);
  const [picked, setPicked] = useState<string[]>(["tech", "coffee"]);
  const [logo, setLogo] = useState<File | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("tone", tone);
      fd.append("industry", industry);
      fd.append("target_interests", picked.join(","));
      fd.append("target_age_min", String(ageMin));
      fd.append("target_age_max", String(ageMax));
      fd.append("color_primary", primary);
      fd.append("color_secondary", secondary);
      if (logo) fd.append("logo", logo);
      const res = await fetch(`${brandApi()}/brands`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const b = await res.json();
      toast.success("Brand created");
      router.push(`/brands/${b.id}`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: string) {
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  }

  return (
    <Shell accent={primary}>
      <div className="p-10 max-w-3xl mx-auto">
        <h1 className="font-display text-3xl font-bold mb-2">Create brand</h1>
        <p className="text-slate-500 mb-8">Define voice, palette, and audience targeting.</p>
        <form onSubmit={submit} className="space-y-6 bg-white rounded-2xl p-8 shadow-sm ring-1 ring-slate-100">
          <div>
            <label className="text-sm font-medium text-slate-700">Brand name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Industry</label>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
              <option>Technology</option>
              <option>Food & Beverage</option>
              <option>Fitness</option>
              <option>Beauty</option>
              <option>Retail</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Tone</label>
            <div className="flex flex-wrap gap-2">
              {["professional", "playful", "bold", "luxury"].map((t) => (
                <button type="button" key={t} onClick={() => setTone(t)}
                  className={`rounded-full px-4 py-2 text-sm capitalize border ${tone === t ? "border-indigo-600 bg-indigo-50 text-indigo-800" : "border-slate-200"}`}
                >{t}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Primary color</label>
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="mt-2 h-10 w-full" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Secondary color</label>
              <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="mt-2 h-10 w-full" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Target interests</label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <button type="button" key={i} onClick={() => toggle(i)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${picked.includes(i) ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200"}`}
                >{i}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Age range: {ageMin} – {ageMax}</label>
            <div className="flex gap-4 mt-2">
              <input type="range" min={18} max={65} value={ageMin} onChange={(e) => setAgeMin(+e.target.value)} className="flex-1" />
              <input type="range" min={18} max={65} value={ageMax} onChange={(e) => setAgeMax(+e.target.value)} className="flex-1" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Logo (optional)</label>
            <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] || null)} className="mt-2" />
          </div>
          <button disabled={loading} className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
            {loading ? "Saving…" : "Create brand"}
          </button>
        </form>
      </div>
    </Shell>
  );
}
