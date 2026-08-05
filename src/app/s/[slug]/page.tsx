import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type BlockType = "heading" | "paragraph" | "image" | "button";

type Block = {
  id: string;
  type: BlockType;
  content: string;
  url?: string;
};

type Site = {
  id: string;
  slug: string;
  title: string;
  blocks: Block[];
  published: boolean;
};

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: site } = await supabase
    .from("sites")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (!site) notFound();

  const typedSite = site as Site;
  const blocks = Array.isArray(typedSite.blocks) ? typedSite.blocks : [];

  return (
    <main className="flex min-h-screen justify-center bg-background px-4 py-16">
      <div className="animate-fade-in flex w-full max-w-xl flex-col items-center gap-5 text-center">
        {blocks.length === 0 ? (
          <>
            <h1 className="text-2xl font-semibold">{typedSite.title}</h1>
            <p className="text-sm text-muted">This page has no content yet.</p>
          </>
        ) : (
          blocks.map((block, i) => (
            <div
              key={block.id}
              style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              className="animate-fade-in w-full"
            >
              {block.type === "heading" &&
                (i === 0 ? (
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {block.content}
                  </h1>
                ) : (
                  <h2 className="text-xl font-semibold tracking-tight">
                    {block.content}
                  </h2>
                ))}

              {block.type === "paragraph" && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {block.content}
                </p>
              )}

              {block.type === "image" && block.content && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={block.content}
                  alt=""
                  className="mx-auto max-h-[28rem] w-full rounded-lg border border-border object-cover"
                />
              )}

              {block.type === "button" && (
                <a
                  href={block.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary inline-flex"
                >
                  {block.content || "Learn more"}
                </a>
              )}
            </div>
          ))
        )}

        <p className="mt-8 text-xs text-muted">
          Made with{" "}
          <span className="text-foreground">VibeBundl</span>
        </p>
      </div>
    </main>
  );
}
