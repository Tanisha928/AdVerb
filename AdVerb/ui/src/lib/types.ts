export interface AdRequest {
  userId: string;
  ageBucket: number;
  interests: number[];
  locationId: number;
  locationStr: string;
  ageGroup: string;
  device: number;
  shoppingOccasion?: "Treating myself" | "Buying a gift" | "Just browsing" | "Ready to buy";
  imageFeedback?: string;
  imageRebuildMode?: "refresh" | "rebuild";
  imageVariantNonce?: string;
}

export interface AdCreative {
  variantId: string;
  templateId: number;
  templateSlug: string;
  brand: string;
  category: string;
  overlayKey?: string;
  logoUrl: string;
  backgroundUrl: string;
  overlayUrl: string;
  copyText: string;
  cta: string;
  colorScheme: {
    primary: string;
    secondary: string;
  };
  score: number;
  ucbCtr?: number;
}

export interface AdResponse {
  creative: AdCreative;
  variants: AdCreative[];
  servedFrom: string;
  cacheStatus: "HIT" | "MISS";
  latency: {
    totalMs: number;
    networkTransitMs: number;
    edgeServingMs: number;
    kvCacheHit: boolean;
    goDecisionMs: number;
    tritonMs: number;
    workersAiMs: number;
    copyFromCache?: boolean;
    faissCacheHit?: boolean;
    faissSearchMs?: number;
  };
  imageGeneration?: {
    mode: "initial" | "refresh" | "rebuild";
    feedbackApplied: boolean;
  };
}

export interface SimulateVariant {
  variantId: string;
  templateSlug: string;
  brand: string;
  category: string;
  overlayKey: string;
  overlayUrl: string;
  backgroundUrl: string;
  logoUrl: string;
  copyText: string;
  cta: string;
  colorScheme: { primary: string; secondary: string };
  ageGroup: string;
  interest: string;
}
