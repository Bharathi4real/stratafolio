import "server-only";
import { Lexer, type Token, type Tokens } from "marked";
import { parse as parseYaml } from "yaml";
import { LANGUAGES, type LanguageId } from "@/lib/highlight-languages";
import { safeHref } from "@/lib/safe-url";
import type { PostData, RichDoc, RichNode } from "./schema";

/**
 * Markdown file → post fields + Tiptap JSON for the blog editor. Metadata comes from YAML
 * front matter or an HTML comment with "- Key: value" lines (the paste-guide format). Unsupported
 * pieces (tables, images) are converted or dropped with a warning, never silently.
 */

export type ImportedPost = {
  fields: Partial<PostData> & { title?: string; slug?: string };
  content: RichDoc;
  warnings: string[];
};

type Mark = NonNullable<RichNode["marks"]>[number];
type CodeHint = { language?: string; filename?: string; lineNumbers?: boolean; highlight?: string };

const LANG_ALIASES: Record<string, LanguageId> = {
  ts: "ts",
  typescript: "ts",
  js: "ts",
  javascript: "ts",
  mjs: "ts",
  cjs: "ts",
  tsx: "tsx",
  jsx: "tsx",
  css: "css",
  json: "json",
  jsonc: "json",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  shell: "shell",
  console: "shell",
  text: "text",
  txt: "text",
  plain: "text",
  sql: "text",
  "plain text": "text",
};

function language(raw: string | undefined): LanguageId {
  const k = (raw ?? "").trim().toLowerCase();
  if (LANGUAGES.some((l) => l.value === k)) return k as LanguageId;
  return LANG_ALIASES[k] ?? (LANGUAGES.find((l) => l.label.toLowerCase() === k)?.value || "text");
}

/* ───────── Metadata ───────── */

const FIELD_ALIASES: Record<string, string> = {
  "cover lines": "coverlines",
  cover: "coverlines",
  description: "excerpt",
  summary: "excerpt",
};

function splitMeta(md: string): { meta: Record<string, unknown>; body: string } {
  const src = md.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (fm) {
    const parsed = parseYaml(fm[1]);
    const meta = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    return { meta: meta as Record<string, unknown>, body: src.slice(fm[0].length) };
  }
  // Paste-guide format: an HTML comment near the top with "- Title: …" lines.
  const comment = /^\s*(?:#[^\n]*\n\s*)?<!--([\s\S]*?)-->/.exec(src);
  if (comment && /^\s*-\s*title\s*:/im.test(comment[1])) {
    const meta: Record<string, unknown> = {};
    for (const line of comment[1].split("\n")) {
      const m = /^\s*-\s*([A-Za-z ]+?)\s*:\s*(.+)$/.exec(line);
      if (m) meta[m[1].toLowerCase()] = m[2].trim();
    }
    return { meta, body: src.replace(comment[0].replace(/^\s*(?:#[^\n]*\n\s*)?/, ""), "") };
  }
  return { meta: {}, body: src };
}

const list = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [])
    .map((s) => String(s).trim())
    .filter(Boolean);

/** `cmd "next build" / ok "…" / plain "…"`, a YAML list of {kind, text}, or "$ …" strings. */
function coverLines(v: unknown): PostData["coverLines"] {
  const kinds = ["cmd", "ok", "plain"] as const;
  const one = (s: string) => {
    const m = /^(cmd|ok|plain)\s+"?(.*?)"?$/.exec(s.trim());
    if (m) return { kind: m[1] as (typeof kinds)[number], text: m[2] };
    if (s.startsWith("$ ")) return { kind: "cmd" as const, text: s.slice(2) };
    return { kind: "plain" as const, text: s.trim() };
  };
  if (typeof v === "string") return v.split(" / ").map(one).slice(0, 4);
  if (!Array.isArray(v)) return [];
  // An unquoted line with ": " inside (ok "JS: 304 KB") parses as a one-key map: rejoin it.
  const flat = (x: unknown) => {
    if (!x || typeof x !== "object" || "text" in x) return x;
    const [entry] = Object.entries(x);
    return entry && Object.keys(x).length === 1 ? `${entry[0]}: ${entry[1] ?? ""}` : x;
  };
  return v
    .map(flat)
    .map((x) => {
      if (!x || typeof x !== "object" || !("text" in x)) return one(String(x));
      const { kind, text } = x as { kind?: unknown; text: unknown };
      return {
        kind: kinds.find((k) => k === kind) ?? ("plain" as const),
        text: String(text),
      };
    })
    .slice(0, 4);
}

function fieldsFrom(meta: Record<string, unknown>): ImportedPost["fields"] {
  const m: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta))
    m[FIELD_ALIASES[k.toLowerCase()] ?? k.toLowerCase()] = v;
  const str = (k: string) =>
    typeof m[k] === "string" && m[k] ? (m[k] as string).trim() : undefined;
  const fields: ImportedPost["fields"] = {};
  if (str("title")) fields.title = str("title");
  if (str("slug")) fields.slug = str("slug");
  if (str("category")) fields.category = str("category");
  if (str("excerpt")) fields.excerpt = str("excerpt");
  if (m.tags !== undefined) fields.tags = list(m.tags);
  if (m.coverlines !== undefined) fields.coverLines = coverLines(m.coverlines);
  const seo = m.meta && typeof m.meta === "object" ? (m.meta as Record<string, unknown>) : {};
  const seoTitle = str("seotitle") ?? (typeof seo.title === "string" ? seo.title : undefined);
  const seoDesc =
    str("seodescription") ?? (typeof seo.description === "string" ? seo.description : undefined);
  if (seoTitle || seoDesc)
    fields.meta = { title: seoTitle ?? null, description: seoDesc ?? null, noindex: false };
  return fields;
}

/* ───────── Body ───────── */

const textNode = (text: string, marks: Mark[]): RichNode =>
  marks.length ? { type: "text", text, marks: [...marks] } : { type: "text", text };

function inline(tokens: Token[] | undefined, marks: Mark[], warn: (s: string) => void): RichNode[] {
  const out: RichNode[] = [];
  for (const t of tokens ?? []) {
    switch (t.type) {
      case "strong":
        out.push(...inline(t.tokens, [...marks, { type: "bold" }], warn));
        break;
      case "em":
        out.push(...inline(t.tokens, [...marks, { type: "italic" }], warn));
        break;
      case "del":
        out.push(...inline(t.tokens, [...marks, { type: "strike" }], warn));
        break;
      case "codespan":
        out.push(textNode(decode(t.text), [...marks, { type: "code" }]));
        break;
      case "link": {
        const href = safeHref(t.href);
        if (href === "#") warn(`Removed an unsafe link: ${t.href}`);
        const m = href === "#" ? marks : [...marks, { type: "link", attrs: { href } }];
        out.push(...inline(t.tokens, m, warn));
        break;
      }
      case "image":
        warn(`Image "${t.text || t.href}" was skipped: add it from Media in the editor.`);
        break;
      case "br":
        out.push({ type: "hardBreak" });
        break;
      case "text":
        if ("tokens" in t && t.tokens?.length) out.push(...inline(t.tokens, marks, warn));
        else if (t.text) out.push(textNode(decode(t.text), marks));
        break;
      case "escape":
        out.push(textNode(t.text, marks));
        break;
      case "html":
        break;
      default:
        if ("text" in t && typeof t.text === "string" && t.text) out.push(textNode(t.text, marks));
    }
  }
  // Merge neighbouring text nodes with identical marks (Tiptap does the same on load).
  return out.reduce<RichNode[]>((acc, n) => {
    const prev = acc.at(-1);
    if (
      prev?.type === "text" &&
      n.type === "text" &&
      JSON.stringify(prev.marks) === JSON.stringify(n.marks)
    )
      prev.text = (prev.text ?? "") + (n.text ?? "");
    else acc.push(n);
    return acc;
  }, []);
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const plain = (tokens: Token[] | undefined): string =>
  (tokens ?? [])
    .map((t) =>
      "tokens" in t && t.tokens ? plain(t.tokens) : "text" in t ? decode(String(t.text)) : "",
    )
    .join("");

/** Fence info: ```ts title="lib/x.ts" {9-10} showLineNumbers  (or filename=…, nolines). */
function fenceHint(info: string): CodeHint {
  const [lang, ...rest] = info.trim().split(/\s+/);
  const meta = rest.join(" ");
  const hint: CodeHint = { language: lang };
  const file = /(?:title|filename|file)=(?:"([^"]+)"|'([^']+)'|(\S+))/.exec(meta);
  if (file) hint.filename = file[1] ?? file[2] ?? file[3];
  const hl = /\{([\d,\s-]+)\}/.exec(meta);
  if (hl) hint.highlight = hl[1].replace(/\s+/g, "");
  if (/\b(nolines|noLineNumbers)\b/.test(meta)) hint.lineNumbers = false;
  else if (/\b(showLineNumbers|lines)\b/.test(meta)) hint.lineNumbers = true;
  return hint;
}

/** "🧩 CODE BLOCK 1 · Language: TypeScript · Filename: `x.ts` · Line numbers: on · Highlight lines: `9-10`" */
function pasteGuideHint(text: string): CodeHint | null {
  if (!/CODE BLOCK/i.test(text)) return null;
  const part = (k: string) =>
    new RegExp(`${k}\\s*:\\s*\\**\`?([^·\`*]+?)\`?\\**\\s*(?:·|$)`, "i").exec(text)?.[1]?.trim();
  const hint: CodeHint = {};
  const lang = part("Language");
  if (lang) hint.language = lang;
  const file = part("Filename");
  if (file && !/leave empty/i.test(file)) hint.filename = file;
  const lines = part("Line numbers");
  if (lines) hint.lineNumbers = !/off|no/i.test(lines);
  const hl = part("Highlight lines");
  if (hl) hint.highlight = hl.replace(/\s+/g, "");
  return hint;
}

function codeFigure(code: string, hint: CodeHint): RichNode {
  return {
    type: "codeFigure",
    attrs: {
      code: code.replace(/\n$/, ""),
      language: language(hint.language),
      filename: hint.filename ?? "",
      lineNumbers: hint.lineNumbers ?? true,
      highlight: hint.highlight ?? "",
      inserted: "",
      deleted: "",
    },
  };
}

/** `> **Takeaway:** text` or `> [!NOTE] text` → callout. */
function calloutFrom(q: Tokens.Blockquote): RichNode | null {
  const raw = q.text.trim();
  const alert = /^\[!(\w+)\]\s*([\s\S]*)$/.exec(raw);
  if (alert) {
    const kicker = alert[1].charAt(0) + alert[1].slice(1).toLowerCase();
    return { type: "callout", attrs: { kicker, body: stripMd(alert[2]) } };
  }
  const kick = /^\*\*([^*\n]{1,40}?):?\*\*:?\s+([\s\S]+)$/.exec(raw);
  if (kick && q.tokens.length === 1)
    return {
      type: "callout",
      attrs: { kicker: kick[1].replace(/:$/, ""), body: stripMd(kick[2]) },
    };
  return null;
}

/** Callout bodies are plain text (with *accent*), so drop other Markdown. */
const stripMd = (s: string) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s*\n\s*/g, " ")
    .trim();

function tableAsList(t: Tokens.Table, warn: (s: string) => void): RichNode {
  warn("A table became a bulleted list (the editor has no table block). Check it reads well.");
  const head = t.header.map((h) => plain(h.tokens));
  return {
    type: "bulletList",
    content: t.rows.map((row) => {
      const cells = row.map((c) => plain(c.tokens).trim());
      const rest = cells
        .slice(1)
        .map((c, i) => (head[i + 1] && cells.length > 2 ? `${head[i + 1]} ${c}` : c))
        .join(" · ");
      return {
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: cells[0] ?? "", marks: [{ type: "bold" }] },
              ...(rest ? [{ type: "text", text: `: ${rest}` }] : []),
            ],
          },
        ],
      };
    }),
  };
}

function blocks(
  tokens: Token[],
  ctx: { warn: (s: string) => void; title?: string; seenH1?: boolean; hint: CodeHint | null },
): RichNode[] {
  const out: RichNode[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case "heading": {
        if (t.depth === 1 && !ctx.seenH1 && out.length === 0) {
          // A # heading before any content is the document title, not body content.
          ctx.seenH1 = true;
          if (!ctx.title) ctx.title = plain(t.tokens).trim();
          break;
        }
        const level = t.depth <= 2 ? 2 : 3;
        out.push({ type: "heading", attrs: { level }, content: inline(t.tokens, [], ctx.warn) });
        break;
      }
      case "paragraph": {
        const content = inline(t.tokens, [], ctx.warn);
        if (content.length) out.push({ type: "paragraph", content });
        break;
      }
      case "code":
        out.push(codeFigure(t.text, { ...fenceHint(t.lang ?? ""), ...(ctx.hint ?? {}) }));
        ctx.hint = null;
        continue;
      case "blockquote": {
        const hint = pasteGuideHint(t.text);
        if (hint) {
          ctx.hint = hint;
          continue;
        }
        const q = t as Tokens.Blockquote;
        const callout = calloutFrom(q);
        out.push(callout ?? { type: "blockquote", content: blocks(q.tokens ?? [], ctx) });
        break;
      }
      case "list":
        out.push({
          type: t.ordered ? "orderedList" : "bulletList",
          ...(t.ordered && t.start && t.start !== 1 ? { attrs: { start: t.start } } : {}),
          content: t.items.map((item: Tokens.ListItem) => ({
            type: "listItem",
            content: item.tokens.flatMap((c) =>
              c.type === "text"
                ? [
                    {
                      type: "paragraph",
                      content: inline((c as Tokens.Text).tokens ?? [c], [], ctx.warn),
                    },
                  ]
                : blocks([c], ctx),
            ),
          })),
        });
        break;
      case "table":
        out.push(tableAsList(t as Tokens.Table, ctx.warn));
        break;
      case "hr":
        out.push({ type: "horizontalRule" });
        break;
      case "html":
      case "space":
      case "def":
        break;
      default:
        if ("text" in t && typeof t.text === "string" && t.text.trim())
          out.push({ type: "paragraph", content: [{ type: "text", text: t.text.trim() }] });
    }
    // A code hint only applies to the very next block.
    if (t.type !== "space") ctx.hint = null;
  }
  return out;
}

export function markdownToPost(md: string): ImportedPost {
  const warnings: string[] = [];
  const warn = (s: string) => {
    if (!warnings.includes(s)) warnings.push(s);
  };
  const { meta, body } = splitMeta(md);
  const fields = fieldsFrom(meta);
  const ctx = { warn, title: fields.title, hint: null as CodeHint | null };
  const content = blocks(new Lexer({ gfm: true }).lex(body), ctx);
  if (!fields.title && ctx.title) fields.title = ctx.title;
  return {
    fields,
    content: { type: "doc", content: content.length ? content : [{ type: "paragraph" }] },
    warnings,
  };
}
