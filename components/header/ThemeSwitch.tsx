"use client";

import { useEffect } from "react";
import { MoonIcon, SunIcon } from "@/components/ui/Icons";
import { track } from "@/lib/analytics";
import { setUI, storage, type Theme, useUI } from "@/lib/ui-store";

export function ThemeSwitch() {
  const theme = useUI((s) => s.theme);
  useEffect(() => {
    setUI({ theme: document.documentElement.dataset.theme === "light" ? "light" : "dark" });
  }, []);
  const dark = theme !== "light";
  const toggle = () => {
    const next: Theme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    storage.set("theme", next);
    setUI({ theme: next });
    track("theme_toggle", { to: next });
  };
  return (
    <button
      className="theme-switch"
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Dark theme on. Switch to light" : "Light theme on. Switch to dark"}
      onClick={toggle}
    >
      <span className="ts-ic ts-ic-sun" aria-hidden="true">
        <SunIcon />
      </span>
      <span className="ts-ic ts-ic-moon" aria-hidden="true">
        <MoonIcon />
      </span>
      <span className="ts-knob" aria-hidden="true">
        <span className="ts-k-sun">
          <SunIcon />
        </span>
        <span className="ts-k-moon">
          <MoonIcon />
        </span>
      </span>
    </button>
  );
}
