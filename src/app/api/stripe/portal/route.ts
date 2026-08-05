import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

/**
 * Opens the Stripe Billing Portal for the signed-in user.
 *
 * Returns the URL rather than a redirect: this is called with fetch() from
 * Settings, and a fetch can't turn a 30x into a top-level navigation — it
 * would follow it and hand back Stripe's HTML. Same contract as
 * /api/stripe/checkout, so the client-side handling is identical.
 *
 * The customer id is read from the caller's own subscriptions row, never
 * accepted from the request body — otherwise anyone could open anyone's
 * billing portal.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: subscription, error: readError } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json(
      { error: "We couldn't look up your billing account. Try again in a moment." },
      { status: 500 },
    );
  }

  const customer = subscription?.stripe_customer_id as string | undefined;

  if (!customer) {
    return NextResponse.json(
      {
        error:
          "There's no billing account on this login yet. Stripe creates one with your first subscription — start one and this will open.",
      },
      { status: 409 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${siteUrl}/dashboard/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: `Stripe wouldn't open the billing portal: ${message}` },
      { status: 502 },
    );
  }
}
