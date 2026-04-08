const map: Record<string, string> = {
  draft: "bg-slate-200 text-slate-700",
  generating: "bg-amber-100 text-amber-800 animate-pulse-soft",
  review: "bg-blue-100 text-blue-800",
  live: "bg-emerald-100 text-emerald-800",
  paused: "bg-slate-300 text-slate-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] || "bg-slate-200"}`}
    >
      {status}
    </span>
  );
}
