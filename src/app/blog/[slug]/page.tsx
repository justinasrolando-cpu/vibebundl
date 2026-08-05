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

// Strip the markdown-lite markers so the excerpt reads as plain prose.
// React escapes this on render, so no HTML can leak through.
function excerpt(body: string, max = 160): string {
  const plain = (body ?? "")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^\s*[-+*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1")
    .replace(/[`*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trimEnd()}…`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("blogs")
    .select("title, tagline")
    .eq("slug", slug)
    .maybeSingle();
  return {
    title: data?.title || "Blog",
    description: data?.tagline || undefined,
  };
}

export default async function PublicBlogIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: blogRow } = await supabase
    .from("blogs")
    .select("id, slug, title, tagline")
    .eq("slug", slug)
    .maybeSingle();

  if (!blogRow) notFound();

  const blog = blogRow as Blog;

  // RLS exposes only published rows to anonymous visitors.
  const { data: postRows } = await supabase
    .from("blog_posts")
    .select("id, slug, title, body, published_at, created_at")
    .eq("blog_id", blog.id)
    .eq("published", true)
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });

  const posts = (postRows ?? []) as BlogPost[];

  return (
    <main className="flex min-h-screen justify-center bg-background px-5 py-16">
      <div className="animate-fade-in w-full max-w-2xl">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">
            {blog.title || "Blog"}
          </h1>
          {blog.tagline ? (
            <p className="mt-2 text-sm text-muted">{blog.tagline}</p>
          ) : null}
        </header>

        <div className="mt-10 border-t border-border pt-4">
          {posts.length === 0 ? (
            <p className="py-10 text-sm text-muted">
              No posts published yet. Check back soon — the first one is probably
              still a draft.
            </p>
          ) : (
            <ul className="flex flex-col">
              {posts.map((post) => (
                <li key={post.id} className="border-b border-border last:border-b-0">
                  <Link
                    href={`/blog/${blog.slug}/${post.slug}`}
                    className="group block py-6 transition-colors"
                  >
                    <h2 className="text-xl font-semibold tracking-tight transition-colors group-hover:text-accent">
                      {post.title || "Untitled"}
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(post.published_at ?? post.created_at)}
                    </p>
                    {excerpt(post.body) ? (
                      <p className="mt-3 text-[0.95rem] leading-relaxed text-foreground/80">
                        {excerpt(post.body)}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-16 text-xs text-muted">
          Made with <span className="text-foreground">VibeBundl</span>
        </p>
      </div>
    </main>
  );
}
