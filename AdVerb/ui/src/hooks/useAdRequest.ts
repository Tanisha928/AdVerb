"use client";

import { useState } from "react";

import { requestAd } from "../lib/api";
import type { AdRequest, AdResponse } from "../lib/types";

export function useAdRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdResponse | null>(null);
  const [lastPayload, setLastPayload] = useState<AdRequest | null>(null);

  async function runAuction(payload: AdRequest) {
    setLastPayload(payload);
    await runRequest(payload);
  }

  async function runRequest(payload: AdRequest) {
    setLoading(true);
    setError(null);
    const started = performance.now();
    try {
      const result = await requestAd(payload);
      const ended = performance.now();
      result.latency.totalMs = Number((ended - started).toFixed(2));
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function regenerateImage(mode: "refresh" | "rebuild", feedback?: string) {
    if (!lastPayload) return;
    await runRequest({
      ...lastPayload,
      imageRebuildMode: mode,
      imageFeedback: feedback?.trim() || undefined,
      imageVariantNonce: crypto.randomUUID(),
    });
  }

  return { loading, error, data, setData, lastPayload, runAuction, regenerateImage };
}
