"use client";

/**
 * The reader's English (US or British/Indian spelling), for the app's own text: en("Choose a colour") reads
 * "Choose a color" for a US reader. Who gets which:
 * 1. their own choice (the English picker; a cookie, so every page and the API answer in it);
 * 2. on a school's public pages (its forms and reports), the school's English, set with <EnglishScope>;
 * 3. for school staff, their school's English (remembered from their last visit to the school's pages);
 * 4. where they are: their time zone (America/... reads US English), else their browser's English with a region;
 * 5. British/Indian English, as the text is written.
 * The server renders the text as written, and the browser switches after loading.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { inEnglish, type English } from "./index";
import { CHOICE_COOKIE, EVENT, SCHOOL_KEY, browserEnglish, readChoice } from "./browser";

const subscribe = (fn: () => void) => {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
};

interface EnglishContext {
  english: English;
  /** The reader's own choice, if they made one */
  choice: English | null;
  /** The app's own text in the reader's English */
  en: (text: string) => string;
  /** Saves the reader's choice (null: back to automatic) */
  choose: (e: English | null) => void;
}

const Ctx = createContext<EnglishContext>({ english: "GB", choice: null, en: (t) => t, choose: () => undefined });

export function EnglishProvider({ children }: { children: React.ReactNode }) {
  const english = useSyncExternalStore(subscribe, browserEnglish, () => "GB" as English);
  const choice = useSyncExternalStore(subscribe, readChoice, () => null);
  const choose = useCallback((e: English | null) => {
    document.cookie = e ? `${CHOICE_COOKIE}=${e}; path=/; max-age=31536000; samesite=lax` : `${CHOICE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const value = useMemo(() => ({ english, choice, en: (t: string) => inEnglish(english, t), choose }), [english, choice, choose]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * A school's own English around its public pages (forms, reports): the school decides, unless the reader chose one.
 * Inside an institute's staff pages, pass remember to keep it for their next visit.
 */
export function EnglishScope({ english, remember = false, children }: { english: English | null | undefined; remember?: boolean; children: React.ReactNode }) {
  const outer = useContext(Ctx);
  useEffect(() => {
    if (!remember || !english) return;
    try {
      if (localStorage.getItem(SCHOOL_KEY) === english) return;
      localStorage.setItem(SCHOOL_KEY, english);
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // storage blocked: this visit only
    }
  }, [remember, english]);
  const scoped = outer.choice ?? english ?? outer.english;
  const value = useMemo(() => ({ ...outer, english: scoped, en: (t: string) => inEnglish(scoped, t) }), [outer, scoped]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useEnglish = () => useContext(Ctx);
/** en(text): the app's own text in the reader's English */
export const useEn = () => useContext(Ctx).en;
