"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Home", href: "/" },
  { label: "Onboarding", href: "/onboarding" },
  { label: "Studio", href: "/studio" },
  { label: "Analytics", href: "/analytics" },
  { label: "Simulate", href: "/simulate" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="left-rail hidden w-64 shrink-0 p-4 lg:block">
      <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        Navigation
      </p>
      <nav aria-label="Primary">
        <ul className="space-y-1">
          {NAV.map(({ label, href }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={[
                    "block w-full rounded-xl px-3 py-2 text-left text-sm transition",
                    active
                      ? "bg-white/15 font-semibold text-white"
                      : "text-slate-300 hover:bg-white/10",
                  ].join(" ")}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
