export const adServing = () => process.env.NEXT_PUBLIC_AD_SERVING_URL || "http://localhost:8001";

export type ServedAd = {
  id: string;
  campaign_id: string;
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  assembled_image_url?: string | null;
  product_image_url?: string | null;
  background_color?: string | null;
  layout?: string | null;
  brand_name?: string | null;
  brand_logo_url?: string | null;
  color_primary?: string | null;
};

export async function fetchFeed(userId: string): Promise<ServedAd[]> {
  const res = await fetch(`${adServing()}/user/${userId}/feed`, { cache: "no-store" });
  if (!res.ok) throw new Error("feed failed");
  return res.json();
}

export async function trackClick(userId: string, creativeId: string, campaignId: string) {
  await fetch(`${adServing()}/track-click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, creative_id: creativeId, campaign_id: campaignId }),
  });
}
