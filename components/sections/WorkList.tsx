"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "@/components/ui/Icons";
import { track } from "@/lib/analytics";
import { finePointer, gsap } from "@/lib/gsap";
import { throttle } from "@/lib/pacer";

type Item = {
  slug: string;
  index: string;
  title: string;
  summary: string;
  label: string;
  tags: string[];
  inline: { value: string; label: string }[];
  previewLabel: string;
  metrics: { value: string; label: string }[];
};

/** Case-study rows with a metrics card that follows the cursor (fine pointers only). */
export function WorkList({ items }: { items: Item[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Item | null>(null);

  useEffect(() => {
    const list = listRef.current;
    const preview = previewRef.current;
    if (!list || !preview || !finePointer()) return;
    const xTo = gsap.quickTo(preview, "x", { duration: 0.55, ease: "power3.out" });
    const yTo = gsap.quickTo(preview, "y", { duration: 0.55, ease: "power3.out" });
    const visible = () => Number(gsap.getProperty(preview, "opacity")) > 0.05;
    const onMove = (e: PointerEvent) => {
      xTo(e.clientX + 28);
      yTo(e.clientY - preview.offsetHeight / 2);
    };
    const onEnter = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-work-item]");
      if (!el) return;
      if (!visible())
        gsap.set(preview, { x: e.clientX + 28, y: e.clientY - preview.offsetHeight / 2 });
      setActive(items[Number(el.dataset.i)] ?? null);
      gsap.to(preview, { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.5, ease: "expo.out" });
    };
    const hide = () =>
      gsap.to(preview, {
        autoAlpha: 0,
        scale: 0.92,
        rotate: -3,
        duration: 0.4,
        ease: "power2.out",
        overwrite: "auto",
      });
    // Scrolling moves the list out from under a still pointer without firing pointerleave.
    let px = -1;
    let py = -1;
    const track = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
    };
    const checkUnder = throttle(
      () => {
        if (!visible()) return;
        const el = document.elementFromPoint(px, py);
        if (!el?.closest("[data-work-list]")) hide();
      },
      { wait: 50, trailing: true },
    );
    list.addEventListener("pointermove", onMove);
    const rows = [...list.querySelectorAll<HTMLElement>("[data-work-item]")];
    for (const r of rows) r.addEventListener("pointerenter", onEnter);
    list.addEventListener("pointerleave", hide);
    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("scroll", checkUnder, { passive: true });
    return () => {
      list.removeEventListener("pointermove", onMove);
      for (const r of rows) r.removeEventListener("pointerenter", onEnter);
      list.removeEventListener("pointerleave", hide);
      window.removeEventListener("pointermove", track);
      window.removeEventListener("scroll", checkUnder);
    };
  }, [items]);

  return (
    <>
      <ul className="work-list" data-work-list ref={listRef}>
        {items.map((it, i) => (
          <li className="work-item" data-work-item data-i={i} data-reveal key={it.slug}>
            <Link
              className="work-link"
              href={`/work/${it.slug}`}
              onClick={() => track("case_study_open", { slug: it.slug })}
            >
              <span className="work-idx">{it.index}</span>
              <div>
                <h3 className="work-title">{it.title}</h3>
                <p className="work-sum">{it.summary}</p>
              </div>
              <div className="work-meta">
                <span className="eyebrow">{it.label}</span>
                <div className="tags">
                  {it.tags.map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="work-metrics-inline">
                {it.inline.map((m) => (
                  <div key={m.label}>
                    <strong>{m.value}</strong>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
              <span className="work-arrow" aria-hidden="true">
                <ArrowRight />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="work-preview" ref={previewRef} aria-hidden="true">
        <div className="work-preview-inner">
          {active ? (
            <>
              <p className="eyebrow" style={{ color: "var(--paper-300)" }}>
                {active.index} / {active.previewLabel}
              </p>
              <div className="wp-metrics">
                {active.metrics.slice(0, 3).map((m) => (
                  <div key={m.label}>
                    <strong>{m.value}</strong>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
