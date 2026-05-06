"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdCard } from "@/components/AdCard";
import { DEMO_USERS } from "@/lib/demoUsers";
import { fetchFeed, type ServedAd } from "@/lib/ad";

export default function FeedPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ads, setAds] = useState<ServedAd[]>([]);
  const [effectiveInterests, setEffectiveInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("adverb_user_id") : null;
    setUserId(id);
    if (id) {
      try {
        const localInterests = JSON.parse(localStorage.getItem(`adverb_interests_${id}`) || "[]") as string[];
        const normalized = localInterests.map((v) => v.trim()).filter(Boolean);
        if (normalized.length > 0) {
          setEffectiveInterests(normalized);
          return;
        }
      } catch {
        // ignore malformed local override
      }
      const fallback = DEMO_USERS.find((u) => u.id === id)?.interests || [];
      setEffectiveInterests(fallback);
    }
  }, []);

  const user = DEMO_USERS.find((u) => u.id === userId);

  async function load() {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchFeed(userId, effectiveInterests);
      setAds(data.filter((a) => a && a.id && !(a as { error?: string }).error));
    } catch {
      setAds([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId) void load();
  }, [userId, effectiveInterests.join(",")]);

  if (!userId) {
    return (
      <div className="p-10 text-center">
        <p className="mb-4">No user selected.</p>
        <Link href="/" className="text-indigo-600 font-semibold">
          Pick a user
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center">
              {(user?.name || "?")
                .split(" ")
                .map((p) => p[0])
                .join("")}
            </div>
            <div>
              <p className="font-semibold">{user?.name || "Guest"}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {effectiveInterests.map((i) => (
                  <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                    {i}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/" className="text-indigo-600 font-semibold hover:underline">
              Switch user
            </Link>
            <Link href="/profile" className="text-slate-600 hover:underline">
              Profile
            </Link>
            <button type="button" onClick={() => load()} className="text-slate-900 font-semibold hover:underline">
              Refresh feed
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex flex-wrap gap-6 justify-center">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="w-[380px] h-[500px] rounded-2xl shimmer" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-6 justify-center">
            {ads.map((ad, idx) => (
              <AdCard
                key={`${ad.id}-${idx}`}
                ad={ad}
                userId={userId}
                category={effectiveInterests[idx % (effectiveInterests.length || 1)] || "feed"}
              />
            ))}
          </div>
        )}
      </main>
      <footer className="text-center text-[11px] text-slate-400 pb-6">Powered by adverb</footer>
    </div>
  );
}
