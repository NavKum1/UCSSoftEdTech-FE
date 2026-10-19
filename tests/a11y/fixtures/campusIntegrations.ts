/**
 * Fixtures for H3 (campus-drive messages over WhatsApp/SMS), H5 (offer letters) and H2 (Hire): the chat/SMS settings with the
 * drive-message defaults, the student's chat/SMS page with drive opt-ins, the employer's Hire connection and per-drive Hire
 * status, and the student's offer letter. Shapes follow the interfaces each component casts its response to.
 */
import type { A11yRoute, ApiFixture } from "./types";
import { days, EMPLOYER_ID, SCHOOL_NAME } from "./types";

const DRIVE_ID = "a1a1a1a1-0000-4000-8000-000000000002";
const DRIVE_TYPES = ["drive_announcements", "shortlist_results", "interview_slot_reminders", "offer_notices", "offer_deadline_reminders"];
const TYPES = ["appointment_reminders", "document_review_results", "internship_approvals", "counselor_messages", ...DRIVE_TYPES];
const channels = ["whatsapp", "sms", "messenger"].map((c) => ({ channel: c, implemented: c !== "messenger", platformConfigured: c !== "messenger", schoolConnected: c !== "messenger", schoolEnabled: c !== "messenger", available: c !== "messenger" }));

const settings = {
  canEdit: true, timeZone: "Asia/Kolkata", types: TYPES, optInTypes: DRIVE_TYPES, channels, optedIn: { sms: 42, whatsapp: 17 },
  wappr: { platformEnabled: true, baseUrl: "https://getpulserelay.com", connected: true, workspaceId: "8f8f8f8f-0000-4000-8000-000000000001", keyKind: "partner", keyHint: "…a1b2", hasKey: true, webhookRegistered: true, whatsAppNumberId: null, smsChannelId: null, checkedAt: days(-1), status: "ok" },
  enabledChannels: ["whatsapp", "sms"], allowedTypes: ["appointment_reminders", "drive_announcements", "offer_notices"], quietStart: "21:00", quietEnd: "08:00", allowRecordContent: false,
  whatsAppTemplates: { drive_announcements: { name: "campus_drive_open", language: "en", params: ["brand", "link"] } },
  smsTemplates: { drive_announcements: { dltTemplateId: "1107000000000000301", text: "Lakeside: a new campus drive is open at your college. Details: {link} Reply STOP to opt out." } },
  whatsAppOtpTemplate: null, whatsAppOtpLanguage: null, platformWhatsAppOtpTemplate: "verification_code", smsOtpDltTemplateId: null, smsOtpText: null, updatedAt: days(-1),
};

const defaults = {
  brand: "Lakeside", linkExample: "https://careers.lakeside.example/student/jobs", linkFitsDltVariable: false, workspaceChecked: true,
  notes: ["India SMS needs DLT registration (TRAI TCCCPR 2018).", "Choose the Service Implicit category.", "Links in SMS must be on a whitelisted domain."],
  types: DRIVE_TYPES.map((type, i) => ({
    type, note: "Sent by the placement office.", allowed: i < 2,
    whatsApp: { name: `campus_${type}`, language: "en", category: "UTILITY", params: ["brand", "link"], body: "{{1}}: a campus drive update. Details: {{2}}", approvedInWorkspace: i === 0 },
    sms: { text: "Lakeside: a campus drive update. Details: {link} Reply STOP to opt out.", dltText: "Lakeside: a campus drive update. Details: {#var#} Reply STOP to opt out.", dltCategory: "Service Implicit", matchedDltTemplateId: i === 0 ? "1107000000000000301" : null },
    current: { whatsApp: null, sms: null },
  })),
};

const mine = {
  schoolName: SCHOOL_NAME, brand: "Lakeside", consentVersion: "g7-consent-v1", driveConsentVersion: "h3-drive-notices-v1",
  allowedTypes: ["appointment_reminders", "drive_announcements", "offer_notices"], optInTypes: DRIVE_TYPES, quietStart: "21:00", quietEnd: "08:00", timeZone: "Asia/Kolkata",
  channels: channels.map((c) => ({
    info: c, status: c.channel === "sms" ? "Active" : null, phoneLast4: c.channel === "sms" ? "3210" : null, consentAt: c.channel === "sms" ? days(-10) : null, verifiedAt: c.channel === "sms" ? days(-10) : null,
    optOutAt: null, optOutSource: null, codeExpiresAt: null, mutedTypes: [], optedInTypes: c.channel === "sms" ? ["drive_announcements"] : [],
  })),
};

const hire = {
  hire: {
    platformEnabled: true, canEdit: true, connected: true,
    connection: {
      id: "c0c0c0c0-0000-4000-8000-000000000001", status: "Active", keyHint: "hire_test_ab12cd34_…wxyz", keyEnvironment: "test", hireTenantId: "6b1e2f9a-4c3d-4e5f-8a7b-9c0d1e2f3a4b", hireTenantName: "Northwind (Hire)",
      organizationId: null, scopes: ["hire.jobs.read", "hire.applications.write", "hire.interviews.write"], sharesCompensation: false, hireConnectedAt: days(-20), webhookRegistered: true, webhookUrl: null,
      autoPushApplications: true, jobsSyncedAt: days(-1), reconciledAt: days(-1), lastEventAt: days(-0.5), lastError: null, missingScopes: ["hire.webhooks.manage"],
    },
  },
  syncs: [
    { id: "y-1", kind: "application", entityId: "app-1", status: "Done", attempts: 1, httpStatus: 201, errorCode: null, detail: "Created", updatedAt: days(-1) },
    { id: "y-2", kind: "application", entityId: "app-2", status: "Failed", attempts: 1, httpStatus: null, errorCode: "missing_education", detail: "Add the batch.", updatedAt: days(-1) },
  ],
  events: [{ id: "e-1", type: "application.stage_changed", result: "Applied", detail: null, sequence: 3, occurredAt: days(-0.5), receivedAt: days(-0.5) }],
  counts: { pending: 0, failed: 1, unmatchedEvents: 0 },
};

const driveHire = {
  connected: true, jobLinked: true, hireJobId: "3f1c2a9e-7b4d-4c1e-9f2a-1b2c3d4e5f60", hireJobStatus: "Open",
  applications: [
    { applicationId: "app-1", status: "Offered", hireApplicationId: "a1b2", hireStageCategory: "Offer", hireStageName: "Offer", hireSequence: 7, hireSyncedAt: days(-1), lastSync: { kind: "application", status: "Done", errorCode: null, detail: "Created", updatedAt: days(-1) } },
    { applicationId: "app-2", status: "InProcess", hireApplicationId: null, hireStageCategory: null, hireStageName: null, hireSequence: null, hireSyncedAt: null, lastSync: { kind: "application", status: "Failed", errorCode: "missing_education", detail: null, updatedAt: days(-1) } },
  ],
  vocabulary: { applicationStatusFromHire: { Screen: "InProcess" }, offerStatusFromHire: { Extended: "Offered" } },
};

const letterText = "Offer of employment\n\nFrom: Northwind Analytics\nTo: Aarav Sharma\n\nCost to company (CTC): INR 12,00,000 per year.\nCTC breakup (per year):\n- Basic: INR 6,00,000\n- HRA: INR 3,00,000\n- Special allowance: INR 3,00,000\n\nJoining date: 15 July 2027\n\nBy signing below I accept this offer on these terms.";

export const campusIntegrationsFixtures: ApiFixture[] = [
  { path: "/api/career/channels/admin/settings", body: settings },
  { path: "/api/career/channels/admin/template-defaults", body: defaults },
  { path: "/api/career/channels/me", body: mine },
  { path: `/api/career/campus/employer/${EMPLOYER_ID}/hire`, body: hire },
  { path: new RegExp(`^/api/career/campus/(employer/${EMPLOYER_ID}|staff)/drives/${DRIVE_ID}/hire$`), body: driveHire },
  {
    path: "/api/career/campus/student/offers/o-1/letter",
    body: {
      letter: { id: "l-1", offerId: "o-1", version: 1, kind: "Generated", status: "Issued", companyName: "Northwind Analytics", roleTitle: "Software Engineer", ctcAnnual: 1200000, ctcBreakup: [{ label: "Basic", amount: 600000 }], joiningDate: days(250).slice(0, 10), respondBy: days(14).slice(0, 10), text: letterText, sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", hasFile: true, hasSignedCopy: false, issuedBy: "Employer", issuedAt: days(-1) },
      offerStatus: "Offered", canSign: true, sharesSignedCopyWith: "Northwind Analytics", signatureProvider: "builtin",
    },
  },
];

export const campusIntegrationsRoutes: A11yRoute[] = [
  { name: "cc-chat-sms", path: "/career-center/settings/chat-sms", persona: "career-center", ready: "table" },
  { name: "student-chat-sms", path: "/student/chat-sms", persona: "student" },
];
