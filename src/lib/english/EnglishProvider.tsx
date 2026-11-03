"use client";

/**
 * The app's own text in the reader's language: en("Choose a colour") gives the text in their language (looked up by its
 * English wording in messages/app/<language>.json, plan item A2), or in their English (US or British/Indian spelling)
 * when they read English or a text isn't translated yet. Values go in braces: en("{n} meetings", { n: 3 }).
 *
 * The language comes from the server (root layout: the reader's choice, else their school's suggestion). The English:
 * 1. their own choice (the language picker; a cookie, so every page and the API answer in it);
 * 2. on a school's public pages (its forms and reports), the school's English, set with <EnglishScope>;
 * 3. for school staff, their school's English (remembered from their last visit to the school's pages);
 * 4. where they are: their time zone (America/... reads US English), else their browser's English with a region;
 * 5. British/Indian English, as the text is written.
 * The server renders British/Indian English unless the reader chose US English; the browser switches after loading.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { inEnglish, type English } from "./index";
import { CHOICE_COOKIE, EVENT, SCHOOL_KEY, browserEnglish, readChoice } from "./browser";
import { LANGUAGE_COOKIE, PREVIEW_COOKIE, PREVIEW_LANGUAGES, type AppLanguage } from "@/lib/i18n/languages";

const subscribe = (fn: () => void) => {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
};

export type TextValues = Record<string, string | number>;
type Translate = (text: string, values?: TextValues) => string;

interface TextContext {
  /** The reader's language (en, or a reviewed one) */
  language: AppLanguage;
  english: English;
  /** The reader's own choice of English, if they made one */
  choice: English | null;
  /** The app's own text in the reader's language */
  en: Translate;
  /** Saves the reader's choice of English (null: back to automatic) */
  choose: (e: English | null) => void;
  /** Saves the reader's language (null: back to their school's, else English) and shows the page in it */
  chooseLanguage: (language: AppLanguage | null) => void;
}

const fill = (text: string, values?: TextValues) => (values ? text.replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m)) : text);

function translator(language: AppLanguage, english: English, messages: Record<string, string> | null): Translate {
  return (text, values) => fill(language !== "en" && messages?.[text] ? messages[text] : inEnglish(english, text), values);
}

const Ctx = createContext<TextContext>({
  language: "en",
  english: "GB",
  choice: null,
  en: (t, v) => fill(t, v),
  choose: () => undefined,
  chooseLanguage: () => undefined,
});

const writeCookie = (name: string, value: string | null) => {
  document.cookie = value ? `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax` : `${name}=; path=/; max-age=0; samesite=lax`;
};

export function EnglishProvider({
  children,
  language = "en",
  messages = null,
}: {
  children: React.ReactNode;
  language?: AppLanguage;
  messages?: Record<string, string> | null;
}) {
  const router = useRouter();
  const english = useSyncExternalStore(subscribe, browserEnglish, () => "GB" as English);
  const choice = useSyncExternalStore(subscribe, readChoice, () => null);
  const choose = useCallback((e: English | null) => {
    writeCookie(CHOICE_COOKIE, e);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  const chooseLanguage = useCallback(
    (next: AppLanguage | null) => {
      writeCookie(LANGUAGE_COOKIE, next);
      router.refresh();
    },
    [router],
  );

  // A reviewer's preview link (?preview-language=hi): that language, for this browser, before it's live
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("preview-language")?.toLowerCase();
    if (!wanted || !PREVIEW_LANGUAGES.includes(wanted as AppLanguage)) return;
    writeCookie(PREVIEW_COOKIE, wanted === "en" ? null : wanted);
    writeCookie(LANGUAGE_COOKIE, wanted);
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({ language, english, choice, en: translator(language, english, messages), choose, chooseLanguage }),
    [language, english, choice, messages, choose, chooseLanguage],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * A school's own English around its public pages (forms, reports): the school decides, unless the reader chose one.
 * Inside an institute's staff pages, pass remember to keep it for their next visit.
 */
export function EnglishScope({ english, remember = false, children }: { english: English | null | undefined; remember?: boolean; children: React.ReactNode }) {
  const outer = useContext(Ctx);
  const messages = useContext(MessagesCtx);
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
  const value = useMemo(() => ({ ...outer, english: scoped, en: translator(outer.language, scoped, messages) }), [outer, scoped, messages]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// The language's texts, for scopes inside the provider
const MessagesCtx = createContext<Record<string, string> | null>(null);

/** The provider with its texts available to scopes (what the root layout uses) */
export function TextProvider(props: { children: React.ReactNode; language?: AppLanguage; messages?: Record<string, string> | null }) {
  return (
    <MessagesCtx.Provider value={props.messages ?? null}>
      <EnglishProvider {...props} />
    </MessagesCtx.Provider>
  );
}

export const useEnglish = () => useContext(Ctx);
/** en(text): the app's own text in the reader's language */
export const useEn = () => useContext(Ctx).en;
