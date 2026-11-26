/**
 * Human-readable diffs between two versions of a content document (globals or entries).
 * Pure functions, shared by server actions (to compute changes) and the admin UI (to render
 * word-level highlights).
 */

export type Change = {
  /** "Sections › Hero › Tagline" */
  path: string;
  kind: "added" | "removed" | "changed";
  before?: string;
  after?: string;
};

const SKIP = new Set(["id", "updatedAt", "createdAt", "readMinutes"]);
const LABELS: Record<string, string> = {
  blockType: "Section type",
  ctaLabel: "Button label",
  ctaHref: "Button link",
  ogImage: "Share image",
  bingVerification: "Bing verification",
  indexNow: "Notify Bing on publish (IndexNow)",
  llmsSummary: "llms.txt summary",
  coverImage: "Cover image",
  coverLines: "Cover lines",
  readOverride: "Read time override",
  publishedAt: "Publish date",
  noindex: "Hide from search engines",
  ga4Id: "GA4 ID",
  seo: "SEO",
  url: "URL",
  href: "Link",
};

const words = (k: string) =>
  LABELS[k] ??
  k
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
const isObj = (v: unknown): v is Record<string, Json> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isRich = (v: unknown): v is { type: "doc"; content?: Json[] } => isObj(v) && v.type === "doc";

/**
 * Plain text of a Tiptap document, one paragraph per line. List items get their own line
 * ("• " or "1. "), headings a "## " prefix, so diffs line up with what the reader sees.
 */
export function richText(v: unknown): string {
  const out: string[] = [];
  const inline = (n: unknown, line: string[]) => {
    if (!isObj(n)) return;
    if (typeof n.text === "string") line.push(n.text);
    const attrs = isObj(n.attrs) ? n.attrs : {};
    for (const k of ["code", "body", "quote", "caption", "kicker"])
      if (typeof attrs[k] === "string" && attrs[k]) line.push(String(attrs[k]));
    if (Array.isArray(n.content)) for (const c of n.content) inline(c, line);
  };
  const emit = (prefix: string, n: unknown) => {
    const line: string[] = [];
    inline(n, line);
    const text = line.join("").replace(/\s+/g, " ").trim();
    if (text) out.push(prefix + text);
  };
  const block = (n: unknown, prefix = "") => {
    if (!isObj(n)) return;
    const kids = Array.isArray(n.content) ? n.content : [];
    if (n.type === "bulletList" || n.type === "orderedList") {
      const start = isObj(n.attrs) && typeof n.attrs.start === "number" ? n.attrs.start : 1;
      kids.forEach((li, i) => {
        const mark = n.type === "orderedList" ? `${start + i}. ` : "• ";
        const inner = isObj(li) && Array.isArray(li.content) ? li.content : [];
        inner.forEach((c, j) => {
          block(c, `${prefix}${j === 0 ? mark : "   "}`);
        });
      });
      return;
    }
    if (n.type === "blockquote") {
      for (const c of kids) block(c, `${prefix}> `);
      return;
    }
    if (n.type === "heading") return emit(`${prefix}## `, n);
    emit(prefix, n);
  };
  if (isRich(v)) for (const b of v.content ?? []) block(b);
  return out.join("\n");
}

const show = (v: Json | undefined): string => {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "boolean") return v ? "On" : "Off";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (isRich(v)) return richText(v);
  if (Array.isArray(v)) return v.map(show).filter(Boolean).join(", ");
  return Object.entries(v)
    .filter(([k]) => !SKIP.has(k))
    .map(([k, x]) => `${words(k)}: ${show(x)}`)
    .filter((s) => !s.endsWith(": "))
    .join(" · ");
};

const itemName = (v: Json, i: number) => {
  if (isObj(v)) {
    for (const k of ["name", "title", "label", "heading", "company", "kicker", "text"])
      if (typeof v[k] === "string" && v[k]) return String(v[k]).slice(0, 40);
    if (typeof v.blockType === "string") return words(v.blockType);
  }
  return `Item ${i + 1}`;
};
const itemKey = (v: Json, i: number) =>
  isObj(v) && (typeof v.id === "string" || typeof v.id === "number") ? `id:${v.id}` : `i:${i}`;

function walk(a: Json | undefined, b: Json | undefined, path: string[], out: Change[]) {
  const p = path.join(" › ") || "Document";
  if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) return;

  if (isRich(a) || isRich(b)) {
    const before = richText(a);
    const after = richText(b);
    if (before !== after)
      out.push({
        path: p,
        kind: !before ? "added" : !after ? "removed" : "changed",
        before,
        after,
      });
    return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = Array.isArray(a) ? a : [];
    const bb = Array.isArray(b) ? b : [];
    const primitive = [...aa, ...bb].every((x) => !isObj(x) && !Array.isArray(x));
    if (primitive) {
      // Tags, bullets, ids: list what was added and removed.
      const as = aa.map(show);
      const bs = bb.map(show);
      const removed = as.filter((x) => !bs.includes(x));
      const added = bs.filter((x) => !as.includes(x));
      for (const x of removed) out.push({ path: p, kind: "removed", before: x });
      for (const x of added) out.push({ path: p, kind: "added", after: x });
      if (!removed.length && !added.length && as.join("\n") !== bs.join("\n"))
        out.push({ path: p, kind: "changed", before: "Previous order", after: "New order" });
      return;
    }
    const left = new Map(aa.map((x, i) => [itemKey(x, i), { x, i }]));
    const right = new Map(bb.map((x, i) => [itemKey(x, i), { x, i }]));
    for (const [k, { x, i }] of right) {
      const prev = left.get(k);
      if (!prev)
        out.push({ path: [...path, itemName(x, i)].join(" › "), kind: "added", after: show(x) });
      else walk(prev.x, x, [...path, itemName(x, i)], out);
    }
    for (const [k, { x, i }] of left)
      if (!right.has(k))
        out.push({ path: [...path, itemName(x, i)].join(" › "), kind: "removed", before: show(x) });
    const order = (m: Map<string, unknown>) =>
      [...m.keys()].filter((k) => left.has(k) && right.has(k));
    if (order(left).join() !== order(right).join())
      out.push({ path: p, kind: "changed", before: "Previous order", after: "Reordered" });
    return;
  }
  if (isObj(a) || isObj(b)) {
    const ao = isObj(a) ? a : {};
    const bo = isObj(b) ? b : {};
    for (const k of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
      if (SKIP.has(k)) continue;
      walk(ao[k], bo[k], [...path, words(k)], out);
    }
    return;
  }
  const before = show(a);
  const after = show(b);
  if (before === after) return;
  out.push({ path: p, kind: !before ? "added" : !after ? "removed" : "changed", before, after });
}

/** Field-by-field changes from `before` to `after`. Capped so a huge rewrite stays readable. */
export function diffDocs(before: unknown, after: unknown, cap = 60): Change[] {
  const out: Change[] = [];
  walk((before ?? null) as Json, (after ?? null) as Json, [], out);
  return out.slice(0, cap);
}

export type Seg = { t: "same" | "add" | "del"; s: string };

/** One line of a line-level diff. "changed" lines carry word-level segments. */
export type LineOp =
  | { t: "same"; s: string }
  | { t: "add"; s: string }
  | { t: "del"; s: string }
  | { t: "changed"; segs: Seg[] }
  | { t: "skip"; n: number };

/**
 * Line-level diff (LCS over lines), then word-level inside lines that were edited rather than
 * added/removed. Unchanged runs are folded to `context` lines on each side.
 */
export function lineDiff(a = "", b = "", context = 1): LineOp[] {
  const A = a.split("\n");
  const B = b.split("\n");
  if (A.length * B.length > 400_000)
    return [
      { t: "del", s: a },
      { t: "add", s: b },
    ];
  const dp = Array.from({ length: A.length + 1 }, () => new Uint32Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const raw: { t: "same" | "add" | "del"; s: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) {
      raw.push({ t: "same", s: A[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) raw.push({ t: "del", s: A[i++] });
    else raw.push({ t: "add", s: B[j++] });
  }
  while (i < A.length) raw.push({ t: "del", s: A[i++] });
  while (j < B.length) raw.push({ t: "add", s: B[j++] });

  // Pair a run of deletions with the following run of additions: those lines were edited.
  const paired: LineOp[] = [];
  for (let k = 0; k < raw.length; ) {
    if (raw[k].t !== "del") {
      paired.push(raw[k]);
      k++;
      continue;
    }
    const dels: string[] = [];
    while (k < raw.length && raw[k].t === "del") dels.push(raw[k++].s);
    const adds: string[] = [];
    while (k < raw.length && raw[k].t === "add") adds.push(raw[k++].s);
    const n = Math.min(dels.length, adds.length);
    for (let x = 0; x < n; x++) {
      const segs = wordDiff(dels[x], adds[x]);
      const same = segs.filter((s) => s.t === "same").reduce((a, s) => a + s.s.length, 0);
      // Mostly rewritten: show as removed + added instead of a confetti of highlights.
      if (same < Math.min(dels[x].length, adds[x].length) * 0.3) {
        paired.push({ t: "del", s: dels[x] }, { t: "add", s: adds[x] });
      } else paired.push({ t: "changed", segs });
    }
    for (const s of dels.slice(n)) paired.push({ t: "del", s });
    for (const s of adds.slice(n)) paired.push({ t: "add", s });
  }

  // Fold long unchanged runs.
  const out: LineOp[] = [];
  for (let k = 0; k < paired.length; ) {
    if (paired[k].t !== "same") {
      out.push(paired[k++]);
      continue;
    }
    let e = k;
    while (e < paired.length && paired[e].t === "same") e++;
    const run = paired.slice(k, e);
    const head = k === 0 ? 0 : context;
    const tail = e === paired.length ? 0 : context;
    if (run.length > head + tail + 1) {
      out.push(...run.slice(0, head), { t: "skip", n: run.length - head - tail });
      out.push(...run.slice(run.length - tail));
    } else out.push(...run);
    k = e;
  }
  return out;
}

/** Word-level diff (LCS) for rendering; falls back to whole-string replace for very long text. */
export function wordDiff(a = "", b = ""): Seg[] {
  const A = a.split(/(\s+)/);
  const B = b.split(/(\s+)/);
  if (A.length * B.length > 250_000)
    return [
      { t: "del", s: a },
      { t: "add", s: b },
    ];
  const dp = Array.from({ length: A.length + 1 }, () => new Uint32Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Seg[] = [];
  const push = (t: Seg["t"], s: string) => {
    const last = out.at(-1);
    if (last && last.t === t) last.s += s;
    else out.push({ t, s });
  };
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) {
      push("same", A[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", A[i++]);
    else push("add", B[j++]);
  }
  while (i < A.length) push("del", A[i++]);
  while (j < B.length) push("add", B[j++]);
  return out;
}
