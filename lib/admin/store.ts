"use client";

import { Store, useSelector } from "@tanstack/react-store";

/** Admin-wide UI state (TanStack Store): save indicator, toast, command palette, mobile nav. */
export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export type ToastTone = "ok" | "error" | "info" | "warn";
export type ToastItem = {
  id: number;
  text: string;
  tone: ToastTone;
  title?: string;
  action?: { label: string; run: () => void };
  /** ms before it closes itself; 0 = stays until dismissed. */
  duration: number;
};
export type DialogRequest = {
  id: number;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: "danger" | "default";
  /** When set, the confirm button stays disabled until this exact text is typed. */
  typeToConfirm?: string;
  /** Extra lines under the body (e.g. "Used in: …"). */
  details?: string[];
  /** Runs while the dialog stays open with a spinner; throw to show the error and keep it open. */
  action?: () => Promise<unknown>;
  busyLabel?: string;
  resolve: (ok: boolean) => void;
};

export type ToastPos =
  | "bottom-right"
  | "bottom-left"
  | "bottom-center"
  | "top-right"
  | "top-left"
  | "top-center";
export const TOAST_POSITIONS: ToastPos[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];
const TOAST_POS_KEY = "admin-toast-pos";

type AdminState = {
  toastPos: ToastPos;
  save: SaveState;
  saveError?: string;
  /** Bumped after every successful save, so "pending changes" counts refetch. */
  savedAt?: number;
  toasts: ToastItem[];
  dialog: DialogRequest | null;
  reviewOpen: boolean;
  paletteOpen: boolean;
  navOpen: boolean;
  pending: number;
};

export const adminStore = new Store<AdminState>({
  save: "idle",
  toastPos: "bottom-right",
  toasts: [],
  dialog: null,
  reviewOpen: false,
  paletteOpen: false,
  navOpen: false,
  pending: 0,
});

export const setAdmin = (patch: Partial<AdminState>) =>
  adminStore.setState((s) => ({ ...s, ...patch }));
export const useAdmin = <T>(select: (s: AdminState) => T) => useSelector(adminStore, select);

/** Per-device admin preference: where toasts appear. */
export function setToastPos(pos: ToastPos) {
  setAdmin({ toastPos: pos });
  try {
    localStorage.setItem(TOAST_POS_KEY, pos);
  } catch {
    /* private mode */
  }
}
export function loadToastPos() {
  try {
    const v = localStorage.getItem(TOAST_POS_KEY) as ToastPos | null;
    if (v && TOAST_POSITIONS.includes(v)) setAdmin({ toastPos: v });
  } catch {
    /* private mode */
  }
}

let seq = 0;
const MAX_TOASTS = 4;

/**
 * Show a toast. Stacks (newest at the bottom, max 4), pauses while hovered, errors stay longer.
 *   toast("Saved.")  ·  toast("Couldn't save", "error")
 *   toast("Post deleted", "ok", { action: { label: "Undo", run: restore } })
 */
export function toast(
  text: string,
  tone: ToastTone = "ok",
  opts: { title?: string; action?: ToastItem["action"]; duration?: number } = {},
) {
  const id = ++seq;
  const duration = opts.duration ?? (tone === "error" ? 7000 : opts.action ? 6000 : 3600);
  setAdmin({
    toasts: [...adminStore.state.toasts, { id, text, tone, duration, ...opts }].slice(-MAX_TOASTS),
  });
  return id;
}
/** A toast shown after the next page load (for actions that reload the page). */
export function flashToast(text: string) {
  try {
    sessionStorage.setItem("admin-flash", text);
  } catch {}
}
export function showFlashToast() {
  try {
    const t = sessionStorage.getItem("admin-flash");
    if (t) {
      sessionStorage.removeItem("admin-flash");
      toast(t);
    }
  } catch {}
}

toast.success = (text: string, opts?: Parameters<typeof toast>[2]) => toast(text, "ok", opts);
toast.error = (text: string, opts?: Parameters<typeof toast>[2]) => toast(text, "error", opts);
toast.info = (text: string, opts?: Parameters<typeof toast>[2]) => toast(text, "info", opts);
toast.warn = (text: string, opts?: Parameters<typeof toast>[2]) => toast(text, "warn", opts);
export const dismissToast = (id: number) =>
  setAdmin({ toasts: adminStore.state.toasts.filter((t) => t.id !== id) });

/**
 * Promise-based confirm dialog (replaces window.confirm):
 *   if (!(await confirmDialog({ title: "Delete post?", tone: "danger", confirmLabel: "Delete" }))) return;
 */
export function confirmDialog(opts: {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  typeToConfirm?: string;
  details?: string[];
  action?: () => Promise<unknown>;
  busyLabel?: string;
}): Promise<boolean> {
  adminStore.state.dialog?.resolve(false);
  return new Promise((resolve) =>
    setAdmin({
      dialog: {
        id: ++seq,
        title: opts.title,
        body: opts.body,
        confirmLabel: opts.confirmLabel ?? "Confirm",
        cancelLabel: opts.cancelLabel ?? "Cancel",
        tone: opts.tone ?? "default",
        typeToConfirm: opts.typeToConfirm,
        details: opts.details,
        action: opts.action,
        busyLabel: opts.busyLabel,
        resolve,
      },
    }),
  );
}
export function closeDialog(ok: boolean) {
  const d = adminStore.state.dialog;
  if (!d) return;
  setAdmin({ dialog: null });
  d.resolve(ok);
}

/** Tell the live-preview iframe (same origin) to refresh with the new draft. */
export function refreshPreview(anchor?: string) {
  for (const f of document.querySelectorAll<HTMLIFrameElement>("iframe[data-preview]")) {
    f.contentWindow?.postMessage({ type: "b4:refresh" }, location.origin);
    if (anchor) f.contentWindow?.postMessage({ type: "b4:scroll", anchor }, location.origin);
  }
}
