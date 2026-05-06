"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEMO_USERS } from "@/lib/demoUsers";

type ClickRow = { id: string; at: string; headline?: string };

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [history, setHistory] = useState<ClickRow[]>([]);

  useEffect(() => {
    const id = localStorage.getItem("adverb_user_id");
    setUserId(id);
    const u = DEMO_USERS.find((x) => x.id === id);
    setInterests(u?.interests || []);
    try {
      const h = JSON.parse(localStorage.getItem(`adverb_clicks_${id}`) || "[]") as ClickRow[];
      setHistory(h);
    } catch {
      setHistory([]);
    }
  }, []);

  function saveInterests() {
    if (!userId) return;
    localStorage.setItem(`adverb_interests_${userId}`, JSON.stringify(interests));
    alert("Saved locally (demo). DB sync not wired for users.");
  }

  function clearHistory() {
    if (!userId) return;
    localStorage.removeItem(`adverb_clicks_${userId}`);
    setHistory([]);
  }

  return (
    <div className="max-w-2xl mx-auto p-10">
      <Link href="/feed" className="text-indigo-600 text-sm font-semibold">
        ← Back to feed
      </Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">Profile</h1>
      <div className="rounded-2xl border border-slate-200 p-6 bg-white mb-6">
        <p className="text-sm font-semibold mb-2">Interests (local edit)</p>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm"
          value={interests.join(", ")}
          onChange={(e) =>
            setInterests(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
        <button type="button" onClick={saveInterests} className="mt-3 text-sm font-semibold text-indigo-600">
          Save interests
        </button>
      </div>
      <div className="rounded-2xl border border-slate-200 p-6 bg-white">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm font-semibold">Clicked ads</p>
          <button type="button" onClick={clearHistory} className="text-xs text-red-600 font-semibold">
            Clear history
          </button>
        </div>
        <ul className="space-y-3 text-sm">
          {history.map((h) => (
            <li key={h.id + h.at} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <span className="text-slate-800 line-clamp-1">{h.headline || h.id}</span>
              <span className="text-slate-400 text-xs whitespace-nowrap">{new Date(h.at).toLocaleString()}</span>
            </li>
          ))}
          {history.length === 0 && <li className="text-slate-500">No clicks yet.</li>}
        </ul>
      </div>
    </div>
  );
}
