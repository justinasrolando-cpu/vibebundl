import { Suspense } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { redirect } from "next/navigation";
import { groupToolsByCategory, TOOLS } from "@/lib/tools";
import { getActiveSubscription } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import AccentScope from "@/components/AccentScope";
import { normalizeAccent } from "@/lib/accents";
import AccessGate from "@/components/AccessGate";
import SignOutButton from "@/components/SignOutButton";
import SettingsLink from "@/components/SettingsLink";
import SubscribeGate from "@/components/SubscribeGate";
import ToolNav from "@/components/ToolNav";
import MobileNav from "@/components/MobileNav";
import SponsorRail from "@/components/SponsorRail";
import ThemeToggle from "@/components/ThemeToggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, hasAccess } = await getActiveSubscription();
  if (!user) redirect("/login?next=/dashboard");

  // Read the accent here, on the server, so the app paints in the user's
  // colour on the first frame instead of flashing green and correcting.
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, accent")
    .eq("user_id", user.id)
    .maybeSingle();

  const groups = groupToolsByCategory();
  const email = user.email ?? "";
  const displayName = typeof profile?.display_name === "string" ? profile.display_name.trim() : "";
  const accent = normalizeAccent(profile?.accent);

  return (
    <AccentScope accent={accent} className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-background-elevated p-3 md:flex">
        <div className="flex items-center justify-between px-2 pt-1 pb-3">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            <Logo />
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="tnum font-mono text-[0.625rem] text-muted-2">{TOOLS.length}</span>
            <ThemeToggle />
          </div>
        </div>

        <ToolNav groups={groups} hasAccess={hasAccess} />

        {/* One card: a sponsor while a slot is sold, the offer while none is.
            See SponsorRail — it is never a row of placeholders. */}
        <SponsorRail variant="sidebar" className="mt-3 px-1" />

        <div className="mt-2 border-t border-border pt-2">
          {/* The growth loop, one click from every page of the app. */}
          <Link href="/request" className="nav-item w-full text-xs">
            <span className="flex w-4 shrink-0 justify-center text-accent" aria-hidden>
              +
            </span>
            Request a tool
          </Link>

          <div className="px-2 py-1">
            {displayName && (
              <p className="truncate text-xs font-medium tracking-tight">{displayName}</p>
            )}
            <p className="truncate text-[0.6875rem] text-muted-2">{email}</p>
          </div>
          <SettingsLink />
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav
          groups={groups}
          hasAccess={hasAccess}
          email={email}
          displayName={displayName}
        />
        {/* Suspense because AccessGate reads searchParams (for the
            post-checkout handoff) and Next requires a boundary around that. */}
        <Suspense fallback={null}>
          <AccessGate hasAccess={hasAccess} gate={<SubscribeGate />}>
            {children}
          </AccessGate>
        </Suspense>
      </div>
    </AccentScope>
  );
}
