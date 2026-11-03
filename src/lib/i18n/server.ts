/**
 * The reader's language on the server (root layout): their choice (cookie), else their school's suggestion, when it's a
 * language they may use (live, or the one a reviewer is previewing); else English. Its texts are loaded here, so the
 * page is rendered in it from the first paint. English readers load nothing: the text is written in English.
 */
import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, PREVIEW_COOKIE, SCHOOL_LANGUAGE_COOKIE, usableLanguage, type AppLanguage } from "./languages";

export type AppMessages = Record<string, string>;

export async function requestLanguage(): Promise<{ language: AppLanguage; messages: AppMessages | null }> {
  const jar = await cookies();
  const preview = jar.get(PREVIEW_COOKIE)?.value;
  const read = (name: string) => usableLanguage(decodeURIComponent(jar.get(name)?.value ?? ""), preview);
  const language = read(LANGUAGE_COOKIE) ?? read(SCHOOL_LANGUAGE_COOKIE) ?? "en";
  if (language === "en") return { language, messages: null };
  try {
    const mod = (await import(`../../../messages/app/${language}.json`)) as { default: AppMessages };
    return { language, messages: mod.default };
  } catch {
    return { language: "en", messages: null };
  }
}
