import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VoteBox from "./VoteBox";

type Poll = {
  id: string;
  slug: string;
  question: string;
  options: string[] | null;
};

export default async function PublicPollPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: pollData } = await supabase
    .from("polls")
    .select("id, slug, question, options")
    .eq("slug", slug)
    .maybeSingle();

  if (!pollData) notFound();

  const poll = pollData as Poll;
  const options = poll.options ?? [];

  const { data: voteData } = await supabase
    .from("poll_votes")
    .select("option_index")
    .eq("poll_id", poll.id);

  const counts = new Array<number>(options.length).fill(0);
  for (const vote of (voteData ?? []) as { option_index: number }[]) {
    if (vote.option_index >= 0 && vote.option_index < counts.length) {
      counts[vote.option_index] += 1;
    }
  }

  const total = counts.reduce((sum, n) => sum + n, 0);

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">{poll.question}</h1>
          <p className="mt-1 text-sm text-muted">
            {total} {total === 1 ? "vote" : "votes"} so far · pick one option below.
          </p>
          <p className="mt-1 text-xs text-muted">
            Anonymous. One vote per browser — a soft check only, so clearing
            site data or switching browsers lets you vote again.
          </p>
        </div>

        <div className="card animate-fade-in p-4">
          <VoteBox
            pollId={poll.id}
            slug={poll.slug}
            options={options}
            initialCounts={counts}
          />
        </div>
      </div>
    </div>
  );
}
