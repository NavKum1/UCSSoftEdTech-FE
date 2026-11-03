/**
 * The reader's English as this browser knows it (no React, so the API client can use it): their own choice (a cookie),
 * else their school's (remembered from its pages), else where they are (time zone, then browser language), else British/Indian.
 */
import { englishFromLocale, type English } from "./index";

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

/**
 * Where the reader is: the time zone first (many computers in India say en-US, but their clock says Asia/Kolkata),
 * then the browser's English with a region
 */
function fromBrowser(): English {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) return zone.startsWith("America/") ? "US" : "GB";
  } catch {
    // no time zone: the browser's language
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const e = englishFromLocale(tag);
    if (e) return e;
  }
  return "GB";
}

/** The English for this browser, without a school's public page around it */
export function browserEnglish(): English {
  if (typeof document === "undefined") return "GB";
  return readChoice() ?? readSchool() ?? fromBrowser();
}

