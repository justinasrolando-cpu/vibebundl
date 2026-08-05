"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Severity = "error" | "warning" | "info";

type Issue = {
  severity: Severity;
  message: string;
};

type AuditResponse = {
  score: number;
  issues: Issue[];
  title: string | null;
  hasMetaDescription: boolean;
  h1Count: number;
  imagesMissingAlt: number;
  linkCount: number;
};

type Audit = {
  id: string;
  user_id: string;
  url: string;
  score: number;
  issues: Issue[];
  created_at: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-accent";
  if (score >= 50) return "text-foreground";
  return "text-danger";
}

function severityColor(severity: Severity): string {
  switch (severity) {
    case "error":
      return "text-danger";
    case "warning":
      return "text-accent";
    case "info":
    default:
      return "text-muted";
  }
}

function severityLabel(severity: Severity): string {
  switch (severity) {
    case "error":
      return "Error";
    case "warning":
      return "Warning";
    case "info":
    default:
      return "Info";
  }
}

export default function SeoCheckerPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ url: string; data: AuditResponse } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [history, setHistory] = useState<Audit[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const { data, error: fetchErr } = await supabase
      .from("seo_audits")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (fetchErr) {
      setHistoryError(fetchErr.message);
    } else {
      setHistoryError(null);
      setHistory((data ?? []) as Audit[]);
    }
    setHistoryLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadHistory();
    })();
  }, [supabase, loadHistory]);

  const handleAudit = async () => {
    const raw = urlInput.trim();
    if (!raw) return;
    // Accept "example.com" as well as a full URL.
    const trimmed = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    setLoading(true);
    setError(null);
    setSaveError(null);
    setSelectedHistoryId(null);
    setSaved(false);
    try {
      const res = await fetch("/api/seo/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Audit failed.");
        setCurrent(null);
      } else {
        setCurrent({ url: trimmed, data: data as AuditResponse });
      }
    } catch {
      setError("Network error. Please try again.");
      setCurrent(null);
    }
    setLoading(false);
  };

  const handleSaveToHistory = async () => {
    if (!current || !userId) return;
    setSaving(true);
    setSaveError(null);
    const { error: insertErr } = await supabase.from("seo_audits").insert({
      user_id: userId,
      url: current.url,
      score: current.data.score,
      issues: current.data.issues,
    });
    if (insertErr) {
      setSaveError(`Could not save that audit: ${insertErr.message}`);
    } else {
      setSaved(true);
      await loadHistory();
    }
    setSaving(false);
  };

  const handleSelectHistory = (audit: Audit) => {
    setSelectedHistoryId(audit.id);
    setCurrent({
      url: audit.url,
      data: {
        score: audit.score,
        issues: audit.issues,
        title: null,
        hasMetaDescription: false,
        h1Count: 0,
        imagesMissingAlt: 0,
        linkCount: 0,
      },
    });
    setSaved(true);
    setError(null);
  };

  const handleDelete = async (audit: Audit, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete audit for "${audit.url}"? This cannot be undone.`)) return;
    setHistoryError(null);
    const { error: deleteErr } = await supabase.from("seo_audits").delete().eq("id", audit.id);
    if (deleteErr) {
      setHistoryError(`Could not delete that audit: ${deleteErr.message}`);
      return;
    }
    setHistory((prev) => prev.filter((a) => a.id !== audit.id));
    if (selectedHistoryId === audit.id) {
      setSelectedHistoryId(null);
      setCurrent(null);
    }
  };

  const displayed = current;
  const isFromHistory = selectedHistoryId !== null;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">SEO Checker</h1>
        <p className="mt-1 text-sm text-muted">
          Audit a single page for title, meta description, headings, alt text, and links.
        </p>
      </div>

      <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          className="input w-full"
          placeholder="https://example.com"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) handleAudit();
          }}
        />
        <button
          className="btn btn-primary shrink-0 text-sm"
          onClick={handleAudit}
          disabled={loading || !urlInput.trim()}
        >
          {loading ? "Auditing…" : "Audit"}
        </button>
      </div>

      {error && (
        <div className="card animate-fade-in mb-6 border-danger/40 p-4 text-sm text-danger">{error}</div>
      )}

      {displayed && (
        <div className="card animate-fade-in mb-6 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm text-muted">{displayed.url}</p>
              <p className={`mt-1 text-4xl font-semibold ${scoreColor(displayed.data.score)}`}>
                {displayed.data.score}
                <span className="text-lg text-muted">/100</span>
              </p>
            </div>
            {!isFromHistory && (
              <button
                className="btn btn-secondary shrink-0 text-xs"
                onClick={handleSaveToHistory}
                disabled={saving || saved || !userId}
              >
                {saved ? "Saved" : saving ? "Saving…" : "Save to history"}
              </button>
            )}
          </div>

          {saveError && <p className="mt-2 text-sm text-danger">{saveError}</p>}

          {!isFromHistory && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-lg bg-surface-hover px-3 py-2">
                <p className="text-xs text-muted">Title</p>
                <p className="mt-0.5 truncate text-sm">{displayed.data.title || "Missing"}</p>
              </div>
              <div className="rounded-lg bg-surface-hover px-3 py-2">
                <p className="text-xs text-muted">Meta description</p>
                <p className="mt-0.5 text-sm">{displayed.data.hasMetaDescription ? "Present" : "Missing"}</p>
              </div>
              <div className="rounded-lg bg-surface-hover px-3 py-2">
                <p className="text-xs text-muted">H1 tags</p>
                <p className="mt-0.5 text-sm">{displayed.data.h1Count}</p>
              </div>
              <div className="rounded-lg bg-surface-hover px-3 py-2">
                <p className="text-xs text-muted">Images missing alt</p>
                <p className="mt-0.5 text-sm">{displayed.data.imagesMissingAlt}</p>
              </div>
              <div className="rounded-lg bg-surface-hover px-3 py-2">
                <p className="text-xs text-muted">Links</p>
                <p className="mt-0.5 text-sm">{displayed.data.linkCount}</p>
              </div>
            </div>
          )}

          {isFromHistory && (
            <p className="mt-3 text-xs text-muted">
              Saved audits keep the score and issue list only — re-run the audit to see the current
              title, headings, and link counts.
            </p>
          )}

          <ul className="mt-4 flex flex-col gap-2">
            {(displayed.data.issues ?? []).map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={`shrink-0 rounded-full border border-border px-1.5 py-0.5 text-xs font-medium ${severityColor(issue.severity)}`}
                >
                  {severityLabel(issue.severity)}
                </span>
                <span className="text-foreground">{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted">History</h2>
        {historyError && <p className="mb-2 text-sm text-danger">{historyError}</p>}
        {historyLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted">No saved audits yet. Run an audit above and save it to history.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {history.map((audit) => (
              <li key={audit.id}>
                <button
                  onClick={() => handleSelectHistory(audit)}
                  className={`animate-fade-in flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    audit.id === selectedHistoryId ? "bg-surface-hover" : "hover:bg-surface-hover"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{audit.url}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatDate(audit.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`text-sm font-semibold ${scoreColor(audit.score)}`}>{audit.score}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleDelete(audit, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleDelete(audit, e as unknown as React.MouseEvent);
                        }
                      }}
                      className="rounded-md px-1.5 py-0.5 text-xs text-muted transition-colors hover:text-danger"
                    >
                      Delete
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!userId && !historyLoading && (
        <p className="mt-4 text-xs text-muted">Sign in to save your audit history.</p>
      )}
    </div>
  );
}
