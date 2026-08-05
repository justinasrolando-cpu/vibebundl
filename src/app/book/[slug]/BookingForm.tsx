"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Slot = {
  id: string;
  start_time: string;
  taken: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export default function BookingForm({
  slug,
  initialSlots,
}: {
  slug: string;
  initialSlots: Slot[];
}) {
  const supabase = createClient();

  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  // Held separately from `slots` so the confirmation never depends on a list
  // that may have been refreshed out from under it.
  const [confirmed, setConfirmed] = useState<Slot | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "taken" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const openSlots = slots.filter((s) => !s.taken);
  const selectedSlot = openSlots.find((s) => s.id === selectedSlotId) ?? null;

  async function refreshSlots() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/booking/${slug}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots ?? []);
      }
    } catch {
      // ignore, keep stale slots
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedSlot) {
      setError("Pick a time slot first.");
      return;
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError("Name is required.");
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setStatus("submitting");

    // `bookings.notes` is `not null default ''` — an explicit NULL is rejected
    // by the database, so an empty note must be sent as an empty string.
    const { error: insertError } = await supabase.from("bookings").insert({
      slot_id: selectedSlot.id,
      name: cleanName,
      email: cleanEmail,
      notes: notes.trim(),
    });

    if (insertError) {
      if (insertError.code === "23505") {
        setStatus("taken");
        setSelectedSlotId(null);
        await refreshSlots();
        return;
      }
      setStatus("error");
      setError("Couldn't confirm that booking. Please try again.");
      return;
    }

    setConfirmed(selectedSlot);
    setStatus("success");
  }

  if (status === "success" && confirmed) {
    return (
      <p className="animate-fade-in text-sm text-accent">
        You&apos;re booked for {formatDateTime(confirmed.start_time)}. Save the date — no
        confirmation email is sent.
      </p>
    );
  }

  if (openSlots.length === 0) {
    return (
      <p className="text-sm text-muted">
        No open slots right now. Check back later.
      </p>
    );
  }

  if (!selectedSlot) {
    return (
      <div className="flex flex-col gap-2">
        {status === "taken" && (
          <p className="animate-fade-in text-sm text-danger">
            That slot just got taken — pick another below.
          </p>
        )}
        <p className="text-xs text-muted">Pick a time</p>
        <div className="flex flex-col gap-1.5">
          {openSlots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              className="btn btn-secondary justify-start text-left"
              onClick={() => setSelectedSlotId(slot.id)}
            >
              {formatDateTime(slot.start_time)}
            </button>
          ))}
        </div>
        {refreshing && <p className="text-xs text-muted">Refreshing…</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="card flex items-center justify-between gap-2 p-3">
        <span className="text-sm">{formatDateTime(selectedSlot.start_time)}</span>
        <button
          type="button"
          className="text-xs text-muted underline hover:text-foreground"
          onClick={() => setSelectedSlotId(null)}
        >
          Change
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted" htmlFor="notes">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          className="input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
        {status === "submitting" ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}
