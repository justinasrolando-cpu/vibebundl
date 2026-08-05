import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type WikiPage = {
  id: string;
  slug: string;
  title: string;
  body: string;
  published: boolean;
  updated_at: string;
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Inline replacements. Input is ALREADY html-escaped by renderMarkdownLite.
function renderInline(text: string): string {
  return text
    .replace(
      /`([^`]+)`/g,
      '<code class="rounded bg-surface-hover px-1 py-0.5 font-mono text-[0.85em]">$1</code>',
    )
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
      const safe = /^(https?:\/\/|mailto:|\/)/i.test(url) ? url : "#";
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="text-accent underline underline-offset-2">${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// Markdown-lite: #/##/### headings, **bold**, *italic*, `code`, [text](url),
// "- " list items, and line breaks. HTML is escaped FIRST so nothing can be injected.
function renderMarkdownLite(input: string): string {
  const escaped = escapeHtml(input ?? "");
  const lines = escaped.split("\n");

  const out: string[] = [];
  let listItems: string[] = [];
  let paragraph: string[] = [];

  const flushList = () => {
    if (listItems.length) {
      out.push(
        `<ul class="my-4 list-disc space-y-1.5 pl-6">${listItems
          .map((li) => `<li>${renderInline(li)}</li>`)
          .join("")}</ul>`,
      );
      listItems = [];
    }
  };

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(
        `<p class="my-4">${paragraph.map((l) => renderInline(l)).join("<br/>")}</p>`,
      );
      paragraph = [];
    }
  };

  const headingClass: Record<number, string> = {
    1: "mt-8 mb-3 text-2xl font-semibold tracking-tight",
    2: "mt-7 mb-3 text-xl font-semibold tracking-tight",
    3: "mt-6 mb-2 text-lg font-semibold tracking-tight",
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      out.push(
        `<h${level + 1} class="${headingClass[level]}">${renderInline(heading[2])}</h${level + 1}>`,
      );
      continue;
    }

    const item = line.match(/^\s*[-+]\s+(.*)$/) ?? line.match(/^\s*\*\s+(.*)$/);
    if (item) {
      flushParagraph();
      listItems.push(item[1]);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return out.join("");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("wiki_pages")
    .select("title, body")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (!data) return { title: "Not found" };

  const title = (data.title as string) || "Untitled";
  const description = ((data.body as string) ?? "")
    .replace(/[#*`>_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  return { title, description: description || undefined };
}

export default async function PublicDocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // RLS exposes only published rows to anonymous visitors, so an unpublished or
  // missing slug simply yields no row.
  const { data } = await supabase
    .from("wiki_pages")
    .select("id, slug, title, body, published, updated_at")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (!data) notFound();

  const page = data as WikiPage;
  const html = renderMarkdownLite(page.body ?? "");
  const updated = page.updated_at ? new Date(page.updated_at) : null;

  return (
    <main className="flex min-h-screen justify-center bg-background px-5 py-16">
      <article className="animate-fade-in w-full max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          {page.title || "Untitled"}
        </h1>
        {updated && !Number.isNaN(updated.getTime()) && (
          <p className="mt-2 text-xs text-muted">
            Updated{" "}
            {updated.toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}

        <div className="mt-8 border-t border-border pt-8 text-[0.95rem] leading-[1.85] text-foreground/90">
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="text-sm text-muted">This page is empty for now.</p>
          )}
        </div>

        <p className="mt-16 text-xs text-muted">
          Made with <span className="text-foreground">VibeBundl</span>
        </p>
      </article>
    </main>
  );
}
