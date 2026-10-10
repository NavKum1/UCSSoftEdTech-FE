import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { allRoutes } from "./fixtures";
import { devOverlayError, prepare, settle } from "./harness";

/** WCAG 2.0 and 2.1, levels A and AA: these fail the run. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
/** Reported but not failing: landmarks, heading order, WCAG 2.2 target size. */
const ADVISORY_TAGS = ["best-practice", "wcag22aa"];

const RESULTS_DIR = path.resolve(__dirname, "../../test-results/a11y-results");
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const only = process.env.A11Y_ROUTES?.split(",").map((s) => s.trim()).filter(Boolean);
const routes = only ? allRoutes.filter((r) => only.includes(r.name)) : allRoutes;

const variants = [
  { theme: "light" as const, width: 1280, height: 900 },
  { theme: "dark" as const, width: 1280, height: 900 },
  { theme: "light" as const, width: 375, height: 812 },
  { theme: "dark" as const, width: 375, height: 812 },
];

type Node = { target: unknown; failureSummary?: string; html: string };
type Violation = { id: string; impact?: string | null; help: string; helpUrl: string; tags: string[]; nodes: Node[] };

function compact(v: Violation[]) {
  return v.map((x) => ({
    id: x.id,
    impact: x.impact,
    help: x.help,
    nodes: x.nodes.slice(0, 8).map((n) => ({ target: n.target, html: n.html.slice(0, 220), summary: n.failureSummary?.slice(0, 400) })),
    count: x.nodes.length,
  }));
}

for (const route of routes) {
  test.describe(route.name, () => {
    for (const v of variants) {
      test(`${v.theme} ${v.width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: v.width, height: v.height });
        await page.emulateMedia({ colorScheme: v.theme, reducedMotion: "reduce" });
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const log = await prepare(page, route.persona);
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        await settle(page, route.ready);

        const overlay = await devOverlayError(page);
        const theme = await page.evaluate(() => (document.documentElement.classList.contains("dark") ? "dark" : "light"));

        const wcag = await new AxeBuilder({ page }).withTags(WCAG_TAGS).exclude("nextjs-portal").analyze();
        const advisory = await new AxeBuilder({ page }).withTags(ADVISORY_TAGS).exclude("nextjs-portal").analyze();

        // 1.4.10 Reflow: no page-level horizontal scrolling at narrow widths (wide data tables scroll inside their own region)
        let overflow: number | null = null;
        if (v.width <= 375) {
          await page.setViewportSize({ width: 320, height: 800 });
          await page.waitForTimeout(200);
          overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        }

        const record = {
          route: route.name,
          path: route.path,
          theme: v.theme,
          appliedTheme: theme,
          width: v.width,
          violations: compact(wcag.violations as Violation[]),
          advisory: compact(advisory.violations as Violation[]),
          incomplete: (wcag.incomplete as Violation[]).map((x) => ({ id: x.id, count: x.nodes.length })),
          reflowOverflowPx: overflow,
          pageErrors: errors,
          devOverlay: overlay,
          missingFixtures: Array.from(new Set(log.missing)),
        };
        fs.writeFileSync(path.join(RESULTS_DIR, `${route.name}__${v.theme}_${v.width}.json`), JSON.stringify(record, null, 2));
        await testInfo.attach("axe", { body: JSON.stringify(record, null, 2), contentType: "application/json" });

        expect(theme, "colour scheme applied").toBe(v.theme);
        expect(overlay, "page rendered without a runtime error").toBeNull();
        expect(record.violations.map((x) => `${x.id} (${x.count}): ${x.help}`), "WCAG 2.1 A/AA violations").toEqual([]);
        if (overflow !== null) expect(overflow, "horizontal scroll at 320px").toBeLessThanOrEqual(1);
      });
    }
  });
}
