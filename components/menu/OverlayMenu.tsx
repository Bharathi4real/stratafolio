"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { type NavItem, resolveHref } from "@/components/header/Dock";
import { ArrowLabel } from "@/components/ui/Arrow";
import { LiveClock } from "@/components/ui/LiveClock";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { useEscape } from "@/lib/hotkeys";
import { getLenis, scrollToTarget } from "@/lib/lenis";
import { setUI, useUI } from "@/lib/ui-store";

export type MenuProps = {
  items: NavItem[];
  email: string;
  links: { label: string; href: string; download?: boolean }[];
  city: string;
  timeZone: string;
  status?: string | null;
  topo: ReactNode;
};

export function OverlayMenuView({
  items,
  email,
  links,
  city,
  timeZone,
  status,
  topo,
  pathname,
}: MenuProps & { pathname: string }) {
  const open = useUI((s) => s.menuOpen);
  const ref = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close on route change
  useEffect(() => {
    setUI({ menuOpen: false });
  }, [pathname]);

  useEscape(() => setUI({ menuOpen: false }), open);

  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const btn = document.querySelector<HTMLButtonElement>("[data-menu-btn]");
    document.documentElement.classList.toggle("menu-open", open);
    if (!open) {
      getLenis()?.start();
      return;
    }
    getLenis()?.stop();
    if (!prefersReducedMotion()) {
      gsap.fromTo(
        menu.querySelectorAll(".menu-links a"),
        { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 1, ease: "expo.out", stagger: 0.05, delay: 0.15 },
      );
      gsap.fromTo(
        menu.querySelectorAll(".ms-block"),
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: 0.07, delay: 0.35 },
      );
    }
    const first = menu.querySelector<HTMLElement>("a");
    setTimeout(() => first?.focus({ preventScroll: true }), 120);
    // Focus trap: the menu button and the menu's links
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = [btn, ...menu.querySelectorAll<HTMLElement>("a,button")].filter(
        Boolean,
      ) as HTMLElement[];
      const i = nodes.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey
        ? i <= 0
          ? nodes.length - 1
          : i - 1
        : i === nodes.length - 1
          ? 0
          : i + 1;
      e.preventDefault();
      nodes[next]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      btn?.focus({ preventScroll: true });
    };
  }, [open]);

  const go = (href: string) => (e: React.MouseEvent) => {
    setUI({ menuOpen: false });
    if (pathname === "/" && href.startsWith("#")) {
      e.preventDefault();
      getLenis()?.start();
      setTimeout(() => scrollToTarget(href), 50);
    }
  };

  return (
    <div className="menu" id="menu" ref={ref} data-open={open} aria-hidden={!open} inert={!open}>
      {topo}
      <div className="menu-inner gutter">
        <nav className="menu-links" aria-label="Menu">
          {items.map((it) => (
            <a key={it.href + it.label} href={resolveHref(it.href, pathname)} onClick={go(it.href)}>
              <span className="mi">{it.num}</span>
              <span className="ml">
                <span data-text={it.label}>{it.label}</span>
              </span>
              <span className="ma" aria-hidden="true">
                ↘
              </span>
            </a>
          ))}
        </nav>
        <aside className="menu-side">
          <div className="ms-block">
            <p className="eyebrow">Say hello</p>
            <a className="ms-mail" href={`mailto:${email}`}>
              {email}
            </a>
          </div>
          <div className="ms-block">
            <p className="eyebrow">Elsewhere</p>
            <div className="ms-links">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  {...(l.download ? { download: true } : { target: "_blank", rel: "noreferrer" })}
                >
                  <ArrowLabel label={l.label} />
                </a>
              ))}
            </div>
          </div>
          <div className="ms-block ms-row">
            <div>
              <p className="eyebrow">{city}</p>
              <p className="ms-v">
                <LiveClock timeZone={timeZone} />
              </p>
            </div>
            {status ? (
              <span className="status">
                <span className="dot" aria-hidden="true" />
                <span className="status-v">{status}</span>
              </span>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function OverlayMenu(props: MenuProps) {
  return <OverlayMenuView {...props} pathname={usePathname()} />;
}
