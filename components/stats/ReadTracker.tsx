"use client";

import { useEffect } from "react";
import { sendStat } from "./StatsBeacon";

const READ_DEPTH = 60;
const READ_SECONDS = 30;

/**
 * Blog read tracking: max scroll depth through the article and active (visible) time.
 * A "read" is counted once at 60% depth + 30s; a "leave" event records the final depth/time
 * so the admin can show average read depth and time per post.
 */
export function ReadTracker({ path }: { path: string }) {
  useEffect(() => {
    const article = document.querySelector<HTMLElement>("[data-article]");
    if (!article) return;
    let depth = 0;
    let seconds = 0;
    let read = false;
    let left = false;

    const measure = () => {
      const r = article.getBoundingClientRect();
      const seen = Math.min(r.height, Math.max(0, window.innerHeight - r.top));
      depth = Math.max(depth, Math.round((seen / Math.max(1, r.height)) * 100));
      if (!read && depth >= READ_DEPTH && seconds >= READ_SECONDS) {
        read = true;
        sendStat({ type: "read", path, depth, seconds });
      }
    };
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        seconds += 1;
        measure();
      }
    }, 1000);
    const leave = () => {
      // A zero-second "visit" is a remount (Strict Mode) or an instant bounce: nothing to report.
      if (left || seconds < 1) return;
      left = true;
      measure();
      sendStat({ type: "leave", path, depth, seconds });
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") leave();
    };
    window.addEventListener("scroll", measure, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", leave);
    measure();
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("scroll", measure);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", leave);
      leave(); // client-side navigation away
    };
  }, [path]);
  return null;
}
