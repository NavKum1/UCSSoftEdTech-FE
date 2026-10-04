"use client";

import React, { useState, useEffect } from "react";
import { NextIntlClientProvider } from "next-intl";

interface I18nProviderProps {
  children: React.ReactNode;
}

export default function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocale] = useState("en");
  const [messages, setMessages] = useState<any>(null);

  useEffect(() => {
    // Determine language from localStorage or default to en
    const savedLocale = localStorage.getItem("preferredLanguage") || "en";
    setLocale(savedLocale);
    
    // Load messages dynamically based on selected locale
    import(`../../messages/${savedLocale}.json`).then((module) => {
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
