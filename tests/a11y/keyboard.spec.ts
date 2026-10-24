import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { allRoutes } from "./fixtures";
import { prepare, settle } from "./harness";

/**
 * Scripted keyboard checks (not a substitute for a manual audit):
 * - Tab from the top of the page reaches every visible, enabled control (2.1.1) without getting stuck (2.1.2)
 * - every focused control shows a focus indicator (2.4.7)
 * - custom dialogs and menus open from the keyboard, keep focus inside, close on Escape and return focus.
 */

const RESULTS_DIR = path.resolve(__dirname, "../../test-results/a11y-keyboard");
fs.mkdirSync(RESULTS_DIR, { recursive: true });

/** The ten most complex career-suite pages (most controls, tabs, tables and inline forms). */
const TAB_PAGES = [
  "cc-document-review",
  "cc-mentoring",
  "student-appointments",
  "cc-outcomes",
  "cc-imports",
  "cc-interviews",
  "employer-challenges",
  "cc-caseload",
  "student-mentoring",
  "cc-international",
];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

async function open(page: Page, name: string, width = 1280) {
  const route = allRoutes.find((r) => r.name === name);
  if (!route) throw new Error(`Unknown route ${name}`);
  await page.setViewportSize({ width, height: 900 });
  await prepare(page, route.persona);
  await page.goto(route.path, { waitUntil: "domcontentloaded" });
  await settle(page, route.ready);
  return route;
}

/** Marks every control a keyboard user should reach and returns their ids and descriptions. */
async function markExpected(page: Page) {
  return page.evaluate((selector) => {
    const radiosSeen = new Set<string>();
    const out: { id: string; desc: string }[] = [];
    let n = 0;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      if (el.closest("nextjs-portal, [inert], [aria-hidden='true']")) continue;
      const style = getComputedStyle(el);
      const visible = el.getClientRects().length > 0 && style.visibility !== "hidden" && style.display !== "none";
      const isSkipLink = el.matches("a.sr-only");
      if (!visible && !isSkipLink) continue;
      // Roving tabindex tablists: only the selected tab is in the tab order, arrow keys reach the others
      if (el.getAttribute("role") === "tab" && el.getAttribute("tabindex") === "-1") continue;
      if (el instanceof HTMLInputElement && el.type === "radio") {
        // Only one radio per group is in the tab order; arrow keys move within the group
        const key = el.name || `radio-${n}`;
        if (radiosSeen.has(key)) continue;
        radiosSeen.add(key);
        el.dataset.kbGroup = key;
      }
      const id = `kb-${n++}`;
      el.dataset.kb = id;
      const label = (el.getAttribute("aria-label") || el.textContent || (el as HTMLInputElement).name || el.id || "").trim().replace(/\s+/g, " ").slice(0, 50);
      out.push({ id, desc: `${el.tagName.toLowerCase()}${(el as HTMLInputElement).type ? `[${(el as HTMLInputElement).type}]` : ""} "${label}"` });
    }
    return out;
  }, FOCUSABLE);
}

interface Stop {
  id: string | null;
  desc: string;
  focusVisible: boolean;
}

/** Reads the focused element and whether it shows a focus indicator (outline, ring/box-shadow or border change). */
async function focused(page: Page): Promise<Stop | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body || el.tagName === "NEXTJS-PORTAL") return null;
    let id = el.dataset.kb ?? null;
    if (!id && el instanceof HTMLInputElement && el.type === "radio") {
      const first = document.querySelector<HTMLElement>(`input[type="radio"][data-kb-group="${CSS.escape(el.name)}"]`);
      id = first?.dataset.kb ?? null;
    }
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
    const ring = s.boxShadow !== "none" && s.boxShadow !== "";
    // A parent with focus-within styling (e.g. a card around a radio) also counts
    const parent = el.closest("label, [class*='focus-within']") as HTMLElement | null;
    const ps = parent ? getComputedStyle(parent) : null;
    const parentRing = !!ps && ((ps.boxShadow !== "none" && ps.boxShadow !== "") || (ps.outlineStyle !== "none" && parseFloat(ps.outlineWidth) > 0));
    const label = (el.getAttribute("aria-label") || el.textContent || (el as HTMLInputElement).name || "").trim().replace(/\s+/g, " ").slice(0, 50);
    return { id, desc: `${el.tagName.toLowerCase()} "${label}"`, focusVisible: outline || ring || parentRing };
  });
}

for (const name of TAB_PAGES) {
  test(`keyboard: tab order on ${name}`, async ({ page }) => {
    await open(page, name);
    const expected = await markExpected(page);
    // Start from the top of the document
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, 0);
    });
    await page.keyboard.press("Tab"); // first stop

    const visited = new Set<string>();
    const noIndicator: string[] = [];
    const sequence: string[] = [];
    let trapped = false;
    let repeats = 0;
    let previous: string | null = null;
    const limit = expected.length + 40;
    for (let i = 0; i < limit; i++) {
      const stop = await focused(page);
      if (!stop) {
        if (i > 0) break; // focus left the page: end of the tab order
      } else {
        const key = stop.id ?? stop.desc;
        sequence.push(key);
        if (stop.id) visited.add(stop.id);
        if (!stop.focusVisible) noIndicator.push(stop.desc);
        repeats = key === previous ? repeats + 1 : 0;
        if (repeats >= 3) {
          trapped = true;
          break;
        }
        previous = key;
      }
      await page.keyboard.press("Tab");
    }
    const reachedEnd = (await focused(page)) === null;
    const unreached = expected.filter((e) => !visited.has(e.id)).map((e) => e.desc);
    const result = {
      page: name,
      controls: expected.length,
      reached: visited.size,
      unreached,
      withoutVisibleFocus: Array.from(new Set(noIndicator)),
      trapped,
      reachedEnd,
      stops: sequence.length,
    };
    fs.writeFileSync(path.join(RESULTS_DIR, `${name}.json`), JSON.stringify(result, null, 2));
    expect(trapped, "keyboard trap").toBe(false);
    expect(reachedEnd, "Tab eventually leaves the page (no trap)").toBe(true);
    expect(unreached, "controls not reachable with Tab").toEqual([]);
    expect(result.withoutVisibleFocus, "controls without a visible focus indicator").toEqual([]);
  });
}

test("keyboard: challenge join dialog traps focus, closes on Escape and returns focus", async ({ page }) => {
  await open(page, "student-challenges");
  const join = page.getByRole("button", { name: "Join", exact: true }).first();
  await join.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((d) => d.contains(document.activeElement)), "focus moves into the dialog").toBe(true);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement)), `Tab ${i + 1} stays inside the dialog`).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((d) => d.contains(document.activeElement)), "Shift+Tab stays inside the dialog").toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await join.evaluate((b) => b === document.activeElement), "focus returns to the Join button").toBe(true);
});

test("keyboard: career navigation menu on a phone opens, closes on Escape and returns focus", async ({ page }) => {
  await open(page, "student-home", 375);
  const toggle = page.getByRole("button", { name: "Open menu" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("#career-nav, header")), "Tab moves on to the menu").toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#career-nav")).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-controls")), "focus returns to the menu button").toBe("career-nav");
});

test("keyboard: skip link moves focus to the main content", async ({ page }) => {
  await open(page, "student-appointments");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("career-main");
});

test("keyboard: appointment tabs follow the arrow-key tab pattern", async ({ page }) => {
  await open(page, "cc-appointments");
  const first = page.getByRole("tab", { selected: true });
  await first.focus();
  await page.keyboard.press("ArrowRight");
  const next = page.getByRole("tab", { name: "Drop-in" });
  await expect(next).toBeFocused();
  await expect(next).toHaveAttribute("aria-selected", "true");
});

test("keyboard: global More menu opens from the keyboard and closes on Escape", async ({ page }) => {
  await open(page, "verify-jws");
  const button = page.getByRole("button", { name: /^More/ });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("#more-menu")), "Tab enters the open menu").toBe(true);
  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toBeFocused();
});
