import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import ChatWidget from "./ChatWidget";

export default async function PublicChatWidgetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Service-role client: chat_bots has no public read policy, because that
  // would also expose every owner's knowledge_base. Only slug + name are
  // selected here, so nothing sensitive reaches the browser.
  const supabase = createAdminClient();

  const { data: bot } = await supabase
    .from("chat_bots")
    .select("slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!bot) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="card animate-fade-in flex h-[85vh] w-full max-w-lg flex-col overflow-hidden p-0">
        <ChatWidget slug={bot.slug} botName={bot.name ?? "Assistant"} />
      </div>
    </div>
  );
}
