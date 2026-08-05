import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinForm from "./JoinForm";

export default async function WaitlistPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: waitlist } = await supabase
    .from("waitlists")
    .select("id, slug, title, description")
    .eq("slug", slug)
    .maybeSingle();

  if (!waitlist) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card animate-fade-in w-full max-w-md p-6">
        <h1 className="text-xl font-semibold">{waitlist.title}</h1>
        {waitlist.description && (
          <p className="mt-2 text-sm text-muted">{waitlist.description}</p>
        )}

        <div className="mt-5">
          <JoinForm waitlistId={waitlist.id} slug={waitlist.slug} />
        </div>
      </div>
    </div>
  );
}
