import { NextRequest, NextResponse } from "next/server";

const DECISION_ENGINE_URL = process.env.DECISION_ENGINE_URL || "http://localhost:8080";

type ImpressionBody = {
  templateSlug: string;
  overlayKey: string;
  ageGroup: string;
  interest: string;
};

export async function POST(req: NextRequest) {
  let body: ImpressionBody;
  try {
    body = (await req.json()) as ImpressionBody;
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  if (!body?.templateSlug || !body?.overlayKey) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  const resp = await fetch(`${DECISION_ENGINE_URL}/impression`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      template_slug: body.templateSlug,
      overlay_key: body.overlayKey,
      age_group: body.ageGroup,
      interest: body.interest,
    }),
    cache: "no-store",
  });

  if (!resp.ok) {
    return NextResponse.json({ error: "impression tracking failed" }, { status: 502 });
  }

  return new NextResponse(null, { status: 204 });
}
