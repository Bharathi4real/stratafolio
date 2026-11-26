"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

type Option = { value: string; label: string };

/**
 * Radio group with one ember pill behind the selected chip.
 * Same row: stretches across both chips (squash Y) then snaps elastically.
 * Different row: shrinks out, pops in. Reused for the blog filter.
 */
export function LiquidChips({
  name,
  legend,
  legendClassName = "eyebrow",
  options,
  value,
  onChange,
  onBlur,
}: {
  name: string;
  legend: string;
  legendClassName?: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const cur = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    const row = rowRef.current;
    const ind = indRef.current;
    if (!row || !ind) return;
    const place = (animate: boolean) => {
      const input = row.querySelector<HTMLInputElement>(`input[value="${CSS.escape(value)}"]`);
      const chip = input?.nextElementSibling as HTMLElement | null;
      if (!chip) return;
      const fr = row.getBoundingClientRect();
      const r0 = chip.getBoundingClientRect();
      const r = { x: r0.left - fr.left, y: r0.top - fr.top, w: r0.width, h: r0.height };
      const prev = cur.current;
      if (!animate || prefersReducedMotion() || !prev) {
        gsap.set(ind, { x: r.x, y: r.y, width: r.w, height: r.h, opacity: 1, scale: 1 });
      } else if (Math.abs(prev.y - r.y) > 4) {
        gsap
          .timeline()
          .to(ind, { scale: 0.6, opacity: 0, duration: 0.18, ease: "power2.in" })
          .set(ind, { x: r.x, y: r.y, width: r.w, height: r.h })
          .to(ind, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" });
      } else {
        const left = Math.min(prev.x, r.x);
        const right = Math.max(prev.x + prev.w, r.x + r.w);
        gsap
          .timeline()
          .to(ind, {
            x: left,
            width: right - left,
            scaleY: 0.82,
            duration: 0.22,
            ease: "power2.in",
          })
          .to(ind, { x: r.x, width: r.w, scaleY: 1, duration: 0.55, ease: "elastic.out(1, 0.7)" });
      }
      cur.current = r;
    };
    const first = cur.current === null;
    if (first) document.fonts.ready.then(() => place(false));
    else place(true);
    const onResize = () => {
      cur.current = null;
      place(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [value]);

  return (
    <fieldset className="topics">
      <legend className={legendClassName}>{legend}</legend>
      <div className="topic-row" ref={rowRef} data-topics>
        <span className="topic-ind" ref={indRef} aria-hidden="true" />
        {options.map((o) => (
          <label key={o.value}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              onBlur={onBlur}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
