"use client";

/**
 * Career-suite language (G1): provides the locale, its direction, the career messages (next-intl) and locale-aware
 * formatting to every career page. Rendered by CareerI18nRoot (server) so the first paint is already in the right
 * language and direction.
 *
 * Locale order: the user's own choice (cookie career_locale) → the API's answer for this user
 * (GET /api/career/locale: saved choice, else school default, else platform default) → English.
 * The language picker saves the choice to the API too (PUT /api/career/locale), so emails and other devices follow it.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NextIntlClientProvider, createTranslator, type AbstractIntlMessages } from "next-intl";
import { useApi, useAppAuth } from "@/lib/appAuth";
import {
  DEFAULT_CAREER_LOCALE,
  LOCALE_COOKIE,
  SCHOOL_LOCALE_COOKIE,
  availableCareerLocales,
  directionOf,
  isPseudoLocale,
  formatLocaleFor,
  matchCareerLocale,
} from "./config";
import { englishMessages, type CareerMessages } from "./messages";

interface CareerI18nState {
  locale: string;
  dir: "ltr" | "rtl";
  /** Locale for Intl formatting (e.g. "en-GB" for English in a British browser, "ar" for the RTL pseudo-locale). */
  formatLocale: string;
  messages: CareerMessages;
  /** The school's IANA time zone when known (from /api/career/locale). */
  schoolTimeZone: string | null;
  available: string[];
  /** Saves the user's choice (null = back to the school default) and re-renders in it. */
  setLocale: (locale: string | null) => void;
}

const fallback: CareerI18nState = {
  locale: DEFAULT_CAREER_LOCALE,
  dir: "ltr",
  formatLocale: formatLocaleFor(DEFAULT_CAREER_LOCALE),
  messages: englishMessages,
  schoolTimeZone: null,
  available: [DEFAULT_CAREER_LOCALE],
  setLocale: () => {},
};

// Career components rendered outside the provider (signed-link pages) still work, in English
const CareerI18nContext = createContext<CareerI18nState>(fallback);

/**
 * Formatting locale for plain functions such as formatDate() in ui.tsx: follows the career page's language, which the
 * provider writes to <html lang>. On the server it is undefined (the runtime default), as before.
 */
export function currentFormatLocale(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return formatLocaleFor(document.documentElement.getAttribute("lang") || DEFAULT_CAREER_LOCALE);
}

function writeCookie(name: string, value: string | null) {
  document.cookie = value === null ? `${name}=; path=/; max-age=0; samesite=lax` : `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

interface LocaleInfo {
  locale: string;
  userLocale?: string | null;
  canSaveUserLocale?: boolean;
  timeZone?: string | null;
}

export default function CareerI18nProvider({
  locale,
  explicit,
  messages,
  children,
}: {
  locale: string;
  /** True when the locale is the user's own choice (cookie); then the API's suggestion is not applied. */
  explicit: boolean;
  messages: CareerMessages;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const api = useApi();
  const { isLoaded, isSignedIn } = useAppAuth();
  const [schoolTimeZone, setSchoolTimeZone] = useState<string | null>(null);
  const dir = directionOf(locale);
  const formatLocale = formatLocaleFor(locale);

  // The page language and direction (WCAG 3.1.1); portalled popups (user menu) follow the document's dir too
  useEffect(() => {
    const html = document.documentElement;
    const before = { lang: html.getAttribute("lang"), dir: html.getAttribute("dir") };
    html.setAttribute("lang", locale);
    html.setAttribute("dir", dir);
    return () => {
      if (before.lang === null) html.removeAttribute("lang");
      else html.setAttribute("lang", before.lang);
      if (before.dir === null) html.removeAttribute("dir");
      else html.setAttribute("dir", before.dir);
    };
  }, [locale, dir]);

  // The user's saved choice or the school's default, unless the user picked a language in this browser
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    api<LocaleInfo>("/api/career/locale")
      .then((info) => {
        if (cancelled) return;
        setSchoolTimeZone(info.timeZone ?? null);
        if (explicit) {
          // A choice made in this browser before it could be saved: store it once so emails follow it too.
          // Pseudo-locales are test settings and stay in the browser; a choice saved elsewhere is never overwritten.
          if (info.canSaveUserLocale && !info.userLocale && !isPseudoLocale(locale)) {
            api("/api/career/locale", { method: "PUT", json: { locale } }).catch(() => {});
          }
          return;
        }
        const suggested = matchCareerLocale(info.locale) ?? DEFAULT_CAREER_LOCALE;
        if (suggested !== locale) {
          writeCookie(SCHOOL_LOCALE_COOKIE, suggested);
          router.refresh();
        }
      })
      .catch(() => {
        // Older API without the endpoint: keep the current language
      });
    return () => {
      cancelled = true;
    };
  }, [api, isLoaded, isSignedIn, explicit, locale, router]);

  const setLocale = useCallback(
    (next: string | null) => {
      writeCookie(LOCALE_COOKIE, next);
      // Saved for the account too (emails, other devices); the cookie alone still works if this fails
      const save = isSignedIn ? api("/api/career/locale", { method: "PUT", json: { locale: next } }).catch(() => {}) : Promise.resolve();
      // Re-render after the save so the API's next answer already reflects the new choice
      void save.finally(() => router.refresh());
    },
    [api, isSignedIn, router],
  );

  const value = useMemo<CareerI18nState>(
    () => ({ locale, dir, formatLocale, messages, schoolTimeZone, available: availableCareerLocales(), setLocale }),
    [locale, dir, formatLocale, messages, schoolTimeZone, setLocale],
  );

  return (
    <CareerI18nContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages as AbstractIntlMessages} timeZone={schoolTimeZone ?? undefined}>
        {children}
      </NextIntlClientProvider>
    </CareerI18nContext.Provider>
  );
}

export function useCareerI18n() {
  return useContext(CareerI18nContext);
}

const quiet = process.env.NODE_ENV === "production";

/**
 * Translator for one area of the career messages: useCareerT("notifications")("title").
 * Works outside the provider too (English). Use t.rich for text with links, t.has to test optional keys.
 */
export function useCareerT(namespace?: string) {
  const { locale, messages } = useContext(CareerI18nContext);
  return useMemo(
    () =>
      createTranslator({
        locale,
        messages: messages as AbstractIntlMessages,
        namespace: (namespace ? `Career.${namespace}` : "Career") as never,
        onError: (e) => {
          if (!quiet) console.warn(`[career i18n] ${e.message}`);
        },
        getMessageFallback: ({ key, namespace: ns }) => [ns, key].filter(Boolean).join("."),
      }) as unknown as CareerTranslator,
    [locale, messages, namespace],
  );
}

/** Message key for a code value: next-intl keys can't contain ".", so "faculty.approved" is stored as "faculty_approved". */
export const labelKey = (code: string) => code.replace(/\./g, "_");

/**
 * Labels for a fixed set of codes (statuses, kinds, tabs), translated from one area of the messages:
 * useCareerLabels("experiencesShared.statusLabel", STATUS_KEYS)["Draft"]. Keeps the order of `keys` (for option lists).
 * `keys` should be a module-level constant so the map is only rebuilt when the language changes.
 */
export function useCareerLabels(namespace: string, keys: readonly string[]): Record<string, string> {
  const t = useCareerT(namespace);
  return useMemo(() => Object.fromEntries(keys.map((k) => [k, t(labelKey(k))])), [t, keys]);
}

type Values = Record<string, string | number | Date | null | undefined>;
type RichValues = Record<string, string | number | Date | ((chunks: React.ReactNode) => React.ReactNode) | null | undefined>;
export interface CareerTranslator {
  (key: string, values?: Values): string;
  rich(key: string, values?: RichValues): React.ReactNode;
  has(key: string): boolean;
}

type DateInput = string | number | Date | null | undefined;
type ZoneOption = { timeZone?: "school" | string };

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Locale-aware formatting bound to the career locale (and optionally the school's time zone). */
export function useCareerFormat() {
  const { formatLocale, schoolTimeZone } = useContext(CareerI18nContext);
  return useMemo(() => {
    const zone = (o?: ZoneOption) => (o?.timeZone === "school" ? (schoolTimeZone ?? undefined) : o?.timeZone);
    const none = "—";
    return {
      locale: formatLocale,
      date: (value: DateInput, o?: ZoneOption & { style?: "short" | "medium" | "long" | "full" }) => {
        const d = toDate(value);
        return d ? d.toLocaleDateString(formatLocale, { dateStyle: o?.style ?? "medium", timeZone: zone(o) }) : value ? String(value) : none;
      },
      dateTime: (value: DateInput, o?: ZoneOption) => {
        const d = toDate(value);
        return d ? d.toLocaleString(formatLocale, { dateStyle: "medium", timeStyle: "short", timeZone: zone(o) }) : value ? String(value) : none;
      },
      time: (value: DateInput, o?: ZoneOption) => {
        const d = toDate(value);
        return d ? d.toLocaleTimeString(formatLocale, { timeStyle: "short", timeZone: zone(o) }) : none;
      },
      number: (n: number | null | undefined, o?: Intl.NumberFormatOptions) => (n === null || n === undefined ? none : new Intl.NumberFormat(formatLocale, o).format(n)),
      percent: (fraction: number | null | undefined, digits = 0) =>
        fraction === null || fraction === undefined ? none : new Intl.NumberFormat(formatLocale, { style: "percent", maximumFractionDigits: digits }).format(fraction),
      currency: (amount: number | null | undefined, currency: string) =>
        amount === null || amount === undefined ? none : new Intl.NumberFormat(formatLocale, { style: "currency", currency }).format(amount),
      relative: (value: DateInput) => {
        const d = toDate(value);
        if (!d) return none;
        const seconds = (d.getTime() - Date.now()) / 1000;
        const units: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
        const rtf = new Intl.RelativeTimeFormat(formatLocale, { numeric: "auto" });
        for (const [unit, size] of units) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
        return rtf.format(Math.round(seconds), "second");
      },
      list: (items: string[], type: "conjunction" | "disjunction" = "conjunction") => new Intl.ListFormat(formatLocale, { style: "long", type }).format(items),
    };
  }, [formatLocale, schoolTimeZone]);
}
