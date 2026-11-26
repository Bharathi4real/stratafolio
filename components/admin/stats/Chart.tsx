"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Point = { day: string; views: number; visitors: number; reads: number };

const H = 220;
const PAD = { t: 14, r: 12, b: 26, l: 36 };

const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};
type Bucket = "day" | "week" | "month";
const fmtDay = (d: string, long = false, bucket: Bucket = "day") => {
  const date = new Date(`${d}T00:00:00`);
  if (bucket === "month")
    return date.toLocaleDateString("en-GB", { month: "short", year: long ? "numeric" : "2-digit" });
  const s = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(long && bucket === "day" ? { weekday: "short" } : {}),
    ...(long && bucket === "week" ? { year: "numeric" } : {}),
  });
  return bucket === "week" && long ? `Week of ${s}` : s;
};

/**
 * Views (area), visitors (line) and reads (bars) per day, with a hover/focus crosshair.
 * Pure SVG, sized to its container.
 */
export function StatsChart({
  data,
  showReads = true,
  bucket = "day",
}: {
  data: Point[];
  showReads?: boolean;
  bucket?: Bucket;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const g = useMemo(() => {
    const max = niceMax(Math.max(1, ...data.map((d) => d.views)));
    const iw = w - PAD.l - PAD.r;
    const ih = H - PAD.t - PAD.b;
    const step = data.length > 1 ? iw / (data.length - 1) : iw;
    const x = (i: number) => PAD.l + (data.length > 1 ? i * step : iw / 2);
    const y = (v: number) => PAD.t + ih - (v / max) * ih;
    const line = (k: "views" | "visitors") =>
      data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join("");
    const area = `${line("views")}L${x(data.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
    const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 90))));
    const barW = Math.max(2, Math.min(14, step * 0.45));
    return { max, x, y, line, area, ticks, every, barW, step };
  }, [data, w]);

  const at = hover === null ? null : data[hover];
  const onMove = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !data.length) return;
    const i = Math.round((clientX - r.left - PAD.l) / (g.step || 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  };

  return (
    <div className="chart" ref={ref}>
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        role="img"
        aria-label={`Views, visitors and reads by ${bucket} (${data.length} points)`}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {g.ticks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={PAD.l} x2={w - PAD.r} y1={g.y(t)} y2={g.y(t)} />
            <text className="chart-tick" x={PAD.l - 8} y={g.y(t) + 3} textAnchor="end">
              {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : t}
            </text>
          </g>
        ))}
        {showReads
          ? data.map((d, i) =>
              d.reads ? (
                <rect
                  key={d.day}
                  className="chart-bar"
                  x={g.x(i) - g.barW / 2}
                  y={g.y(d.reads)}
                  width={g.barW}
                  height={g.y(0) - g.y(d.reads)}
                  rx={2}
                />
              ) : null,
            )
          : null}
        <path className="chart-area" d={g.area} fill="url(#chart-fill)" />
        <path className="chart-line" d={g.line("views")} />
        <path className="chart-line is-visitors" d={g.line("visitors")} />
        {data.map((d, i) =>
          i % g.every === 0 || i === data.length - 1 ? (
            <text
              key={d.day}
              className="chart-tick"
              x={g.x(i)}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            >
              {fmtDay(d.day, false, bucket)}
            </text>
          ) : null,
        )}
        {at && hover !== null ? (
          <g>
            <line className="chart-cross" x1={g.x(hover)} x2={g.x(hover)} y1={PAD.t} y2={g.y(0)} />
            <circle className="chart-dot" cx={g.x(hover)} cy={g.y(at.views)} r={4} />
            <circle
              className="chart-dot is-visitors"
              cx={g.x(hover)}
              cy={g.y(at.visitors)}
              r={3.5}
            />
          </g>
        ) : null}
      </svg>
      {at && hover !== null ? (
        <div
          className="chart-tip"
          style={{
            left: Math.min(w - 170, Math.max(0, g.x(hover) + 12)),
          }}
        >
          <b>{fmtDay(at.day, true, bucket)}</b>
          <span>
            <i className="k-views" /> {at.views} views
          </span>
          <span>
            <i className="k-visitors" /> {at.visitors} visitors
          </span>
          {showReads ? (
            <span>
              <i className="k-reads" /> {at.reads} reads
            </span>
          ) : null}
        </div>
      ) : null}
      <ul className="chart-legend" aria-hidden="true">
        <li>
          <i className="k-views" /> Views
        </li>
        <li>
          <i className="k-visitors" /> Visitors
        </li>
        {showReads ? (
          <li>
            <i className="k-reads" /> Blog reads
          </li>
        ) : null}
      </ul>
      {/* Accessible data table for screen readers. */}
      <table className="sr-only-table">
        <caption>Daily stats</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Views</th>
            <th>Visitors</th>
            <th>Reads</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.views}</td>
              <td>{d.visitors}</td>
              <td>{d.reads}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
