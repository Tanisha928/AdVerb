"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TopBar } from "../../components/TopBar";
import type { UserRole } from "../../lib/workflowTypes";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [role, setRole] = useState<UserRole>("brand_owner");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("role");
    if (q === "brand_owner" || q === "shopper") setRole(q);
  }, []);

  async function submit() {
    setError("");
    setMessage("");
    const endpoint = mode === "signup" ? "/api/workflow/auth/signup" : "/api/workflow/auth/login";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, fullName, email, password, company }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Authentication failed");
      return;
    }
    setMessage(mode === "signup" ? "Account created successfully." : "Logged in successfully.");
    router.push(role === "brand_owner" ? "/owner" : "/shopper");
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <TopBar />
        <section className="panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">Authentication</h2>
            <div className="flex gap-2">
              <button className={`rounded-lg px-3 py-1.5 text-sm ${mode === "signup" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`} onClick={() => setMode("signup")}>
                Sign up
              </button>
              <button className={`rounded-lg px-3 py-1.5 text-sm ${mode === "login" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`} onClick={() => setMode("login")}>
                Log in
              </button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="field-label">Role</span>
              <select className="input-control" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="brand_owner">Brand Owner</option>
                <option value="shopper">Shopper</option>
              </select>
            </label>
            {mode === "signup" && role === "brand_owner" && (
              <label className="block">
                <span className="field-label">Company</span>
                <input className="input-control" value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
            )}
            {mode === "signup" && (
              <label className="block">
                <span className="field-label">Full name</span>
                <input className="input-control" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
            )}
            <label className="block">
              <span className="field-label">Email</span>
              <input className="input-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block">
              <span className="field-label">Password</span>
              <input className="input-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={submit}>
              {mode === "signup" ? "Create Account" : "Log In"}
            </button>
            <span className="text-sm text-slate-600">
              Demo credentials: `owner@adverb.demo` / `demo123` and `shopper@adverb.demo` / `demo123`
            </span>
          </div>
          {message && <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        </section>
      </div>
    </main>
  );
}
