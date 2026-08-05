"use client";

import { usePathname, useSearchParams } from "next/navigation";
import CheckoutPending from "@/components/CheckoutPending";

/** Reachable without an active subscription. */
const ALWAYS_OPEN = new Set(["/dashboard/settings"]);

/**
 * Puts the subscribe wall in front of the tools — with two exceptions.
 *
 * Settings stays open, because that's where "Manage billing" lives. Gating
 * it behind an active subscription locks a customer whose card just expired
 * out of the one screen that lets them fix it, and leaves them staring at an
 * upsell for a bundle they already pay for.
 *
 * And someone arriving from Stripe with `?checkout=success` has paid, even
 * though the webhook may not have written their row yet. Showing them the
 * paywall in that window reads as a failed payment and invites a second
 * charge — so they get CheckoutPending, which waits for the row instead.
 */
export default function AccessGate({
  hasAccess,
  gate,
  children,
}: {
  hasAccess: boolean;
  gate: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (hasAccess || ALWAYS_OPEN.has(pathname ?? "")) return <>{children}</>;
  if (searchParams.get("checkout") === "success") return <CheckoutPending />;
  return <>{gate}</>;
}
