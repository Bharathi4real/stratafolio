"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { uiStore } from "@/lib/ui-store";

/** Loads three.js after first paint (idle), so the shader never blocks LCP. */
export function EmberCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let field: import("@/lib/ember").EmberField | null = null;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    const start = async () => {
      const { createEmberField } = await import("@/lib/ember");
      if (cancelled) return;
      const reduced = prefersReducedMotion();
      field = createEmberField(canvas, { reducedMotion: reduced });
      if (!field) {
        canvas.classList.add("is-fallback");
        return;
      }
      if (!reduced)
        gsap.to(field.uniforms.uReveal, {
          value: 1.3,
          duration: 2.4,
          ease: "power3.inOut",
          delay: 0.15,
        });
      let theme = uiStore.state.theme;
      const sub = uiStore.subscribe((s) => {
        if (s.theme !== theme) {
          theme = s.theme;
          field?.setTheme(s.theme, gsap);
        }
      });
      unsub = () => sub.unsubscribe();
      // Theme may differ from the store's default on first paint
      const actual = document.documentElement.dataset.theme === "light" ? "light" : "dark";
      if (actual === "light") field.setTheme("light");
    };
    const ric = (
      window as unknown as { requestIdleCallback?: (cb: () => void, o?: object) => number }
    ).requestIdleCallback;
    if (ric) ric(() => void start(), { timeout: 600 });
    else setTimeout(() => void start(), 120);
    return () => {
      cancelled = true;
      unsub?.();
      field?.destroy();
    };
  }, []);
  return <canvas ref={ref} data-ember aria-hidden="true" tabIndex={-1} />;
}
