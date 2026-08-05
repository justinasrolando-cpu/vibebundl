"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function JoinForm({
  waitlistId,
  slug,
}: {
  waitlistId: string;
  slug: string;
}) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "duplicate" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setStatus("submitting");

    let id = waitlistId;
    if (!id) {
      const { data: waitlist, error: lookupError } = await supabase
        .from("waitlists")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (lookupError || !waitlist) {
        setStatus("error");
        setError("This waitlist could not be found.");
        return;
      }
      id = waitlist.id;
    }

    const { error: insertError } = await supabase
      .from("waitlist_signups")
      .insert({ waitlist_id: id, email: cleanEmail });

    if (insertError) {
      if (insertError.code === "23505") {
        setStatus("duplicate");
        return;
      }
      setStatus("error");
      setError(insertError.message);
      return;
    }

    setStatus("success");
  }

  if (status === "success") {
    return (
      <p className="animate-fade-in text-sm text-accent">
        You&apos;re on the list. We&apos;ll be in touch.
      </p>
    );
  }

  if (status === "duplicate") {
    return (
      <p className="animate-fade-in text-sm text-muted">
        You&apos;re already on the list.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          className="input flex-1"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          className="btn btn-primary shrink-0"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Joining…" : "Join waitlist"}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}
