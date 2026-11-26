"use client";
import { useEffect, useRef } from "react";

/** TanStack Hotkeys (alpha) behind one file. Every shortcut also has a visible control. */
export { useHotkey } from "@tanstack/react-hotkeys";

/** Native Escape listener for public pages, so they don't ship the hotkeys library. */
export function useEscape(handler: () => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) ref.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
