/**
 * The reader's English as this browser knows it (no React, so the API client can use it): their own choice (a cookie),
 * else their school's (remembered from its pages), else US English.
 */
import { DEFAULT_ENGLISH, type English } from "./index";

export const CHOICE_COOKIE = "edulexa_english";
export const SCHOOL_KEY = "edulexa_english_school";
export const EVENT = "edulexa-english";

export function readChoice(): English | null {
  const m = /(?:^|;\s*)edulexa_english=(US|GB)\b/.exec(typeof document === "undefined" ? "" : document.cookie);
  return m ? (m[1] as English) : null;
}

function readSchool(): English | null {
  try {
    const v = localStorage.getItem(SCHOOL_KEY);
    return v === "US" || v === "GB" ? v : null;
  } catch {
    return null;
  }
}

/** The English for this browser, without a school's public page around it */
export function browserEnglish(): English {
  if (typeof document === "undefined") return DEFAULT_ENGLISH;
  return readChoice() ?? readSchool() ?? DEFAULT_ENGLISH;
}
