"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Shell({
  children,
  accent = "#6366f1",
}: {
  children: React.ReactNode;
  accent?: string;
}) {
  const pathname = usePathname();
  const home = pathname === "/";
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 bg-sidebar text-slate-200 flex flex-col p-6">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          AdaptAI
        </Link>
        <p className="text-xs text-slate-500 mt-1 mb-8">Brand Portal</p>
        <nav className="space-y-2 text-sm">
          <Link
            href="/"
            className={`block rounded-lg px-3 py-2 ${home ? "bg-white/10" : "hover:bg-white/5"}`}
          >
            All brands
          </Link>
        </nav>
        <div className="mt-auto pt-8 text-xs text-slate-500">
          <div
            className="h-2 w-full rounded-full mb-2"
            style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
          />
          Accent preview
        </div>
      </aside>
      <main className="flex-1 bg-slate-50">{children}</main>
    </div>
  );
}
