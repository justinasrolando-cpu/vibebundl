import { createClient } from "@/lib/supabase/server";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * How far past `current_period_end` a row may sit and still grant access.
 *
 * Renewal is asynchronous: Stripe charges the card, then delivers
 * `invoice.paid` and `customer.subscription.updated`, and the new period end
 * only reaches our row once we've processed them. A paying customer must
 * never be locked out because a webhook took a minute — or because Stripe
 * spent an hour retrying past a bad deploy. Three days absorbs all of that
 * and is still a long way short of "free forever".
 */
const GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export async function getActiveSubscription() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, hasAccess: false as const };

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  /* Status alone is not enough. It only changes when a webhook says so, so
     any window where /api/stripe/webhook is failing — a rotated signing
     secret, a broken deploy, a run of 5xx — freezes every row at whatever it
     last said. Stripe retries for about three days and then gives up
     silently, and a customer who cancelled keeps the whole bundle forever
     with nothing in the app that would ever notice. `current_period_end` is
     the independent fact that catches it: Stripe already told us when this
     period runs out, and that value is in the row we just read. */
  const periodEnd = sub?.current_period_end ? Date.parse(sub.current_period_end) : NaN;
  const notExpired = Number.isNaN(periodEnd) || periodEnd > Date.now() - GRACE_MS;

  const hasAccess = !!sub && ACTIVE_STATUSES.has(sub.status) && notExpired;
  return { user, hasAccess, subscription: sub };
}
