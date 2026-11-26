"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Admin theme: Light / Dark / Auto (follows the OS, live). Stored separately from the public
 * site's theme ("admin-theme"), so switching here never changes what visitors' browsers remember.
 */
export type ThemeMode = "light" | "dark" | "system";
export const ADMIN_THEME_KEY = "admin-theme";

const read = (): ThemeMode => {
  try {
    const v = localStorage.getItem(ADMIN_THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
};
const systemTheme = () => (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
function apply(mode: ThemeMode) {
  const t = mode === "system" ? systemTheme() : mode;
  const root = document.documentElement;
  // Brief class so colours cross-fade instead of snapping.
  root.classList.add("theme-anim");
  root.dataset.theme = t;
  root.style.colorScheme = t;
  window.setTimeout(() => root.classList.remove("theme-anim"), 450);
}

const OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  {
    value: "light",
    label: "Light",
    icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  },
  { value: "dark", label: "Dark", icon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" },
  { value: "system", label: "Auto", icon: "M4 5h16v11H4zM8 20h8M12 16v4" },
];

/** Back to Auto (follows the OS). Any open ThemeMode control updates too. */
export function resetAdminTheme() {
  try {
    localStorage.removeItem(ADMIN_THEME_KEY);
  } catch {
    /* private mode */
  }
  apply("system");
  window.dispatchEvent(new Event("admin-theme-reset"));
}

export function ThemeMode() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const ref = useRef<HTMLFieldSetElement>(null);
  const ind = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setMode(read());
    const on = () => setMode("system");
    window.addEventListener("admin-theme-reset", on);
    return () => window.removeEventListener("admin-theme-reset", on);
  }, []);

  // Auto: follow OS changes while the admin is open.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const on = () => apply("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [mode]);

  useLayoutEffect(() => {
    const btn = ref.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (btn && ind.current) {
      ind.current.style.width = `${btn.offsetWidth}px`;
      ind.current.style.transform = `translateX(${btn.offsetLeft}px)`;
    }
  });

  const choose = (m: ThemeMode) => {
    setMode(m);
    try {
      localStorage.setItem(ADMIN_THEME_KEY, m);
    } catch {
      /* private mode */
    }
    apply(m);
  };

  return (
    <fieldset className="theme-mode" ref={ref} aria-label="Admin theme">
      <span className="ind" ref={ind} aria-hidden="true" />
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={mode === o.value}
          title={o.value === "system" ? "Auto: follows your system setting" : `${o.label} theme`}
          onClick={() => choose(o.value)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={o.icon} />
          </svg>
          <span>{o.label}</span>
        </button>
      ))}
    </fieldset>
  );
}
