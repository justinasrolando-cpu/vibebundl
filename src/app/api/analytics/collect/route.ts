import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  let body: { site_slug?: string; path?: string; referrer?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const siteSlug = body.site_slug;
  const path = body.path;

  if (!siteSlug || !path) {
    return NextResponse.json(
      { error: "site_slug and path are required." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const supabase = createAdminClient();

  const { data: site, error: siteErr } = await supabase
    .from("analytics_sites")
    .select("id")
    .eq("slug", siteSlug)
    .single();

  if (siteErr || !site) {
    return NextResponse.json(
      { error: "Site not found." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  // The snippet posts document.referrer, which is the *real* referrer of the
  // tracked page. The Referer header on this request is the tracked page's own
  // URL, so it is only a last-resort fallback and never a useful referrer.
  const referrer =
    typeof body.referrer === "string" && body.referrer.trim()
      ? body.referrer.trim().slice(0, 500)
      : null;

  const { error: insertErr } = await supabase.from("analytics_events").insert({
    site_id: site.id,
    path: path.slice(0, 500),
    referrer,
  });

  if (insertErr) {
    return NextResponse.json(
      { error: insertErr.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
}
