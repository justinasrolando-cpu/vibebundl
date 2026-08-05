import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import BookingForm from "./BookingForm";

// This page reads Supabase through the service-role client, which never
// touches cookies — without this the route would be statically rendered and
// visitors would keep seeing already-booked slots as open.
export const dynamic = "force-dynamic";

type Slot = {
  id: string;
  start_time: string;
  taken: boolean;
};

/**
 * Kept out of the component body: reading the clock is impure, and this page
 * is re-rendered per request, so "now" is resolved once here per render.
 */
function upcomingSlots(
  rows: { id: string; start_time: string }[],
  takenIds: Set<string>,
): Slot[] {
  const now = Date.now();
  return rows
    .filter((s) => new Date(s.start_time).getTime() >= now)
    .map((s) => ({
      id: s.id,
      start_time: s.start_time,
      taken: takenIds.has(s.id),
    }));
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: page } = await supabase
    .from("booking_pages")
    .select("id, title, duration_minutes")
    .eq("slug", slug)
    .maybeSingle();

  if (!page) notFound();

  const { data: slotRows } = await supabase
    .from("booking_slots")
    .select("id, start_time")
    .eq("page_id", page.id)
    .order("start_time", { ascending: true });

  const slotIds = (slotRows ?? []).map((s) => s.id);

  let takenIds = new Set<string>();
  if (slotIds.length > 0) {
    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("slot_id")
      .in("slot_id", slotIds);
    takenIds = new Set((bookingRows ?? []).map((b) => b.slot_id as string));
  }

  const slots = upcomingSlots(slotRows ?? [], takenIds);

  return (
    <div className="flex min-h-screen items-start justify-center p-6 sm:items-center">
      <div className="card animate-fade-in w-full max-w-md p-6">
        <h1 className="text-xl font-semibold">{page.title}</h1>
        <p className="mt-1 text-sm text-muted">{page.duration_minutes} minute meeting</p>

        <div className="mt-5">
          <BookingForm slug={slug} initialSlots={slots} />
        </div>
      </div>
    </div>
  );
}
