"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Envelope = {
  id: string;
  user_id: string;
  name: string;
  monthly_limit: number;
  period: string;
  created_at: string;
};

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  spent_on: string;
};

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Shift a "YYYY-MM" period by a number of months. */
function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date((y || 1970), (m || 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** First and last calendar day of a "YYYY-MM" period, as YYYY-MM-DD. */
function periodRange(period: string): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number);
  const year = y || 1970;
  const month = m || 1;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${period}-01`,
    end: `${period}-${String(lastDay).padStart(2, "0")}`,
  };
}

function formatPeriodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y || 1970, (m || 1) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export default function BudgetPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [period, setPeriod] = useState(currentPeriod);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New-envelope form
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const load = useCallback(
    async (uid: string, forPeriod: string) => {
      setLoading(true);
      setError(null);
      const { start, end } = periodRange(forPeriod);

      const [envRes, expRes] = await Promise.all([
        supabase
          .from("budget_envelopes")
          .select("id, user_id, name, monthly_limit, period, created_at")
          .eq("user_id", uid)
          .eq("period", forPeriod)
          .order("created_at", { ascending: true }),
        supabase
          .from("expenses")
          .select("id, description, amount, category, spent_on")
          .eq("user_id", uid)
          .gte("spent_on", start)
          .lte("spent_on", end)
          .order("spent_on", { ascending: false }),
      ]);

      if (envRes.error) {
        setError(envRes.error.message);
      } else if (expRes.error) {
        setError(expRes.error.message);
      } else {
        setEnvelopes((envRes.data ?? []) as Envelope[]);
        setExpenses((expRes.data ?? []) as Expense[]);
      }
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setLoading(false);
        setError("You need to be signed in to view your budget.");
        return;
      }
      setUserId(user.id);
      await load(user.id, period);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, load, period]);

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const key = normalize(e.category || "");
      map.set(key, (map.get(key) ?? 0) + Number(e.amount));
    }
    return map;
  }, [expenses]);

  const rows = useMemo(
    () =>
      envelopes.map((env) => {
        const limitNum = Number(env.monthly_limit) || 0;
        const spent = spentByCategory.get(normalize(env.name)) ?? 0;
        const remaining = limitNum - spent;
        const pct = limitNum > 0 ? (spent / limitNum) * 100 : spent > 0 ? 100 : 0;
        return { env, limitNum, spent, remaining, pct, over: spent > limitNum };
      }),
    [envelopes, spentByCategory],
  );

  const totals = useMemo(() => {
    const limitTotal = rows.reduce((s, r) => s + r.limitNum, 0);
    const spentTotal = rows.reduce((s, r) => s + r.spent, 0);
    return { limitTotal, spentTotal, remaining: limitTotal - spentTotal };
  }, [rows]);

  const unbudgeted = useMemo(() => {
    const budgeted = new Set(envelopes.map((e) => normalize(e.name)));
    const map = new Map<string, number>();
    for (const e of expenses) {
      const raw = e.category?.trim() || "Uncategorized";
      if (budgeted.has(normalize(raw))) continue;
      map.set(raw, (map.get(raw) ?? 0) + Number(e.amount));
    }
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [envelopes, expenses]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const trimmed = name.trim();
    const limitNum = limit.trim() === "" ? 0 : parseFloat(limit);
    if (!trimmed) {
      setFormError("Give the envelope a name — it should match an expense category.");
      return;
    }
    if (!Number.isFinite(limitNum) || limitNum < 0) {
      setFormError("Monthly limit must be a number of 0 or more.");
      return;
    }
    if (envelopes.some((env) => normalize(env.name) === normalize(trimmed))) {
      setFormError(`You already have a "${trimmed}" envelope this month.`);
      return;
    }

    setFormError(null);
    setCreating(true);
    const { data, error: insertErr } = await supabase
      .from("budget_envelopes")
      .insert({
        user_id: userId,
        name: trimmed,
        monthly_limit: limitNum,
        period,
      })
      .select("id, user_id, name, monthly_limit, period, created_at")
      .single();

    if (insertErr) {
      setFormError(insertErr.message);
    } else if (data) {
      setEnvelopes((prev) => [...prev, data as Envelope]);
      setName("");
      setLimit("");
    }
    setCreating(false);
  };

  const startEdit = (env: Envelope) => {
    setError(null);
    setEditingId(env.id);
    setEditValue(String(Number(env.monthly_limit) || 0));
  };

  const saveEdit = async (env: Envelope) => {
    const limitNum = editValue.trim() === "" ? 0 : parseFloat(editValue);
    if (!Number.isFinite(limitNum) || limitNum < 0) {
      setError("Monthly limit must be a number of 0 or more.");
      return;
    }
    if (limitNum === Number(env.monthly_limit)) {
      setEditingId(null);
      return;
    }

    setError(null);
    setSavingId(env.id);
    const { error: updateErr } = await supabase
      .from("budget_envelopes")
      .update({ monthly_limit: limitNum })
      .eq("id", env.id)
      .eq("user_id", env.user_id);

    if (updateErr) {
      setError(updateErr.message);
    } else {
      setEnvelopes((prev) =>
        prev.map((x) => (x.id === env.id ? { ...x, monthly_limit: limitNum } : x)),
      );
      setEditingId(null);
    }
    setSavingId(null);
  };

  const handleDelete = async (env: Envelope) => {
    if (!confirm(`Delete the "${env.name}" envelope? Your expenses are not affected.`)) return;
    setError(null);
    setDeletingId(env.id);
    const { error: deleteErr } = await supabase
      .from("budget_envelopes")
      .delete()
      .eq("id", env.id)
      .eq("user_id", env.user_id);

    if (deleteErr) {
      setError(deleteErr.message);
    } else {
      setEnvelopes((prev) => prev.filter((x) => x.id !== env.id));
    }
    setDeletingId(null);
  };

  const copyFromPreviousMonth = async () => {
    if (!userId) return;
    setError(null);
    setCopying(true);
    const prevPeriod = shiftPeriod(period, -1);
    const { data, error: fetchErr } = await supabase
      .from("budget_envelopes")
      .select("name, monthly_limit")
      .eq("user_id", userId)
      .eq("period", prevPeriod)
      .order("created_at", { ascending: true });

    if (fetchErr) {
      setError(fetchErr.message);
      setCopying(false);
      return;
    }
    const source = (data ?? []) as { name: string; monthly_limit: number }[];
    if (source.length === 0) {
      setError(`No envelopes in ${formatPeriodLabel(prevPeriod)} to copy.`);
      setCopying(false);
      return;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("budget_envelopes")
      .insert(
        source.map((s) => ({
          user_id: userId,
          name: s.name,
          monthly_limit: Number(s.monthly_limit) || 0,
          period,
        })),
      )
      .select("id, user_id, name, monthly_limit, period, created_at");

    if (insertErr) {
      setError(insertErr.message);
    } else if (inserted) {
      setEnvelopes((prev) => [...prev, ...(inserted as Envelope[])]);
    }
    setCopying(false);
  };

  const isCurrentMonth = period === currentPeriod();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Budget Envelopes</h1>
          <p className="mt-1 text-sm text-muted">
            Set a monthly limit per category. Spending comes straight from your Expense Tracker —
            an envelope matches expenses whose category equals its name.
          </p>
          <p className="mt-1 text-xs text-muted">
            Amounts are in USD. Envelopes are per month and do not roll unspent money forward.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="btn btn-secondary px-2.5 text-xs"
            onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <input
            type="month"
            className="input text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value || currentPeriod())}
            aria-label="Budget month"
          />
          <button
            type="button"
            className="btn btn-secondary px-2.5 text-xs"
            onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
            aria-label="Next month"
          >
            ›
          </button>
          {!isCurrentMonth && (
            <button
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => setPeriod(currentPeriod())}
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="card grid grid-cols-3 gap-3 p-4">
        <div>
          <p className="text-xs text-muted">Budgeted</p>
          <p className="text-lg font-semibold">{formatMoney(totals.limitTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Spent</p>
          <p className="text-lg font-semibold">{formatMoney(totals.spentTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Remaining</p>
          <p
            className={`text-lg font-semibold ${
              totals.remaining < 0 ? "text-danger" : "text-accent"
            }`}
          >
            {formatMoney(totals.remaining)}
          </p>
        </div>
      </div>

      {/* New envelope */}
      <form onSubmit={handleCreate} className="card flex flex-col gap-3 p-4">
        <p className="text-xs font-medium text-muted">
          New envelope for {formatPeriodLabel(period)}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input w-full sm:flex-1"
            placeholder="Envelope name (e.g. Meals)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input w-full sm:w-40"
            type="number"
            step="0.01"
            min="0"
            placeholder="Monthly limit"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary shrink-0 text-sm"
            disabled={creating || !name.trim()}
          >
            {creating ? "Adding…" : "Add envelope"}
          </button>
        </div>
        {formError && <p className="text-sm text-danger">{formError}</p>}
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Envelope list */}
      <div className="flex flex-col gap-2">
        {loading ? (
          <p className="px-1 text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted">
              No envelopes for {formatPeriodLabel(period)} yet. Add one above — name it exactly
              like the expense category you want it to track.
            </p>
            <button
              type="button"
              className="btn btn-secondary text-xs"
              onClick={copyFromPreviousMonth}
              disabled={copying}
            >
              {copying ? "Copying…" : `Copy envelopes from ${formatPeriodLabel(shiftPeriod(period, -1))}`}
            </button>
          </div>
        ) : (
          rows.map(({ env, limitNum, spent, remaining, pct, over }) => (
            <div key={env.id} className="card animate-fade-in flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{env.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatMoney(spent)} spent of{" "}
                    {editingId === env.id ? (
                      <input
                        className="input ml-1 w-28 px-2 py-0.5 text-xs"
                        type="number"
                        step="0.01"
                        min="0"
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(env)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveEdit(env);
                          } else if (e.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                        disabled={savingId === env.id}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(env)}
                        className="font-medium text-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-accent"
                        title="Edit monthly limit"
                      >
                        {formatMoney(limitNum)}
                      </button>
                    )}
                    {savingId === env.id && <span className="ml-2">Saving…</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${over ? "text-danger" : "text-accent"}`}>
                      {over
                        ? `${formatMoney(Math.abs(remaining))} over`
                        : `${formatMoney(remaining)} left`}
                    </p>
                    <p className="text-[11px] text-muted">{Math.round(pct)}% used</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md px-1.5 py-1 text-xs text-muted transition-colors hover:text-danger"
                    onClick={() => handleDelete(env)}
                    disabled={deletingId === env.id}
                    aria-label={`Delete ${env.name} envelope`}
                  >
                    {deletingId === env.id ? "…" : "✕"}
                  </button>
                </div>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className={`h-full rounded-full transition-all ${over ? "bg-danger" : "bg-accent"}`}
                  style={{ width: `${Math.min(Math.max(pct, spent > 0 ? 2 : 0), 100)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Spending with no envelope */}
      {!loading && unbudgeted.length > 0 && (
        <div className="card flex flex-col gap-2 p-4">
          <p className="text-xs font-medium text-muted">Unbudgeted spending this month</p>
          <div className="flex flex-col gap-1">
            {unbudgeted.map((u) => (
              <div key={u.category} className="flex items-center justify-between text-xs">
                <span className="truncate text-muted">{u.category}</span>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{formatMoney(u.total)}</span>
                  <button
                    type="button"
                    className="text-accent transition-colors hover:underline"
                    onClick={() => {
                      setName(u.category);
                      setLimit(String(Math.ceil(u.total)));
                      setFormError(null);
                    }}
                  >
                    Budget it
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
