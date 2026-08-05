import { redirect } from "next/navigation";
import { getActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import SettingsForm from "@/components/SettingsForm";

export const metadata = { title: "Settings — VibeBundl" };

/**
 * Dates are formatted here rather than in the client component: a client
 * component still server-renders, and `Intl` with the ambient locale would
 * produce a different string on each side and trip hydration.
 */
function formatRenewal(value: unknown): string | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function SettingsPage() {
  const session = await getActiveSubscription();
  if (!session.user) redirect("/login?next=/dashboard/settings");

  const user = session.user;
  const subscription = "subscription" in session ? session.subscription : null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, accent")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <SettingsForm
      userId={user.id}
      email={user.email ?? ""}
      initialDisplayName={typeof profile?.display_name === "string" ? profile.display_name : ""}
      status={typeof subscription?.status === "string" ? subscription.status : null}
      renewsOn={formatRenewal(subscription?.current_period_end)}
      hasAccess={session.hasAccess}
    />
  );
}
