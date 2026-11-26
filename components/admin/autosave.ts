"use client";

import { useEffect, useRef } from "react";
import { adminStore, refreshPreview, setAdmin } from "@/lib/admin/store";
import { useDebouncedCallback } from "@/lib/pacer";

type Result = { ok: true; data?: { draft?: boolean } } | { ok: false; error: string };
type Subscribable<T> = {
  store: {
    subscribe: (fn: () => void) => { unsubscribe: () => void } | (() => void);
    state: { values: T };
  };
};

/**
 * Debounced autosave (TanStack Pacer): every change is saved as a draft ~0.9s after typing
 * stops, then the live-preview iframe refreshes. Visitors keep seeing the published version.
 */
export function useAutosave<T>(
  form: Subscribable<T>,
  save: (values: T) => Promise<Result>,
  opts: {
    anchor?: () => string | undefined;
    enabled?: boolean;
    /** Called after each save with whether the document now has unpublished changes. */
    onSaved?: (draft: boolean | undefined) => void;
  } = {},
) {
  const last = useRef<string>(JSON.stringify(form.store.state.values));
  const saving = useRef<Promise<unknown> | null>(null);
  const stopped = useRef(false);

  const run = async () => {
    if (stopped.current) return;
    const values = form.store.state.values;
    const json = JSON.stringify(values);
    if (json === last.current) {
      // Edits were undone before they were saved: nothing is pending any more.
      if (adminStore.state.save === "dirty") setAdmin({ save: "saved" });
      return;
    }
    setAdmin({ save: "saving" });
    const p = save(values);
    saving.current = p;
    const res = await p;
    saving.current = null;
    if (res.ok) {
      last.current = json;
      setAdmin({ save: "saved", saveError: undefined, savedAt: Date.now() });
      opts.onSaved?.(res.data?.draft);
      refreshPreview(opts.anchor?.());
    } else setAdmin({ save: "error", saveError: res.error });
  };

  const debounced = useDebouncedCallback(() => void run(), { wait: 900 });

  useEffect(() => {
    if (opts.enabled === false) return;
    const sub = form.store.subscribe(() => {
      if (stopped.current) return;
      if (JSON.stringify(form.store.state.values) !== last.current) {
        setAdmin({ save: "dirty" });
        debounced();
      } else if (adminStore.state.save === "dirty") {
        // Typed and then undone before autosave ran: back to what's saved.
        setAdmin({ save: "saved" });
      }
    });
    return () => {
      if (typeof sub === "function") sub();
      else sub.unsubscribe();
    };
  }, [form, debounced, opts.enabled]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(form.store.state.values) !== last.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [form]);

  return {
    /** Save now (used before publishing). */
    flush: async () => {
      if (saving.current) await saving.current;
      await run();
    },
    markClean: () => {
      last.current = JSON.stringify(form.store.state.values);
    },
    /** Stop saving for good (the document is being deleted). Waits for an in-flight save. */
    stop: async () => {
      stopped.current = true;
      last.current = JSON.stringify(form.store.state.values);
      if (saving.current) await saving.current;
      setAdmin({ save: "idle" });
    },
  };
}
