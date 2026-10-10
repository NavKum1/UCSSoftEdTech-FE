import { type ApiFixture, type FixtureContext, EMPLOYER_ID, INSTITUTE_ID, SCHOOL_NAME, USER_ID, days, hours } from "./types";

const roleFor: Record<string, string[]> = {
  student: ["Student"],
  "career-center": ["CareerAdmin"],
  faculty: ["Faculty"],
  alumni: ["Alumni"],
  employer: [],
  admin: ["CareerAdmin"],
  public: [],
};

function me(ctx: FixtureContext) {
  return {
    userId: USER_ID,
    email: "jordan.lee@lakeside.edu",
    name: "Jordan Lee",
    isSuperAdmin: ctx.persona === "admin",
    memberships: (roleFor[ctx.persona] ?? []).map((role, i) => ({
      id: `m-${i}`,
      instituteId: INSTITUTE_ID,
      school: SCHOOL_NAME,
      slug: "lakeside",
      role,
      status: "Active",
      ferpaHold: false,
    })),
    employers: ctx.persona === "employer" ? [{ id: EMPLOYER_ID, name: "Northwind Analytics", role: "Admin", verificationStatus: "Verified" }] : [],
  };
}

export const employerOrg = {
  id: EMPLOYER_ID,
  name: "Northwind Analytics",
  website: "https://northwind.example",
  emailDomain: "northwind.example",
  industry: "Software",
  sizeBand: "201-500",
  description: "Data tools for regional hospitals.",
  logoUrl: null,
  hqCity: "Columbus",
  hqState: "OH",
  hqCountry: "US",
  verificationStatus: "Verified",
  flagReason: null,
  createdAt: days(-200),
};

/** Shared by every persona: brand, the signed-in user, notifications. Agents' files must not redefine these. */
export const commonFixtures: ApiFixture[] = [
  {
    path: "/api/career/brand",
    body: {
      key: "lakeside",
      displayName: "Lakeside Careers",
      logoUrl: null,
      // A mid-tone brand color: white text on it is below 4.5:1, which the shell must handle
      primaryColor: process.env.A11Y_BRAND_COLOR || "#3b82f6",
      supportEmail: "careers@lakeside.edu",
      privacyUrl: "https://lakeside.example/privacy",
      termsUrl: "https://lakeside.example/terms",
      showPoweredBy: true,
      isWhiteLabel: false,
    },
  },
  { path: "/api/career/me", body: me },
  {
    path: "/api/career/notifications",
    body: (ctx: FixtureContext) =>
      ctx.url.searchParams.get("unreadOnly") === "true"
        ? { unread: 3, items: [] }
        : {
            unread: 2,
            items: [
              { id: "n1", category: "appointments.booked", title: "Appointment confirmed", body: "Your resume review is on Tuesday at 10:00.", link: "/student/appointments", createdAt: hours(-3), readAt: null },
              { id: "n2", category: "documents.reviewed", title: "Feedback on your resume", body: "A counselor left 4 comments.", link: "/student/document-review", createdAt: days(-1), readAt: null },
              { id: "n3", category: "system", title: "Welcome", body: "Your career account is ready.", link: null, createdAt: days(-12), readAt: days(-11) },
            ],
          },
  },
  {
    path: "/api/career/notifications/preferences",
    body: [
      { category: "appointments", inApp: true, email: true },
      { category: "documents", inApp: true, email: false },
      { category: "messages", inApp: true, email: true },
    ],
  },
  { path: "/api/billing/usage", body: { remainingMinutes: 42 } },
  { path: "/api/career/employer", body: [{ employer: employerOrg, role: "Admin" }] },
];
