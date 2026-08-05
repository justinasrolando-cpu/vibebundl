"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Stage = "lead" | "contacted" | "customer" | "lost";

type Contact = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  company: string;
  stage: Stage;
  notes: string;
  created_at: string;
};

const STAGES: Stage[] = ["lead", "contacted", "customer", "lost"];

const STAGE_LABEL: Record<Stage, string> = {
  lead: "Lead",
  contacted: "Contacted",
  customer: "Customer",
  lost: "Lost",
};

const STAGE_DOT: Record<Stage, string> = {
  lead: "bg-muted",
  contacted: "bg-foreground",
  customer: "bg-accent",
  lost: "bg-danger",
};

export default function CrmPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [stage, setStage] = useState<Stage>("lead");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Search + inline editing
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftCompany, setDraftCompany] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const loadContacts = useCallback(
    async (uid: string) => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("crm_contacts")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) {
        setLoadError(error.message);
      } else {
        setContacts((data ?? []) as Contact[]);
      }
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setLoadError("You need to be signed in to view your contacts.");
        return;
      }
      setUserId(user.id);
      await loadContacts(user.id);
    })();
  }, [supabase, loadContacts]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setCompany("");
    setStage("lead");
    setNotes("");
    setFormError(null);
    setShowForm(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !name.trim()) return;
    setFormError(null);
    setAdding(true);
    const { data, error } = await supabase
      .from("crm_contacts")
      .insert({
        user_id: userId,
        name: name.trim(),
        email: email.trim(),
        company: company.trim(),
        stage,
        notes: notes.trim(),
      })
      .select()
      .single();
    if (error) {
      setFormError(error.message);
    } else if (data) {
      setContacts((prev) => [data as Contact, ...prev]);
      resetForm();
    }
    setAdding(false);
  };

  const handleStageChange = async (contact: Contact, next: Stage) => {
    if (next === contact.stage) return;
    setRowError(null);
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, stage: next } : c)));
    const { error } = await supabase
      .from("crm_contacts")
      .update({ stage: next })
      .eq("id", contact.id);
    if (error) {
      setContacts((prev) =>
        prev.map((c) => (c.id === contact.id ? { ...c, stage: contact.stage } : c)),
      );
      setRowError(`Could not move ${contact.name}: ${error.message}`);
    }
  };

  const handleDelete = async (contact: Contact) => {
    if (!window.confirm(`Delete ${contact.name}? This cannot be undone.`)) return;
    setRowError(null);
    setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    if (expandedId === contact.id) setExpandedId(null);
    const { error } = await supabase.from("crm_contacts").delete().eq("id", contact.id);
    if (error) {
      setContacts((prev) => [contact, ...prev]);
      setRowError(`Could not delete ${contact.name}: ${error.message}`);
    }
  };

  const toggleExpanded = (contact: Contact) => {
    setRowError(null);
    if (expandedId === contact.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(contact.id);
    setDraftName(contact.name ?? "");
    setDraftEmail(contact.email ?? "");
    setDraftCompany(contact.company ?? "");
    setDraftNotes(contact.notes ?? "");
  };

  const handleSaveContact = async (contact: Contact) => {
    setRowError(null);
    const name = draftName.trim();
    if (!name) {
      setRowError("A contact needs a name.");
      return;
    }
    setSavingContact(true);
    // name/email/company/notes are all NOT NULL with a '' default, so send
    // empty strings rather than null when a field is cleared.
    const patch = {
      name,
      email: draftEmail.trim(),
      company: draftCompany.trim(),
      notes: draftNotes.trim(),
    };
    const { error } = await supabase
      .from("crm_contacts")
      .update(patch)
      .eq("id", contact.id)
      .eq("user_id", contact.user_id);
    if (error) {
      setRowError(`Could not save ${contact.name}: ${error.message}`);
    } else {
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, ...patch } : c)));
      setExpandedId(null);
    }
    setSavingContact(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.email, c.company].some((field) => (field ?? "").toLowerCase().includes(q)),
    );
  }, [contacts, query]);

  const columns = useMemo(() => {
    const map: Record<Stage, Contact[]> = { lead: [], contacted: [], customer: [], lost: [] };
    for (const c of filtered) {
      (map[c.stage] ?? map.lead).push(c);
    }
    return map;
  }, [filtered]);

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Mini CRM</h1>
          <p className="mt-1 text-sm text-muted">
            {contacts.length} contact{contacts.length === 1 ? "" : "s"} ·{" "}
            {contacts.filter((c) => c.stage === "customer").length} customer
            {contacts.filter((c) => c.stage === "customer").length === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 text-xs text-muted-2">
            Click a contact to edit it. Manual tracking only — no inbox sync, deal
            values, or reminders.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add contact"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card animate-fade-in mt-4 flex flex-col gap-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-muted">Name</label>
              <input
                className="input w-full"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Email</label>
              <input
                type="email"
                className="input w-full"
                placeholder="jane@acme.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Company</label>
              <input
                className="input w-full"
                placeholder="Acme Inc."
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Stage</label>
              <select
                className="input w-full"
                value={stage}
                onChange={(e) => setStage(e.target.value as Stage)}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Notes</label>
            <textarea
              className="input w-full"
              rows={3}
              placeholder="Where you met, what they need, next follow-up..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={resetForm}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={adding || !name.trim()}>
              {adding ? "Adding..." : "Add contact"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4">
        <input
          className="input w-full sm:max-w-sm"
          placeholder="Search name, email, or company..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loadError && <p className="mt-4 text-sm text-danger">{loadError}</p>}
      {rowError && <p className="mt-4 text-sm text-danger">{rowError}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading...</p>
      ) : contacts.length === 0 ? (
        <div className="card animate-fade-in mt-6 p-6 text-center">
          <p className="text-sm text-muted">
            No contacts yet. Add your first one to start moving people through your pipeline.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card animate-fade-in mt-6 p-6 text-center">
          <p className="text-sm text-muted">
            No contacts match &ldquo;{query}&rdquo;. Try a different name, email, or company.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s) => (
            <div key={s} className="flex flex-col">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${STAGE_DOT[s]}`} />
                <h2 className="text-sm font-medium">{STAGE_LABEL[s]}</h2>
                <span className="rounded-full border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted">
                  {columns[s].length}
                </span>
              </div>
              <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-surface/30 p-2">
                {columns[s].length === 0 ? (
                  <p className="p-3 text-center text-xs text-muted">Empty</p>
                ) : (
                  columns[s].map((contact) => {
                    const expanded = expandedId === contact.id;
                    return (
                      <div key={contact.id} className="card animate-fade-in flex flex-col gap-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(contact)}
                            className="min-w-0 flex-1 text-left"
                            aria-expanded={expanded}
                          >
                            <p className="truncate text-sm font-medium">{contact.name}</p>
                            {contact.company && (
                              <p className="truncate text-xs text-muted">{contact.company}</p>
                            )}
                          </button>
                          <button
                            type="button"
                            className="shrink-0 text-xs text-muted transition-colors hover:text-danger"
                            onClick={() => handleDelete(contact)}
                            aria-label={`Delete ${contact.name}`}
                          >
                            ✕
                          </button>
                        </div>

                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="truncate text-xs text-accent hover:underline"
                          >
                            {contact.email}
                          </a>
                        )}

                        {!expanded && contact.notes && (
                          <p className="truncate text-xs text-foreground/70">{contact.notes}</p>
                        )}

                        {expanded && (
                          <div className="animate-fade-in flex flex-col gap-2">
                            <input
                              className="input w-full text-xs"
                              placeholder="Name"
                              aria-label="Name"
                              value={draftName}
                              onChange={(e) => setDraftName(e.target.value)}
                            />
                            <input
                              type="email"
                              className="input w-full text-xs"
                              placeholder="Email"
                              aria-label="Email"
                              value={draftEmail}
                              onChange={(e) => setDraftEmail(e.target.value)}
                            />
                            <input
                              className="input w-full text-xs"
                              placeholder="Company"
                              aria-label="Company"
                              value={draftCompany}
                              onChange={(e) => setDraftCompany(e.target.value)}
                            />
                            <textarea
                              className="input w-full text-xs"
                              rows={4}
                              placeholder="Notes about this contact..."
                              aria-label="Notes"
                              value={draftNotes}
                              onChange={(e) => setDraftNotes(e.target.value)}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="btn btn-secondary px-2 py-1 text-xs"
                                onClick={() => setExpandedId(null)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary px-2 py-1 text-xs"
                                onClick={() => handleSaveContact(contact)}
                                disabled={savingContact || !draftName.trim()}
                              >
                                {savingContact ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        )}

                        <select
                          className="input mt-1 w-full text-xs"
                          value={contact.stage}
                          onChange={(e) => handleStageChange(contact, e.target.value as Stage)}
                          aria-label={`Stage for ${contact.name}`}
                        >
                          {STAGES.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt === contact.stage ? STAGE_LABEL[opt] : `Move to ${STAGE_LABEL[opt]}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
