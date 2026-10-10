/**
 * Career-center pages, part B: international, interviews (+ reports), mentoring, messages, notifications, outcomes,
 * people, privacy log, reports, settings and SIS settings. Shapes follow the interfaces each page casts its response to.
 */

import { type ApiFixture, type A11yRoute, type FixtureContext, EMPLOYER_ID, INSTITUTE_ID, SCHOOL_NAME, USER_ID, days, hours } from "./types";

/** yyyy-mm-dd relative to today */
const ymd = (n: number) => days(n).slice(0, 10);
const lastSegment = (ctx: FixtureContext) => decodeURIComponent(ctx.url.pathname.split("/").pop() ?? "");
const param = (ctx: FixtureContext, key: string) => ctx.url.searchParams.get(key) ?? "";

// ---------------------------------------------------------------------------------------------------------------
// International (OPT tracker staff view, DSO contact, employer sponsorship links, LCA lookup)
// ---------------------------------------------------------------------------------------------------------------

const dso = {
  name: "Priya Raman",
  email: "intl-office@lakeside.edu",
  phone: "(614) 555-0142",
  officeUrl: "https://lakeside.example/international",
  note: "Drop-in OPT advising is Tuesdays and Thursdays, 1–4 pm, in Hensley Hall 210.",
  configured: true,
  careerCenterEmail: "careers@lakeside.edu",
};

const intlDisclaimer = "Students enter these dates themselves. This is not legal advice; the DSO confirms each case against SEVIS.";

const staffStudents = [
  {
    studentUserId: "f1-001",
    name: "Wei Zhang",
    email: "wzhang@lakeside.edu",
    studentNumber: "A10458213",
    programEndDate: ymd(-140),
    currentOptType: "PostCompletion",
    eadEnd: ymd(220),
    state: "Active",
    daysUsed: 74,
    limit: 90,
    daysRemaining: 16,
    level: "urgent",
    hasStem: false,
    employedToday: false,
    unreportedChanges: 1,
    overdueItems: 1,
    nextDue: { label: "Report new employer", dueOn: ymd(-2), status: "overdue" },
  },
  {
    studentUserId: "f1-002",
    name: "Ananya Iyer",
    email: "aiyer@lakeside.edu",
    studentNumber: "A10461177",
    programEndDate: ymd(-400),
    currentOptType: "StemExtension",
    eadEnd: ymd(500),
    state: "Active",
    daysUsed: 32,
    limit: 150,
    daysRemaining: 118,
    level: "ok",
    hasStem: true,
    employedToday: true,
    unreportedChanges: 0,
    overdueItems: 0,
    nextDue: { label: "12-month STEM self-evaluation", dueOn: ymd(40), status: "upcoming" },
  },
  {
    studentUserId: "f1-003",
    name: "Mateo Gutierrez",
    email: "mgutierrez@lakeside.edu",
    studentNumber: "A10470032",
    programEndDate: ymd(60),
    currentOptType: null,
    eadEnd: null,
    state: "PreCompletionOnly",
    daysUsed: 0,
    limit: 90,
    daysRemaining: 90,
    level: "ok",
    hasStem: false,
    employedToday: false,
    unreportedChanges: 2,
    overdueItems: 0,
    nextDue: null,
  },
];

const optRules = {
  postCompletionUnemploymentDays: 90,
  stemAdditionalUnemploymentDays: 60,
  stemTotalUnemploymentDays: 150,
  minHoursPerWeek: 20,
  combineHoursAcrossJobs: true,
  postCompletionWarningDays: [60, 75, 85],
  stemWarningDays: [120, 135, 145],
  reportingWindowDays: 10,
  stemEvaluationMonths: [12, 24],
  stemValidationReportMonths: 6,
  fullTimeCptLimitDays: 365,
  note: "General guidance from SEVP policy; your DSO applies it to your case.",
};

function studentDetail(ctx: FixtureContext) {
  const id = lastSegment(ctx);
  const row = staffStudents.find((s) => s.studentUserId === id) ?? staffStudents[0];
  return {
    student: { userId: row.studentUserId, name: row.name, email: row.email, studentNumber: row.studentNumber, workAuthorization: "F1" },
    view: {
      eligible: true,
      workAuthorization: "F1",
      disclaimer: intlDisclaimer,
      asOf: ymd(0),
      dso,
      tracker: { id: `trk-${row.studentUserId}`, programEndDate: row.programEndDate, notes: null, updatedAt: days(-3) },
      authorizations: [
        {
          id: "auth-1",
          optType: "PostCompletion",
          label: "Post-completion OPT",
          eadStart: ymd(-130),
          eadEnd: ymd(220),
          countsTowardUnemployment: true,
          evaluations: null,
        },
        {
          id: "auth-0",
          optType: "PreCompletion",
          label: "Pre-completion OPT (summer)",
          eadStart: ymd(-480),
          eadEnd: ymd(-400),
          countsTowardUnemployment: false,
          evaluations: [{ month: 12, dueOn: ymd(30), submittedOn: null }],
        },
      ],
      employments: [
        {
          id: "emp-1",
          employerName: "Buckeye Health Systems",
          jobTitle: "Data Analyst",
          startDate: ymd(-120),
          endDate: ymd(-60),
          hoursPerWeek: 40,
          relatedToMajor: true,
          relationExplanation: "Statistical analysis of patient outcomes uses my MS Analytics coursework.",
          eVerifyEmployer: true,
          startReportedOn: ymd(-115),
          endReportedOn: null,
          countsForPostCompletion: true,
          countsForStem: true,
        },
        {
          id: "emp-2",
          employerName: "Campus Bookstore",
          jobTitle: "Sales Associate",
          startDate: ymd(-30),
          endDate: null,
          hoursPerWeek: 12,
          relatedToMajor: false,
          relationExplanation: null,
          eVerifyEmployer: false,
          startReportedOn: null,
          endReportedOn: null,
          countsForPostCompletion: false,
          countsForStem: false,
        },
      ],
      status: {
        state: row.state,
        daysUsed: row.daysUsed,
        limit: row.limit,
        daysRemaining: row.daysRemaining,
        hasStem: row.hasStem,
        employedToday: row.employedToday,
        phaseToday: "PostCompletion",
        level: row.level,
        nextWarningAt: 85,
        limitReachedOn: ymd(16),
        countingFrom: ymd(-130),
        countingThrough: ymd(0),
        warningThresholds: [60, 75, 85],
        unemployedSpans: [
          { start: ymd(-130), end: ymd(-121), days: 10, phase: "PostCompletion" },
          { start: ymd(-59), end: ymd(0), days: 64, phase: "PostCompletion" },
        ],
      },
      deadlines: [
        { key: "d1", kind: "EmploymentReport", label: "Report end of employment at Buckeye Health Systems", dueOn: ymd(-50), status: "overdue", refId: "emp-1" },
        { key: "d2", kind: "EmploymentReport", label: "Report new employer", dueOn: ymd(-2), status: "due", refId: "emp-2" },
        { key: "d3", kind: "Evaluation", label: "12-month self-evaluation", dueOn: ymd(30), status: "upcoming", refId: "auth-0" },
        { key: "d4", kind: "EmploymentReport", label: "Report start at Buckeye Health Systems", dueOn: ymd(-110), status: "done", refId: "emp-1" },
      ],
      checks: [
        { level: "bad", text: "The end of the Buckeye Health Systems job has not been reported to the DSO." },
        { level: "warn", text: "The bookstore job is under 20 hours a week and unrelated to the major, so it does not stop the count." },
        { level: "info", text: "16 unemployment days remain before the 90-day limit." },
      ],
      cpt: {
        fullTimeDays: 84,
        limitDays: 365,
        periods: [{ startDate: ymd(-600), endDate: ymd(-516), hoursPerWeek: 40, employerName: "Columbus Metro Transit", fullTime: true }],
      },
      rules: optRules,
      optTypes: [
        { value: "PreCompletion", label: "Pre-completion" },
        { value: "PostCompletion", label: "Post-completion" },
        { value: "StemExtension", label: "STEM extension" },
      ],
    },
  };
}

const sponsorSummaries = [
  {
    normalizedKey: "northwind-analytics",
    name: "Northwind Analytics Inc.",
    otherNames: ["Northwind Analytics Inc.", "Northwind Analytics LLC"],
    totalCases: 212,
    totalCertified: 198,
    firstFiscalYear: 2021,
    latestFiscalYear: 2025,
    latestCertified: 51,
  },
  {
    normalizedKey: "buckeye-health-systems",
    name: "Buckeye Health Systems",
    otherNames: ["Buckeye Health Systems"],
    totalCases: 64,
    totalCertified: 60,
    firstFiscalYear: 2023,
    latestFiscalYear: 2025,
    latestCertified: 22,
  },
];

const intlFixtures: ApiFixture[] = [
  { path: "/api/career/international/settings", body: { dso, canEdit: true, disclaimer: intlDisclaimer } },
  { method: "PUT", path: "/api/career/international/settings", body: { dso, canEdit: true, disclaimer: intlDisclaimer } },
  {
    path: "/api/career/international/staff/students",
    body: (ctx: FixtureContext) => {
      const filter = param(ctx, "filter");
      const items =
        filter === "at-risk"
          ? staffStudents.filter((s) => s.level !== "ok")
          : filter === "active"
            ? staffStudents.filter((s) => s.state === "Active")
            : filter === "unemployed"
              ? staffStudents.filter((s) => s.state === "Active" && !s.employedToday)
              : staffStudents;
      return { asOf: ymd(0), total: items.length, atRisk: items.filter((s) => s.level !== "ok").length, items, dso, disclaimer: intlDisclaimer };
    },
  },
  { path: /^\/api\/career\/international\/staff\/students\/[^/]+$/, body: studentDetail },
  {
    path: "/api/career/international/staff/employer-links",
    body: {
      disclaimer: "Matches use public Department of Labor LCA filings and may not be the same legal entity.",
      items: [
        {
          employerId: EMPLOYER_ID,
          name: "Northwind Analytics",
          website: "https://northwind.example",
          relationship: "Approved",
          normalizedName: "northwind analytics",
          link: { employerKey: "northwind-analytics", method: "Auto", confirmed: false, updatedAt: days(-5) },
          sponsor: { employerKey: "northwind-analytics", displayName: "Northwind Analytics Inc.", totalCertified: 198, latestFiscalYear: 2025, latestCertified: 51 },
        },
        {
          employerId: "emp-buckeye",
          name: "Buckeye Health Systems",
          website: "https://buckeyehealth.example",
          relationship: "Approved",
          normalizedName: "buckeye health systems",
          link: { employerKey: "buckeye-health-systems", method: "Staff", confirmed: true, updatedAt: days(-20) },
          sponsor: { employerKey: "buckeye-health-systems", displayName: "Buckeye Health Systems", totalCertified: 60, latestFiscalYear: 2025, latestCertified: 22 },
        },
        {
          employerId: "emp-riverbend",
          name: "Riverbend Credit Union",
          website: null,
          relationship: "Pending",
          normalizedName: "riverbend credit union",
          link: { employerKey: null, method: "NoMatch", confirmed: true, updatedAt: days(-9) },
          sponsor: null,
        },
      ],
    },
  },
  { path: "/api/career/international/sponsors", body: { items: sponsorSummaries } },
  {
    path: /^\/api\/career\/international\/sponsors\/[^/]+$/,
    body: (ctx: FixtureContext) => {
      const employer = sponsorSummaries.find((s) => s.normalizedKey === lastSegment(ctx)) ?? sponsorSummaries[0];
      return {
        employer,
        disclaimer: "Past LCA filings show an employer has sponsored before; they do not promise sponsorship for any job.",
        years: [
          {
            fiscalYear: 2025,
            displayName: employer.name,
            totalCases: 54,
            certified: 51,
            certifiedWithdrawn: 2,
            denied: 0,
            withdrawn: 1,
            wages: { min: 78000, median: 104500, max: 168000, basis: "Year" },
            names: [employer.name],
            topJobTitles: [
              { title: "Data Scientist", count: 18 },
              { title: "Software Engineer", count: 15 },
            ],
            topSocCodes: [{ code: "15-2051", title: "Data Scientists", count: 18 }],
            states: [
              { state: "OH", count: 40 },
              { state: "IL", count: 11 },
            ],
            visaClasses: [{ visaClass: "H-1B", count: 54 }],
          },
          {
            fiscalYear: 2024,
            displayName: employer.name,
            totalCases: 47,
            certified: 44,
            certifiedWithdrawn: 0,
            denied: 1,
            withdrawn: 2,
            wages: { min: null, median: null, max: null, basis: "Year" },
            names: [employer.name],
            topJobTitles: [],
            topSocCodes: [],
            states: [],
            visaClasses: [{ visaClass: "H-1B", count: 47 }],
          },
        ],
      };
    },
  },
  {
    path: "/api/career/international/sponsor-meta",
    body: {
      lastUpdated: days(-30),
      fiscalYears: [2021, 2022, 2023, 2024, 2025],
      employers: 61234,
      disclaimer: "Sponsorship history comes from public U.S. Department of Labor LCA disclosure data. It is not a list of jobs.",
      source: "U.S. Department of Labor, Office of Foreign Labor Certification",
    },
  },
];

// ---------------------------------------------------------------------------------------------------------------
// On-campus interviews
// ---------------------------------------------------------------------------------------------------------------

function schedule(o: Record<string, unknown>) {
  return {
    id: "ocr-1",
    instituteId: INSTITUTE_ID,
    school: SCHOOL_NAME,
    employerId: EMPLOYER_ID,
    employerName: "Northwind Analytics",
    positionTitle: "Associate Data Analyst",
    description: "First-round behavioral interviews; bring a printed resume.",
    externalJobUrl: "https://northwind.example/careers/associate-data-analyst",
    externalJobId: "NW-2291",
    externalJobSource: "Website",
    virtual: false,
    virtualUrl: null,
    tracks: 2,
    slotMinutes: 30,
    breakMinutes: 10,
    days: [
      { date: ymd(14), start: "09:00", end: "16:00", lunchStart: "12:00", lunchEnd: "13:00" },
      { date: ymd(15), start: "09:00", end: "12:00", lunchStart: null, lunchEnd: null },
    ],
    interviewers: [
      { name: "Dana Whitfield", email: "dwhitfield@northwind.example" },
      { name: "Luis Ortega", email: "lortega@northwind.example" },
    ],
    signupType: "Open",
    degreeLevels: ["Bachelor", "Master"],
    majors: ["Statistics", "Computer Science"],
    gradFrom: "2026-12",
    gradTo: "2027-06",
    workAuthRequirement: "AuthorizedUS",
    workAuthStatement: "Candidates must be authorized to work in the US.",
    signupOpensAt: days(2),
    signupClosesAt: days(10),
    cancelCutoffHours: 48,
    status: "Requested",
    decisionNote: null,
    publishedAt: null,
    createdAt: days(-6),
    extra: { roomsAssigned: 0, roomsNeeded: 4, booked: 0, slots: 22 },
    ...o,
  };
}

const ocrSchedules = [
  schedule({}),
  schedule({
    id: "ocr-2",
    employerId: "emp-buckeye",
    employerName: "Buckeye Health Systems",
    positionTitle: "Nurse Resident",
    description: null,
    externalJobUrl: null,
    externalJobId: null,
    tracks: 1,
    days: [{ date: ymd(21), start: "10:00", end: "15:00", lunchStart: null, lunchEnd: null }],
    interviewers: [{ name: "Karen Holt", email: null }],
    signupType: "PreSelect",
    degreeLevels: ["Bachelor"],
    majors: ["Nursing"],
    gradFrom: null,
    gradTo: null,
    workAuthRequirement: "None",
    status: "Approved",
    createdAt: days(-12),
    extra: { roomsAssigned: 0, roomsNeeded: 1, booked: 0, slots: 10 },
  }),
  schedule({
    id: "ocr-3",
    employerId: "emp-riverbend",
    employerName: "Riverbend Credit Union",
    positionTitle: "Finance Intern",
    virtual: true,
    virtualUrl: "https://meet.example/riverbend",
    tracks: 1,
    days: [{ date: ymd(3), start: "13:00", end: "15:00", lunchStart: null, lunchEnd: null }],
    interviewers: [{ name: "Marcus Bell", email: "mbell@riverbend.example" }],
    signupType: "Alternates",
    degreeLevels: [],
    majors: [],
    gradFrom: null,
    gradTo: null,
    workAuthRequirement: "NoSponsorship",
    status: "Published",
    publishedAt: days(-4),
    createdAt: days(-20),
    extra: { roomsAssigned: 0, roomsNeeded: 0, booked: 3, slots: 4 },
  }),
  schedule({
    id: "ocr-4",
    employerId: "emp-lakeshore",
    employerName: "Lakeshore Engineering",
    positionTitle: "Field Engineer I",
    status: "Declined",
    decisionNote: "Dates conflict with finals week.",
    createdAt: days(-30),
    extra: null,
  }),
];

const ocrRooms = [
  { id: "room-1", name: "Interview Room A", building: "Career Center", capacity: 4, notes: null, active: true, blocks: [] },
  {
    id: "room-2",
    name: "Interview Room B",
    building: "Career Center",
    capacity: 2,
    notes: "Has a whiteboard",
    active: true,
    blocks: [{ id: "blk-1", startUtc: days(14), endUtc: hours(14 * 24 + 3), note: "Carpet cleaning" }],
  },
  { id: "room-3", name: "Hensley 105", building: "Hensley Hall", capacity: 6, notes: null, active: false, blocks: [] },
];

function ocrDetail(ctx: FixtureContext) {
  const s = ocrSchedules.find((x) => x.id === lastSegment(ctx)) ?? ocrSchedules[0];
  const firstDay = s.days[0].date;
  const slotAt = (h: number) => `${firstDay}T${String(h).padStart(2, "0")}:00:00.000Z`;
  const slotEnd = (h: number) => `${firstDay}T${String(h).padStart(2, "0")}:30:00.000Z`;
  const booked = s.status === "Published";
  return {
    ...s,
    extra: {
      timeZone: "America/New_York",
      assignments: s.status === "Requested" ? [] : [{ date: firstDay, track: 0, roomId: "room-1" }],
      slots:
        s.status === "Requested"
          ? []
          : [
              {
                id: `${s.id}-slot-1`,
                date: firstDay,
                track: 0,
                startUtc: slotAt(17),
                endUtc: slotEnd(17),
                room: s.virtual ? "" : "Interview Room A",
                interviewer: s.interviewers[0].name,
                booking: booked ? { id: "bk-1", student: "Aaliyah Brooks", source: "Signup", attendance: null } : null,
              },
              {
                id: `${s.id}-slot-2`,
                date: firstDay,
                track: 0,
                startUtc: slotAt(18),
                endUtc: slotEnd(18),
                room: s.virtual ? "" : "Interview Room A",
                interviewer: s.interviewers[0].name,
                booking: booked ? { id: "bk-2", student: "Jamal Carter", source: "Promoted", attendance: null } : null,
              },
              {
                id: `${s.id}-slot-3`,
                date: firstDay,
                track: 0,
                startUtc: slotAt(19),
                endUtc: slotEnd(19),
                room: s.virtual ? "" : "Interview Room A",
                interviewer: null,
                booking: null,
              },
            ],
      candidates: booked
        ? [
            { id: "c1", name: "Aaliyah Brooks", email: "abrooks@lakeside.edu", source: "Signup", tier: "Primary", status: "Booked" },
            { id: "c2", name: "Jamal Carter", email: "jcarter@lakeside.edu", source: "Invited", tier: "Alternate", status: "Booked" },
            { id: "c3", name: "Hannah Kim", email: "hkim@lakeside.edu", source: "Invited", tier: "Alternate", status: "Waitlisted" },
          ]
        : [],
    },
  };
}

const today = new Date();
const atLocal = (h: number, m = 0) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m).toISOString();

const ocrFixtures: ApiFixture[] = [
  {
    path: "/api/career/ocr/staff/schedules",
    body: (ctx: FixtureContext) => {
      const status = param(ctx, "status");
      return status ? ocrSchedules.filter((s) => s.status === status) : ocrSchedules;
    },
  },
  { path: /^\/api\/career\/ocr\/staff\/schedules\/[^/]+$/, body: ocrDetail },
  { path: "/api/career/ocr/staff/rooms", body: ocrRooms },
  {
    path: "/api/career/ocr/staff/day/print",
    contentType: "text/html",
    body: "<!doctype html><html lang=\"en\"><head><title>Interview agendas</title></head><body><h1>Interview agendas</h1></body></html>",
  },
  {
    path: "/api/career/ocr/staff/day",
    body: (ctx: FixtureContext) => ({
      date: param(ctx, "date") || ymd(0),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      rooms: [
        {
          roomId: "room-1",
          room: "Interview Room A",
          slots: [
            {
              slotId: "day-1",
              startUtc: atLocal(9),
              endUtc: atLocal(9, 30),
              employer: "Northwind Analytics",
              position: "Associate Data Analyst",
              interviewer: "Dana Whitfield",
              booking: { id: "bk-10", student: "Aaliyah Brooks", email: "abrooks@lakeside.edu", checkedInAt: atLocal(8, 50), attendance: "Attended" },
            },
            {
              slotId: "day-2",
              startUtc: atLocal(9, 40),
              endUtc: atLocal(10, 10),
              employer: "Northwind Analytics",
              position: "Associate Data Analyst",
              interviewer: "Dana Whitfield",
              booking: { id: "bk-11", student: "Jamal Carter", email: "jcarter@lakeside.edu", checkedInAt: null, attendance: null },
            },
            {
              slotId: "day-3",
              startUtc: atLocal(10, 20),
              endUtc: atLocal(10, 50),
              employer: "Northwind Analytics",
              position: "Associate Data Analyst",
              interviewer: null,
              booking: null,
            },
          ],
        },
        {
          roomId: null,
          room: "Virtual",
          slots: [
            {
              slotId: "day-4",
              startUtc: atLocal(13),
              endUtc: atLocal(13, 30),
              employer: "Riverbend Credit Union",
              position: "Finance Intern",
              interviewer: "Marcus Bell",
              booking: { id: "bk-12", student: "Hannah Kim", email: "hkim@lakeside.edu", checkedInAt: null, attendance: "NoShow" },
            },
          ],
        },
      ],
    }),
  },
  {
    path: "/api/career/ocr/staff/no-shows",
    body: {
      noShowLimit: 2,
      students: [
        { studentUserId: "stu-31", name: "Tyler Nguyen", email: "tnguyen@lakeside.edu", noShows: 2, blocked: true },
        { studentUserId: "stu-32", name: "Grace Okafor", email: "gokafor@lakeside.edu", noShows: 1, blocked: false },
      ],
    },
  },
  { path: "/api/career/ocr/staff/settings", body: { noShowLimit: 2, defaultCancelCutoffHours: 48 } },
  {
    path: "/api/career/ocr/staff/reports/summary",
    body: {
      schedulesByStatus: { Published: 6, Approved: 2, Requested: 3, Declined: 1 },
      employers: 9,
      slotsOffered: 184,
      interviewsBooked: 151,
      fillRate: 82,
      cancellations: 14,
      promotedFromAlternates: 9,
      attended: 139,
      noShows: 7,
      uniqueStudents: 118,
      outcomes: { Offer: 21, NoOffer: 48, Pending: 70 },
      byEmployer: [
        { employer: "Northwind Analytics", interviews: 44, noShows: 2, offers: 8 },
        { employer: "Buckeye Health Systems", interviews: 38, noShows: 1, offers: 7 },
        { employer: "Riverbend Credit Union", interviews: 21, noShows: 3, offers: 2 },
      ],
    },
  },
  {
    path: "/api/career/ocr/staff/reports/interviews.csv",
    contentType: "text/csv",
    body: "Employer,Position,Student,Date,Attendance,Outcome\nNorthwind Analytics,Associate Data Analyst,Aaliyah Brooks,2026-10-24,Attended,Offer\n",
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Mentoring
// ---------------------------------------------------------------------------------------------------------------

const mentoringOptions = {
  topics: [
    { key: "resume", label: "Resume and LinkedIn" },
    { key: "interviewing", label: "Interviewing" },
    { key: "industry", label: "Exploring an industry" },
    { key: "grad-school", label: "Graduate school" },
  ],
  meetingFormats: ["Video", "Phone", "InPerson", "Email"],
  reportReasons: ["Inappropriate", "Harassment", "Unresponsive", "Spam", "SafetyConcern", "Other"],
  functions: ["Engineering", "Finance", "Healthcare", "Marketing"],
  industries: ["Software", "Healthcare", "Banking", "Manufacturing"],
  requireStaffApproval: true,
  maxOpenRequests: 3,
  scoring: "Shared major, topics and industry, weighted toward mentors with open capacity.",
};

const staffMentors = [
  {
    profile: {
      id: "mp-1",
      name: "Rachel Donovan",
      email: "rachel.donovan@alumni.lakeside.edu",
      kind: "Alumni",
      status: "Pending",
      headline: "Product manager helping students break into tech",
      employer: "Northwind Analytics",
      jobTitle: "Senior Product Manager",
      industry: "Software",
      majors: ["Computer Science"],
      topics: ["resume", "interviewing"],
      meetingPreferences: ["Video", "Email"],
      capacity: 3,
      activeMentees: 0,
      bio: "Class of 2014. I moved from QA into product and love talking about non-linear paths.",
      availabilityNotes: "Weekday evenings",
      decisionNote: null,
      submittedAt: days(-2),
    },
    matchingPaused: false,
  },
  {
    profile: {
      id: "mp-2",
      name: "Omar Haddad",
      email: "ohaddad@buckeyehealth.example",
      kind: "Professional",
      status: "Pending",
      headline: "",
      employer: "Buckeye Health Systems",
      jobTitle: "Clinical Informatics Lead",
      industry: "Healthcare",
      majors: [],
      topics: ["industry"],
      meetingPreferences: ["Phone"],
      capacity: 2,
      activeMentees: 0,
      bio: null,
      availabilityNotes: null,
      decisionNote: "Please add a short headline.",
      submittedAt: days(-5),
    },
    matchingPaused: false,
  },
  {
    profile: {
      id: "mp-3",
      name: "Linda Park",
      email: "linda.park@alumni.lakeside.edu",
      kind: "Alumni",
      status: "Approved",
      headline: "CPA and audit manager",
      employer: "Riverbend Credit Union",
      jobTitle: "Audit Manager",
      industry: "Banking",
      majors: ["Accounting"],
      topics: ["grad-school", "resume"],
      meetingPreferences: ["InPerson", "Video"],
      capacity: 4,
      activeMentees: 2,
      bio: null,
      availabilityNotes: null,
      decisionNote: null,
      submittedAt: days(-90),
    },
    matchingPaused: false,
  },
  {
    profile: {
      id: "mp-4",
      name: "Greg Mason",
      email: "gmason@example.com",
      kind: "Professional",
      status: "Suspended",
      headline: "Sales leader",
      employer: null,
      jobTitle: "Regional Sales Director",
      industry: "Manufacturing",
      majors: ["Marketing"],
      topics: ["industry"],
      meetingPreferences: ["Phone"],
      capacity: 2,
      activeMentees: 0,
      bio: null,
      availabilityNotes: null,
      decisionNote: "Suspended after a report was upheld.",
      submittedAt: days(-200),
    },
    matchingPaused: true,
  },
];

function relationship(o: Record<string, unknown>) {
  return {
    id: "rel-1",
    status: "Active",
    side: "Staff",
    mentorProfileId: "mp-3",
    mentorName: "Linda Park",
    studentName: "Sofia Martinez",
    message: "I'm a junior in accounting deciding between audit and tax. I'd love your perspective.",
    goals: ["Decide between audit and tax", "Prepare for Big Four internship interviews"],
    matchReasons: ["Same major", "Shared topic: Resume and LinkedIn"],
    mentorNote: null,
    requestedAt: days(-60),
    mentorDecidedAt: days(-58),
    startedAt: days(-57),
    endedAt: null,
    endReason: null,
    lastActivityAt: days(-4),
    sessions: 4,
    totalMinutes: 195,
    lastSession: days(-4),
    checkInDue: false,
    contactShared: true,
    ...o,
  };
}

const relationships = [
  relationship({}),
  relationship({
    id: "rel-2",
    status: "PendingStaff",
    mentorProfileId: "mp-1",
    mentorName: "Rachel Donovan",
    studentName: "Ethan Brooks",
    message: "I want to move from IT support into product management after graduation.",
    goals: ["Understand the PM interview loop"],
    requestedAt: days(-3),
    mentorDecidedAt: days(-1),
    startedAt: null,
    lastActivityAt: days(-1),
    sessions: 0,
    totalMinutes: 0,
    lastSession: null,
    contactShared: false,
  }),
  relationship({
    id: "rel-3",
    studentName: "Noah Williams",
    lastActivityAt: days(-40),
    sessions: 1,
    totalMinutes: 30,
    lastSession: days(-40),
    checkInDue: true,
  }),
  relationship({ id: "rel-4", status: "Completed", studentName: "Maya Johnson", endedAt: days(-10), endReason: "Goals met", sessions: 6, totalMinutes: 300 }),
];

function relationshipDetail(ctx: FixtureContext) {
  const r = relationships.find((x) => x.id === lastSegment(ctx)) ?? relationships[0];
  const has = r.sessions > 0;
  return {
    relationship: r,
    staffNote: null,
    sessions: has
      ? [
          { id: "ses-1", occurredOn: days(-4), durationMinutes: 45, format: "Video", sharedSummary: "Reviewed resume bullets for the audit internship.", loggedBy: "Mentor" },
          { id: "ses-2", occurredOn: days(-25), durationMinutes: 60, format: "InPerson", sharedSummary: null, loggedBy: "Student" },
        ]
      : [],
    feedback: has
      ? [
          { fromRole: "Student", rating: 5, comment: "Linda's advice on networking at the accounting fair was great.", createdAt: days(-4) },
          { fromRole: "Mentor", rating: 4, comment: null, createdAt: days(-4) },
        ]
      : [],
    reports: r.id === "rel-3" ? [{ id: "mrep-2", reportedRole: "Mentor", reason: "Unresponsive", status: "Open", createdAt: days(-6) }] : [],
  };
}

const mentoringReports = [
  {
    id: "mrep-1",
    reason: "Inappropriate",
    details: "The mentor asked me to meet at a bar and kept messaging after I declined.",
    blocked: true,
    status: "Open",
    reportedRole: "Mentor",
    reporter: "Ava Thompson",
    reported: "Greg Mason",
    reportedMatchingPaused: true,
    relationshipStatus: "Ended",
    createdAt: days(-6),
    resolutionNote: null,
  },
  {
    id: "mrep-2",
    reason: "Unresponsive",
    details: "No reply to three meeting requests in a month.",
    blocked: false,
    status: "Open",
    reportedRole: "Mentor",
    reporter: "Noah Williams",
    reported: "Linda Park",
    reportedMatchingPaused: false,
    relationshipStatus: "Active",
    createdAt: days(-6),
    resolutionNote: null,
  },
  {
    id: "mrep-3",
    reason: "Spam",
    details: "Student sent links to a paid course.",
    blocked: false,
    status: "Dismissed",
    reportedRole: "Student",
    reporter: "Rachel Donovan",
    reported: "Kyle Foster",
    reportedMatchingPaused: false,
    relationshipStatus: null,
    createdAt: days(-40),
    resolutionNote: "One link to a free campus workshop; not spam.",
  },
];

const mentoringFixtures: ApiFixture[] = [
  { path: "/api/career/mentoring/options", body: mentoringOptions },
  {
    path: "/api/career/mentoring/staff/stats",
    body: {
      mentorsByStatus: { Approved: 42, Pending: 5, Suspended: 1 },
      relationshipsByStatus: { Active: 31, Requested: 4, PendingStaff: 2, Completed: 58 },
      sessionsLast90Days: 112,
      hoursLast90Days: 96.5,
      averageRatingFromStudents: 4.7,
      averageRatingFromMentors: null,
      openReports: 2,
      checkInDue: 6,
      studentsMentored: 87,
      alumni: 1240,
    },
  },
  { method: "POST", path: "/api/career/mentoring/staff/check-ins/send", body: { sent: 6 } },
  { path: /^\/api\/career\/mentoring\/staff\/export\/[^/]+\.csv$/, contentType: "text/csv", body: "Name,Email,Status\nLinda Park,linda.park@alumni.lakeside.edu,Approved\n" },
  {
    path: "/api/career/mentoring/staff/mentors",
    body: (ctx: FixtureContext) => {
      const status = param(ctx, "status");
      return status ? staffMentors.filter((m) => m.profile.status === status) : staffMentors;
    },
  },
  {
    path: "/api/career/mentoring/staff/relationships",
    body: (ctx: FixtureContext) => {
      const status = param(ctx, "status");
      const list = status === "CheckInDue" ? relationships.filter((r) => r.checkInDue) : status ? relationships.filter((r) => r.status === status) : relationships;
      return list.map((summary, i) => ({ summary, studentRating: i === 0 ? 5 : null, mentorRating: i === 0 ? 4 : null }));
    },
  },
  { path: /^\/api\/career\/mentoring\/staff\/relationships\/[^/]+$/, body: relationshipDetail },
  {
    path: "/api/career/mentoring/staff/reports",
    body: (ctx: FixtureContext) => {
      const status = param(ctx, "status");
      return status ? mentoringReports.filter((r) => r.status === status) : mentoringReports;
    },
  },
  {
    path: "/api/career/mentoring/staff/suspensions",
    body: [{ id: "hold-1", name: "Greg Mason", reason: "Open report: inappropriate behavior", createdAt: days(-6) }],
  },
  {
    path: "/api/career/mentoring/staff/alumni",
    body: [
      { id: "al-1", name: "Linda Park", email: "linda.park@alumni.lakeside.edu", status: "Active", source: "Roster", mentorStatus: "Approved" },
      { id: "al-2", name: "Rachel Donovan", email: "rachel.donovan@alumni.lakeside.edu", status: "Active", source: "Graduated", mentorStatus: "Pending" },
      { id: "al-3", name: "Victor Chen", email: "vchen@alumni.lakeside.edu", status: "Invited", source: "Invite", mentorStatus: null },
    ],
  },
  {
    method: "POST",
    path: "/api/career/mentoring/staff/graduate",
    body: (ctx: FixtureContext) => {
      let dryRun = true;
      try {
        dryRun = (JSON.parse(ctx.postData ?? "{}") as { dryRun?: boolean }).dryRun ?? true;
      } catch {
        /* keep default */
      }
      return {
        dryRun,
        converted: [
          { id: "st-41", name: "Isabella Rossi", email: "irossi@lakeside.edu", graduationDate: ymd(-120) },
          { id: "st-42", name: "Daniel Okoye", email: "dokoye@lakeside.edu", graduationDate: ymd(-120) },
        ],
        skipped: [{ id: "st-43", name: "Chloe Bennett", email: "cbennett@lakeside.edu", reason: "Already an alum" }],
      };
    },
  },
  { path: "/api/career/mentoring/staff/settings", body: { requireStaffApproval: true, checkInDays: 21, maxOpenRequestsPerStudent: 3 } },
];

// ---------------------------------------------------------------------------------------------------------------
// Messages and campaigns
// ---------------------------------------------------------------------------------------------------------------

const threads = [
  {
    id: "th-1",
    kind: "CareerCenter",
    subject: "Question about my internship offer",
    status: "Open",
    studentUserId: "stu-1",
    studentName: "Aaliyah Brooks",
    mentorshipId: null,
    mentorName: null,
    assigneeUserId: null,
    assigneeName: null,
    lastMessageAt: hours(-2),
    lastMessagePreview: "They gave me until Friday to decide. Can someone help me compare offers?",
    unread: 2,
    mentorshipStatus: null,
  },
  {
    id: "th-2",
    kind: "CareerCenter",
    subject: "Resume review follow-up",
    status: "Open",
    studentUserId: "stu-2",
    studentName: "Jamal Carter",
    mentorshipId: null,
    mentorName: null,
    assigneeUserId: USER_ID,
    assigneeName: "Jordan Lee",
    lastMessageAt: days(-1),
    lastMessagePreview: "Thanks! I updated the skills section.",
    unread: 0,
    mentorshipStatus: null,
  },
  {
    id: "th-3",
    kind: "Mentorship",
    subject: "Mentorship: Sofia Martinez and Linda Park",
    status: "Open",
    studentUserId: "stu-3",
    studentName: "Sofia Martinez",
    mentorshipId: "rel-1",
    mentorName: "Linda Park",
    assigneeUserId: null,
    assigneeName: null,
    lastMessageAt: days(-3),
    lastMessagePreview: "See you at the accounting fair!",
    unread: 0,
    mentorshipStatus: "Active",
  },
  {
    id: "th-4",
    kind: "CareerCenter",
    subject: "Transcript request",
    status: "Closed",
    studentUserId: "stu-4",
    studentName: "Hannah Kim",
    mentorshipId: null,
    mentorName: null,
    assigneeUserId: "staff-2",
    assigneeName: "Morgan Reyes",
    lastMessageAt: days(-14),
    lastMessagePreview: "Got it, thank you.",
    unread: 0,
    mentorshipStatus: null,
  },
];

function threadDetail(ctx: FixtureContext) {
  const t = threads.find((x) => x.id === lastSegment(ctx)) ?? threads[0];
  const mentorship = t.kind === "Mentorship";
  return {
    thread: { id: t.id, kind: t.kind, subject: t.subject, status: t.status, studentName: t.studentName, mentorName: t.mentorName, assigneeUserId: t.assigneeUserId, mentorshipStatus: t.mentorshipStatus },
    viewerSide: "Staff",
    canPost: !mentorship,
    canAddNotes: !mentorship,
    otherLastReadAt: hours(-1),
    staff: [
      { userId: USER_ID, name: "Jordan Lee", role: "CareerAdmin" },
      { userId: "staff-2", name: "Morgan Reyes", role: "Counselor" },
    ],
    posts: [
      {
        id: `${t.id}-p1`,
        authorUserId: t.studentUserId,
        authorName: t.studentName,
        authorSide: "Student",
        body: "Hi! I received an offer from Northwind Analytics for a summer data internship. They gave me until Friday to decide.",
        isInternalNote: false,
        createdAt: hours(-26),
        attachment: { id: "file-1", name: "Northwind-offer-letter.pdf" },
        mine: false,
        seen: true,
      },
      {
        id: `${t.id}-p2`,
        authorUserId: USER_ID,
        authorName: "Jordan Lee",
        authorSide: "Staff",
        body: "Congratulations! Let's look at it together. Are you waiting on any other offers?",
        isInternalNote: false,
        createdAt: hours(-25),
        attachment: null,
        mine: true,
        seen: true,
      },
      {
        id: `${t.id}-p3`,
        authorUserId: "staff-2",
        authorName: "Morgan Reyes",
        authorSide: "Staff",
        body: "She also interviewed with Buckeye Health last week; I can help with the comparison.",
        isInternalNote: true,
        createdAt: hours(-5),
        attachment: null,
        mine: false,
        seen: false,
      },
      {
        id: `${t.id}-p4`,
        authorUserId: t.studentUserId,
        authorName: t.studentName,
        authorSide: "Student",
        body: "Yes, one more. Can someone help me compare offers?",
        isInternalNote: false,
        createdAt: hours(-2),
        attachment: null,
        mine: false,
        seen: false,
      },
    ],
  };
}

const messageReports = [
  {
    id: "mr-1",
    threadId: "th-3",
    reason: "Harassment",
    details: "The mentor keeps messaging late at night after I asked them to stop.",
    status: "Open",
    createdAt: days(-2),
    reporter: "Sofia Martinez",
    resolutionNote: null,
    thread: { subject: "Mentorship: Sofia Martinez and Linda Park", kind: "Mentorship", studentName: "Sofia Martinez", mentorName: "Linda Park" },
    post: { authorName: "Linda Park", body: "Are you free to talk tonight? Call me.", createdAt: days(-2) },
  },
  {
    id: "mr-2",
    threadId: "th-2",
    reason: "Spam",
    details: null,
    status: "Open",
    createdAt: days(-5),
    reporter: "Jamal Carter",
    resolutionNote: null,
    thread: { subject: "Resume review follow-up", kind: "CareerCenter", studentName: "Jamal Carter", mentorName: null },
    post: null,
  },
  {
    id: "mr-3",
    threadId: "th-4",
    reason: "Other",
    details: "Reported by mistake.",
    status: "Resolved",
    createdAt: days(-20),
    reporter: "Hannah Kim",
    resolutionNote: "Student confirmed it was accidental.",
    thread: null,
    post: null,
  },
];

const campaigns = [
  {
    id: "cmp-1",
    name: "Fall career fair reminder",
    category: "events",
    subject: "{{firstName}}, the Fall Career Fair is next week",
    status: "Sent",
    scheduledAt: days(-10),
    completedAt: days(-10),
    recipientCount: 1840,
    sent: 1822,
    failed: 18,
    createdAt: days(-14),
  },
  {
    id: "cmp-2",
    name: "OPT workshop for international students",
    category: "announcements",
    subject: "Planning your OPT: free workshop",
    status: "Scheduled",
    scheduledAt: days(3),
    completedAt: null,
    recipientCount: 212,
    sent: 0,
    failed: 0,
    createdAt: days(-1),
  },
  {
    id: "cmp-3",
    name: "Alumni mentor call",
    category: "mentoring",
    subject: "Become a mentor for {{school}} students",
    status: "Draft",
    scheduledAt: null,
    completedAt: null,
    recipientCount: 0,
    sent: 0,
    failed: 0,
    createdAt: days(-2),
  },
];

function campaignDetail(ctx: FixtureContext) {
  const c = campaigns.find((x) => x.id === lastSegment(ctx)) ?? campaigns[0];
  return {
    ...c,
    body: "Hi {{firstName}},\n\nMore than 80 employers are coming to campus. Bring copies of your resume.\n\nLakeside Career Services",
    sendEmail: true,
    sendInApp: true,
    segment: { roles: ["Student"], statuses: ["Active"], degreeLevels: ["Bachelor"], majors: [], graduationFrom: null, graduationTo: null, workAuthorizations: [], hadAppointment: null, hadDocReview: null, activityDays: 180 },
    metrics: {
      recipients: c.recipientCount,
      pending: c.status === "Scheduled" ? c.recipientCount : 0,
      sent: c.sent,
      failed: c.failed,
      suppressed: 4,
      emailsSent: c.sent,
      inAppSent: c.sent,
      unsubscribes: 3,
      trackingNote: "Opens and clicks aren't tracked, to respect student privacy.",
    },
    failures: c.failed > 0 ? [{ name: "Tyler Nguyen", email: "tnguyen@lakeside.edu", error: "Mailbox full" }] : [],
  };
}

const messagingFixtures: ApiFixture[] = [
  {
    path: "/api/career/messaging/staff/threads",
    body: (ctx: FixtureContext) => {
      const f = param(ctx, "filter") || "open";
      if (f === "closed") return threads.filter((t) => t.status === "Closed");
      if (f === "unassigned") return threads.filter((t) => t.status === "Open" && !t.assigneeUserId);
      if (f === "mine") return threads.filter((t) => t.assigneeUserId === USER_ID);
      if (f === "all") return threads;
      return threads.filter((t) => t.status === "Open");
    },
  },
  { method: "POST", path: "/api/career/messaging/staff/threads", body: { id: "th-1" } },
  {
    path: "/api/career/messaging/staff/students",
    body: [
      { userId: "stu-1", name: "Aaliyah Brooks", email: "abrooks@lakeside.edu", role: "Student" },
      { userId: "stu-9", name: "Victor Chen", email: "vchen@alumni.lakeside.edu", role: "Alumni" },
    ],
  },
  { path: /^\/api\/career\/messaging\/threads\/[^/]+\/files\/[^/]+$/, contentType: "application/pdf", body: "%PDF-1.4\n%mock\n" },
  { path: /^\/api\/career\/messaging\/threads\/[^/]+$/, body: threadDetail },
  {
    path: "/api/career/messaging/staff/reports",
    body: (ctx: FixtureContext) => {
      const status = param(ctx, "status") || "Open";
      return messageReports.filter((r) => r.status === status);
    },
  },
  {
    path: "/api/career/messaging/campaigns/options",
    body: {
      categories: ["announcements", "events", "mentoring", "jobs"],
      mergeFields: ["firstName", "school"],
      roles: ["Student", "Alumni"],
      statuses: ["Active", "Invited"],
      degreeLevels: ["Associate", "Bachelor", "Master", "Doctorate"],
      workAuthorizations: ["USCitizen", "PermanentResident", "F1", "J1"],
    },
  },
  { path: "/api/career/messaging/campaigns", body: campaigns },
  {
    method: "POST",
    path: "/api/career/messaging/campaigns/preview",
    body: {
      count: 1840,
      emailUnsubscribed: 12,
      notSignedIn: 230,
      sample: [
        { name: "Aaliyah Brooks", email: "abrooks@lakeside.edu", signedIn: true },
        { name: "Jamal Carter", email: "jcarter@lakeside.edu", signedIn: false },
      ],
      rendered: { subject: "Aaliyah, the Fall Career Fair is next week", body: "Hi Aaliyah,\n\nMore than 80 employers are coming to campus." },
    },
  },
  { method: "POST", path: "/api/career/messaging/campaigns", body: { ...campaigns[2] } },
  { path: /^\/api\/career\/messaging\/campaigns\/[^/]+$/, body: campaignDetail },
];

// ---------------------------------------------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------------------------------------------

const placements = [
  {
    id: "pl-1",
    studentUserId: "stu-1",
    studentName: "Aaliyah Brooks",
    studentEmail: "abrooks@lakeside.edu",
    employerId: EMPLOYER_ID,
    employerName: "Northwind Analytics",
    title: "Associate Data Analyst",
    employmentType: "FullTime",
    startDate: ymd(60),
    location: "Columbus, OH",
    salaryBand: "75to100k",
    source: "HireWebhook",
    verificationLevel: "EmployerVerified",
    sources: ["HireWebhook", "StudentReported"],
    evidenceNotes: null,
    verifiedAt: days(-3),
    createdAt: days(-10),
    updatedAt: days(-3),
    studentEditable: false,
  },
  {
    id: "pl-2",
    studentUserId: "stu-5",
    studentName: "Ethan Brooks",
    studentEmail: "ebrooks@lakeside.edu",
    employerId: null,
    employerName: "Ohio State University",
    title: "MS in Biostatistics",
    employmentType: "ContinuingEducation",
    startDate: ymd(-40),
    location: null,
    salaryBand: null,
    source: "StaffResearch",
    verificationLevel: "StaffConfirmed",
    sources: ["StaffResearch"],
    evidenceNotes: "Enrollment confirmed via National Student Clearinghouse.",
    verifiedAt: days(-20),
    createdAt: days(-25),
    updatedAt: days(-20),
    studentEditable: false,
  },
  {
    id: "pl-3",
    studentUserId: "stu-6",
    studentName: "Grace Okafor",
    studentEmail: "gokafor@lakeside.edu",
    employerId: null,
    employerName: "Riverbend Credit Union",
    title: "Staff Accountant",
    employmentType: "FullTime",
    startDate: null,
    location: "Dayton, OH",
    salaryBand: "50to75k",
    source: "StudentReported",
    verificationLevel: "SelfReported",
    sources: ["StudentReported"],
    evidenceNotes: null,
    verifiedAt: null,
    createdAt: days(-2),
    updatedAt: days(-2),
    studentEditable: true,
  },
  {
    id: "pl-4",
    studentUserId: "stu-7",
    studentName: null,
    studentEmail: null,
    employerId: null,
    employerName: "AmeriCorps",
    title: "City Year Corps Member",
    employmentType: "Volunteer",
    startDate: ymd(-90),
    location: "Cleveland, OH",
    salaryBand: "Under30k",
    source: "StudentReported",
    verificationLevel: "SelfReported",
    sources: ["StudentReported"],
    evidenceNotes: null,
    verifiedAt: null,
    createdAt: days(-100),
    updatedAt: days(-100),
    studentEditable: true,
  },
];

const outcomesReport = {
  minCellSize: 10,
  hiddenLabel: "<10",
  filters: { cohort: null, program: null, cohorts: [2024, 2025, 2026], programs: ["BS Computer Science", "BSN Nursing", "BBA Accounting"] },
  tables: [
    {
      key: "summary",
      title: "Outcomes by graduation year",
      columns: ["Graduation year", "Graduates", "Known outcome", "Employed or continuing", "Knowledge rate"],
      rows: [
        ["2024", 1820, 1402, 1288, "77%"],
        ["2025", 1904, 1311, 1170, "69%"],
        ["2026", 412, 98, 81, "24%"],
      ],
      note: "Knowledge rate follows NACE first-destination guidance.",
    },
    {
      key: "verification",
      title: "How placements are verified",
      columns: ["Verification", "Placements", "Share"],
      rows: [
        ["Verified by employer", 402, "31%"],
        ["Confirmed by staff", 611, "47%"],
        ["Self-reported", 275, "21%"],
      ],
      note: null,
    },
    {
      key: "predictors",
      title: "Evidence and placement",
      columns: ["Evidence", "Students", "Placed", "Placement rate"],
      rows: [
        ["Completed an internship", 640, 581, "91%"],
        ["Had a resume reviewed", 1120, 902, "81%"],
        ["Attended a mock interview", null, null, "<10"],
      ],
      note: "Groups smaller than 10 are hidden.",
    },
  ],
  predictorsCaveat: "Correlation, not causation; small samples. Students who use more services may differ in other ways.",
  predictorsSuppressed: false,
  notes: ["Placements without a start date count toward the year they were reported.", "Records are never shared with employers."],
};

const outcomesFixtures: ApiFixture[] = [
  {
    path: "/api/career/outcomes/placements",
    body: {
      total: placements.length,
      items: placements,
      employmentTypes: ["FullTime", "PartTime", "Internship", "Contract", "Fellowship", "ContinuingEducation", "Military", "Volunteer"],
      sources: ["EmployerReported", "AtsWebhook", "HireWebhook", "StaffResearch", "StudentReported"],
      verificationLevels: ["EmployerVerified", "StaffConfirmed", "SelfReported"],
      salaryBands: ["Under30k", "30to50k", "50to75k", "75to100k", "100to150k", "150kPlus"],
    },
  },
  { method: "POST", path: "/api/career/outcomes/placements", body: { merged: false } },
  { method: "POST", path: "/api/career/outcomes/sync/ats", body: { scanned: 14, created: 3, merged: 11 } },
  {
    path: "/api/career/outcomes/students",
    body: [
      { userId: "stu-6", name: "Grace Okafor", email: "gokafor@lakeside.edu", status: null },
      { userId: "stu-8", name: "Tyler Nguyen", email: "tnguyen@lakeside.edu", status: "Seeking" },
      { userId: "stu-9", name: "Olivia Garcia", email: "ogarcia@lakeside.edu", status: "NotSeeking" },
    ],
  },
  {
    path: "/api/career/outcomes/offers",
    body: [
      { bookingId: "bk-1", studentName: "Aaliyah Brooks", employerName: "Northwind Analytics", positionTitle: "Associate Data Analyst", outcomeAt: days(-8), response: "Accepted" },
      { bookingId: "bk-5", studentName: "Jamal Carter", employerName: "Buckeye Health Systems", positionTitle: "IT Analyst", outcomeAt: days(-5), response: null },
      { bookingId: "bk-6", studentName: null, employerName: "Riverbend Credit Union", positionTitle: "Finance Intern", outcomeAt: null, response: "Declined" },
    ],
  },
  { path: "/api/career/outcomes/reports", body: outcomesReport },
  {
    path: "/api/career/outcomes/hire/events",
    body: [
      { eventId: "ev-1", type: "hire.offer_accepted", externalApplicationId: "app-88213", result: "Placed", receivedAt: hours(-30) },
      { eventId: "ev-2", type: "hire.offer_extended", externalApplicationId: "app-88340", result: "Unmatched", receivedAt: days(-3) },
      { eventId: "ev-3", type: "hire.stage_changed", externalApplicationId: null, result: "Ignored", receivedAt: days(-6) },
    ],
  },
  { path: "/api/career/outcomes/placements.csv", contentType: "text/csv", body: "Student,Employer,Title,Verification\nAaliyah Brooks,Northwind Analytics,Associate Data Analyst,EmployerVerified\n" },
  { path: "/api/career/outcomes/reports.csv", contentType: "text/csv", body: "Graduation year,Graduates,Known outcome\n2025,1904,1311\n" },
];

// ---------------------------------------------------------------------------------------------------------------
// People, privacy log, settings, SIS
// ---------------------------------------------------------------------------------------------------------------

const members = [
  { id: "mem-1", userId: USER_ID, email: "jordan.lee@lakeside.edu", name: "Jordan Lee", role: "CareerAdmin", status: "Active", studentNumber: null, ferpaHold: false, source: "Invite", createdAt: days(-400), linkedAt: days(-399) },
  { id: "mem-2", userId: "stu-1", email: "abrooks@lakeside.edu", name: "Aaliyah Brooks", role: "Student", status: "Active", studentNumber: "A10392841", ferpaHold: false, source: "Roster", createdAt: days(-200), linkedAt: days(-190) },
  { id: "mem-3", userId: null, email: "mreyes@lakeside.edu", name: "Morgan Reyes", role: "Counselor", status: "Invited", studentNumber: null, ferpaHold: false, source: "Invite", createdAt: days(-3), linkedAt: null },
  { id: "mem-4", userId: "stu-4", email: "hkim@lakeside.edu", name: "Hannah Kim", role: "Student", status: "Suspended", studentNumber: "A10410077", ferpaHold: true, source: "SIS", createdAt: days(-300), linkedAt: days(-280) },
];

const schoolSettings = {
  instituteId: INSTITUTE_ID,
  slug: "lakeside",
  displayName: SCHOOL_NAME,
  emailDomains: "lakeside.edu, mail.lakeside.edu",
  timeZone: "America/New_York",
  studentSelfJoin: true,
  directoryInformation: "Profile,Education",
  logoUrl: null,
  primaryColor: "#1d4ed8",
  contactEmail: "careers@lakeside.edu",
  postalAddress: "Lakeside State University Career Center\n400 University Ave, Columbus, OH 43210",
};

const sisRun = (o: Record<string, unknown>) => ({
  id: "run-1",
  kind: "OneRosterRest",
  trigger: "Nightly",
  fullSync: true,
  deactivateMissing: false,
  dryRun: false,
  status: "Succeeded",
  message: null,
  startedAt: days(-1),
  finishedAt: days(-1),
  counts: { inFeed: 18420, created: 34, updated: 212, unchanged: 18174, missing: 12, deactivated: 0, reactivated: 3, skipped: 2 },
  issues: [],
  ...o,
});

const sisRuns = [
  sisRun({}),
  sisRun({
    id: "run-2",
    kind: "GenericCsv",
    trigger: "Upload",
    fullSync: false,
    dryRun: true,
    status: "Succeeded",
    startedAt: days(-6),
    finishedAt: days(-6),
    counts: { inFeed: 640, created: 12, updated: 40, unchanged: 586, missing: 0, deactivated: 0, reactivated: 0, skipped: 2 },
    issues: [{ line: 14, field: "Email", message: "Email is missing.", severity: "Error" }],
  }),
  sisRun({ id: "run-3", kind: "OneRosterCsv", trigger: "Upload", status: "Failed", message: "users.csv is missing from the bundle.", startedAt: days(-9), finishedAt: days(-9), counts: {} }),
];

const adminFixtures: ApiFixture[] = [
  {
    path: "/api/career/admin/members",
    body: (ctx: FixtureContext) => {
      const role = param(ctx, "role");
      const items = role ? members.filter((m) => m.role === role) : members;
      return { total: role ? items.length : 58, items };
    },
  },
  {
    method: "PATCH",
    path: /^\/api\/career\/admin\/members\/[^/]+$/,
    body: (ctx: FixtureContext) => {
      const m = members.find((x) => x.id === lastSegment(ctx)) ?? members[1];
      let change: Record<string, unknown> = {};
      try {
        change = JSON.parse(ctx.postData ?? "{}") as Record<string, unknown>;
      } catch {
        /* keep empty */
      }
      return { ...m, ...change };
    },
  },
  {
    path: "/api/career/admin/member-counts",
    body: { total: 58, byRole: { Student: 41, Alumni: 6, Counselor: 5, CareerAdmin: 2, EmployerRelations: 1, Faculty: 3 }, byStatus: { Active: 49, Invited: 8, Suspended: 1 } },
  },
  {
    method: "POST",
    path: "/api/career/admin/roster/import",
    body: { dryRun: true, created: 18, updated: 4, errors: [{ line: 7, error: "Email is not a lakeside.edu address." }] },
  },
  {
    path: "/api/career/admin/disclosures",
    body: [
      {
        id: "dis-1",
        studentUserId: "stu-1-0000-0000-000000000000",
        recipientType: "Employer",
        recipientName: "Northwind Analytics",
        dataCategories_JSON: "[\"Profile\",\"Resume\"]",
        purpose: "Application to Associate Data Analyst",
        legalBasis: "Consent",
        actorUserId: null,
        occurredAt: days(-2),
        studentName: "Aaliyah Brooks",
        actorName: null,
        categories: ["Profile", "Resume"],
      },
      {
        id: "dis-2",
        studentUserId: "stu-4-0000-0000-000000000000",
        recipientType: "Employer",
        recipientName: "Buckeye Health Systems",
        dataCategories_JSON: "[\"Profile\",\"Education\"]",
        purpose: "Resume book for nursing majors",
        legalBasis: "DirectoryInformation",
        actorUserId: USER_ID,
        occurredAt: days(-9),
        studentName: null,
        actorName: "Jordan Lee",
      },
      {
        id: "dis-3",
        studentUserId: "stu-6-0000-0000-000000000000",
        recipientType: "Staff",
        recipientName: "Morgan Reyes",
        dataCategories_JSON: "[\"Transcript\",\"Gpa\"]",
        purpose: "",
        legalBasis: "SchoolOfficial",
        actorUserId: "staff-2",
        occurredAt: days(-15),
        studentName: "Grace Okafor",
        actorName: "Morgan Reyes",
      },
    ],
  },
  {
    path: "/api/career/admin/audit",
    body: [
      { id: "au-1", actorUserId: USER_ID, action: "member.role_changed", entityType: "Membership", entityId: "mem-3-aaaa-bbbb", details_JSON: "{}", at: hours(-5), actorName: "Jordan Lee", details: { from: "Student", to: "Counselor" } },
      { id: "au-2", actorUserId: "staff-2", action: "placement.verified", entityType: "Placement", entityId: "pl-2-aaaa-bbbb", details_JSON: "{\"notes\":\"Clearinghouse\"}", at: days(-1), actorName: null },
      { id: "au-3", actorUserId: null, action: "sis.sync", entityType: "SisRun", entityId: null, details_JSON: "{}", at: days(-2), actorName: null, details: {} },
    ],
  },
  { path: "/api/career/admin/settings", body: schoolSettings },
  {
    method: "PUT",
    path: "/api/career/admin/settings",
    body: (ctx: FixtureContext) => {
      let change: Record<string, unknown> = {};
      try {
        change = JSON.parse(ctx.postData ?? "{}") as Record<string, unknown>;
      } catch {
        /* keep empty */
      }
      return { ...schoolSettings, ...change };
    },
  },
  {
    path: "/api/career/sis/settings",
    body: {
      settings: {
        baseUrl: "https://sis.lakeside.example/ims/oneroster/rostering/v1p2",
        tokenUrl: "https://sis.lakeside.example/oauth/token",
        clientId: "career-suite",
        hasClientSecret: true,
        scope: "roster-core.readonly",
        orgSourcedId: null,
        importDemographics: false,
        nightlyEnabled: true,
        nightlyDeactivateMissing: false,
        lastSyncAt: days(-1),
        lastStatus: "Succeeded",
      },
      partnerSchool: false,
      csvPresets: ["Banner", "Workday Student", "PeopleSoft", "Custom"],
      csvFields: [
        { key: "email", label: "Email", required: true, hint: null },
        { key: "sisId", label: "SIS id", required: true, hint: "Banner ID or student number" },
        { key: "name", label: "Name", required: false, hint: null },
        { key: "major", label: "Major", required: false, hint: "Separate several with ;" },
      ],
      presetNotice: "Presets match the default column names of each SIS export. Check the mapping before you sync.",
    },
  },
  { path: "/api/career/sis/runs", body: sisRuns },
  {
    method: "POST",
    path: "/api/career/sis/csv/preview",
    body: { preset: "Banner", mapping: { email: "EMAIL_ADDRESS", sisId: "SPRIDEN_ID", name: "FULL_NAME" }, headers: ["SPRIDEN_ID", "EMAIL_ADDRESS", "FULL_NAME", "MAJR_DESC"], rowCount: 640 },
  },
  { method: "POST", path: "/api/career/sis/csv/sync", body: sisRun({ id: "run-9", kind: "GenericCsv", trigger: "Upload", dryRun: true, startedAt: hours(0), finishedAt: hours(0) }) },
  { method: "POST", path: "/api/career/sis/oneroster/upload", body: sisRun({ id: "run-10", kind: "OneRosterCsv", trigger: "Upload", dryRun: true, startedAt: hours(0), finishedAt: hours(0) }) },
  { method: "POST", path: "/api/career/sis/rest/sync-now", body: sisRun({ id: "run-11", trigger: "Manual", startedAt: hours(0), finishedAt: hours(0) }) },
];

// ---------------------------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------------------------

const REPORT_SECTIONS = ["engagement", "service", "employers", "equity"] as const;
const REPORT_TITLES: Record<string, string> = { engagement: "Engagement", service: "Service volume", employers: "Employers", equity: "Equity view" };

function reportFor(ctx: FixtureContext) {
  const section = lastSegment(ctx);
  const term = param(ctx, "term");
  return {
    section,
    title: REPORT_TITLES[section] ?? "Report",
    range: { from: term ? "2026-08-24" : ymd(-90), to: term ? "2026-12-18" : ymd(0), term: term || null, timeZone: "America/New_York" },
    metrics: [
      { key: "students", label: "Students served", value: 2148, hint: "Unique students with any activity" },
      { key: "appointments", label: "Appointments", value: 1312, hint: null },
      { key: "reviews", label: "Documents reviewed", value: 884, hint: null },
      { key: "share", label: "Share of enrolled students", value: "11.8%", hint: "Of 18,204 enrolled" },
      { key: "first-gen", label: "First-generation students served", value: "<10", hint: "Hidden: group below the minimum size" },
    ],
    tables: [
      {
        key: "by-college",
        title: "Students served by college",
        columns: ["College", "Students", "Share of college"],
        rows: [
          ["Engineering", 612, "14.2%"],
          ["Business", 548, "16.9%"],
          ["Arts & Sciences", 701, "8.4%"],
          ["Nursing", "<10", null],
        ],
        note: "Colleges with fewer than 10 students are hidden.",
        chartColumn: 1,
      },
      {
        key: "by-week",
        title: "Appointments by week",
        columns: ["Week of", "Appointments"],
        rows: [
          [ymd(-21), 104],
          [ymd(-14), 131],
          [ymd(-7), 118],
        ],
        note: null,
        chartColumn: null,
      },
      { key: "empty", title: "Walk-in visits", columns: ["Day", "Visits"], rows: [], note: null, chartColumn: 1 },
    ],
    notes: ["Counts are de-duplicated by student.", "Cancelled appointments are excluded."],
  };
}

const reportsFixtures: ApiFixture[] = [
  {
    path: "/api/career/reports/options",
    body: {
      sections: [...REPORT_SECTIONS],
      role: "CareerAdmin",
      canEditSettings: true,
      minCellSize: 10,
      minCellSizeFloor: 5,
      terms: [
        { name: "Fall 2026", from: "2026-08-24", to: "2026-12-18", current: true },
        { name: "Spring 2026", from: "2026-01-12", to: "2026-05-08", current: false },
      ],
      today: ymd(0),
    },
  },
  {
    path: "/api/career/reports/presets",
    body: [
      { id: "pre-1", name: "Fall engagement", params: { section: "engagement", term: "Fall 2026", from: null, to: null } },
      { id: "pre-2", name: "Employer activity, last quarter", params: { section: "employers", term: null, from: ymd(-90), to: null } },
    ],
  },
  {
    path: "/api/career/reports/summary.html",
    contentType: "text/html",
    body: "<!doctype html><html lang=\"en\"><head><title>Career services summary</title></head><body><h1>Career services summary</h1></body></html>",
  },
  { path: /^\/api\/career\/reports\/[^/]+\.csv$/, contentType: "text/csv", body: "College,Students\nEngineering,612\nBusiness,548\n" },
  { path: /^\/api\/career\/reports\/(engagement|service|employers|equity)$/, body: reportFor },
];

export const careerCenterBFixtures: ApiFixture[] = [
  ...intlFixtures,
  ...ocrFixtures,
  ...mentoringFixtures,
  ...messagingFixtures,
  ...outcomesFixtures,
  ...adminFixtures,
  ...reportsFixtures,
];

const cc = (name: string, path: string): A11yRoute => ({ name, path, persona: "career-center" });

export const careerCenterBRoutes: A11yRoute[] = [
  cc("cc-international", "/career-center/international"),
  cc("cc-interviews", "/career-center/interviews"),
  cc("cc-interview-reports", "/career-center/interviews/reports"),
  cc("cc-mentoring", "/career-center/mentoring"),
  cc("cc-messages", "/career-center/messages"),
  cc("cc-messages-thread", "/career-center/messages?tab=inbox&thread=th-1"),
  cc("cc-messages-campaigns", "/career-center/messages?tab=campaigns"),
  cc("cc-messages-reports", "/career-center/messages?tab=reports"),
  cc("cc-notifications", "/career-center/notifications"),
  cc("cc-outcomes", "/career-center/outcomes"),
  cc("cc-people", "/career-center/people"),
  cc("cc-privacy-log", "/career-center/privacy-log"),
  cc("cc-reports", "/career-center/reports"),
  cc("cc-settings", "/career-center/settings"),
  cc("cc-settings-sis", "/career-center/settings/sis"),
];
