"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export type Field = {
  id: string;
  label: string;
  type: "text" | "email" | "textarea" | "select";
  required: boolean;
  options?: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function FormRenderer({
  formId,
  fields,
}: {
  formId: string;
  fields: Field[];
}) {
  const supabase = createClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  function setValue(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    for (const field of fields) {
      const v = (values[field.id] ?? "").trim();
      if (field.required && !v) {
        setError(`"${field.label}" is required.`);
        return;
      }
      if (field.type === "email" && v && !EMAIL_RE.test(v)) {
        setError(`"${field.label}" must be a valid email address.`);
        return;
      }
    }

    setStatus("submitting");

    const { error: insertError } = await supabase.from("form_responses").insert({
      form_id: formId,
      data: values,
    });

    if (insertError) {
      setStatus("error");
      setError(insertError.message);
      return;
    }

    setStatus("success");
  }

  if (status === "success") {
    return (
      <p className="animate-fade-in text-sm text-accent">
        Thanks — your response was submitted.
      </p>
    );
  }

  if (fields.length === 0) {
    return (
      <p className="text-sm text-muted">
        This form has no fields yet.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {fields.map((field) => (
        <div key={field.id} className="flex flex-col gap-1">
          <label className="text-xs text-muted" htmlFor={field.id}>
            {field.label}
            {field.required && <span className="text-danger"> *</span>}
          </label>

          {field.type === "textarea" ? (
            <textarea
              id={field.id}
              className="input"
              rows={3}
              value={values[field.id] ?? ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              required={field.required}
            />
          ) : field.type === "select" ? (
            <select
              id={field.id}
              className="input"
              value={values[field.id] ?? ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              required={field.required}
            >
              <option value="">Select…</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={field.id}
              type={field.type === "email" ? "email" : "text"}
              className="input"
              value={values[field.id] ?? ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              required={field.required}
            />
          )}
        </div>
      ))}

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
