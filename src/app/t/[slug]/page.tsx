import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SubmitForm from "./SubmitForm";

type Testimonial = {
  id: string;
  author_name: string;
  content: string;
};

export default async function TestimonialsPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: space } = await supabase
    .from("testimonial_spaces")
    .select("id, slug, title")
    .eq("slug", slug)
    .maybeSingle();

  if (!space) notFound();

  // RLS limits this to approved=true for anonymous visitors, but the owner's
  // own "owner reads own testimonials" policy ORs in — without an explicit
  // filter the owner would see unapproved drafts on their own public page.
  const { data: testimonialsData } = await supabase
    .from("testimonials")
    .select("id, author_name, content")
    .eq("space_id", space.id)
    .eq("approved", true)
    .order("created_at", { ascending: false });

  const testimonials = (testimonialsData ?? []) as Testimonial[];

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <div className="animate-fade-in text-center">
          <h1 className="text-2xl font-semibold">{space.title}</h1>
          <p className="mt-1 text-sm text-muted">Wall of love</p>
        </div>

        {testimonials.length === 0 ? (
          <div className="card animate-fade-in mt-8 p-6 text-center text-sm text-muted">
            No testimonials yet. Be the first to leave one below.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {testimonials.map((t, i) => (
              <div
                key={t.id}
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                className="card animate-fade-in flex flex-col gap-3 p-5"
              >
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  &ldquo;{t.content}&rdquo;
                </p>
                <p className="text-xs font-medium text-muted">
                  — {t.author_name || "Anonymous"}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10">
          <SubmitForm spaceId={space.id} slug={space.slug} />
        </div>
      </div>
    </div>
  );
}
