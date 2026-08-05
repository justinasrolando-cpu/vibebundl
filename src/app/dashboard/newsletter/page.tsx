"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Subscriber = {
  id: string;
  user_id: string;
  email: string;
  subscribed_at: string;
};

type Campaign = {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  sent_at: string | null;
  created_at: string;
};

export default function NewsletterPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [subscriberError, setSubscriberError] = useState<string | null>(null);
  const [addingSubscriber, setAddingSubscriber] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendNotice, setSendNotice] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    const { data } = await supabase
      .from("newsletter_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCampaigns(data as Campaign[]);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const [{ data: subs, error: subsErr }, { data: camps, error: campsErr }] =
        await Promise.all([
          supabase
            .from("newsletter_subscribers")
            .select("*")
            .order("subscribed_at", { ascending: false }),
          supabase
            .from("newsletter_campaigns")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

      // Without this an outright load failure looks identical to "you have
      // nothing yet", which reads as data loss.
      if (subsErr) setSubscriberError("Couldn't load your subscribers. Refresh to try again.");
      if (campsErr) setCampaignError("Couldn't load your campaigns. Refresh to try again.");

      setSubscribers(subs ?? []);
      setCampaigns(camps ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  async function handleAddSubscriber(e: FormEvent) {
    e.preventDefault();
    setSubscriberError(null);
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (!userId) return;

    setAddingSubscriber(true);
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .insert({ user_id: userId, email })
      .select()
      .single();
    setAddingSubscriber(false);

    if (error) {
      setSubscriberError(
        error.code === "23505" ? "That email is already subscribed." : error.message,
      );
      return;
    }

    if (data) {
      setSubscribers((prev) => [data as Subscriber, ...prev]);
      setNewEmail("");
    }
  }

  async function handleDeleteSubscriber(id: string) {
    setSubscriberError(null);
    const prev = subscribers;
    setSubscribers((cur) => cur.filter((s) => s.id !== id));
    const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", id);
    if (error) {
      setSubscribers(prev);
      setSubscriberError("Couldn't remove that subscriber. Try again.");
    }
  }

  async function handleSaveDraft(e: FormEvent) {
    e.preventDefault();
    setDraftError(null);
    if (!userId) {
      setDraftError("You need to be signed in to save a draft.");
      return;
    }
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject || !trimmedBody) {
      setDraftError("A subject line and some body text are both required.");
      return;
    }

    setSavingDraft(true);
    const { data, error } = await supabase
      .from("newsletter_campaigns")
      .insert({ user_id: userId, subject: trimmedSubject, body: trimmedBody, sent_at: null })
      .select()
      .single();
    setSavingDraft(false);

    if (error || !data) {
      setDraftError(error?.message ?? "Couldn't save that draft. Try again.");
      return;
    }

    setCampaigns((prev) => [data as Campaign, ...prev]);
    setSubject("");
    setBody("");
  }

  async function handleSendCampaign(campaign: Campaign) {
    setSendError(null);
    setSendNotice(null);

    if (subscribers.length === 0) {
      setSendError("Add at least one subscriber before sending.");
      return;
    }

    const plural = subscribers.length === 1 ? "subscriber" : "subscribers";
    const confirmed = window.confirm(
      `Send "${campaign.subject}" to ${subscribers.length} ${plural}? This sends real email and can't be undone.`,
    );
    if (!confirmed) return;

    setSendingId(campaign.id);
    try {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaign.id }),
      });
      const data = await res.json().catch(() => ({}) as { error?: string });

      if (!res.ok) {
        setSendError(data.error ?? "Failed to send campaign.");
        await loadCampaigns();
        return;
      }

      const sent = Number(data.sent ?? 0);
      const failed = Number(data.failed ?? 0);
      setSendNotice(
        `Sent to ${sent} ${sent === 1 ? "subscriber" : "subscribers"}` +
          (failed > 0 ? ` · ${failed} failed` : ""),
      );
      await loadCampaigns();
    } catch {
      setSendError("Couldn't reach the send endpoint. Check your connection and try again.");
    } finally {
      setSendingId(null);
    }
  }

  async function handleDeleteCampaign(id: string) {
    setCampaignError(null);
    const prev = campaigns;
    setCampaigns((cur) => cur.filter((c) => c.id !== id));
    const { error } = await supabase.from("newsletter_campaigns").delete().eq("id", id);
    if (error) {
      setCampaigns(prev);
      setCampaignError("Couldn't delete that campaign. Try again.");
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Newsletter</h1>
      <p className="mt-1 text-sm text-muted">
        Manage your subscriber list and draft campaigns.
      </p>

      {/* Subscribers */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold">Subscribers</h2>
        <p className="mt-1 text-xs text-muted">
          There&apos;s no public opt-in page in this MVP yet — add subscribers manually.
        </p>

        <form onSubmit={handleAddSubscriber} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="subscriber@example.com"
            className="input flex-1"
          />
          <button type="submit" disabled={addingSubscriber} className="btn btn-primary shrink-0">
            {addingSubscriber ? "Adding…" : "Add subscriber"}
          </button>
        </form>
        {subscriberError && <p className="mt-2 text-sm text-danger">{subscriberError}</p>}

        <div className="mt-4">
          {subscribers.length === 0 ? (
            <div className="card p-4 text-sm text-muted">
              No subscribers yet. Add one above to get started.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {subscribers.map((s, i) => (
                <li
                  key={s.id}
                  style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
                  className="card animate-fade-in flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{s.email}</p>
                    <p className="text-xs text-muted">
                      subscribed {new Date(s.subscribed_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteSubscriber(s.id)}
                    className="btn btn-secondary shrink-0 text-xs"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Campaigns */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Campaigns</h2>
          <span className="text-xs text-muted">
            {subscribers.length} subscriber{subscribers.length === 1 ? "" : "s"}
          </span>
        </div>

        <form onSubmit={handleSaveDraft} className="card mt-3 flex flex-col gap-3 p-4">
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line"
            className="input"
          />
          <textarea
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your campaign…"
            rows={8}
            className="input resize-y"
          />
          <p className="text-xs text-muted">
            Campaigns send as plain text through Resend. While{" "}
            <code>RESEND_FROM_EMAIL</code> is set to <code>onboarding@resend.dev</code>, mail
            goes out from Resend&apos;s shared testing domain — point it at your own verified
            domain before sending to real subscribers.
          </p>
          {draftError && <p className="text-sm text-danger">{draftError}</p>}
          <div>
            <button type="submit" disabled={savingDraft} className="btn btn-primary text-sm">
              {savingDraft ? "Saving…" : "Save as draft"}
            </button>
          </div>
        </form>

        {sendError && <p className="mt-2 text-sm text-danger">{sendError}</p>}
        {campaignError && <p className="mt-2 text-sm text-danger">{campaignError}</p>}
        {sendNotice && <p className="mt-2 text-xs text-accent">{sendNotice}</p>}

        <div className="mt-4">
          {campaigns.length === 0 ? (
            <div className="card p-4 text-sm text-muted">
              No campaigns yet. Compose one above and save it as a draft.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {campaigns.map((c, i) => (
                <li
                  key={c.id}
                  style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
                  className="card animate-fade-in flex flex-col gap-2 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.subject}</p>
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted">
                        {c.body}
                      </p>
                    </div>
                    {c.sent_at ? (
                      <span className="shrink-0 rounded-md bg-surface-hover px-2 py-1 text-xs text-muted">
                        Sent
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-md bg-surface-hover px-2 py-1 text-xs text-accent">
                        Draft
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted">
                      {c.sent_at
                        ? `sent ${new Date(c.sent_at).toLocaleString()}`
                        : `created ${new Date(c.created_at).toLocaleDateString()}`}
                    </p>
                    <div className="flex gap-2">
                      {!c.sent_at && (
                        <button
                          onClick={() => handleSendCampaign(c)}
                          disabled={sendingId !== null}
                          className="btn btn-primary text-xs"
                        >
                          {sendingId === c.id ? "Sending…" : "Send campaign"}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteCampaign(c.id)}
                        disabled={sendingId === c.id}
                        className="btn btn-secondary text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
