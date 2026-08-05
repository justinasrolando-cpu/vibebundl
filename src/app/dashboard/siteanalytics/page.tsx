"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Site = {
  id: string;
  user_id: string;
  slug: string;
  domain: string;
  created_at: string;
};

type AnalyticsEvent = {
  id: string;
  site_id: string;
  path: string;
  referrer: string | null;
  created_at: string;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** How many recent pageviews the breakdowns are computed from. */
const EVENT_SAMPLE_LIMIT = 5000;

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function SiteAnalyticsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);

  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const [newDomain, setNewDomain] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [totalViews, setTotalViews] = useState<number | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [siteUrl, setSiteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin);
  }, []);

  const loadSites = useCallback(async () => {
    setLoadingSites(true);
    const { data, error } = await supabase
      .from("analytics_sites")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
    } else {
      setLoadError(null);
      const rows = (data ?? []) as Site[];
      setSites(rows);
      setSelectedSiteId((prev) => prev ?? rows[0]?.id ?? null);
    }
    setLoadingSites(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await loadSites();
    })();
  }, [supabase, loadSites]);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) ?? null,
    [sites, selectedSiteId],
  );

  const loadEvents = useCallback(
    async (siteId: string) => {
      setLoadingEvents(true);
      const [eventsRes, countRes] = await Promise.all([
        supabase
          .from("analytics_events")
          .select("*")
          .eq("site_id", siteId)
          .order("created_at", { ascending: false })
          .limit(EVENT_SAMPLE_LIMIT),
        supabase
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("site_id", siteId),
      ]);

      if (eventsRes.error) {
        setLoadError(eventsRes.error.message);
        setEvents([]);
        setTotalViews(null);
      } else {
        setLoadError(null);
        setEvents((eventsRes.data ?? []) as AnalyticsEvent[]);
        setTotalViews(countRes.error ? (eventsRes.data ?? []).length : countRes.count ?? 0);
      }
      setLoadingEvents(false);
    },
    [supabase],
  );

  useEffect(() => {
    if (selectedSiteId) {
      loadEvents(selectedSiteId);
    } else {
      setEvents([]);
      setTotalViews(null);
    }
  }, [selectedSiteId, loadEvents]);

  const handleCreateSite = async () => {
    if (!userId) return;
    const domain = newDomain.trim();
    if (!domain) return;
    setCreating(true);
    setCreateError(null);

    const base = slugify(domain) || "site";
    const slug = `${base}-${randomSuffix()}`;

    const { data, error } = await supabase
      .from("analytics_sites")
      .insert({ user_id: userId, slug, domain })
      .select()
      .single();

    if (!error && data) {
      setSites((prev) => [data as Site, ...prev]);
      setSelectedSiteId((data as Site).id);
      setNewDomain("");
    } else if (error) {
      setCreateError(error.message);
    }
    setCreating(false);
  };

  const handleDeleteSite = async (site: Site) => {
    if (!confirm(`Delete tracked site "${site.domain}"? This removes all its pageview data.`)) return;
    setActionError(null);
    const { error } = await supabase.from("analytics_sites").delete().eq("id", site.id);
    if (error) {
      setActionError(`Could not delete that site: ${error.message}`);
      return;
    }
    const remaining = sites.filter((s) => s.id !== site.id);
    setSites(remaining);
    setSelectedSiteId((current) => (current === site.id ? remaining[0]?.id ?? null : current));
  };

  const pathCounts = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((e) => {
      const key = e.path || "/";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [events]);

  const referrerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((e) => {
      const key = e.referrer && e.referrer.trim() ? e.referrer : "Direct / none";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [events]);

  const pathBreakdown = useMemo(() => pathCounts.slice(0, 20), [pathCounts]);
  const referrerBreakdown = useMemo(() => referrerCounts.slice(0, 20), [referrerCounts]);

  const snippet = selectedSite
    ? `<script>
  fetch("${siteUrl}/api/analytics/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      site_slug: "${selectedSite.slug}",
      path: location.pathname,
      referrer: document.referrer || null,
    }),
  }).catch(function () {});
</script>`
    : "";

  const handleCopy = async () => {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Site Analytics</h1>
        <p className="mt-1 text-sm text-muted">
          Privacy-friendly pageview analytics. Add a site, drop the snippet on your pages, watch the numbers come in.
        </p>
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold">Add a site</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="input w-full sm:max-w-xs"
            placeholder="e.g. example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateSite()}
          />
          <button
            className="btn btn-primary text-sm"
            onClick={handleCreateSite}
            disabled={creating || !newDomain.trim()}
          >
            {creating ? "Adding…" : "+ Add site"}
          </button>
        </div>
        {createError && <p className="mt-2 text-sm text-danger">{createError}</p>}
      </div>

      {actionError && <p className="text-sm text-danger">{actionError}</p>}

      {loadingSites ? (
        <p className="text-sm text-muted">Loading sites…</p>
      ) : loadError ? (
        <p className="text-sm text-danger">Could not load your analytics: {loadError}</p>
      ) : sites.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">
            No sites tracked yet. Add a domain above to get a tracking snippet.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {sites.map((site) => (
              <button
                key={site.id}
                onClick={() => setSelectedSiteId(site.id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  site.id === selectedSiteId
                    ? "border-accent text-accent"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {site.domain}
              </button>
            ))}
          </div>

          {selectedSite && (
            <div className="animate-fade-in flex flex-col gap-6">
              <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{selectedSite.domain}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    slug: {selectedSite.slug} · added {formatDate(selectedSite.created_at)}
                  </p>
                </div>
                <button
                  className="btn btn-secondary self-start text-xs text-danger sm:self-auto"
                  onClick={() => handleDeleteSite(selectedSite)}
                >
                  Delete site
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="card p-4">
                  <p className="text-xs text-muted">Total pageviews</p>
                  <p className="mt-1 text-2xl font-semibold tnum">
                    {loadingEvents ? "…" : (totalViews ?? events.length).toLocaleString()}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-muted">Unique paths</p>
                  <p className="mt-1 text-2xl font-semibold tnum">
                    {loadingEvents ? "…" : pathCounts.length}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-muted">Referrer sources</p>
                  <p className="mt-1 text-2xl font-semibold tnum">
                    {loadingEvents ? "…" : referrerCounts.length}
                  </p>
                </div>
              </div>

              <p className="-mt-2 text-xs text-muted">
                Every page load counts as one pageview — there is no unique-visitor, session, or
                bot filtering.
                {totalViews !== null && totalViews > EVENT_SAMPLE_LIMIT
                  ? ` Breakdowns below are based on the most recent ${EVENT_SAMPLE_LIMIT.toLocaleString()} pageviews.`
                  : ""}
              </p>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="card p-4">
                  <h3 className="text-sm font-semibold">Top pages</h3>
                  {loadingEvents ? (
                    <p className="mt-3 text-sm text-muted">Loading…</p>
                  ) : pathBreakdown.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">No pageviews yet.</p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {pathBreakdown.map(([path, count]) => (
                        <li key={path} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-foreground">{path}</span>
                          <span className="shrink-0 text-xs text-muted">{count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="card p-4">
                  <h3 className="text-sm font-semibold">Top referrers</h3>
                  {loadingEvents ? (
                    <p className="mt-3 text-sm text-muted">Loading…</p>
                  ) : referrerBreakdown.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">No pageviews yet.</p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {referrerBreakdown.map(([ref, count]) => (
                        <li key={ref} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-foreground">{ref}</span>
                          <span className="shrink-0 text-xs text-muted">{count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Tracking snippet</h3>
                  <button className="btn btn-secondary text-xs" onClick={handleCopy}>
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Paste this before the closing &lt;/body&gt; tag of every page you want tracked on{" "}
                  {selectedSite.domain}.
                </p>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-surface p-3 text-xs leading-relaxed text-foreground">
                  <code>{snippet}</code>
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
