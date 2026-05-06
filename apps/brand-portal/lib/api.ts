export const brandApi = () => {
  if (typeof window === "undefined") {
    return (
      process.env.BRAND_API_URL ||
      process.env.NEXT_PUBLIC_BRAND_API_URL ||
      "http://localhost:8000"
    );
  }
  return process.env.NEXT_PUBLIC_BRAND_API_URL || "http://localhost:8000";
};

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${brandApi()}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${brandApi()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${brandApi()}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
