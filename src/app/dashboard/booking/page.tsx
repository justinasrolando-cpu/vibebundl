"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type BookingPage = {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  duration_minutes: number;
  created_at: string;
};

type Booker = {
  name: string;
  email: string;
  notes: string;
};

type Slot = {
  id: string;
  page_id: string;
  start_time: string;
  created_at: string;
  booking: Booker | null;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slots from the last hour stay visible so an in-progress meeting doesn't
 * vanish from the list. Kept out of the component body: reading the clock is
 * impure and must not run as part of render's return value.
 */
function selectUpcoming(slots: Slot[]): Slot[] {
  const cutoff = Date.now() - 60 * 60 * 1000;
  return slots.filter((s) => new Date(s.start_time).getTime() >= cutoff);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BookingPageAdmin() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [page, setPage] = useState<BookingPage | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);

  // Create-page form
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [duration, setDuration] = useState(30);
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Add-slot form
  const [newSlotTime, setNewSlotTime] = useState("");
  const [addingSlot, setAddingSlot] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSlots = useCallback(
    async (pageId: string) => {
      const { data: slotRows, error: slotErr } = await supabase
        .from("booking_slots")
        .select("id, page_id, start_time, created_at")
        .eq("page_id", pageId)
        .order("start_time", { ascending: true });

      if (slotErr || !slotRows) {
        setSlots([]);
        setLoadError("Couldn't load your slots. Refresh the page to try again.");
        return;
      }

      const slotIds = slotRows.map((s) => s.id);
      let bookingsBySlot = new Map<string, Booker>();
      if (slotIds.length > 0) {
        const { data: bookingRows, error: bookingErr } = await supabase
          .from("bookings")
          .select("slot_id, name, email, notes")
          .in("slot_id", slotIds);

        if (bookingErr) {
          setLoadError(
            "Slots loaded, but who booked them couldn't be read. Refresh to try again.",
          );
        }

        bookingsBySlot = new Map(
          (bookingRows ?? []).map((b) => [
            b.slot_id as string,
            { name: b.name, email: b.email, notes: b.notes ?? "" },
          ]),
        );
      }

      setSlots(
        slotRows.map((s) => ({
          ...s,
          booking: bookingsBySlot.get(s.id) ?? null,
        })),
      );
    },
    [supabase],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    if (!user) {
      setLoading(false);
      return;
    }

    // limit(1) rather than maybeSingle(): maybeSingle() throws outright if a
    // second page row ever exists, which would hard-break the whole screen.
    const { data: pageRows, error: pageErr } = await supabase
      .from("booking_pages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (pageErr) {
      setLoadError("Couldn't load your booking page. Refresh to try again.");
      setLoading(false);
      return;
    }

    const pageRow = pageRows?.[0] ?? null;
    setPage(pageRow);

    if (pageRow) {
      await loadSlots(pageRow.id);
    }

    setLoading(false);
  }, [supabase, loadSlots]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function handleCreatePage(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);

    const cleanTitle = title.trim();
    const cleanSlug = slugify(slug || title);

    if (!cleanTitle) {
      setCreateError("Title is required.");
      return;
    }
    if (!cleanSlug) {
      setCreateError("Slug is required.");
      return;
    }
    if (!userId) {
      setCreateError("You must be signed in.");
      return;
    }

    setCreating(true);

    const { data, error } = await supabase
      .from("booking_pages")
      .insert({
        user_id: userId,
        slug: cleanSlug,
        title: cleanTitle,
        duration_minutes: duration,
      })
      .select("*")
      .single();

    if (error) {
      setCreating(false);
      if (error.code === "23505") {
        setCreateError("That slug is already taken. Pick another.");
      } else {
        setCreateError(error.message);
      }
      return;
    }

    setPage(data);
    setCreating(false);
  }

  async function handleAddSlot(e: FormEvent) {
    e.preventDefault();
    setSlotError(null);

    if (!page) return;
    if (!newSlotTime) {
      setSlotError("Pick a date and time.");
      return;
    }

    const parsed = new Date(newSlotTime);
    if (Number.isNaN(parsed.getTime())) {
      setSlotError("That date and time couldn't be read. Pick it again.");
      return;
    }
    const iso = parsed.toISOString();

    setAddingSlot(true);
    const { error } = await supabase.from("booking_slots").insert({
      page_id: page.id,
      start_time: iso,
    });
    setAddingSlot(false);

    if (error) {
      setSlotError(error.message);
      return;
    }

    setNewSlotTime("");
    await loadSlots(page.id);
  }

  /**
   * Removing the slot is the only way to cancel a booking: `bookings` has no
   * delete policy, but it cascades from `booking_slots`, which the owner does
   * control. Nothing is emailed to the booker — hence the explicit warning.
   */
  async function handleDeleteSlot(slotId: string, isBooked: boolean) {
    if (!page) return;
    if (
      isBooked &&
      !window.confirm(
        "Cancel this booking and remove the slot? The person who booked it is not notified — tell them yourself.",
      )
    ) {
      return;
    }
    setSlotError(null);
    setDeletingId(slotId);
    const { error } = await supabase.from("booking_slots").delete().eq("id", slotId);
    setDeletingId(null);
    if (error) {
      setSlotError("Couldn't delete that slot. Try again.");
      return;
    }
    await loadSlots(page.id);
  }

  const publicPath = page ? `/book/${page.slug}` : "";
  const publicUrl =
    typeof window !== "undefined" && page ? `${window.location.origin}${publicPath}` : publicPath;

  async function handleCopyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setLoadError("Couldn't copy to the clipboard — select the URL and copy it manually.");
    }
  }

  const upcomingSlots = selectUpcoming(slots);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="animate-fade-in mx-auto max-w-lg p-6">
        <h1 className="text-xl font-semibold">Booking Page</h1>
        <p className="mt-1 text-sm text-muted">
          Set up your public booking page. You define exactly which slots are open — no calendar
          sync required.
        </p>

        {loadError && <p className="mt-3 text-sm text-danger">{loadError}</p>}

        <form onSubmit={handleCreatePage} className="card mt-5 flex flex-col gap-3 p-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className="input"
              placeholder="30 Minute Meeting"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="slug">
              Slug
            </label>
            <input
              id="slug"
              className="input"
              placeholder="my-meeting"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
            />
            <p className="text-xs text-muted">Public URL: /book/{slug || "your-slug"}</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="duration">
              Duration (minutes)
            </label>
            <input
              id="duration"
              type="number"
              min={5}
              step={5}
              className="input"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 30)}
            />
          </div>

          {createError && <p className="text-sm text-danger">{createError}</p>}

          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? "Creating…" : "Create booking page"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-fade-in mx-auto max-w-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{page.title}</h1>
          <p className="mt-1 text-sm text-muted">{page.duration_minutes} minute slots</p>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted">
        Slots are the ones you add here — there&apos;s no calendar sync, and no confirmation
        email is sent to you or the booker.
      </p>

      {loadError && <p className="mt-3 text-sm text-danger">{loadError}</p>}

      <div className="card mt-4 flex items-center justify-between gap-3 p-3">
        <span className="truncate text-sm text-muted">{publicUrl}</span>
        <button className="btn btn-secondary shrink-0" onClick={handleCopyLink}>
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>

      <form onSubmit={handleAddSlot} className="card mt-5 flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold">Add an open slot</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="datetime-local"
            className="input flex-1"
            value={newSlotTime}
            onChange={(e) => setNewSlotTime(e.target.value)}
          />
          <button type="submit" className="btn btn-primary shrink-0" disabled={addingSlot}>
            {addingSlot ? "Adding…" : "Add slot"}
          </button>
        </div>
        {slotError && <p className="text-sm text-danger">{slotError}</p>}
      </form>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-muted">Upcoming slots</h2>

        {upcomingSlots.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No upcoming slots yet. Add one above so people can book you.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {upcomingSlots.map((slot) => {
              const isBooked = !!slot.booking;
              return (
                <div key={slot.id} className="card flex flex-col gap-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">{formatDateTime(slot.start_time)}</span>
                    <div className="flex items-center gap-2">
                      {isBooked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                          booked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2 py-0.5 text-xs font-medium text-muted">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted" />
                          open
                        </span>
                      )}
                      <button
                        className="btn btn-secondary text-xs"
                        onClick={() => handleDeleteSlot(slot.id, isBooked)}
                        disabled={deletingId === slot.id}
                      >
                        {deletingId === slot.id
                          ? "Removing…"
                          : isBooked
                            ? "Cancel"
                            : "Delete"}
                      </button>
                    </div>
                  </div>

                  {isBooked && slot.booking && (
                    <div className="rounded-md bg-surface-hover p-2 text-xs text-muted">
                      <p className="text-foreground">
                        {slot.booking.name} · {slot.booking.email}
                      </p>
                      {slot.booking.notes && <p className="mt-1">{slot.booking.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
