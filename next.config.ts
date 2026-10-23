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
  env: {
    // Always inlined (even when unset), so a build without it drops the sign-in page's developer shortcuts entirely
    // (components/auth/DevShortcuts.tsx). Set NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true at build time to keep them.
    NEXT_PUBLIC_ENABLE_DEMO_LOGIN: process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN ?? "",
  },
};

export default withSerwist(nextConfig);
