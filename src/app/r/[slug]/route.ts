import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: link, error } = await supabase
    .from("short_links")
    .select("id, target_url")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !link) {
    return new Response("Short link not found.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // A stored URL that no longer parses must not take the whole redirect down.
  let destination: URL;
  try {
    destination = new URL(link.target_url);
  } catch {
    return new Response("This short link points at an invalid URL.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (destination.protocol !== "http:" && destination.protocol !== "https:") {
    return new Response("This short link points at an unsupported URL.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Analytics is best-effort: never fail the redirect because logging failed.
  try {
    await supabase.from("short_link_clicks").insert({
      link_id: link.id,
      referrer: request.headers.get("referer"),
    });
  } catch {
    // swallow — the visitor still gets where they were going
  }

  const response = NextResponse.redirect(destination.toString(), { status: 302 });
  response.headers.set("cache-control", "no-store");
  return response;
}
