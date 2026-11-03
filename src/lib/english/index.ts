/**
 * Two Englishes (owner decision 2 Nov 2026): US spelling for the Americas, British/Indian spelling everywhere else.
 * The app's text is written in British/Indian English; toAmerican() gives the US spelling from the shared word list
 * (spelling.json, the same file as the API's Resources/english-spelling.json). Only the app's own text goes through it,
 * never what people typed (names, answers, a school's own wording).
 */
import spelling from "./spelling.json";

export type English = "US" | "GB";

/** Countries of the Americas (the API's SchoolPlans.Americas): US spelling by default */
export const AMERICAS = new Set(
  "US CA MX GT BZ SV HN NI CR PA CU DO HT JM BS BB TT AG DM GD KN LC VC PR VI VG AI KY BM TC MS AW CW SX BQ GP MQ BL MF PM GL CO VE GY SR GF EC PE BO BR PY UY AR CL FK".split(" "),
);

export const englishForCountry = (country: string | null | undefined): English => (country && AMERICAS.has(country.toUpperCase()) ? "US" : "GB");

/** The English of a language tag with a region (en-US, en-IN); null without one (plain "en") or for other languages */
export function englishFromLocale(tag: string | null | undefined): English | null {
  const m = /^en[-_]([a-z]{2})\b/i.exec(tag ?? "");
  return m ? englishForCountry(m[1]) : null;
}

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

/** The US spelling of a British/Indian English text */
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
