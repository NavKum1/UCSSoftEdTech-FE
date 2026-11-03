import React from "react";
import { cookies } from "next/headers";
import CareerI18nProvider from "./CareerI18nProvider";
import { DEFAULT_CAREER_LOCALE, LOCALE_COOKIE, SCHOOL_LOCALE_COOKIE, matchCareerLocale } from "./config";
import { loadCareerMessages } from "./messages";
import { PREVIEW_COOKIE, usableLanguage } from "@/lib/i18n/languages";

/**
 * Server entry for career-suite language (used by the persona layouts): reads the locale cookies so the page is
 * rendered in the right language and direction from the first paint, and hands the messages to the client provider.
 */
export default async function CareerI18nRoot({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  // A reviewer previewing a language that isn't live yet sees it here too (lib/i18n/languages)
  const preview = jar.get(PREVIEW_COOKIE)?.value;
  const read = (name: string) => {
    const value = decodeURIComponent(jar.get(name)?.value ?? "");
    return usableLanguage(value, preview) ?? matchCareerLocale(value);
  };
  const chosen = read(LOCALE_COOKIE);
  const school = read(SCHOOL_LOCALE_COOKIE);
  const locale = chosen ?? school ?? DEFAULT_CAREER_LOCALE;
  const messages = await loadCareerMessages(locale);
  return (
    <CareerI18nProvider locale={locale} explicit={!!chosen} messages={messages}>
      {children}
    </CareerI18nProvider>
  );
}
