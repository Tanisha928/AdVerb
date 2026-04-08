const ad = () => {
  if (typeof window === "undefined") {
    return (
      process.env.AD_SERVING_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_AD_SERVING_URL ||
      "http://localhost:8001"
    );
  }
  return process.env.NEXT_PUBLIC_AD_SERVING_URL || "http://localhost:8001";
};

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${ad()}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
