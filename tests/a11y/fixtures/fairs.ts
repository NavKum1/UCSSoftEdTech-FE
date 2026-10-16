import { type A11yRoute, type ApiFixture, EMPLOYER_ID, INSTITUTE_ID, SCHOOL_NAME, days } from "./types";

const events = [
  { id: "ev-1", name: "Fall Career & Internship Fair", status: "live", type: "fair", isCareerFair: true, startsAt: days(9), venue: "Student Union Ballroom", locationType: "in_person", publicUrl: "https://events.example/fall-fair", directoryUrl: "https://events.example/fall-fair/employers", manageUrl: "https://events.example/manage/ev-1" },
  { id: "ev-2", name: "Virtual STEM Fair", status: "draft", type: "fair", isCareerFair: true, startsAt: days(30), venue: null, locationType: "virtual", publicUrl: "https://events.example/stem", directoryUrl: null, manageUrl: "https://events.example/manage/ev-2" },
  { id: "ev-3", name: "Resume Workshop", status: "past", type: "workshop", isCareerFair: false, startsAt: days(-14), venue: "Library 204", locationType: "in_person", publicUrl: null, directoryUrl: null, manageUrl: null },
];

/** Career fairs (C5) pages: student, career center and employer. */
export const fairsFixtures: ApiFixture[] = [
  { path: "/api/career/events/student/fairs", body: { configured: true, events: events.slice(0, 2) } },
  {
    path: "/api/career/events/attendspot/connection",
    body: { configured: true, canEdit: true, manageUrl: "https://events.example/manage", active: true, lastSyncAt: days(-1), lastWebhookAt: days(-1), apiBaseUrl: "https://events.example/api", apiKeyHint: "…a91f", hasWebhookSecret: true, webhookUrl: "https://api.example/webhooks/events" },
  },
  { path: "/api/career/events/staff", body: { configured: true, events } },
  {
    path: /^\/api\/career\/events\/staff\/[^/]+\/fair$/,
    body: {
      booths: [
        { id: "b1", companyName: "Northwind Analytics", website: "https://northwind.example", tier: "Gold", boothCell: "A4", status: "confirmed", consentedLeadCount: 37 },
        { id: "b2", companyName: "Contoso Health", website: null, tier: null, boothCell: null, status: "pending", consentedLeadCount: 0 },
      ],
      attendance: [
        { status: "registered", count: 412 },
        { status: "checked_in", count: 0 },
      ],
    },
  },
  { method: "POST", path: "/api/career/events/staff/sync", body: { fairs: 2, booths: 14, matchedEmployers: 9 } },
  {
    path: `/api/career/events/employer/${EMPLOYER_ID}/fairs`,
    body: {
      schools: [
        { instituteId: INSTITUTE_ID, school: SCHOOL_NAME, events: events.slice(0, 2).map((e) => ({ ...e, exhibitUrl: `https://events.example/${e.id}/exhibit` })) },
        { instituteId: "inst-2", school: "Riverside Community College", error: "This school's event system is not connected yet.", events: [] },
      ],
    },
  },
];

export const fairsRoutes: A11yRoute[] = [
  { name: "student-fairs", path: "/student/fairs", persona: "student" },
  { name: "cc-fairs", path: "/career-center/fairs", persona: "career-center" },
  { name: "employer-fairs", path: "/employer/fairs", persona: "employer" },
];
