import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// G10 installable web app (docs/career_suite_mobile.md). The worker is registered by the career layouts
// (CareerMobileRoot), not on every page, and precaches only the offline page and icon.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  register: false,
  reloadOnOnline: false,
  globPublicPatterns: ["career-offline.html", "career-icon.svg"],
  // No build chunks in the precache list: they are cached as pages use them
  exclude: [() => true],
});

const nextConfig: NextConfig = {
  output: "standalone",
};

export default withSerwist(nextConfig);
