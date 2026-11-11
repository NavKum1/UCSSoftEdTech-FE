// S4 help center: the articles in the reader's language (English where a reviewed translation doesn't exist yet), search, and
// who each article is for. The articles are built from content/help by scripts/help-build.ts. S4b: ten audiences, each with
// its own groups and "Your steps" (content/help/audiences.yml), the words people search with, and "Words we use".
import { HELP_ARTICLES, HELP_AUDIENCES, HELP_GLOSSARY, HELP_WORDS } from "./articles.generated";
import { searchHelp as search } from "./search";
import type { HelpArticle, HelpAudience, HelpGlossaryEntry, HelpRole } from "./types";

export type { HelpArticle, HelpAudience, HelpGlossaryEntry, HelpRole } from "./types";

export const HELP_ROLES: HelpRole[] = HELP_AUDIENCES.map((a) => a.id);

const PRIVACY = "Your data and privacy";
/** The order groups appear in when guides for everyone are shown: each audience's order in turn, privacy last */
export const GROUP_ORDER: string[] = [...new Set(HELP_AUDIENCES.flatMap((a) => a.groups).filter((g) => g !== PRIVACY)), PRIVACY];

export function helpArticles(lang: string): HelpArticle[] {
  const en = HELP_ARTICLES.en ?? [];
  const own = new Map((HELP_ARTICLES[lang] ?? []).map((a) => [a.slug, a]));
  return en.map((a) => own.get(a.slug) ?? a);
}

export function helpArticle(lang: string, slug: string): HelpArticle | null {
  return helpArticles(lang).find((a) => a.slug === slug) ?? null;
}

export function helpAudience(role: string | null | undefined): HelpAudience | null {
  return HELP_AUDIENCES.find((a) => a.id === role) ?? null;
}

/** Is the article for this audience (its own, or for everyone)? */
export const isFor = (a: HelpArticle, role: string) => a.roles.includes(role) || a.roles.includes("everyone");

/** Audiences that have guides of their own (not only the ones for everyone), for the tabs */
export function audiencesWithGuides(list: HelpArticle[]): HelpRole[] {
  return HELP_ROLES.filter((r) => list.some((a) => a.roles.includes(r)));
}

/** Articles matching the query, best first: the reader's own guides first, understanding the words people use */
export function searchHelp(list: HelpArticle[], query: string, lang = "en", audience: string | null = null): HelpArticle[] {
  return search(list, query, { audience, words: HELP_WORDS[lang] ?? HELP_WORDS.en ?? {} });
}

/** Groups in the order of the audience's work (or the order for everyone), each with its articles in order */
export function groupHelp(list: HelpArticle[], role: string | null = null): { group: string; articles: HelpArticle[] }[] {
  const order = helpAudience(role)?.groups ?? GROUP_ORDER;
  const groups = new Map<string, HelpArticle[]>();
  for (const a of list) groups.set(a.group, [...(groups.get(a.group) ?? []), a]);
  const rank = (g: string) => (order.includes(g) ? order.indexOf(g) : g === PRIVACY ? order.length + 1 : order.length);
  return [...groups.entries()].sort((x, y) => rank(x[0]) - rank(y[0]) || x[0].localeCompare(y[0])).map(([group, articles]) => ({ group, articles }));
}

/** "Your steps": the audience's articles in the order the work is done */
export function helpSteps(list: HelpArticle[], role: string | null): HelpArticle[] {
  const steps = helpAudience(role)?.steps ?? [];
  return steps.map((s) => list.find((a) => a.slug === s)).filter((a): a is HelpArticle => !!a);
}

/** "Next step" after an article: in the reader's steps, or else in the steps of the first audience it's a step for */
export function nextStep(list: HelpArticle[], slug: string, role: string | null): { article: HelpArticle; step: number; of: number } | null {
  const mine = helpAudience(role);
  const path = mine?.steps.includes(slug) ? mine : HELP_AUDIENCES.find((a) => a.steps.includes(slug));
  if (!path) return null;
  const i = path.steps.indexOf(slug);
  const next = list.find((a) => a.slug === path.steps[i + 1]);
  return next ? { article: next, step: i + 2, of: path.steps.length } : null;
}

export function helpGlossary(lang: string): HelpGlossaryEntry[] {
  return HELP_GLOSSARY[lang] ?? HELP_GLOSSARY.en ?? [];
}

/** A safe way back: a path in this app only */
export function backPath(from: string | null): string | null {
  return from && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/help") ? from : null;
}
