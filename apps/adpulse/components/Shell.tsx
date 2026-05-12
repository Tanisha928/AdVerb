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
  const home = pathname === "/brands";
  return (
    <div className="flex flex-1 min-h-[calc(100vh-3.5rem)]">
      <aside className="w-60 shrink-0 bg-sidebar text-slate-200 flex flex-col p-6">
        <p className="text-xs text-slate-500 mb-8 font-medium uppercase tracking-widest">Brand Portal</p>
        <nav className="space-y-2 text-sm">
          <Link
            href="/brands"
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
