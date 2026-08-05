"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Draft = {
  id: string;
  user_id: string;
  template: string;
  prompt: string;
  output: string;
  created_at: string;
};

const TEMPLATES = ["Headline", "Cold Email", "Ad Copy", "Product Description"];

export default function WriterPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);

  const loadDrafts = useCallback(
    async (uid: string) => {
      const { data, error: fetchError } = await supabase
        .from("ai_writer_drafts")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setDraftsLoading(false);
        return;
      }

      setDrafts((data ?? []) as Draft[]);
      setDraftsLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setError("You are signed out. Sign in again to see and save drafts.");
        setDraftsLoading(false);
        return;
      }
      await loadDrafts(uid);
    })();
  }, [supabase, loadDrafts]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setOutput("");
    setCopied(false);

    try {
      const res = await fetch("/api/writer/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template, prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate.");
      } else {
        setOutput(data.output);
      }
    } catch {
      setError("Failed to reach the generate endpoint.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Your browser blocked clipboard access. Select the text and copy it manually.");
    }
  }

  async function handleSaveDraft() {
    if (!output.trim()) return;
    if (!userId) {
      setError("You are signed out. Sign in again to save drafts.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("ai_writer_drafts")
      .insert({
        user_id: userId,
        template,
        prompt: prompt.trim(),
        output,
      })
      .select()
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not save this draft.");
      setSaving(false);
      return;
    }

    setDrafts((prev) => [data as Draft, ...prev]);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!userId) return;
    const previous = drafts;
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (selectedDraft?.id === id) setSelectedDraft(null);
    const { error: deleteError } = await supabase
      .from("ai_writer_drafts")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (deleteError) {
      setError(deleteError.message);
      setDrafts(previous);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">AI Writer</h1>
      <p className="mt-1 text-sm text-muted">Generate headlines, emails, and ad copy from a template and prompt.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <form onSubmit={handleGenerate} className="card animate-fade-in flex flex-col gap-3 p-4">
            <div>
              <label htmlFor="template" className="mb-1 block text-xs text-muted">
                Template
              </label>
              <select
                id="template"
                className="input w-full"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                {TEMPLATES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="prompt" className="mb-1 block text-xs text-muted">
                Describe your product/topic
              </label>
              <textarea
                id="prompt"
                className="input w-full"
                rows={5}
                placeholder="e.g. A subscription box for artisanal coffee roasted weekly and shipped fresh."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button type="submit" className="btn btn-primary" disabled={generating || !prompt.trim()}>
              {generating ? "Generating..." : "Generate"}
            </button>
          </form>

          {(output || generating) && (
            <div className="card animate-fade-in flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">Output</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary text-xs"
                    onClick={handleCopy}
                    disabled={!output}
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary text-xs"
                    onClick={handleSaveDraft}
                    disabled={!output || saving}
                  >
                    {saving ? "Saving..." : "Save draft"}
                  </button>
                </div>
              </div>
              <pre className="input min-h-[8rem] w-full whitespace-pre-wrap break-words bg-surface p-3 font-sans text-sm leading-relaxed">
                {generating ? "Thinking..." : output}
              </pre>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted">Saved drafts</p>

          {draftsLoading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : drafts.length === 0 ? (
            <div className="card p-4 text-sm text-muted">No saved drafts yet. Generate something and save it.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {drafts.map((d, i) => (
                <div
                  key={d.id}
                  style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                  className="card animate-fade-in flex flex-col gap-2 p-3"
                >
                  <button
                    type="button"
                    className="flex flex-col gap-1 text-left"
                    onClick={() => setSelectedDraft(selectedDraft?.id === d.id ? null : d)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-accent">{d.template}</span>
                      <span className="text-xs text-muted">{new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="truncate text-sm">{d.prompt}</p>
                  </button>

                  {selectedDraft?.id === d.id && (
                    <pre className="whitespace-pre-wrap break-words rounded-md bg-surface p-3 font-sans text-sm leading-relaxed">
                      {d.output}
                    </pre>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn btn-secondary text-xs"
                      onClick={() => handleDelete(d.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
