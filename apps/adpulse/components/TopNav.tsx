"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { label: "Brand Portal", href: "/brands" },
  { label: "User Feed",    href: "/feed" },
  { label: "Admin",        href: "/admin" },
] as const;

export function TopNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/brands") return pathname.startsWith("/brands") || pathname.startsWith("/campaigns");
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-slate-200 bg-white/95 backdrop-blur-sm flex items-center px-6 gap-6 shadow-sm">
      <Link href="/" className="font-display text-lg font-bold tracking-tight text-slate-900 mr-4">
        adverb
      </Link>

      <nav className="flex items-center gap-1 ml-auto">
        {SECTIONS.map(({ label, href }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
