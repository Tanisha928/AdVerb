const WEST_COAST = ["san jose", "los angeles", "seattle"];

export function flyUrlForLocation(location: string, env: { FLY_IAD_URL: string; FLY_SJC_URL: string }): string {
  const normalized = location.trim().toLowerCase();
  return WEST_COAST.includes(normalized) ? env.FLY_SJC_URL : env.FLY_IAD_URL;
}

export function servedFromLabel(location: string): string {
  const normalized = location.trim().toLowerCase();
  return WEST_COAST.includes(normalized) ? "Cloudflare sjc (San Jose)" : "Cloudflare iad (NYC)";
}
