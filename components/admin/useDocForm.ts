"use client";

import { useState } from "react";
import {
  cancelNewEntryAction,
  discardEntryDraftAction,
  discardGlobal,
  globalDefaults,
  publishEntryAction,
  publishGlobal,
  saveEntry,
  saveGlobal,
} from "@/lib/admin/actions";
import type { GlobalKey } from "@/lib/content/schema";
import { useAutosave } from "./autosave";

/**
 * Server Actions only accept plain objects. Tiptap JSON can contain null-prototype attr objects,
 * which React would pass as opaque references, so values are JSON round-tripped first.
 */
export const plainJson = <T>(v: T): T => JSON.parse(JSON.stringify(v));

import { useAppForm } from "./form";

/** Form + autosave + publish wiring for a global (settings, home, toolkit…). */
export function useGlobalForm<T extends object>(
  key: GlobalKey,
  initial: T,
  anchor?: () => string | undefined,
) {
  const form = useAppForm({ defaultValues: initial });
  // Whether the server holds unpublished changes (null = as loaded with the page).
  const [draft, setDraft] = useState<boolean | null>(null);
  const auto = useAutosave(form, (v) => saveGlobal(key, plainJson(v)), {
    anchor,
    onSaved: (d) => d !== undefined && setDraft(d),
  });
  return {
    form,
    draft,
    flush: auto.flush,
    publish: async () => {
      const r = await publishGlobal(key, plainJson(form.state.values));
      if (r.ok) {
        auto.markClean();
        setDraft(false);
      }
      return r;
    },
    discard: async () => {
      await auto.flush();
      return discardGlobal(key);
    },
    /** Loads the starter content into the form; autosave turns it into a draft. */
    resetToDefault: async () => {
      const r = await globalDefaults(key);
      if (!r.ok) return r;
      // Field names come from the schema itself, so the casts are safe.
      const set = form.setFieldValue.bind(form) as (name: string, value: unknown) => void;
      for (const [k, v] of Object.entries(r.data as Record<string, unknown>)) set(k, v);
      await auto.flush();
      return { ok: true as const };
    },
    versionsRef: `global:${key}`,
    restore: (data: unknown, isDraft = true) => {
      form.reset(data as T);
      auto.markClean();
      setDraft(isDraft);
    },
  };
}

/** Same for a collection document. */
export function useEntryForm<T extends object>(id: number, initial: T) {
  const form = useAppForm({ defaultValues: initial });
  const [draft, setDraft] = useState<boolean | null>(null);
  const auto = useAutosave(form, (v) => saveEntry(id, plainJson(v)), {
    onSaved: (d) => d !== undefined && setDraft(d),
  });
  return {
    form,
    draft,
    flush: auto.flush,
    publish: async () => {
      const r = await publishEntryAction(id, plainJson(form.state.values));
      if (r.ok) {
        auto.markClean();
        setDraft(false);
      }
      return r;
    },
    discard: async () => {
      await auto.flush();
      return discardEntryDraftAction(id);
    },
    versionsRef: `entry:${id}`,
    restore: (data: unknown, isDraft = true) => {
      form.reset(data as T);
      auto.markClean();
      setDraft(isDraft);
    },
    /** Never-published entries only: delete it instead of leaving a draft behind. */
    cancel: async () => {
      await auto.stop();
      return cancelNewEntryAction(id);
    },
  };
}
