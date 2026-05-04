export async function generateAdCopy(ai: Ai, prompt: string): Promise<string> {
  const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
    messages: [{ role: "user", content: prompt }],
    max_tokens: 60,
  });
  if (typeof response === "string") {
    return response.trim();
  }
  return String((response as { response?: string }).response ?? "").trim();
}

export async function generateWithFallback(ai: Ai, prompt: string, fallbackCopy: string): Promise<string> {
  return Promise.race([
    generateAdCopy(ai, prompt),
    new Promise<string>((resolve) => setTimeout(() => resolve(fallbackCopy), 35)),
  ]);
}
