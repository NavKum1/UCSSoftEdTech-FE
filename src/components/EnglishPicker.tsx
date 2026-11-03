"use client";

/**
 * The reader's choice of English spelling (US, or British/Indian), or automatic (their school's, else where they are).
 * Saved in a cookie: every page and the API's messages follow it.
 */
import React from "react";
import { useEnglish } from "@/lib/english/EnglishProvider";

export default function EnglishPicker({ className = "" }: { className?: string }) {
  const { english, choice, choose } = useEnglish();
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">English spelling</span>
      <select
        value={choice ?? "auto"}
        onChange={(e) => choose(e.target.value === "auto" ? null : (e.target.value as "US" | "GB"))}
        title="English spelling"
        className="h-8 cursor-pointer appearance-none rounded-lg border border-border bg-card py-1 pl-2.5 pr-6 text-xs font-medium text-muted-foreground shadow-sm hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        <option value="auto">{english === "US" ? "EN-US" : "EN-GB"} (automatic)</option>
        <option value="US">US English</option>
        <option value="GB">UK/Indian English</option>
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-2 text-[10px] text-muted-foreground">
        ▼
      </span>
    </label>
  );
}
