import "server-only";
import type { HomePage } from "@/lib/content/schema";
import { getHome, getMediaUrl, getNavigation, getSettings } from "./queries";

export type Section = NonNullable<HomePage["sections"]>[number];

/** Visible sections and their "01 —" numbers, in saved order. */
export function numberSections(home: HomePage) {
  const visible = (home.sections ?? []).filter((s) => !s.hidden);
  const numbers = new Map<string, string>();
  let n = 0;
  for (const s of visible) {
    if ("label" in s && "anchor" in s) {
      n += 1;
      numbers.set(s.id ?? `${s.blockType}-${n}`, String(n).padStart(2, "0"));
      if (s.anchor) numbers.set(`#${s.anchor}`, String(n).padStart(2, "0"));
    }
  }
  return { visible, numbers };
}

/** Everything the layout chrome needs. */
export async function getChrome() {
  const [settings, nav, home] = await Promise.all([getSettings(), getNavigation(), getHome()]);
  const { numbers } = numberSections(home);
  const withNum = (items: { label: string; href: string }[] | null | undefined) =>
    (items ?? []).map((it, i) => ({
      label: it.label,
      href: it.href,
      num: numbers.get(it.href) ?? String(i + 1).padStart(2, "0"),
    }));
  return {
    settings,
    nav,
    dock: withNum(nav.dock),
    menu: withNum(nav.menu),
    resumeUrl: await getMediaUrl(settings.resume),
  };
}
