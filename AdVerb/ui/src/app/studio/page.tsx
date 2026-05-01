"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdCreativeCard } from "../../components/AdCreativeCard";
import { AdForm } from "../../components/AdForm";
import { AuctionAnimation } from "../../components/AuctionAnimation";
import { LatencyDashboard } from "../../components/LatencyDashboard";
import { Sidebar } from "../../components/Sidebar";
import { TopBar } from "../../components/TopBar";
import { useAdRequest } from "../../hooks/useAdRequest";
import type { SimulateVariant } from "../../lib/types";

const ONBOARDING_PROFILE_KEY = "adverb_onboarding_profile";
const SIMULATE_VARIANT_KEY = "adverb_simulate_variant";
const STUDIO_LAST_RESULT_KEY = "adverb_studio_last_result";

type OnboardingProfile = {
  fullName: string;
  email: string;
  company: string;
  role: string;
  primaryGoal: string;
  budget: string;
  tone: string;
  channels: string[];
  age: number;
  locationStr: string;
  device: number;
  interests: number[];
};

const DEFAULT_PROFILE: OnboardingProfile = {
  fullName: "",
  email: "",
  company: "",
  role: "",
  primaryGoal: "Conversions",
  budget: "$1k-$5k/mo",
  tone: "Bold",
  channels: [],
  age: 24,
  locationStr: "New York",
  device: 0,
  interests: Array(12).fill(0),
};

export default function StudioPage() {
  const router = useRouter();
  const { loading, error, data, setData, lastPayload, runAuction, regenerateImage } = useAdRequest();
  const [profile, setProfile] = useState<OnboardingProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    const raw = localStorage.getItem(ONBOARDING_PROFILE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<OnboardingProfile>;
      setProfile({ ...DEFAULT_PROFILE, ...parsed });
    } catch {
      // ignore
    }
  }, []);

  // Persist results so navigating to /simulate and back doesn't lose them.
  useEffect(() => {
    if (data) {
      localStorage.setItem(STUDIO_LAST_RESULT_KEY, JSON.stringify(data));
    }
  }, [data]);

  useEffect(() => {
    if (data) return; // already have fresh data
    const raw = localStorage.getItem(STUDIO_LAST_RESULT_KEY);
    if (!raw) return;
    try {
      setData(JSON.parse(raw));
    } catch {
      // ignore stale data
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSimulate(variant: SimulateVariant) {
    localStorage.setItem(SIMULATE_VARIANT_KEY, JSON.stringify(variant));
    router.push("/simulate");
  }

  const variants = data?.variants?.length ? data.variants : data ? [data.creative] : [];

  return (
    <main className="min-h-screen p-4 md:p-6">
      <TopBar
        signedIn
        onSignOut={() => {
          localStorage.removeItem(ONBOARDING_PROFILE_KEY);
          router.push("/");
        }}
      />
      <div className="flex gap-6">
        <Sidebar />
        <section className="min-w-0 flex-1 space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <AdForm
              onSubmit={runAuction}
              prefill={{
                age: profile.age,
                locationStr: profile.locationStr,
                interests: profile.interests,
              }}
            />
            <div className="panel p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Campaign Snapshot
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                Welcome, {profile.fullName || "Creator"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {profile.company || "Your brand"} is configured for{" "}
                {profile.primaryGoal.toLowerCase()} with a {profile.tone.toLowerCase()} creative
                tone and {profile.channels.length} active channels.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Primary Goal</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {profile.primaryGoal}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Budget Segment</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{profile.budget}</p>
                </div>
              </div>
            </div>
          </div>

          <AuctionAnimation active={loading} />
          {error && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-900/30 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          )}

          {data && variants.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Ad Variants — {variants.length} generated
                </h3>
                <span className="text-xs text-slate-500">
                  Click "Simulate user view" to test a variant
                </span>
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                {variants.map((variant) => (
                  <AdCreativeCard
                    key={variant.variantId}
                    data={{ ...data, creative: variant }}
                    lastPayload={lastPayload}
                    loading={loading}
                    onRefresh={() => regenerateImage("refresh")}
                    onRebuild={(feedback) => regenerateImage("rebuild", feedback)}
                    onSimulate={handleSimulate}
                  />
                ))}
              </div>
              <LatencyDashboard data={data} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
