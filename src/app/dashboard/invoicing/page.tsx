"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Client = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  created_at: string;
};

type LineItem = {
  description: string;
  qty: number;
  rate: number;
};

type InvoiceStatus = "draft" | "sent" | "paid";

type Invoice = {
  id: string;
  user_id: string;
  client_id: string | null;
  number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  items: LineItem[];
  created_at: string;
};

const STATUS_ORDER: InvoiceStatus[] = ["draft", "sent", "paid"];

function emptyItem(): LineItem {
  return { description: "", qty: 1, rate: 0 };
}

function itemsTotal(items: LineItem[]): number {
  return items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusBadgeClass(status: InvoiceStatus): string {
  switch (status) {
    case "paid":
      return "bg-accent/15 text-accent border border-accent/30";
    case "sent":
      return "bg-surface-hover text-foreground border border-border";
    default:
      return "bg-surface-hover text-muted border border-border";
  }
}

function cleanItems(items: LineItem[]): LineItem[] {
  return items
    .map((it) => ({
      description: it.description.trim(),
      qty: Number(it.qty) || 0,
      rate: Number(it.rate) || 0,
    }))
    .filter((it) => it.description || it.qty || it.rate);
}

export default function InvoicingPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // client form
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [addingClient, setAddingClient] = useState(false);

  // invoice creation form
  const [selectedClientId, setSelectedClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // detail/edit view
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editItems, setEditItems] = useState<LineItem[]>([emptyItem()]);
  const [savingDetail, setSavingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailSaved, setDetailSaved] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // "From" block printed on the invoice. Stored in this browser only — there is
  // no company-profile table, so this never syncs across devices.
  const [fromDetails, setFromDetails] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [clientsRes, invoicesRes] = await Promise.all([
      supabase.from("invoice_clients").select("*").order("name", { ascending: true }),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
    ]);
    if (clientsRes.error || invoicesRes.error) {
      setLoadError(clientsRes.error?.message ?? invoicesRes.error?.message ?? "Could not load.");
    } else {
      setLoadError(null);
      setClients((clientsRes.data ?? []) as Client[]);
      setInvoices((invoicesRes.data ?? []) as Invoice[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadData();
    })();
  }, [supabase, loadData]);

  useEffect(() => {
    setFromDetails(window.localStorage.getItem("invoicing:from") ?? "");
  }, []);

  const updateFromDetails = (value: string) => {
    setFromDetails(value);
    try {
      window.localStorage.setItem("invoicing:from", value);
    } catch {
      // private mode / storage disabled — the invoice still prints without it.
    }
  };

  const clientById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  const selectedInvoice = useMemo(
    () => invoices.find((inv) => inv.id === selectedId) ?? null,
    [invoices, selectedId],
  );

  // Sync the detail editor whenever the selected invoice changes.
  useEffect(() => {
    if (selectedInvoice) {
      setEditNumber(selectedInvoice.number);
      setEditClientId(selectedInvoice.client_id ?? "");
      setEditIssueDate(selectedInvoice.issue_date);
      setEditDueDate(selectedInvoice.due_date ?? "");
      setEditItems(
        selectedInvoice.items && selectedInvoice.items.length > 0
          ? selectedInvoice.items.map((it) => ({ ...it }))
          : [emptyItem()],
      );
      setDetailError(null);
      setDetailSaved(false);
    }
    // Keyed on the id, not the object: saving replaces the invoice object, and
    // re-running this would wipe the "Saved" confirmation the moment it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInvoice?.id]);

  useEffect(() => {
    if (!detailSaved) return;
    const timer = setTimeout(() => setDetailSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [detailSaved]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    setActionError(null);
    if (!userId) {
      setActionError("You are signed out. Sign in again to add a client.");
      return;
    }
    setAddingClient(true);
    const { data, error } = await supabase
      .from("invoice_clients")
      .insert({ user_id: userId, name: clientName.trim(), email: clientEmail.trim() || null })
      .select()
      .single();
    if (error || !data) {
      setActionError(error?.message ?? "Could not add that client. Try again.");
    } else {
      setClients((prev) => [...prev, data as Client].sort((a, b) => a.name.localeCompare(b.name)));
      setClientName("");
      setClientEmail("");
    }
    setAddingClient(false);
  };

  const handleDeleteClient = async (client: Client) => {
    if (!confirm(`Delete client "${client.name}"? Their invoices will keep the record but lose the client link.`)) return;
    setActionError(null);
    const { error } = await supabase.from("invoice_clients").delete().eq("id", client.id);
    if (error) {
      setActionError(`Could not delete that client: ${error.message}`);
      return;
    }
    setClients((prev) => prev.filter((c) => c.id !== client.id));
    if (selectedClientId === client.id) setSelectedClientId("");
    if (editClientId === client.id) setEditClientId("");
    // The FK is ON DELETE SET NULL, so existing invoices keep their row but
    // lose the client link — mirror that locally instead of showing a stale name.
    setInvoices((prev) =>
      prev.map((inv) => (inv.client_id === client.id ? { ...inv, client_id: null } : inv)),
    );
  };

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const addItemRow = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItemRow = (index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const resetInvoiceForm = () => {
    setSelectedClientId("");
    setInvoiceNumber("");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setItems([emptyItem()]);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!userId) {
      setFormError("You are signed out. Sign in again to create an invoice.");
      return;
    }
    if (!invoiceNumber.trim()) {
      setFormError("Invoice number is required.");
      return;
    }
    const clean = cleanItems(items);
    if (clean.length === 0) {
      setFormError("Add at least one line item.");
      return;
    }

    setCreatingInvoice(true);
    const { data, error } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        client_id: selectedClientId || null,
        number: invoiceNumber.trim(),
        status: "draft",
        issue_date: issueDate,
        due_date: dueDate || null,
        items: clean,
      })
      .select()
      .single();
    if (!error && data) {
      setInvoices((prev) => [data as Invoice, ...prev]);
      resetInvoiceForm();
    } else if (error) {
      setFormError(error.message);
    }
    setCreatingInvoice(false);
  };

  const handleStatusChange = async (invoice: Invoice, status: InvoiceStatus) => {
    setActionError(null);
    setInvoices((prev) => prev.map((inv) => (inv.id === invoice.id ? { ...inv, status } : inv)));
    const { error } = await supabase.from("invoices").update({ status }).eq("id", invoice.id);
    if (error) {
      setInvoices((prev) => prev.map((inv) => (inv.id === invoice.id ? { ...inv, status: invoice.status } : inv)));
      setActionError(`Could not update that invoice: ${error.message}`);
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!confirm(`Delete invoice #${invoice.number}? This cannot be undone.`)) return;
    setActionError(null);
    const { error } = await supabase.from("invoices").delete().eq("id", invoice.id);
    if (error) {
      setActionError(`Could not delete that invoice: ${error.message}`);
      return;
    }
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoice.id));
    if (selectedId === invoice.id) setSelectedId(null);
  };

  // --- detail view editing ---

  const updateEditItem = (index: number, patch: Partial<LineItem>) => {
    setEditItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const addEditItemRow = () => setEditItems((prev) => [...prev, emptyItem()]);
  const removeEditItemRow = (index: number) => {
    setEditItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const editTotal = itemsTotal(editItems);

  const handleSaveDetail = async () => {
    if (!selectedInvoice) return;
    setDetailError(null);
    setDetailSaved(false);
    if (!editIssueDate) {
      setDetailError("Issue date is required.");
      return;
    }
    const clean = cleanItems(editItems);
    if (clean.length === 0) {
      setDetailError("Keep at least one line item.");
      return;
    }
    setSavingDetail(true);
    const { data, error } = await supabase
      .from("invoices")
      .update({
        number: editNumber.trim() || selectedInvoice.number,
        client_id: editClientId || null,
        issue_date: editIssueDate,
        due_date: editDueDate || null,
        items: clean,
      })
      .eq("id", selectedInvoice.id)
      .select()
      .single();
    if (error || !data) {
      setDetailError(error?.message ?? "Could not save those changes. Try again.");
    } else {
      setInvoices((prev) => prev.map((inv) => (inv.id === selectedInvoice.id ? (data as Invoice) : inv)));
      setDetailSaved(true);
    }
    setSavingDetail(false);
  };

  const draftTotal = itemsTotal(items);

  return (
    <div className="p-6">
      <style>{`
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-area {
            position: absolute;
            inset: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div className="no-print max-w-5xl mx-auto space-y-10">
        <div>
          <h1 className="text-2xl font-semibold">Invoicing</h1>
          <p className="text-muted text-sm mt-1">Clients and line-item invoices with print-to-PDF export.</p>
          <p className="text-muted text-xs mt-1">
            Amounts are in USD. Nothing is emailed or charged from here — export the PDF and send it
            yourself, then set the status manually when it is paid.
          </p>
        </div>

        {actionError && <p className="text-sm text-danger">{actionError}</p>}
        {loadError && (
          <p className="text-sm text-danger">Could not load your invoicing data: {loadError}</p>
        )}

        {/* Clients */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Clients</h2>
          <form onSubmit={handleAddClient} className="card p-4 flex flex-wrap gap-3 items-end animate-fade-in">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-muted mb-1">Name</label>
              <input
                className="input w-full"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Acme Inc."
                required
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-muted mb-1">Email (optional)</label>
              <input
                className="input w-full"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="billing@acme.com"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={addingClient || !clientName.trim()}>
              {addingClient ? "Adding…" : "Add client"}
            </button>
          </form>

          {clients.length === 0 && !loading ? (
            <div className="card p-6 text-sm text-muted text-center">
              No clients yet. Add one above to start invoicing them.
            </div>
          ) : (
            <div className="card divide-y divide-border animate-fade-in">
              {clients.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    {c.email && <div className="text-xs text-muted">{c.email}</div>}
                  </div>
                  <button className="btn btn-secondary text-danger" onClick={() => handleDeleteClient(c)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Invoices */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Invoices</h2>

          <form onSubmit={handleCreateInvoice} className="card p-4 space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Client</label>
                <select
                  className="input w-full"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  <option value="">No client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Invoice #</label>
                <input
                  className="input w-full"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-0001"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Issue date</label>
                <input
                  className="input w-full"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Due date</label>
                <input
                  className="input w-full"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted mb-2">Line items</label>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex flex-wrap gap-2 items-center">
                    <input
                      className="input flex-1 min-w-[160px]"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                    />
                    <input
                      className="input w-20"
                      type="number"
                      min={0}
                      step="1"
                      placeholder="Qty"
                      value={item.qty}
                      onChange={(e) => updateItem(i, { qty: Number(e.target.value) })}
                    />
                    <input
                      className="input w-28"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Rate"
                      value={item.rate}
                      onChange={(e) => updateItem(i, { rate: Number(e.target.value) })}
                    />
                    <div className="w-24 text-sm text-muted text-right">
                      {formatMoney((Number(item.qty) || 0) * (Number(item.rate) || 0))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary text-danger"
                      onClick={() => removeItemRow(i)}
                      disabled={items.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-secondary mt-2" onClick={addItemRow}>
                + Add row
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="text-sm">
                <span className="text-muted">Total: </span>
                <span className="font-semibold text-lg">{formatMoney(draftTotal)}</span>
              </div>
              <button type="submit" className="btn btn-primary" disabled={creatingInvoice}>
                {creatingInvoice ? "Creating…" : "Create invoice"}
              </button>
            </div>
            {formError && <div className="text-sm text-danger">{formError}</div>}
          </form>

          {loading ? (
            <div className="card p-6 text-sm text-muted text-center">Loading…</div>
          ) : invoices.length === 0 ? (
            <div className="card p-6 text-sm text-muted text-center">
              No invoices yet. Create one above to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => {
                const client = inv.client_id ? clientById.get(inv.client_id) : null;
                const total = itemsTotal(inv.items ?? []);
                return (
                  <div
                    key={inv.id}
                    className={`card w-full p-4 flex flex-wrap items-center justify-between gap-3 transition-colors animate-fade-in ${
                      selectedId === inv.id ? "border-accent" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(inv.id === selectedId ? null : inv.id)}
                      className="min-w-[180px] flex-1 text-left"
                      aria-expanded={selectedId === inv.id}
                    >
                      <div className="font-medium">#{inv.number}</div>
                      <div className="text-xs text-muted">
                        {client?.name ?? "No client"} · issued {formatDate(inv.issue_date)}
                        {inv.due_date ? ` · due ${formatDate(inv.due_date)}` : ""}
                      </div>
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold tnum">{formatMoney(total)}</span>
                      <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusBadgeClass(inv.status)}`}>
                        {inv.status}
                      </span>
                      <select
                        className="input"
                        aria-label={`Status for invoice ${inv.number}`}
                        value={inv.status}
                        onChange={(e) => handleStatusChange(inv, e.target.value as InvoiceStatus)}
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button className="btn btn-secondary text-danger" onClick={() => handleDeleteInvoice(inv)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Invoice detail / edit */}
        {selectedInvoice && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Invoice #{selectedInvoice.number}</h2>
              <div className="flex items-center gap-2">
                <button className="btn btn-secondary" onClick={() => setSelectedId(null)}>
                  Close
                </button>
                <button className="btn btn-secondary" onClick={handleSaveDetail} disabled={savingDetail}>
                  {savingDetail ? "Saving…" : "Save changes"}
                </button>
                <button className="btn btn-primary" onClick={() => window.print()}>
                  Print / Export PDF
                </button>
              </div>
            </div>

            <div className="card p-4 space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Client</label>
                  <select
                    className="input w-full"
                    value={editClientId}
                    onChange={(e) => setEditClientId(e.target.value)}
                  >
                    <option value="">No client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Invoice #</label>
                  <input
                    className="input w-full"
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Issue date</label>
                  <input
                    className="input w-full"
                    type="date"
                    value={editIssueDate}
                    onChange={(e) => setEditIssueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Due date</label>
                  <input
                    className="input w-full"
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-2">Line items</label>
                <div className="space-y-2">
                  {editItems.map((item, i) => (
                    <div key={i} className="flex flex-wrap gap-2 items-center">
                      <input
                        className="input flex-1 min-w-[160px]"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateEditItem(i, { description: e.target.value })}
                      />
                      <input
                        className="input w-20"
                        type="number"
                        min={0}
                        step="1"
                        placeholder="Qty"
                        value={item.qty}
                        onChange={(e) => updateEditItem(i, { qty: Number(e.target.value) })}
                      />
                      <input
                        className="input w-28"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Rate"
                        value={item.rate}
                        onChange={(e) => updateEditItem(i, { rate: Number(e.target.value) })}
                      />
                      <div className="w-24 text-sm text-muted text-right">
                        {formatMoney((Number(item.qty) || 0) * (Number(item.rate) || 0))}
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary text-danger"
                        onClick={() => removeEditItemRow(i)}
                        disabled={editItems.length <= 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary mt-2" onClick={addEditItemRow}>
                  + Add row
                </button>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1" htmlFor="from-details">
                  Your details (printed at the top of the invoice)
                </label>
                <textarea
                  id="from-details"
                  className="input w-full min-h-[70px] resize-y text-sm"
                  placeholder={"Your Company\n123 Your Street\nCity, ST 00000\nbilling@you.com"}
                  value={fromDetails}
                  onChange={(e) => updateFromDetails(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted">
                  Saved in this browser only — it is not stored in your account and will not follow
                  you to another device.
                </p>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-border">
                <div className="text-sm">
                  <span className="text-muted">Total: </span>
                  <span className="font-semibold text-lg tnum">{formatMoney(editTotal)}</span>
                </div>
              </div>

              {detailError && <p className="text-sm text-danger">{detailError}</p>}
              {detailSaved && <p className="text-xs text-accent">Saved.</p>}
            </div>
          </section>
        )}
      </div>

      {/* Print-only clean invoice layout */}
      {selectedInvoice && (
        <div className="print-area hidden print:block">
          <InvoicePaper
            invoice={selectedInvoice}
            items={editItems}
            client={editClientId ? clientById.get(editClientId) ?? null : null}
            number={editNumber || selectedInvoice.number}
            issueDate={editIssueDate}
            dueDate={editDueDate || null}
            fromDetails={fromDetails}
          />
        </div>
      )}
    </div>
  );
}

function InvoicePaper({
  invoice,
  items,
  client,
  number,
  issueDate,
  dueDate,
  fromDetails,
}: {
  invoice: Invoice;
  items: LineItem[];
  client: Client | null;
  number: string;
  issueDate: string;
  dueDate: string | null;
  fromDetails: string;
}) {
  const total = itemsTotal(items);
  const fromLines = fromDetails.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className="mx-auto max-w-2xl bg-white p-10 text-black">
      <div className="flex items-start justify-between border-b border-black/10 pb-6">
        <div>
          {fromLines.length > 0 ? (
            <>
              <p className="text-lg font-semibold">{fromLines[0]}</p>
              {fromLines.slice(1).map((line, i) => (
                <p key={i} className="text-sm text-black/60">
                  {line}
                </p>
              ))}
            </>
          ) : (
            <p className="text-sm text-black/40">
              Add your details in &quot;Your details&quot; above.
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold">INVOICE</p>
          <p className="mt-1 text-sm text-black/60">#{number}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-between text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-black/40">Bill to</p>
          <p className="mt-1 font-medium">{client?.name ?? "No client"}</p>
          {client?.email && <p className="text-black/60">{client.email}</p>}
        </div>
        <div className="text-right">
          <p>
            <span className="text-black/40">Issue date: </span>
            {formatDate(issueDate)}
          </p>
          <p>
            <span className="text-black/40">Due date: </span>
            {formatDate(dueDate)}
          </p>
          <p className="mt-1 capitalize">
            <span className="text-black/40">Status: </span>
            {invoice.status}
          </p>
        </div>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-black/20 text-left">
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Rate</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b border-black/10">
              <td className="py-2">{item.description || "—"}</td>
              <td className="py-2 text-right">{Number(item.qty) || 0}</td>
              <td className="py-2 text-right">{formatMoney(Number(item.rate) || 0)}</td>
              <td className="py-2 text-right">
                {formatMoney((Number(item.qty) || 0) * (Number(item.rate) || 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-56">
          <div className="flex justify-between border-t border-black/20 pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-16 text-xs text-black/50">Thank you for your business.</div>
    </div>
  );
}
