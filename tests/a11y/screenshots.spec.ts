import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { allRoutes } from "./fixtures";
import { prepare, settle } from "./harness";

/**
 * Full-page screenshots for layout review (for example right-to-left checks with the "ar-XB" pseudo-locale).
 * Skipped unless A11Y_SHOTS_DIR is set:
 *   A11Y_SHOTS_DIR=/tmp/shots A11Y_ROUTES=student-home,cc-home A11Y_LOCALE=ar-XB npm run test:a11y -- screenshots
 * A11Y_SHOTS_SUFFIX names the files (default: the locale); A11Y_FORCE_DIR=rtl flips the page without a locale,
 * which shows how a page looks before its classes were made direction-neutral.
 */
const dir = process.env.A11Y_SHOTS_DIR;
const only = process.env.A11Y_ROUTES?.split(",").map((s) => s.trim()).filter(Boolean);
const routes = dir ? allRoutes.filter((r) => !only || only.includes(r.name)) : [];
const suffix = process.env.A11Y_SHOTS_SUFFIX || process.env.A11Y_LOCALE || "default";
const widths = (process.env.A11Y_SHOTS_WIDTHS || "1280,375").split(",").map(Number);

for (const route of routes) {
  for (const width of widths) {
    test(`screenshot ${route.name} ${width}px`, async ({ page }) => {
      fs.mkdirSync(dir!, { recursive: true });
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      await prepare(page, route.persona);
      if (process.env.A11Y_FORCE_DIR) {
        const forced = process.env.A11Y_FORCE_DIR;
        await page.addInitScript((d) => {
          document.addEventListener("DOMContentLoaded", () => document.documentElement.setAttribute("dir", d));
        }, forced);
      }
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await settle(page, route.ready);
      await page.screenshot({ path: path.join(dir!, `${route.name}__${suffix}_${width}.png`), fullPage: true });
    });
  }
}
