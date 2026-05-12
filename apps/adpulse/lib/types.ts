export type Brand = {
  id: string;
  name: string;
  logo_url?: string | null;
  color_primary: string;
  color_secondary: string;
  tone: string;
  industry?: string | null;
  target_interests?: string[] | null;
  target_age_min: number;
  target_age_max: number;
  created_at: string;
};

export type Campaign = {
  id: string;
  brand_id: string;
  name: string;
  objective: string;
  status: string;
  budget?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  campaign_id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  key_benefits?: string[] | null;
  created_at: string;
};

export type Creative = {
  id: string;
  product_id: string;
  campaign_id: string;
  headline?: string | null;
  subheadline?: string | null;
  cta?: string | null;
  angle?: string | null;
  layout?: string | null;
  background_color?: string | null;
  assembled_image_url?: string | null;
  status: string;
  rejection_note?: string | null;
  impressions: number;
  clicks: number;
  mab_weight: string | number;
  created_at: string;
};
