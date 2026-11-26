"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { getLenis } from "@/lib/lenis";
import { throttle } from "@/lib/pacer";

/** Fixed header: glass after 40px, hides on scroll down past 400px, shows on scroll up. */
export function HeaderShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastY = window.scrollY;
    const update = (y: number) => {
      el.classList.toggle("is-scrolled", y > 40);
      el.classList.toggle(
        "is-hidden",
        y > lastY && y > 400 && !document.documentElement.classList.contains("menu-open"),
      );
      lastY = y;
    };
    const onScroll = throttle(() => update(getLenis()?.scroll ?? window.scrollY), {
      wait: 32,
      trailing: true,
    });
    update(lastY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header ref={ref} className="header gutter" data-header>
      {children}
    </header>
  );
}
