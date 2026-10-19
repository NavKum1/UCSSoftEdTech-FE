import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // One-off Node maintenance scripts (CommonJS, run with `node <file>`; not part of the app bundle), so require() is
  // how they load modules. Scoped to these files only.
  {
    files: ["fix-*.js", "refactor-theme.js", "scratch/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Service worker bundled by @serwist/next from src/app/sw.ts on every build (next.config.ts swDest); minified output.
    "public/sw.js",
  ]),
]);

export default eslintConfig;
