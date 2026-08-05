import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TOOLS } from "@/lib/tools";

/**
 * What is actually running, right now.
 *
 * This exists because "it builds" proved to mean nothing here. The dashboard
 * once shipped a 500 that compiled perfectly — a plain function imported from
 * a `"use client"` module and called on the server. `next build` was green,
 * the deploy was green, and every signed-in user hit a crash. Nothing in the
 * pipeline could have caught it, because the pipeline only ever asked whether
 * the code compiled.
 *
 * So this endpoint answers three questions a build cannot:
 *
 *   - Which commit is serving traffic? Without that, post-deploy checks race
 *     the deployment and can pass against the *previous* build, which is
 *     worse than no check at all — a green tick for code nobody tested.
 *   - Does a request-time code path still work end to end?
 *   - Can we reach the database from a serverless function?
 *
 * `force-dynamic` because a cached health check is a health check of the
 * past.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";

  /* A real round-trip, not a ping. public_stats() is a security-definer RPC,
     so this exercises the anon key, PostgREST, and function execution — the
     same path the landing page uses. */
  let database: "ok" | "unreachable" = "unreachable";
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("public_stats");
    if (!error) database = "ok";
  } catch {
    /* Leave it 'unreachable'. A health endpoint that throws is not a health
       endpoint — it has to be able to report bad news. */
  }

  /* Deliberately 200 even when the database is down: the deploy itself is
     healthy, and a red CI run for someone else's outage trains people to
     ignore red CI runs. The body carries the detail; the smoke test decides
     what it cares about. */
  return NextResponse.json(
    {
      ok: true,
      sha,
      database,
      tools: TOOLS.length,
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
