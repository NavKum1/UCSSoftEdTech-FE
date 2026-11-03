/**
 * Drafts translations of the app's texts (plan item A2) with Google Gemini (the provider Edulexa already uses for its
 * copilot): messages/app/en.json (flat, run scripts/extract-text.ts first) and messages/career/en.json (nested) into
 * Spanish, Hindi and Arabic. Only texts a language file doesn't have yet are sent, so it's cheap to run again after new
 * text is added. Drafts stay off for people until a native speaker has reviewed them (lib/i18n/languages).
 *
 * Needs GEMINI_API_KEY (Google AI Studio); usage is billed to that project. TRANSLATE_MODEL changes the model.
 * Run: npx tsx scripts/translate.ts [es|hi|ar ...] [--app|--career] [--limit=N]
 */
import fs from "node:fs";

type Nested = { [key: string]: string | Nested };
const LANGUAGES = {
  es: "Spanish: neutral Latin American Spanish that reads naturally in Spain too; address the reader as \"tú\"",
  hi: "Hindi in Devanagari: everyday modern Hindi as used in Indian apps; keep common English technical words people use as they are (e.g. email, CRM, login, dashboard), written in Latin letters",
  ar: "Arabic: Modern Standard Arabic, clear and friendly; Western digits (0-9)",
} as const;
type Lang = keyof typeof LANGUAGES;

const args = process.argv.slice(2);
const chosen = args.filter((a): a is Lang => a in LANGUAGES);
const langs: Lang[] = chosen.length ? chosen : (Object.keys(LANGUAGES) as Lang[]);
const only = args.includes("--app") ? "app" : args.includes("--career") ? "career" : null;
const limit = Number(args.find((a) => a.startsWith("--limit="))?.slice(8) ?? Infinity);
const BATCH = 80;
const PARALLEL = 4;
const MODEL = process.env.TRANSLATE_MODEL || "gemini-pro-latest";
const KEY = process.env.GEMINI_API_KEY;

const SYSTEM = `You translate the user interface of Edulexa, a web app for schools, colleges and career services (admissions CRM, guidance forms and reports, career centre, interview practice). The readers are students, parents and school staff.

Rules for every text:
- Translate the meaning naturally, the way a careful native product writer would; keep it as short and plain as the English.
- Keep exactly as written: anything in braces ({name}, {count}, {institute}), ICU message syntax ({count, plural, one {...} other {...}}: translate only the words inside the branches, keep "#", keyword names and braces), HTML-like tags (<link>...</link>, <b>...</b>), web addresses, e-mail addresses, numbers, and these names: Edulexa, Pulse Relay, Stripe, Razorpay, Keycloak, Google, Microsoft, LinkedIn, GitHub, WhatsApp, Zoom, Canvas, Moodle, Blackboard, LTI, NIRF, NAAC, NBA, WIOA, CIRR, FERPA, GDPR, SAT, ACT, GRE, IELTS, TOEFL.
- Keep leading and trailing spaces and punctuation as in the English: many texts are pieces of a sentence shown next to a value (" · by ", "Due ").
- Some texts are single words used as labels or buttons; translate them as a label or button would read in the app.
- British and American spellings mean the same thing.
Reply with every id you were given, each with its translation.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { id: { type: "INTEGER" }, text: { type: "STRING" } }, required: ["id", "text"] },
    },
  },
  required: ["items"],
};

/** The names in braces a translation must keep: {name}, and ICU arguments ({count, plural, ...}) */
const tokens = (s: string) => [...s.matchAll(/\{\s*([A-Za-z_][\w]*)/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<\/?([a-zA-Z][\w-]*)>/g)].map((m) => m[0]).sort();
const keeps = (en: string, out: string) => JSON.stringify(tokens(en)) === JSON.stringify(tokens(out)) && JSON.stringify(tags(en)) === JSON.stringify(tags(out));
/** The English's leading and trailing whitespace, on the translation */
const sameEdges = (en: string, out: string) => /^\s*/.exec(en)![0] + out.trim() + /\s*$/.exec(en)![0];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Fatal extends Error {}

async function gemini(prompt: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, maxOutputTokens: 32768 },
      }),
    }).catch((e: unknown) => ({ ok: false, status: 0, text: async () => String(e) }) as const);
    if (res.ok) {
      const body = (await (res as Response).json()) as { candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[] };
      const c = body.candidates?.[0];
      if (!c) throw new Error("no answer (blocked?)");
      if (c.finishReason && c.finishReason !== "STOP") throw new Error(`stopped: ${c.finishReason}`);
      return (c.content?.parts ?? []).map((p) => p.text ?? "").join("");
    }
    const detail = (await res.text()).slice(0, 300);
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) throw new Fatal(`Gemini answered ${res.status}: ${detail}`);
    // Busy, rate-limited or a network error: wait and try again (up to ~4 minutes)
    if (attempt >= 7) throw new Error(`Gemini answered ${res.status} after ${attempt + 1} tries: ${detail}`);
    await sleep(Math.min(60_000, 2_000 * 2 ** attempt));
  }
}

async function translateBatch(lang: Lang, texts: string[]): Promise<(string | null)[]> {
  const list = texts.map((text, id) => ({ id, text }));
  const answer = await gemini(`Translate into ${LANGUAGES[lang]}.\n\n${JSON.stringify(list, null, 1)}`);
  const parsed = JSON.parse(answer) as { items?: { id: number; text: string }[] };
  const out: (string | null)[] = texts.map(() => null);
  for (const item of parsed.items ?? []) {
    const en = texts[item.id];
    if (en === undefined || typeof item.text !== "string" || !item.text.trim()) continue;
    out[item.id] = keeps(en, item.text) ? sameEdges(en, item.text) : null;
  }
  return out;
}

async function translateAll(lang: Lang, texts: string[], save: (done: Record<string, string>) => void) {
  const todo = texts.slice(0, limit);
  const batches: string[][] = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
  let done = 0, failed = 0, next = 0;
  // A few batches at a time; each one is saved as soon as it's back, so a stopped run keeps its work
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      try {
        const result = await translateBatch(lang, batch);
        const got: Record<string, string> = {};
        batch.forEach((en, k) => (result[k] != null ? (got[en] = result[k]!) : failed++));
        done += Object.keys(got).length;
        save(got);
      } catch (e) {
        if (e instanceof Fatal) throw e;
        // Tried again on the next run; the rest carry on
        failed += batch.length;
        console.log(`  ${lang}: a batch wasn't translated: ${e instanceof Error ? e.message : e}`);
      }
      console.log(`  ${lang}: ${done}/${todo.length}${failed ? ` (${failed} to retry on the next run)` : ""}`);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
}

// ------------------------------------------------------------------ catalogs

const flatten = (o: Nested, prefix = ""): Record<string, string> =>
  Object.fromEntries(Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[prefix + k, v]] : Object.entries(flatten(v, `${prefix}${k}.`)))));
function setPath(o: Nested, dotted: string, value: string) {
  const parts = dotted.split(".");
  let at: Nested = o;
  for (const p of parts.slice(0, -1)) at = (at[p] ??= {}) as Nested;
  at[parts[parts.length - 1]] = value;
}
const read = <T>(file: string, empty: T): T => (fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : empty);

async function main() {
  if (!KEY) throw new Fatal("Set GEMINI_API_KEY (a Google AI Studio key) first.");
  for (const lang of langs) {
    if (only !== "career") {
      const source = Object.keys(read<Record<string, string>>("messages/app/en.json", {}));
      const file = `messages/app/${lang}.json`;
      const have = read<Record<string, string>>(file, {});
      const missing = source.filter((t) => !have[t]);
      console.log(`${lang} app texts: ${missing.length} to translate (${MODEL})`);
      await translateAll(lang, missing, (got) => {
        Object.assign(have, got);
        fs.writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(have).sort(([a], [b]) => a.localeCompare(b, "en"))), null, 1) + "\n");
      });
    }
    if (only !== "app") {
      const source = flatten(read<Nested>("messages/career/en.json", {}));
      const file = `messages/career/${lang}.json`;
      const have = read<Nested>(file, {});
      const haveFlat = flatten(have);
      const keys = Object.keys(source).filter((k) => !haveFlat[k]);
      // Texts that repeat are sent once
      const byText = new Map<string, string[]>();
      for (const k of keys) byText.set(source[k], [...(byText.get(source[k]) ?? []), k]);
      console.log(`${lang} career messages: ${keys.length} to translate (${byText.size} different texts)`);
      await translateAll(lang, [...byText.keys()], (got) => {
        for (const [en, out] of Object.entries(got)) for (const k of byText.get(en) ?? []) setPath(have, k, out);
        fs.writeFileSync(file, JSON.stringify(have, null, 1) + "\n");
      });
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
