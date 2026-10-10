// Aggregates test-results/a11y-results/*.json into a short summary (run automatically by run.mjs).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../test-results/a11y-results");
if (!fs.existsSync(dir)) process.exit(0);
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "summary.json");
const byRule = {};
const advisory = {};
const reflow = [];
const crashes = [];
const missing = new Set();
const routes = new Set();
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  routes.add(r.route);
  for (const v of r.violations) (byRule[v.id] ??= []).push(`${r.route} ${r.theme} ${r.width}px (${v.count})`);
  for (const v of r.advisory) (advisory[v.id] ??= new Set()).add(r.route);
  if (r.reflowOverflowPx > 1) reflow.push(`${r.route} ${r.theme} +${r.reflowOverflowPx}px`);
  if (r.devOverlay || r.pageErrors?.length) crashes.push(`${r.route} ${r.theme} ${r.width}px: ${r.devOverlay ?? ""} ${r.pageErrors?.join(" | ") ?? ""}`.slice(0, 300));
  for (const m of r.missingFixtures ?? []) missing.add(`${r.route}: ${m}`);
}
const summary = {
  scans: files.length,
  routes: routes.size,
  wcagViolations: Object.fromEntries(Object.entries(byRule).map(([k, v]) => [k, v])),
  advisory: Object.fromEntries(Object.entries(advisory).map(([k, v]) => [k, [...v]])),
  reflow,
  crashes,
  missingFixtures: [...missing],
};
fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(`\na11y summary: ${files.length} scans over ${routes.size} routes`);
console.log(`  WCAG A/AA rules failing: ${Object.keys(byRule).length ? Object.entries(byRule).map(([k, v]) => `${k} x${v.length}`).join(", ") : "none"}`);
console.log(`  advisory (best practice / WCAG 2.2): ${Object.keys(advisory).length ? Object.entries(advisory).map(([k, v]) => `${k} on ${v.size} routes`).join(", ") : "none"}`);
console.log(`  reflow problems at 320px: ${reflow.length}`);
console.log(`  page errors: ${crashes.length}; missing fixtures: ${missing.size}`);
console.log(`  details: ${path.join(dir, "summary.json")}`);
