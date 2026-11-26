"use client";

import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

export type LaunchState = "idle" | "sending" | "sent";

/**
 * The contact form's submit button: one click (or Enter) sends. Shows a spinner while sending and
 * a check once sent. Bump `bounce` when a submit is refused (invalid fields) for a small shake.
 */
export function SendButton({
  state,
  labels,
  bounce = 0,
}: {
  state: LaunchState;
  labels: { idle: string; sending: string; sent: string };
  bounce?: number;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!bounce || !el || prefersReducedMotion()) return;
    const tw = gsap.fromTo(
      el,
      { x: 0 },
      { keyframes: { x: [0, 7, -5, 3, 0] }, duration: 0.4, ease: "power1.out", clearProps: "x" },
    );
    return () => {
      tw.kill();
    };
  }, [bounce]);

  return (
    <button
      ref={ref}
      className="send-btn"
      type="submit"
      data-state={state}
      disabled={state !== "idle"}
      aria-live="polite"
    >
      <span className="send-label">{labels[state]}</span>
      <span className="send-icon" aria-hidden="true">
        <svg
          aria-hidden="true"
          className="si-arrow"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        <svg
          aria-hidden="true"
          className="si-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M12 3a9 9 0 1 1-9 9" />
        </svg>
        <svg
          aria-hidden="true"
          className="si-check"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    </button>
  );
}
