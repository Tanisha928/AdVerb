import { NextRequest, NextResponse } from "next/server";

import { recordClickApi } from "../../../lib/prometheus";

const DECISION_ENGINE_URL = process.env.DECISION_ENGINE_URL || "http://localhost:8080";

type ClickBody = {
  templateSlug: string;
  overlayKey: string;
  ageGroup: string;
  interest: string;
};

export async function POST(req: NextRequest) {
  const started = performance.now();
  let body: ClickBody;
  try {
    body = (await req.json()) as ClickBody;
  } catch {
    recordClickApi("400", (performance.now() - started) / 1000);
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  if (!body?.templateSlug || !body?.overlayKey || !body?.ageGroup || !body?.interest) {
    recordClickApi("400", (performance.now() - started) / 1000);
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  const resp = await fetch(`${DECISION_ENGINE_URL}/click`, {
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
    recordClickApi("502", (performance.now() - started) / 1000);
    return NextResponse.json({ error: "click tracking failed" }, { status: 502 });
  }

  recordClickApi("204", (performance.now() - started) / 1000);
  return new NextResponse(null, { status: 204 });
}

