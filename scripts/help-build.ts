/**
 * S4 help center (docs/s4_help_center_plan.md): builds the help articles from content/help/<lang>/<slug>.md into
 * src/lib/help/articles.generated.ts, and checks that they still match the app. An article names
 *   - the labels it tells people to use, as [ui: Save decision]: each must be a text the app shows (messages/app/en.json,
 *     messages/career/en.json, messages/en.json), so renaming a button stops the push until the article follows;
 *   - the register features it covers (features: [class-assessments]): each must exist in ../docs/feature_register.json;
 *   - links: /help/<slug> must be an article, and any other /path must be a page in the register.
 * Every <HelpLink slug="..."> in src must find its article. Translations (content/help/es|hi|ar) are drafts until a native
 * speaker sets "reviewed: true"; only reviewed ones are built.
 * Run: npx tsx scripts/help-build.ts            (writes the generated file)
 *      npx tsx scripts/help-build.ts --check    (fails when an article is wrong or the generated file is out of date)
 *      npx tsx scripts/help-build.ts --public <public site folder>   (also writes its src/content/help.json, English)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd(); // run from the web app folder (as the other scripts and the push hook do)
const CONTENT = path.join(ROOT, "content", "help");
const OUT = path.join(ROOT, "src", "lib", "help", "articles.generated.ts");
const REGISTER = path.resolve(ROOT, "..", "docs", "feature_register.json");
const LANGS = ["en", "es", "hi", "ar"] as const;
const ROLES = ["admin", "teacher", "staff", "student"] as const;

export type Inline = { t: "text" | "b" | "ui" | "code"; v: string } | { t: "link"; v: string; href: string };
export type Block = { t: "h2" | "h3" | "p" | "note"; c: Inline[] } | { t: "ul" | "ol"; items: Inline[][] };

const errors: string[] = [];
const fail = (where: string, msg: string) => errors.push(`${where}: ${msg}`);

// ----- the app's own texts (what [ui: ...] may name) -----
function flatValues(o: unknown, out: Set<string>) {
  if (typeof o === "string") out.add(o.trim());
  else if (o && typeof o === "object") for (const v of Object.values(o)) flatValues(v, out);
}
const uiTexts = new Set<string>();
for (const f of ["messages/app/en.json", "messages/career/en.json", "messages/en.json"]) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) flatValues(JSON.parse(fs.readFileSync(p, "utf8")), uiTexts);
}

// A label with a value in it ("Buy 100 minutes") matches the app's text with its placeholder ("Buy {minutes} minutes")
const escapeRe = (s: string) => s.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
// Only texts with at least six letters of their own (not "{count}" or "{name} ({role})", which would match anything), and a
// placeholder stands for a short value (a number or a few words), never for a whole sentence
const uiPatterns = [...uiTexts]
  .filter((t) => /\{\w+\}/.test(t) && t.length < 120 && (t.replace(/\{\w+\}/g, "").match(/\p{L}/gu)?.length ?? 0) >= 6)
  .map((t) => new RegExp("^" + t.split(/\{\w+\}/).map(escapeRe).join("[\\p{L}\\p{N}.,:'’ -]{1,30}") + "$", "u"));
const isUiText = (label: string) => uiTexts.has(label) || uiPatterns.some((re) => re.test(label));

// ----- the register: features and pages -----
const register = JSON.parse(fs.readFileSync(REGISTER, "utf8")) as { features: { id: string; pages?: string[] }[] };
const featureIds = new Set(register.features.map((f) => f.id));
const pagePatterns = register.features.flatMap((f) => f.pages ?? []);
function isPage(p: string) {
  return pagePatterns.some((pat) => {
    if (pat.endsWith("/**")) { const base = pat.slice(0, -3); return p === base || p.startsWith(base + "/"); }
    const re = new RegExp("^" + pat.replace(/[.+?^${}()|\\]/g, "\\$&").replace(/\[[^\]]+\]/g, "[^/]+") + "$");
    return re.test(p);
  });
}

// ----- parsing -----
function frontmatter(src: string, where: string): { meta: Record<string, string | string[]>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(src);
  if (!m) { fail(where, "no front matter (--- ... ---)"); return { meta: {}, body: src }; }
  const meta: Record<string, string | string[]> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([a-zA-Z]+):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const v = kv[2].trim();
    meta[kv[1]] = v.startsWith("[") && v.endsWith("]") ? v.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean) : v.replace(/^"(.*)"$/, "$1");
  }
  return { meta, body: m[2] };
}

function inline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\[ui:\s*([^\]]+)\]|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`/g;
  let last = 0;
  for (let m; (m = re.exec(text)); ) {
    if (m.index > last) out.push({ t: "text", v: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: "ui", v: m[1].trim() });
    else if (m[2] !== undefined) out.push({ t: "b", v: m[2] });
    else if (m[3] !== undefined) out.push({ t: "link", v: m[3], href: m[4] });
    else out.push({ t: "code", v: m[5] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

function blocks(body: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  let list: { t: "ul" | "ol"; items: string[] } | null = null;
  const flush = () => {
    if (para.length) out.push({ t: "p", c: inline(para.join(" ")) });
    para = [];
    if (list) out.push({ t: list.t, items: list.items.map(inline) });
    list = null;
  };
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    let m;
    if ((m = /^(#{2,3})\s+(.*)$/.exec(line))) { flush(); out.push({ t: m[1].length === 2 ? "h2" : "h3", c: inline(m[2]) }); }
    else if ((m = /^>\s?(.*)$/.exec(line))) { flush(); out.push({ t: "note", c: inline(m[1]) }); }
    else if ((m = /^-\s+(.*)$/.exec(line))) { if (para.length || list?.t === "ol") flush(); list ??= { t: "ul", items: [] }; list.items.push(m[1]); }
    else if ((m = /^\d+\.\s+(.*)$/.exec(line))) { if (para.length || list?.t === "ul") flush(); list ??= { t: "ol", items: [] }; list.items.push(m[1]); }
    else if (list && /^\s{2,}/.test(raw)) list.items[list.items.length - 1] += " " + line; // a list item's next line
    else { if (list) flush(); para.push(line); }
  }
  flush();
  return out;
}

const plain = (b: Block[]) =>
  b.map((x) => ("c" in x ? x.c : x.items.flat()).map((i) => i.v).join("")).join(" ").replace(/\s+/g, " ").trim();
const allInline = (b: Block[]) => b.flatMap((x) => ("c" in x ? x.c : x.items.flat()));

export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  roles: string[];
  group: string;
  features: string[];
  checked: string;
  /** Where it comes in its group (the sequence of the work) */
  order: number;
  blocks: Block[];
  text: string;
}

function read(lang: string): HelpArticle[] {
  const dir = path.join(CONTENT, lang);
  if (!fs.existsSync(dir)) return [];
  const list: HelpArticle[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const where = `content/help/${lang}/${file}`;
    const slug = file.slice(0, -3);
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) fail(where, "file names are lower-case words joined by hyphens");
    const { meta, body } = frontmatter(fs.readFileSync(path.join(dir, file), "utf8"), where);
    if (lang !== "en" && meta.reviewed !== "true") continue; // a draft translation: not shown until reviewed
    const s = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : "");
    const a = (k: string) => (Array.isArray(meta[k]) ? (meta[k] as string[]) : []);
    const b = blocks(body);
    const art: HelpArticle = { slug, title: s("title"), summary: s("summary"), roles: a("roles"), group: s("group"), features: a("features"), checked: s("checked"), order: Number(s("order") || 100), blocks: b, text: plain(b) };
    if (!art.title) fail(where, "no title");
    if (!art.summary) fail(where, "no summary");
    if (!art.group) fail(where, "no group");
    if (!art.roles.length || art.roles.some((r) => !(ROLES as readonly string[]).includes(r))) fail(where, `roles must be some of ${ROLES.join(", ")}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(art.checked)) fail(where, "checked: the date it was last checked against the app (YYYY-MM-DD)");
    if (lang === "en") {
      if (!art.features.length) fail(where, "features: the register features it covers");
      for (const f of art.features) if (!featureIds.has(f)) fail(where, `unknown feature "${f}"`);
      for (const i of allInline(b)) {
        // A label inside bold (or a broken one) isn't read as a label: it would show as raw text and escape this check
        if ((i.t === "text" || i.t === "b") && i.v.includes("[ui:")) fail(where, `"[ui:" isn't read here (inside bold, or not closed): ${i.v.slice(0, 60)}`);
        if (i.t === "ui" && !isUiText(i.v)) fail(where, `[ui: ${i.v}] isn't a text the app shows (renamed?)`);
      }
    }
    list.push(art);
  }
  return list.sort((x, y) => x.order - y.order || x.slug.localeCompare(y.slug));
}

const byLang: Record<string, HelpArticle[]> = {};
for (const l of LANGS) byLang[l] = read(l);
const slugs = new Set(byLang.en.map((a) => a.slug));
for (const a of byLang.en) {
  for (const i of allInline(a.blocks)) {
    if (i.t !== "link") continue;
    const href = i.href.split("#")[0].split("?")[0];
    if (/^https?:\/\//.test(href) || href.startsWith("mailto:")) continue;
    if (href.startsWith("/help/")) { if (!slugs.has(href.slice(6))) fail(`content/help/en/${a.slug}.md`, `links to a missing article ${href}`); }
    else if (href !== "/help" && !isPage(href)) fail(`content/help/en/${a.slug}.md`, `links to ${href}, which isn't a page in the register`);
  }
}
for (const l of LANGS.slice(1)) for (const a of byLang[l]) if (!slugs.has(a.slug)) fail(`content/help/${l}/${a.slug}.md`, "has no English article");

// Help links in the app must find their article
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(tsx?|jsx?)$/.test(e.name) ? [path.join(d, e.name)] : []));
for (const f of walk(path.join(ROOT, "src"))) {
  if (f === OUT) continue;
  for (const m of fs.readFileSync(f, "utf8").matchAll(/(?:<HelpLink\b[^>]*\bslug|helpSlug)\s*[=:]\s*["']([a-z0-9-]+)["']/g))
    if (!slugs.has(m[1])) fail(path.relative(ROOT, f), `help link to a missing article "${m[1]}"`);
}

const generated =
  "// Generated by scripts/help-build.ts from content/help: don't edit by hand (run: npx tsx scripts/help-build.ts)\n" +
  'import type { HelpArticle } from "./types";\n\n' +
  `export const HELP_ARTICLES: Record<string, HelpArticle[]> = ${JSON.stringify(byLang)};\n`;

const args = process.argv.slice(2);
if (errors.length) {
  console.error(`Help articles: ${errors.length} problem(s)\n` + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
if (args.includes("--check")) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
  if (now !== generated) {
    console.error("Help articles: src/lib/help/articles.generated.ts is out of date: run npx tsx scripts/help-build.ts");
    process.exit(1);
  }
  console.log(`Help articles OK: ${byLang.en.length} articles, every label, link and feature found.`);
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, generated);
  console.log(`Help articles: ${byLang.en.length} English articles (${LANGS.slice(1).map((l) => `${l} ${byLang[l].length}`).join(", ")} reviewed) written.`);
  const pub = args[args.indexOf("--public") + 1];
  if (args.includes("--public") && pub) {
    const target = path.resolve(pub, "src", "content", "help.json");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(byLang.en, null, 1) + "\n");
    console.log(`Public site copy written to ${target}`);
  }
}
