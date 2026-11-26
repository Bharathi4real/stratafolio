"use client";

import { type ReactNode, useRef } from "react";
import { gsap, prefersReducedMotion, SplitText, useGSAP } from "@/lib/gsap";

/** Split-char name reveal, staggered fade-in of the rest, and parallax out on scroll. */
export function HeroMotion({ children, reveal }: { children: ReactNode; reveal: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const hero = ref.current;
      if (!hero || prefersReducedMotion()) return;
      const inner = hero.querySelector("[data-hero-inner]");
      gsap.to(inner, {
        yPercent: -18,
        opacity: 0.2,
        ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
      });
      const hide = hero.querySelectorAll("[data-hero-hide]");
      const names = [...hero.querySelectorAll<HTMLElement>("[data-hero-name]")];
      let splits: SplitText[] = [];
      document.fonts.ready.then(() => {
        const tl = gsap.timeline({ delay: 0.35 });
        if (reveal) {
          splits = names.map((el, i) => {
            const split = SplitText.create(el, {
              type: "chars",
              mask: "chars",
              charsClass: "hero-char",
            });
            tl.from(
              split.chars,
              { yPercent: 115, rotate: 6, duration: 1.4, ease: "expo.out", stagger: 0.035 },
              i * 0.18,
            );
            return split;
          });
        }
        tl.to(
          hide,
          { opacity: 1, duration: 1, stagger: 0.08, ease: "power2.out" },
          reveal ? 0.9 : 0.1,
        );
        tl.from(hide, { y: 16, duration: 1, stagger: 0.08, ease: "expo.out" }, reveal ? 0.9 : 0.1);
      });
      return () => {
        for (const s of splits) s.revert();
      };
    },
    { scope: ref },
  );
  return (
    <section className="hero" id="top" data-hero ref={ref}>
      {children}
    </section>
  );
}
