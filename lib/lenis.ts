"use client";

import type Lenis from "lenis";

/** The single Lenis instance (null under reduced motion). */
let instance: Lenis | null = null;
export const setLenis = (l: Lenis | null) => {
  instance = l;
};
export const getLenis = () => instance;

export function scrollToTarget(target: string | number, offset = -80) {
  const l = instance;
  if (l) {
    l.scrollTo(target, {
      offset: typeof target === "number" ? 0 : offset,
      duration: typeof target === "number" ? 1.6 : 1.2,
    });
    return;
  }
  if (typeof target === "number") window.scrollTo({ top: target, behavior: "smooth" });
  else document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });
}
