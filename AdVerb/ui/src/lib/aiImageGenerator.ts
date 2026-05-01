import { INTEREST_LABELS } from "./interests";
import type { AdRequest } from "./types";

type GeneratedCreativeImages = {
  backgroundUrl: string;
  logoUrl: string;
  overlayUrl: string;
};

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function selectPalette(category: string, seed: number): { start: string; end: string; accent: string; ink: string } {
  const categoryPalettes: Record<string, Array<{ start: string; end: string; accent: string; ink: string }>> = {
    shoes: [
      { start: "#1d4ed8", end: "#38bdf8", accent: "#facc15", ink: "#0f172a" },
      { start: "#7c3aed", end: "#60a5fa", accent: "#f59e0b", ink: "#111827" },
    ],
    nutrition: [
      { start: "#15803d", end: "#4ade80", accent: "#f59e0b", ink: "#052e16" },
      { start: "#0891b2", end: "#22d3ee", accent: "#fb7185", ink: "#083344" },
    ],
    wearable: [
      { start: "#0f172a", end: "#334155", accent: "#22d3ee", ink: "#e2e8f0" },
      { start: "#312e81", end: "#4f46e5", accent: "#67e8f9", ink: "#eef2ff" },
    ],
    yoga: [
      { start: "#6d28d9", end: "#c084fc", accent: "#f472b6", ink: "#faf5ff" },
      { start: "#0f766e", end: "#2dd4bf", accent: "#f0abfc", ink: "#f0fdfa" },
    ],
    cycling: [
      { start: "#0f766e", end: "#06b6d4", accent: "#f97316", ink: "#042f2e" },
      { start: "#1e3a8a", end: "#3b82f6", accent: "#fb923c", ink: "#eff6ff" },
    ],
    apparel: [
      { start: "#4b5563", end: "#94a3b8", accent: "#f472b6", ink: "#111827" },
      { start: "#7f1d1d", end: "#ef4444", accent: "#fcd34d", ink: "#fef2f2" },
    ],
  };

  const options = categoryPalettes[category.toLowerCase()] ?? [
    { start: "#1e293b", end: "#64748b", accent: "#22d3ee", ink: "#f8fafc" },
    { start: "#4c1d95", end: "#a78bfa", accent: "#f97316", ink: "#f5f3ff" },
  ];
  return options[seed % options.length];
}

function primaryInterest(interests: number[]): string {
  let idx = 0;
  let max = interests[0] ?? 0;
  for (let i = 1; i < interests.length; i++) {
    if (interests[i] > max) {
      max = interests[i];
      idx = i;
    }
  }
  if (max <= 0) return "Active Lifestyle";
  return INTEREST_LABELS[idx] ?? "Active Lifestyle";
}

function inferVisualTone(feedback?: string): "vibrant" | "minimal" | "premium" {
  if (!feedback) return "vibrant";
  const normalized = feedback.toLowerCase();
  if (normalized.includes("minimal") || normalized.includes("clean") || normalized.includes("simple")) {
    return "minimal";
  }
  if (normalized.includes("premium") || normalized.includes("luxury") || normalized.includes("elegant")) {
    return "premium";
  }
  return "vibrant";
}

function buildPhotoQuery(category: string, interest: string, feedback?: string): string {
  const chunks = [category, interest, feedback ?? "", "product", "commercial", "studio lighting", "advertising"];
  return chunks
    .join(" ")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function generatePersonalizedImages(input: {
  req: AdRequest;
  brand: string;
  category: string;
  templateSlug: string;
}): GeneratedCreativeImages {
  const seed = hashSeed(`${input.req.userId}:${input.templateSlug}:${input.brand}:${input.req.imageVariantNonce ?? ""}`);
  const basePalette = selectPalette(input.category, seed);
  const interest = primaryInterest(input.req.interests);
  const tone = inferVisualTone(input.req.imageFeedback);

  const palette =
    tone === "minimal"
      ? { start: "#0f172a", end: "#334155", accent: "#e2e8f0", ink: "#f8fafc" }
      : tone === "premium"
        ? { start: "#3f2a1d", end: "#8b5e34", accent: "#facc15", ink: "#fff7ed" }
        : basePalette;

  const photoQuery = encodeURIComponent(buildPhotoQuery(input.category, interest, input.req.imageFeedback));

  const bgSeed = encodeURIComponent(`${photoQuery}-${seed}`);
  const overlaySeed = encodeURIComponent(`${photoQuery}-packshot-${seed + 17}`);
  const backgroundUrl = `https://picsum.photos/seed/${bgSeed}/1600/700`;

  const logoUrl = svgDataUri(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 140'>
      <defs><linearGradient id='lg' x1='0' x2='1'><stop stop-color='${palette.start}'/><stop offset='1' stop-color='${palette.end}'/></linearGradient></defs>
      <rect width='140' height='140' rx='30' fill='url(#lg)'/>
      <circle cx='70' cy='70' r='34' fill='white' opacity='.2'/>
      <text x='70' y='84' text-anchor='middle' font-family='Inter, Arial, sans-serif' font-size='42' font-weight='700' fill='white'>${input.brand[0] ?? "A"}</text>
    </svg>`,
  );

  const overlayUrl = `https://picsum.photos/seed/${overlaySeed}/640/640`;

  return {
    backgroundUrl,
    logoUrl,
    overlayUrl,
  };
}
