"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { TopBar } from "../../components/TopBar";
import type { Brand, Campaign, CreativeVariant } from "../../lib/workflowTypes";

type DashboardResponse = { brands: Brand[]; campaigns: Campaign[]; creatives: CreativeVariant[] };

export default function OwnerPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"profile" | "campaigns" | "creatives" | "analytics">("campaigns");
  const [dashboard, setDashboard] = useState<DashboardResponse>({ brands: [], campaigns: [], creatives: [] });
  const [analytics, setAnalytics] = useState<any>(null);
  const [note, setNote] = useState("");
  const [brandForm, setBrandForm] = useState({ name: "", slug: "", settings: "" });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const emptyCampaign = {
    brandId: "",
    name: "",
    startDate: "",
    endDate: "",
    category: "",
    subcategory: "",
    targetAgeRange: "",
    targetNotes: "",
  };
  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const CATEGORY_OPTIONS = ["Shoes", "Handbags", "Earrings", "Shirts"];
  const AGE_RANGE_OPTIONS = ["18-24", "25-34", "35-44", "45+"];

  async function refresh() {
    const res = await fetch("/api/workflow/owner/dashboard");
    if (res.status === 401) {
      router.push("/auth?role=brand_owner");
      return;
    }
    const data = await res.json();
    setDashboard(data);
    if (!selectedCampaignId && data.campaigns?.[0]) setSelectedCampaignId(data.campaigns[0].id);
    if (!campaignForm.brandId && data.brands[0]) {
      setCampaignForm((prev) => ({ ...prev, brandId: data.brands[0].id }));
    }
  }

  async function fetchAnalytics() {
    const res = await fetch("/api/workflow/owner/analytics");
    if (res.ok) setAnalytics(await res.json());
  }

  useEffect(() => {
    refresh();
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCampaign = useMemo(() => {
    if (!dashboard.campaigns.length) return undefined;
    return dashboard.campaigns.find((c) => c.id === selectedCampaignId) ?? dashboard.campaigns[0];
  }, [dashboard.campaigns, selectedCampaignId]);

  async function post(path: string, payload: Record<string, any>) {
    setNote("");
    try {
      const res = await fetch(`/api/workflow/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(data.error || data.message || "Action failed");
        return null;
      }
      setNote(data.message || "Updated successfully.");
      await refresh();
      await fetchAnalytics();
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setNote(msg);
      return null;
    }
  }

  async function uploadAssetsAndGenerate() {
    if (!selectedCampaign) return;
    if (!logoFile && !productFile) {
      setNote("Please select logo and/or product image files first.");
      return;
    }

    setUploadingAssets(true);
    setNote("");
    try {
      const form = new FormData();
      form.append("campaignId", selectedCampaign.id);
      if (logoFile) form.append("logoFile", logoFile);
      if (productFile) form.append("productFile", productFile);

      try {
        const res = await fetch("/api/workflow/owner/campaigns/assets", {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setNote(data.error || data.message || "Upload failed");
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed (network error)";
        setNote(msg);
        return;
      }

      await refresh();
      await fetchAnalytics();

      // Auto-generate right after assets are available.
      await post("owner/creatives/generate", { campaignId: selectedCampaign.id });

      setLogoFile(null);
      setProductFile(null);
    } finally {
      setUploadingAssets(false);
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <TopBar
          signedIn
          onSignOut={async () => {
            await fetch("/api/workflow/auth/logout", { method: "POST" });
            router.push("/");
          }}
        />
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="left-rail p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Brand Owner</p>
            {[
              ["profile", "Profile"],
              ["campaigns", "Campaigns"],
              ["creatives", "Creatives"],
              ["analytics", "Analytics"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key as any)}
                className={`mb-2 block w-full rounded-lg px-3 py-2 text-left text-sm ${tab === key ? "bg-white/20 text-white" : "text-slate-300 hover:bg-white/10"}`}
              >
                {label}
              </button>
            ))}
          </aside>
          <section className="space-y-4">
            {tab === "profile" && (
              <div className="panel p-5">
                <h3 className="text-lg font-semibold">Brand Profile</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Create and manage your brand identity. A demo brand named <span className="font-semibold">StrideX</span> is preloaded so
                  you can see the workflow without setting anything up.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <input className="input-control" placeholder="Brand name" value={brandForm.name} onChange={(e) => setBrandForm((f) => ({ ...f, name: e.target.value }))} />
                  <input className="input-control" placeholder="Slug/handle" value={brandForm.slug} onChange={(e) => setBrandForm((f) => ({ ...f, slug: e.target.value }))} />
                  <input className="input-control" placeholder="Optional settings/preferences" value={brandForm.settings} onChange={(e) => setBrandForm((f) => ({ ...f, settings: e.target.value }))} />
                </div>
                <button className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => post("owner/brands", brandForm)}>
                  Create Brand
                </button>
                <div className="mt-4 space-y-2">
                  {dashboard.brands.map((b) => (
                    <div key={b.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      {b.name} <span className="text-slate-500">({b.slug})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "campaigns" && (
              <div className="panel p-5">
                <h3 className="text-lg font-semibold">Campaign Dashboard</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <select className="input-control" value={campaignForm.brandId} onChange={(e) => setCampaignForm((f) => ({ ...f, brandId: e.target.value }))}>
                    <option value="">Select brand</option>
                    {dashboard.brands.map((b) => (
                      <option value={b.id} key={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <input className="input-control" placeholder="Campaign name" value={campaignForm.name} onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))} />
                  <select className="input-control" value={campaignForm.category} onChange={(e) => setCampaignForm((f) => ({ ...f, category: e.target.value }))}>
                    <option value="">Select category</option>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt}>{opt}</option>
                    ))}
                  </select>
                  <input className="input-control" placeholder="Subcategory" value={campaignForm.subcategory} onChange={(e) => setCampaignForm((f) => ({ ...f, subcategory: e.target.value }))} />
                  <input className="input-control" type="date" value={campaignForm.startDate} onChange={(e) => setCampaignForm((f) => ({ ...f, startDate: e.target.value }))} />
                  <input className="input-control" type="date" value={campaignForm.endDate} onChange={(e) => setCampaignForm((f) => ({ ...f, endDate: e.target.value }))} />
                  <select className="input-control" value={campaignForm.targetAgeRange} onChange={(e) => setCampaignForm((f) => ({ ...f, targetAgeRange: e.target.value }))}>
                    <option value="">Target age range</option>
                    {AGE_RANGE_OPTIONS.map((opt) => (
                      <option key={opt}>{opt}</option>
                    ))}
                  </select>
                  <input className="input-control" placeholder="Target audience notes" value={campaignForm.targetNotes} onChange={(e) => setCampaignForm((f) => ({ ...f, targetNotes: e.target.value }))} />
                </div>
                <button
                  className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  onClick={async () => {
                    const res = await post("owner/campaigns", campaignForm);
                    if (res) {
                      setCampaignForm((f) => ({ ...emptyCampaign, brandId: f.brandId }));
                    }
                  }}
                >
                  Create Campaign
                </button>
                <div className="mt-4 space-y-2">
                  {dashboard.campaigns.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-slate-500">
                          {c.category} / {c.subcategory} - {c.status}
                        </p>
                      </div>
                      {c.status === "planned" ? (
                        <button
                          className="cursor-pointer rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100"
                          onClick={() => post("owner/campaigns/activate", { campaignId: c.id })}
                        >
                          Start campaign
                        </button>
                      ) : (
                        <span className="rounded bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          {c.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "creatives" && (
              <div className="panel p-5">
                <h3 className="text-lg font-semibold">Creative Generation & Review</h3>
                <p className="text-sm text-slate-600">Upload assets, auto-generate variants, approve/reject, and backfill embeddings.</p>
                {selectedCampaign ? (
                  <>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="field-label">Campaign</span>
                        <select
                          className="input-control"
                          value={selectedCampaign.id}
                          onChange={(e) => setSelectedCampaignId(e.target.value)}
                        >
                          {dashboard.campaigns.map((campaign) => (
                            <option key={campaign.id} value={campaign.id}>
                              {campaign.name} ({campaign.status})
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <p className="font-medium">{selectedCampaign.name}</p>
                        <p className="text-xs text-slate-500">
                          {selectedCampaign.category} / {selectedCampaign.subcategory} • Audience {selectedCampaign.targetAgeRange}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <label className="space-y-2">
                        <span className="field-label" style={{ marginBottom: 0 }}>
                          Brand logo
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="w-full text-sm"
                          onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                        />
                        {logoFile && <p className="text-xs text-slate-500">Selected: {logoFile.name}</p>}
                      </label>
                      <label className="space-y-2">
                        <span className="field-label" style={{ marginBottom: 0 }}>
                          Product image
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="w-full text-sm"
                          onChange={(e) => setProductFile(e.target.files?.[0] ?? null)}
                        />
                        {productFile && <p className="text-xs text-slate-500">Selected: {productFile.name}</p>}
                      </label>
                      <div className="flex flex-col gap-2">
                        <button
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          disabled={uploadingAssets}
                          onClick={uploadAssetsAndGenerate}
                        >
                          {uploadingAssets ? "Uploading..." : "Upload & generate variants"}
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
                          disabled={uploadingAssets}
                          onClick={() => post("owner/creatives/generate", { campaignId: selectedCampaign.id })}
                        >
                          Generate variants (manual)
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {dashboard.creatives
                        .filter((c) => c.campaignId === selectedCampaign.id)
                        .map((c) => (
                          <div key={c.id} className="rounded-lg border border-slate-200 p-3">
                            <p className="font-medium">{c.variantKey}</p>
                            <p className="text-xs text-slate-500">Campaign: {selectedCampaign.name}</p>
                            <div
                              className="relative mt-2 h-36 w-full overflow-hidden rounded bg-slate-50"
                              style={
                                c.backgroundUrl
                                  ? { backgroundImage: `url(${c.backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                                  : { backgroundImage: `url(${c.previewImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                              }
                            >
                              {selectedCampaign.productImageUrl ? (
                                <img
                                  src={selectedCampaign.productImageUrl}
                                  alt={`${c.variantKey} product`}
                                  className="absolute inset-0 m-auto h-[84%] w-[84%] object-contain drop-shadow-[0_18px_25px_rgba(0,0,0,0.25)]"
                                />
                              ) : (
                                <img src={c.previewImageUrl} alt={c.variantKey} className="absolute inset-0 h-full w-full object-cover" />
                              )}
                            </div>
                            <p className="mt-2 text-xs text-slate-600">
                              Generation: {c.generationStatus} | Review: {c.reviewStatus}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">{c.embeddingDetails || "Embedding missing. Backfill recommended."}</p>
                            <div className="mt-2 flex gap-2">
                              <button
                                className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                                onClick={() => post("owner/creatives/review", { creativeId: c.id, reviewStatus: "approved" })}
                              >
                                Approve
                              </button>
                              <button
                                className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                                onClick={() => post("owner/creatives/review", { creativeId: c.id, reviewStatus: "rejected" })}
                              >
                                Reject
                              </button>
                              <button
                                className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                                onClick={() => post("owner/creatives/backfill", { creativeId: c.id })}
                              >
                                Backfill
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">Create a campaign first.</p>
                )}
              </div>
            )}

            {tab === "analytics" && (
              <div className="panel p-5">
                <h3 className="text-lg font-semibold">Analytics</h3>
                {analytics ? (
                  <>
                    <div className="mt-3 grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-slate-200 p-3 text-sm">
                        <p className="text-xs text-slate-500">Impressions</p>
                        <p className="mt-1 text-lg font-semibold">{analytics.summary.impressions}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3 text-sm">
                        <p className="text-xs text-slate-500">Clicks</p>
                        <p className="mt-1 text-lg font-semibold">{analytics.summary.clicks}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3 text-sm">
                        <p className="text-xs text-slate-500">CTR</p>
                        <p className="mt-1 text-lg font-semibold">{(analytics.summary.ctr * 100).toFixed(2)}%</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3 text-sm">
                        <p className="text-xs text-slate-500">Approved creatives</p>
                        <p className="mt-1 text-lg font-semibold">
                          {analytics.creativeComparison.filter((c: any) => c.reviewStatus === "approved").length}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1.2fr]">
                      <div className="rounded-lg border border-slate-200 p-3">
                        <p className="text-sm font-medium">Engagement by campaign</p>
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          {analytics.series.map((row: any) => (
                            <div key={row.campaignId} className="flex justify-between rounded-md bg-slate-50 px-2 py-1">
                              <span>{row.name}</span>
                              <span>
                                {row.impressions} impr / {row.clicks} clicks
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3 text-sm">
                        <p className="font-medium">Top creative (by CTR)</p>
                        {analytics.creativeComparison.length ? (
                          (() => {
                            const top = [...analytics.creativeComparison].sort((a: any, b: any) => b.ctr - a.ctr)[0];
                            return (
                              <p className="mt-2 text-slate-700">
                                <span className="font-semibold">{top.variantKey}</span> — {(top.ctr * 100).toFixed(1)}% CTR
                              </p>
                            );
                          })()
                        ) : (
                          <p className="mt-2 text-slate-500">No creatives yet.</p>
                        )}
                        <div className="mt-4">
                          <p className="text-xs font-medium text-slate-500">Fatigue alerts</p>
                          {(analytics.fatigueAlerts || []).map((a: any) => (
                            <p key={a.creativeId} className="mt-1 text-xs text-amber-700">
                              {a.message}
                            </p>
                          ))}
                          {(!analytics.fatigueAlerts || analytics.fatigueAlerts.length === 0) && (
                            <p className="mt-1 text-xs text-emerald-700">All clear: no creatives past fatigue threshold.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-600">Loading analytics...</p>
                )}
              </div>
            )}
            {note && <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{note}</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
