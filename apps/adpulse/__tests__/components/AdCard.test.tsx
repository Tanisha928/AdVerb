import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdCard } from "@/components/AdCard";
import type { ServedAd } from "@/lib/ad";

vi.mock("@/lib/ad", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ad")>();
  return {
    ...actual,
    trackClick: vi.fn().mockResolvedValue(undefined),
  };
});

const baseAd: ServedAd = {
  id: "creative-001",
  campaign_id: "campaign-001",
  headline: "Boost Your Morning",
  subheadline: "Premium coffee for the modern professional",
  cta: "Shop Now",
  assembled_image_url: null,
  product_image_url: null,
  background_color: "#1e3a5f",
  layout: "hero",
  brand_name: "BrewCo",
  brand_logo_url: null,
  color_primary: "#4f46e5",
};

describe("AdCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders headline and subheadline", () => {
    render(<AdCard ad={baseAd} userId="user-001" category="coffee" />);
    // headline appears in both the no-image overlay and the text card area
    const headlines = screen.getAllByText("Boost Your Morning");
    expect(headlines.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Premium coffee for the modern professional")).toBeInTheDocument();
  });

  it("renders CTA button with ad text", () => {
    render(<AdCard ad={baseAd} userId="user-001" category="coffee" />);
    expect(screen.getByRole("button", { name: "Shop Now" })).toBeInTheDocument();
  });

  it("falls back to 'Learn more' when cta is null", () => {
    render(<AdCard ad={{ ...baseAd, cta: null }} userId="user-001" category="coffee" />);
    expect(screen.getByRole("button", { name: "Learn more" })).toBeInTheDocument();
  });

  it("shows category label in the image area", () => {
    render(<AdCard ad={baseAd} userId="user-001" category="coffee" />);
    expect(screen.getByText("coffee")).toBeInTheDocument();
  });

  it("shows brand initials when no logo_url", () => {
    render(<AdCard ad={baseAd} userId="user-001" category="tech" />);
    expect(screen.getByText("BR")).toBeInTheDocument();
  });

  it("shows brand logo image when logo_url is provided", () => {
    const adWithLogo = { ...baseAd, brand_logo_url: "https://example.com/logo.png" };
    const { container } = render(<AdCard ad={adWithLogo} userId="user-001" category="tech" />);
    // Images use alt="" so they have role="presentation"; query directly from DOM
    const img = container.querySelector<HTMLImageElement>('img[src="https://example.com/logo.png"]');
    expect(img).not.toBeNull();
  });

  it("shows product image when assembled_image_url is provided", () => {
    const adWithImg = { ...baseAd, assembled_image_url: "https://example.com/ad.jpg" };
    const { container } = render(<AdCard ad={adWithImg} userId="user-001" category="tech" />);
    const img = container.querySelector<HTMLImageElement>('img[src="https://example.com/ad.jpg"]');
    expect(img).not.toBeNull();
  });

  it("CTA button is enabled initially", () => {
    render(<AdCard ad={baseAd} userId="user-001" category="coffee" />);
    expect(screen.getByRole("button", { name: "Shop Now" })).not.toBeDisabled();
  });

  it("transitions to visited state after clicking CTA", async () => {
    const { trackClick } = await import("@/lib/ad");
    render(<AdCard ad={baseAd} userId="user-001" category="coffee" />);
    const btn = screen.getByRole("button", { name: "Shop Now" });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "✓ Visited" })).toBeInTheDocument();
    });
    expect(trackClick).toHaveBeenCalledWith("user-001", "creative-001", "campaign-001");
  });

  it("CTA button is disabled after visiting", async () => {
    render(<AdCard ad={baseAd} userId="user-001" category="coffee" />);
    const btn = screen.getByRole("button", { name: "Shop Now" });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "✓ Visited" })).toBeDisabled();
    });
  });

  it("records click to localStorage on CTA click", async () => {
    render(<AdCard ad={baseAd} userId="user-001" category="coffee" />);
    fireEvent.click(screen.getByRole("button", { name: "Shop Now" }));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("adverb_clicks_user-001") || "[]") as { id: string }[];
      expect(stored[0]?.id).toBe("creative-001");
    });
  });

  it("uses brand color for CTA button background", () => {
    render(<AdCard ad={baseAd} userId="user-001" category="coffee" />);
    const btn = screen.getByRole("button", { name: "Shop Now" });
    expect(btn).toHaveStyle({ backgroundColor: "#4f46e5" });
  });

  it("falls back to default brand color when color_primary is null", () => {
    render(<AdCard ad={{ ...baseAd, color_primary: null }} userId="user-001" category="coffee" />);
    const btn = screen.getByRole("button", { name: "Shop Now" });
    expect(btn).toHaveStyle({ backgroundColor: "#6366f1" });
  });
});
