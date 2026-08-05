import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type LinkItem = {
  id: string;
  title: string;
  url: string;
  position: number;
};

export default async function PublicLinksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("links_profiles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!profile) notFound();

  const { data: items } = await supabase
    .from("links_items")
    .select("*")
    .eq("profile_id", profile.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  const links = (items ?? []) as LinkItem[];
  const initial = (profile.display_name || profile.slug || "?").charAt(0).toUpperCase();

  return (
    <main className="flex min-h-screen justify-center bg-background px-4 py-12">
      <div className="animate-fade-in flex w-full max-w-sm flex-col items-center text-center">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={profile.display_name ?? profile.slug}
            className="h-20 w-20 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-surface text-2xl font-semibold text-accent">
            {initial}
          </div>
        )}

        <h1 className="mt-4 text-lg font-semibold">
          {profile.display_name || `@${profile.slug}`}
        </h1>
        {profile.bio && (
          <p className="mt-1.5 text-sm text-muted">{profile.bio}</p>
        )}

        <div className="mt-8 flex w-full flex-col gap-3">
          {links.length === 0 ? (
            <p className="text-sm text-muted">No links here yet.</p>
          ) : (
            links.map((item, i) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                className="card animate-fade-in w-full px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-hover active:scale-[0.98]"
              >
                {item.title}
              </a>
            ))
          )}
        </div>

        <p className="mt-12 text-xs text-muted">
          Made with{" "}
          <span className="text-foreground">VibeBundl</span>
        </p>
      </div>
    </main>
  );
}
