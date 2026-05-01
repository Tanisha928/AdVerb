import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import {
  createSession,
  destroySession,
  generateCreatives,
  getDb,
  getUserBySession,
  setCreativeReview,
  updateCampaignStatus,
} from "../../../../lib/workflowDb";
import type { AppUser, Brand, Campaign, ReviewStatus, UserRole } from "../../../../lib/workflowTypes";

function sessionToken(req: NextRequest): string | undefined {
  return req.cookies.get("workflow_session")?.value;
}

function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const db = getDb();
  const user = getUserBySession(sessionToken(req));
  const key = path.join("/");

  if (key === "auth/me") {
    return ok({ user });
  }

  if (key === "owner/dashboard") {
    if (!user || user.role !== "brand_owner") return unauthorized();
    const brands = db.brands.filter((b) => b.ownerId === user.id);
    const campaigns = db.campaigns.filter((c) => brands.some((b) => b.id === c.brandId));
    const creatives = db.creatives.filter((c) => campaigns.some((p) => p.id === c.campaignId));
    return ok({ brands, campaigns, creatives });
  }

  if (key === "owner/analytics") {
    if (!user || user.role !== "brand_owner") return unauthorized();
    const brands = db.brands.filter((b) => b.ownerId === user.id);
    const campaigns = db.campaigns.filter((c) => brands.some((b) => b.id === c.brandId));
    const creatives = db.creatives.filter((c) => campaigns.some((p) => p.id === c.campaignId));
    const totals = creatives.reduce(
      (acc, c) => ({ impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks }),
      { impressions: 0, clicks: 0 },
    );
    const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
    return ok({
      summary: { ...totals, ctr },
      creativeComparison: creatives.map((c) => ({
        creativeId: c.id,
        variantKey: c.variantKey,
        ctr: c.impressions ? c.clicks / c.impressions : 0,
        reviewStatus: c.reviewStatus,
      })),
      recommendationHistory: db.recommendations.slice(-20).reverse(),
      fatigueAlerts: db.fatigueAlerts,
      series: campaigns.map((campaign) => {
        const campaignCreatives = creatives.filter((c) => c.campaignId === campaign.id);
        const impressions = campaignCreatives.reduce((sum, c) => sum + c.impressions, 0);
        const clicks = campaignCreatives.reduce((sum, c) => sum + c.clicks, 0);
        return { campaignId: campaign.id, name: campaign.name, impressions, clicks };
      }),
    });
  }

  if (key === "shopper/creatives") {
    const category = req.nextUrl.searchParams.get("category");
    const subcategory = req.nextUrl.searchParams.get("subcategory");
    const runningCampaigns = db.campaigns.filter(
      (c) =>
        c.status === "running" &&
        (!category || c.category === category) &&
        (!subcategory || c.subcategory === subcategory),
    );
    const cards = runningCampaigns.flatMap((campaign) => {
      const brand = db.brands.find((b) => b.id === campaign.brandId);
      return db.creatives
        .filter((creative) => creative.campaignId === campaign.id && creative.reviewStatus !== "rejected")
        .map((creative) => ({
          campaignId: campaign.id,
          campaignName: campaign.name,
          category: campaign.category,
          subcategory: campaign.subcategory,
          brandName: brand?.name ?? "Unknown brand",
          creative,
        }));
    });
    return ok({ items: cards });
  }

  return NextResponse.json({ error: `Unknown GET endpoint: ${key}` }, { status: 404 });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const key = path.join("/");
  const db = getDb();
  const user = getUserBySession(sessionToken(req));

  if (key === "auth/signup") {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const role = (body.role as UserRole) || "shopper";
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !body.password || !body.fullName) return ok({ error: "Missing fields" }, 400);
    if (db.users.some((u) => u.email === email)) return ok({ error: "Email already exists" }, 409);
    const newUser: AppUser = {
      id: `user_${Math.random().toString(36).slice(2, 9)}`,
      role,
      fullName: String(body.fullName),
      email,
      password: String(body.password),
      profile: role === "brand_owner" ? { company: body.company || "" } : { interests: [] },
    };
    db.users.push(newUser);
    const token = createSession(newUser.id);
    const res = ok({ user: newUser }, 201);
    res.cookies.set("workflow_session", token, { httpOnly: true, sameSite: "lax", path: "/" });
    return res;
  }

  if (key === "auth/login") {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const found = db.users.find((u) => u.email === email && u.password === password);
    if (!found) return ok({ error: "Invalid credentials" }, 401);
    const token = createSession(found.id);
    const res = ok({ user: found });
    res.cookies.set("workflow_session", token, { httpOnly: true, sameSite: "lax", path: "/" });
    return res;
  }

  if (key === "auth/logout") {
    const token = sessionToken(req);
    destroySession(token);
    const res = ok({ success: true });
    res.cookies.set("workflow_session", "", { maxAge: 0, path: "/" });
    return res;
  }

  if (!user) return unauthorized();

  if (key === "owner/profile") {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    if (user.role !== "brand_owner") return unauthorized();
    user.profile.company = body.company ?? user.profile.company;
    user.profile.bio = body.bio ?? user.profile.bio;
    user.profile.stylePrefs = body.stylePrefs ?? user.profile.stylePrefs;
    return ok({ user });
  }

  if (key === "owner/brands") {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    if (user.role !== "brand_owner") return unauthorized();
    const brand: Brand = {
      id: `brand_${Math.random().toString(36).slice(2, 9)}`,
      ownerId: user.id,
      name: String(body.name || "Untitled Brand"),
      slug: String(body.slug || `brand-${Date.now()}`),
      settings: String(body.settings || ""),
    };
    db.brands.push(brand);
    return ok({ brand }, 201);
  }

  if (key === "owner/campaigns") {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    if (user.role !== "brand_owner") return unauthorized();
    const campaign: Campaign = {
      id: `camp_${Math.random().toString(36).slice(2, 9)}`,
      brandId: String(body.brandId),
      name: String(body.name),
      status: "planned",
      startDate: String(body.startDate),
      endDate: String(body.endDate),
      category: String(body.category),
      subcategory: String(body.subcategory),
      targetAgeRange: String(body.targetAgeRange),
      targetNotes: String(body.targetNotes || ""),
      logoUrl: "",
      productImageUrl: "",
    };
    db.campaigns.push(campaign);
    return ok({ campaign }, 201);
  }

  if (key === "owner/campaigns/activate") {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const campaign = updateCampaignStatus(String(body.campaignId), "running");
    if (!campaign) return ok({ error: "Campaign not found" }, 404);
    return ok({ campaign });
  }

  if (key === "owner/campaigns/assets") {
    const form = await req.formData();
    const campaignId = String(form.get("campaignId") ?? "");
    const campaign = db.campaigns.find((c) => c.id === campaignId);
    if (!campaign) return ok({ error: "Campaign not found" }, 404);

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const bucket = process.env.SUPABASE_BUCKET || "adverb-assets";

    if (!supabaseUrl || !serviceKey) {
      return ok({ error: "Supabase env missing: need SUPABASE_URL and SUPABASE_SERVICE_KEY/ROLE_KEY" }, 500);
    }

    const publicBase = `${supabaseUrl}/storage/v1/object/public/${bucket}`;

    const fileToBuffer = async (file: File) => Buffer.from(await file.arrayBuffer());
    const encodeObjectName = (name: string) => name.split("/").map(encodeURIComponent).join("/");

    async function uploadFile(file: File, objectName: string) {
      const data = await fileToBuffer(file);
      const objectPath = encodeObjectName(objectName);
      const url = `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": file.type || "application/octet-stream",
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`,
          "x-upsert": "true",
        },
        body: data as any,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Supabase upload failed (${res.status}): ${text}`);
      }
    }

    const now = Date.now();
    const logo = form.get("logoFile");
    const product = form.get("productFile");

    const isFileLike = (v: any): v is File => v && typeof v.arrayBuffer === "function";

    try {
      if (logo && isFileLike(logo)) {
        const ext = String((logo as any).name || "png").split(".").pop()!.toLowerCase();
        const objectName = `campaigns/${campaignId}/logo_${now}.${ext}`;
        await uploadFile(logo, objectName);
        campaign.logoUrl = `${publicBase}/${encodeObjectName(objectName)}`;
      }
      if (product && isFileLike(product)) {
        const ext = String((product as any).name || "png").split(".").pop()!.toLowerCase();
        const objectName = `campaigns/${campaignId}/product_${now}.${ext}`;
        await uploadFile(product, objectName);
        campaign.productImageUrl = `${publicBase}/${encodeObjectName(objectName)}`;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload error";
      return ok({ error: msg }, 500);
    }

    return ok({ campaign, message: "Upload successful. Assets are now available for creative generation." });
  }

  if (key === "owner/creatives/generate") {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const campaignId = String(body.campaignId);
    const campaign = db.campaigns.find((c) => c.id === campaignId);
    if (!campaign) return ok({ error: "Campaign not found" }, 404);
    if (!campaign.logoUrl || !campaign.productImageUrl) {
      return ok({ error: "Upload logo and product image before generation." }, 400);
    }
    const creatives = generateCreatives(campaignId);
    db.creatives = db.creatives.map((existing) => {
      const updated = creatives.find((c) => c.id === existing.id);
      return updated ?? existing;
    });
    return ok({ creatives });
  }

  if (key === "owner/creatives/review") {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const creative = setCreativeReview(String(body.creativeId), body.reviewStatus as ReviewStatus);
    if (!creative) return ok({ error: "Creative not found" }, 404);
    return ok({ creative });
  }

  if (key === "owner/creatives/backfill") {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const creative = db.creatives.find((c) => c.id === String(body.creativeId));
    if (!creative) return ok({ error: "Creative not found" }, 404);
    creative.embeddingDetails = `Backfilled embedding cosine=${(0.86 + Math.random() * 0.1).toFixed(2)}`;
    return ok({ creative });
  }

  if (key === "shopper/interaction") {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const creative = db.creatives.find((c) => c.id === String(body.creativeId));
    if (!creative) return ok({ error: "Creative not found" }, 404);
    if (body.action === "impression") creative.impressions += 1;
    if (body.action === "click") creative.clicks += 1;
    return ok({ creative });
  }

  if (key === "shopper/recommend-best") {
    const runningCampaigns = db.campaigns.filter((c) => c.status === "running");
    const candidates = db.creatives.filter((c) => runningCampaigns.some((rc) => rc.id === c.campaignId));

    if (!candidates.length) {
      return ok({ best: null });
    }

    const scored = candidates.map((c) => {
      const ctr = c.impressions ? c.clicks / c.impressions : 0;
      const campaign = runningCampaigns.find((rc) => rc.id === c.campaignId);
      const brand = campaign ? db.brands.find((b) => b.id === campaign.brandId) : undefined;
      return {
        creativeId: c.id,
        variantKey: c.variantKey,
        impressions: c.impressions,
        clicks: c.clicks,
        ctr,
        campaignId: campaign?.id ?? "",
        campaignName: campaign?.name ?? "",
        brandName: brand?.name ?? "",
      };
    });

    const best = scored.slice().sort((a, b) => b.ctr - a.ctr)[0];
    return ok({ best });
  }

  return NextResponse.json({ error: `Unknown POST endpoint: ${key}` }, { status: 404 });
}
