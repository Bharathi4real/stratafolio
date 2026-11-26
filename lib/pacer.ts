"use client";
/** TanStack Pacer (pre-1.0) behind one file. `throttle` is native so public pages skip the library. */
export { useDebouncedCallback, useThrottledCallback } from "@tanstack/react-pacer";

export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  { wait, trailing = true }: { wait: number; trailing?: boolean },
) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: A | null = null;
  return (...args: A) => {
    const now = Date.now();
    const left = wait - (now - last);
    if (left <= 0) {
      clearTimeout(timer);
      timer = undefined;
      last = now;
      fn(...args);
    } else if (trailing) {
      pending = args;
      timer ??= setTimeout(() => {
        timer = undefined;
        last = Date.now();
        if (pending) fn(...pending);
        pending = null;
      }, left);
    }
  };
}
