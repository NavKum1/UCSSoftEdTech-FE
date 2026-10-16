/**
 * Loads the career messages for a locale (server or client). English is bundled and fills any key a translation
 * is missing; pseudo-locales are generated from English.
 */
import en from "../../../../messages/career/en.json";
import { DEFAULT_CAREER_LOCALE, isPseudoLocale } from "./config";
import { pseudoMessages } from "./pseudo";

export type CareerMessages = { [key: string]: string | CareerMessages };

export const englishMessages = en as CareerMessages;

function merge(base: CareerMessages, over: CareerMessages): CareerMessages {
  const out: CareerMessages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = base[k];
    out[k] = typeof v === "object" && typeof b === "object" ? merge(b, v) : v;
  }
  return out;
}

export async function loadCareerMessages(locale: string): Promise<CareerMessages> {
  if (locale === DEFAULT_CAREER_LOCALE) return englishMessages;
  if (isPseudoLocale(locale)) return pseudoMessages(locale, englishMessages);
  try {
    const mod = (await import(`../../../../messages/career/${locale}.json`)) as { default: CareerMessages };
    return merge(englishMessages, mod.default);
  } catch {
    return englishMessages;
  }
}
