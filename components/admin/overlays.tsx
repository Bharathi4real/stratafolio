"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  closeDialog,
  dismissToast,
  loadToastPos,
  type ToastItem,
  type ToastTone,
  useAdmin,
} from "@/lib/admin/store";

const ICON: Record<ToastTone, string> = {
  ok: "M5 12.5l4.5 4.5L19 7.5",
  error:
    "M12 8v5m0 3.5v.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  warn: "M12 8v5m0 3.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  info: "M12 11v6m0-9.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
};

const TONE_ICON: Record<ToastTone, string> = {
  ok: "m5 12.5 4.5 4.5L19 7.5",
  error: "M12 7v6M12 17h.01",
  warn: "M12 8v5M12 16.5h.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  info: "M12 11v6M12 7.5h.01",
};

const KICKER: Record<ToastTone, string> = {
  ok: "Done",
  error: "Error",
  info: "Note",
  warn: "Heads up",
};

/** Toast stack, bottom-right. Each toast pauses its timer while hovered or focused. */
export function Toaster() {
  const toasts = useAdmin((s) => s.toasts);
  const pos = useAdmin((s) => s.toastPos);
  useEffect(() => loadToastPos(), []);
  // Newest toast sits closest to the screen edge it comes from.
  const list = pos.startsWith("top") ? [...toasts].reverse() : toasts;
  return (
    <section className={`toaster pos-${pos}`} aria-label="Notifications">
      <ol>
        {list.map((t) => (
          <Toast key={t.id} t={t} />
        ))}
      </ol>
    </section>
  );
}

function Toast({ t }: { t: ToastItem }) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const left = useRef(t.duration);
  const startedAt = useRef(Date.now());

  const close = () => {
    setLeaving(true);
    setTimeout(() => dismissToast(t.id), 260);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: timer restarts on pause/resume only
  useEffect(() => {
    if (!t.duration) return;
    if (paused) {
      left.current -= Date.now() - startedAt.current;
      return;
    }
    startedAt.current = Date.now();
    const timer = setTimeout(close, Math.max(400, left.current));
    return () => clearTimeout(timer);
  }, [paused]);

  return (
    <li
      className={`toast-item is-${t.tone}${leaving ? " is-leaving" : ""}${paused ? " is-paused" : ""}`}
      role={t.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{ "--dur": `${t.duration}ms` } as React.CSSProperties}
    >
      <span className="ti-icon" aria-hidden="true">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={TONE_ICON[t.tone]} />
        </svg>
      </span>
      <div className="ti-body">
        <span className="sr-only">{KICKER[t.tone]}: </span>
        {/* A short toast is just its message; a titled one gets a heading + detail line. */}
        <b>{t.title ?? t.text}</b>
        {t.title ? <p>{t.text}</p> : null}
      </div>
      {t.action ? (
        <button
          type="button"
          className="btn btn-sm ti-action"
          onClick={() => {
            t.action?.run();
            close();
          }}
        >
          {t.action.label}
        </button>
      ) : null}
      <button type="button" className="ti-close" aria-label="Dismiss" onClick={close}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      {t.duration ? <span className="ti-timer" aria-hidden="true" /> : null}
    </li>
  );
}

/** The confirm dialog behind `confirmDialog()` (one at a time, focus-trapped native <dialog>). */
export function ConfirmHost() {
  const d = useAdmin((s) => s.dialog);
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (d && !el.open) {
      setTyped("");
      setBusy(false);
      setError(null);
      el.showModal();
      // Safe default: focus Cancel for destructive actions, the main button otherwise.
      requestAnimationFrame(() =>
        el
          .querySelector<HTMLElement>(
            d.typeToConfirm ? "input" : d.tone === "danger" ? "[data-cancel]" : "[data-ok]",
          )
          ?.focus(),
      );
    }
    if (!d && el.open) el.close();
  }, [d]);

  const blocked = Boolean(d?.typeToConfirm && typed !== d.typeToConfirm) || busy;
  const cancel = () => {
    if (!busy) closeDialog(false);
  };
  const run = async () => {
    if (!d || blocked) return;
    if (!d.action) return closeDialog(true);
    setBusy(true);
    setError(null);
    try {
      await d.action();
      closeDialog(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn’t work. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click; Esc is handled by onCancel
    <dialog
      ref={ref}
      className={`modal confirm${d?.tone === "danger" ? " is-danger" : ""}`}
      aria-labelledby={titleId}
      aria-describedby={d?.body ? bodyId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) cancel(); // backdrop click
      }}
      aria-busy={busy}
    >
      {d ? (
        <form
          method="dialog"
          className="confirm-b"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <span className="confirm-ic" aria-hidden="true">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={d.tone === "danger" ? ICON.error : ICON.info} />
            </svg>
          </span>
          <div>
            <h3 id={titleId}>{d.title}</h3>
            {d.body ? <p id={bodyId}>{d.body}</p> : null}
            {d.details?.length ? (
              <ul className="confirm-details">
                {d.details.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : null}
            {error ? (
              <p className="confirm-error" role="alert">
                {error}
              </p>
            ) : null}
            {d.typeToConfirm ? (
              <label className="confirm-type">
                <span>
                  Type <code>{d.typeToConfirm}</code> to confirm
                </span>
                <input
                  className="inp"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            ) : null}
          </div>
          <div className="confirm-acts">
            <button
              type="button"
              className="btn btn-sm"
              data-cancel
              onClick={cancel}
              disabled={busy}
            >
              {d.cancelLabel}
            </button>
            <button
              type="submit"
              className={`btn btn-sm ${d.tone === "danger" ? "btn-danger" : "btn-primary"}`}
              data-ok
              disabled={blocked}
              aria-busy={busy}
            >
              {busy ? (
                <>
                  <Spinner /> {d.busyLabel ?? "Working…"}
                </>
              ) : error ? (
                "Try again"
              ) : (
                d.confirmLabel
              )}
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}

export function Spinner() {
  return <span className="spin" aria-hidden="true" />;
}
