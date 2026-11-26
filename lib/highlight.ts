import { createHighlighter } from "@tanstack/highlight/core";
import { css } from "@tanstack/highlight/languages/css";
import { json } from "@tanstack/highlight/languages/json";
import { shell } from "@tanstack/highlight/languages/shell";
import { ts } from "@tanstack/highlight/languages/ts";
import { tsx } from "@tanstack/highlight/languages/tsx";
import { createThemeCss } from "@tanstack/highlight/theme";

/** Shared by the site and the admin. Register only languages listed in highlight-languages.ts. */
export const highlighter = createHighlighter({ languages: [css, json, shell, ts, tsx] });

export const inkEmberTheme = {
  name: "ink-ember",
  type: "dark" as const,
  background: "#0b0b0d",
  foreground: "#f5f2eb",
  tokens: {
    token: "#f5f2eb",
    keyword: "#ff8a5c",
    operator: "#a8a49b",
    function: "#3ddbb4",
    string: "#e8c48a",
    number: "#9db7ff",
    literal: "#9db7ff",
    type: "#9db7ff",
    comment: "#7a776f",
    property: "#d9d4c9",
    variable: "#f5f2eb",
    tag: "#ff8a5c",
    attr: "#3ddbb4",
    selector: "#ff9466",
    meta: "#7a776f",
    heading: "#ff5a1f",
    link: "#3ddbb4",
    inserted: "#3ddbb4",
    deleted: "#ff5a1f",
    command: "#3ddbb4",
    "code-inline": "#3ddbb4",
  },
};

/** Code blocks stay ink in both site themes, so one theme on :root. */
export const syntaxCss = createThemeCss({
  themes: [{ selector: ":root", theme: inkEmberTheme }],
  codeBlockSelector: ".code-block pre.th-code",
  lineNumbersSelector: ".code-block .th-code--line-numbers",
});

/** "2-3,9" → decorations */
export function lineRanges(spec: string | null | undefined, className: string) {
  if (!spec) return [];
  return spec
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [a, b] = r.split("-").map((n) => Number(n.trim()));
      return { lines: (b ? [a, b] : a) as number | [number, number], className };
    })
    .filter((d) =>
      Array.isArray(d.lines) ? d.lines.every(Number.isFinite) : Number.isFinite(d.lines),
    );
}

export function renderCode(opts: {
  code: string;
  lang: string;
  title?: string | null;
  lineNumbers?: boolean | null;
  highlight?: string | null;
  inserted?: string | null;
  deleted?: string | null;
}) {
  const lang = opts.lang === "text" ? "plaintext" : opts.lang;
  return highlighter.renderCodeBlockData({
    code: opts.code,
    lang,
    title: opts.title ?? undefined,
    lineNumbers: Boolean(opts.lineNumbers),
    decorations: [
      ...lineRanges(opts.highlight, "is-hl"),
      ...lineRanges(opts.inserted, "is-ins"),
      ...lineRanges(opts.deleted, "is-del"),
    ],
  } as Parameters<typeof highlighter.renderCodeBlockData>[0]);
}
