export interface AdRequest {
  userId: string;
  ageBucket: number;
  interests: number[];
  locationId: number;
  locationStr: string;
  ageGroup: string;
  device: number;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
}

export interface AdCreative {
  templateId: number;
  templateSlug: string;
  brand: string;
  category: string;
  logoUrl: string;
  backgroundUrl: string;
  overlayUrl: string;
  copyText: string;
  cta: string;
  colorScheme: ColorScheme;
  score: number;
  ucbCtr?: number;
}

export interface LatencyBreakdown {
  totalMs: number;
  networkTransitMs: number;
  edgeServingMs: number;
  kvCacheHit: boolean;
  goDecisionMs: number;
  tritonMs: number;
  workersAiMs: number;
}

export interface AdResponse {
  creative: AdCreative;
  latency: LatencyBreakdown;
  servedFrom: string;
  cacheStatus: "HIT" | "MISS";
}

export interface Env {
  CREATIVE_CACHE: KVNamespace;
  AI: Ai;
  FLY_IAD_URL: string;
  FLY_SJC_URL: string;
  CACHE_TTL_SECONDS: string;
  MIN_CACHE_UCB_CTR?: string;
}
