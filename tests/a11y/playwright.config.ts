import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { API_BASE } from "./harness";

/**
 * Accessibility suite (axe-core + scripted keyboard checks) for the career-suite pages.
 * Run with `npm run test:a11y` (see tests/a11y/README section in docs/compliance/VPAT_2.5_WCAG_draft.md).
 *
 * It runs against `next dev`: the middleware lets every route through in development, so no real sign-in is
 * needed, and the API is never called (every request to API_BASE is answered from ./fixtures).
 */
const port = Number(process.env.A11Y_PORT || 3123);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/,
  outputDir: "../../test-results/a11y",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: Number(process.env.A11Y_WORKERS || 3),
  // next dev compiles each route on first visit; one retry absorbs a slow first compile
  retries: 1,
  reporter: [["list"], ["json", { outputFile: "../../test-results/a11y/report.json" }]],
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: process.env.A11Y_EXTERNAL_SERVER
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
          NEXT_PUBLIC_API_URL: API_BASE,
          NEXT_PUBLIC_API_BASE_URL: API_BASE,
          NEXT_TELEMETRY_DISABLED: "1",
        },
      },
});
