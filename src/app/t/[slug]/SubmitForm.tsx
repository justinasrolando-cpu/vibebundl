"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SubmitForm({
  spaceId,
  slug,
}: {
  spaceId: string;
  slug: string;
}) {
  const supabase = createClient();
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError("Please write a testimonial before submitting.");
      return;
    }

    setStatus("submitting");

    let id = spaceId;
    if (!id) {
      const { data: space, error: lookupError } = await supabase
        .from("testimonial_spaces")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (lookupError || !space) {
        setStatus("error");
        setError("This collection page could not be found.");
        return;
      }
      id = space.id;
    }

    const { error: insertError } = await supabase.from("testimonials").insert({
      space_id: id,
      author_name: authorName.trim() || "Anonymous",
      author_email: authorEmail.trim() || null,
      content: content.trim(),
    });

    if (insertError) {
      setStatus("error");
      setError(insertError.message);
      return;
    }

    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="card animate-fade-in p-6 text-center">
        <p className="text-sm text-accent">
          Thanks! Your testimonial was submitted and is pending review.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card animate-fade-in flex flex-col gap-3 p-6"
    >
      <p className="text-sm font-medium">Leave a testimonial</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="author_name">
            Name
          </label>
          <input
            id="author_name"
            className="input"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Anonymous"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="author_email">
            Email (optional, not shown publicly)
          </label>
          <input
            id="author_email"
            type="email"
            className="input"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted" htmlFor="content">
          Your testimonial
        </label>
        <textarea
          id="content"
          className="input"
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What did you love about it?"
          required
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Submitting…" : "Submit testimonial"}
        </button>
      </div>
    </form>
  );
}
