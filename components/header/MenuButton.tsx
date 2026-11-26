"use client";

import { track } from "@/lib/analytics";
import { setUI, useUI } from "@/lib/ui-store";

export function MenuButton() {
  const open = useUI((s) => s.menuOpen);
  return (
    <button
      className="menu-btn"
      type="button"
      aria-expanded={open}
      aria-controls="menu"
      aria-label={open ? "Close menu" : "Menu"}
      data-menu-btn
      onClick={() => {
        setUI({ menuOpen: !open });
        if (!open) track("menu_open");
      }}
    >
      <span />
      <span />
    </button>
  );
}
