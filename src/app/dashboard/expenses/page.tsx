"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Expense = {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  category: string;
  spent_on: string;
  created_at: string;
};

const FIXED_CATEGORIES = ["Software", "Travel", "Meals", "Office", "Other"] as const;

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function yearMonthOf(spentOn: string): string {
  // spent_on is "YYYY-MM-DD"
  return spentOn.slice(0, 7);
}

function formatMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function ExpensesPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form state
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(FIXED_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [spentOn, setSpentOn] = useState(todayIso());
  const [creating, setCreating] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from("expenses")
      .select("id, user_id, description, amount, category, spent_on, created_at")
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false });

    if (fetchErr) {
      setLoadError(fetchErr.message);
    } else {
      setLoadError(null);
      setExpenses((data ?? []) as Expense[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadExpenses();
    })();
  }, [supabase, loadExpenses]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError("You are signed out. Sign in again to log an expense.");
      return;
    }

    const amountNum = parseFloat(amount);
    if (!description.trim() || !Number.isFinite(amountNum) || amountNum <= 0 || !spentOn) {
      setError("Enter a description, a positive amount, and a date.");
      return;
    }

    const finalCategory =
      category === "Other" && customCategory.trim() ? customCategory.trim() : category;

    setError(null);
    setCreating(true);
    const { data, error: insertErr } = await supabase
      .from("expenses")
      .insert({
        user_id: userId,
        description: description.trim(),
        amount: amountNum,
        category: finalCategory,
        spent_on: spentOn,
      })
      .select()
      .single();

    if (!insertErr && data) {
      setExpenses((prev) =>
        [data as Expense, ...prev].sort((a, b) => {
          if (a.spent_on !== b.spent_on) return a.spent_on < b.spent_on ? 1 : -1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }),
      );
      setDescription("");
      setAmount("");
      setCustomCategory("");
      setSpentOn(todayIso());
    } else if (insertErr) {
      setError(insertErr.message);
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense? This cannot be undone.")) return;
    setActionError(null);
    setDeletingIds((prev) => new Set(prev).add(id));
    const { error: deleteErr } = await supabase.from("expenses").delete().eq("id", id);
    if (deleteErr) {
      setActionError(`Could not delete that expense: ${deleteErr.message}`);
    } else {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    }
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const currentYearMonth = useMemo(() => todayIso().slice(0, 7), []);

  const monthlyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const ym = yearMonthOf(e.spent_on);
      map.set(ym, (map.get(ym) ?? 0) + Number(e.amount));
    }
    return Array.from(map.entries())
      .map(([yearMonth, total]) => ({ yearMonth, total }))
      .sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : -1));
  }, [expenses]);

  const currentMonthTotal = useMemo(
    () => monthlyTotals.find((m) => m.yearMonth === currentYearMonth)?.total ?? 0,
    [monthlyTotals, currentYearMonth],
  );

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => set.add(e.category || "general"));
    return Array.from(set).sort();
  }, [expenses]);

  const visibleExpenses = useMemo(() => {
    if (!activeCategory) return expenses;
    return expenses.filter((e) => (e.category || "general") === activeCategory);
  }, [expenses, activeCategory]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const e of visibleExpenses) {
      const cat = e.category || "general";
      const entry = map.get(cat) ?? { total: 0, count: 0 };
      entry.total += Number(e.amount);
      entry.count += 1;
      map.set(cat, entry);
    }
    return Array.from(map.entries())
      .map(([cat, v]) => ({ category: cat, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [visibleExpenses]);

  const visibleTotal = useMemo(
    () => visibleExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    [visibleExpenses],
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Expense Tracker</h1>
        <p className="text-sm text-muted">Log expenses by category and keep an eye on monthly spend.</p>
        <p className="mt-0.5 text-xs text-muted">
          Manual entry only — no bank sync or receipt scanning. Amounts are treated as USD.
        </p>
      </div>

      {/* Add expense form */}
      <form onSubmit={handleCreate} className="card flex flex-col gap-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="input lg:col-span-2"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {FIXED_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="date"
            value={spentOn}
            onChange={(e) => setSpentOn(e.target.value)}
          />
        </div>

        {category === "Other" && (
          <input
            className="input"
            placeholder="Custom category name (optional, defaults to Other)"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
          />
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div>
          <button type="submit" className="btn btn-primary text-sm" disabled={creating}>
            {creating ? "Adding…" : "+ Add expense"}
          </button>
        </div>
      </form>

      {/* Monthly total */}
      <div className="card flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted">{formatMonthLabel(currentYearMonth)}</p>
            <p className="text-2xl font-semibold text-accent">{formatMoney(currentMonthTotal)}</p>
          </div>
          {monthlyTotals.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {monthlyTotals
                .filter((m) => m.yearMonth !== currentYearMonth)
                .slice(0, 5)
                .map((m) => (
                  <div
                    key={m.yearMonth}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted"
                  >
                    <span className="mr-1.5">{formatMonthLabel(m.yearMonth)}</span>
                    <span className="font-medium text-foreground">{formatMoney(m.total)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Category filter chips */}
      {categoryOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              activeCategory === null
                ? "border-accent text-accent"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            All
          </button>
          {categoryOptions.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                activeCategory === cat
                  ? "border-accent text-accent"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Category breakdown for visible set */}
      {categoryBreakdown.length > 0 && (
        <div className="card flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">
              Breakdown{activeCategory ? ` — ${activeCategory}` : ""}
            </p>
            <p className="text-xs text-muted">
              {visibleExpenses.length} expense{visibleExpenses.length === 1 ? "" : "s"} ·{" "}
              <span className="font-medium text-foreground">{formatMoney(visibleTotal)}</span>
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            {categoryBreakdown.map((b) => {
              const pct = visibleTotal > 0 ? (b.total / visibleTotal) * 100 : 0;
              return (
                <div key={b.category} className="flex items-center gap-3 text-xs">
                  <span className="w-24 shrink-0 truncate text-muted">{b.category}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right font-medium">{formatMoney(b.total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expense list */}
      <div className="flex flex-col gap-2">
        {actionError && <p className="text-sm text-danger">{actionError}</p>}
        {loading ? (
          <p className="px-1 text-sm text-muted">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-danger">Could not load your expenses: {loadError}</p>
        ) : visibleExpenses.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-muted">
              {expenses.length === 0
                ? "No expenses yet. Add your first one above."
                : "No expenses match this category filter."}
            </p>
          </div>
        ) : (
          visibleExpenses.map((exp) => (
            <div
              key={exp.id}
              className="animate-fade-in card flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{exp.description}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  <span>{formatDate(exp.spent_on)}</span>
                  <span>·</span>
                  <span className="text-accent">{exp.category || "general"}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-semibold">{formatMoney(Number(exp.amount))}</span>
                <button
                  className="btn btn-secondary text-xs text-danger"
                  onClick={() => handleDelete(exp.id)}
                  disabled={deletingIds.has(exp.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
