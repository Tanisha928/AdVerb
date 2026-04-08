const map: Record<string, string> = {
  social_proof: "bg-purple-100 text-purple-800",
  urgency: "bg-red-100 text-red-800",
  benefit: "bg-teal-100 text-teal-800",
  curiosity: "bg-amber-100 text-amber-900",
};

export function AngleBadge({ angle }: { angle?: string | null }) {
  const a = angle || "variant";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${map[a] || "bg-slate-200 text-slate-700"}`}
    >
      {a.replace("_", " ")}
    </span>
  );
}
