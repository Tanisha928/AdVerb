import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchFeed, trackClick, adServing } from "@/lib/ad";
import type { ServedAd } from "@/lib/ad";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(data: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

const mockAds: ServedAd[] = [
  {
    id: "cr-1",
    campaign_id: "camp-1",
    headline: "Great Coffee",
    subheadline: "Start your day right",
    cta: "Buy Now",
    assembled_image_url: "https://cdn.example.com/ad1.jpg",
    product_image_url: null,
    background_color: "#4f46e5",
    layout: "hero",
    brand_name: "BrewCo",
    brand_logo_url: null,
    color_primary: "#4f46e5",
  },
];

describe("adServing()", () => {
  it("returns localhost:8001 as default", () => {
    expect(adServing()).toBe("http://localhost:8001");
  });
});

describe("fetchFeed", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("fetches feed for a user", async () => {
    mockFetch.mockResolvedValue(makeResponse(mockAds));
    const result = await fetchFeed("user-001");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/user/user-001/feed"),
      expect.objectContaining({ cache: "no-store" })
    );
    expect(result).toEqual(mockAds);
  });

  it("includes categories as a query parameter", async () => {
    mockFetch.mockResolvedValue(makeResponse(mockAds));
    await fetchFeed("user-001", ["coffee", "tech"]);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("categories=coffee%2Ctech");
  });

  it("does not append categories param when array is empty", async () => {
    mockFetch.mockResolvedValue(makeResponse(mockAds));
    await fetchFeed("user-001", []);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("categories");
  });

  it("throws when response is not ok", async () => {
    mockFetch.mockResolvedValue(makeResponse({}, false));
    await expect(fetchFeed("user-001")).rejects.toThrow("feed failed");
  });
});

describe("trackClick", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("sends a POST to /track-click with the correct body", async () => {
    mockFetch.mockResolvedValue(makeResponse({}));
    await trackClick("user-001", "cr-1", "camp-1");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/track-click"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "user-001", creative_id: "cr-1", campaign_id: "camp-1" }),
      })
    );
  });

  it("does not throw on network error (fire-and-forget)", async () => {
    mockFetch.mockResolvedValue(makeResponse({}, false));
    await expect(trackClick("user-001", "cr-1", "camp-1")).resolves.toBeUndefined();
  });
});
