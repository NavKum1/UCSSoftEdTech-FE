/**
 * S4 help center (docs/s4_help_center_plan.md): builds the help articles from content/help/<lang>/<slug>.md into
 * src/lib/help/articles.generated.ts, and checks that they still match the app. An article names
 *   - the labels it tells people to use, as [ui: Save decision]: each must be a text the app shows (messages/app/en.json,
 *     messages/career/en.json, messages/en.json), so renaming a button stops the push until the article follows;
 *   - the register features it covers (features: [class-assessments]): each must exist in ../docs/feature_register.json;
 *   - links: /help/<slug> must be an article, and any other /path must be a page in the register.
 * Every <HelpLink slug="..."> in src must find its article. Translations (content/help/es|hi|ar) are drafts until a native
 * speaker sets "reviewed: true"; only reviewed ones are built.
 * S4b (docs/s4b_help_center_for_everyone_plan.md) adds, each checked here:
 *   - content/help/audiences.yml: each audience's groups (in the order of their work) and "Your steps";
 *   - content/help/<lang>/words.yml: the words people search with, mapped to the articles' words, and search examples that
 *     must find the right article first;
 *   - content/help/<lang>/glossary.yml: "Words we use", marked where an article first uses a term;
 *   - "short:" (In short), required for articles over 250 words;
 *   - [shot: name] screenshots, described in content/help/shots.yml, taken into public/help/shots by scripts/help-shots.mjs.
 * Run: npx tsx scripts/help-build.ts            (writes the generated file)
 *      npx tsx scripts/help-build.ts --check    (fails when an article is wrong or the generated file is out of date)
 *      npx tsx scripts/help-build.ts --public <public site folder>   (also writes the site's help: see writePublic)
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { searchHelp } from "../src/lib/help/search";

const ROOT = process.cwd(); // run from the web app folder (as the other scripts and the push hook do)
const CONTENT = path.join(ROOT, "content", "help");
const OUT = path.join(ROOT, "src", "lib", "help", "articles.generated.ts");
const REGISTER = path.resolve(ROOT, "..", "docs", "feature_register.json");
const LANGS = ["en", "es", "hi", "ar"] as const;
const ROLES = ["admin", "teacher", "staff", "student", "alumni", "member", "recruiter", "employer", "admissions", "mentor"] as const;
const SHOTS_DIR = path.join(ROOT, "public", "help", "shots");
const SHORT_OVER = 250; // words: longer articles need "short:"

export type Inline = { t: "text" | "b" | "ui" | "code"; v: string } | { t: "link"; v: string; href: string } | { t: "term"; v: string; key: string };
export type Block =
  | { t: "h2" | "h3" | "p" | "note"; c: Inline[] }
  | { t: "ul" | "ol"; items: Inline[][] }
  | { t: "shot"; name: string; alt: string; w: number; h: number }
  | { t: "glossary" };

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
  let listKey: string | null = null; // a key followed by "  - item" lines
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey) { (meta[listKey] as string[]).push(item[1].trim().replace(/^"(.*)"$/, "$1")); continue; }
    const kv = /^([a-zA-Z]+):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const v = kv[2].trim();
    listKey = v === "" ? kv[1] : null;
    meta[kv[1]] = v === "" ? [] : v.startsWith("[") && v.endsWith("]") ? v.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean) : v.replace(/^"(.*)"$/, "$1");
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
    if ((m = /^\[shot:\s*([a-z0-9-]+)\s*\]$/.exec(line))) { flush(); out.push({ t: "shot", name: m[1], alt: "", w: 0, h: 0 }); }
    else if (line === "[glossary]") { flush(); out.push({ t: "glossary" }); }
    else if ((m = /^(#{2,3})\s+(.*)$/.exec(line))) { flush(); out.push({ t: m[1].length === 2 ? "h2" : "h3", c: inline(m[2]) }); }
    else if ((m = /^>\s?(.*)$/.exec(line))) { flush(); out.push({ t: "note", c: inline(m[1]) }); }
    else if ((m = /^-\s+(.*)$/.exec(line))) { if (para.length || list?.t === "ol") flush(); list ??= { t: "ul", items: [] }; list.items.push(m[1]); }
    else if ((m = /^\d+\.\s+(.*)$/.exec(line))) { if (para.length || list?.t === "ul") flush(); list ??= { t: "ol", items: [] }; list.items.push(m[1]); }
    else if (list && /^\s{2,}/.test(raw)) list.items[list.items.length - 1] += " " + line; // a list item's next line
    else { if (list) flush(); para.push(line); }
  }
  flush();
  return out;
}

const inlinesOf = (x: Block): Inline[] => ("c" in x ? x.c : "items" in x ? x.items.flat() : []);
const plain = (b: Block[]) => b.map((x) => inlinesOf(x).map((i) => i.v).join("")).join(" ").replace(/\s+/g, " ").trim();
const allInline = (b: Block[]) => b.flatMap(inlinesOf);
const headingsOf = (b: Block[]) => b.filter((x) => x.t === "h2" || x.t === "h3").map((x) => inlinesOf(x).map((i) => i.v).join(""));

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
  /** "In short": up to three lines */
  short: string[];
  blocks: Block[];
  /** The headings, for search */
  headings: string[];
  text: string;
}

// ----- S4b: audiences, words, glossary, shots -----
const readYaml = <T,>(file: string, fallback: T): T => (fs.existsSync(file) ? ((yaml.load(fs.readFileSync(file, "utf8")) as T) ?? fallback) : fallback);
type Audience = { groups?: string[]; steps?: string[] };
const audiencesRaw = readYaml<Record<string, Audience>>(path.join(CONTENT, "audiences.yml"), {});
for (const r of ROLES) if (!audiencesRaw[r]) fail("content/help/audiences.yml", `no entry for "${r}"`);
for (const k of Object.keys(audiencesRaw)) if (!(ROLES as readonly string[]).includes(k)) fail("content/help/audiences.yml", `unknown audience "${k}"`);
const audiences = ROLES.map((id) => ({ id, groups: audiencesRaw[id]?.groups ?? [], steps: audiencesRaw[id]?.steps ?? [] }));
for (const a of audiences) {
  const g = a.groups;
  if (g.includes("Your data and privacy") && g[g.length - 1] !== "Your data and privacy") fail("content/help/audiences.yml", `${a.id}: "Your data and privacy" comes last`);
}

type Shot = { as?: string; open?: string; click?: string[]; show?: string; point?: string; alt?: string };
const shots = readYaml<Record<string, Shot>>(path.join(CONTENT, "shots.yml"), {});
for (const [name, sh] of Object.entries(shots)) {
  if (!/^[a-z0-9-]+$/.test(name)) fail("content/help/shots.yml", `"${name}": names are lower-case words joined by hyphens`);
  if (!sh?.as || !sh.open || !sh.alt) fail("content/help/shots.yml", `"${name}" needs as, open and alt`);
}
/** A PNG's size, read from its header */
function pngSize(file: string): { w: number; h: number } | null {
  const b = fs.readFileSync(file);
  return b.length > 24 && b.toString("ascii", 1, 4) === "PNG" ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null;
}

type GlossaryEntry = { term: string; also?: string[]; means: string; see?: string };
const glossaryOf = (lang: string) => readYaml<GlossaryEntry[]>(path.join(CONTENT, lang, "glossary.yml"), []);
type Words = { words?: Record<string, string[]>; checks?: { search: string; as?: string; first: string }[] };
const wordsOf = (lang: string) => readYaml<Words>(path.join(CONTENT, lang, "words.yml"), {});
const termKey = (term: string) => term.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const escapeTerm = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The first use of each glossary term in an article's text (not headings, labels or links) becomes a term */
function markTerms(art: HelpArticle, glossary: GlossaryEntry[]) {
  for (const g of glossary) {
    if (!g?.term || g.see === art.slug) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(${[g.term, ...(g.also ?? [])].map(escapeTerm).join("|")})(?![\\p{L}\\p{N}])`, "iu");
    let done = false;
    for (const b of art.blocks) {
      if (done) break;
      if (b.t !== "p" && b.t !== "note" && b.t !== "ul" && b.t !== "ol") continue;
      const lists = "c" in b ? [b.c] : b.items;
      for (const list of lists) {
        const at = list.findIndex((i) => i.t === "text" && re.test(i.v));
        if (at < 0) continue;
        const i = list[at] as { t: "text"; v: string };
        const m = re.exec(i.v)!;
        const parts: Inline[] = [];
        if (m.index > 0) parts.push({ t: "text", v: i.v.slice(0, m.index) });
        parts.push({ t: "term", v: m[0], key: termKey(g.term) });
        if (m.index + m[0].length < i.v.length) parts.push({ t: "text", v: i.v.slice(m.index + m[0].length) });
        list.splice(at, 1, ...parts);
        done = true;
        break;
      }
    }
  }
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
    const art: HelpArticle = { slug, title: s("title"), summary: s("summary"), roles: a("roles"), group: s("group"), features: a("features"), checked: s("checked"), order: Number(s("order") || 100), short: a("short"), blocks: b, headings: headingsOf(b), text: plain(b) };
    const words = art.text.split(/\s+/).filter(Boolean).length;
    if (art.short.length > 3) fail(where, "short: at most three lines");
    if (lang === "en" && words > SHORT_OVER && !art.short.length) fail(where, `${words} words: add "short:" (up to three lines) for people in a hurry`);
    for (const x of b) {
      if (x.t !== "shot") continue;
      const sh = shots[x.name];
      if (!sh) { fail(where, `[shot: ${x.name}] isn't in content/help/shots.yml`); continue; }
      x.alt = sh.alt ?? "";
      const file = path.join(SHOTS_DIR, `${x.name}.png`);
      const size = fs.existsSync(file) ? pngSize(file) : null;
      if (!size) fail(where, `[shot: ${x.name}] has no picture yet (take it: node scripts/help-shots.mjs ${x.name})`);
      else { x.w = size.w; x.h = size.h; }
    }
    if (b.some((x) => x.t === "glossary") && !glossaryOf(lang).length && lang === "en") fail(where, `[glossary] needs content/help/${lang}/glossary.yml`);
    if (!art.title) fail(where, "no title");
    if (!art.summary) fail(where, "no summary");
    if (!art.group) fail(where, "no group");
    if (!art.roles.length || art.roles.some((r) => r !== "everyone" && !(ROLES as readonly string[]).includes(r))) fail(where, `roles must be some of ${ROLES.join(", ")}, or everyone`);
    for (const r of art.roles.includes("everyone") ? ROLES : art.roles) {
      const au = audiences.find((x) => x.id === r);
      if (au && art.group && !au.groups.includes(art.group)) fail(where, `group "${art.group}" isn't one of ${r}'s groups in audiences.yml`);
    }
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
    markTerms(art, glossaryOf(lang).length ? glossaryOf(lang) : glossaryOf("en"));
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

// Your steps: each is an article for that audience
const forAudience = (a: HelpArticle, r: string) => a.roles.includes(r) || a.roles.includes("everyone");
for (const au of audiences)
  for (const st of au.steps) {
    const a = byLang.en.find((x) => x.slug === st);
    if (!a) fail("content/help/audiences.yml", `${au.id}: step "${st}" isn't an article`);
    else if (!forAudience(a, au.id)) fail("content/help/audiences.yml", `${au.id}: step "${st}" isn't for ${au.id}`);
  }

// Words we use: each term is used in an article (or has its own), and its article exists
const glossaries: Record<string, { key: string; term: string; means: string; see?: string }[]> = {};
for (const l of LANGS) {
  const g = glossaryOf(l);
  if (!g.length) continue;
  const where = `content/help/${l}/glossary.yml`;
  for (const e of g) {
    if (!e?.term || !e.means) { fail(where, "each entry needs term and means"); continue; }
    if (e.see && !slugs.has(e.see)) fail(where, `"${e.term}": see "${e.see}" isn't an article`);
    if (l === "en" && !byLang.en.some((a) => allInline(a.blocks).some((i) => i.t === "term" && i.key === termKey(e.term))) && !(e.see && slugs.has(e.see)))
      fail(where, `"${e.term}" isn't used in any article`);
  }
  glossaries[l] = g.filter((e) => e?.term && e.means).map((e) => ({ key: termKey(e.term), term: e.term, means: e.means, ...(e.see ? { see: e.see } : {}) }))
    .sort((x, y) => x.term.localeCompare(y.term, l));
}

// Shots: each one described is used
const usedShots = new Set(byLang.en.flatMap((a) => a.blocks.flatMap((b) => (b.t === "shot" ? [b.name] : []))));
for (const name of Object.keys(shots)) if (!usedShots.has(name)) fail("content/help/shots.yml", `"${name}" isn't used in any article`);

// Words people search with: each target is a word the articles use, and the search examples find the right article first
const words: Record<string, Record<string, string[]>> = {};
for (const l of LANGS) {
  const w = wordsOf(l);
  if (!w.words) continue;
  const where = `content/help/${l}/words.yml`;
  const map: Record<string, string[]> = {};
  for (const [k, targets] of Object.entries(w.words)) map[k.toLowerCase()] = (targets ?? []).map((t) => String(t).toLowerCase());
  if (l === "en") {
    const all = byLang.en.map((a) => `${a.title} ${a.summary} ${a.short.join(" ")} ${a.text}`.toLowerCase()).join(" ");
    for (const [k, targets] of Object.entries(map)) for (const t of targets) if (!all.includes(t)) fail(where, `"${k}" → "${t}": no article uses "${t}"`);
    for (const c of w.checks ?? []) {
      const got = searchHelp(byLang.en, c.search, { audience: c.as ?? null, words: map });
      if (got[0]?.slug !== c.first) fail(where, `searching "${c.search}"${c.as ? ` as ${c.as}` : ""} should find "${c.first}" first, found ${got.slice(0, 3).map((x) => x.slug).join(", ") || "nothing"}`);
    }
  }
  words[l] = map;
}

// Help links in the app must find their article
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(tsx?|jsx?)$/.test(e.name) ? [path.join(d, e.name)] : []));
for (const f of walk(path.join(ROOT, "src"))) {
  if (f === OUT) continue;
  const code = fs.readFileSync(f, "utf8");
  for (const m of code.matchAll(/(?:<HelpLink\b[^>]*\bslug|helpSlug)\s*[=:]\s*["']([a-z0-9-]+)["']/g))
    if (!slugs.has(m[1])) fail(path.relative(ROOT, f), `help link to a missing article "${m[1]}"`);
  // A shared page's article per audience: <HelpLink slug="resumes" forAudience={{ member: "member-resumes" }} />
  for (const m of code.matchAll(/<HelpLink\b[^>]*\bforAudience=\{\{([^}]*)\}\}/g))
    for (const [, role, slug] of m[1].matchAll(/([a-z]+)\s*:\s*["']([a-z0-9-]+)["']/g)) {
      if (!slugs.has(slug)) fail(path.relative(ROOT, f), `help link to a missing article "${slug}"`);
      else if (!forAudience(byLang.en.find((a) => a.slug === slug)!, role)) fail(path.relative(ROOT, f), `help link for ${role} opens "${slug}", which isn't for ${role}`);
    }
}

const generated =
  "// Generated by scripts/help-build.ts from content/help: don't edit by hand (run: npx tsx scripts/help-build.ts)\n" +
  'import type { HelpArticle, HelpAudience, HelpGlossaryEntry } from "./types";\n\n' +
  `export const HELP_ARTICLES: Record<string, HelpArticle[]> = ${JSON.stringify(byLang)};\n\n` +
  `export const HELP_AUDIENCES: HelpAudience[] = ${JSON.stringify(audiences)};\n\n` +
  `export const HELP_GLOSSARY: Record<string, HelpGlossaryEntry[]> = ${JSON.stringify(glossaries)};\n\n` +
  `export const HELP_WORDS: Record<string, Record<string, string[]>> = ${JSON.stringify(words)};\n`;

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
  if (args.includes("--public") && pub) writePublic(path.resolve(pub));
}

/**
 * The public site (edulexa.com/help, plan item 10), in English:
 *   - src/content/help.json: { articles, audiences (groups and "Your steps"), glossary ("Words we use"), words (search) };
 *   - public/help/shots: the pictures the articles show (and no others);
 *   - src/lib/help: this app's types.ts, search.ts and logic.ts, copied so search, groups, steps and "Next step" work the
 *     same on both (the site's own files, not kept in two versions).
 */
function writePublic(site: string) {
  const target = path.join(site, "src", "content", "help.json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const data = { articles: byLang.en, audiences, glossary: glossaries.en ?? [], words: words.en ?? {} };
  fs.writeFileSync(target, JSON.stringify(data, null, 1) + "\n");
  const shotsDir = path.join(site, "public", "help", "shots");
  fs.mkdirSync(shotsDir, { recursive: true });
  for (const name of usedShots) fs.copyFileSync(path.join(SHOTS_DIR, `${name}.png`), path.join(shotsDir, `${name}.png`));
  for (const f of fs.readdirSync(shotsDir)) if (f.endsWith(".png") && !usedShots.has(f.slice(0, -4))) fs.rmSync(path.join(shotsDir, f));
  const libDir = path.join(site, "src", "lib", "help");
  fs.mkdirSync(libDir, { recursive: true });
  for (const f of ["types.ts", "search.ts", "logic.ts"]) {
    const src = fs.readFileSync(path.join(ROOT, "src", "lib", "help", f), "utf8").replace(/\r\n/g, "\n");
    fs.writeFileSync(path.join(libDir, f), `// Copied from the Edulexa web app (frontend/src/lib/help/${f}) by its scripts/help-build.ts --public: edit it there.\n${src}`);
  }
  console.log(`Public site: ${target} (${byLang.en.length} guides), ${usedShots.size} pictures in ${shotsDir}, search and steps in ${libDir}`);
}
