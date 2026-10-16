/**
 * Career-suite locales (G1). Shared by the server layout and the client provider; no React here.
 * See docs/career_suite_i18n_guide.md for how a language is added.
 */

/** Languages with a messages/career/<locale>.json file. English is the source and the fallback for missing keys. */
export const CAREER_LOCALES = ["en"] as const;

/** Test-only locales generated from English: accented and ~35% longer, and mirrored right-to-left. */
export const PSEUDO_LOCALES = ["en-XA", "ar-XB"] as const;

export const DEFAULT_CAREER_LOCALE = "en";

/** The user's own choice (set by the language picker). */
export const LOCALE_COOKIE = "career_locale";
/** Last effective locale from the API (user's saved choice or school default), so the next page load renders in it. */
export const SCHOOL_LOCALE_COOKIE = "career_locale_school";

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur", "ps", "yi"]);

export function pseudoLocalesEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_CAREER_PSEUDO_LOCALES === "1";
}

export function availableCareerLocales(): string[] {
  return pseudoLocalesEnabled() ? [...CAREER_LOCALES, ...PSEUDO_LOCALES] : [...CAREER_LOCALES];
}

export function isPseudoLocale(locale: string) {
  return (PSEUDO_LOCALES as readonly string[]).includes(locale);
}

export function languageOf(locale: string) {
  return locale.split(/[-_]/)[0].toLowerCase();
}

export function directionOf(locale: string): "ltr" | "rtl" {
  return RTL_LANGUAGES.has(languageOf(locale)) ? "rtl" : "ltr";
}

/** Best available match for a requested tag: exact, then same language (never a pseudo-locale), else null. */
export function matchCareerLocale(requested: string | null | undefined, available = availableCareerLocales()): string | null {
  if (!requested) return null;
  const wanted = requested.trim().replace("_", "-");
  const exact = available.find((l) => l.toLowerCase() === wanted.toLowerCase());
  if (exact) return exact;
  const lang = languageOf(wanted);
  return available.find((l) => !isPseudoLocale(l) && languageOf(l) === lang) ?? null;
}

/**
 * Locale used for Intl date/number formatting. English keeps the browser's English variant (en-US, en-GB, en-IN...)
 * so dates look as they did before; pseudo-locales format like their base language.
 */
export function formatLocaleFor(locale: string): string {
  if (locale === "ar-XB") return "ar";
  if (locale === "en" || locale === "en-XA") {
    if (typeof navigator !== "undefined") {
      const english = (navigator.languages ?? [navigator.language]).find((l) => languageOf(l) === "en");
      if (english) return english;
    }
    return "en-US";
  }
  return locale;
}

/** Each language named in itself (autonym), so people find their own; not translated. */
const PSEUDO_NAMES: Record<string, string> = { "en-XA": "Pseudo (accented)", "ar-XB": "Pseudo (right-to-left)" };
export function languageName(locale: string): string {
  if (PSEUDO_NAMES[locale]) return PSEUDO_NAMES[locale];
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(locale);
    return name ? name.charAt(0).toLocaleUpperCase(locale) + name.slice(1) : locale;
  } catch {
    return locale;
  }
}
