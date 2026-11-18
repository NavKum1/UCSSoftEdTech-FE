"use client";

import React, { useState, useEffect } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { useEn } from "@/lib/english/EnglishProvider";
import { useHelpLanguage } from "@/components/help/useHelpLanguage";

interface I18nProviderProps {
  children: React.ReactNode;
}

/** The languages with texts in messages/{locale}.json (the coding challenge's few next-intl texts); others use English */
const LOCALES = ["en", "es"];

/**
 * The coding challenge's next-intl texts, in the page's language (the one the app's own language setting chose). It used
 * to show its own English/Spanish picker on top of the page, which covered the challenge's title on a phone and could
 * disagree with the app's setting (18 Nov 2026).
 */
export default function I18nProvider({ children }: I18nProviderProps) {
  const en = useEn();
  const page = useHelpLanguage();
  const locale = LOCALES.includes(page) ? page : "en";
  const [loaded, setLoaded] = useState<{ locale: string; messages: AbstractIntlMessages } | null>(null);

  useEffect(() => {
    let live = true;
    import(`../../messages/${locale}.json`)
      .then((module) => live && setLoaded({ locale, messages: module.default }))
      .catch(() => import(`../../messages/en.json`).then((m) => live && setLoaded({ locale: "en", messages: m.default })));
    return () => {
      live = false;
    };
  }, [locale]);

  if (!loaded) return <div className="h-screen w-full flex items-center justify-center bg-background text-muted-foreground">{en("Loading language...")}</div>;

  return (
    <NextIntlClientProvider locale={loaded.locale} messages={loaded.messages}>
      {children}
    </NextIntlClientProvider>
  );
}
