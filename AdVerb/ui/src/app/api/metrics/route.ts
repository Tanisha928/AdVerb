import { getMetrics } from "../../../lib/prometheus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { register } = getMetrics();
  const body = await register.metrics();
  return new Response(body, {
    headers: { "Content-Type": register.contentType },
  });
}
