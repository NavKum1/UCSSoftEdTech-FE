"use client";

/**
 * The reader's language: English (automatic: their school's spelling, else where they are; or US; or UK/Indian), or a
 * reviewed language (lib/i18n/languages; a reviewer also sees the one they're previewing). Saved in cookies, so every
 * page and the API's messages follow it.
 */
import React from "react";
import { useEnglish } from "@/lib/english/EnglishProvider";
import { LANGUAGE_NAMES, LIVE_LANGUAGES, type AppLanguage } from "@/lib/i18n/languages";

export default function EnglishPicker({ className = "" }: { className?: string }) {
  const { language, english, choice, choose, chooseLanguage } = useEnglish();
  const others = [...new Set([...LIVE_LANGUAGES, language])].filter((l): l is Exclude<AppLanguage, "en"> => l !== "en");
  const value = language !== "en" ? language : choice ? `en-${choice}` : "auto";
  const pick = (v: string) => {
    if (v === "auto" || v === "en-US" || v === "en-GB") {
      choose(v === "auto" ? null : (v.slice(3) as "US" | "GB"));
      if (language !== "en") chooseLanguage("en");
      return;
    }
    chooseLanguage(v as AppLanguage);
  };
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">Language</span>
      <select
        value={value}
        onChange={(e) => pick(e.target.value)}
        title="Language"
        className="h-8 cursor-pointer appearance-none rounded-lg border border-border bg-card py-1 pe-6 ps-2.5 text-xs font-medium text-muted-foreground shadow-sm hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        <option value="auto">{english === "US" ? "EN-US" : "EN-GB"} (automatic)</option>
        <option value="en-US">English (US)</option>
        <option value="en-GB">English (UK/India)</option>
        {others.map((l) => (
          <option key={l} value={l} lang={l}>
            {LANGUAGE_NAMES[l]}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute end-2 text-[10px] text-muted-foreground">
        ▼
      </span>
    </label>
  );
}
