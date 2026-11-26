"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { gsap, prefersReducedMotion, ScrollTrigger, SplitText } from "@/lib/gsap";

/**
 * Page-level entrance motion, re-run per route: [data-reveal] batch fade-ups,
 * [data-split] masked line reveals, [data-count] counters, [data-stratum] excavation.
 * Elements are only hidden under html.js-motion, so no-JS visitors see everything.
 */
export function SiteMotion() {
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run per page
  useEffect(() => {
    const reduced = prefersReducedMotion();
    const main = document.getElementById("main");
    if (!main) return;

    const counters = [...main.querySelectorAll<HTMLElement>("[data-count]")];
    if (reduced) {
      for (const el of counters) el.textContent = el.dataset.count ?? el.textContent;
      return;
    }

    let splits: SplitText[] = [];
    const ctx = gsap.context(() => {
      ScrollTrigger.batch(main.querySelectorAll("[data-reveal]"), {
        start: "top 88%",
        once: true,
        onEnter: (els) =>
          gsap.to(els, {
            opacity: 1,
            y: 0,
            duration: 1.1,
            ease: "expo.out",
            stagger: 0.08,
            overwrite: true,
          }),
      });

      for (const el of counters) {
        const end = Number(el.dataset.count);
        const obj = { v: 0 };
        el.textContent = "0";
        gsap.to(obj, {
          v: end,
          duration: 1.8,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
          onUpdate: () => {
            el.textContent = String(Math.round(obj.v));
          },
        });
      }

      const strata = main.querySelectorAll("[data-stratum]");
      if (strata.length)
        gsap.from(strata, {
          clipPath: "inset(0% 100% 0% 0%)",
          duration: 1.2,
          ease: "expo.out",
          stagger: 0.12,
          scrollTrigger: { trigger: ".strata", start: "top 75%", once: true },
          clearProps: "clipPath",
        });

      for (const el of main.querySelectorAll("[data-draw]"))
        gsap.from(el, {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 1.4,
          ease: "expo.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        });
    }, main);

    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      ctx.add(() => {
        // A heading that just morphed in through a view transition (data-morph) is already in
        // place; replaying the line reveal on top of it would flash the text.
        const morphing = Boolean(
          (document as Document & { activeViewTransition?: unknown }).activeViewTransition,
        );
        splits = [...main.querySelectorAll<HTMLElement>("[data-split]")]
          .filter((el) => !(morphing && el.hasAttribute("data-morph")))
          .map((el) => {
            const split = SplitText.create(el, {
              type: "lines",
              mask: "lines",
              linesClass: "split-line-inner",
            });
            gsap.from(split.lines, {
              yPercent: 110,
              duration: 1.2,
              ease: "expo.out",
              stagger: 0.09,
              scrollTrigger: { trigger: el, start: "top 85%", once: true },
            });
            return split;
          });
      });
      ScrollTrigger.refresh();
    });

    return () => {
      cancelled = true;
      for (const s of splits) s.revert();
      ctx.revert();
    };
  }, [pathname]);

  return null;
}
