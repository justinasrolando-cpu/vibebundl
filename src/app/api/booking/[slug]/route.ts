import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: page, error: pageError } = await supabase
    .from("booking_pages")
    .select("id, title, duration_minutes")
    .eq("slug", slug)
    .maybeSingle();

  if (pageError || !page) {
    return NextResponse.json({ error: "Booking page not found." }, { status: 404 });
  }

  const { data: slots, error: slotsError } = await supabase
    .from("booking_slots")
    .select("id, start_time")
    .eq("page_id", page.id)
    .order("start_time", { ascending: true });

  if (slotsError) {
    return NextResponse.json({ error: "Failed to load slots." }, { status: 500 });
  }

  const slotIds = (slots ?? []).map((s) => s.id);

  let takenIds = new Set<string>();
  if (slotIds.length > 0) {
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("slot_id")
      .in("slot_id", slotIds);

    if (bookingsError) {
      return NextResponse.json({ error: "Failed to load bookings." }, { status: 500 });
    }

    takenIds = new Set((bookings ?? []).map((b) => b.slot_id as string));
  }

  // Only future slots are bookable. The server-rendered page applies the same
  // filter, so refreshing from here must not resurrect times that have passed.
  const now = Date.now();

  return NextResponse.json({
    page: {
      title: page.title,
      duration_minutes: page.duration_minutes,
    },
    slots: (slots ?? [])
      .filter((s) => new Date(s.start_time).getTime() >= now)
      .map((s) => ({
        id: s.id,
        start_time: s.start_time,
        taken: takenIds.has(s.id),
      })),
  });
}
