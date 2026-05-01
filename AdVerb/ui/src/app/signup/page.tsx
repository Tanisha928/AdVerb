"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { TopBar } from "../../components/TopBar";

const ONBOARDING_PROFILE_KEY = "adverb_onboarding_profile";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const ready = Boolean(fullName.trim() && email.trim() && password.length >= 6);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <TopBar onSignIn={() => {}} onCreateAccount={() => {}} />
        <section className="panel max-w-xl space-y-5 p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Create account</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">Set up your workspace</h3>
              <p className="mt-1 text-sm text-slate-600">Use your details to personalize onboarding and ad generation.</p>
            </div>
            <label className="block">
              <span className="field-label">Full name</span>
              <input className="input-control" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Krati Sharma" />
            </label>
            <label className="block">
              <span className="field-label">Work email</span>
              <input className="input-control" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@company.com" />
            </label>
            <label className="block">
              <span className="field-label">Password</span>
              <input className="input-control" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Minimum 6 characters" />
            </label>
            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => router.push("/")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                Back
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => {
                  const base = {
                    fullName,
                    email,
                    company: "",
                    role: "",
                    primaryGoal: "Conversions",
                    budget: "$1k-$5k/mo",
                    tone: "Bold",
                    channels: ["Instagram", "Search"],
                    age: 24,
                    locationStr: "New York",
                    device: 0,
                    interests: Array(12).fill(0),
                  };
                  localStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(base));
                  router.push("/onboarding");
                }}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Continue
              </button>
            </div>
        </section>
      </div>
    </main>
  );
}
