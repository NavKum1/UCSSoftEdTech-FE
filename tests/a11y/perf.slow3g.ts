/**
 * G10 performance budget check (docs/career_suite_mobile.md). Not part of the a11y run (file name has no .spec).
 * Run against a production server (`next build --webpack && next start`) with:
 *   PERF_BASE=http://localhost:3200 PERF_OUT=perf.json npx playwright test -c tests/a11y/playwright.config.ts tests/a11y/perf.slow3g.ts
 * with A11Y_EXTERNAL_SERVER=1 and testMatch overridden by the explicit file (see the doc).
 */
import fs from "node:fs";
import { test } from "@playwright/test";
import { prepare } from "./harness";

const BASE = process.env.PERF_BASE || "http://localhost:3200";
const PAGES = [
  { name: "student-home", path: "/student" },
  { name: "student-appointments", path: "/student/appointments" },
  { name: "student-notifications", path: "/student/notifications" },
];
// Chrome DevTools "Slow 3G": 400 kbit/s down and up, 2000 ms latency (Lighthouse uses the same idea)
const SLOW_3G = { offline: false, latency: 2000, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 };

const results: Record<string, unknown>[] = [];

for (const pg of PAGES) {
  for (const saver of [false, true]) {
    test(`${pg.name}${saver ? " data-saver" : ""}`, async ({ page, context }) => {
      test.setTimeout(240_000);
      await prepare(page, "student");
      await context.addCookies([{ name: "career_partner", value: "1", url: BASE }]);
      if (saver) await page.addInitScript(() => window.localStorage.setItem("career.dataSaver", "on"));
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Network.emulateNetworkConditions", SLOW_3G);
      const bytes = { js: 0, css: 0, font: 0, img: 0, doc: 0, other: 0, requests: 0 };
      const types = new Map<string, string>();
      cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
      cdp.on("Network.loadingFinished", (e) => {
        const ty = types.get(e.requestId) ?? "Other";
        const k = ty === "Script" ? "js" : ty === "Stylesheet" ? "css" : ty === "Font" ? "font" : ty === "Image" ? "img" : ty === "Document" ? "doc" : "other";
        bytes[k] += e.encodedDataLength;
        bytes.requests++;
      });
      const t0 = Date.now();
      await page.goto(BASE + pg.path, { waitUntil: "domcontentloaded", timeout: 200_000 });
      const dcl = Date.now() - t0;
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 200_000 });
      const h1 = Date.now() - t0;
      await page.waitForLoadState("load", { timeout: 200_000 });
      const load = Date.now() - t0;
      await page.waitForLoadState("networkidle", { timeout: 200_000 }).catch(() => {});
      const idle = Date.now() - t0;
      const r = { page: pg.name, saver, dclMs: dcl, headingMs: h1, loadMs: load, idleMs: idle, kb: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, k === "requests" ? v : Math.round(v / 1024)])) };
      results.push(r);
      console.log(JSON.stringify(r));
      if (process.env.PERF_OUT) fs.writeFileSync(process.env.PERF_OUT, JSON.stringify(results, null, 2));
    });
  }
}
