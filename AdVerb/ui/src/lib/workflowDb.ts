import type {
  AppUser,
  Brand,
  Campaign,
  CampaignStatus,
  CreativeVariant,
  FatigueAlert,
  RecommendationEvent,
  ReviewStatus,
  WorkflowDb,
} from "./workflowTypes";

import { generatePersonalizedImages } from "./aiImageGenerator";
import type { AdRequest } from "./types";

const DEFAULT_PREVIEW =
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&auto=format&fit=crop&q=80";

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function aiCategoryFromCampaign(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("shoe") || c.includes("footwear") || c.includes("sneaker")) return "shoes";
  if (c.includes("shirt") || c.includes("apparel") || c.includes("t-shirt")) return "apparel";
  if (c.includes("handbag") || c.includes("bag")) return "apparel";
  if (c.includes("earring") || c.includes("jewelry")) return "wearable";
  return c.replace(/\s+/g, "-");
}

function seedCreatives(campaign: Campaign, brandName: string): CreativeVariant[] {
  const aiCategory = aiCategoryFromCampaign(campaign.category);
  const reqBase: Omit<AdRequest, "imageVariantNonce" | "imageFeedback"> = {
    userId: `workflow_${campaign.id}`,
    ageBucket: 1,
    interests: Array(12).fill(0),
    locationId: 0,
    locationStr: "New York",
    ageGroup: "25-34",
    device: 1,
  };

  return ["hero-a", "hero-b", "hero-c"].map((variantKey, idx) => {
    const imageVariantNonce = `seed_${variantKey}_${campaign.id}`;
    const generated = generatePersonalizedImages({
      req: {
        ...reqBase,
        imageVariantNonce,
      } as AdRequest,
      brand: brandName,
      category: aiCategory,
      templateSlug: variantKey,
    });

    return {
      id: id("creative"),
      campaignId: campaign.id,
      variantKey,
      // We store background + overlay for UI composition. Preview falls back to overlay.
      backgroundUrl: generated.backgroundUrl,
      overlayUrl: generated.overlayUrl,
      previewImageUrl: generated.overlayUrl || DEFAULT_PREVIEW,
      generationStatus: "generated",
      reviewStatus: idx === 0 ? "approved" : "pending",
      embeddingDetails: idx === 2 ? undefined : `Similarity ${0.91 - idx * 0.06}`,
      // Remove dummy analytics (show 0 until shopper interactions happen).
      impressions: 0,
      clicks: 0,
    };
  });
}

function seedDb(): WorkflowDb {
  const owner: AppUser = {
    id: "owner_demo",
    role: "brand_owner",
    fullName: "Brand Manager",
    email: "owner@adverb.demo",
    password: "demo123",
    profile: { company: "AdVerb Sports", stylePrefs: "Minimal and premium" },
  };

  const shopper: AppUser = {
    id: "shopper_demo",
    role: "shopper",
    fullName: "Demo Shopper",
    email: "shopper@adverb.demo",
    password: "demo123",
    profile: { interests: ["running", "streetwear"] },
  };

  const brand: Brand = {
    id: "brand_demo",
    ownerId: owner.id,
    name: "StrideX",
    slug: "stridex",
    settings: "Lifestyle + performance tone",
  };

  const campaign: Campaign = {
    id: "camp_demo",
    brandId: brand.id,
    name: "Spring Running Drop",
    status: "running",
    startDate: "2026-05-01",
    endDate: "2026-06-30",
    category: "Footwear",
    subcategory: "Running Shoes",
    targetAgeRange: "18-34",
    targetNotes: "Urban athletes and weekend runners",
    logoUrl: "https://dummyimage.com/240x80/0f172a/ffffff.png&text=StrideX",
    productImageUrl: DEFAULT_PREVIEW,
  };

  const creatives = seedCreatives(campaign, brand.name);
  const recommendations: RecommendationEvent[] = creatives.map((c, idx) => ({
    id: id("rec"),
    campaignId: campaign.id,
    creativeId: c.id,
    createdAt: new Date(Date.now() - idx * 3600_000).toISOString(),
    reason: idx === 0 ? "Top CTR over last 24h" : "Exploration for diversity",
  }));
  const fatigueAlerts: FatigueAlert[] = [];

  return {
    users: [owner, shopper],
    brands: [brand],
    campaigns: [campaign],
    creatives,
    recommendations,
    fatigueAlerts,
    sessions: {},
  };
}

declare global {
  var __adverbWorkflowDb: WorkflowDb | undefined;
}

export function getDb(): WorkflowDb {
  if (!global.__adverbWorkflowDb) global.__adverbWorkflowDb = seedDb();
  return global.__adverbWorkflowDb;
}

export function getUserBySession(token?: string): AppUser | null {
  if (!token) return null;
  const db = getDb();
  const userId = db.sessions[token];
  return db.users.find((u) => u.id === userId) ?? null;
}

export function createSession(userId: string): string {
  const db = getDb();
  const token = id("sess");
  db.sessions[token] = userId;
  return token;
}

export function destroySession(token?: string): void {
  if (!token) return;
  const db = getDb();
  delete db.sessions[token];
}

export function updateCampaignStatus(campaignId: string, status: CampaignStatus): Campaign | null {
  const db = getDb();
  const campaign = db.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return null;
  campaign.status = status;
  return campaign;
}

export function setCreativeReview(creativeId: string, reviewStatus: ReviewStatus): CreativeVariant | null {
  const db = getDb();
  const creative = db.creatives.find((c) => c.id === creativeId);
  if (!creative) return null;
  creative.reviewStatus = reviewStatus;
  return creative;
}

export function generateCreatives(campaignId: string): CreativeVariant[] {
  const db = getDb();
  const campaign = db.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return [];
  const brand = db.brands.find((b) => b.id === campaign.brandId);
  db.creatives = db.creatives
    .filter((c) => c.campaignId !== campaignId)
    .concat(seedCreatives(campaign, brand?.name ?? "Brand"));
  return db.creatives.filter((c) => c.campaignId === campaignId);
}
