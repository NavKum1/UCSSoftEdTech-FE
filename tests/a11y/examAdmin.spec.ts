import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { prepare, settle } from "./harness";
import { EXAM_ID } from "./fixtures/examAdmin";

/**
 * H12 exam administration dialogs (import, add question, void attempt, credential review): each one passes axe
 * (WCAG 2.0/2.1 A and AA) in light and dark, opens from the keyboard, keeps Tab inside, closes on Escape and gives focus
 * back to the button that opened it.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scanDialog(page: Page) {
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  const result = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(WCAG_TAGS).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** Opens a dialog with Enter on the focused opener, checks the focus trap and Escape, and that focus returns. */
async function keyboardDialog(page: Page, opener: ReturnType<Page["locator"]>) {
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  // focus starts inside and stays inside for a full cycle of Tab presses
  const count = await dialog.locator('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])').count();
  for (let i = 0; i < count + 2; i++) {
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`exam admin dialogs (${theme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await prepare(page, "admin");
    });

    test("import dialog: preview with errors", async ({ page }) => {
      await page.goto(`/admin/exams/${EXAM_ID}?tab=questions`, { waitUntil: "domcontentloaded" });
      await settle(page, 'table:has-text("Which traversal visits the root first?")');
      const opener = page.getByRole("button", { name: "Import CSV or JSON" });
      await keyboardDialog(page, opener);
      await opener.click();
      await page.getByLabel("Or paste the file's content").fill("question,option1,option2,correct\nWhich structure is FIFO?,Stack,Queue,B");
      await page.getByRole("button", { name: "Preview" }).click();
      await expect(page.getByRole("status").filter({ hasText: "3 questions read" })).toBeVisible();
      await expect(page.getByRole("dialog").getByRole("button", { name: "Import", exact: true })).toBeDisabled();
      await scanDialog(page);
    });

    test("add and edit question dialogs", async ({ page }) => {
      await page.goto(`/admin/exams/${EXAM_ID}?tab=questions`, { waitUntil: "domcontentloaded" });
      await settle(page, 'table:has-text("Which traversal visits the root first?")');
      const add = page.getByRole("button", { name: "Add question" });
      await keyboardDialog(page, add);
      await add.click();
      await scanDialog(page);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Edit question 13" }).click();
      await expect(page.getByText("Attempts have already shown this question")).toBeVisible();
      await scanDialog(page);
    });

    test("student attempts and the void dialog", async ({ page }) => {
      await page.goto(`/admin/exams/${EXAM_ID}?tab=students`, { waitUntil: "domcontentloaded" });
      await settle(page, 'table:has-text("Priya Raman")');
      await page.getByRole("button", { name: "Attempts of Priya Raman" }).click();
      await expect(page.getByText("Notes found on the desk")).toBeVisible();
      const scan = await new AxeBuilder({ page }).withTags(WCAG_TAGS).exclude("nextjs-portal").analyze();
      expect(scan.violations.map((v) => v.id)).toEqual([]);
      const voidBtn = page.getByRole("button", { name: "Void attempt 4 by Priya Raman" });
      await keyboardDialog(page, voidBtn);
      await voidBtn.click();
      await scanDialog(page);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Grant extra attempts to Priya Raman" }).click();
      await scanDialog(page);
    });

    test("credential review dialog", async ({ page }) => {
      await page.goto("/admin/exams", { waitUntil: "domcontentloaded" });
      await settle(page, 'table:has-text("Data Structures Midterm")');
      const revoke = page.getByRole("button", { name: "Revoke certificate CERT-EXAM-2026-A11Y0002" });
      await keyboardDialog(page, revoke);
      await revoke.click();
      await scanDialog(page);
    });
  });
}
