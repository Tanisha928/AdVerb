import { NextResponse } from "next/server";

type InterestCategory = { key: string; label: string; index: number; folder: string };

const CANDIDATES: InterestCategory[] = [
  { key: "running-shoes", label: "Running Shoes", index: 0, folder: "running-shoes" },
  { key: "shirt", label: "Shirt", index: 8, folder: "shirt" },
  { key: "handbag", label: "Handbag", index: 8, folder: "handbag" },
  { key: "earring", label: "Earring", index: 9, folder: "earring" },
  { key: "watch", label: "Watch", index: 10, folder: "watch" },
];

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || "adverb-assets";

  // Fallback if server env keys are not configured.
  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json({
      categories: CANDIDATES.map(({ key, label, index }) => ({ key, label, index })),
      source: "fallback",
    });
  }

  const available: Array<{ key: string; label: string; index: number }> = [];
  for (const item of CANDIDATES) {
    try {
      const res = await fetch(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: serviceRole,
          authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({
          prefix: `${item.folder}/`,
          limit: 1,
          offset: 0,
        }),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const payload = (await res.json()) as Array<{ name?: string }> | { error?: string };
      if (Array.isArray(payload) && payload.length > 0) {
        available.push({ key: item.key, label: item.label, index: item.index });
      }
    } catch {
      // Ignore this candidate.
    }
  }

  return NextResponse.json({
    categories: available.length > 0 ? available : CANDIDATES.map(({ key, label, index }) => ({ key, label, index })),
    source: available.length > 0 ? "supabase" : "fallback",
  });
}
