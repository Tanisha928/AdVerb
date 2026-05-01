"use client";

import { useRouter } from "next/navigation";

import { TopBar } from "../components/TopBar";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <TopBar onSignIn={() => router.push("/signup")} onCreateAccount={() => router.push("/signup")} />
        <section className="panel p-8">
          <p className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            Creative Personalization Workflow
          </p>
          <h2 className="mt-4 text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            One platform for Brand Owners and Shoppers
          </h2>
          <p className="mt-4 max-w-3xl text-base text-slate-600">
            Build campaigns, upload assets to Supabase-compatible storage, auto-generate variants, review
            approvals, and let shoppers browse only running campaigns with live interaction analytics.
          </p>
        </section>
        <section className="grid gap-6 md:grid-cols-2">
          <article className="panel p-6">
            <h3 className="text-xl font-semibold text-slate-900">Brand Owner</h3>
            <p className="mt-2 text-sm text-slate-600">
              Manage brand profile, campaigns, creative generation, approvals, embeddings, and analytics.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>- Create brands and campaigns</li>
              <li>- Upload logo + product image</li>
              <li>- Generate, approve, and backfill creatives</li>
            </ul>
            <button
              type="button"
              onClick={() => router.push("/auth?role=brand_owner")}
              className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Continue as Brand Owner
            </button>
          </article>
          <article className="panel p-6">
            <h3 className="text-xl font-semibold text-slate-900">Shopper</h3>
            <p className="mt-2 text-sm text-slate-600">
              Browse personalized creatives from currently running campaigns and interact with best variants.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>- Filter by category/subcategory</li>
              <li>- View brand context and product creative</li>
              <li>- Impression/click interactions + best recommendation</li>
            </ul>
            <button
              type="button"
              onClick={() => router.push("/auth?role=shopper")}
              className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Continue as Shopper
            </button>
          </article>
        </section>
      </div>
    </main>
  );
}
