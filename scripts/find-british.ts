/**
 * Lists the app's own text with British/Indian spelling that doesn't go through en() (so US readers would see it as
 * written): JSX text, and strings in JSX attributes and code, outside en(), inEnglish() and toAmerican(). Web addresses,
 * imports, object keys, class names, comparisons, translation keys (t("...")) and lists checked with .includes() aren't
 * text people read, so they're skipped. A line marked "// en() where shown" (or the line above it) holds text that is
 * converted where it's displayed; "// not text" marks a value (a status code, a key) that must stay as it is.
 * Run: npx tsx scripts/find-british.ts [paths...]   (default: src). Exits 1 when it finds any (for CI on finished areas).
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { toAmerican } from "../src/lib/english";

const roots = process.argv.slice(2).length ? process.argv.slice(2) : ["src"];
const WRAPPERS = new Set(["en", "inEnglish", "toAmerican", "t", "tr"]);
const MARKS = /en\(\) where shown|not text/;
const NOT_TEXT_ATTRS = new Set(["className", "href", "src", "id", "key", "htmlFor", "type", "name", "value", "role", "rel", "target", "method", "action", "accept", "autoComplete", "inputMode", "style"]);

function files(p: string): string[] {
  const s = fs.statSync(p);
  if (s.isFile()) return /\.(tsx?|mts)$/.test(p) && !p.endsWith(".d.ts") ? [p] : [];
  return fs.readdirSync(p).flatMap((f) => (f === "node_modules" || f.startsWith(".") ? [] : files(path.join(p, f))));
}

function wrapped(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
      if (WRAPPERS.has(name)) return true;
    }
    if (ts.isJsxElement(n) || ts.isFunctionLike(n) || ts.isSourceFile(n)) return false;
  }
  return false;
}

function skipped(node: ts.Node): boolean {
  const p = node.parent;
  if (!p) return true;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true;
  if (ts.isPropertyAssignment(p) && p.name === node) return true; // an object key
  if (ts.isLiteralTypeNode(p) || ts.isTypeNode(p)) return true;
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(p.operatorToken.kind)) return true;
  if (ts.isCaseClause(p) || ts.isElementAccessExpression(p)) return true;
  // ["Declined", "Cancelled"].includes(status): values, not text
  if (ts.isArrayLiteralExpression(p) && p.parent && ts.isPropertyAccessExpression(p.parent) && ["includes", "indexOf"].includes(p.parent.name.text)) return true;
  if (ts.isJsxAttribute(p) && NOT_TEXT_ATTRS.has(p.name.getText())) return true;
  if (ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent) && NOT_TEXT_ATTRS.has(p.parent.name.getText())) return true;
  return false;
}

let found = 0;
// Development-only screens (sign-in shortcuts with the development tokens)
const DEV_ONLY = /devSession\.ts$|DevShortcuts\.tsx$/;

for (const file of roots.flatMap(files).filter((f) => !DEV_ONLY.test(f.split("\\").join("/")))) {
  const code = fs.readFileSync(file, "utf8");
  const lines = code.split(/\r?\n/);
  const src = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node: ts.Node) => {
    let text: string | null = null;
    if (ts.isJsxText(node)) text = node.text;
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text;
    if (text && text.trim() && !/^\/|^https?:/.test(text.trim()) && toAmerican(text) !== text && !skipped(ts.isTemplateLiteralToken(node) ? node.parent : node) && !wrapped(node)) {
      const { line } = src.getLineAndCharacterOfPosition(node.getStart());
      if (MARKS.test(lines[line] ?? "") || MARKS.test(lines[line - 1] ?? "")) {
        ts.forEachChild(node, visit);
        return;
      }
      console.log(`${file}:${line + 1}: ${text.trim().slice(0, 110)}`);
      found++;
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}
console.log(found ? `\n${found} unconverted` : "none");
process.exit(found ? 1 : 0);
