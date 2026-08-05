"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import Spinner from "@/components/Spinner";

/**
 * The gap between paying and having access.
 *
 * Stripe redirects to `/dashboard?checkout=success` the instant the card is
 * accepted — typically well under a second, and always before
 * `checkout.session.completed` has reached our webhook, been verified, and
 * written a subscriptions row. On that first render `hasAccess` is still
 * false, so without this the customer sees "Subscribe — $19.99/mo" seconds
 * after being charged. That is the single worst screen in the product: it
 * reads as a failed payment, and the obvious response to it is to pay again.
 *
 * So we hold the space and poll. `router.refresh()` re-runs the server
 * layout, which re-reads the subscription; the moment the row lands,
 * `hasAccess` flips and this component is no longer rendered at all.
 *
 * If it never lands we stop guessing and say so plainly, with the two things
 * that actually help: the charge is real, and here is how to reach a human.
 */
const POLL_MS = 1500;
const GIVE_UP_MS = 25_000;

export default function CheckoutPending() {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > GIVE_UP_MS) {
        clearInterval(id);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="animate-fade-in card flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <Logo className="text-base" />

        {gaveUp ? (
          <>
            <h1 className="text-lg tracking-tight">Payment received — access is lagging</h1>
            <p className="text-sm leading-relaxed text-muted">
              Your card was charged and the subscription exists on Stripe&apos;s side. Ours
              hasn&apos;t caught up, which is our problem, not yours.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.location.reload()}
              >
                try again
              </button>
              <a className="btn btn-secondary" href="mailto:hello@vibebundl.com?subject=Checkout%20stuck">
                email us
              </a>
            </div>
            <p className="text-xs text-muted-2">
              Don&apos;t pay twice — we can see the charge.
            </p>
          </>
        ) : (
          <>
            <Spinner />
            <h1 className="text-lg tracking-tight">Setting up your bundle</h1>
            <p className="text-sm leading-relaxed text-muted">
              Payment went through. Stripe is confirming it with us — this takes a few
              seconds. Don&apos;t refresh.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
