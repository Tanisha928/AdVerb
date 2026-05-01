"use client";

interface Props {
  active: boolean;
}

export function AuctionAnimation({ active }: Props) {
  if (!active) return null;
  return (
    <div className="panel mb-6 flex items-center gap-4 p-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-violet-400" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-white">Auction in progress</p>
        <p className="text-sm text-slate-300">Routing, scoring, copy generation, and creative assembly...</p>
      </div>
    </div>
  );
}
