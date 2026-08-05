import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Entry = {
  id: string;
  version: string;
  title: string;
  body: string;
  released_on: string;
};

function formatDate(value: string) {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("changelogs")
    .select("title")
    .eq("slug", slug)
    .maybeSingle();
  return { title: data?.title || "Changelog" };
}

export default async function PublicChangelogPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: changelog } = await supabase
    .from("changelogs")
    .select("id, slug, title")
    .eq("slug", slug)
    .maybeSingle();

  if (!changelog) notFound();

  const { data: entryData } = await supabase
    .from("changelog_entries")
    .select("id, version, title, body, released_on")
    .eq("changelog_id", changelog.id)
    .order("released_on", { ascending: false })
    .order("created_at", { ascending: false });

  const entries = (entryData ?? []) as Entry[];

  return (
    <main className="flex min-h-screen justify-center bg-background px-4 py-16">
      <div className="animate-fade-in w-full max-w-2xl">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{changelog.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {entries.length === 0
              ? "No releases published yet."
              : `${entries.length} ${entries.length === 1 ? "release" : "releases"}, newest first.`}
          </p>
        </header>

        {entries.length === 0 ? (
          <div className="card mt-10 p-8 text-center">
            <p className="text-sm text-muted">
              Nothing here yet — check back soon for the first release notes.
            </p>
          </div>
        ) : (
          <div className="mt-12 flex flex-col divide-y divide-border">
            {entries.map((entry, i) => (
              <article
                key={entry.id}
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                className="animate-fade-in flex flex-col gap-2 py-8 first:pt-0 sm:flex-row sm:gap-8"
              >
                <div className="flex shrink-0 flex-row items-center gap-2 sm:w-32 sm:flex-col sm:items-start sm:gap-1.5 sm:pt-0.5">
                  {entry.version ? (
                    <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs text-accent">
                      {entry.version}
                    </span>
                  ) : null}
                  <time
                    dateTime={entry.released_on}
                    className="text-xs text-muted"
                  >
                    {formatDate(entry.released_on)}
                  </time>
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    {entry.title}
                  </h2>
                  {entry.body ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                      {entry.body}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="mt-12 text-center text-xs text-muted">
          Made with <span className="text-foreground">VibeBundl</span>
        </p>
      </div>
    </main>
  );
}
