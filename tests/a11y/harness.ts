import type { Page, Route } from "@playwright/test";
import { commonFixtures } from "./fixtures/common";
import type { ApiFixture, FixtureContext, Persona } from "./fixtures/types";
import { allFixtures } from "./fixtures";

/** Fake API origin the dev server is started with (NEXT_PUBLIC_API_URL); every request to it is answered here. */
export const API_BASE = process.env.A11Y_API_BASE || "http://a11y-api.test";

export interface MockLog {
  missing: string[];
}

function matches(f: ApiFixture, ctx: FixtureContext, path: string) {
  const method = f.method ?? "GET";
  if (method !== "*" && method !== ctx.method) return false;
  if (typeof f.path === "string" ? f.path !== path : !f.path.test(path)) return false;
  return f.when ? f.when(ctx) : true;
}

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-expose-headers": "*",
};

/** Answers API calls from fixtures, signs the tab in with a partner session token, and blocks third-party auth scripts. */
export async function prepare(page: Page, persona: Persona, extra: ApiFixture[] = []): Promise<MockLog> {
  const log: MockLog = { missing: [] };
  const fixtures = [...extra, ...commonFixtures, ...allFixtures];

  await page.route(`${API_BASE}/**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders });
    const url = new URL(req.url());
    const ctx: FixtureContext = { url, method: req.method(), persona, postData: req.postData() };
    const f = fixtures.find((x) => matches(x, ctx, url.pathname));
    if (!f) {
      if (ctx.method === "GET") {
        log.missing.push(`${ctx.method} ${url.pathname}${url.search}`);
        return route.fulfill({ status: 404, headers: corsHeaders, contentType: "application/json", body: JSON.stringify({ message: "Not found" }) });
      }
      // Writes without a fixture succeed with an empty object
      return route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", body: "{}" });
    }
    const body = typeof f.body === "function" ? (f.body as (c: FixtureContext) => unknown)(ctx) : f.body;
    const contentType = f.contentType ?? "application/json";
    return route.fulfill({
      status: f.status ?? 200,
      headers: corsHeaders,
      contentType,
      body: contentType.includes("json") ? JSON.stringify(body) : String(body ?? ""),
    });
  });

  // Third-party identity scripts are not part of this product's UI and need the network: keep the run offline
  await page.route(/clerk\.(accounts\.dev|com)|clerk\.[^/]*\/npm\//, (route) => route.abort());

  // A11Y_LOCALE=ar-XB (or en-XA) runs the pages in a career pseudo-locale (cookie read by CareerI18nRoot)
  const locale = process.env.A11Y_LOCALE;
  if (locale) {
    const port = Number(process.env.A11Y_PORT || 3123);
    await page.context().addCookies([{ name: "career_locale", value: locale, url: `http://localhost:${port}` }]);
  }

  if (persona !== "public") {
    await page.addInitScript(() => {
      // Partner session (src/lib/partnerSession.ts): useAppAuth treats the tab as signed in while it is valid
      const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
      const payload = btoa(JSON.stringify({ sub: "22222222-2222-4222-8222-222222222222", aud: "edulexa-partner-session", exp: Math.floor(Date.now() / 1000) + 3600 }));
      const token = `${header}.${payload}.sig`;
      try {
        window.sessionStorage.setItem(
          "career.partnerSession",
          JSON.stringify({ token, expiresAt: Date.now() + 3_600_000, userId: "22222222-2222-4222-8222-222222222222", role: null, instituteId: null }),
        );
        window.localStorage.setItem("career.school", "11111111-1111-4111-8111-111111111111");
      } catch {
        /* storage blocked */
      }
    });
  }
  return log;
}

/** Waits until the page has rendered its data: no loading indicators and the main heading is visible. */
export async function settle(page: Page, ready?: string) {
  await page.waitForLoadState("domcontentloaded");
  if (ready) {
    await page.locator(ready).first().waitFor({ state: "visible", timeout: 30_000 });
  } else {
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 30_000 });
  }
  // Loading spinners/placeholders from components/career/ui.tsx
  await page
    .waitForFunction(() => !document.querySelector("[data-loading]") && !Array.from(document.querySelectorAll('[role="status"]')).some((el) => /loading/i.test(el.textContent ?? "")), null, { timeout: 15_000 })
    .catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(300);
}

/** The Next.js dev error overlay means the page crashed with our fixtures; that would hide real issues. */
export async function devOverlayError(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const portal = document.querySelector("nextjs-portal");
    const root = portal?.shadowRoot;
    if (!root) return null;
    const dialog = root.querySelector("[data-nextjs-dialog], [data-nextjs-error-overlay-nav], #nextjs__container_errors_desc");
    const text = root.querySelector("#nextjs__container_errors_desc, [data-nextjs-dialog-content]")?.textContent ?? null;
    return dialog ? text || "Next.js error overlay is open" : null;
  });
}
