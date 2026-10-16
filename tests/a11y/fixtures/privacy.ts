/** Fixtures for G18 privacy: student purpose consent and rights, career-center privacy queue, guardian consent link, operator incidents. */
import type { A11yRoute, ApiFixture } from "./types";
import { INSTITUTE_ID, days } from "./types";

const policy = { countryCode: "IN", law: "India DPDP Act 2023", minorAge: 18, guardianConsentRequired: true, purposeConsentRequired: true, rightsResponseDays: 90, noticeVersion: "2026-10", noticeUrl: "https://lakeside.example/privacy" };
const purposes = [
  { key: "EmployerSharing", title: "Sharing with employers and partners", description: "Your school may share the parts of your career record you choose with approved employers.", status: "Granted", allowed: true, grantedBy: "Guardian", grantedAt: days(-10), noticeVersion: "2026-10" },
  { key: "Mentoring", title: "Sharing with mentors", description: "Your school may share your profile with mentors you are matched with.", status: "NotRecorded", allowed: false, reason: "A parent or guardian must consent first." },
  { key: "AiFeatures", title: "AI-assisted features", description: "Career staff may use an AI assistant to draft outreach about you.", status: "Withdrawn", allowed: false, withdrawnAt: days(-2), reason: "Consent was withdrawn." },
  { key: "NationalCredentials", title: "Publishing to national credential repositories", description: "Your school may publish your certificates to DigiLocker.", status: "NotRecorded", allowed: false },
];
const req = (id: string, type: string, status: string, extra: object = {}) => ({
  id, type, status, details: type === "Correction" ? "My graduation year is wrong" : null, requestedBy: "Student", submittedAt: days(-5), dueAt: days(85),
  completedAt: status === "Completed" ? days(-1) : null, resolutionNote: null, exportAvailableUntil: status === "Completed" ? days(29) : null,
  overdue: false, exportReady: type === "Export" && status === "Completed", membershipId: "m-1", ...extra,
});
const guardian = { id: "g-1", name: "Meena Kumar", email: "meena@example.in", relationship: "Parent", status: "Consented", respondedAt: days(-10), method: "EmailLink+Attestation", noticeVersion: "2026-10" };

export const privacyFixtures: ApiFixture[] = [
  {
    path: "/api/career/privacy/student",
    body: { policy, isMinor: true, guardianConsentNeeded: true, purposes, guardians: [{ ...guardian, email: "m*****@example.in" }], requests: [req("r-1", "Export", "Completed"), req("r-2", "Correction", "Submitted")] },
  },
  {
    path: "/api/career/privacy/admin/requests",
    body: {
      counts: { open: 2, overdue: 1 },
      requests: [
        { request: req("r-2", "Correction", "Submitted"), student: { name: "Ravi Shah", email: "ravi@lakeside.edu" } },
        { request: req("r-3", "Erasure", "InProgress", { overdue: true, dueAt: days(-1) }), student: { name: "Asha Rao", email: "asha@lakeside.edu" } },
      ],
    },
  },
  {
    path: "/api/career/privacy/admin/minors",
    body: { policy, students: [{ membershipId: "m-1", userId: "u-1", name: "Ravi Shah", email: "ravi@lakeside.edu", dateOfBirth: "2010-04-02", underAge: null, ageSource: "Roster", isMinor: true, guardianConsented: true, guardians: [guardian] }] },
  },
  { path: "/api/career/privacy/admin/policy", body: { effective: policy, overrides: { countryCode: "IN", noticeVersion: "2026-10" }, countryDefaults: policy, canEdit: true } },
  {
    path: "/api/career/privacy/admin/retention",
    body: {
      canEdit: true,
      periods: [
        { recordType: "Notifications", globalDays: 365, minimumDays: 30, schoolDays: 90, effectiveDays: 90 },
        { recordType: "AuditEvents", globalDays: 2555, minimumDays: 365, schoolDays: null, effectiveDays: 2555 },
        { recordType: "AiGenerationLogs", globalDays: 365, minimumDays: 30, schoolDays: null, effectiveDays: 365 },
      ],
    },
  },
  {
    path: /^\/api\/career\/privacy\/guardian\/[^/]+$/,
    body: { school: "Lakeside State University", studentFirstName: "Ravi", guardianName: "Meena Kumar", relationship: "Parent", status: "Invited", minorAge: 18, law: "India DPDP Act 2023", noticeVersion: "2026-10", noticeUrl: null, expiresAt: days(13), purposes: purposes.map((p) => ({ key: p.key, title: p.title, description: p.description, granted: false })) },
  },
  {
    path: "/api/career/platform/privacy/incidents",
    body: [{ id: "i-1", title: "Misdirected export", description: "A CSV was emailed to the wrong address.", severity: "High", status: "Open", discoveredAt: days(-1), allSchools: false, instituteIds: [INSTITUTE_ID], notified: {} }],
  },
];

export const privacyRoutes: A11yRoute[] = [
  { name: "cc-privacy", path: "/career-center/privacy", persona: "career-center" },
  { name: "guardian-consent", path: "/guardian/consent/test-token", persona: "public" },
  { name: "admin-incidents", path: "/admin/career/incidents", persona: "admin" },
];
