"use client";

import { Store, useSelector } from "@tanstack/react-store";

/** Small cross-component UI state (TanStack Store, pre-1.0: keep usage behind this file). */
export type Theme = "dark" | "light";
export type ConsentChoice = { version: number; analytics: boolean; timestamp: number };

type UIState = {
  theme: Theme;
  menuOpen: boolean;
  consentOpen: boolean;
  consent: ConsentChoice | null;
  reducedMotion: boolean;
};

export const uiStore = new Store<UIState>({
  theme: "dark",
  menuOpen: false,
  consentOpen: false,
  consent: null,
  reducedMotion: false,
});

export const setUI = (patch: Partial<UIState>) => uiStore.setState((s) => ({ ...s, ...patch }));
export const useUI = <T>(select: (s: UIState) => T) => useSelector(uiStore, select);

export const storage = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};
