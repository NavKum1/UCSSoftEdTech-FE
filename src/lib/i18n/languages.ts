/**
 * The app's languages (plan item A2, 3 Nov 2026). English is the source (US or British/Indian spelling, lib/english);
 * the others are drafted and stay off until a native speaker has reviewed them (owner decision). A language is live
 * when it's in NEXT_PUBLIC_LANGUAGES (e.g. "es,hi"); reviewers see one before that with ?preview-language=hi, when it's
 * in NEXT_PUBLIC_PREVIEW_LANGUAGES. No React here: the server layout and the client both use it.
 */

export const DRAFTED_LANGUAGES = ["es", "hi", "ar"] as const;
export type AppLanguage = "en" | (typeof DRAFTED_LANGUAGES)[number];

/** The language cookie the whole app uses (the career suite's, so both agree) and the school's suggestion */
export const LANGUAGE_COOKIE = "career_locale";
export const SCHOOL_LANGUAGE_COOKIE = "career_locale_school";
/** A reviewer's preview of a language that isn't live yet */
export const PREVIEW_COOKIE = "edulexa_preview_language";

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter((x): x is AppLanguage => (DRAFTED_LANGUAGES as readonly string[]).includes(x));

/** Languages anyone can choose */
export const LIVE_LANGUAGES: AppLanguage[] = ["en", ...list(process.env.NEXT_PUBLIC_LANGUAGES)];
/** Languages a reviewer can preview (live ones included) */
export const PREVIEW_LANGUAGES: AppLanguage[] = [...new Set([...LIVE_LANGUAGES, ...list(process.env.NEXT_PUBLIC_PREVIEW_LANGUAGES)])];

/** The language a cookie names, when it's one this reader may use (preview: a reviewer's preview cookie is set) */
export function usableLanguage(value: string | null | undefined, preview: string | null | undefined): AppLanguage | null {
  const lang = (value ?? "").split(/[-_]/)[0].toLowerCase();
  if (LIVE_LANGUAGES.includes(lang as AppLanguage)) return lang as AppLanguage;
  if (preview && preview.toLowerCase() === lang && PREVIEW_LANGUAGES.includes(lang as AppLanguage)) return lang as AppLanguage;
  return null;
}

export const directionOf = (lang: string): "ltr" | "rtl" => (lang === "ar" ? "rtl" : "ltr");

/** Each language named in itself, so people find their own */
export const LANGUAGE_NAMES: Record<AppLanguage, string> = { en: "English", es: "Español", hi: "हिन्दी", ar: "العربية" };
