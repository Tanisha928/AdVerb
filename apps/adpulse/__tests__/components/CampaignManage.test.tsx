import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignManage } from "@/app/campaigns/[id]/CampaignManage";
import type { Campaign, Creative, Product } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
  __esModule: true,
}));

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}));

const mockCampaign: Campaign = {
  id: "camp-001",
  brand_id: "brand-001",
  name: "Summer Sale",
  objective: "clicks",
  status: "draft",
  budget: null,
  start_date: null,
  end_date: null,
  created_at: "2026-05-01T00:00:00Z",
};

const mockProduct: Product = {
  id: "prod-001",
  campaign_id: "camp-001",
  name: "Premium Coffee",
  description: "The best coffee you'll ever taste",
  image_url: null,
  key_benefits: ["Rich flavor", "Fair trade", "Organic"],
  created_at: "2026-05-01T00:00:00Z",
};

const pendingCreative: Creative = {
  id: "cr-001",
  product_id: "prod-001",
  campaign_id: "camp-001",
  headline: "Start Your Day Right",
  subheadline: "Premium organic coffee",
  cta: "Buy Now",
  angle: "benefit",
  layout: "hero",
  background_color: "#4f46e5",
  assembled_image_url: null,
  status: "pending",
  rejection_note: null,
  impressions: 0,
  clicks: 0,
  mab_weight: "0.2500",
  created_at: "2026-05-01T00:00:00Z",
};

const approvedCreative = (id: string): Creative => ({
  ...pendingCreative,
  id,
  status: "approved",
});

describe("CampaignManage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders campaign name and status badge", () => {
    render(
      <CampaignManage
        initialCampaign={mockCampaign}
        initialProducts={[]}
        initialCreatives={[]}
      />
    );
    expect(screen.getByText("Summer Sale")).toBeInTheDocument();
    // "draft" appears in both the StatusBadge and the workflow step label
    expect(screen.getAllByText("draft").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all 4 workflow steps", () => {
    render(
      <CampaignManage
        initialCampaign={mockCampaign}
        initialProducts={[]}
        initialCreatives={[]}
      />
    );
    // "draft" appears in StatusBadge + workflow step; others appear once each
    expect(screen.getAllByText("draft").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("generating")).toBeInTheDocument();
    expect(screen.getByText("review")).toBeInTheDocument();
    expect(screen.getByText("live")).toBeInTheDocument();
  });

  it("shows 'Add products to enable creative generation' when no products", () => {
    render(
      <CampaignManage
        initialCampaign={mockCampaign}
        initialProducts={[]}
        initialCreatives={[]}
      />
    );
    expect(screen.getByText("Add products to enable creative generation.")).toBeInTheDocument();
  });

  it("renders product cards when products are present", () => {
    render(
      <CampaignManage
        initialCampaign={mockCampaign}
        initialProducts={[mockProduct]}
        initialCreatives={[]}
      />
    );
    // "Premium Coffee" appears in both the product card <p> and the <select> option
    expect(screen.getAllByText("Premium Coffee").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("The best coffee you'll ever taste")).toBeInTheDocument();
  });

  it("renders key benefits as tags", () => {
    render(
      <CampaignManage
        initialCampaign={mockCampaign}
        initialProducts={[mockProduct]}
        initialCreatives={[]}
      />
    );
    expect(screen.getByText("Rich flavor")).toBeInTheDocument();
    expect(screen.getByText("Fair trade")).toBeInTheDocument();
    expect(screen.getByText("Organic")).toBeInTheDocument();
  });

  it("Launch campaign button is disabled when no products", () => {
    render(
      <CampaignManage
        initialCampaign={mockCampaign}
        initialProducts={[]}
        initialCreatives={[]}
      />
    );
    const launchBtn = screen.getByRole("button", { name: "Launch campaign" });
    expect(launchBtn).toBeDisabled();
  });

  it("Launch campaign button is disabled when fewer than 2 approved creatives per product", () => {
    render(
      <CampaignManage
        initialCampaign={mockCampaign}
        initialProducts={[mockProduct]}
        initialCreatives={[pendingCreative]}
      />
    );
    const launchBtn = screen.getByRole("button", { name: "Launch campaign" });
    expect(launchBtn).toBeDisabled();
  });

  it("Launch campaign button is enabled when ≥2 approved creatives per product", () => {
    render(
      <CampaignManage
        initialCampaign={mockCampaign}
        initialProducts={[mockProduct]}
        initialCreatives={[approvedCreative("cr-1"), approvedCreative("cr-2")]}
      />
    );
    const launchBtn = screen.getByRole("button", { name: "Launch campaign" });
    expect(launchBtn).not.toBeDisabled();
  });

  it("calls apiPatch with status=live when Launch campaign is clicked", async () => {
    const { apiPatch, apiGet } = await import("@/lib/api");
    vi.mocked(apiPatch).mockResolvedValue({ ...mockCampaign, status: "live" });
    // refresh() calls apiGet three times: campaign, products, creatives
    vi.mocked(apiGet)
      .mockResolvedValueOnce({ ...mockCampaign, status: "live" } as never)
      .mockResolvedValueOnce([mockProduct] as never)
      .mockResolvedValueOnce([approvedCreative("cr-1"), approvedCreative("cr-2")] as never);

    render(
      <CampaignManage
        initialCampaign={mockCampaign}
        initialProducts={[mockProduct]}
        initialCreatives={[approvedCreative("cr-1"), approvedCreative("cr-2")]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Launch campaign" }));

    await waitFor(() => {
      expect(apiPatch).toHaveBeenCalledWith(
        `/campaigns/camp-001/status`,
        { status: "live" }
      );
    });
  });

  it("shows product dropdown when products are present", () => {
    render(
      <CampaignManage
        initialCampaign={mockCampaign}
        initialProducts={[mockProduct]}
        initialCreatives={[]}
      />
    );
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Premium Coffee" })).toBeInTheDocument();
  });

  it("calls apiPost to generate-creatives when Generate button is clicked", async () => {
    const { apiPost, apiGet } = await import("@/lib/api");
    vi.mocked(apiPost).mockResolvedValue([] as never);
    // refresh() calls apiGet three times: campaign, products, creatives
    vi.mocked(apiGet)
      .mockResolvedValueOnce({ ...mockCampaign, status: "review" } as never)
      .mockResolvedValueOnce([mockProduct] as never)
      .mockResolvedValueOnce([] as never);

    render(
      <CampaignManage
        initialCampaign={mockCampaign}
        initialProducts={[mockProduct]}
        initialCreatives={[]}
      />
    );

    const generateBtns = screen.getAllByRole("button", { name: /Generate creatives/ });
    fireEvent.click(generateBtns[0]);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        `/campaigns/camp-001/generate-creatives`,
        { product_id: "prod-001" }
      );
    });
  });

  it("shows generating state on the button during generation", async () => {
    const { apiPost, apiGet } = await import("@/lib/api");
    let resolvePost!: (v: unknown) => void;
    vi.mocked(apiPost).mockReturnValue(new Promise((res) => { resolvePost = res; }) as never);
    // refresh() calls apiGet 3 times: campaign, products (array), creatives (array)
    vi.mocked(apiGet)
      .mockResolvedValueOnce({ ...mockCampaign, status: "review" } as never)
      .mockResolvedValueOnce([mockProduct] as never)
      .mockResolvedValueOnce([] as never);

    render(
      <CampaignManage
        initialCampaign={mockCampaign}
        initialProducts={[mockProduct]}
        initialCreatives={[]}
      />
    );

    const topGenerateBtn = screen.getByRole("button", { name: "Generate creatives" });
    fireEvent.click(topGenerateBtn);

    await waitFor(() => {
      // After clicking, the top button label switches to Generating… while apiPost is pending
      const buttons = screen.getAllByRole("button");
      const generatingBtn = buttons.find((b) => b.textContent === "Generating\u2026");
      expect(generatingBtn).toBeDefined();
    });

    // Resolve the post so the async chain completes cleanly (no uncaught exceptions)
    resolvePost([]);
    await waitFor(() => {
      expect(screen.getAllByRole("button").some((b) => b.textContent !== "Generating\u2026")).toBe(true);
    });
  });
});
