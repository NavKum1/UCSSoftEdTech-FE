// S4b help center (docs/s4b_help_center_for_everyone_plan.md): who each guide is for, the groups in the order of each
// audience's work, "Your steps" and "Next step". It holds no articles of its own (they're passed in), so the app (./index.ts)
// and the public site (edulexa.com/help, which gets a copy from scripts/help-build.ts --public, with search.ts and types.ts)
// work the same way.
import type { HelpArticle, HelpAudience, HelpRole } from "./types";

export const PRIVACY = "Your data and privacy";

/** Is the article for this audience (its own, or for everyone)? */
export const isFor = (a: HelpArticle, role: string) => a.roles.includes(role) || a.roles.includes("everyone");

/** The order groups appear in when guides for everyone are shown: each audience's order in turn, privacy last */
export function groupOrder(audiences: HelpAudience[]): string[] {
  return [...new Set(audiences.flatMap((a) => a.groups).filter((g) => g !== PRIVACY)), PRIVACY];
}

/** Audiences that have guides of their own (not only the ones for everyone), for the tabs */
export function audiencesWithGuides(list: HelpArticle[], roles: HelpRole[]): HelpRole[] {
  return roles.filter((r) => list.some((a) => a.roles.includes(r)));
}

/** Groups in the given order (an audience's work, or the order for everyone), each with its articles in order */
export function groupHelp(list: HelpArticle[], order: string[]): { group: string; articles: HelpArticle[] }[] {
  const groups = new Map<string, HelpArticle[]>();
  for (const a of list) groups.set(a.group, [...(groups.get(a.group) ?? []), a]);
  const rank = (g: string) => (order.includes(g) ? order.indexOf(g) : g === PRIVACY ? order.length + 1 : order.length);
  return [...groups.entries()].sort((x, y) => rank(x[0]) - rank(y[0]) || x[0].localeCompare(y[0])).map(([group, articles]) => ({ group, articles }));
}

/** "Your steps": the audience's articles in the order the work is done */
export function helpSteps(list: HelpArticle[], audience: HelpAudience | null | undefined): HelpArticle[] {
  return (audience?.steps ?? []).map((s) => list.find((a) => a.slug === s)).filter((a): a is HelpArticle => !!a);
}

/** "Next step" after an article: in the reader's steps, or else in the steps of the first audience it's a step for */
export function nextStep(
  list: HelpArticle[],
  slug: string,
  role: string | null,
  audiences: HelpAudience[],
): { article: HelpArticle; step: number; of: number } | null {
  const mine = audiences.find((a) => a.id === role);
  const path = mine?.steps.includes(slug) ? mine : audiences.find((a) => a.steps.includes(slug));
  if (!path) return null;
  const i = path.steps.indexOf(slug);
  const next = list.find((a) => a.slug === path.steps[i + 1]);
  return next ? { article: next, step: i + 2, of: path.steps.length } : null;
}
