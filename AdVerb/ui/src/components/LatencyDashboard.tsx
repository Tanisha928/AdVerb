import type { AdResponse } from "../lib/types";

export function LatencyDashboard({ data }: { data: AdResponse }) {
  const total = Math.max(1, data.latency.totalMs);
  const faissMs = data.latency.faissSearchMs ?? 0;
  const accounted =
    data.latency.networkTransitMs +
    data.latency.goDecisionMs +
    data.latency.workersAiMs +
    data.latency.edgeServingMs +
    faissMs;
  const overhead = Math.max(0, total - accounted);
  const parts = [
    { label: "Network transit", value: data.latency.networkTransitMs, color: "#3B82F6" },
    { label: "Go decision",     value: data.latency.goDecisionMs,     color: "#22C55E" },
    { label: "Copy generation", value: data.latency.workersAiMs,      color: "#A855F7" },
    ...(faissMs > 0
      ? [{ label: "FAISS similarity cache", value: faissMs, color: "#14B8A6" } as const]
      : []),
    { label: "Edge serving",    value: data.latency.edgeServingMs,    color: "#6B7280" },
    { label: "Server overhead", value: overhead,                       color: "#F59E0B" },
  ];

  return (
    <section className="panel p-6">
      <div className="mb-5 flex items-center justify-between">
        <h4 className="text-lg font-semibold text-white">Latency Breakdown</h4>
        <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-sm font-semibold text-violet-200">
          Total RTT: {data.latency.totalMs}ms
        </span>
      </div>
      {parts.map((part) => (
        <div key={part.label} className="mb-4 last:mb-0">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-200">{part.label}</span>
            <span className="text-slate-400">{part.value}ms</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (part.value / total) * 100)}%`, background: part.color }}
            />
          </div>
        </div>
      ))}
      <div className="mt-4 border-t border-white/10 pt-4 text-sm text-slate-400">Served from: {data.servedFrom}</div>
    </section>
  );
}
