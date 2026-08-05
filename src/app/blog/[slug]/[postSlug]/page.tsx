import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Blog = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
};

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  body: string;
  published_at: string | null;
  created_at: string;
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
        `<ul class="my-5 list-disc space-y-2 pl-6">${listItems
          .map((li) => `<li>${renderInline(li)}</li>`)
          .join("")}</ul>`,
      );
      listItems = [];
    }
  };

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(
        `<p class="my-5">${paragraph.map((l) => renderInline(l)).join("<br/>")}</p>`,
      );
      paragraph = [];
    }
  };

  const headingClass: Record<number, string> = {
    1: "mt-10 mb-4 text-2xl font-semibold tracking-tight",
    2: "mt-9 mb-3 text-xl font-semibold tracking-tight",
    3: "mt-7 mb-2 text-lg font-semibold tracking-tight",
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

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const supabase = await createClient();
  const { data: blogRow } = await supabase
    .from("blogs")
    .select("id, title")
    .eq("slug", slug)
    .maybeSingle();
  if (!blogRow) return { title: "Post" };
  const { data: postRow } = await supabase
    .from("blog_posts")
    .select("title")
    .eq("blog_id", blogRow.id)
    .eq("slug", postSlug)
    .eq("published", true)
    .maybeSingle();
  return {
    title: postRow?.title
      ? `${postRow.title}${blogRow.title ? ` — ${blogRow.title}` : ""}`
      : "Post",
  };
}

export default async function PublicBlogPostPage({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}) {
  const { slug, postSlug } = await params;
  const supabase = await createClient();

  const { data: blogRow } = await supabase
    .from("blogs")
    .select("id, slug, title, tagline")
    .eq("slug", slug)
    .maybeSingle();

  if (!blogRow) notFound();

  const blog = blogRow as Blog;

  // RLS restricts anonymous visitors to published posts, so an unpublished or
  // missing post simply yields no row.
  const { data: postRow } = await supabase
    .from("blog_posts")
    .select("id, slug, title, body, published_at, created_at")
    .eq("blog_id", blog.id)
    .eq("slug", postSlug)
    .eq("published", true)
    .maybeSingle();

  if (!postRow) notFound();

  const post = postRow as BlogPost;
  const html = renderMarkdownLite(post.body ?? "");
  const date = formatDate(post.published_at ?? post.created_at);

  return (
    <main className="flex min-h-screen justify-center bg-background px-5 py-16">
      <article className="animate-fade-in w-full max-w-2xl">
        <Link
          href={`/blog/${blog.slug}`}
          className="text-xs text-muted underline underline-offset-2 transition-colors hover:text-foreground"
        >
          ← {blog.title || "Back to blog"}
        </Link>

        <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-tight">
          {post.title || "Untitled"}
        </h1>
        {date && <p className="mt-2 text-xs text-muted">{date}</p>}

        <div className="mt-8 border-t border-border pt-8 text-[1.05rem] leading-[1.85] text-foreground/90">
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="text-sm text-muted">This post is empty for now.</p>
          )}
        </div>

        <div className="mt-16 border-t border-border pt-6">
          <Link
            href={`/blog/${blog.slug}`}
            className="text-sm text-accent underline underline-offset-2"
          >
            More posts on {blog.title || "this blog"}
          </Link>
          <p className="mt-6 text-xs text-muted">
            Made with <span className="text-foreground">VibeBundl</span>
          </p>
        </div>
      </article>
    </main>
  );
}
