/**
 * S4 help center: drafts Spanish, Hindi and Arabic versions of the help articles (content/help/en -> content/help/es|hi|ar)
 * with OpenAI, like scripts/translate.ts does for the screens. Each draft has "reviewed: false" and isn't shown until a
 * native speaker reviews it and sets "reviewed: true" (the A2 rule). A label the article names ([ui: Save decision]) becomes
 * the app's own translation of that label, so the article names what the reader sees; link targets and code stay as they are.
 * Only articles a language doesn't have yet are drafted. Needs OPENAI_API_KEY.
 * Run: npx tsx scripts/help-translate.ts [es|hi|ar ...]
 */
import fs from "node:fs";
import path from "node:path";

const LANGS: Record<string, string> = {
  es: "Spanish: neutral Latin American Spanish that reads naturally in Spain too; address the reader as \"tú\"",
  hi: "Hindi in Devanagari: everyday modern Hindi as used in good Indian apps; keep in Latin letters only true technical terms Indians use in English (email, login, PDF, CSV, AI, LMS, GitHub)",
  ar: "Arabic: Modern Standard Arabic, clear and friendly; Western digits (0-9)",
};
const KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.TRANSLATE_MODEL || "gpt-6-luna";
const ROOT = process.cwd();
const EN = path.join(ROOT, "content", "help", "en");

function flat(o: unknown, prefix: string, out: Map<string, string>) {
  if (typeof o === "string") out.set(prefix, o);
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) flat(v, prefix ? `${prefix}.${k}` : k, out);
}
/** The app's own translation of an English label (the flat app texts are keyed by their English; career texts by key) */
function labelTranslator(lang: string) {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, "messages", "app", `${lang}.json`), "utf8")) as Record<string, string>;
  const careerEn = new Map<string, string>(), careerLang = new Map<string, string>();
  flat(JSON.parse(fs.readFileSync(path.join(ROOT, "messages", "career", "en.json"), "utf8")), "", careerEn);
  const cl = path.join(ROOT, "messages", "career", `${lang}.json`);
  if (fs.existsSync(cl)) flat(JSON.parse(fs.readFileSync(cl, "utf8")), "", careerLang);
  const byEnglish = new Map<string, string>();
  for (const [k, v] of careerEn) if (careerLang.has(k)) byEnglish.set(v.trim(), careerLang.get(k)!);
  return (label: string) => app[label] ?? byEnglish.get(label) ?? label;
}

async function translate(lang: string, text: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            `You translate help articles for Edulexa, a web app for schools and colleges, into ${LANGS[lang]}. ` +
            "Keep the Markdown exactly: headings (##), lists, **bold**, `code`, and links [text](target): translate the link text, never the target. " +
            "Keep every token like ⟦1⟧ exactly where it belongs in the sentence (they are button names filled in later). " +
            "Keep names (Edulexa, GitHub, Canvas, Moodle, Blackboard, LTI, CSV, PDF, Word, PowerPoint, UPI), e-mail addresses and numbers as written. " +
            "Translate plainly and naturally, as short as the English. Reply with the translated text only.",
        },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (body.choices?.[0]?.message?.content ?? "").trim();
}

async function main() {
  if (!KEY) throw new Error("Set OPENAI_API_KEY.");
  const langs = process.argv.slice(2).filter((a) => a in LANGS);
  for (const lang of langs.length ? langs : Object.keys(LANGS)) {
    const label = labelTranslator(lang);
    const outDir = path.join(ROOT, "content", "help", lang);
    fs.mkdirSync(outDir, { recursive: true });
    for (const file of fs.readdirSync(EN).filter((f) => f.endsWith(".md"))) {
      const target = path.join(outDir, file);
      if (fs.existsSync(target)) continue;
      const src = fs.readFileSync(path.join(EN, file), "utf8").replace(/\r\n/g, "\n");
      const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(src)!;
      const meta = Object.fromEntries(m[1].split("\n").map((l) => { const i = l.indexOf(":"); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
      // Button names out, as tokens; the app's own translation goes back in
      const labels: string[] = [];
      const protect = (s: string) => s.replace(/\[ui:\s*([^\]]+)\]/g, (_, l: string) => { labels.push(l.trim()); return `⟦${labels.length}⟧`; });
      const text = `TITLE: ${meta.title}\nSUMMARY: ${meta.summary}\nGROUP: ${meta.group}\n---\n${protect(m[2])}`;
      const out = await translate(lang, text);
      const restore = (s: string) => s.replace(/⟦(\d+)⟧/g, (_, n: string) => `[ui: ${label(labels[Number(n) - 1] ?? "")}]`);
      const t = /TITLE:\s*(.*)\n\s*SUMMARY:\s*(.*)\n\s*GROUP:\s*(.*)\n---\n([\s\S]*)$/.exec(restore(out));
      if (!t) { console.warn(`${lang}/${file}: the answer wasn't in the expected shape; skipped`); continue; }
      const front = [
        "---",
        `title: ${t[1].trim()}`,
        `summary: ${t[2].trim()}`,
        `roles: ${meta.roles}`,
        `group: ${t[3].trim()}`,
        `features: ${meta.features}`,
        `checked: ${meta.checked}`,
        "reviewed: false",
        "---",
      ].join("\n");
      fs.writeFileSync(target, `${front}\n${t[4].trim()}\n`);
      console.log(`${lang}/${file}`);
    }
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
