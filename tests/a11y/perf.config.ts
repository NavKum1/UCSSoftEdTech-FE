import { defineConfig, devices } from "@playwright/test";

/** G10 Slow 3G budget run (tests/a11y/perf.slow3g.ts) against an already running production server (PERF_BASE). */
export default defineConfig({
  testDir: ".",
  testMatch: /perf\.slow3g\.ts$/,
  outputDir: "../../test-results/perf",
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { ...devices["Pixel 7"], trace: "off" },
});
