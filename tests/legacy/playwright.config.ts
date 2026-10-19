import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * H7 smoke test for the older, non-career pages against a REAL API (not fixtures):
 *   npx playwright test -c tests/legacy/playwright.config.ts
 *
 * Needs the API running in Development (dev bearer tokens on), by default on http://localhost:5790; set LEGACY_API_BASE
 * otherwise. The web app is started here with `next dev` pointed at that API, or set LEGACY_WEB_BASE to use a running one.
 */
export const LEGACY_API_BASE = (process.env.LEGACY_API_BASE || "http://localhost:5790").replace(/\/+$/, "");
const port = Number(process.env.LEGACY_WEB_PORT || 3790);
const baseURL = (process.env.LEGACY_WEB_BASE || `http://localhost:${port}`).replace(/\/+$/, "");

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/,
  outputDir: "../../test-results/legacy",
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: Number(process.env.LEGACY_WORKERS || 2),
  // next dev compiles each route on first visit; one retry absorbs a slow first compile
  retries: 1,
  reporter: [["list"], ["json", { outputFile: "../../test-results/legacy/report.json" }]],
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: process.env.LEGACY_WEB_BASE
    ? undefined
    : {
        command: `npx next dev --webpack -p ${port}`,
        cwd: path.resolve(__dirname, "../.."),
        url: `${baseURL}/verify`,
        timeout: 300_000,
        reuseExistingServer: false,
        stdout: "ignore",
        stderr: "pipe",
        env: {
          NEXT_PUBLIC_API_URL: LEGACY_API_BASE,
          NEXT_PUBLIC_API_BASE_URL: LEGACY_API_BASE,
          NEXT_TELEMETRY_DISABLED: "1",
        },
      },
});
