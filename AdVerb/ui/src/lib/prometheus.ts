import { Registry, Counter, Histogram, collectDefaultMetrics } from "prom-client";

type MetricsBundle = {
  register: Registry;
  adApiRequests: Counter;
  adApiDuration: Histogram;
  clickApiRequests: Counter;
  clickApiDuration: Histogram;
};

const GLOBAL_KEY = "__adverbPromMetrics__" as const;

function createMetrics(): MetricsBundle {
  const register = new Registry();
  collectDefaultMetrics({ register, prefix: "adverb_ui_nodejs_" });

  const adApiRequests = new Counter({
    name: "adverb_ui_ad_api_requests_total",
    help: "POST /api/ad responses by HTTP status code",
    labelNames: ["status"],
    registers: [register],
  });

  const adApiDuration = new Histogram({
    name: "adverb_ui_ad_api_duration_seconds",
    help: "POST /api/ad wall time in seconds",
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 15, 30],
    registers: [register],
  });

  const clickApiRequests = new Counter({
    name: "adverb_ui_click_api_requests_total",
    help: "POST /api/click by HTTP status code",
    labelNames: ["status"],
    registers: [register],
  });

  const clickApiDuration = new Histogram({
    name: "adverb_ui_click_api_duration_seconds",
    help: "POST /api/click wall time in seconds",
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [register],
  });

  return { register, adApiRequests, adApiDuration, clickApiRequests, clickApiDuration };
}

export function getMetrics(): MetricsBundle {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MetricsBundle };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createMetrics();
  }
  return g[GLOBAL_KEY];
}

export function recordAdApi(status: string, durationSeconds: number) {
  const m = getMetrics();
  m.adApiRequests.inc({ status });
  m.adApiDuration.observe(durationSeconds);
}

export function recordClickApi(status: string, durationSeconds: number) {
  const m = getMetrics();
  m.clickApiRequests.inc({ status });
  m.clickApiDuration.observe(durationSeconds);
}
