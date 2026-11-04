/**
 * Every page has the same width and side margins (5 Nov 2026; components/layout/Frame.tsx). Fails when a page sets its
 * own outer width: a centred `mx-auto max-w-xl … max-w-7xl` block, or `max-w-7xl` anywhere outside Frame.tsx.
 * Screens with no menu (sign-in, embeds, kiosk, public verify pages, errors) keep their own small centred card and are
 * not checked. A line can opt out with a trailing comment `frame-ok: <why>`.
 * Run: npx tsx scripts/check-frame.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "src");
const SKIP = [
  // No navigation: sign-in, sign-up, embeds, kiosk, signed links and public certificates (lib/careerNav.ts)
  /^app\/(login|start|embed|kiosk|supervisor|verify\/internship|credential|partner\/callback|career-unsubscribe|api)\//,
  /^app\/(error|not-found|global-error)\.tsx$/,
  /^components\/layout\/Frame\.tsx$/,
];
const CENTRED = /className=[^>]*\bmx-auto\b[^>]*\bmax-w-(xl|[2-7]xl|screen-\w+)\b|className=[^>]*\bmax-w-(xl|[2-7]xl|screen-\w+)\b[^>]*\bmx-auto\b/;
const SEVEN = /\bmax-w-7xl\b/;

const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx$/.test(e.name) ? [path.join(d, e.name)] : []));

const problems: string[] = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  if (SKIP.some((r) => r.test(rel))) continue;
  // Pages, and the page-level components under components/ that own a whole screen
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes("frame-ok")) return;
    if (CENTRED.test(line) || SEVEN.test(line)) problems.push(`${rel}:${i + 1}  ${line.trim().slice(0, 140)}`);
  });
}
if (problems.length) {
  console.log(`${problems.length} place(s) set their own page width (use the frame: components/layout/Frame.tsx):\n` + problems.join("\n"));
  process.exit(1);
}
console.log("Every page uses the standard frame.");
