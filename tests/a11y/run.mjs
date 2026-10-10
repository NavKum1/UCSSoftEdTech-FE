#!/usr/bin/env node
// Starts the accessibility suite on a free port: `npm run test:a11y [-- <playwright args>]`.
import net from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const port = process.env.A11Y_PORT || String(await freePort());
const args = ["playwright", "test", "-c", "tests/a11y/playwright.config.ts", ...process.argv.slice(2)];
console.log(`a11y: next dev on port ${port}`);
const child = spawn("npx", args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, A11Y_PORT: port } });
child.on("exit", async (code) => {
  try {
    await import("./summarize.mjs");
  } catch (e) {
    console.error("a11y: summary failed", e);
  }
  process.exit(code ?? 1);
});
