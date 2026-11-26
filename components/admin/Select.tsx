"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SelectOption<T extends string = string> = { value: T; label: string; hint?: string };

/**
 * Admin select: a button + listbox popover (replaces the native <select>, whose popup can't be
 * styled). Keyboard: ↑/↓, Home/End, Enter/Space to choose, Esc to close, type to jump.
 * The popover is portalled to <body> with fixed positioning, so cards, tables and modals with
 * overflow:hidden never clip it; it flips above the button when there's no room below.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  onBlur,
  id,
  label,
  size = "md",
  placeholder = "Choose…",
  disabled,
  className = "",
}: {
  value: T | null | undefined;
  options: readonly SelectOption<T>[];
  onChange: (v: T) => void;
  onBlur?: () => void;
  id?: string;
  /** Accessible name when there's no visible <label htmlFor>. */
  label?: string;
  size?: "sm" | "md";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const auto = useId();
  const btnId = id ?? auto;
  const listId = `${btnId}-list`;
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(
    null,
  );
  const typed = useRef({ text: "", at: 0 });
  const current = options.find((o) => o.value === value);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const want = Math.min(320, options.length * 44 + 12);
    const up = window.innerHeight - r.bottom < want + 12 && r.top > want + 12;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: r.left, width: r.width, up });
  }, [options.length]);

  const show = () => {
    if (disabled) return;
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    place();
    setOpen(true);
  };
  const close = (focus = true) => {
    setOpen(false);
    if (focus) btn.current?.focus();
  };
  const choose = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    close();
  };

  useLayoutEffect(() => {
    if (!open) return;
    list.current?.focus({ preventScroll: true });
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({
      block: "nearest",
    });
  }, [open, active]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close is stable for this purpose
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !btn.current?.contains(t)) close(false);
    };
    const onMove = () => place();
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  const onListKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === "ArrowDown") setActive((a) => Math.min(last, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") close(false);
    else if (e.key.length === 1) {
      const now = Date.now();
      typed.current.text = (now - typed.current.at < 700 ? typed.current.text : "") + e.key;
      typed.current.at = now;
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) setActive(i);
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <>
      <button
        ref={btn}
        id={btnId}
        type="button"
        className={`sel sel-${size}${open ? " is-open" : ""} ${className}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onBlur={() => !open && onBlur?.()}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            show();
          }
        }}
      >
        <span className={current ? "sel-value" : "sel-value is-placeholder"}>
          {current?.label ?? placeholder}
        </span>
        <svg
          className="sel-chev"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={list}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-labelledby={btnId}
              aria-activedescendant={`${listId}-${active}`}
              className={`sel-pop${pos.up ? " is-up" : ""}`}
              style={{
                top: pos.top,
                left: pos.left,
                minWidth: pos.width,
                transform: pos.up ? "translateY(-100%)" : undefined,
              }}
              onKeyDown={onListKey}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setOpen(false);
                  onBlur?.();
                }
              }}
            >
              {options.map((o, i) => (
                <div
                  key={o.value}
                  id={`${listId}-${i}`}
                  data-i={i}
                  role="option"
                  tabIndex={-1}
                  aria-selected={o.value === value}
                  className={i === active ? "is-active" : undefined}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                  onKeyDown={() => undefined}
                >
                  <span className="sel-opt">
                    <b>{o.label}</b>
                    {o.hint ? <small>{o.hint}</small> : null}
                  </span>
                  {o.value === value ? (
                    <svg
                      className="sel-check"
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  ) : null}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
