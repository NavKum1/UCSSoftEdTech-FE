"use client";

import React, { useId } from "react";
import { useCareerI18n, useCareerT } from "./CareerI18nProvider";
import { languageName } from "./config";

/** Language choice for the career shell. Hidden while only one language is available (today: English in production). */
export default function LanguagePicker({ className = "" }: { className?: string }) {
  const { locale, available, setLocale } = useCareerI18n();
  const t = useCareerT();
  const id = useId();
  if (available.length < 2) return null;
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <label htmlFor={id}>{t("shell.language")}</label>
      <select id={id} className="rounded-md border border-border bg-background px-2 py-1 text-xs" value={locale} onChange={(e) => setLocale(e.target.value)}>
        {available.map((l) => (
          // Each language is named in itself so people can find their own
          <option key={l} value={l} lang={l}>
            {languageName(l)}
          </option>
        ))}
      </select>
    </span>
  );
}
