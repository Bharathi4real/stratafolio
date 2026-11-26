"use client";

import { useLayoutEffect } from "react";

/**
 * An inline script that runs while the HTML is parsed (before first paint) but is inert when
 * React renders on the client: `text/javascript` on the server, `text/plain` in the browser.
 * React warns about rendering live <script> tags on the client, and they never execute there
 * anyway. Pattern from the Next.js guide "Preventing flash before hydration".
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static, first-party bootstrap code
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Re-applies the stored theme on <html> after mount. In development React's Strict Mode
 * remount resets <html> attributes and drops what the inline script set; in production this
 * is a no-op because the attribute is already right.
 */
export function ReapplyTheme({
  storageKey,
  setMotionClass = false,
}: {
  storageKey: string;
  setMotionClass?: boolean;
}) {
  useLayoutEffect(() => {
    try {
      const d = document.documentElement;
      const s = localStorage.getItem(storageKey);
      const t =
        s === "light" || s === "dark"
          ? s
          : matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark";
      if (d.dataset.theme !== t) d.dataset.theme = t;
      d.style.colorScheme = t;
      if (setMotionClass && !matchMedia("(prefers-reduced-motion: reduce)").matches)
        d.classList.add("js-motion");
    } catch {
      /* storage blocked */
    }
  }, [storageKey, setMotionClass]);
  return null;
}
