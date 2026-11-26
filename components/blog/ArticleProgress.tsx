"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { ScrollTrigger } from "@/lib/gsap";
import { scrollToTarget } from "@/lib/lenis";

/** Top progress bar, TOC rail + active heading, and "N min left" → "Done ✓". */
export function ArticleProgress({
  minutes,
  toc,
  slug,
}: {
  minutes: number;
  toc: { id: string; title: string }[];
  slug: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLSpanElement>(null);
  const leftRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const article = document.querySelector<HTMLElement>("[data-article]");
    if (!article) return;
    let done = false;
    const st = ScrollTrigger.create({
      trigger: article,
      start: "top 30%",
      end: "bottom 70%",
      onUpdate: (s) => {
        const p = s.progress;
        if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
        railRef.current?.style.setProperty("--p", p.toFixed(3));
        if (leftRef.current)
          leftRef.current.textContent =
            p > 0.98 ? "Done ✓" : `${Math.ceil(minutes * (1 - p))} min left`;
        if (p > 0.98 && !done) {
          done = true;
          track("blog_read_complete", { slug });
        }
      },
    });
    const links = [...(listRef.current?.querySelectorAll("a") ?? [])];
    const heads = toc
      .map((t) => document.getElementById(t.id))
      .filter((h): h is HTMLElement => Boolean(h));
    const triggers = heads.map((hd, i) =>
      ScrollTrigger.create({
        trigger: hd,
        start: "top 40%",
        endTrigger: heads[i + 1] ?? article,
        end: heads[i + 1] ? "top 40%" : "bottom 40%",
        onToggle: (s) => {
          if (s.isActive)
            links.forEach((a, j) => {
              a.classList.toggle("is-active", j === i);
            });
        },
      }),
    );
    track("blog_post_open", { slug });
    return () => {
      st.kill();
      for (const t of triggers) t.kill();
    };
  }, [minutes, toc, slug]);

  return (
    <>
      <div className="read-progress" ref={barRef} aria-hidden="true" />
      <aside className="toc" aria-label="On this page">
        <p className="eyebrow">On this page</p>
        <ol className="toc-list" ref={listRef}>
          <span className="toc-rail" ref={railRef} aria-hidden="true" />
          {toc.map((t, i) => (
            <li key={t.id}>
              <a
                href={`#${t.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToTarget(`#${t.id}`);
                  history.replaceState(null, "", `#${t.id}`);
                }}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                {t.title}
              </a>
            </li>
          ))}
        </ol>
        <span className="time-left" ref={leftRef}>
          {minutes} min left
        </span>
      </aside>
    </>
  );
}
