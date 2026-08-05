import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordUptimeCheck, runUptimeCheck } from "@/lib/uptime";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: { monitor_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const monitorId = body.monitor_id;
  if (!monitorId) {
    return NextResponse.json({ error: "monitor_id is required." }, { status: 400 });
  }

  const { data: monitor, error: monitorErr } = await supabase
    .from("uptime_monitors")
    .select("id, url")
    .eq("id", monitorId)
    .single();

  if (monitorErr || !monitor) {
    return NextResponse.json({ error: "Monitor not found." }, { status: 404 });
  }

  const result = await runUptimeCheck(monitor.url);

  const persistErr = await recordUptimeCheck(supabase, monitorId, result);
  if (persistErr) {
    return NextResponse.json({ error: persistErr }, { status: 500 });
  }

  return NextResponse.json({
    monitor_id: monitorId,
    status: result.status,
    status_code: result.statusCode,
    response_ms: result.responseMs,
    checked_at: result.checkedAt,
    ...(result.message ? { message: result.message } : {}),
  });
}
