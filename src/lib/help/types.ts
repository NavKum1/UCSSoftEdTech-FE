// S4 help center: the shape of a built help article (scripts/help-build.ts writes articles.generated.ts from content/help)
export type HelpInline =
  | { t: "text" | "b" | "ui" | "code"; v: string }
  | { t: "link"; v: string; href: string }
  /** S4b: a term from "Words we use", where the article first uses it */
  | { t: "term"; v: string; key: string };
export type HelpBlock =
  | { t: "h2" | "h3" | "p" | "note"; c: HelpInline[] }
  | { t: "ul" | "ol"; items: HelpInline[][] }
  /** S4b: a screenshot taken from the demo school (public/help/shots/<name>.png) */
  | { t: "shot"; name: string; alt: string; w: number; h: number }
  /** S4b: the list of "Words we use" */
  | { t: "glossary" };

/**
 * Who an article is for (S4b): school admins, teachers, career staff, students, alumni, individual members, recruiters,
 * employers, admissions (guidance institutes) and mentors. An article for "everyone" is for all of them.
 */
export type HelpRole = "admin" | "teacher" | "staff" | "student" | "alumni" | "member" | "recruiter" | "employer" | "admissions" | "mentor";

export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  roles: string[];
  group: string;
  /** The register features it covers (docs/feature_register.json) */
  features: string[];
  /** When it was last checked against the app (YYYY-MM-DD) */
  checked: string;
  /** Where it comes in its group */
  order: number;
  /** "In short": up to three lines */
  short: string[];
  blocks: HelpBlock[];
  /** The headings, for search */
  headings: string[];
  /** Plain text, for search */
  text: string;
}

/** An audience's groups (in the order of their work) and "Your steps" (content/help/audiences.yml) */
export interface HelpAudience {
  id: HelpRole;
  groups: string[];
  steps: string[];
}

/** A term in "Words we use" (content/help/<lang>/glossary.yml) */
export interface HelpGlossaryEntry {
  key: string;
  term: string;
  means: string;
  see?: string;
}
