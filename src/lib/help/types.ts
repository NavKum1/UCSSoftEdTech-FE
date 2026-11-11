// S4 help center: the shape of a built help article (scripts/help-build.ts writes articles.generated.ts from content/help)
export type HelpInline = { t: "text" | "b" | "ui" | "code"; v: string } | { t: "link"; v: string; href: string };
export type HelpBlock = { t: "h2" | "h3" | "p" | "note"; c: HelpInline[] } | { t: "ul" | "ol"; items: HelpInline[][] };

/** Who an article is for: school admins, teachers, career staff, students */
export type HelpRole = "admin" | "teacher" | "staff" | "student";

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
  blocks: HelpBlock[];
  /** Plain text, for search */
  text: string;
}
