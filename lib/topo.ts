/**
 * Deterministic contour art (static SVG), rendered on the server. The hero is the only
 * WebGL surface; every other “ember” surface uses these paths plus CSS gradients.
 */

import { field, STILL_T } from "./noise";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 */
function rng(seed: string | number) {
  let a = typeof seed === "number" ? seed >>> 0 : hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Contour lines of the hero shader's field (lib/noise.ts), traced with marching squares.
 * The art matches the WebGL hero exactly: same noise, same domain warp, the still-frame time,
 * with a per-seed offset into the field so every surface gets its own patch of the same "terrain".
 */
type ContourOpts = {
  seed: string | number;
  /** viewBox size */
  w: number;
  h: number;
  /** grid step in viewBox units (smaller = smoother, slower) */
  cell: number;
  /** contour lines per unit of f (the shader draws 11) */
  bands: number;
  /** focal point: nearest lines come first and are brightest */
  cx: number;
  cy: number;
  /** keep at most this many paths (longest first) */
  max: number;
  /** how much of the shader's screen-sized field this surface shows (1 = a full viewport) */
  zoom: number;
  precision: number;
};

type Chain = { d: string; len: number; dist: number };

const memo = new Map<string, Chain[]>();

function contours(o: ContourOpts): Chain[] {
  const key = JSON.stringify(o);
  const hit = memo.get(key);
  if (hit) return hit;

  const rand = rng(o.seed);
  const offX = rand() * 40 - 20;
  const offY = rand() * 40 - 20;
  const aspect = o.w / o.h;
  const cols = Math.ceil(o.w / o.cell) + 1;
  const rows = Math.ceil(o.h / o.cell) + 1;
  // Sample f on the grid. SVG y grows down; the shader's uv.y grows up.
  const f = new Float64Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    const v = 1 - Math.min(1, (j * o.cell) / o.h);
    for (let i = 0; i < cols; i++) {
      const u = Math.min(1, (i * o.cell) / o.w);
      f[j * cols + i] = field(u * aspect * o.zoom + offX, v * o.zoom + offY, STILL_T);
    }
  }
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const x of f) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }

  const fx = (n: number) => n.toFixed(o.precision);
  const out: Chain[] = [];
  // The shader draws a line where fract(f * bands) = 0.5.
  for (let k = Math.ceil(lo * o.bands - 0.5); k + 0.5 <= hi * o.bands; k++) {
    const level = (k + 0.5) / o.bands;
    // Marching squares: one or two segments per cell, endpoints on cell edges.
    const segs: [number, number, number, number][] = [];
    const lerp = (a: number, b: number) => (level - a) / (b - a);
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = f[j * cols + i];
        const b = f[j * cols + i + 1];
        const c = f[(j + 1) * cols + i + 1];
        const d = f[(j + 1) * cols + i];
        const idx =
          (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x0 = i * o.cell;
        const y0 = j * o.cell;
        const top: [number, number] = [x0 + lerp(a, b) * o.cell, y0];
        const right: [number, number] = [x0 + o.cell, y0 + lerp(b, c) * o.cell];
        const bottom: [number, number] = [x0 + lerp(d, c) * o.cell, y0 + o.cell];
        const left: [number, number] = [x0, y0 + lerp(a, d) * o.cell];
        const add = (p: [number, number], q: [number, number]) =>
          segs.push([p[0], p[1], q[0], q[1]]);
        switch (idx) {
          case 1:
          case 14:
            add(left, bottom);
            break;
          case 2:
          case 13:
            add(bottom, right);
            break;
          case 3:
          case 12:
            add(left, right);
            break;
          case 4:
          case 11:
            add(top, right);
            break;
          case 6:
          case 9:
            add(top, bottom);
            break;
          case 7:
          case 8:
            add(left, top);
            break;
          case 5:
            add(left, top);
            add(bottom, right);
            break;
          case 10:
            add(top, right);
            add(left, bottom);
            break;
        }
      }
    }
    // Join segments that share endpoints into polylines.
    const k2 = (x: number, y: number) => Math.round(x * 100) * 1e7 + Math.round(y * 100);
    const at = new Map<number, number[]>();
    segs.forEach((s, n) => {
      for (const key of [k2(s[0], s[1]), k2(s[2], s[3])]) {
        const list = at.get(key);
        if (list) list.push(n);
        else at.set(key, [n]);
      }
    });
    const used = new Uint8Array(segs.length);
    const walk = (x: number, y: number, pts: number[][]) => {
      for (;;) {
        const next = (at.get(k2(x, y)) ?? []).find((n) => !used[n]);
        if (next === undefined) return;
        used[next] = 1;
        const s = segs[next];
        const fwd = k2(s[0], s[1]) === k2(x, y);
        x = fwd ? s[2] : s[0];
        y = fwd ? s[3] : s[1];
        pts.push([x, y]);
      }
    };
    for (let n = 0; n < segs.length; n++) {
      if (used[n]) continue;
      used[n] = 1;
      const s = segs[n];
      const tail: number[][] = [[s[2], s[3]]];
      walk(s[2], s[3], tail);
      const head: number[][] = [];
      walk(s[0], s[1], head);
      const pts = [...head.reverse(), [s[0], s[1]], ...tail];
      if (pts.length < 4) continue;
      let len = 0;
      let mx = 0;
      let my = 0;
      for (let q = 1; q < pts.length; q++)
        len += Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1]);
      for (const [x, y] of pts) {
        mx += x;
        my += y;
      }
      mx /= pts.length;
      my /= pts.length;
      const closed = k2(pts[0][0], pts[0][1]) === k2(pts.at(-1)?.[0] ?? 0, pts.at(-1)?.[1] ?? 0);
      out.push({
        d: smoothPath(pts, closed, fx),
        len,
        dist: Math.hypot(mx - o.cx, my - o.cy),
      });
    }
  }
  const kept = out
    .sort((a, b) => b.len - a.len)
    .slice(0, o.max)
    .sort((a, b) => a.dist - b.dist);
  if (memo.size > 300) memo.delete(memo.keys().next().value as string);
  memo.set(key, kept);
  return kept;
}

/** Polyline → smooth path: quadratic curves through segment midpoints (corners become arcs). */
function smoothPath(pts: number[][], closed: boolean, fx: (n: number) => string) {
  const mid = (a: number[], b: number[]) => `${fx((a[0] + b[0]) / 2)} ${fx((a[1] + b[1]) / 2)}`;
  const pt = (a: number[]) => `${fx(a[0])} ${fx(a[1])}`;
  const ring = closed ? pts.slice(0, -1) : pts;
  const n = ring.length;
  if (closed) {
    let d = `M${mid(ring[n - 1], ring[0])}`;
    for (let i = 0; i < n; i++) d += ` Q${pt(ring[i])} ${mid(ring[i], ring[(i + 1) % n])}`;
    return `${d}Z`;
  }
  let d = `M${pt(ring[0])}`;
  for (let i = 1; i < n - 1; i++) d += ` Q${pt(ring[i])} ${mid(ring[i], ring[i + 1])}`;
  return `${d} L${pt(ring[n - 1])}`;
}

export type TopoPath = { d: string; opacity: number };

const fade = (chains: Chain[], w: number, h: number, floor: number): TopoPath[] => {
  const reach = Math.hypot(w, h) * 0.75;
  return chains.map((c) => ({ d: c.d, opacity: Math.max(floor, 1 - c.dist / reach) }));
};

/** Large background contours (menu, contact panel, footer, page heroes). viewBox w×h. */
export function staticTopo(
  seed: string | number,
  cx: number,
  cy: number,
  n: number,
  _step = 34,
  w = 1200,
  h = 700,
): TopoPath[] {
  const chains = contours({
    seed,
    w,
    h,
    cell: 22,
    bands: 11,
    cx,
    cy,
    max: n + 6,
    zoom: 1,
    precision: 0,
  });
  return fade(chains, w, h, 0.1);
}

/** Card-sized contours that draw in on hover (pathLength=1). viewBox 420×320. */
export function cardTopo(seed: string | number, n = 9, cx = 330, cy = 290): string[] {
  return contours({
    seed,
    w: 420,
    h: 320,
    cell: 20,
    bands: 11,
    cx,
    cy,
    max: n,
    zoom: 0.4,
    precision: 1,
  }).map((c) => c.d);
}

/** Post cover contours. */
export function coverTopo(
  seed: string | number,
  cx = 380,
  cy = 330,
  n = 16,
  w = 600,
  h = 420,
): TopoPath[] {
  const chains = contours({
    seed,
    w,
    h,
    cell: Math.max(12, Math.round(w / 60)),
    bands: 11,
    cx,
    cy,
    max: n + 4,
    zoom: 0.7,
    precision: 1,
  });
  return fade(chains, w, h, 0.12);
}

/** Strata layer shapes, viewBox 1000×120. The fill runs to y=175 so it tucks under the next layer. */
export function strataShape(seed: string | number, flat = false) {
  const rand = rng(seed);
  const wave = (base: number, amp: number) => {
    const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
    const f = [1 + rand() * 1.5, 2.5 + rand() * 2, 5 + rand() * 3];
    const ys: string[] = [];
    for (let x = 0; x <= 1000; x += 10) {
      const t = (x / 1000) * Math.PI * 2;
      const y =
        base +
        amp *
          (0.55 * Math.sin(f[0] * t + ph[0]) +
            0.3 * Math.sin(f[1] * t + ph[1]) +
            0.15 * Math.sin(f[2] * t + ph[2]));
      ys.push(`${x} ${y.toFixed(1)}`);
    }
    return ys;
  };
  const top = flat ? Array.from({ length: 101 }, (_, i) => `${i * 10} 0.0`) : wave(10, 5);
  return {
    fill: `M${top.join(" L")} L1000 175 L0 175 Z`,
    edge: `M${top.join(" L")}`,
    lines: [wave(37, 4), wave(70, 4)].map((l) => `M${l.join(" L")}`),
  };
}
