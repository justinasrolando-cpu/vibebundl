"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type FieldType = "text" | "email" | "textarea" | "select";

type Field = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
};

type FormRow = {
  id: string;
  slug: string;
  title: string;
  fields: Field[];
  created_at: string;
};

type FormResponse = {
  id: string;
  form_id: string;
  data: Record<string, string>;
  created_at: string;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function newFieldId() {
  return `f_${Math.random().toString(36).slice(2, 9)}`;
}

export default function FormsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // errors from row-level actions (field edits, delete, loading responses) —
  // kept separate so they surface next to the form they came from instead of
  // silently appearing in the "New form" card at the top of the page.
  const [actionError, setActionError] = useState<string | null>(null);

  // create-form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);

  // field builder state (for whichever form is expanded)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState("");
  const [savingFields, setSavingFields] = useState(false);

  // responses viewer state
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  async function loadForms(ownerId?: string | null) {
    setLoading(true);
    setError(null);

    const uid = ownerId ?? userId;
    if (!uid) {
      setForms([]);
      setCounts({});
      setError("You are signed out. Sign in again to see your forms.");
      setLoading(false);
      return;
    }

    // NOTE: forms has BOTH a public select policy and an owner policy, so the
    // user_id filter below is required — RLS alone returns every user's rows.
    const { data, error: formsError } = await supabase
      .from("forms")
      .select("id, slug, title, fields, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (formsError) {
      setError(formsError.message);
      setLoading(false);
      return;
    }

    // `fields` is jsonb — normalise it so every render path can assume an array.
    const list = ((data ?? []) as FormRow[]).map((f) => ({
      ...f,
      fields: Array.isArray(f.fields) ? f.fields : [],
    }));
    setForms(list);

    if (list.length > 0) {
      const { data: respData, error: respError } = await supabase
        .from("form_responses")
        .select("form_id")
        .in(
          "form_id",
          list.map((f) => f.id),
        );

      if (respError) {
        setError(respError.message);
      } else {
        const c: Record<string, number> = {};
        for (const row of respData ?? []) {
          const id = (row as { form_id: string }).form_id;
          c[id] = (c[id] ?? 0) + 1;
        }
        setCounts(c);
      }
    } else {
      setCounts({});
    }

    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadForms(user?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  async function handleCreateForm(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanSlug = slugify(slug);
    if (!cleanSlug) {
      setError("Slug is required.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!userId) {
      setError("You must be signed in.");
      return;
    }

    setCreating(true);

    const { error: insertError } = await supabase.from("forms").insert({
      user_id: userId,
      slug: cleanSlug,
      title: title.trim(),
      fields: [],
    });

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "That slug is already taken."
          : insertError.message,
      );
      setCreating(false);
      return;
    }

    setCreating(false);
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    await loadForms();
  }

  function resetFieldForm() {
    setFieldLabel("");
    setFieldType("text");
    setFieldRequired(false);
    setFieldOptions("");
  }

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
    setActionError(null);
    resetFieldForm();
  }

  async function handleAddField(form: FormRow) {
    setActionError(null);
    if (!fieldLabel.trim()) {
      setActionError("Field label is required.");
      return;
    }

    const selectOptions = fieldOptions
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    if (fieldType === "select" && selectOptions.length === 0) {
      setActionError(
        "A dropdown needs at least one option — list them comma-separated.",
      );
      return;
    }

    const newField: Field = {
      id: newFieldId(),
      label: fieldLabel.trim(),
      type: fieldType,
      required: fieldRequired,
      ...(fieldType === "select" ? { options: selectOptions } : {}),
    };

    setSavingFields(true);
    const updatedFields = [...form.fields, newField];

    const { error: updateError } = await supabase
      .from("forms")
      .update({ fields: updatedFields })
      .eq("id", form.id);

    setSavingFields(false);

    if (updateError) {
      setActionError(updateError.message);
      return;
    }

    resetFieldForm();
    await loadForms();
  }

  async function handleRemoveField(form: FormRow, fieldId: string) {
    setActionError(null);
    setSavingFields(true);

    const updatedFields = form.fields.filter((f) => f.id !== fieldId);

    const { error: updateError } = await supabase
      .from("forms")
      .update({ fields: updatedFields })
      .eq("id", form.id);

    setSavingFields(false);

    if (updateError) {
      setActionError(updateError.message);
      return;
    }

    await loadForms();
  }

  async function handleDeleteForm(form: FormRow) {
    const count = counts[form.id] ?? 0;
    if (
      !confirm(
        `Delete "${form.title}"?${count > 0 ? ` Its ${count} response${count === 1 ? "" : "s"} will be deleted too.` : ""} This cannot be undone.`,
      )
    ) {
      return;
    }

    setActionError(null);
    const { error: deleteError } = await supabase
      .from("forms")
      .delete()
      .eq("id", form.id);

    if (deleteError) {
      setActionError(deleteError.message);
      return;
    }

    if (viewingId === form.id) setViewingId(null);
    if (expandedId === form.id) setExpandedId(null);
    await loadForms();
  }

  async function toggleViewResponses(form: FormRow) {
    if (viewingId === form.id) {
      setViewingId(null);
      return;
    }

    setViewingId(form.id);
    setResponses([]);
    setLoadingResponses(true);
    setActionError(null);

    const { data, error: fetchError } = await supabase
      .from("form_responses")
      .select("id, form_id, data, created_at")
      .eq("form_id", form.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setActionError(fetchError.message);
      setLoadingResponses(false);
      return;
    }

    const rows = (data ?? []) as FormResponse[];
    setResponses(rows);
    // keep the header count in sync with what we just fetched
    setCounts((prev) => ({ ...prev, [form.id]: rows.length }));
    setLoadingResponses(false);
  }

  function handleExportCsv(form: FormRow) {
    const cols = form.fields;
    const header = ["submitted_at", ...cols.map((c) => c.label)];
    const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;

    const lines = [header.map(csvEscape).join(",")];
    for (const r of responses) {
      const row = [
        new Date(r.created_at).toISOString(),
        ...cols.map((c) => String(r.data?.[c.id] ?? "")),
      ];
      lines.push(row.map(csvEscape).join(","));
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.slug}-responses.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const publicOrigin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-lg font-semibold">Forms</h1>
      <p className="mt-1 text-sm text-muted">
        Build a form, share the public link, collect and export responses.
      </p>

      <form
        onSubmit={handleCreateForm}
        className="card animate-fade-in mt-6 flex flex-col gap-3 p-4"
      >
        <p className="text-sm font-medium">New form</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className="input"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Contact Us"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="slug">
              Slug
            </label>
            <input
              id="slug"
              className="input"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              placeholder="contact-us"
              required
            />
          </div>
        </div>

        {slug && (
          <p className="text-xs text-muted">
            Public URL:{" "}
            <span className="text-foreground">
              {publicOrigin}/f/{slugify(slug)}
            </span>
          </p>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? "Creating…" : "Create form"}
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-col gap-3">
        {/* builder errors render inside the open builder; this catches the rest */}
        {actionError && !expandedId && (
          <p className="text-sm text-danger">{actionError}</p>
        )}

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : forms.length === 0 ? (
          <div className="card p-4 text-sm text-muted">
            No forms yet. Create one above to get a public form page — then add
            fields to it and share the link.
          </div>
        ) : (
          forms.map((form, i) => (
            <div
              key={form.id}
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              className="card animate-fade-in flex flex-col gap-3 p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{form.title}</p>
                  <p className="truncate text-xs text-muted">
                    {publicOrigin}/f/{form.slug} · {form.fields.length}{" "}
                    {form.fields.length === 1 ? "field" : "fields"} ·{" "}
                    {counts[form.id] ?? 0}{" "}
                    {(counts[form.id] ?? 0) === 1 ? "response" : "responses"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <a
                    href={`/f/${form.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                  >
                    View
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => toggleExpand(form.id)}
                  >
                    {expandedId === form.id ? "Close builder" : "Edit fields"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => toggleViewResponses(form)}
                  >
                    {viewingId === form.id ? "Hide responses" : "View responses"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleDeleteForm(form)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedId === form.id && (
                <div className="animate-fade-in flex flex-col gap-3 border-t border-border pt-3">
                  {form.fields.length === 0 ? (
                    <p className="text-xs text-muted">
                      No fields yet. Until you add one, the public page has
                      nothing to submit.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {form.fields.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center justify-between rounded-md bg-surface px-3 py-1.5 text-xs"
                        >
                          <span className="truncate">
                            <span className="font-medium">{f.label}</span>{" "}
                            <span className="text-muted">
                              ({f.type}
                              {f.required ? ", required" : ""}
                              {f.type === "select" && f.options?.length
                                ? `: ${f.options.join(", ")}`
                                : ""}
                              )
                            </span>
                          </span>
                          <button
                            type="button"
                            className="ml-2 shrink-0 text-muted hover:text-danger"
                            onClick={() => handleRemoveField(form, f.id)}
                            disabled={savingFields}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {actionError && (
                    <p className="text-sm text-danger">{actionError}</p>
                  )}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <input
                      className="input sm:col-span-2"
                      placeholder="Field label"
                      value={fieldLabel}
                      onChange={(e) => setFieldLabel(e.target.value)}
                    />
                    <select
                      className="input"
                      value={fieldType}
                      onChange={(e) =>
                        setFieldType(e.target.value as FieldType)
                      }
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="textarea">Textarea</option>
                      <option value="select">Select</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={fieldRequired}
                        onChange={(e) => setFieldRequired(e.target.checked)}
                      />
                      Required
                    </label>
                  </div>

                  {fieldType === "select" && (
                    <input
                      className="input"
                      placeholder="Options, comma-separated (e.g. Red, Green, Blue)"
                      value={fieldOptions}
                      onChange={(e) => setFieldOptions(e.target.value)}
                    />
                  )}

                  <div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleAddField(form)}
                      disabled={savingFields}
                    >
                      {savingFields ? "Adding…" : "Add field"}
                    </button>
                  </div>
                </div>
              )}

              {viewingId === form.id && (
                <div className="animate-fade-in flex flex-col gap-3 border-t border-border pt-3">
                  {loadingResponses ? (
                    <p className="text-sm text-muted">Loading responses…</p>
                  ) : responses.length === 0 ? (
                    <p className="text-sm text-muted">
                      No responses yet. Share {publicOrigin}/f/{form.slug} and
                      submissions will land here.
                    </p>
                  ) : form.fields.length === 0 ? (
                    <p className="text-sm text-muted">
                      Add fields to this form to see structured responses.
                    </p>
                  ) : (
                    <>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleExportCsv(form)}
                        >
                          Export CSV
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-border text-muted">
                              <th className="whitespace-nowrap px-2 py-1.5 font-medium">
                                Submitted
                              </th>
                              {form.fields.map((f) => (
                                <th
                                  key={f.id}
                                  className="whitespace-nowrap px-2 py-1.5 font-medium"
                                >
                                  {f.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {responses.map((r) => (
                              <tr
                                key={r.id}
                                className="border-b border-border/50"
                              >
                                <td className="whitespace-nowrap px-2 py-1.5 text-muted">
                                  {new Date(r.created_at).toLocaleString()}
                                </td>
                                {form.fields.map((f) => (
                                  <td
                                    key={f.id}
                                    className="px-2 py-1.5"
                                  >
                                    {String(r.data?.[f.id] ?? "")}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
