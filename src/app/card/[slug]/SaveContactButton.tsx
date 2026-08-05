"use client";

import { useState } from "react";

export type ContactFields = {
  slug: string;
  fullName: string;
  jobTitle: string;
  company: string;
  email: string;
  phone: string;
  website: string;
};

/** Escape a value for a vCard 3.0 text field. */
function esc(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function buildVCard(c: ContactFields): string {
  const parts = c.fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts.length > 0 ? parts[0] : "";
  const last = parts.length > 1 ? parts.slice(1).join(" ") : "";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(c.fullName || c.slug)}`,
  ];

  if (c.jobTitle) lines.push(`TITLE:${esc(c.jobTitle)}`);
  if (c.company) lines.push(`ORG:${esc(c.company)}`);
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(c.email)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${esc(c.phone)}`);
  if (c.website) lines.push(`URL:${esc(c.website)}`);

  lines.push("END:VCARD");
  return lines.join("\r\n") + "\r\n";
}

export default function SaveContactButton({ contact }: { contact: ContactFields }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError(null);
    try {
      const blob = new Blob([buildVCard(contact)], {
        type: "text/vcard;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contact.slug || "contact"}.vcf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the contact file.");
    }
  }

  return (
    <div className="w-full">
      <button type="button" onClick={handleSave} className="btn btn-primary w-full py-3">
        {saved ? "Contact downloaded" : "Save contact"}
      </button>
      <p className="mt-2 text-xs text-muted">
        Downloads a .vcf file — open it to add the contact to your address book.
      </p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
