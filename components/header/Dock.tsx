"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { scrollToTarget } from "@/lib/lenis";

export type NavItem = { label: string; href: string; num?: string };

/** Resolve a nav href for the current page: section anchors point home from other pages. */
export function resolveHref(href: string, pathname: string) {
  if (href === "#blog" && pathname.startsWith("/blog")) return "/blog";
  if (href.startsWith("#") && pathname !== "/") return `/${href}`;
  return href;
}

export const isCurrent = (href: string, pathname: string) =>
  (href === "#blog" || href === "/blog") && pathname.startsWith("/blog");

/** The dock for a known pathname (also the static fallback while the real one streams). */
export function DockView({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const ref = useRef<HTMLElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const dock = ref.current;
    const ind = indRef.current;
    if (!dock || !ind) return;
    const links = [...dock.querySelectorAll<HTMLAnchorElement>("[data-dock-link]")];
    const current = dock.querySelector<HTMLAnchorElement>('[aria-current="page"]');
    let active: HTMLAnchorElement | null = current;
    const moveTo = (el: HTMLElement | null) => {
      if (!el) {
        ind.style.opacity = "0";
        return;
      }
      ind.style.opacity = "1";
      ind.style.width = `${el.offsetWidth}px`;
      ind.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    const enter = (e: Event) => moveTo(e.currentTarget as HTMLElement);
    const leave = () => moveTo(active);
    for (const l of links) l.addEventListener("pointerenter", enter);
    dock.addEventListener("pointerleave", leave);
    document.fonts?.ready.then(() => moveTo(active));

    const setActive = (id: string | null) => {
      active = current ?? links.find((l) => l.dataset.target === id) ?? null;
      for (const l of links) l.classList.toggle("is-active", l === active);
      if (!dock.matches(":hover")) moveTo(active);
    };
    const triggers: ScrollTrigger[] = [];
    if (pathname === "/") {
      for (const l of links) {
        const id = l.dataset.target;
        const sec = id ? document.getElementById(id) : null;
        if (!sec || !id) continue;
        triggers.push(
          ScrollTrigger.create({
            trigger: sec,
            start: "top 45%",
            end: "bottom 45%",
            onToggle: (st) => {
              if (st.isActive) setActive(id);
              else if (active?.dataset.target === id) setActive(null);
            },
          }),
        );
      }
    }
    const onResize = () => moveTo(active);
    window.addEventListener("resize", onResize);
    return () => {
      for (const l of links) l.removeEventListener("pointerenter", enter);
      dock.removeEventListener("pointerleave", leave);
      window.removeEventListener("resize", onResize);
      for (const t of triggers) t.kill();
    };
  }, [pathname]);

  return (
    <nav className="dock" aria-label="Primary" data-dock ref={ref}>
      <span className="dock-ind" ref={indRef} aria-hidden="true" />
      {items.map((it) => {
        const href = resolveHref(it.href, pathname);
        const current = isCurrent(it.href, pathname);
        return (
          <a
            key={it.href + it.label}
            href={href}
            data-dock-link
            data-target={it.href.startsWith("#") ? it.href.slice(1) : undefined}
            aria-current={current ? "page" : undefined}
            onClick={(e) => {
              if (pathname === "/" && it.href.startsWith("#")) {
                e.preventDefault();
                scrollToTarget(it.href);
                history.replaceState(null, "", it.href);
              }
            }}
          >
            {it.num ? <span className="dn">{it.num}</span> : null}
            {it.label}
          </a>
        );
      })}
    </nav>
  );
}

/** Glass pill nav with a sliding ember indicator and scroll spy. */
export function Dock({ items }: { items: NavItem[] }) {
  return <DockView items={items} pathname={usePathname()} />;
}
