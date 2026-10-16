/**
 * Fixtures for G14a (placement office: drives, eligibility, rounds, offers), the India report packs (G3 NIRF, G4 NAAC/NBA)
 * and the student's read-only placement record. Shapes follow the interfaces each page casts its response to.
 */
import type { A11yRoute, ApiFixture, FixtureContext } from "./types";
import { days } from "./types";

const ymd = (n: number) => days(n).slice(0, 10);
const DRIVE_ID = "d1d1d1d1-0000-4000-8000-000000000001";

const vocabulary = {
  modes: ["OnCampus", "Virtual", "PoolCampus", "OffCampus"],
  driveStatuses: ["Planned", "InProgress", "Completed", "Cancelled"],
  roundResults: ["Cleared", "NotCleared", "Absent", "Pending"],
  offerStatuses: ["Offered", "Accepted", "Declined", "Revoked"],
  employmentTypes: ["FullTime", "PartTime", "Internship", "Contract", "Fellowship", "ContinuingEducation", "Military", "Volunteer"],
  levels: ["UG", "PG", "PG-Integrated", "Diploma", "PhD"],
  progressionKinds: ["HigherStudies", "QualifyingExam", "Entrepreneurship"],
  progressionLevels: ["UGtoPG", "PGtoMPhil", "PGtoPhD", "MPhilToPhD", "PhDToPostDoc", "Other"],
  exams: ["NET", "SLET", "GATE", "GMAT", "CAT", "GRE", "JAM", "CLAT", "IELTS", "TOEFL", "CivilServices", "StateGovernment", "Other"],
};

const st = (n: number, name: string, signedIn = true) => ({
  membershipId: `m-${n}`,
  userId: signedIn ? `u-${n}` : null,
  name,
  email: `${name.split(" ")[0].toLowerCase()}@college.example.in`,
  studentNumber: `RN00${n}`,
  role: "Student",
  signedIn,
});
const students = [st(1, "Aarav Sharma"), st(2, "Diya Patel"), st(3, "Kabir Rao"), st(4, "Meera Iyer"), st(6, "Sia Verma", false)];

const rec = (n: number, branch: string, cgpa: number | null, extra: Record<string, unknown> = {}) => ({
  id: `r-${n}`,
  membershipId: `m-${n}`,
  rollNumber: `RN00${n}`,
  degree: "B.Tech",
  branch,
  programme: `B.Tech ${branch}`,
  level: "UG",
  durationYears: 4,
  admissionYear: 2021,
  batch: 2025,
  lateralEntry: false,
  cgpa,
  activeBacklogs: 0,
  totalBacklogs: 0,
  class10Percent: 88,
  class12Percent: 84,
  diplomaPercent: null,
  graduatedOnTime: true,
  optedOut: false,
  source: "Import",
  ...extra,
});
const records = [
  rec(1, "Computer Science and Engineering", 8.5),
  rec(2, "Computer Science and Engineering", 6.2, { totalBacklogs: 1 }),
  rec(3, "Electronics and Communication Engineering", 7.8, { activeBacklogs: 1, totalBacklogs: 2 }),
  rec(4, "Computer Science and Engineering", null, { lateralEntry: true, class12Percent: null, diplomaPercent: 78, graduatedOnTime: false }),
  rec(6, "Computer Science and Engineering", 7.0),
];

const drive = {
  id: DRIVE_ID,
  companyName: "Acme Software",
  companyContact: "Campus team, campus@acme.example",
  driveDate: ymd(-20),
  mode: "OnCampus",
  location: "Seminar hall",
  status: "InProgress",
  roles: [{ title: "Graduate Engineer", employmentType: "FullTime", ctcAnnual: 1200000, stipendMonthly: null }],
  batches: [2025],
  degrees: ["B.Tech"],
  branches: ["Computer Science and Engineering", "Electronics and Communication Engineering"],
  minCgpa: 7,
  maxActiveBacklogs: 0,
  maxTotalBacklogs: null,
  minClass10Percent: null,
  minClass12Percent: 60,
  criteriaNotes: "As published in the company's campus brochure.",
  excludePlaced: false,
  notes: null,
};

const offer = (id: string, n: number, company: string, role: string, ctc: number | null, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  driveId: DRIVE_ID,
  membershipId: `m-${n}`,
  student: students.find((s) => s.membershipId === `m-${n}`),
  companyName: company,
  roleTitle: role,
  employmentType: "FullTime",
  ctcAnnual: ctc,
  stipendMonthly: null,
  offerDate: ymd(-15),
  joiningDate: ymd(250),
  location: "Bengaluru",
  status,
  placementId: status === "Accepted" ? "p-1" : null,
  outcomePending: false,
  notes: null,
  ...extra,
});
const offers = [
  offer("o-1", 1, "Acme Software", "Graduate Engineer", 1200000, "Accepted"),
  offer("o-6", 6, "Acme Software", "Graduate Engineer", 800000, "Accepted", { placementId: null, outcomePending: true }),
  offer("o-2", 2, "Acme Software", "Graduate Engineer", 700000, "Declined"),
  offer("o-5", 3, "Delta Analytics", "Data Analyst", 1000000, "Offered", { driveId: null }),
];

const eligRow = (s: (typeof students)[number], status: string, reasons: string[]) => ({ student: s, record: records.find((r) => r.membershipId === s.membershipId) ?? null, status, reasons });

const nirfView = (ctx: FixtureContext) => {
  const key = decodeURIComponent(ctx.url.pathname.split("/").pop() ?? "nirf-go");
  const base = {
    disclaimer: "These tables are prepared from your placement office's records to help fill your own submission. They are not a submission.",
    info: { meta: { years: [2025, 2024], programmes: ["B.Tech Computer Science and Engineering", "B.Tech Electronics and Communication Engineering"], variant: "college" }, warnings: ["1 self-reported outcome record(s) were left out."] },
  };
  if (key === "nba-sar-4-6")
    return {
      ...base,
      pack: { key, name: "NBA SAR: placement, higher studies and entrepreneurship (criterion 4.6)", body: "NBA", plan: "G4", description: "Table 4.6.1 for one programme.", sources: [{ title: "NBA SAR format, GAPC Version 4.0, Tier-II", url: "https://www.nbaind.org/files/sar.pdf", date: "January 2025" }], verifyNote: "Verify against the current NBA SAR manual." },
      tables: [
        {
          key: "nba-4-6-1",
          title: "Table No. 4.6.1: Placement, higher studies, and entrepreneurship details (B.Tech Computer Science and Engineering)",
          columns: [{ label: "Item", verified: true }, { label: "LYG (2024-25)", verified: true }],
          rows: [["FS = Total no. of final year students", 4], ["FS used (after the N + N2 rule in the note) *", 66], ["X = No. of students placed", 3], ["Y = No. of students admitted to higher studies", 1], ["Z = No. of students taking up entrepreneurship", 1], ["X + Y + Z", 5], ["Placement Index (P) = (((X + Y + Z)/FS) * 100)", 7.58]],
          notes: ["Average placement index = 7.58. Placement index points = 2.27 (out of 30)."],
        },
      ],
    };
  return {
    ...base,
    pack: {
      key,
      name: "NIRF Graduation Outcomes: placement and higher studies",
      body: "NIRF",
      plan: "G3",
      description: "Placement and higher studies for the previous three graduating years.",
      sources: [{ title: "NIRF India Rankings 2025 ranking framework", url: "https://www.nirfindia.org/framework.pdf", date: "2025" }],
      verifyNote: "Verify against the current NIRF data-capture format before entering these figures.",
    },
    tables: [
      {
        key: "nirf-UG-4",
        title: "UG [4 Years Program(s)]: Placement & higher studies for previous 2 years",
        columns: [
          "Academic Year",
          "No. of first year students intake in the year",
          "No. of first year students admitted in the year",
          "Academic Year",
          "No. of students admitted through Lateral entry",
          "Academic Year",
          "No. of students graduating in minimum stipulated time",
          "No. of students placed",
          "Median salary of placed graduates(Amount in Rs.)",
          "Median salary in words *",
          "No. of students selected for Higher Studies",
        ].map((label) => ({ label, verified: !label.endsWith(" *") })),
        rows: [
          ["2020-21", null, 1, "2021-22", 0, "2023-24", 1, 1, 1000000, "Ten Lakhs only", 0],
          ["2021-22", 90, 4, "2022-23", 6, "2024-25", 4, 4, 700000, "Seven Lakhs only", 1],
        ],
        notes: ["Median salary: each placed student's highest recorded annual package in rupees."],
      },
    ],
  };
};

export const indiaPlacementsFixtures: ApiFixture[] = [
  {
    path: "/api/career/placement-office",
    body: {
      drives: [
        { id: DRIVE_ID, companyName: "Acme Software", driveDate: ymd(-20), mode: "OnCampus", status: "InProgress", roles: [{ title: "Graduate Engineer", ctcAnnual: 1200000 }], batches: [2025], rounds: 2, offers: 3, accepted: 2 },
        { id: "d2", companyName: "Beta Systems", driveDate: ymd(10), mode: "Virtual", status: "Planned", roles: [], batches: [2025, 2026], rounds: 0, offers: 0, accepted: 0 },
      ],
      totals: { drives: 2, academicRecords: 5, offers: 4, studentsWithAcceptedOffer: 2, highestCtc: 1200000 },
      batches: [2025],
      degrees: ["B.Tech"],
      branches: ["Computer Science and Engineering", "Electronics and Communication Engineering"],
      vocabulary,
      boundary: "Drives here are the placement office's own records.",
    },
  },
  { path: "/api/career/placement-office/academic-records", body: { items: records.map((r) => ({ student: students.find((s) => s.membershipId === r.membershipId), record: r })), studentsWithoutRecord: [], vocabulary } },
  { path: "/api/career/placement-office/offers", body: { items: offers, vocabulary } },
  {
    path: "/api/career/placement-office/progression",
    body: {
      items: [
        { id: "pg-1", membershipId: "m-2", student: students[1], kind: "HigherStudies", year: 2025, institutionJoined: "IIT Bombay", programmeAdmitted: "M.Tech", progressionLevel: "UGtoPG", qualified: false },
        { id: "pg-2", membershipId: "m-2", student: students[1], kind: "QualifyingExam", year: 2025, exam: "GATE", registrationNumber: "GATE-123", qualified: true },
      ],
      vocabulary,
    },
  },
  { path: "/api/career/placement-office/intakes", body: [{ id: "in-1", degree: "B.Tech", branch: "Computer Science and Engineering", level: "UG", durationYears: 4, admissionYear: 2021, sanctionedIntake: 60, admittedFirstYear: null, lateralEntry: 6 }] },
  {
    path: /^\/api\/career\/placement-office\/drives\/[^/]+$/,
    body: {
      drive,
      rounds: [
        { id: "rd-1", sequence: 1, name: "Aptitude test", roundDate: ymd(-20), cleared: 2, recorded: 3 },
        { id: "rd-2", sequence: 2, name: "Technical interview", roundDate: null, cleared: 1, recorded: 2 },
      ],
      participants: [
        { student: students[0], programme: "B.Tech Computer Science and Engineering", batch: 2025, results: [{ roundId: "rd-1", result: "Cleared", outsideCriteria: false }, { roundId: "rd-2", result: "Cleared", outsideCriteria: false }] },
        { student: students[1], programme: "B.Tech Computer Science and Engineering", batch: 2025, results: [{ roundId: "rd-1", result: "NotCleared", outsideCriteria: true }, null] },
        { student: students[4], programme: "B.Tech Computer Science and Engineering", batch: 2025, results: [{ roundId: "rd-1", result: "Cleared", outsideCriteria: false }, { roundId: "rd-2", result: "Absent", outsideCriteria: false }] },
      ],
      offers: offers.filter((o) => o.driveId === DRIVE_ID),
      vocabulary,
    },
  },
  {
    path: /^\/api\/career\/placement-office\/drives\/[^/]+\/eligibility$/,
    body: {
      driveId: DRIVE_ID,
      counts: { eligible: 2, check: 1, notEligible: 2 },
      eligible: [eligRow(students[0], "eligible", []), eligRow(students[4], "eligible", [])],
      check: [eligRow(students[3], "check", ["CGPA not recorded"])],
      notEligible: [eligRow(students[1], "notEligible", ["CGPA 6.2 is below 7"]), eligRow(students[2], "notEligible", ["1 active backlog(s); the limit is 0"])],
      note: "Computed from the academic records against the criteria the company published.",
    },
  },
  {
    path: "/api/career/frameworks/packs",
    body: {
      packs: [
        { key: "nirf-go", name: "NIRF Graduation Outcomes: placement and higher studies", body: "NIRF", plan: "G3", description: "", sources: [], verifyNote: "" },
        { key: "naac-5-2", name: "NAAC student progression (key indicator 5.2)", body: "NAAC", plan: "G4", description: "", sources: [], verifyNote: "" },
        { key: "nba-sar-4-6", name: "NBA SAR: placement, higher studies and entrepreneurship (criterion 4.6)", body: "NBA", plan: "G4", description: "", sources: [], verifyNote: "" },
      ],
      disclaimer: "These tables are prepared from your placement office's records to help fill your own submission. They are not a submission, are not endorsed by NBA, NAAC or NIRF, and do not show that the institution complies with any requirement.",
    },
  },
  { path: /^\/api\/career\/frameworks\/packs\/[^/]+$/, body: nirfView },
  {
    path: "/api/career/placement-office/me",
    body: {
      drives: [
        { id: DRIVE_ID, companyName: "Acme Software", driveDate: ymd(-20), rounds: [{ name: "Aptitude test", roundDate: ymd(-20), result: "Cleared" }, { name: "Technical interview", roundDate: null, result: "Cleared" }] },
        { id: "d2", companyName: "Beta Systems", driveDate: ymd(-5), rounds: [{ name: "Online test", roundDate: null, result: "NotCleared" }] },
      ],
      offers: [{ id: "o-1", companyName: "Acme Software", roleTitle: "Graduate Engineer", employmentType: "FullTime", ctcAnnual: 1200000, stipendMonthly: null, offerDate: ymd(-15), joiningDate: ymd(250), location: "Bengaluru", status: "Accepted" }],
      note: "These are your placement office's records. Ask your placement office to correct anything that looks wrong.",
    },
  },
];

export const indiaPlacementsRoutes: A11yRoute[] = [
  { name: "cc-placements", path: "/career-center/placements", persona: "career-center" },
  { name: "cc-placement-drive", path: `/career-center/placements/${DRIVE_ID}`, persona: "career-center" },
  { name: "cc-reports-india", path: "/career-center/reports/india", persona: "career-center" },
  { name: "student-placements", path: "/student/placements", persona: "student" },
];
