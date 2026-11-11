/**
 * S4b help center (docs/s4b_help_center_for_everyone_plan.md, item 8): takes the screenshots the help articles show with
 * [shot: name], as described in content/help/shots.yml. It signs in to a local copy of the app as a demo-school person (the
 * developer sign-in: the API must run in Development, as scripts/dev.ps1 starts it), opens the page, clicks what is listed,
 * rings the thing to point at, and saves the part of the screen as public/help/shots/<name>.png (desktop, light theme,
 * English, compressed). Retake them all before each release (the release checklist), so they never show an old screen.
 * Run: node scripts/help-shots.mjs [name ...] [--base http://localhost:3000] [--public <public site folder>]
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const { chromium } = require("playwright");
const sharp = require("sharp");

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public", "help", "shots");
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const BASE = opt("--base", "http://localhost:3000").replace(/\/$/, "");
const PUBLIC = opt("--public", null);
const only = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const MAX_HEIGHT = 1000; // css pixels: a picture shows one part of a screen, not a whole long page
const MAX_WIDTH = 1600; // image pixels

// The demo people (src/lib/devSession.ts DEV_PERSONAS): the token says who; school people work at the demo school
const SCHOOL = "5c400100-0000-4000-8000-000000000001";
const PEOPLE = {
  "school-admin-dev-token": { role: "CareerAdmin", label: "Career center admin", userId: "5c400100-0000-4000-8000-000000000011", school: true },
  "school-counselor-dev-token": { role: "CareerCounselor", label: "Career counselor", userId: "5c400100-0000-4000-8000-000000000012", school: true },
  "employer-relations-dev-token": { role: "EmployerRelations", label: "Employer relations", userId: "5c400100-0000-4000-8000-000000000013", school: true },
  "school-faculty-dev-token": { role: "Faculty", label: "Faculty", userId: "5c400100-0000-4000-8000-000000000014", school: true },
  "school-student-dev-token": { role: "Student", label: "Student", userId: "5c400100-0000-4000-8000-000000000015", school: true },
  "school-alumni-dev-token": { role: "Alumni", label: "Alumni", userId: "5c400100-0000-4000-8000-000000000016", school: true },
  "employer-dev-token": { role: "Employer", label: "Employer", userId: "5c400100-0000-4000-8000-000000000017", school: true },
  "recruiter-dev-token": { role: "Recruiter", label: "Recruiter", userId: null, school: false },
  "institute-admin-dev-token": { role: "InstituteAdmin", label: "Institute admin", userId: null, school: false },
  "institute-counsellor-dev-token": { role: "Counselor", label: "Institute counselor", userId: null, school: false },
  "mentor-dev-token": { role: "MentorReviewer", label: "Mentor reviewer", userId: null, school: false },
};

const shots = yaml.load(fs.readFileSync(path.join(ROOT, "content", "help", "shots.yml"), "utf8")) ?? {};
const names = only.length ? only : Object.keys(shots);
for (const n of names) if (!shots[n]) { console.error(`No shot "${n}" in content/help/shots.yml`); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

// US date fields (mm/dd/yyyy, 2:30 PM) on any machine. On Windows, Chromium writes a date field the way the Windows user
// locale does whenever the browser language has the same language code ("en" for any English, so en-IN gives dd-mm-yyyy
// even with --lang=en-US). Filipino has another code and writes dates and times the US way (checked 11 Nov 2026: the
// browser's own words, such as "Choose File" and form messages, stayed English), and the page still gets en-US
// (navigator.language, Intl, the Accept-Language header) from the context's locale. One catch: a month field
// (type="month", only on the platform admin's AI usage card) would show Filipino month names.
const browser = await chromium.launch({ args: ["--lang=fil"] });
let failed = 0;
for (const name of names) {
  const sh = shots[name];
  // A narrower window ("width" in shots.yml) for a form or card, so the picture stays readable in the side panel and on phones
  const ctx = await browser.newContext({ viewport: { width: sh.width ?? 1366, height: 900 }, deviceScaleFactor: 1.5, colorScheme: "light", locale: "en-US" });
  const person = PEOPLE[sh.as];
  await ctx.addInitScript(
    ({ person, token, school }) => {
      try {
        localStorage.setItem("theme", "light");
        localStorage.setItem("edulexa_dev_session", JSON.stringify({ role: person.role, label: person.label, token, userId: person.userId }));
        if (person.school) localStorage.setItem("career.school", school);
        else localStorage.removeItem("career.school");
      } catch { /* no storage */ }
    },
    { person: person ?? { role: "", label: "", userId: null, school: false }, token: sh.as, school: SCHOOL },
  );
  if (sh.as !== "none" && !person) { console.error(`!! ${name}: unknown person "${sh.as}"`); failed++; await ctx.close(); continue; }
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + sh.open, { waitUntil: "networkidle", timeout: 90000 });
    // The development tools' badge isn't part of the app
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    for (const c of sh.click ?? []) {
      await page.locator(c).first().click({ timeout: 15000 });
      await page.waitForLoadState("networkidle").catch(() => undefined);
    }
    await page.waitForTimeout(700);
    const area = page.locator(sh.show ?? "main").first();
    await area.waitFor({ state: "visible", timeout: 15000 });
    if (sh.point) {
      const target = page.locator(sh.point).first();
      await target.waitFor({ state: "visible", timeout: 15000 });
      await target.evaluate((el) => {
        el.style.boxShadow = "0 0 0 3px #ffffff, 0 0 0 6px #0e7490";
        el.style.borderRadius = getComputedStyle(el).borderRadius || "6px";
      });
    }
    // From the top of the page, so a header that stays on screen sits in its own place and covers nothing
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const box = await area.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height }; });
    if (!box.width || !box.height) throw new Error(`"${sh.show ?? "main"}" isn't on the screen`);
    const raw = await page.screenshot({ fullPage: true, clip: { x: box.x, y: box.y, width: Math.min(box.width, sh.width ?? 1366), height: Math.min(box.height, MAX_HEIGHT) } });
    let img = sharp(raw);
    const meta = await img.metadata();
    if ((meta.width ?? 0) > MAX_WIDTH) img = img.resize({ width: MAX_WIDTH });
    const png = await img.png({ compressionLevel: 9, palette: true, quality: 90, effort: 8 }).toBuffer();
    fs.writeFileSync(path.join(OUT, `${name}.png`), png);
    if (PUBLIC) {
      const dir = path.resolve(PUBLIC, "public", "help", "shots");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${name}.png`), png);
    }
    console.log(`ok ${name} (${Math.round(png.length / 1024)} KB)`);
  } catch (e) {
    failed++;
    console.error(`!! ${name}: ${String(e?.message ?? e).split("\n")[0]}`);
    await page.screenshot({ path: path.join(OUT, `..`, `failed-${name}.png`) }).catch(() => undefined);
  }
  await ctx.close();
}
await browser.close();
if (failed) { console.error(`${failed} shot(s) failed (see public/help/failed-*.png; delete them after)`); process.exit(1); }
