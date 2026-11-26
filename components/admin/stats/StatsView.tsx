"use client";

import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  type SortingState,
  sortFns,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { DatePicker } from "@/components/admin/DatePicker";
import { Arrow } from "@/components/ui/Arrow";
import { type Point, StatsChart } from "./Chart";

export type Totals = {
  views: number;
  visitors: number;
  reads: number;
  readers: number;
  avgSeconds: number;
  avgDepth: number;
};
export type TopRow = { key: string; views: number; visitors: number };
export type PostRow = {
  slug: string;
  title: string;
  publishedAt: string | null;
  views: number;
  visitors: number;
  reads: number;
  readRate: number;
  avgDepth: number;
  avgSeconds: number;
};

/** Serializable part of the server's window (lib/admin/stats.ts). */
export type WinInfo = {
  key: string;
  label: string;
  query: string;
  fromDay: string;
  toDay: string;
  bucket: "day" | "week" | "month";
  hasPrevious: boolean;
};
export const fmtNum = (v: number) =>
  v >= 10_000 ? `${(v / 1000).toFixed(0)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
export const fmtDur = (s: number) =>
  !s ? "None" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;

const PRESET_LABEL: [string, string][] = [
  ["7", "7 days"],
  ["30", "30 days"],
  ["90", "90 days"],
  ["365", "12 months"],
  ["all", "All time"],
];

/** Presets + "Custom" (from/to dates). Everything lives in the URL, so views are shareable. */
export function RangeBar({ win, base }: { win: WinInfo; base: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(win.fromDay);
  const [to, setTo] = useState(win.toDay);
  // A preset link changed the window: keep the custom range in step with it.
  useEffect(() => {
    setFrom(win.fromDay);
    setTo(win.toDay);
  }, [win.fromDay, win.toDay]);
  const today = new Date().toISOString().slice(0, 10);
  const valid = from && to && from <= to;
  return (
    <div className="range-bar">
      <nav className="range-switch" aria-label="Date range">
        {PRESET_LABEL.map(([k, label]) => (
          <Link
            key={k}
            href={`${base}?range=${k}`}
            aria-current={win.key === k ? "page" : undefined}
            scroll={false}
          >
            {label}
          </Link>
        ))}
        <button
          type="button"
          aria-expanded={open}
          aria-current={win.key === "custom" ? "page" : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          {win.key === "custom" ? win.label : "Custom…"}
        </button>
      </nav>
      {open ? (
        <form
          className="range-custom"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            setOpen(false);
            router.push(`${base}?from=${from}&to=${to}`, { scroll: false });
          }}
        >
          <span className="range-field">
            <span className="mono subtle">From</span>
            <DatePicker
              label="From"
              value={from}
              max={to || today}
              clearable={false}
              onChange={(v) => setFrom(v ?? "")}
            />
          </span>
          <span className="range-field">
            <span className="mono subtle">To</span>
            <DatePicker
              label="To"
              value={to}
              min={from}
              max={today}
              clearable={false}
              onChange={(v) => setTo(v ?? "")}
            />
          </span>
          <button type="submit" className="btn btn-sm btn-primary" disabled={!valid}>
            Apply
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function Kpi({
  label,
  value,
  prev,
  hint,
  format: kind = "num",
}: {
  label: string;
  value: number;
  prev?: number;
  hint?: ReactNode;
  /** Named, so server pages can pass it (functions can't cross into client components). */
  format?: "num" | "dur" | "pct";
}) {
  const format = kind === "dur" ? fmtDur : kind === "pct" ? (v: number) => `${v}%` : fmtNum;
  const delta = prev === undefined ? null : prev ? Math.round(((value - prev) / prev) * 100) : null;
  return (
    <div className="kpi-card">
      <span className="mono subtle">{label}</span>
      <strong>{format(value)}</strong>
      <span className="kpi-sub">
        {delta !== null ? (
          <em className={delta > 0 ? "up" : delta < 0 ? "down" : ""}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta)}%
          </em>
        ) : prev === 0 && value > 0 ? (
          <em className="up">New</em>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </span>
    </div>
  );
}

const countryName = (() => {
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return (c: string) => dn.of(c) ?? c;
  } catch {
    return (c: string) => c;
  }
})();
const flag = (c: string) =>
  /^[A-Z]{2}$/.test(c)
    ? String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)))
    : "🌐";

export function TopList({
  title,
  rows,
  kind,
  empty = "No data yet.",
}: {
  title: string;
  rows: TopRow[];
  kind: "path" | "referrer" | "country" | "device";
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <div className="card top-list">
      <div className="card-h">
        <h3>{title}</h3>
        <span className="mono subtle">Views</span>
      </div>
      {rows.length ? (
        <ol>
          {rows.map((r) => (
            <li key={r.key}>
              <span className="tl-bar" style={{ width: `${(r.views / max) * 100}%` }} />
              <span className="tl-key">
                {kind === "country" ? (
                  <>
                    <span aria-hidden="true">{flag(r.key)}</span> {countryName(r.key)}
                  </>
                ) : kind === "device" ? (
                  r.key[0].toUpperCase() + r.key.slice(1)
                ) : kind === "referrer" ? (
                  <a href={`https://${r.key}`} target="_blank" rel="noreferrer">
                    {r.key}
                  </a>
                ) : (
                  <code>{r.key}</code>
                )}
              </span>
              <b className="mono">{fmtNum(r.views)}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted tl-empty">{empty}</p>
      )}
    </div>
  );
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});
const col = createColumnHelper<typeof features, PostRow>();

/** Per-post table, sortable (TanStack Table). */
export function PostsTable({ rows, query }: { rows: PostRow[]; query: string }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "views", desc: true }]);
  const columns = col.columns([
    col.accessor("title", {
      header: "Post",
      cell: (c) => (
        <Link className="t-title" href={`/admin/stats/${c.row.original.slug}?${query}`}>
          {c.getValue()}
        </Link>
      ),
    }),
    col.accessor("views", { header: "Views", cell: (c) => fmtNum(c.getValue()) }),
    col.accessor("visitors", { header: "Visitors", cell: (c) => fmtNum(c.getValue()) }),
    col.accessor("reads", { header: "Reads", cell: (c) => fmtNum(c.getValue()) }),
    col.accessor("readRate", {
      header: "Read rate",
      cell: (c) => (
        <span className="rate">
          <span className="rate-bar">
            <i style={{ width: `${Math.min(100, c.getValue())}%` }} />
          </span>
          {c.getValue()}%
        </span>
      ),
    }),
    col.accessor("avgDepth", {
      header: "Avg. depth",
      cell: (c) => (c.getValue() ? `${c.getValue()}%` : "None"),
    }),
    col.accessor("avgSeconds", { header: "Avg. time", cell: (c) => fmtDur(c.getValue()) }),
  ]);
  const table = useTable(
    {
      features,
      columns,
      data: rows,
      state: { sorting },
      onSortingChange: setSorting,
    },
    (s) => ({ sorting: s.sorting }),
  );
  if (!rows.length) return <p className="muted">No published posts yet.</p>;
  return (
    <div className="card stats-table">
      <table>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const dir = h.column.getIsSorted();
                return (
                  <th
                    key={h.id}
                    className="mono"
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                  >
                    <button
                      type="button"
                      className="th-sort"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      <table.FlexRender header={h} />
                      <span aria-hidden="true">
                        {dir ? <Arrow dir={dir === "asc" ? "up" : "down"} /> : null}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id}>
              {r.getAllCells().map((c) => (
                <td key={c.id}>
                  <table.FlexRender cell={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatsOverview({
  win,
  data,
}: {
  win: WinInfo;
  data: {
    totals: Totals;
    previous: Totals | null;
    series: Point[];
    pages: TopRow[];
    referrers: TopRow[];
    countries: TopRow[];
    devices: TopRow[];
    posts: PostRow[];
  };
}) {
  const t = data.totals;
  const p = data.previous ?? undefined;
  return (
    <>
      <div className="stats-bar">
        <RangeBar win={win} base="/admin/stats" />
        <span className="hint">
          {win.hasPrevious
            ? "Cookieless and first-party. Arrows compare with the period just before."
            : "Cookieless and first-party. Everything since the first recorded visit."}
        </span>
      </div>
      <div className="kpi-grid">
        <Kpi label="Visitors" value={t.visitors} prev={p?.visitors} hint="unique per day" />
        <Kpi label="Page views" value={t.views} prev={p?.views} />
        <Kpi label="Blog reads" value={t.reads} prev={p?.reads} hint="60% + 30s" />
        <Kpi label="Avg. read time" value={t.avgSeconds} prev={p?.avgSeconds} format="dur" />
      </div>
      <div className="card chart-card">
        <div className="card-h">
          <h3>Traffic</h3>
          <span className="mono subtle">
            {win.label} · by {win.bucket}
          </span>
        </div>
        <div className="card-b">
          <StatsChart data={data.series} bucket={win.bucket} />
        </div>
      </div>
      <h2 className="stats-h">Blog posts</h2>
      <PostsTable rows={data.posts} query={win.query} />
      <div className="top-grid">
        <TopList title="Top pages" rows={data.pages} kind="path" />
        <TopList
          title="Referrers"
          rows={data.referrers}
          kind="referrer"
          empty="No referrers yet. Direct visits and private links don’t send one."
        />
        <TopList
          title="Countries"
          rows={data.countries}
          kind="country"
          empty="Countries appear once the site runs on Vercel."
        />
        <TopList title="Devices" rows={data.devices} kind="device" />
      </div>
    </>
  );
}
