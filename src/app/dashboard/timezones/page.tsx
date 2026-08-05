"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

type RosterEntry = {
  id: string;
  user_id: string;
  person: string;
  timezone: string;
  created_at: string;
};

type Row = {
  id: string;
  person: string;
  timezone: string;
  isYou: boolean;
};

const WORK_START = 9;
const WORK_END = 17;

/** Used only when Intl.supportedValuesOf("timeZone") is unavailable. */
const FALLBACK_ZONES = [
  "UTC",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/Mexico_City",
  "America/New_York",
  "America/Toronto",
  "America/Bogota",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Atlantic/Reykjavik",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Vilnius",
  "Europe/Athens",
  "Europe/Kyiv",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Asia/Jerusalem",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** Intl.DateTimeFormat instances are expensive; reuse them across ticks. */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(
  key: string,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    formatterCache.set(key, f);
  }
  return f;
}

type ZoneClock = {
  hour: number;
  minute: number;
  second: number;
  /** YYYY-MM-DD in the target zone. */
  ymd: string;
};

function zoneClock(date: Date, timeZone: string): ZoneClock {
  const f = getFormatter(`clock:${timeZone}`, "en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of f.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  return {
    hour: Number(parts.hour ?? 0),
    minute: Number(parts.minute ?? 0),
    second: Number(parts.second ?? 0),
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function clockText(c: ZoneClock): string {
  return `${pad2(c.hour)}:${pad2(c.minute)}:${pad2(c.second)}`;
}

function dayText(date: Date, timeZone: string): string {
  return getFormatter(`day:${timeZone}`, undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Minutes the zone is ahead of UTC at this instant (handles DST). */
function offsetMinutes(date: Date, timeZone: string): number {
  const c = zoneClock(date, timeZone);
  const [y, m, d] = c.ymd.split("-").map(Number);
  const asUtc = Date.UTC(y, (m ?? 1) - 1, d ?? 1, c.hour, c.minute, c.second);
  const truncated = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / 60000);
}

function gmtLabel(minutes: number): string {
  const sign = minutes < 0 ? "−" : "+";
  const abs = Math.abs(minutes);
  return `GMT${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

function isWorkingHour(hour: number): boolean {
  return hour >= WORK_START && hour < WORK_END;
}

/* ---------------------------------------------------------------------------
 * A single shared 1s clock, exposed as an external store. Rendering the time
 * during SSR would mismatch on hydration, so the server snapshot is 0 and the
 * real clock only starts once the component subscribes on the client.
 * ------------------------------------------------------------------------- */
let tickMs = 0;
let tickTimer: ReturnType<typeof setInterval> | null = null;
const tickListeners = new Set<() => void>();

function subscribeTick(onChange: () => void): () => void {
  tickListeners.add(onChange);
  if (tickTimer === null) {
    tickMs = Date.now();
    tickTimer = setInterval(() => {
      tickMs = Date.now();
      for (const listener of tickListeners) listener();
    }, 1000);
  }
  return () => {
    tickListeners.delete(onChange);
    if (tickListeners.size === 0 && tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}

function getTick(): number {
  if (tickMs === 0) tickMs = Date.now();
  return tickMs;
}

function getServerTick(): number {
  return 0;
}

function getLocalZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

let cachedZoneList: string[] | null = null;

/** Intl.supportedValuesOf when the engine has it, otherwise a common-zone list. */
function getZoneList(): string[] {
  if (cachedZoneList) return cachedZoneList;
  let supported: string[] | null = null;
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      supported = Intl.supportedValuesOf("timeZone") as string[];
    } catch {
      supported = null;
    }
  }
  cachedZoneList = (supported && supported.length > 0 ? [...supported] : [...FALLBACK_ZONES]).sort();
  return cachedZoneList;
}

/** Validity never changes for a given string, and this runs on every 1s tick. */
const zoneValidity = new Map<string, boolean>();

function isValidZone(tz: string): boolean {
  const key = tz.trim();
  if (!key) return false;
  const cached = zoneValidity.get(key);
  if (cached !== undefined) return cached;
  let valid: boolean;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: key }).format(new Date());
    valid = true;
  } catch {
    valid = false;
  }
  zoneValidity.set(key, valid);
  return valid;
}

export default function TimezonesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [person, setPerson] = useState("");
  // null = untouched, so the field shows this browser's own zone as the default.
  const [timezone, setTimezone] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [offsetHours, setOffsetHours] = useState(0);

  // Client-only values (the server has a different clock and timezone).
  const nowMs = useSyncExternalStore(subscribeTick, getTick, getServerTick);
  const mounted = nowMs > 0;
  const now = useMemo(() => (nowMs > 0 ? new Date(nowMs) : null), [nowMs]);
  const localZone = useMemo(() => (mounted ? getLocalZone() : null), [mounted]);
  const zoneOptions = useMemo(() => {
    if (!localZone) return [];
    const list = getZoneList();
    return list.includes(localZone) ? list : [localZone, ...list].sort();
  }, [localZone]);
  const timezoneValue = timezone ?? localZone ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setLoadError("You need to be signed in to build a roster.");
      return;
    }
    setUserId(user.id);

    const { data, error } = await supabase
      .from("timezone_rosters")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      setLoadError(error.message);
    } else {
      setEntries((data ?? []) as RosterEntry[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = person.trim();
    const tz = timezoneValue.trim();
    if (!userId) {
      setFormError("You need to be signed in to add someone.");
      return;
    }
    if (!name) {
      setFormError("Give this person a name.");
      return;
    }
    if (!isValidZone(tz)) {
      setFormError(`"${tz}" is not a valid IANA timezone. Try Europe/Berlin.`);
      return;
    }

    setAdding(true);
    const { data, error } = await supabase
      .from("timezone_rosters")
      .insert({ user_id: userId, person: name, timezone: tz })
      .select()
      .single();

    if (error) {
      setFormError(error.message);
    } else if (data) {
      setEntries((prev) => [...prev, data as RosterEntry]);
      setPerson("");
    }
    setAdding(false);
  };

  const handleDelete = async (entry: RosterEntry) => {
    setRowError(null);
    setDeletingId(entry.id);
    const { error } = await supabase.from("timezone_rosters").delete().eq("id", entry.id);
    if (error) {
      setRowError(error.message);
    } else {
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    }
    setDeletingId(null);
  };

  const shifted = useMemo(
    () => (now ? new Date(now.getTime() + offsetHours * 3_600_000) : null),
    [now, offsetHours],
  );

  // UTC offsets only change on DST boundaries, so bucket the clock by the hour
  // instead of re-deriving zone data on every one-second tick.
  const hourBucket = nowMs > 0 ? Math.floor(nowMs / 3_600_000) : 0;

  const rows: Row[] = useMemo(() => {
    const valid = entries.filter((e) => isValidZone(e.timezone));
    const at = new Date(hourBucket * 3_600_000);
    const sorted = hourBucket
      ? [...valid].sort((a, b) => offsetMinutes(at, a.timezone) - offsetMinutes(at, b.timezone))
      : valid;
    const list: Row[] = sorted.map((e) => ({
      id: e.id,
      person: e.person,
      timezone: e.timezone,
      isYou: false,
    }));
    if (localZone) {
      list.unshift({ id: "__you", person: "You", timezone: localZone, isYou: true });
    }
    return list;
  }, [entries, localZone, hourBucket]);

  const strips = useMemo(() => {
    const map = new Map<string, { hour: number; working: boolean }[]>();
    if (!hourBucket) return map;
    const baseMs = hourBucket * 3_600_000;
    for (const row of rows) {
      if (map.has(row.timezone)) continue;
      const cells = Array.from({ length: 24 }, (_, i) => {
        const hour = zoneClock(new Date(baseMs + i * 3_600_000), row.timezone).hour;
        return { hour, working: isWorkingHour(hour) };
      });
      map.set(row.timezone, cells);
    }
    return map;
  }, [rows, hourBucket]);

  const offsetLabels = useMemo(() => {
    const map = new Map<string, string>();
    if (!hourBucket) return map;
    const at = new Date(hourBucket * 3_600_000);
    for (const row of rows) {
      if (!map.has(row.timezone)) map.set(row.timezone, gmtLabel(offsetMinutes(at, row.timezone)));
    }
    return map;
  }, [rows, hourBucket]);

  const workingCount = useMemo(() => {
    if (!shifted) return 0;
    return rows.filter((r) => isWorkingHour(zoneClock(shifted, r.timezone).hour)).length;
  }, [rows, shifted]);

  const invalidEntries = entries.filter((e) => !isValidZone(e.timezone));

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <div>
        <h1 className="text-lg font-semibold">Timezone Planner</h1>
        <p className="mt-1 text-sm text-muted">
          {entries.length === 0
            ? "See everyone's local time before you book the call."
            : `${entries.length} ${entries.length === 1 ? "person" : "people"} on your roster · ${workingCount} of ${rows.length} rows (you included) inside 09:00–17:00 at the selected hour`}
        </p>
      </div>

      <form onSubmit={handleAdd} className="card mt-5 flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input w-full sm:w-56"
            placeholder="Name (e.g. Mari)"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          />
          <input
            className="input w-full flex-1"
            list="tz-options"
            placeholder="Timezone (e.g. Europe/Berlin)"
            value={timezoneValue}
            onChange={(e) => setTimezone(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn-primary shrink-0 text-sm"
            disabled={adding || !person.trim() || !timezoneValue.trim()}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        <datalist id="tz-options">
          {zoneOptions.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <p className="text-xs text-muted">
          Type to search {zoneOptions.length > 0 ? `${zoneOptions.length} ` : ""}IANA zones, or paste
          one directly.
        </p>
        {formError && <p className="text-sm text-danger">{formError}</p>}
      </form>

      <div className="card mt-4 flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Meeting time</p>
            <p className="mt-0.5 font-mono text-sm">
              {shifted && localZone
                ? `${clockText(zoneClock(shifted, localZone))} · ${dayText(shifted, localZone)} (your time)`
                : "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">
              {offsetHours === 0 ? "Right now" : `Now +${offsetHours}h`}
            </span>
            <button
              type="button"
              className="btn btn-secondary px-2 py-1 text-xs"
              onClick={() => setOffsetHours(0)}
              disabled={offsetHours === 0}
            >
              Reset
            </button>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={23}
          step={1}
          value={offsetHours}
          onChange={(e) => setOffsetHours(Number(e.target.value))}
          aria-label="Hours from now"
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[10px] text-muted">
          <span>now</span>
          <span>+6h</span>
          <span>+12h</span>
          <span>+18h</span>
          <span>+23h</span>
        </div>
        <p className="text-xs text-muted">
          Planning only — this doesn&apos;t connect to a calendar, so picking an hour here books
          nothing. Working hours are assumed to be 09:00–17:00 local, every day.
        </p>
      </div>

      {rowError && <p className="mt-3 text-sm text-danger">{rowError}</p>}
      {loadError && <p className="mt-3 text-sm text-danger">{loadError}</p>}
      {invalidEntries.length > 0 && (
        <p className="mt-3 text-sm text-danger">
          {invalidEntries.length} saved{" "}
          {invalidEntries.length === 1 ? "entry has" : "entries have"} a timezone this browser
          doesn&apos;t recognise ({invalidEntries.map((e) => e.timezone).join(", ")}). Delete and
          re-add them.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          rows.map((row) => {
            const clock = shifted ? zoneClock(shifted, row.timezone) : null;
            const working = clock ? isWorkingHour(clock.hour) : false;
            const cells = strips.get(row.timezone) ?? [];
            const entry = entries.find((e) => e.id === row.id);
            return (
              <div key={row.id} className="card animate-fade-in flex flex-col gap-2.5 p-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {row.person}
                      {row.isYou && (
                        <span className="ml-1.5 text-xs text-muted">· this browser</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {row.timezone}
                      {offsetLabels.has(row.timezone) ? ` · ${offsetLabels.get(row.timezone)}` : ""}
                    </p>
                  </div>

                  <div
                    className={`shrink-0 rounded-md px-2.5 py-1 text-right ${
                      working ? "bg-accent/15 text-accent" : "bg-surface-hover text-muted"
                    }`}
                  >
                    <p className="font-mono text-sm tabular-nums">
                      {clock ? clockText(clock) : "--:--:--"}
                    </p>
                    <p className="text-[10px] opacity-80">
                      {shifted ? dayText(shifted, row.timezone) : "—"}
                    </p>
                  </div>

                  {entry ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(entry)}
                      disabled={deletingId === entry.id}
                      aria-label={`Remove ${row.person}`}
                      className="shrink-0 rounded-md px-1.5 py-1 text-xs text-muted transition-colors hover:text-danger disabled:opacity-50"
                    >
                      {deletingId === entry.id ? "…" : "✕"}
                    </button>
                  ) : (
                    <span className="w-6 shrink-0" aria-hidden="true" />
                  )}
                </div>

                {cells.length > 0 && (
                  <div className="flex gap-px overflow-hidden rounded">
                    {cells.map((cell, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setOffsetHours(i)}
                        title={`Now +${i}h · ${pad2(cell.hour)}:00 for ${row.person}`}
                        className={`h-5 flex-1 text-[9px] leading-5 transition-colors ${
                          cell.working
                            ? "bg-accent/15 text-accent"
                            : "bg-surface-hover text-muted/60"
                        } ${i === offsetHours ? "outline outline-1 outline-foreground/60" : ""}`}
                      >
                        {pad2(cell.hour)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {!loading && entries.length === 0 && (
          <p className="mt-1 text-sm text-muted">
            No one on your roster yet. Add a teammate above and their local time appears here, live.
          </p>
        )}
      </div>
    </div>
  );
}
