// S4b help center search (docs/s4b_help_center_for_everyone_plan.md, item 3): runs in the browser, and in scripts/help-build.ts,
// which checks the examples in content/help/en/words.yml. It understands the words people use (words.yml maps them to the
// articles' words), ranks the reader's own guides first, and a word that only comes up in passing ranks low.
import type { HelpArticle } from "./types";

export interface HelpSearchOptions {
  /** Whose guides come first (the reader's audience) */
  audience?: string | null;
  /** What people type → words the articles use (content/help/<lang>/words.yml) */
  words?: Record<string, string[]>;
}

export const normHelp = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();

// Words that say nothing about what the reader is looking for ("how do I add a roster" looks for "add roster")
const STOP = new Set(
  ("a an the to i me my we our do does did how what where when why who which can could should would will is are was be been am of for in on at by with and or it its you your this that there here want need please about from into get " +
    // "isn't working" and the like: the problem, not what it's about
    "not no working broken issue problem").split(" "),
);

/** The word and its simple forms (appointments → appointment, booking → book, replied → reply) */
function forms(w: string): string[] {
  const out = [w];
  if (w.length > 4 && w.endsWith("ies")) out.push(w.slice(0, -3) + "y");
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) out.push(w.slice(0, -1));
  if (w.length > 5 && w.endsWith("ing")) out.push(w.slice(0, -3));
  if (w.length > 4 && w.endsWith("ied")) out.push(w.slice(0, -3) + "y");
  else if (w.length > 4 && w.endsWith("ed")) out.push(w.slice(0, -2), w.slice(0, -1));
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A word or phrase at the start of a word ("appoint" finds "appointment", "in" doesn't find "sign") */
const finder = (alt: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(alt)}`, "u");

/** The query as groups of alternatives: each group must be found in an article, in any of its forms */
export function searchTerms(query: string, words: Record<string, string[]> = {}): string[][] {
  let q = ` ${normHelp(query).replace(/[^\p{L}\p{N}' -]+/gu, " ").replace(/\s+/g, " ").trim()} `;
  const groups: string[][] = [];
  // Phrases people use first ("log in", "oral exam"), longest first
  for (const key of Object.keys(words).filter((k) => k.includes(" ")).sort((x, y) => y.length - x.length)) {
    const k = normHelp(key);
    if (q.includes(` ${k} `)) {
      groups.push([k, ...words[key].map(normHelp)]);
      q = q.replace(` ${k} `, " ");
    }
  }
  const all = q.split(" ").filter((w) => w.length > 1);
  const meaningful = all.filter((w) => !STOP.has(w));
  for (const w of meaningful.length || groups.length ? meaningful : all)
    groups.push([...new Set([...forms(w), ...(words[w] ?? []).map(normHelp), ...forms(w).slice(1).flatMap((f) => (words[f] ?? []).map(normHelp))])]);
  return groups;
}

type Fields = { title: string; summary: string; short: string; headings: string; text: string };
const cache = new WeakMap<HelpArticle, Fields>();
function fields(a: HelpArticle): Fields {
  let f = cache.get(a);
  if (!f) {
    f = { title: normHelp(a.title), summary: normHelp(a.summary), short: normHelp((a.short ?? []).join(" ")), headings: normHelp((a.headings ?? []).join(" ")), text: normHelp(a.text) };
    cache.set(a, f);
  }
  return f;
}

/** How well one group of alternatives is found in an article: in the title most, then headings and "In short", then the summary, then the text */
function weight(f: Fields, alts: string[]): number {
  let best = 0;
  for (const alt of alts) {
    const re = finder(alt);
    if (re.test(f.title)) return 6;
    if (re.test(f.headings) || re.test(f.short)) best = Math.max(best, 4);
    else if (re.test(f.summary)) best = Math.max(best, 3);
    else if (re.test(f.text)) best = Math.max(best, 1);
  }
  return best;
}

/** Articles that match every part of the query, best first; the reader's own guides come before others that match as well */
export function searchHelp(list: HelpArticle[], query: string, opts: HelpSearchOptions = {}): HelpArticle[] {
  const groups = searchTerms(query, opts.words);
  if (!groups.length) return list;
  const own = (a: HelpArticle) => (opts.audience && a.roles.includes(opts.audience) ? 3 : a.roles.includes("everyone") ? 1 : 0);
  return list
    .map((a) => {
      const f = fields(a);
      let score = 0;
      for (const g of groups) {
        const w = weight(f, g);
        if (!w) return { a, score: -1 };
        score += w;
      }
      return { a, score: score + own(a) };
    })
    .filter((x) => x.score > 0)
    // On a tie the more focused guide (the shorter title) comes first
    .sort((x, y) => y.score - x.score || x.a.title.length - y.a.title.length || x.a.title.localeCompare(y.a.title))
    .map((x) => x.a);
}
