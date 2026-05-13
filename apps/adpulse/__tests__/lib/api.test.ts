import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiGet, apiPost, apiPatch, brandApi } from "@/lib/api";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

describe("brandApi()", () => {
  it("returns localhost:8000 as default when env vars are absent", () => {
    expect(brandApi()).toBe("http://localhost:8000");
  });
});

describe("apiGet", () => {
  beforeEach(() => { mockFetch.mockReset(); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("fetches the correct URL and returns JSON", async () => {
    const payload = [{ id: "1", name: "BrewCo" }];
    mockFetch.mockResolvedValue(makeResponse(payload));

    const result = await apiGet("/brands");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/brands",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(result).toEqual(payload);
  });

  it("throws when response is not ok", async () => {
    mockFetch.mockResolvedValue(makeResponse({ detail: "Not found" }, false, 404));
    await expect(apiGet("/brands/bad-id")).rejects.toThrow();
  });

  it("calls fetch with no-store cache option", async () => {
    mockFetch.mockResolvedValue(makeResponse({}));
    await apiGet("/brands");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cache: "no-store" })
    );
  });
});

describe("apiPost", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("sends a POST request with JSON body", async () => {
    const created = { id: "c-1", name: "Summer Campaign" };
    mockFetch.mockResolvedValue(makeResponse(created));

    const body = { name: "Summer Campaign", objective: "clicks" };
    const result = await apiPost("/brands/b-1/campaigns", body);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/brands/b-1/campaigns",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
    expect(result).toEqual(created);
  });

  it("sends POST without a body when body arg is omitted", async () => {
    mockFetch.mockResolvedValue(makeResponse({ ok: true }));
    await apiPost("/campaigns/c-1/generate-creatives");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: undefined })
    );
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue(makeResponse({ detail: "Server error" }, false, 500));
    await expect(apiPost("/campaigns/c-1/generate-creatives", {})).rejects.toThrow();
  });
});

describe("apiPatch", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("sends a PATCH request with JSON body", async () => {
    const updated = { id: "c-1", status: "live" };
    mockFetch.mockResolvedValue(makeResponse(updated));

    const result = await apiPatch("/campaigns/c-1/status", { status: "live" });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/campaigns/c-1/status",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "live" }),
      })
    );
    expect(result).toEqual(updated);
  });

  it("can patch a creative review status", async () => {
    mockFetch.mockResolvedValue(makeResponse({ id: "cr-1", status: "approved" }));
    const result = await apiPatch("/creatives/cr-1/review", { status: "approved" });
    expect(result).toEqual({ id: "cr-1", status: "approved" });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue(makeResponse({ detail: "Not found" }, false, 404));
    await expect(apiPatch("/campaigns/bad-id/status", { status: "live" })).rejects.toThrow();
  });
});
