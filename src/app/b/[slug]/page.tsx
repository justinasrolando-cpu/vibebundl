import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SuggestForm from "./SuggestForm";
import UpvoteButton from "./UpvoteButton";

type Post = {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "planned" | "in_progress" | "done";
  votes: number;
};

const STATUS_LABEL: Record<Post["status"], string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_BADGE_CLASS: Record<Post["status"], string> = {
  open: "bg-surface-hover text-muted",
  planned: "bg-accent/10 text-accent",
  in_progress: "bg-accent/10 text-accent",
  done: "bg-accent/20 text-accent",
};

export default async function FeedbackBoardPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: board } = await supabase
    .from("feedback_boards")
    .select("id, slug, title")
    .eq("slug", slug)
    .maybeSingle();

  if (!board) notFound();

  const { data: postsData } = await supabase
    .from("feedback_posts")
    .select("id, title, description, status, votes")
    .eq("board_id", board.id)
    .order("votes", { ascending: false });

  const posts = (postsData ?? []) as Post[];

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">{board.title}</h1>
          <p className="mt-1 text-sm text-muted">
            Suggest an idea or upvote the ones you want most.
          </p>
        </div>

        <div className="card animate-fade-in p-4">
          <p className="text-sm font-medium">Suggest an idea</p>
          <div className="mt-3">
            <SuggestForm boardId={board.id} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {posts.length === 0 ? (
            <div className="card p-4 text-sm text-muted">
              No feedback yet. Be the first to suggest an idea.
            </div>
          ) : (
            posts.map((post, i) => (
              <div
                key={post.id}
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                className="card animate-fade-in flex items-start gap-3 p-4"
              >
                <UpvoteButton postId={post.id} initialVotes={post.votes} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{post.title}</p>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs ${STATUS_BADGE_CLASS[post.status]}`}
                    >
                      {STATUS_LABEL[post.status]}
                    </span>
                  </div>
                  {post.description && (
                    <p className="mt-1 text-sm text-muted">{post.description}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
