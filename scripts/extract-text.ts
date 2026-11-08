/**
 * The app's texts to translate (plan item A2): every text given to en() in src, and the labels kept in lists and shown
 * through en() (values of label, title, text... keys, and lines marked "en() where shown"). Writes messages/app/en.json
 * (each text to itself, sorted) and reports, per language, the texts it doesn't have yet and the ones no longer used.
 * Run: npx tsx scripts/extract-text.ts [--check]   (--check: exit 1 when a language file is missing texts; for CI once
 * a language is live)
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const SKIP = [/^src[\\/]app[\\/]admin[\\/]/, /^src[\\/]components[\\/]admin[\\/]/, /^src[\\/]components[\\/]guidance[\\/]form[\\/]/, /^src[\\/]app[\\/]embed[\\/]/];
const LABEL_KEYS = new Set(["label", "title", "text", "description", "message", "error", "placeholder", "hint", "help", "summary", "heading", "subtitle", "caption", "note", "empty", "tooltip", "name", "action", "group", "desc", "sub", "short"]);
const visible = (s: string) => /[A-Za-z]{2,}/.test(s) && /\s|^[A-Z]/.test(s.trim()) && !/^(https?:|\/|#|mailto:)/.test(s.trim()) && !/^[a-z0-9_.:/#-]+$/.test(s.trim());

function files(p: string): string[] {
  const s = fs.statSync(p);
  if (s.isFile()) return /\.tsx?$/.test(p) && !p.endsWith(".d.ts") ? [p] : [];
  return fs.readdirSync(p).flatMap((f) => (f === "node_modules" ? [] : files(path.join(p, f))));
}

const texts = new Set<string>();
for (const file of files("src").filter((f) => !SKIP.some((r) => r.test(f)))) {
  const code = fs.readFileSync(file, "utf8");
  const lines = code.split(/\r?\n/);
  const src = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const literal = (n: ts.Node | undefined) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null);
  const usesEn = /\ben\(/.test(code);
  const visit = (node: ts.Node) => {
    // en("text") and en("text {n}", { n })
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "en") {
      const t = literal(node.arguments[0]);
      if (t && t.trim()) texts.add(t);
    }
    if (usesEn) {
      // Labels in lists shown through en(): { label: "..." } values, and marked lines
      if (ts.isPropertyAssignment(node) && LABEL_KEYS.has(node.name.getText().replace(/["']/g, ""))) {
        const t = literal(node.initializer);
        if (t && visible(t)) texts.add(t);
      }
      if (ts.isStringLiteral(node)) {
        const line = src.getLineAndCharacterOfPosition(node.getStart()).line;
        if ((/en\(\) where shown/.test(lines[line] ?? "") || /en\(\) where shown/.test(lines[line - 1] ?? "")) && visible(node.text)) texts.add(node.text);
        // Items of a list (["Leads", ...], [["leads", "Leads"], ...]) shown through en(); not lists of classes, keys or values
        else if (ts.isArrayLiteralExpression(node.parent) && visible(node.text) && !/^(bg|text|border|rounded|flex|grid|px|py|p|m|h|w|ring|shadow)-/.test(node.text.trim()) && !/not text/.test(lines[line] ?? "") && !/not text/.test(lines[line - 1] ?? ""))
          texts.add(node.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}

const sorted = [...texts].sort((a, b) => a.localeCompare(b, "en"));
const source = Object.fromEntries(sorted.map((t) => [t, t]));
fs.writeFileSync("messages/app/en.json", JSON.stringify(source, null, 1) + "\n");
console.log(`${sorted.length} texts (${sorted.reduce((n, t) => n + t.split(/\s+/).length, 0)} words) in messages/app/en.json`);

let missingAny = false;
for (const lang of ["es", "hi", "ar"]) {
  const file = `messages/app/${lang}.json`;
  const have: Record<string, string> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const missing = sorted.filter((t) => !have[t]);
  const unused = Object.keys(have).filter((t) => !texts.has(t));
  if (missing.length) missingAny = true;
  console.log(`${lang}: ${sorted.length - missing.length} translated, ${missing.length} missing, ${unused.length} no longer used`);
}
if (process.argv.includes("--check") && missingAny) process.exit(1);
