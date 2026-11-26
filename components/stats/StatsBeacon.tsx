"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Fire-and-forget event to the first-party collector (text/plain: no CORS preflight).
 * The endpoint has a neutral name (/api/e): blocklists match paths like /api/stats or /track.
 */
export function sendStat(payload: Record<string, unknown>) {
  try {
    if (window.self !== window.top) return; // admin live-preview iframe
    const body = JSON.stringify(payload);
    if (!navigator.sendBeacon?.("/api/e", body))
      void fetch("/api/e", { method: "POST", body, keepalive: true });
  } catch {
    /* stats must never break the page */
  }
}

// Guards against double effects (React Strict Mode in dev, fast re-renders).
let last = { path: "", at: 0 };

/** One "view" per page (including client-side navigations). Cookieless. */
export function StatsBeacon() {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (last.path === path && Date.now() - last.at < 1500) return;
    last = { path, at: Date.now() };
    sendStat({
      type: "view",
      path,
      // The external referrer only matters for the landing page.
      referrer: first.current ? document.referrer || undefined : undefined,
    });
    first.current = false;
  }, [path]);
  return null;
}
