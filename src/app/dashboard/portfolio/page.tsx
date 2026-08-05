"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Holding = {
  id: string;
  user_id: string;
  symbol: string;
  quantity: number;
  cost_basis: number;
  created_at: string;
};

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUnit(value: number): string {
  if (!isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function PortfolioPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costBasis, setCostBasis] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editCostBasis, setEditCostBasis] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadHoldings = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .order("created_at", { ascending: false });
    if (fetchErr) {
      setLoadError(fetchErr.message);
    } else {
      setLoadError(null);
      setHoldings((data ?? []) as Holding[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadHoldings();
    })();
  }, [supabase, loadHoldings]);

  const totalCostBasis = useMemo(
    () => holdings.reduce((sum, h) => sum + (Number(h.cost_basis) || 0), 0),
    [holdings],
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedSymbol = symbol.trim().toUpperCase();
    const qty = parseFloat(quantity);
    const cost = parseFloat(costBasis);

    if (!trimmedSymbol) {
      setError("Enter a ticker symbol.");
      return;
    }
    if (!isFinite(qty) || qty <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }
    if (!isFinite(cost) || cost < 0) {
      setError("Cost basis must be a non-negative number.");
      return;
    }
    if (!userId) {
      setError("You must be signed in.");
      return;
    }

    setSaving(true);
    const { data, error: insertError } = await supabase
      .from("portfolio_holdings")
      .insert({
        user_id: userId,
        symbol: trimmedSymbol,
        quantity: qty,
        cost_basis: cost,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
    } else if (data) {
      setHoldings((prev) => [data as Holding, ...prev]);
      setSymbol("");
      setQuantity("");
      setCostBasis("");
    }
    setSaving(false);
  };

  const startEdit = (holding: Holding) => {
    setError(null);
    setEditingId(holding.id);
    setEditQuantity(String(Number(holding.quantity) || 0));
    setEditCostBasis(String(Number(holding.cost_basis) || 0));
  };

  const handleSaveEdit = async (holding: Holding) => {
    const qty = parseFloat(editQuantity);
    const cost = parseFloat(editCostBasis);
    if (!isFinite(qty) || qty <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }
    if (!isFinite(cost) || cost < 0) {
      setError("Cost basis must be a non-negative number.");
      return;
    }
    setError(null);
    setSavingEdit(true);
    const { data, error: updateError } = await supabase
      .from("portfolio_holdings")
      .update({ quantity: qty, cost_basis: cost })
      .eq("id", holding.id)
      .select()
      .single();
    if (updateError || !data) {
      setError(updateError?.message ?? "Could not save that holding. Try again.");
    } else {
      setHoldings((prev) => prev.map((h) => (h.id === holding.id ? (data as Holding) : h)));
      setEditingId(null);
    }
    setSavingEdit(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this holding? This cannot be undone.")) return;
    if (editingId === id) setEditingId(null);
    const prev = holdings;
    setHoldings((h) => h.filter((row) => row.id !== id));
    const { error: deleteError } = await supabase.from("portfolio_holdings").delete().eq("id", id);
    if (deleteError) {
      setHoldings(prev);
      setError(deleteError.message);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Portfolio Tracker</h1>
        <p className="mt-1 text-xs text-muted">
          Manual tracking only — not financial advice, no live prices, no market value or
          gain/loss. Cost basis is whatever you enter, in USD.
        </p>
      </div>

      <form onSubmit={handleAdd} className="card animate-fade-in flex flex-col gap-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="symbol">
              Symbol / ticker
            </label>
            <input
              id="symbol"
              className="input w-full"
              placeholder="e.g. AAPL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="quantity">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              step="any"
              min="0"
              className="input w-full"
              placeholder="e.g. 10"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="costBasis">
              Cost basis ($ total paid)
            </label>
            <input
              id="costBasis"
              type="number"
              step="any"
              min="0"
              className="input w-full"
              placeholder="e.g. 1500"
              value={costBasis}
              onChange={(e) => setCostBasis(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div>
          <button type="submit" className="btn btn-primary text-sm" disabled={saving}>
            {saving ? "Adding…" : "Add holding"}
          </button>
        </div>
      </form>

      <div className="card animate-fade-in overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-sm text-muted">Loading…</p>
        ) : loadError ? (
          <p className="p-6 text-sm text-danger">Could not load your holdings: {loadError}</p>
        ) : holdings.length === 0 ? (
          <p className="p-6 text-sm text-muted">
            No holdings yet. Add your first one above to start tracking what you own.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Symbol</th>
                <th className="px-4 py-2 font-medium">Quantity</th>
                <th className="px-4 py-2 font-medium">Cost basis</th>
                <th className="px-4 py-2 font-medium">Avg cost / unit</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const qty = Number(h.quantity) || 0;
                const cost = Number(h.cost_basis) || 0;
                const avg = qty > 0 ? cost / qty : NaN;
                const editing = editingId === h.id;
                return (
                  <tr key={h.id} className="border-b border-border last:border-b-0 hover:bg-surface-hover">
                    <td className="px-4 py-2 font-medium">{h.symbol}</td>
                    <td className="px-4 py-2 text-muted tnum">
                      {editing ? (
                        <input
                          className="input w-28 px-2 py-1 text-xs"
                          type="number"
                          step="any"
                          min="0"
                          autoFocus
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(e.target.value)}
                          aria-label={`Quantity for ${h.symbol}`}
                        />
                      ) : (
                        formatUnit(qty)
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted tnum">
                      {editing ? (
                        <input
                          className="input w-28 px-2 py-1 text-xs"
                          type="number"
                          step="any"
                          min="0"
                          value={editCostBasis}
                          onChange={(e) => setEditCostBasis(e.target.value)}
                          aria-label={`Cost basis for ${h.symbol}`}
                        />
                      ) : (
                        formatMoney(cost)
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted tnum">{isFinite(avg) ? formatMoney(avg) : "—"}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {editing ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(h)}
                              className="btn btn-primary text-xs"
                              disabled={savingEdit}
                            >
                              {savingEdit ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="btn btn-secondary text-xs"
                              disabled={savingEdit}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(h)} className="btn btn-secondary text-xs">
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(h.id)}
                              className="btn btn-secondary text-xs text-danger"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-medium">
                <td className="px-4 py-2" colSpan={2}>
                  Total cost basis
                </td>
                <td className="px-4 py-2 tnum">{formatMoney(totalCostBasis)}</td>
                <td className="px-4 py-2" colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
