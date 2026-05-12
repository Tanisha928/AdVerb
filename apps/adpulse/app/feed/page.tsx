"use client";

import { useRouter } from "next/navigation";
import { DEMO_USERS } from "@/lib/demoUsers";

export default function FeedHome() {
  const router = useRouter();

  function pick(userId: string) {
    localStorage.setItem("adverb_user_id", userId);
    router.push("/feed/browse");
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] p-10 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Choose a demo persona</h1>
      <p className="text-slate-500 mb-10">Each profile has different interests to showcase targeting.</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_USERS.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => pick(u.id)}
            className="text-left rounded-2xl border border-slate-200 p-6 hover:border-indigo-300 hover:shadow-md transition bg-white"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center">
                {u.name.split(" ").map((p) => p[0]).join("")}
              </div>
              <div>
                <p className="font-semibold">{u.name}</p>
                <p className="text-xs text-slate-400">Demo user</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {u.interests.map((i) => (
                <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{i}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-slate-400 mt-16">Powered by adverb</p>
    </div>
  );
}
