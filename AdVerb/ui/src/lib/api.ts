import type { AdRequest, AdResponse } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_WORKER_URL || "";

export async function requestAd(payload: AdRequest): Promise<AdResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ad`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch ad");
  }
  return response.json();
}

export async function trackClick(payload: {
  templateSlug: string;
  overlayKey: string;
  ageGroup: string;
  interest: string;
  locationStr?: string;
}): Promise<void> {
  const path = API_BASE_URL ? `${API_BASE_URL}/click` : "/api/click";
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to track click");
  }
}
