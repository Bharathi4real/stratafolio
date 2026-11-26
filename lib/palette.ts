/**
 * Site colour palettes. A palette only swaps the accent family (and the signal colour);
 * ink and paper neutrals stay, so every palette keeps the Ink & Ember structure.
 *
 * The stylesheets read --ember-300/500/700 and --signal-400/700, so overriding those five
 * variables re-tints the whole site, the admin and (via `paletteFromCss`) the hero shader.
 */

export type Shades = { s300: string; s500: string; s700: string };
export type Preset = {
  id: string;
  name: string;
  note: string;
  accent: Shades;
  signal: { s400: string; s700: string };
};

export const DEFAULT_PALETTE = "ember";

export const PRESETS: Preset[] = [
  {
    id: "ember",
    name: "Ink & Ember",
    note: "The original. Warm, confident orange.",
    accent: { s300: "#ff9466", s500: "#ff5a1f", s700: "#c2410c" },
    signal: { s400: "#3ddbb4", s700: "#0f766e" },
  },
  {
    id: "cobalt",
    name: "Cobalt",
    note: "Cool, technical blue.",
    accent: { s300: "#93b4ff", s500: "#5b8cff", s700: "#1d4ed8" },
    signal: { s400: "#3ddbb4", s700: "#0f766e" },
  },
  {
    id: "violet",
    name: "Violet",
    note: "Calm and editorial.",
    accent: { s300: "#c4b5fd", s500: "#a78bfa", s700: "#6d28d9" },
    signal: { s400: "#3ddbb4", s700: "#0f766e" },
  },
  {
    id: "teal",
    name: "Signal Teal",
    note: "Fresh green-blue. Code tags turn ember.",
    accent: { s300: "#7ee8d0", s500: "#2dd4bf", s700: "#0f766e" },
    signal: { s400: "#ff9466", s700: "#c2410c" },
  },
  {
    id: "rose",
    name: "Rose",
    note: "Bold pink-red.",
    accent: { s300: "#fda4af", s500: "#fb7185", s700: "#be123c" },
    signal: { s400: "#3ddbb4", s700: "#0f766e" },
  },
  {
    id: "amber",
    name: "Amber",
    note: "Golden and bright.",
    accent: { s300: "#fcd34d", s500: "#fbbf24", s700: "#b45309" },
    signal: { s400: "#3ddbb4", s700: "#0f766e" },
  },
  {
    id: "lime",
    name: "Lime",
    note: "High-energy green.",
    accent: { s300: "#d9f99d", s500: "#a3e635", s700: "#4d7c0f" },
    signal: { s400: "#7dd3fc", s700: "#0369a1" },
  },
];

const INK_950 = "#0b0b0d";
const PAPER_50 = "#f5f2eb";

/* ── colour maths ── */
const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
export function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
const toHex = (rgb: number[]) =>
  `#${rgb.map((n) => clamp(n).toString(16).padStart(2, "0")).join("")}`;
export const mixHex = (a: string, b: string, t: number) => mix(a, b, t);
const mix = (a: string, b: string, t: number) => {
  const x = hexToRgb(a) ?? [0, 0, 0];
  const y = hexToRgb(b) ?? [0, 0, 0];
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};
function luminance(hex: string) {
  const rgb = hexToRgb(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio (1–21). */
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Shades for a custom accent: 300 lighter, 700 darkened until it passes AA on paper. */
export function shadesFrom(hex: string): Shades {
  const s500 = toHex(hexToRgb(hex) ?? [255, 90, 31]);
  let s700 = mix(s500, INK_950, 0.3);
  for (let i = 0; i < 12 && contrast(s700, PAPER_50) < 4.5; i++) s700 = mix(s700, INK_950, 0.12);
  return { s300: mix(s500, "#ffffff", 0.38), s500, s700 };
}

export type Appearance = { palette: string; custom?: string | null };

export function resolvePalette(a: Partial<Appearance> | null | undefined) {
  const preset = PRESETS.find((p) => p.id === a?.palette);
  if (preset) return { accent: preset.accent, signal: preset.signal, name: preset.name };
  if (a?.palette === "custom" && a.custom && hexToRgb(a.custom))
    return { accent: shadesFrom(a.custom), signal: PRESETS[0].signal, name: "Custom" };
  const d = PRESETS[0];
  return { accent: d.accent, signal: d.signal, name: d.name };
}

/** Text colour on top of an accent fill (buttons, chips): dark ink unless the fill is dark. */
const onColor = (fill: string) =>
  contrast(fill, INK_950) >= contrast(fill, PAPER_50) ? INK_950 : PAPER_50;

/** Readability report shown in the editor. */
export function paletteChecks(a: Partial<Appearance>) {
  const { accent } = resolvePalette(a);
  return {
    darkText: contrast(accent.s500, INK_950), // accent text on the dark background
    lightText: contrast(accent.s700, PAPER_50), // accent text on the light background
    darkButton: contrast(accent.s500, onColor(accent.s500)),
    lightButton: contrast(accent.s700, onColor(accent.s700)),
  };
}

/**
 * CSS overrides for a palette. Empty for the default, so the stylesheets' own values apply.
 * `scope` lets the editor preview a palette inside one element.
 */
export function paletteCss(a: Partial<Appearance> | null | undefined, scope = ":root") {
  const p = resolvePalette(a);
  if (!a?.palette || a.palette === DEFAULT_PALETTE) return "";
  const vars = `--ember-300:${p.accent.s300};--ember-500:${p.accent.s500};--ember-700:${p.accent.s700};--signal-400:${p.signal.s400};--signal-700:${p.signal.s700}`;
  // html:root / html[data-theme] out-rank the stylesheets' :root and [data-theme] blocks
  // regardless of load order.
  const root = scope === ":root" ? "html:root" : scope;
  const lightSel = scope === ":root" ? 'html[data-theme="light"]' : `[data-theme="light"] ${scope}`;
  return `${root}{${vars};--on-accent:${onColor(p.accent.s500)}}${lightSel}{--on-accent:${onColor(p.accent.s700)}}`;
}

/** The hero shader reads the live palette from CSS, so it follows any palette. */
export function paletteFromCss() {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  const hot = v("--ember-500");
  const glow = v("--ember-300");
  return hexToRgb(hot) && hexToRgb(glow) ? { hot, glow, light: mix(hot, "#ffffff", 0.1) } : null;
}

/**
 * Scoped preview (editor only). Semantic variables resolve where they're declared (:root),
 * so a nested preview must set --accent/--signal itself for each theme.
 */
export function palettePreviewCss(a: Partial<Appearance> | null | undefined, scope: string) {
  const { accent, signal } = resolvePalette(a);
  const block = (sel: string, ac: string, sg: string) =>
    `${sel}{--accent:${ac};--accent-soft:color-mix(in oklab,${ac} 12%,transparent);--signal:${sg};--on-accent:${onColor(ac)}}`;
  return (
    block(`${scope}[data-theme="dark"]`, accent.s500, signal.s400) +
    block(`${scope}[data-theme="light"]`, accent.s700, signal.s700)
  );
}
