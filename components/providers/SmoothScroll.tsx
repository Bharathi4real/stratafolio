"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { gsap, prefersReducedMotion, ScrollTrigger } from "@/lib/gsap";
import { setLenis } from "@/lib/lenis";
import { markDocument } from "@/lib/mark";
import { setUI } from "@/lib/ui-store";

/** Lenis driven by GSAP's ticker so ScrollTrigger never reads a stale position. */
export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    markDocument();
    const reduced = prefersReducedMotion();
    setUI({ reducedMotion: reduced });
    if (reduced) return;
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, anchors: { offset: -80 } });
    setLenis(lenis);
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh after each navigation
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (!location.hash) window.scrollTo(0, 0);
      ScrollTrigger.refresh();
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
