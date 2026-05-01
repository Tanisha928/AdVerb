export type UserRole = "brand_owner" | "shopper";

export type CampaignStatus = "planned" | "running" | "paused" | "ended";
export type GenerationStatus = "queued" | "generated" | "failed";
export type ReviewStatus = "pending" | "approved" | "rejected";

export type AppUser = {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  password: string;
  profile: {
    company?: string;
    bio?: string;
    stylePrefs?: string;
    interests?: string[];
  };
};

export type Brand = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  settings?: string;
};

export type Campaign = {
  id: string;
  brandId: string;
  name: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  category: string;
  subcategory: string;
  targetAgeRange: string;
  targetNotes: string;
  logoUrl?: string;
  productImageUrl?: string;
};

export type CreativeVariant = {
  id: string;
  campaignId: string;
  variantKey: string;
  previewImageUrl: string;
  backgroundUrl?: string;
  overlayUrl?: string;
  generationStatus: GenerationStatus;
  reviewStatus: ReviewStatus;
  embeddingDetails?: string;
  impressions: number;
  clicks: number;
};

export type RecommendationEvent = {
  id: string;
  campaignId: string;
  creativeId: string;
  createdAt: string;
  reason: string;
};

export type FatigueAlert = {
  campaignId: string;
  creativeId: string;
  severity: "low" | "medium" | "high";
  message: string;
};

export type WorkflowDb = {
  users: AppUser[];
  brands: Brand[];
  campaigns: Campaign[];
  creatives: CreativeVariant[];
  recommendations: RecommendationEvent[];
  fatigueAlerts: FatigueAlert[];
  sessions: Record<string, string>;
};
