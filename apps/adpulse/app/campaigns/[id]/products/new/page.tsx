"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Shell } from "@/components/Shell";
import { brandApi } from "@/lib/api";

export default function NewProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [benefits, setBenefits] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const [image, setImage] = useState<File | null>(null);

  function addTag() {
    const t = tag.trim();
    if (!t) return;
    setBenefits((b) => [...b, t]);
    setTag("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!image) { toast.error("Product image is required for creative assembly"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("description", description);
      fd.append("key_benefits", benefits.join(","));
      fd.append("image", image);
      const res = await fetch(`${brandApi()}/campaigns/${id}/products`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Product added");
      router.push(`/campaigns/${id}`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="p-10 max-w-2xl mx-auto">
        <h1 className="font-display text-3xl font-bold mb-8">Add product</h1>
        <form onSubmit={submit} className="space-y-6 bg-white rounded-2xl p-8 shadow-sm ring-1 ring-slate-100">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 min-h-[100px]" />
          </div>
          <div>
            <label className="text-sm font-medium">Key benefits</label>
            <div className="flex gap-2 mt-1">
              <input value={tag} onChange={(e) => setTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2" placeholder="Type and press Enter" />
              <button type="button" onClick={addTag} className="rounded-lg border px-3 text-sm">Add</button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {benefits.map((b) => <span key={b} className="rounded-full bg-slate-100 px-3 py-1 text-xs">{b}</span>)}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Image</label>
            <input type="file" accept="image/*" required onChange={(e) => setImage(e.target.files?.[0] || null)} className="mt-2" />
          </div>
          <button disabled={loading} className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
            {loading ? "Saving…" : "Save product"}
          </button>
        </form>
      </div>
    </Shell>
  );
}
