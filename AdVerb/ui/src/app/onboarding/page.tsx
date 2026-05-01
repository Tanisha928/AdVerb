"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { TopBar } from "../../components/TopBar";
import { INTEREST_LABELS } from "../../lib/interests";

const CHANNEL_OPTIONS = ["Instagram", "TikTok", "YouTube", "Search", "Display", "Email"];
const GOAL_OPTIONS = ["Conversions", "Brand Awareness", "App Installs", "Leads", "Retention"];
const TONE_OPTIONS = ["Bold", "Premium", "Friendly", "Minimal", "Playful"];
const BUDGET_OPTIONS = ["<$1k/mo", "$1k-$5k/mo", "$5k-$20k/mo", "$20k+/mo"];
const ONBOARDING_PROFILE_KEY = "adverb_onboarding_profile";

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
  primaryGoal: GOAL_OPTIONS[0],
  budget: BUDGET_OPTIONS[1],
  tone: TONE_OPTIONS[0],
  channels: ["Instagram", "Search"],
  age: 24,
  locationStr: "New York",
  device: 0,
  interests: Array(12).fill(0),
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<OnboardingProfile>(DEFAULT_PROFILE);
  const selectedInterestsCount = useMemo(() => profile.interests.filter((v) => v === 1).length, [profile.interests]);

  useEffect(() => {
    const raw = localStorage.getItem(ONBOARDING_PROFILE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<OnboardingProfile>;
      setProfile({ ...DEFAULT_PROFILE, ...parsed });
    } catch {
      // ignore invalid localStorage
    }
  }, []);

  const toggleChannel = (channel: string) =>
    setProfile((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel) ? prev.channels.filter((c) => c !== channel) : [...prev.channels, channel],
    }));

  const toggleInterest = (idx: number) =>
    setProfile((prev) => {
      const next = [...prev.interests];
      next[idx] = next[idx] ? 0 : 1;
      return { ...prev, interests: next };
    });

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <TopBar onSignIn={() => router.push("/signup")} onCreateAccount={() => router.push("/signup")} />
        <section className="panel p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Onboarding</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">Tell us about your campaigns</h3>
            </div>
            <div className="text-sm text-slate-600">Step {step} of 3</div>
          </div>
          <div className="mb-6 h-2 w-full rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-slate-900" style={{ width: `${(step / 3) * 100}%` }} />
          </div>

          {step === 1 && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="field-label">Company</span>
                <input className="input-control" value={profile.company} onChange={(e) => setProfile((p) => ({ ...p, company: e.target.value }))} />
              </label>
              <label className="block">
                <span className="field-label">Your role</span>
                <input className="input-control" value={profile.role} onChange={(e) => setProfile((p) => ({ ...p, role: e.target.value }))} />
              </label>
              <label className="block">
                <span className="field-label">Primary goal</span>
                <select className="input-control" value={profile.primaryGoal} onChange={(e) => setProfile((p) => ({ ...p, primaryGoal: e.target.value }))}>
                  {GOAL_OPTIONS.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Monthly budget</span>
                <select className="input-control" value={profile.budget} onChange={(e) => setProfile((p) => ({ ...p, budget: e.target.value }))}>
                  {BUDGET_OPTIONS.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block">
                <span className="field-label">Creative tone</span>
                <select className="input-control" value={profile.tone} onChange={(e) => setProfile((p) => ({ ...p, tone: e.target.value }))}>
                  {TONE_OPTIONS.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </label>
              <div>
                <p className="field-label">Preferred channels</p>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {CHANNEL_OPTIONS.map((channel) => {
                    const selected = profile.channels.includes(channel);
                    return (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => toggleChannel(channel)}
                        className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                          selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {channel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="field-label">Target age</span>
                  <input className="input-control" type="number" min={18} max={65} value={profile.age} onChange={(e) => setProfile((p) => ({ ...p, age: Number(e.target.value) }))} />
                </label>
                <label className="block">
                  <span className="field-label">Location</span>
                  <select className="input-control" value={profile.locationStr} onChange={(e) => setProfile((p) => ({ ...p, locationStr: e.target.value }))}>
                    {["New York", "San Jose", "Los Angeles", "Chicago", "Seattle", "London"].map((loc) => (
                      <option key={loc}>{loc}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="field-label">Device focus</span>
                  <select className="input-control" value={profile.device} onChange={(e) => setProfile((p) => ({ ...p, device: Number(e.target.value) }))}>
                    <option value={0}>Mobile</option>
                    <option value={1}>Desktop</option>
                    <option value={2}>Tablet</option>
                  </select>
                </label>
              </div>
              <div>
                <p className="field-label">Audience interests ({selectedInterestsCount} selected)</p>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {INTEREST_LABELS.map((label, idx) => {
                    const selected = profile.interests[idx] === 1;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleInterest(idx)}
                        className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                          selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button
              type="button"
              onClick={() => (step === 1 ? router.push("/signup") : setStep((s) => s - 1))}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Back
            </button>
            {step < 3 ? (
              <button type="button" onClick={() => setStep((s) => s + 1)} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(profile));
                  router.push("/studio");
                }}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
              >
                Launch Studio
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
