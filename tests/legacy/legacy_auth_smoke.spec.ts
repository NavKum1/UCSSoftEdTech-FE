/**
 * H7 smoke test: the older (non-career) pages call the API with the signed-in user's token now that the API requires
 * sign-in by default (global fallback policy, `// H7 public:` markers for the public list). Runs against a real API in
 * Development; see ./playwright.config.ts for how to start it.
 *
 * Signed-in pages: the tab gets a partner session (src/lib/partnerSession.ts) whose token is one of the API's dev bearer
 * tokens, so useAppAuth/useLegacyApi send `Authorization: Bearer <dev token>` without a real identity provider. Each page
 * must load with no 401/403 from the API, no uncaught error and no Next.js error overlay, and must not show the
 * sign-in / not-allowed notice. Signed-out pages must not call locked endpoints.
 */
import { test, expect, type Page, type Response } from "@playwright/test";
import { LEGACY_API_BASE } from "./playwright.config";

type Persona = "candidate" | "recruiter" | "superadmin";

const DEV_TOKENS: Record<Persona, string> = {
  candidate: "candidate-dev-token",
  recruiter: "recruiter-dev-token",
  superadmin: "superadmin-dev-token",
};

interface LegacyPage {
  path: string;
  persona: Persona;
  /** API paths (prefix match) this page is expected to call; at least one must be seen. */
  calls: string[];
}

const PAGES: LegacyPage[] = [
  // Candidate pages
  { path: "/passport", persona: "candidate", calls: ["/api/passport"] },
  { path: "/dashboard", persona: "candidate", calls: ["/api/passport/member-360"] },
  { path: "/dashboard/interviews/smoke-session", persona: "candidate", calls: ["/api/interview/session/"] },
  { path: "/daily", persona: "candidate", calls: ["/api/incidents/streak/"] },
  { path: "/daily/incident", persona: "candidate", calls: ["/api/incidents/today"] },
  { path: "/daily/review", persona: "candidate", calls: ["/api/codereview/today"] },
  { path: "/duels/arena", persona: "candidate", calls: ["/api/duels/presets"] },
  { path: "/guilds/battles", persona: "candidate", calls: ["/api/guilds"] },
  { path: "/leaderboard", persona: "candidate", calls: ["/api/leaderboard"] },
  { path: "/leadership/simulator", persona: "candidate", calls: ["/api/leadership/scenarios"] },
  { path: "/mentors/book", persona: "candidate", calls: ["/v1/mentors"] },
  { path: "/career/agent", persona: "candidate", calls: ["/api/agent/config/"] },
  { path: "/career/promotion-review", persona: "candidate", calls: ["/api/promotion/integrations"] },
  { path: "/prep/career", persona: "candidate", calls: ["/api/career/compensation/"] },
  { path: "/prep/challenges/synthesizer", persona: "candidate", calls: ["/api/challenges/synthesize"] },
  { path: "/prep/counselling", persona: "candidate", calls: ["/api/quiz/counselling/questions"] },
  { path: "/prep/exam", persona: "candidate", calls: ["/api/quiz/exams"] },
  { path: "/prep/matcher", persona: "candidate", calls: [] },
  { path: "/interview/persona", persona: "candidate", calls: ["/api/persona/catalog"] },
  { path: "/interview/practice", persona: "candidate", calls: [] },
  { path: "/interview/smoke-session/pairing", persona: "candidate", calls: ["/hubs/collaboration/negotiate"] },
  { path: "/interview/smoke-session/replay", persona: "candidate", calls: ["/api/interview/smoke-session/replay"] },
  { path: "/interview/smoke-session/translation", persona: "candidate", calls: ["/api/translation/session/"] },
  { path: "/sprint/smoke-sprint/pair-coach", persona: "candidate", calls: ["/api/pair-coach/session/start"] },
  { path: "/campus", persona: "candidate", calls: ["/api/campus/my-assignments", "/api/interview/languages"] },
  // Recruiter pages
  { path: "/recruiter/dashboard", persona: "recruiter", calls: ["/api/recruiter/candidates", "/api/recruiter/assessments/bundles"] },
  { path: "/recruiter/benchmark", persona: "recruiter", calls: ["/api/benchmark/cohort/analytics"] },
  { path: "/recruiter/proctoring/video/00000000-0000-4000-8000-000000000001", persona: "recruiter", calls: ["/api/video/recording/"] },
  // Platform / partner admin pages
  { path: "/admin/system", persona: "superadmin", calls: ["/api/system/queue/status"] },
  { path: "/admin/resilience", persona: "superadmin", calls: ["/api/resilience/regions"] },
  { path: "/executive/governance", persona: "superadmin", calls: ["/api/governance/system-rollup/"] },
  { path: "/edulexa/dashboard", persona: "superadmin", calls: ["/v1/dashboard/metrics"] },
  { path: "/partner/billing", persona: "superadmin", calls: ["/api/billing/enterprise/subscription"] },
  { path: "/partner/dashboard", persona: "superadmin", calls: ["/api/partner/dashboard"] },
];

/** Signed in as `persona` through a partner session (useAppAuth prefers it over Clerk/Keycloak while it is valid). */
async function signIn(page: Page, persona: Persona) {
  await page.addInitScript((token: string) => {
    try {
      window.sessionStorage.setItem(
        "career.partnerSession",
        JSON.stringify({ token, expiresAt: Date.now() + 3_600_000, userId: null, role: null, instituteId: null }),
      );
    } catch {
      /* storage blocked */
    }
  }, DEV_TOKENS[persona]);
  // Clerk is not part of this test and needs the network
  await page.route(/clerk\.(accounts\.dev|com)|clerk\.[^/]*\/npm\//, (route) => route.abort());
}

interface ApiCall {
  method: string;
  path: string;
  status: number;
  authorized: boolean;
}

function watchApi(page: Page) {
  const calls: ApiCall[] = [];
  const sockets: string[] = [];
  page.on("response", (res: Response) => {
    const url = res.url();
    if (!url.startsWith(LEGACY_API_BASE)) return;
    const req = res.request();
    if (req.method() === "OPTIONS") return;
    const u = new URL(url);
    calls.push({ method: req.method(), path: u.pathname + u.search, status: res.status(), authorized: !!req.headers()["authorization"] });
  });
  page.on("websocket", (ws) => {
    if (ws.url().includes(new URL(LEGACY_API_BASE).host)) sockets.push(ws.url());
  });
  const errors: string[] = [];
  const hydration: string[] = [];
  // A hydration mismatch is recoverable (React re-renders on the client) and comes from server/browser locale
  // differences in number formatting on some pages; it is reported, not counted as a crash.
  page.on("pageerror", (e) => (/Hydration failed/.test(e.message) ? hydration : errors).push(e.message));
  return { calls, sockets, errors, hydration };
}

/**
 * The Next.js dev overlay when it reports a runtime error (a crash). Console errors it lists (e.g. next-themes'
 * pre-existing "Encountered a script tag" warning from the root layout) are not crashes and are ignored here.
 */
async function overlayError(page: Page): Promise<string | null> {
  const text = await page.evaluate(() => {
    const root = document.querySelector("nextjs-portal")?.shadowRoot;
    if (!root) return null;
    const dialog = root.querySelector("[data-nextjs-dialog], #nextjs__container_errors_desc");
    return dialog ? root.querySelector("#nextjs__container_errors_desc, [data-nextjs-dialog-content]")?.textContent || "Next.js error overlay is open" : null;
  });
  return text && !/^\s*Console Error/i.test(text) ? text : null;
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
}

test.describe("signed in: no 401s, no crash", () => {
  for (const p of PAGES) {
    test(`${p.persona} ${p.path}`, async ({ page }) => {
      await signIn(page, p.persona);
      const seen = watchApi(page);
      await page.goto(p.path, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await settle(page);

      const summary = seen.calls.map((c) => `${c.status} ${c.method} ${c.path}${c.authorized ? "" : " (no token)"}`);
      test.info().annotations.push({ type: "api", description: summary.join("\n") || "(no API calls)" });

      const refused = seen.calls.filter((c) => c.status === 401 || c.status === 403);
      expect(refused, `refused API calls:\n${summary.join("\n")}`).toEqual([]);
      const untokened = seen.calls.filter((c) => !c.authorized && !c.path.startsWith("/health"));
      expect(untokened, "API calls without a bearer token").toEqual([]);
      for (const prefix of p.calls) {
        expect(seen.calls.some((c) => c.path.startsWith(prefix)), `expected a call to ${prefix}\n${summary.join("\n")}`).toBe(true);
      }
      expect(await overlayError(page)).toBeNull();
      if (seen.hydration.length) test.info().annotations.push({ type: "hydration-mismatch", description: seen.hydration[0].slice(0, 200) });
      expect(seen.errors, "uncaught page errors").toEqual([]);
      await expect(page.locator("[data-access-notice]")).toHaveCount(0);

      if (p.path.endsWith("/pairing")) {
        // SignalR: negotiate carries the Bearer header and the WebSocket carries ?access_token= (hubs only)
        expect(seen.calls.find((c) => c.path.startsWith("/hubs/collaboration/negotiate"))?.status).toBe(200);
        await expect.poll(() => seen.sockets.some((u) => u.includes("/hubs/collaboration") && u.includes("access_token=")), { timeout: 15_000 }).toBe(true);
      }
    });
  }
});

test.describe("signed out", () => {
  const LOCKED_ON_LANDING = ["/api/institute"];

  test("landing page calls no institute endpoint", async ({ page }) => {
    await page.route(/clerk\.(accounts\.dev|com)|clerk\.[^/]*\/npm\//, (route) => route.abort());
    const seen = watchApi(page);
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 180_000 });
    await settle(page);
    const hits = seen.calls.filter((c) => LOCKED_ON_LANDING.some((p) => c.path.startsWith(p)));
    expect(hits).toEqual([]);
    // H7b: the institute picker and the "Seed Institutes" panel are removed for everyone
    await page.getByRole("button", { name: "Enterprise B2B" }).click();
    await expect(page.getByText("Seed Institutes")).toHaveCount(0);
    await expect(page.getByText("B2B Tenant Context")).toHaveCount(0);
    expect(seen.calls.filter((c) => c.status === 401)).toEqual([]);
    expect(await overlayError(page)).toBeNull();
  });

  test("landing page as a candidate still calls no institute endpoint", async ({ page }) => {
    await signIn(page, "candidate");
    const seen = watchApi(page);
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 180_000 });
    await settle(page);
    expect(seen.calls.filter((c) => c.path.startsWith("/api/institute"))).toEqual([]);
    expect(seen.calls.filter((c) => c.status === 401 || c.status === 403)).toEqual([]);
  });

  // With Clerk reachable the provider reports "signed out" and the page shows the sign-in notice; offline it stays
  // loading. Either way a signed-out page must not send requests that the API would refuse.
  for (const path of ["/passport", "/recruiter/dashboard", "/admin/system", "/prep/exam"]) {
    test(`${path} makes no locked call and offers sign-in`, async ({ page }) => {
      const seen = watchApi(page);
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await settle(page);
      expect(seen.calls.filter((c) => c.status === 401), seen.calls.map((c) => `${c.status} ${c.path}`).join("\n")).toEqual([]);
      expect(await overlayError(page)).toBeNull();
      const notice = page.locator('[data-access-notice="signin"]');
      if ((await notice.count()) === 0) {
        test.info().annotations.push({ type: "note", description: "identity provider did not load (offline?); sign-in notice not checked" });
        return;
      }
      await expect(notice.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", `/login?redirect_url=${encodeURIComponent(path)}`);
    });
  }
});

// H7b (owner decisions 19 Oct 2026)
test.describe("public candidate assessment link (H7b)", () => {
  /** A fresh bundle made through the API as a recruiter (dev token); the page then runs with no session at all. */
  async function newBundleToken(): Promise<string> {
    const res = await fetch(`${LEGACY_API_BASE}/api/recruiter/assessments/bundle/create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DEV_TOKENS.recruiter}`, "Content-Type": "application/json" },
      body: JSON.stringify({ candidateName: "Smoke Candidate", candidateEmail: "smoke.candidate@example.com", companyName: "SmokeCo", examId: "swe-core-systems" }),
    });
    expect(res.status).toBe(200);
    return (await res.json()).token as string;
  }

  test("/assessment/[token] works signed out: bundle-scoped calls only, no token, stage 1 submits", async ({ page }) => {
    const token = await newBundleToken();
    await page.route(/clerk\.(accounts\.dev|com)|clerk\.[^/]*\/npm\//, (route) => route.abort());
    const seen = watchApi(page);
    await page.goto(`/assessment/${token}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await expect(page.getByText("Stage 1 of 3: Written Diagnostic")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("[data-access-notice]")).toHaveCount(0);

    // answer every question and submit the written stage
    for (let i = 0; i < 30; i++) {
      await page.locator("main button.w-full").first().click();
      const submit = page.getByRole("button", { name: /Submit Stage 1/ });
      if (await submit.count()) {
        await submit.click();
        break;
      }
      await page.getByRole("button", { name: "Next Question" }).click();
    }
    await expect(page.getByText("Stage 2 of 3: Production Code Sprint")).toBeVisible({ timeout: 30_000 });

    const summary = seen.calls.map((c) => `${c.status} ${c.method} ${c.path}${c.authorized ? " (token)" : ""}`).join("\n");
    expect(seen.calls.filter((c) => c.authorized), `no user token on a public link:\n${summary}`).toEqual([]);
    expect(seen.calls.filter((c) => c.status === 401 || c.status === 403), summary).toEqual([]);
    const prefix = `/api/recruiter/assessments/bundle/${token}`;
    expect(seen.calls.find((c) => c.method === "GET" && c.path === prefix)?.status, summary).toBe(200);
    expect(seen.calls.find((c) => c.path === `${prefix}/exam`)?.status, summary).toBe(200);
    expect(seen.calls.find((c) => c.path === `${prefix}/exam/submit`)?.status, summary).toBe(200);
    expect(seen.calls.filter((c) => c.path.startsWith("/api/quiz/") || c.path.startsWith("/api/code/")), "general exam/code endpoints not used").toEqual([]);
    expect(await overlayError(page)).toBeNull();
    expect(seen.errors).toEqual([]);
  });

  test("an unknown assessment link says so (no sign-in notice, no 401)", async ({ page }) => {
    await page.route(/clerk\.(accounts\.dev|com)|clerk\.[^/]*\/npm\//, (route) => route.abort());
    const seen = watchApi(page);
    await page.goto("/assessment/ASSESS-SMOKE-0123456789ABCDEF0123456789ABCDEF", { waitUntil: "domcontentloaded", timeout: 180_000 });
    await expect(page.locator('[data-assessment-problem="invalid"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("[data-access-notice]")).toHaveCount(0);
    expect(seen.calls.filter((c) => c.status === 401)).toEqual([]);
  });
});

test.describe("sign-in notices that stay (H7b)", () => {
  /** A session the API refuses (as when it ended): the page gets 401 and must show the sign-in notice. */
  async function endedSession(page: Page) {
    await page.addInitScript(() => {
      try {
        window.sessionStorage.setItem(
          "career.partnerSession",
          JSON.stringify({ token: "h7b-ended-session", expiresAt: Date.now() + 3_600_000, userId: null, role: null, instituteId: null }),
        );
      } catch {
        /* storage blocked */
      }
    });
    await page.route(/clerk\.(accounts\.dev|com)|clerk\.[^/]*\/npm\//, (route) => route.abort());
  }

  test("partner counselling quiz: 'Sign in to take the quiz', back to the same partner link", async ({ page }) => {
    await endedSession(page);
    await page.goto("/prep/counselling?partner=smoke-partner", { waitUntil: "domcontentloaded", timeout: 180_000 });
    const notice = page.locator('[data-access-notice="signin"]');
    await expect(notice).toBeVisible({ timeout: 60_000 });
    await expect(notice.getByRole("heading", { name: "Sign in to take the quiz" })).toBeVisible();
    await expect(notice.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/login?redirect_url=${encodeURIComponent("/prep/counselling?partner=smoke-partner")}`,
    );
    expect(await overlayError(page)).toBeNull();
  });

  test("partner counselling quiz signed out (identity provider reachable) shows the same notice", async ({ page }) => {
    const seen = watchApi(page);
    await page.goto("/prep/counselling?partner=smoke-partner", { waitUntil: "domcontentloaded", timeout: 180_000 });
    await settle(page);
    expect(seen.calls.filter((c) => c.status === 401)).toEqual([]);
    const notice = page.locator('[data-access-notice="signin"]');
    if ((await notice.count()) === 0) {
      test.info().annotations.push({ type: "note", description: "identity provider did not load (offline?); notice not checked" });
      return;
    }
    await expect(notice.getByRole("heading", { name: "Sign in to take the quiz" })).toBeVisible();
  });

  test("shared incident link: 'Sign in to open this incident', back to the same access code", async ({ page }) => {
    await endedSession(page);
    await page.goto("/daily/incident?accessCode=SMOKE-CODE", { waitUntil: "domcontentloaded", timeout: 180_000 });
    const notice = page.locator('[data-access-notice="signin"]');
    await expect(notice).toBeVisible({ timeout: 60_000 });
    await expect(notice.getByRole("heading", { name: "Sign in to open this incident" })).toBeVisible();
    await expect(notice.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/login?redirect_url=${encodeURIComponent("/daily/incident?accessCode=SMOKE-CODE")}`,
    );
  });
});

test("a refused read shows the not-allowed notice instead of crashing", async ({ page }) => {
  // The API answers 403 for this page's data (as it does for a role that can't use it)
  await signIn(page, "candidate");
  await page.route(`${LEGACY_API_BASE}/api/benchmark/**`, (route) =>
    route.request().method() === "OPTIONS"
      ? route.continue()
      : route.fulfill({ status: 403, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: "{}" }),
  );
  const seen = watchApi(page);
  await page.goto("/recruiter/benchmark", { waitUntil: "domcontentloaded", timeout: 180_000 });
  await settle(page);
  await expect(page.locator('[data-access-notice="forbidden"]')).toBeVisible();
  expect(await overlayError(page)).toBeNull();
  expect(seen.errors).toEqual([]);
});
