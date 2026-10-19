"use client";

import React, { useState, useEffect } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";

interface I18nProviderProps {
  children: React.ReactNode;
}

export default function I18nProvider({ children }: I18nProviderProps) {
  // Language from localStorage, or en. The server has no localStorage; it renders the loading state below either way,
  // since messages load in the effect, so the first render matches.
  const [locale, setLocale] = useState(() =>
    typeof window === "undefined" ? "en" : localStorage.getItem("preferredLanguage") || "en",
  );
  const [messages, setMessages] = useState<AbstractIntlMessages | null>(null);

  useEffect(() => {
    // Load messages dynamically based on selected locale
    import(`../../messages/${locale}.json`).then((module) => {
      setMessages(module.default);
    }).catch(err => {
      console.error("Failed to load language file:", err);
      // fallback to en
      import(`../../messages/en.json`).then(m => setMessages(m.default));
    });
  }, [locale]);

  if (!messages) return <div className="h-screen w-full flex items-center justify-center bg-background text-muted-foreground">Loading language...</div>;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="relative w-full h-full">
        {/* Language Switcher Overlay */}
        <div className="absolute top-4 right-4 z-50">
          <select 
            value={locale} 
            onChange={(e) => {
              const newLocale = e.target.value;
              localStorage.setItem("preferredLanguage", newLocale);
              setLocale(newLocale);
            }}
            className="bg-card border border-border text-xs text-muted-foreground rounded-md px-2 py-1"
          >
            <option value="en">English (US)</option>
            <option value="es">Español (ES)</option>
          </select>
        </div>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
