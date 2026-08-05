"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Recipe = {
  id: string;
  user_id: string;
  title: string;
  ingredients: string[] | null;
  steps: string | null;
  servings: number;
  tags: string[] | null;
  created_at: string;
};

type GroceryItem = {
  id: string;
  user_id: string;
  name: string;
  checked: boolean;
  created_at: string;
};

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

const EMPTY_INGREDIENTS = ["", "", ""];

export default function RecipesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [groceries, setGroceries] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Recipe editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("2");
  const [ingredients, setIngredients] = useState<string[]>(EMPTY_INGREDIENTS);
  const [steps, setSteps] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Browsing state
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyRecipeId, setBusyRecipeId] = useState<string | null>(null);
  const [recipeError, setRecipeError] = useState<string | null>(null);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  // Grocery state
  const [groceryName, setGroceryName] = useState("");
  const [addingGrocery, setAddingGrocery] = useState(false);
  const [groceryError, setGroceryError] = useState<string | null>(null);
  const [clearingChecked, setClearingChecked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setLoadError("You need to be signed in to use your recipe box.");
      return;
    }
    setUserId(user.id);

    const [recipeRes, groceryRes] = await Promise.all([
      supabase
        .from("recipes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("grocery_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
    ]);

    if (recipeRes.error) {
      setLoadError(recipeRes.error.message);
      setLoading(false);
      return;
    }
    if (groceryRes.error) {
      setLoadError(groceryRes.error.message);
      setLoading(false);
      return;
    }

    setRecipes((recipeRes.data ?? []) as Recipe[]);
    setGroceries((groceryRes.data ?? []) as GroceryItem[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // The editor lives above the list, so opening it from a recipe further down
  // would otherwise look like the Edit button did nothing.
  const editorRef = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (editorOpen) editorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [editorOpen, editingId]);

  /* ---------------------------------------------------------------- editor */

  const resetEditor = () => {
    setEditingId(null);
    setTitle("");
    setServings("2");
    setIngredients(EMPTY_INGREDIENTS);
    setSteps("");
    setTagsRaw("");
    setFormError(null);
  };

  const startNew = () => {
    resetEditor();
    setEditorOpen(true);
  };

  const startEdit = (recipe: Recipe) => {
    setEditingId(recipe.id);
    setTitle(recipe.title ?? "");
    setServings(String(recipe.servings ?? 2));
    const list = recipe.ingredients ?? [];
    setIngredients(list.length > 0 ? [...list] : [""]);
    setSteps(recipe.steps ?? "");
    setTagsRaw((recipe.tags ?? []).join(", "));
    setFormError(null);
    setEditorOpen(true);
  };

  const setIngredientAt = (index: number, value: string) => {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? value : ing)));
  };

  const addIngredientRow = () => setIngredients((prev) => [...prev, ""]);

  const removeIngredientRow = (index: number) => {
    setIngredients((prev) => (prev.length <= 1 ? [""] : prev.filter((_, i) => i !== index)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setFormError("You are signed out. Sign in again to save this recipe.");
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError("Give the recipe a title first.");
      return;
    }
    setFormError(null);
    setSaving(true);

    const parsedServings = Number.parseInt(servings, 10);
    const payload = {
      title: cleanTitle,
      ingredients: ingredients.map((i) => i.trim()).filter(Boolean),
      steps: steps,
      servings: Number.isFinite(parsedServings) && parsedServings > 0 ? parsedServings : 1,
      tags: parseTags(tagsRaw),
    };

    if (editingId) {
      const { data, error } = await supabase
        .from("recipes")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }
      setRecipes((prev) => prev.map((r) => (r.id === editingId ? (data as Recipe) : r)));
    } else {
      const { data, error } = await supabase
        .from("recipes")
        .insert({ user_id: userId, ...payload })
        .select()
        .single();
      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }
      setRecipes((prev) => [data as Recipe, ...prev]);
    }

    setSaving(false);
    setEditorOpen(false);
    resetEditor();
  };

  const handleDeleteRecipe = async (recipe: Recipe) => {
    if (!userId) {
      setRecipeError("You are signed out. Sign in again to delete recipes.");
      return;
    }
    if (!confirm(`Delete "${recipe.title}"? This cannot be undone.`)) return;
    setRecipeError(null);
    setBusyRecipeId(recipe.id);
    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", recipe.id)
      .eq("user_id", userId);
    if (error) {
      setRecipeError(error.message);
    } else {
      setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
      if (expandedId === recipe.id) setExpandedId(null);
      if (editingId === recipe.id) {
        setEditorOpen(false);
        resetEditor();
      }
    }
    setBusyRecipeId(null);
  };

  /* --------------------------------------------------------- grocery list */

  const addIngredientsToList = async (recipe: Recipe) => {
    if (!userId) {
      setRecipeError("You are signed out. Sign in again to update your grocery list.");
      return;
    }
    setRecipeError(null);
    setAddedNotice(null);
    setBusyRecipeId(recipe.id);

    const existing = new Set(groceries.map((g) => g.name.trim().toLowerCase()));
    const seen = new Set<string>();
    const toAdd: string[] = [];
    for (const raw of recipe.ingredients ?? []) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (existing.has(key) || seen.has(key)) continue;
      seen.add(key);
      toAdd.push(name);
    }

    if (toAdd.length === 0) {
      setAddedNotice(
        (recipe.ingredients ?? []).length === 0
          ? "That recipe has no ingredients yet."
          : "Everything from that recipe is already on your list.",
      );
      setBusyRecipeId(null);
      return;
    }

    const { data, error } = await supabase
      .from("grocery_items")
      .insert(toAdd.map((name) => ({ user_id: userId, name, checked: false })))
      .select();

    if (error) {
      setRecipeError(error.message);
    } else {
      setGroceries((prev) => [...prev, ...((data ?? []) as GroceryItem[])]);
      setAddedNotice(
        `Added ${toAdd.length} item${toAdd.length === 1 ? "" : "s"} to your grocery list.`,
      );
    }
    setBusyRecipeId(null);
  };

  const handleAddGrocery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setGroceryError("You are signed out. Sign in again to add items.");
      return;
    }
    const name = groceryName.trim();
    if (!name) return;
    setGroceryError(null);
    setAddingGrocery(true);
    const { data, error } = await supabase
      .from("grocery_items")
      .insert({ user_id: userId, name, checked: false })
      .select()
      .single();
    if (error) {
      setGroceryError(error.message);
    } else {
      setGroceries((prev) => [...prev, data as GroceryItem]);
      setGroceryName("");
    }
    setAddingGrocery(false);
  };

  const toggleGrocery = async (item: GroceryItem) => {
    const next = !item.checked;
    setGroceryError(null);
    setGroceries((prev) => prev.map((g) => (g.id === item.id ? { ...g, checked: next } : g)));
    const { error } = await supabase
      .from("grocery_items")
      .update({ checked: next })
      .eq("id", item.id)
      .eq("user_id", item.user_id);
    if (error) {
      setGroceries((prev) =>
        prev.map((g) => (g.id === item.id ? { ...g, checked: item.checked } : g)),
      );
      setGroceryError(error.message);
    }
  };

  const deleteGrocery = async (item: GroceryItem) => {
    setGroceryError(null);
    setGroceries((prev) => prev.filter((g) => g.id !== item.id));
    const { error } = await supabase
      .from("grocery_items")
      .delete()
      .eq("id", item.id)
      .eq("user_id", item.user_id);
    if (error) {
      setGroceries((prev) =>
        [...prev, item].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ),
      );
      setGroceryError(error.message);
    }
  };

  const clearChecked = async () => {
    if (!userId) return;
    const checkedItems = groceries.filter((g) => g.checked);
    if (checkedItems.length === 0) return;
    setGroceryError(null);
    setClearingChecked(true);
    const { error } = await supabase
      .from("grocery_items")
      .delete()
      .eq("user_id", userId)
      .eq("checked", true);
    if (error) {
      setGroceryError(error.message);
    } else {
      setGroceries((prev) => prev.filter((g) => !g.checked));
    }
    setClearingChecked(false);
  };

  /* ------------------------------------------------------------- derived */

  const allTags = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => (r.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      const matchesQuery =
        !q ||
        (r.title ?? "").toLowerCase().includes(q) ||
        (r.steps ?? "").toLowerCase().includes(q) ||
        (r.ingredients ?? []).some((i) => i.toLowerCase().includes(q));
      const matchesTag = !activeTag || (r.tags ?? []).includes(activeTag);
      return matchesQuery && matchesTag;
    });
  }, [recipes, search, activeTag]);

  const sortedGroceries = useMemo(
    () =>
      [...groceries].sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }),
    [groceries],
  );

  const checkedCount = groceries.filter((g) => g.checked).length;

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Recipe Box</h1>
          <p className="mt-1 text-sm text-muted">
            {recipes.length} recipe{recipes.length === 1 ? "" : "s"} ·{" "}
            {groceries.length - checkedCount} item
            {groceries.length - checkedCount === 1 ? "" : "s"} left to buy
          </p>
        </div>
        <button
          className="btn btn-primary text-sm"
          onClick={() => (editorOpen && !editingId ? setEditorOpen(false) : startNew())}
        >
          {editorOpen && !editingId ? "Close" : "+ New recipe"}
        </button>
      </div>

      {loadError && <p className="mt-4 text-sm text-danger">{loadError}</p>}

      {editorOpen && (
        <form
          ref={editorRef}
          onSubmit={handleSave}
          className="card animate-fade-in mt-5 flex flex-col gap-4 p-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {editingId ? "Edit recipe" : "New recipe"}
            </h2>
            <button
              type="button"
              className="text-xs text-muted transition-colors hover:text-foreground"
              onClick={() => {
                setEditorOpen(false);
                resetEditor();
              }}
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">Title</span>
              <input
                className="input w-full"
                placeholder="e.g. Weeknight tomato pasta"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">Servings</span>
              <input
                type="number"
                min={1}
                className="input w-full"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Ingredients</span>
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input w-full text-sm"
                  placeholder={i === 0 ? "400g spaghetti" : "Another ingredient…"}
                  value={ing}
                  onChange={(e) => setIngredientAt(i, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeIngredientRow(i)}
                  aria-label="Remove ingredient"
                  className="shrink-0 rounded-md px-2 text-xs text-muted transition-colors hover:text-danger"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addIngredientRow}
              className="self-start text-xs text-accent transition-colors hover:text-foreground"
            >
              + Add ingredient
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">Steps</span>
            <textarea
              className="input min-h-[140px] w-full resize-y text-sm leading-relaxed"
              placeholder={"1. Boil the water.\n2. Cook the pasta."}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">Tags, comma separated</span>
            <input
              className="input w-full text-sm"
              placeholder="dinner, vegetarian, quick"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
            />
          </div>

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary text-sm" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Save recipe"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* ------------------------------------------------------ recipes */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <input
              className="input w-full"
              placeholder="Search title, ingredients, or steps…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveTag(null)}
                  className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                    activeTag === null
                      ? "border-accent text-accent"
                      : "border-border text-muted hover:text-foreground"
                  }`}
                >
                  all
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                    className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                      activeTag === tag
                        ? "border-accent text-accent"
                        : "border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {recipeError && <p className="text-sm text-danger">{recipeError}</p>}
          {addedNotice && <p className="text-sm text-accent">{addedNotice}</p>}

          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : filteredRecipes.length === 0 ? (
            <p className="card p-6 text-sm text-muted">
              {recipes.length === 0
                ? "No recipes yet. Add your first one and its ingredients become a grocery list in one click."
                : "No recipes match your search or tag filter."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filteredRecipes.map((recipe) => {
                const expanded = expandedId === recipe.id;
                const ingredientList = recipe.ingredients ?? [];
                return (
                  <li key={recipe.id} className="card animate-fade-in p-4">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : recipe.id)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                      aria-expanded={expanded}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{recipe.title}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          Serves {recipe.servings} · {ingredientList.length} ingredient
                          {ingredientList.length === 1 ? "" : "s"}
                        </p>
                        {(recipe.tags ?? []).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {(recipe.tags ?? []).map((t) => (
                              <span
                                key={t}
                                className="rounded-full border border-border px-2 py-0.5 text-xs text-accent"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted">{expanded ? "▲" : "▼"}</span>
                    </button>

                    {expanded && (
                      <div className="animate-fade-in mt-4 flex flex-col gap-4 border-t border-border pt-4">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                            Ingredients
                          </h3>
                          {ingredientList.length === 0 ? (
                            <p className="mt-1 text-sm text-muted">
                              No ingredients saved for this recipe yet.
                            </p>
                          ) : (
                            <ul className="mt-1.5 flex flex-col gap-0.5">
                              {ingredientList.map((ing, i) => (
                                <li key={`${recipe.id}-ing-${i}`} className="text-sm">
                                  <span className="mr-2 text-muted">·</span>
                                  {ing}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                            Steps
                          </h3>
                          {(recipe.steps ?? "").trim() ? (
                            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                              {recipe.steps}
                            </p>
                          ) : (
                            <p className="mt-1 text-sm text-muted">No steps written yet.</p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-secondary text-xs"
                            onClick={() => addIngredientsToList(recipe)}
                            disabled={busyRecipeId === recipe.id}
                          >
                            {busyRecipeId === recipe.id
                              ? "Working…"
                              : "Add ingredients to grocery list"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary text-xs"
                            onClick={() => startEdit(recipe)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary text-xs text-danger"
                            onClick={() => handleDeleteRecipe(recipe)}
                            disabled={busyRecipeId === recipe.id}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ------------------------------------------------ grocery list */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Grocery list</h2>
            {checkedCount > 0 && (
              <button
                type="button"
                className="text-xs text-muted transition-colors hover:text-danger"
                onClick={clearChecked}
                disabled={clearingChecked}
              >
                {clearingChecked ? "Clearing…" : `Clear checked (${checkedCount})`}
              </button>
            )}
          </div>

          <form onSubmit={handleAddGrocery} className="flex gap-2">
            <input
              className="input w-full text-sm"
              placeholder="Add an item…"
              value={groceryName}
              onChange={(e) => setGroceryName(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary shrink-0 text-xs"
              disabled={addingGrocery || !groceryName.trim()}
            >
              {addingGrocery ? "…" : "Add"}
            </button>
          </form>

          {groceryError && <p className="text-sm text-danger">{groceryError}</p>}

          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : sortedGroceries.length === 0 ? (
            <p className="card p-4 text-sm text-muted">
              Your list is empty. Add an item above, or open a recipe and push its ingredients here.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {sortedGroceries.map((item) => (
                <li
                  key={item.id}
                  className="card animate-fade-in flex items-center gap-2.5 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleGrocery(item)}
                    aria-label={item.checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
                    className="h-3.5 w-3.5 shrink-0 accent-accent"
                  />
                  <span
                    className={`min-w-0 flex-1 truncate text-sm ${
                      item.checked ? "text-muted line-through" : "text-foreground"
                    }`}
                  >
                    {item.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteGrocery(item)}
                    aria-label={`Delete ${item.name}`}
                    className="shrink-0 rounded-md px-1 text-xs text-muted transition-colors hover:text-danger"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
