import type { RichDoc, RichNode } from "./schema";

/** Helpers for Tiptap JSON: build (seed), read text, reading time, table of contents. */

export const slugifyHeading = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const nodeText = (n: RichNode): string =>
  (n.text ?? "") + (n.content ?? []).map(nodeText).join("");

export function toc(doc: RichDoc | null | undefined) {
  return (doc?.content ?? [])
    .filter((n) => n.type === "heading" && n.attrs?.level === 2)
    .map((n) => {
      const title = nodeText(n);
      return { id: slugifyHeading(title), title };
    });
}

/** ~220 words a minute; code counts at half speed. */
export function readingMinutes(doc: RichDoc | null | undefined) {
  let words = 0;
  const walk = (n: RichNode) => {
    if (n.text) words += n.text.split(/\s+/).filter(Boolean).length;
    const code = n.attrs?.code;
    if (typeof code === "string") words += Math.round(code.split(/\s+/).length * 0.5);
    for (const c of n.content ?? []) walk(c);
  };
  for (const n of doc?.content ?? []) walk(n);
  return Math.max(1, Math.round(words / 220));
}

/* ───────── Builders (seed) ───────── */

const text = (t: string, marks?: RichNode["marks"]): RichNode => ({
  type: "text",
  text: t,
  ...(marks ? { marks } : {}),
});

/** Inline markup: **bold**, *em*, `code`, [label](url). */
export function inline(src: string): RichNode[] {
  const out: RichNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) out.push(text(src.slice(last, m.index)));
    if (m[1]) out.push(text(m[1], [{ type: "bold" }]));
    else if (m[2]) out.push(text(m[2], [{ type: "italic" }]));
    else if (m[3]) out.push(text(m[3], [{ type: "code" }]));
    else if (m[4] && m[5]) out.push(text(m[4], [{ type: "link", attrs: { href: m[5] } }]));
    last = re.lastIndex;
  }
  if (last < src.length) out.push(text(src.slice(last)));
  return out;
}

export const doc = (content: RichNode[]): RichDoc => ({ type: "doc", content });
export const p = (s: string): RichNode => ({ type: "paragraph", content: inline(s) });
export const h2 = (s: string): RichNode => ({
  type: "heading",
  attrs: { level: 2 },
  content: inline(s),
});
export const quote = (s: string): RichNode => ({ type: "blockquote", content: [p(s)] });
export const ul = (items: string[]): RichNode => ({
  type: "bulletList",
  content: items.map((s) => ({ type: "listItem", content: [p(s)] })),
});
export const codeFigure = (a: {
  filename?: string;
  language: string;
  code: string;
  lineNumbers?: boolean;
  highlight?: string;
}): RichNode => ({
  type: "codeFigure",
  attrs: { lineNumbers: true, highlight: "", inserted: "", deleted: "", filename: "", ...a },
});
export const callout = (kicker: string, body: string): RichNode => ({
  type: "callout",
  attrs: { kicker, body },
});
