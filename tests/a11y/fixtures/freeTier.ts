/** Fixtures for G13 (free student tier, no school needed): landing, sign-up and the free-user home. */
import type { A11yRoute, ApiFixture } from "./types";
import { days } from "./types";

const home = {
  account: { displayName: "Riya Menon", email: "riya@college.example.in", country: "IN", status: "Active", createdAt: days(-20) },
  usage: {
    plan: "Free", allocatedMinutes: 10, usedMinutes: 6, bonusMinutes: 0, remainingMinutes: 4, resetsAt: days(11), exhausted: false,
    freeMonthlyMinutes: 10, proMonthlyMinutes: 60, proMonthlyPriceCents: 1900, topUpMinutes: 30, topUpPriceCents: 900, currency: "usd",
  },
  portfolio: { credentials: 2, projects: 3, interviews: 5 },
  tools: ["mockInterviews", "voiceDefenses", "buildAndDefend", "credentials"],
  schoolMatches: [{ instituteId: "44444444-4444-4444-8444-444444444444", name: "Sunrise College", via: "email" }],
  links: [{ id: "55555555-5555-4555-8555-555555555555", instituteId: "66666666-6666-4666-8666-666666666666", name: "Hill Institute", carryPortfolio: true, sharing: true, createdAt: days(-3) }],
};

export const freeTierFixtures: ApiFixture[] = [
  { path: "/api/career/free/availability", body: { available: true, code: "available", country: "IN", message: null, minimumAge: 18 } },
  { path: "/api/career/free/me", body: home },
];

export const freeTierRoutes: A11yRoute[] = [
  { name: "free-landing", path: "/free", persona: "public" },
  { name: "free-signup", path: "/free/signup", persona: "student" },
  { name: "free-home", path: "/free/home", persona: "student" },
];
