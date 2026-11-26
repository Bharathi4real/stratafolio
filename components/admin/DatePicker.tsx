"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Themed date picker (replaces the browser's native calendar, which can't be styled).
 *
 * Modes and stored values:
 *   date      "YYYY-MM-DD"
 *   month     "YYYY-MM-01"            (experience start/end)
 *   datetime  ISO instant, e.g. "2026-10-12T03:30:00.000Z" (picked in the viewer's local time)
 *
 * Keyboard: arrows move by day/week, PageUp/PageDown by month, Home/End to week edges,
 * Enter picks, Esc closes. Portalled with fixed positioning like Select, so cards never clip it.
 */
type Mode = "date" | "month" | "datetime";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (a: Date, b: Date) => ymd(a) === ymd(b);

/** Parse a stored value into a local Date (date-only strings are local midnight, not UTC). */
function parse(v: string | null | undefined, mode: Mode): Date | null {
  if (!v) return null;
  if (mode !== "datetime" || /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const m = v.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 1);
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function serialize(d: Date, mode: Mode) {
  if (mode === "month") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  if (mode === "date") return ymd(d);
  return d.toISOString();
}

/** Now, rounded up to the next 5 minutes. */
const roundedNow = () => new Date(Math.ceil(Date.now() / 300_000) * 300_000);

/** 0–23 → 1–12. */
const hour12 = (h: number) => h % 12 || 12;
/** 1–12 + AM/PM → 0–23. */
const to24 = (h: number, pm: boolean) => (h % 12) + (pm ? 12 : 0);
const clock = (d: Date) =>
  `${hour12(d.getHours())}:${pad(d.getMinutes())} ${d.getHours() < 12 ? "AM" : "PM"}`;

/** "GMT+5:30" style label for the viewer's timezone. */
export function localTzLabel() {
  return (
    new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? ""
  );
}

export function formatPicked(v: string | null | undefined, mode: Mode = "date") {
  const d = parse(v, mode);
  if (!d) return "";
  if (mode === "month") return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  const day = `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
  return mode === "datetime" ? `${day} · ${clock(d)}` : day;
}

export function DatePicker({
  value,
  onChange,
  onBlur,
  mode = "date",
  id,
  label,
  placeholder,
  min,
  max,
  clearable = true,
  inline = false,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  onBlur?: () => void;
  mode?: Mode;
  id?: string;
  label?: string;
  placeholder?: string;
  /** "YYYY-MM-DD" bounds (inclusive). */
  min?: string;
  max?: string;
  clearable?: boolean;
  /** Render the calendar in place (no trigger, no popover, no footer), e.g. inside a dialog. */
  inline?: boolean;
}) {
  const auto = useId();
  const btnId = id ?? auto;
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const picked = parse(value, mode);
  const [openState, setOpen] = useState(false);
  const open = inline || openState;
  const [view, setView] = useState(() => picked ?? new Date());
  const [focus, setFocus] = useState(() => picked ?? new Date());
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);

  const minD = min ? parse(min, "date") : null;
  const maxD = max ? parse(max, "date") : null;
  const outOfRange = (d: Date) =>
    Boolean((minD && ymd(d) < ymd(minD)) || (maxD && ymd(d) > ymd(maxD)));

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const h = mode === "datetime" ? 390 : 330;
    const up = window.innerHeight - r.bottom < h + 12 && r.top > h + 12;
    const left = Math.min(r.left, window.innerWidth - 284);
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: Math.max(8, left), up });
  }, [mode]);

  const show = () => {
    const start = picked ?? new Date();
    setView(start);
    setFocus(start);
    place();
    setOpen(true);
  };
  const close = (refocus = true) => {
    if (inline) return;
    setOpen(false);
    onBlur?.();
    if (refocus) btn.current?.focus();
  };

  const pick = (d: Date, keepOpen = false) => {
    if (outOfRange(d)) return;
    const next = new Date(d);
    if (mode === "datetime") {
      // Keep the chosen time when changing the day (the current time for a fresh pick).
      const t = picked ?? roundedNow();
      next.setHours(t.getHours(), t.getMinutes(), 0, 0);
    }
    onChange(serialize(next, mode));
    if (!keepOpen && mode !== "datetime") close();
  };

  const setTime = (h: number, m: number) => {
    const base = picked ?? roundedNow();
    const next = new Date(base);
    next.setHours(h, m, 0, 0);
    onChange(serialize(next, mode));
  };

  // Focus the active day (or month) when opening / moving.
  const moved = useRef(false);
  useLayoutEffect(() => {
    if (!open || (inline && !moved.current)) return;
    const key = mode === "month" ? `${focus.getFullYear()}-${focus.getMonth()}` : ymd(focus);
    pop.current?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus({ preventScroll: true });
  }, [open, focus, mode, inline]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close is stable for this purpose
  useEffect(() => {
    if (!open || inline) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      // The time Selects portal their own lists to <body>; clicks there aren't "outside".
      if ((t as HTMLElement).closest?.(".sel-pop")) return;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) close(false);
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
  }, [open, place, inline]);

  const move = (days: number, months = 0) => {
    moved.current = true;
    const d = new Date(focus);
    if (months) d.setMonth(d.getMonth() + months);
    if (days) d.setDate(d.getDate() + days);
    setFocus(d);
    if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) setView(d);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest(".dp-time")) return;
    if (e.key === "Escape") return close();
    if (mode === "month") {
      if (e.key === "ArrowLeft") move(0, -1);
      else if (e.key === "ArrowRight") move(0, 1);
      else if (e.key === "ArrowUp") move(0, -3);
      else if (e.key === "ArrowDown") move(0, 3);
      else if (e.key === "Enter" || e.key === " ") pick(focus);
      else return;
    } else {
      if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowUp") move(-7);
      else if (e.key === "ArrowDown") move(7);
      else if (e.key === "PageUp") move(0, -1);
      else if (e.key === "PageDown") move(0, 1);
      else if (e.key === "Home") move(-((focus.getDay() + 6) % 7));
      else if (e.key === "End") move(6 - ((focus.getDay() + 6) % 7));
      else if (e.key === "Enter" || e.key === " ") pick(focus);
      else return;
    }
    e.preventDefault();
  };

  // Month grid, weeks starting Monday, always 6 rows so the popover never jumps in height.
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const cells = Array.from(
    { length: 42 },
    (_, i) => new Date(view.getFullYear(), view.getMonth(), 1 - lead + i),
  );
  const today = new Date();
  const timeOf = picked ?? roundedNow();
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Date + time is shown in the browser's timezone, which the server doesn't know: render the
  // label after mount so server HTML and hydration match.
  const [ready, setReady] = useState(mode !== "datetime");
  useEffect(() => setReady(true), []);
  const shown = ready ? formatPicked(value, mode) : "";
  const step = (n: number) =>
    setView((v) =>
      mode === "month"
        ? new Date(v.getFullYear() + n, v.getMonth(), 1)
        : new Date(v.getFullYear(), v.getMonth() + n, 1),
    );

  const panel = (
    <>
      <div className="dp-head">
        <b>
          {mode === "month"
            ? view.getFullYear()
            : `${MONTHS[view.getMonth()]} ${view.getFullYear()}`}
        </b>
        <span className="dp-nav">
          <button
            type="button"
            className="icon-btn"
            aria-label={mode === "month" ? "Previous year" : "Previous month"}
            onClick={() => step(-1)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={mode === "month" ? "Next year" : "Next month"}
            onClick={() => step(1)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </span>
      </div>

      {mode === "month" ? (
        <div className="dp-months">
          {MONTHS.map((m, i) => {
            const d = new Date(view.getFullYear(), i, 1);
            const key = `${d.getFullYear()}-${i}`;
            const sel =
              picked && picked.getFullYear() === d.getFullYear() && picked.getMonth() === i;
            const now = today.getFullYear() === d.getFullYear() && today.getMonth() === i;
            return (
              <button
                key={m}
                type="button"
                data-key={key}
                tabIndex={
                  focus.getFullYear() === d.getFullYear() && focus.getMonth() === i ? 0 : -1
                }
                className={`dp-cell${sel ? " is-selected" : ""}${now ? " is-today" : ""}`}
                aria-pressed={Boolean(sel)}
                onClick={() => pick(d)}
              >
                {m.slice(0, 3)}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="dp-grid">
          {DAYS.map((d) => (
            <span key={d} className="dp-dow" aria-hidden="true">
              {d}
            </span>
          ))}
          {cells.map((d) => {
            const other = d.getMonth() !== view.getMonth();
            const sel = picked && sameDay(d, picked);
            const off = outOfRange(d);
            return (
              <button
                key={ymd(d)}
                type="button"
                data-key={ymd(d)}
                tabIndex={sameDay(d, focus) ? 0 : -1}
                disabled={off}
                className={`dp-cell${other ? " is-other" : ""}${sel ? " is-selected" : ""}${sameDay(d, today) ? " is-today" : ""}`}
                aria-pressed={Boolean(sel)}
                aria-label={d.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                onClick={() => {
                  setFocus(d);
                  pick(d, true);
                  if (mode !== "datetime") close();
                }}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      )}

      {mode === "datetime" ? (
        <TimeField value={timeOf} tzName={tzName} onChange={(h, m) => setTime(h, m)} />
      ) : null}
    </>
  );

  return (
    <>
      {inline ? null : (
        <button
          ref={btn}
          id={btnId}
          type="button"
          className={`sel dp-btn${open ? " is-open" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label ? `${label}${shown ? `: ${shown}` : ""}` : undefined}
          onClick={() => (open ? close() : show())}
        >
          <span className={shown ? "sel-value" : "sel-value is-placeholder"}>
            {shown ||
              placeholder ||
              (mode === "month"
                ? "Pick a month"
                : mode === "datetime"
                  ? "Pick a date & time"
                  : "Pick a date")}
          </span>
          <svg
            className="sel-chev"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M3.5 10h17M8 3v4M16 3v4" />
          </svg>
        </button>
      )}
      {inline ? (
        <div
          ref={pop}
          role="application"
          aria-label={label ?? "Calendar"}
          className="dp-pop is-inline"
          onKeyDown={onKey}
        >
          {panel}
        </div>
      ) : open && pos ? (
        createPortal(
          <div
            ref={pop}
            role="dialog"
            aria-label={label ?? "Choose a date"}
            className={`dp-pop${pos.up ? " is-up" : ""}`}
            style={{
              top: pos.top,
              left: pos.left,
              transform: pos.up ? "translateY(-100%)" : undefined,
            }}
            onKeyDown={onKey}
          >
            {panel}
            <div className="dp-foot">
              {clearable ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    onChange(null);
                    close();
                  }}
                  disabled={!value}
                >
                  Clear
                </button>
              ) : (
                <span />
              )}
              <span className="dp-foot-r">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    const t = new Date();
                    setView(t);
                    setFocus(t);
                    if (mode === "datetime") {
                      onChange(serialize(roundedNow(), mode));
                    } else pick(t);
                  }}
                >
                  {mode === "month" ? "This month" : mode === "datetime" ? "Now" : "Today"}
                </button>
                {mode === "datetime" ? (
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => close()}>
                    Done
                  </button>
                ) : null}
              </span>
            </div>
          </div>,
          document.body,
        )
      ) : null}
    </>
  );
}

/** Typed 12-hour time: hh : mm + AM/PM. Commits on blur or Enter; arrows step the value. */
function TimeField({
  value,
  tzName,
  onChange,
}: {
  value: Date;
  tzName: string;
  onChange: (h24: number, m: number) => void;
}) {
  const h = hour12(value.getHours());
  const m = value.getMinutes();
  const pm = value.getHours() >= 12;
  const [hh, setHh] = useState(String(h));
  const [mm, setMm] = useState(pad(m));
  useEffect(() => setHh(String(h)), [h]);
  useEffect(() => setMm(pad(m)), [m]);

  const commit = (nh: number, nm: number, npm = pm) => {
    const H = Math.min(12, Math.max(1, Number.isFinite(nh) ? nh : h));
    const M = Math.min(59, Math.max(0, Number.isFinite(nm) ? nm : m));
    setHh(String(H));
    setMm(pad(M));
    onChange(to24(H, npm), M);
  };
  const keys = (e: React.KeyboardEvent<HTMLInputElement>, which: "h" | "m") => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(Number(hh), Number(mm));
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const d = e.key === "ArrowUp" ? 1 : -1;
      if (which === "h") commit(((h - 1 + d + 12) % 12) + 1, m);
      else commit(h, (m + d * 5 + 60) % 60);
    }
  };

  return (
    <div className="dp-time" title={`Times are in your timezone (${tzName})`}>
      <input
        className="dp-num"
        inputMode="numeric"
        aria-label="Hour"
        maxLength={2}
        value={hh}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setHh(e.target.value.replace(/\D/g, ""))}
        onBlur={() => commit(Number(hh), Number(mm))}
        onKeyDown={(e) => keys(e, "h")}
      />
      <span aria-hidden="true">:</span>
      <input
        className="dp-num"
        inputMode="numeric"
        aria-label="Minute"
        maxLength={2}
        value={mm}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setMm(e.target.value.replace(/\D/g, ""))}
        onBlur={() => commit(Number(hh), Number(mm))}
        onKeyDown={(e) => keys(e, "m")}
      />
      <fieldset className="dp-ampm">
        <legend className="sr-only">AM or PM</legend>
        {(["AM", "PM"] as const).map((x) => (
          <button
            key={x}
            type="button"
            aria-pressed={(x === "PM") === pm}
            onClick={() => commit(Number(hh), Number(mm), x === "PM")}
          >
            {x}
          </button>
        ))}
      </fieldset>
    </div>
  );
}
