import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

// Status has to reflect the latest recorded check on every request — never
// serve a cached copy of this page.
export const dynamic = "force-dynamic";

type Monitor = {
  id: string;
  label: string | null;
  url: string;
  last_status: string | null;
  last_checked_at: string | null;
};

function formatRelative(iso: string | null) {
  if (!iso) return "never checked";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

function StatusDot({ status }: { status: string | null }) {
  const color =
    status === "up" ? "bg-accent" : status === "down" ? "bg-danger" : "bg-muted";
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />;
}

function statusLabel(status: string | null) {
  if (status === "up") return "Operational";
  if (status === "down") return "Down";
  return "Unknown";
}

function statusTextClass(status: string | null) {
  if (status === "up") return "text-accent";
  if (status === "down") return "text-danger";
  return "text-muted";
}

async function getStatusPage(slug: string) {
  const supabase = createAdminClient();

  const { data: statusPage } = await supabase
    .from("status_pages")
    .select("id, user_id, slug, title, monitor_ids")
    .eq("slug", slug)
    .maybeSingle();

  if (!statusPage) return null;

  const monitorIds: string[] = Array.isArray(statusPage.monitor_ids) ? statusPage.monitor_ids : [];

  let monitors: Monitor[] = [];
  if (monitorIds.length > 0) {
    // Ownership check: only monitors that both belong to this status page's
    // monitor_ids and are owned by the same user are ever returned.
    const { data } = await supabase
      .from("uptime_monitors")
      .select("id, label, url, last_status, last_checked_at")
      .in("id", monitorIds)
      .eq("user_id", statusPage.user_id);
    monitors = data ?? [];
  }

  return { title: statusPage.title as string, monitors };
}

export default async function PublicStatusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getStatusPage(slug);

  if (!result) notFound();

  const { title, monitors } = result;
  const allUp = monitors.length > 0 && monitors.every((m) => m.last_status === "up");
  const anyDown = monitors.some((m) => m.last_status === "down");

  return (
    <main className="flex min-h-screen justify-center bg-background px-4 py-16">
      <div className="animate-fade-in w-full max-w-xl">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {monitors.length > 0 && (
            <p className={`mt-2 text-sm ${anyDown ? "text-danger" : allUp ? "text-accent" : "text-muted"}`}>
              {anyDown
                ? "Some systems are experiencing issues"
                : allUp
                  ? "All systems operational"
                  : "Status unknown"}
            </p>
          )}
        </div>

        <div className="card mt-8 divide-y divide-border overflow-hidden p-0">
          {monitors.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted">No monitors are published on this status page yet.</p>
            </div>
          ) : (
            monitors.map((m, i) => (
              <div
                key={m.id}
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                className="animate-fade-in flex items-center justify-between gap-3 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <StatusDot status={m.last_status} />
                  <span className="truncate text-sm font-medium">{m.label || m.url}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <span className={statusTextClass(m.last_status)}>{statusLabel(m.last_status)}</span>
                  <span className="text-muted">{formatRelative(m.last_checked_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {monitors.length > 0 && (
          <p className="mt-4 text-center text-xs text-muted">
            Each row shows the result of the last recorded check, not a live probe.
          </p>
        )}

        <p className="mt-8 text-center text-xs text-muted">
          Made with <span className="text-foreground">VibeBundl</span>
        </p>
      </div>
    </main>
  );
}
