import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { readEntries, readGlobal } from "@/lib/content/store";

/**
 * Reporting queries for Admin → Stats. Days are bucketed in the site's time zone.
 * "Visitors" = daily unique visitors summed over the range (ids rotate daily by design).
 *
 * A window is a preset (7/30/90/365 days), "all" (lifetime) or a custom from–to range.
 * Long windows are charted by week or month so the chart stays readable.
 */
export type Bucket = "day" | "week" | "month";
export type Win = {
  /** Inclusive start (UTC instant). */
  from: Date;
  /** Exclusive end (UTC instant). */
  to: Date;
  bucket: Bucket;
  /** "7" | "30" | "90" | "365" | "all" | "custom" */
  key: string;
  label: string;
  /** The window before this one, for "vs previous" deltas (not for lifetime). */
  previous: { from: Date; to: Date } | null;
  /** Query string that reproduces this window. */
  query: string;
  fromDay: string;
  toDay: string;
};

export const PRESETS = ["7", "30", "90", "365", "all"] as const;
const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const bucketFor = (days: number): Bucket => (days <= 120 ? "day" : days <= 730 ? "week" : "month");

async function tz() {
  const s = await readGlobal("site-settings");
  return (s as { timeZone?: string }).timeZone || "Asia/Kolkata";
}

async function firstEventAt(): Promise<Date | null> {
  const [r] = (await db.execute(sql`select min(at) as first from stat_events`)) as unknown as {
    first: string | Date | null;
  }[];
  return r?.first ? new Date(r.first) : null;
}

/** Parses ?range= / ?from=&to= into a window. Invalid input falls back to 30 days. */
export async function parseWindow(sp: {
  range?: string;
  from?: string;
  to?: string;
}): Promise<Win> {
  const now = new Date();
  const end = new Date(Math.ceil(now.getTime() / DAY) * DAY); // end of today (UTC)
  const valid = (s?: string) =>
    s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null;
  const f = valid(sp.from);
  const t = valid(sp.to);
  if (f && t && f <= t) {
    const to = new Date(t.getTime() + DAY);
    const days = Math.round((to.getTime() - f.getTime()) / DAY);
    return {
      from: f,
      to,
      bucket: bucketFor(days),
      key: "custom",
      label: `${fmt(f)} – ${fmt(t)}`,
      previous: { from: new Date(f.getTime() - days * DAY), to: f },
      query: `from=${isoDay(f)}&to=${isoDay(t)}`,
      fromDay: isoDay(f),
      toDay: isoDay(t),
    };
  }
  if (sp.range === "all") {
    const first = (await firstEventAt()) ?? new Date(end.getTime() - 30 * DAY);
    const from = new Date(Math.floor(first.getTime() / DAY) * DAY);
    const days = Math.max(1, Math.round((end.getTime() - from.getTime()) / DAY));
    return {
      from,
      to: end,
      bucket: bucketFor(days),
      key: "all",
      label: "All time",
      previous: null,
      query: "range=all",
      fromDay: isoDay(from),
      toDay: isoDay(new Date(end.getTime() - DAY)),
    };
  }
  const n = [7, 30, 90, 365].includes(Number(sp.range)) ? Number(sp.range) : 30;
  const from = new Date(end.getTime() - n * DAY);
  return {
    from,
    to: end,
    bucket: bucketFor(n),
    key: String(n),
    label: n === 365 ? "Last 12 months" : `Last ${n} days`,
    previous: { from: new Date(from.getTime() - n * DAY), to: from },
    query: `range=${n}`,
    fromDay: isoDay(from),
    toDay: isoDay(new Date(end.getTime() - DAY)),
  };
}
const fmt = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

type Row = Record<string, unknown>;
const rows = async <T extends Row>(q: ReturnType<typeof sql>) =>
  (await db.execute(q)) as unknown as T[];
const n = (v: unknown) => Number(v ?? 0);
const within = (w: { from: Date; to: Date }) =>
  sql`at >= ${w.from.toISOString()}::timestamptz and at < ${w.to.toISOString()}::timestamptz`;

export type Totals = Awaited<ReturnType<typeof totals>>;
async function totals(w: { from: Date; to: Date }, slug?: string) {
  const zone = await tz();
  const scope = slug ? sql`and slug = ${slug}` : sql``;
  const [r] = await rows<Row>(sql`
    select
      count(*) filter (where type = 'view') as views,
      count(distinct (visitor, (at at time zone ${zone})::date)) filter (where type = 'view') as visitors,
      count(*) filter (where type = 'read') as reads,
      count(distinct visitor) filter (where type = 'read') as readers,
      round(avg(seconds) filter (where type = 'leave' and seconds >= 3)) as avg_seconds,
      round(avg(depth) filter (where type = 'leave')) as avg_depth
    from stat_events where ${within(w)} ${scope}`);
  return {
    views: n(r?.views),
    visitors: n(r?.visitors),
    reads: n(r?.reads),
    readers: n(r?.readers),
    avgSeconds: n(r?.avg_seconds),
    avgDepth: n(r?.avg_depth),
  };
}

async function series(w: Win, slug?: string) {
  const zone = await tz();
  const scope = slug ? sql`and slug = ${slug}` : sql``;
  const unit = sql.raw(`'${w.bucket}'`);
  const step = sql.raw(`'1 ${w.bucket}'`);
  const r = await rows<Row>(sql`
    with d as (
      select generate_series(
        date_trunc(${unit}, (${w.from.toISOString()}::timestamptz at time zone ${zone}))::date,
        date_trunc(${unit}, ((${w.to.toISOString()}::timestamptz - interval '1 second') at time zone ${zone}))::date,
        interval ${step}
      )::date as day
    ), e as (
      select date_trunc(${unit}, at at time zone ${zone})::date as day, type, visitor,
        (at at time zone ${zone})::date as d
      from stat_events where ${within(w)} ${scope}
    )
    select d.day::text as day,
      count(e.*) filter (where e.type = 'view') as views,
      count(distinct (e.visitor, e.d)) filter (where e.type = 'view') as visitors,
      count(e.*) filter (where e.type = 'read') as reads
    from d left join e on e.day = d.day
    group by d.day order by d.day`);
  return r.map((x) => ({
    day: String(x.day),
    views: n(x.views),
    visitors: n(x.visitors),
    reads: n(x.reads),
  }));
}

async function top(column: "path" | "referrer" | "country" | "device", w: Win, slug?: string) {
  const col = sql.raw(column);
  const scope = slug ? sql`and slug = ${slug}` : sql``;
  const r = await rows<Row>(sql`
    select ${col} as key, count(*) as views, count(distinct visitor) as visitors
    from stat_events
    where type = 'view' and ${col} is not null and ${within(w)} ${scope}
    group by ${col} order by views desc limit 10`);
  return r.map((x) => ({ key: String(x.key), views: n(x.views), visitors: n(x.visitors) }));
}

/** Overview for the Stats page. */
export async function siteStats(w: Win) {
  const [now, before, s, pages, referrers, countries, devices, posts] = await Promise.all([
    totals(w),
    w.previous ? totals(w.previous) : Promise.resolve(null),
    series(w),
    top("path", w),
    top("referrer", w),
    top("country", w),
    top("device", w),
    postStats(w),
  ]);
  return { totals: now, previous: before, series: s, pages, referrers, countries, devices, posts };
}

/** One row per post: views, readers, reads, read rate, average depth and time. */
export async function postStats(w: Win) {
  const [posts, r] = await Promise.all([
    readEntries("posts"),
    rows<Row>(sql`
      select slug,
        count(*) filter (where type = 'view') as views,
        count(distinct visitor) filter (where type = 'view') as visitors,
        count(*) filter (where type = 'read') as reads,
        round(avg(depth) filter (where type = 'leave')) as avg_depth,
        round(avg(seconds) filter (where type = 'leave' and seconds >= 3)) as avg_seconds
      from stat_events where slug is not null and ${within(w)}
      group by slug`),
  ]);
  const by = new Map(r.map((x) => [String(x.slug), x]));
  return posts
    .filter((p) => p.stage === "published")
    .map((p) => {
      const x = by.get(p.slug);
      const views = n(x?.views);
      const reads = n(x?.reads);
      return {
        slug: p.slug,
        title: p.title,
        publishedAt: p.publishedAt ?? null,
        views,
        visitors: n(x?.visitors),
        reads,
        readRate: views ? Math.round((reads / views) * 100) : 0,
        avgDepth: n(x?.avg_depth),
        avgSeconds: n(x?.avg_seconds),
      };
    })
    .sort((a, b) => b.views - a.views || a.title.localeCompare(b.title));
}

/** Detail for one post. */
export async function singlePostStats(slug: string, w: Win) {
  const [now, before, s, referrers, devices, depth] = await Promise.all([
    totals(w, slug),
    w.previous ? totals(w.previous, slug) : Promise.resolve(null),
    series(w, slug),
    top("referrer", w, slug),
    top("device", w, slug),
    rows<Row>(sql`
      select width_bucket(least(depth, 99), 0, 100, 4) as bucket, count(*) as n
      from stat_events where type = 'leave' and slug = ${slug} and ${within(w)}
      group by bucket order by bucket`),
  ]);
  const buckets = [1, 2, 3, 4].map((b) => n(depth.find((d) => n(d.bucket) === b)?.n));
  return { totals: now, previous: before, series: s, referrers, devices, depth: buckets };
}

/** Small numbers for the dashboard tile. */
export async function dashboardStatTile() {
  const w = await parseWindow({ range: "7" });
  const [t, p] = await Promise.all([totals(w), w.previous ? totals(w.previous) : null]);
  return { visitors: t.visitors, views: t.views, reads: t.reads, prevVisitors: p?.visitors ?? 0 };
}
