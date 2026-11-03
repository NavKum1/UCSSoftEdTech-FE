/**
 * Two Englishes: US spelling for everyone (owner decision 4 Nov 2026: Edulexa is a US product), British spelling where a
 * school or reader chooses it. The app's text is written in British English; toAmerican() gives the US spelling from the shared word list
 * (spelling.json, the same file as the API's Resources/english-spelling.json). Only the app's own text goes through it,
 * never what people typed (names, answers, a school's own wording).
 */
import spelling from "./spelling.json";

export type English = "US" | "GB";

/** The English for anyone who hasn't chosen one */
export const DEFAULT_ENGLISH: English = "US";

const MAP = new Map<string, string>();
for (const s of spelling.stems) for (const e of s.endings) MAP.set(s.gb + e, s.us + e);
for (const [gb, us] of spelling.words) MAP.set(gb, us);

// Whole words, longest first (so "counselling" wins over a shorter key)
const KEYS = [...MAP.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/ /g, "\\s+"));
const PATTERN = new RegExp(`(?<![\\w'])(${KEYS.join("|")})(?![\\w])`, "gi");
/** Left as they are: web addresses, paths, e-mail addresses (anything with a slash or an @, or starting www.) and {merge fields} */
const KEEP = /(?:https?:\/\/|www\.)\S+|\S*[/@]\S*|\{[^{}\s]*\}/gi;

function sameCase(from: string, to: string) {
  if (from === from.toUpperCase() && from !== from.toLowerCase()) return to.toUpperCase();
  if (from[0] === from[0].toUpperCase()) return to[0].toUpperCase() + to.slice(1);
  return to;
}

const convert = (part: string) => part.replace(PATTERN, (m) => sameCase(m, MAP.get(m.toLowerCase().replace(/\s+/g, " ")) ?? m));

/** The US spelling of a British English text */
export function toAmerican(text: string): string {
  if (!text) return text;
  let out = "";
  let at = 0;
  for (const kept of text.matchAll(KEEP)) {
    out += convert(text.slice(at, kept.index)) + kept[0];
    at = (kept.index ?? 0) + kept[0].length;
  }
  return out + convert(text.slice(at));
}

/** The text in the given English */
export const inEnglish = (english: English, text: string) => (english === "US" ? toAmerican(text) : text);

type Messages = { [key: string]: string | Messages };
const converted = new WeakMap<object, Messages>();
/** A language file's English texts in US spelling (kept per file, so it's worked out once) */
export function americanMessages<T extends Messages>(messages: T): T {
  const kept = converted.get(messages);
  if (kept) return kept as T;
  const out: Messages = {};
  for (const [k, v] of Object.entries(messages)) out[k] = typeof v === "string" ? toAmerican(v) : americanMessages(v);
  converted.set(messages, out);
  return out as T;
}
