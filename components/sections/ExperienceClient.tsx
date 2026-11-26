"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { prefersReducedMotion, ScrollTrigger } from "@/lib/gsap";
import { fmtDuration, fmtTenure, monthsBetween } from "@/lib/time";

/** Live duration chip, computed in the visitor's browser so cached pages never go stale. */
export function Duration({ start, end }: { start: string; end?: string | null }) {
  const [label, setLabel] = useState(() => fmtDuration(monthsBetween(start, end)));
  useEffect(() => setLabel(fmtDuration(monthsBetween(start, end))), [start, end]);
  return (
    <span className="chip-mini" suppressHydrationWarning>
      {label}
    </span>
  );
}

export function Tenure({ start }: { start: string }) {
  const [label, setLabel] = useState(() => fmtTenure(monthsBetween(start)));
  useEffect(() => setLabel(fmtTenure(monthsBetween(start))), [start]);
  return <strong suppressHydrationWarning>{label}</strong>;
}

/** Rail from the first node to the last; fill + head dot scrubbed by scroll; nodes light up when reached. */
export function ExperienceRail({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const roles = ref.current;
    if (!roles) return;
    const nodes = [...roles.querySelectorAll<HTMLElement>(".node")];
    if (!nodes.length) return;
    let centers: number[] = [];
    const layout = () => {
      centers = nodes.map(
        (n) => (n.parentElement?.offsetTop ?? 0) + n.offsetTop + n.offsetHeight / 2,
      );
      roles.style.setProperty("--rail-top", `${centers[0]}px`);
      roles.style.setProperty("--rail-h", `${(centers.at(-1) ?? 0) - centers[0]}px`);
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(roles);
    const setProgress = (p: number) => {
      roles.style.setProperty("--p", p.toFixed(4));
      roles.style.setProperty("--head", p > 0.002 && p < 0.998 ? "1" : "0");
      const y = centers[0] + p * ((centers.at(-1) ?? 0) - centers[0]);
      nodes.forEach((n, i) => {
        n.classList.toggle("is-lit", y >= centers[i] - 2);
      });
    };
    if (prefersReducedMotion()) {
      setProgress(1);
      return () => ro.disconnect();
    }
    setProgress(0);
    const st = ScrollTrigger.create({
      trigger: roles,
      start: () => `top+=${centers[0]} 62%`,
      end: () => `top+=${centers.at(-1)} 62%`,
      scrub: true,
      onRefresh: (s) => setProgress(s.progress),
      onUpdate: (s) => setProgress(s.progress),
    });
    return () => {
      ro.disconnect();
      st.kill();
    };
  }, []);
  return (
    <div className="exp-roles" ref={ref}>
      <span className="exp-rail" aria-hidden="true">
        <i />
      </span>
      {children}
    </div>
  );
}
