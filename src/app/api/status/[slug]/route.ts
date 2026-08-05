import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type MonitorRow = {
  id: string;
  label: string | null;
  url: string;
  last_status: string | null;
  last_checked_at: string | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: statusPage, error: statusPageErr } = await supabase
    .from("status_pages")
    .select("id, user_id, slug, title, monitor_ids")
    .eq("slug", slug)
    .maybeSingle();

  if (statusPageErr || !statusPage) {
    return NextResponse.json({ error: "Status page not found." }, { status: 404 });
  }

  const monitorIds: string[] = Array.isArray(statusPage.monitor_ids) ? statusPage.monitor_ids : [];

  let monitors: MonitorRow[] = [];
  if (monitorIds.length > 0) {
    // Critical ownership check: only monitors that both (a) are referenced by
    // this status page and (b) belong to the status page's own user are ever
    // returned. This prevents a tampered monitor_ids array from leaking
    // another user's monitor data.
    const { data, error: monitorsErr } = await supabase
      .from("uptime_monitors")
      .select("id, label, url, last_status, last_checked_at")
      .in("id", monitorIds)
      .eq("user_id", statusPage.user_id);

    if (monitorsErr) {
      return NextResponse.json({ error: monitorsErr.message }, { status: 500 });
    }
    monitors = data ?? [];
  }

  return NextResponse.json({
    title: statusPage.title,
    monitors: monitors.map((m) => ({
      id: m.id,
      label: m.label,
      url: m.url,
      last_status: m.last_status,
      last_checked_at: m.last_checked_at,
    })),
  });
}
