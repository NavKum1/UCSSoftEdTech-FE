// S4 help center: the articles in the reader's language (English where a reviewed translation doesn't exist yet), search, and
// who each article is for. The articles are built from content/help by scripts/help-build.ts.
import { HELP_ARTICLES } from "./articles.generated";
import type { HelpArticle, HelpRole } from "./types";

export type { HelpArticle, HelpRole } from "./types";

export const HELP_ROLES: HelpRole[] = ["admin", "teacher", "staff", "student"];

/** The order groups appear in; any other group comes after them */
export const GROUP_ORDER = ["Getting started", "People and classes", "Assessments", "Reviewing and deciding", "Results", "Billing", "Your data and privacy", "Handing in", "The viva", "After the decision"];

export function helpArticles(lang: string): HelpArticle[] {
  const en = HELP_ARTICLES.en ?? [];
  const own = new Map((HELP_ARTICLES[lang] ?? []).map((a) => [a.slug, a]));
  return en.map((a) => own.get(a.slug) ?? a);
}

export function helpArticle(lang: string, slug: string): HelpArticle | null {
  return helpArticles(lang).find((a) => a.slug === slug) ?? null;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Articles matching every word of the query, best first (words in the title count most, then the summary) */
export function searchHelp(list: HelpArticle[], query: string): HelpArticle[] {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return list;
  return list
    .map((a) => {
      const title = norm(a.title), summary = norm(a.summary), text = norm(a.text);
      let score = 0;
      for (const w of words) {
        if (title.includes(w)) score += 5;
        else if (summary.includes(w)) score += 3;
        else if (text.includes(w)) score += 1;
        else return { a, score: -1 };
      }
      return { a, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.a.title.localeCompare(y.a.title))
    .map((x) => x.a);
}

export function groupHelp(list: HelpArticle[]): { group: string; articles: HelpArticle[] }[] {
  const groups = new Map<string, HelpArticle[]>();
  for (const a of list) groups.set(a.group, [...(groups.get(a.group) ?? []), a]);
  const rank = (g: string) => (GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : GROUP_ORDER.length);
  return [...groups.entries()].sort((x, y) => rank(x[0]) - rank(y[0]) || x[0].localeCompare(y[0])).map(([group, articles]) => ({ group, articles }));
}

/** A safe way back: a path in this app only */
export function backPath(from: string | null): string | null {
  return from && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/help") ? from : null;
}
