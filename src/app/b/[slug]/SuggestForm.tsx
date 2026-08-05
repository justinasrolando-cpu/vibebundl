"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SuggestForm({ boardId }: { boardId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Enter a short title for your idea.");
      return;
    }

    setStatus("submitting");

    // description is `not null default ''` — never send an explicit null.
    const { error: insertError } = await supabase.from("feedback_posts").insert({
      board_id: boardId,
      title: cleanTitle,
      description: description.trim(),
    });

    if (insertError) {
      setStatus("error");
      setError(insertError.message);
      return;
    }

    setStatus("success");
    setTitle("");
    setDescription("");
    // pull the new post into the server-rendered list below
    router.refresh();
  }

  if (status === "success") {
    return (
      <div className="animate-fade-in flex flex-col gap-2">
        <p className="text-sm text-accent">Thanks! Your idea was submitted.</p>
        <button
          type="button"
          className="btn btn-secondary self-start"
          onClick={() => setStatus("idle")}
        >
          Suggest another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        className="input"
        placeholder="Idea title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        className="input"
        rows={2}
        placeholder="More details (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        className="btn btn-primary self-start"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Submitting…" : "Submit idea"}
      </button>
    </form>
  );
}
