import { type ApiFixture, type A11yRoute, type FixtureContext, INSTITUTE_ID, SCHOOL_NAME, USER_ID, days, hours } from "./types";
import { scheduleGroupSessions } from "./groupSessions";

/**
 * Career-center persona, part A: home, appointments, calendar sync, caseload (+ rules, settings), employer challenges,
 * document review, employers, internships for credit (+ detail), outcome frameworks and imports.
 * Every fixture here only answers the "career-center" persona so other personas' files stay in charge of theirs.
 */

const TZ = "America/Chicago";
/** yyyy-mm-dd, n days from today */
const ymd = (n: number) => days(n).slice(0, 10);
const lastSegment = (ctx: FixtureContext, fromEnd = 0) => {
  const parts = ctx.url.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1 - fromEnd] ?? "");
};

// ---------------------------------------------------------------- people

const ME = { userId: USER_ID, name: "Jordan Lee", email: "jordan.lee@lakeside.edu" };
const PRIYA = { userId: "44444444-4444-4444-8444-444444444401", name: "Priya Raman", email: "priya.raman@lakeside.edu" };
const MARCUS = { userId: "44444444-4444-4444-8444-444444444402", name: "Marcus Bell", email: "marcus.bell@lakeside.edu" };

const STUDENTS = [
  { userId: "55555555-5555-4555-8555-555555555501", name: "Aisha Thompson", email: "aisha.thompson@lakeside.edu", studentNumber: "L00412873" },
  { userId: "55555555-5555-4555-8555-555555555502", name: "Diego Martinez", email: "diego.martinez@lakeside.edu", studentNumber: "L00398214" },
  { userId: "55555555-5555-4555-8555-555555555503", name: "Emily Chen", email: "emily.chen@lakeside.edu", studentNumber: "L00420056" },
  { userId: "55555555-5555-4555-8555-555555555504", name: "Tyler Brooks", email: "tyler.brooks@lakeside.edu", studentNumber: "L00377190" },
];
const [AISHA, DIEGO, EMILY, TYLER] = STUDENTS;

// ---------------------------------------------------------------- home / shared admin endpoints

const ROLE_TOTALS: Record<string, number> = { Student: 1840, Alumni: 612, Counselor: 9, CareerAdmin: 3, EmployerRelations: 2, Faculty: 47 };

const MEMBERS = [
  { id: "mem-1", userId: AISHA.userId, email: AISHA.email, name: AISHA.name, role: "Student", status: "Active", studentNumber: AISHA.studentNumber, ferpaHold: false, source: "Sis", createdAt: days(-300), linkedAt: days(-290) },
  { id: "mem-2", userId: DIEGO.userId, email: DIEGO.email, name: DIEGO.name, role: "Student", status: "Active", studentNumber: DIEGO.studentNumber, ferpaHold: true, source: "Csv", createdAt: days(-280), linkedAt: days(-200) },
  { id: "mem-3", userId: null, email: "sam.nguyen@lakeside.edu", name: "Sam Nguyen", role: "Student", status: "Invited", studentNumber: "L00431122", ferpaHold: false, source: "Invite", createdAt: days(-5), linkedAt: null },
  { id: "mem-4", userId: EMILY.userId, email: EMILY.email, name: EMILY.name, role: "Alumni", status: "Active", studentNumber: EMILY.studentNumber, ferpaHold: false, source: "Sis", createdAt: days(-700), linkedAt: days(-650) },
  { id: "mem-5", userId: PRIYA.userId, email: PRIYA.email, name: PRIYA.name, role: "Counselor", status: "Active", studentNumber: null, ferpaHold: false, source: "Invite", createdAt: days(-400), linkedAt: days(-399) },
  { id: "mem-6", userId: USER_ID, email: ME.email, name: ME.name, role: "CareerAdmin", status: "Active", studentNumber: null, ferpaHold: false, source: "Invite", createdAt: days(-500), linkedAt: days(-500) },
  { id: "mem-7", userId: "66666666-6666-4666-8666-666666666601", email: "r.okafor@lakeside.edu", name: "Dr. Ruth Okafor", role: "Faculty", status: "Suspended", studentNumber: null, ferpaHold: false, source: "Invite", createdAt: days(-120), linkedAt: days(-118) },
];

const adminSettings = {
  instituteId: INSTITUTE_ID,
  slug: "lakeside",
  displayName: SCHOOL_NAME,
  emailDomains: "lakeside.edu",
  timeZone: TZ,
  studentSelfJoin: true,
  directoryInformation: "Profile,Education",
  logoUrl: null,
  primaryColor: "#1d4ed8",
  contactEmail: "careers@lakeside.edu",
  postalAddress: "1200 University Ave, Springfield, IL 62703",
};

function membersBody(ctx: FixtureContext) {
  const role = ctx.url.searchParams.get("role");
  const q = (ctx.url.searchParams.get("q") ?? "").toLowerCase();
  const pageSize = Number(ctx.url.searchParams.get("pageSize") ?? 25);
  let items = MEMBERS.filter((m) => (!role || m.role === role) && (!q || m.name.toLowerCase().includes(q) || m.email.includes(q)));
  // Staff search for "book for a student": always offer a few students
  if (q && items.length === 0) items = MEMBERS.filter((m) => m.role === "Student" || m.role === "Alumni");
  const total = q ? items.length : role ? (ROLE_TOTALS[role] ?? items.length) : Object.values(ROLE_TOTALS).reduce((a, n) => a + n, 0);
  return { total, items: items.slice(0, pageSize) };
}

const EMPLOYER_REQUESTS = [
  {
    id: "rel-1",
    status: "Pending",
    requestNote: "We hire 6-8 data analyst interns every summer and would love to recruit Lakeside students.",
    decisionNote: null,
    requestedAt: days(-2),
    decidedAt: null,
    employer: { id: "emp-1", name: "Prairie Health Systems", website: "prairiehealth.example", emailDomain: "prairiehealth.example", industry: "Healthcare", sizeBand: "1001-5000", hqCity: "Peoria", hqState: "IL", verificationStatus: "DomainVerified", flagReason: null },
  },
  {
    id: "rel-2",
    status: "Pending",
    requestNote: null,
    decisionNote: null,
    requestedAt: days(-6),
    decidedAt: null,
    employer: { id: "emp-2", name: "Quickstart Staffing LLC", website: null, emailDomain: "gmail.com", industry: null, sizeBand: null, hqCity: null, hqState: null, verificationStatus: "Unverified", flagReason: null },
  },
  {
    id: "rel-3",
    status: "Pending",
    requestNote: "Remote marketing roles, flexible hours.",
    decisionNote: null,
    requestedAt: days(-9),
    decidedAt: null,
    employer: { id: "emp-3", name: "BrightPath Media", website: "https://brightpath.example", emailDomain: "brightpath.example", industry: "Marketing", sizeBand: "11-50", hqCity: "Austin", hqState: "TX", verificationStatus: "Flagged", flagReason: "Several schools reported misleading job descriptions." },
  },
  {
    id: "rel-4",
    status: "Approved",
    requestNote: null,
    decisionNote: "Welcome back for another recruiting season.",
    requestedAt: days(-90),
    decidedAt: days(-88),
    employer: { id: "emp-4", name: "Midwest Mutual Insurance", website: "https://midwestmutual.example", emailDomain: "midwestmutual.example", industry: "Insurance", sizeBand: "5001+", hqCity: "Des Moines", hqState: "IA", verificationStatus: "StaffVerified", flagReason: null },
  },
  {
    id: "rel-5",
    status: "Approved",
    requestNote: "Engineering co-ops in Chicago.",
    decisionNote: null,
    requestedAt: days(-60),
    decidedAt: days(-59),
    employer: { id: "emp-5", name: "Lakeshore Robotics", website: "https://lakeshorerobotics.example", emailDomain: "lakeshorerobotics.example", industry: "Manufacturing", sizeBand: "201-500", hqCity: "Chicago", hqState: "IL", verificationStatus: "DomainVerified", flagReason: null },
  },
  {
    id: "rel-6",
    status: "Declined",
    requestNote: null,
    decisionNote: "Commission-only roles are not posted to students.",
    requestedAt: days(-40),
    decidedAt: days(-38),
    employer: { id: "emp-6", name: "Summit Direct Sales", website: "summitdirect.example", emailDomain: "summitdirect.example", industry: "Sales", sizeBand: "51-200", hqCity: "Phoenix", hqState: "AZ", verificationStatus: "Unverified", flagReason: null },
  },
  {
    id: "rel-7",
    status: "Blocked",
    requestNote: null,
    decisionNote: "Asked students for payment to apply.",
    requestedAt: days(-150),
    decidedAt: days(-149),
    employer: { id: "emp-7", name: "Global Opportunity Partners", website: null, emailDomain: "gop-jobs.example", industry: "Staffing", sizeBand: "1-10", hqCity: null, hqState: null, verificationStatus: "Flagged", flagReason: "Requested fees from applicants." },
  },
];

// ---------------------------------------------------------------- appointments

const INTAKE_RESUME = [
  { id: "iq-role", label: "What kind of role are you applying for?", required: true, kind: "text" as const, options: null },
  { id: "iq-help", label: "Anything specific you want feedback on?", required: false, kind: "textarea" as const, options: null },
];
const INTAKE_EXPLORE = [{ id: "iq-year", label: "Class year", required: true, kind: "choice" as const, options: ["First year", "Sophomore", "Junior", "Senior", "Graduate"] }];

const APPT_TYPES = [
  { id: "type-resume", name: "Resume review", description: "A 30-minute review of your resume with a counselor.", durationMinutes: 30, modes: ["InPerson", "Video"], allowStudents: true, allowAlumni: true, minLeadMinutes: 120, maxLeadDays: 30, bufferMinutes: 10, cancelCutoffMinutes: 240, intakeQuestions: INTAKE_RESUME, active: true, sortOrder: 1 },
  { id: "type-explore", name: "Career exploration", description: "Talk through majors, careers and next steps.", durationMinutes: 45, modes: ["InPerson", "Video", "Phone"], allowStudents: true, allowAlumni: false, minLeadMinutes: 240, maxLeadDays: 45, bufferMinutes: 15, cancelCutoffMinutes: 1440, intakeQuestions: INTAKE_EXPLORE, active: true, sortOrder: 2 },
  { id: "type-mock", name: "Mock interview", description: "Practice a behavioral interview.", durationMinutes: 60, modes: ["Video"], allowStudents: true, allowAlumni: true, minLeadMinutes: 1440, maxLeadDays: 30, bufferMinutes: 15, cancelCutoffMinutes: 1440, intakeQuestions: [], active: false, sortOrder: 3 },
];

const COUNSELORS = [
  { userId: USER_ID, name: ME.name, email: ME.email, role: "CareerAdmin", isMe: true, bookable: true, typeIds: ["type-resume", "type-explore"], title: "Associate Director, Career Advising", meetingUrl: "https://meet.example/jordan-lee", location: "Student Success Center, Room 210", weeklyBlocks: 6 },
  { userId: PRIYA.userId, name: PRIYA.name, email: PRIYA.email, role: "Counselor", isMe: false, bookable: true, typeIds: ["type-resume", "type-explore", "type-mock"], title: "Career Counselor, College of Engineering", meetingUrl: "https://meet.example/priya-raman", location: "Engineering Hall 115", weeklyBlocks: 8 },
  { userId: MARCUS.userId, name: MARCUS.name, email: MARCUS.email, role: "Counselor", isMe: false, bookable: false, typeIds: ["type-explore"], title: "Career Counselor, Business School", meetingUrl: null, location: "Hughes Hall 302", weeklyBlocks: 0 },
];

function appt(
  id: string,
  opts: { type: (typeof APPT_TYPES)[number]; startH: number; student: (typeof STUDENTS)[number]; counselor: { userId: string; name: string }; mode: string; status: string; outcome?: string | null; bookedOnBehalf?: boolean; rescheduleCount?: number; cancelReason?: string | null },
) {
  const start = hours(opts.startH);
  const end = new Date(new Date(start).getTime() + opts.type.durationMinutes * 60_000).toISOString();
  return {
    id,
    typeId: opts.type.id,
    typeName: opts.type.name,
    startUtc: start,
    endUtc: end,
    localStart: start.slice(0, 19),
    timeZone: TZ,
    mode: opts.mode,
    location: opts.mode === "InPerson" ? "Student Success Center, Room 210" : null,
    meetingUrl: opts.mode === "Video" ? "https://meet.example/jordan-lee" : null,
    status: opts.status,
    outcome: opts.outcome ?? null,
    counselor: { userId: opts.counselor.userId, name: opts.counselor.name },
    student: { userId: opts.student.userId, name: opts.student.name, email: opts.student.email, studentNumber: opts.student.studentNumber },
    intakeAnswers: opts.type.id === "type-resume" ? { "iq-role": "Data analyst internships for summer", "iq-help": "Whether my projects section is too long." } : opts.type.id === "type-explore" ? { "iq-year": "Junior" } : {},
    intakeQuestions: opts.type.intakeQuestions,
    cancelCutoffUtc: hours(opts.startH - 4),
    canChange: opts.status === "Booked",
    cancelReason: opts.cancelReason ?? null,
    cancelledAt: opts.status === "Cancelled" ? hours(-20) : null,
    bookedOnBehalf: opts.bookedOnBehalf ?? false,
    rescheduleCount: opts.rescheduleCount ?? 0,
    // H15: booked appointments are on the counselor's calendar invite
    inviteStatus: opts.status === "Booked" ? "Invited" : null,
    inviteSkippedReason: null,
    createdAt: days(-7),
  };
}

const [T_RESUME, T_EXPLORE] = APPT_TYPES;
const APPOINTMENTS = [
  appt("appt-1", { type: T_RESUME, startH: -1, student: AISHA, counselor: ME, mode: "InPerson", status: "Booked", rescheduleCount: 1 }),
  appt("appt-2", { type: T_EXPLORE, startH: 2, student: DIEGO, counselor: ME, mode: "Video", status: "Booked", bookedOnBehalf: true }),
  appt("appt-3", { type: T_RESUME, startH: -4, student: EMILY, counselor: PRIYA, mode: "Video", status: "Completed", outcome: "Attended" }),
  appt("appt-4", { type: T_EXPLORE, startH: 4, student: TYLER, counselor: PRIYA, mode: "Phone", status: "Cancelled", cancelReason: "Class schedule conflict" }),
];
const HISTORY = [
  appt("appt-0a", { type: T_EXPLORE, startH: -24 * 40, student: AISHA, counselor: PRIYA, mode: "InPerson", status: "Completed", outcome: "Attended" }),
  appt("appt-0b", { type: T_RESUME, startH: -24 * 75, student: AISHA, counselor: ME, mode: "Video", status: "Completed", outcome: "NoShow" }),
];

function appointmentDetail(ctx: FixtureContext) {
  const id = lastSegment(ctx);
  const a = [...APPOINTMENTS, ...HISTORY].find((x) => x.id === id) ?? APPOINTMENTS[0];
  return {
    appointment: a,
    notes: [
      { id: "note-1", appointmentId: a.id, visibility: "Private", body: "Student is weighing two internship offers; follow up on salary negotiation questions.", createdAt: days(-1), updatedAt: days(-1), author: ME.name, canEdit: true },
      { id: "note-2", appointmentId: a.id, visibility: "Shared", body: "Next steps: tailor the resume summary for each role and add the capstone project.", createdAt: days(-40), updatedAt: days(-39), author: PRIYA.name, canEdit: false },
    ],
    tasks: [
      { id: "task-1", title: "Upload revised resume for review", details: null, dueDate: ymd(5), status: "Open", assigneeType: "Student" },
      { id: "task-2", title: "Send alumni contacts at Prairie Health", details: null, dueDate: ymd(2), status: "Done", assigneeType: "Counselor" },
    ],
    history: HISTORY,
  };
}

const slotsBody = (ctx: FixtureContext) => {
  const counselor = ctx.url.searchParams.get("counselorId");
  const ids = counselor ? [counselor] : [USER_ID, PRIYA.userId];
  const slots = [1, 1, 2, 3, 3, 3].map((d, i) => {
    const day = ymd(d);
    const h = 9 + i;
    const hh = String(h).padStart(2, "0");
    return { startUtc: `${day}T${String(h + 5).padStart(2, "0")}:00:00Z`, endUtc: `${day}T${String(h + 5).padStart(2, "0")}:30:00Z`, localStart: `${day}T${hh}:00:00`, counselorUserIds: ids };
  });
  return { timeZone: TZ, slots };
};

const DROPIN_SESSIONS = [
  { id: "dropin-today", name: "Drop-in advising", location: "Student Success Center lobby", status: "Open", minutesPerStudent: 15, openedAt: hours(-2), closedAt: null, counts: { Waiting: 2, Called: 1, Seen: 4, NoShow: 1 } },
  { id: "dropin-tue", name: "Engineering drop-ins", location: "Engineering Hall 115", status: "Closed", minutesPerStudent: 10, openedAt: days(-3), closedAt: days(-3), counts: { Seen: 11, NoShow: 2, Left: 1 } },
];

const dropinQueue = (ctx: FixtureContext) => {
  const id = lastSegment(ctx, 1);
  const session = DROPIN_SESSIONS.find((s) => s.id === id) ?? DROPIN_SESSIONS[0];
  return {
    session,
    averageServiceMinutes: 14,
    waiting: 2,
    estimatedWaitMinutes: 28,
    entries: [
      { id: "q-5", queueNumber: 5, status: "Called", topic: "Internship offer questions", source: "Kiosk", checkedInAt: hours(-0.6), calledAt: hours(-0.1), position: null, waitedMinutes: 29.4, student: { userId: AISHA.userId, name: AISHA.name, email: AISHA.email, studentNumber: AISHA.studentNumber }, calledBy: ME.name },
      { id: "q-6", queueNumber: 6, status: "Waiting", topic: "Resume check", source: "Web", checkedInAt: hours(-0.4), calledAt: null, position: 1, waitedMinutes: 24, student: { userId: DIEGO.userId, name: DIEGO.name, email: DIEGO.email, studentNumber: DIEGO.studentNumber }, calledBy: null },
      { id: "q-7", queueNumber: 7, status: "Waiting", topic: null, source: "Staff", checkedInAt: hours(-0.1), calledAt: null, position: 2, waitedMinutes: 6, student: { userId: null, name: "Sam Nguyen", email: "sam.nguyen@lakeside.edu", studentNumber: "L00431122" }, calledBy: null },
      { id: "q-3", queueNumber: 3, status: "Seen", topic: "Grad school personal statement", source: "Kiosk", checkedInAt: hours(-1.8), calledAt: hours(-1.6), position: null, waitedMinutes: 12, student: { userId: EMILY.userId, name: EMILY.name, email: EMILY.email, studentNumber: EMILY.studentNumber }, calledBy: PRIYA.name },
      { id: "q-4", queueNumber: 4, status: "NoShow", topic: "Career fair prep", source: "Web", checkedInAt: hours(-1.5), calledAt: hours(-1.2), position: null, waitedMinutes: 18, student: { userId: TYLER.userId, name: TYLER.name, email: TYLER.email, studentNumber: TYLER.studentNumber }, calledBy: ME.name },
    ],
  };
};

const counselorProfile = {
  userId: USER_ID,
  name: ME.name,
  title: "Associate Director, Career Advising",
  bio: "I help students in business and the social sciences plan internships and first jobs.",
  meetingUrl: "https://meet.example/jordan-lee",
  location: "Student Success Center, Room 210",
  phone: "(217) 555-0142",
  bookable: true,
  typeIds: ["type-resume", "type-explore"],
  calendarFeedPath: "/api/career/appointments/feed/8f2c1d7e.ics",
};

const availability = {
  timeZone: TZ,
  weekly: [
    { id: "wk-1", dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
    { id: "wk-2", dayOfWeek: 1, startTime: "13:00", endTime: "16:00" },
    { id: "wk-3", dayOfWeek: 3, startTime: "10:00", endTime: "15:00" },
    { id: "wk-4", dayOfWeek: 4, startTime: "09:00", endTime: "11:30" },
  ],
  exceptions: [
    { id: "ex-1", date: ymd(9), startTime: null, endTime: null, kind: "Blocked", note: "Fall career fair" },
    { id: "ex-2", date: ymd(16), startTime: "16:00", endTime: "18:00", kind: "Extra", note: "Evening hours for graduate students" },
  ],
};

const reportLine = (key: string, total: number, attended: number, noShow: number, lateCancelled: number, cancelled: number, booked: number) => ({
  key,
  total,
  attended,
  noShow,
  lateCancelled,
  cancelled,
  booked,
  noShowRate: attended + noShow === 0 ? null : Math.round((noShow / (attended + noShow)) * 1000) / 10,
});

const appointmentsReport = () => ({
  from: ymd(-30),
  to: ymd(0),
  timeZone: TZ,
  overall: reportLine("All", 214, 168, 14, 6, 18, 8),
  byType: [reportLine("Resume review", 121, 99, 7, 3, 9, 3), reportLine("Career exploration", 78, 60, 6, 3, 6, 3), reportLine("Mock interview", 15, 9, 1, 0, 3, 2)],
  byCounselor: [reportLine(ME.name, 88, 70, 5, 2, 8, 3), reportLine(PRIYA.name, 102, 82, 8, 4, 6, 2), reportLine(MARCUS.name, 24, 16, 1, 0, 4, 3)],
  byWeek: [reportLine(ymd(-28), 48, 39, 3, 1, 5, 0), reportLine(ymd(-21), 55, 44, 4, 2, 5, 0), reportLine(ymd(-14), 61, 49, 4, 2, 4, 2), reportLine(ymd(-7), 50, 36, 3, 1, 4, 6)],
  bookedOnBehalf: 23,
  dropIn: { checkIns: 136, seen: 118, noShow: 9, left: 9, kioskCheckIns: 97, averageWaitMinutes: 13.5, medianWaitMinutes: 11, longestWaitMinutes: 52 },
});

// ---------------------------------------------------------------- calendar

const calendarStatus = {
  providers: [
    { provider: "Microsoft", available: true },
    { provider: "Google", available: false },
  ],
  connection: {
    id: "cal-1",
    provider: "Microsoft",
    accountEmail: ME.email,
    status: "Connected",
    lastError: null,
    connectedAt: days(-21),
    lastRefreshAt: hours(-1),
    lastBusyReadAt: hours(-0.5),
    lastEventSyncAt: hours(-3),
  },
  eventsInCalendar: 12,
  school: { readBusyEnabled: true, writeEventsEnabled: true, includeStudentNames: false, generateMeetingLinks: true, addStudentsToMeetingInvite: true },
  isAdmin: true,
};

// ---------------------------------------------------------------- caseload (triage)

const TRIAGE_RULES = [
  { key: "final_year_no_appointment", title: "Final year, no recent appointment", description: "Graduating within the final-year window and no appointment in the set number of months." },
  { key: "agreement_unsigned", title: "Internship agreement unsigned", description: "An approved internship starts soon and the learning agreement isn't fully signed." },
  { key: "doc_returned_not_acted", title: "Document review not acted on", description: "A reviewed document was returned and the student hasn't opened it or sent a new version." },
  { key: "unanswered_thread", title: "Unanswered message", description: "A student message has waited for a staff reply longer than the set number of days." },
  { key: "mentoring_pending", title: "Mentoring request pending", description: "A mentoring request has waited longer than the set number of days." },
  { key: "no_verified_evidence", title: "No verified evidence", description: "Final-year student without a passing sprint or verified credential." },
];

const triageSettings = {
  finalYearMonths: 12,
  noAppointmentMonths: 6,
  agreementDaysBeforeStart: 14,
  docReturnedDays: 21,
  unansweredThreadDays: 3,
  mentoringPendingDays: 10,
  passingSprintPercent: 70,
  disabledRules: ["mentoring_pending"],
  copilotEnabled: true,
  copilotIncludePrivateNotes: false,
  copilotAvailable: true,
  copilotSimulated: false,
  updatedAt: days(-12),
  rules: TRIAGE_RULES,
};

const sig = (key: string, severity: string, reason: string, link: string | null = null) => ({ key, title: TRIAGE_RULES.find((r) => r.key === key)?.title ?? key, severity, reason, since: days(-10), link });

const CASELOAD = [
  {
    userId: AISHA.userId,
    name: AISHA.name,
    email: AISHA.email,
    majors: ["Computer Science"],
    college: "College of Engineering",
    graduationDate: days(150),
    counselorUserId: USER_ID,
    counselorName: ME.name,
    assignmentSource: "Rule:Major",
    signalCount: 2,
    score: 7,
    signals: [sig("agreement_unsigned", "high", "Internship at Prairie Health starts in 6 days; the supervisor hasn't signed.", "/career-center/experiences/exp-approved"), sig("final_year_no_appointment", "medium", "Graduates in 5 months; last appointment was 8 months ago.")],
    snoozedSignals: [],
    lastContactAt: days(-30),
  },
  {
    userId: DIEGO.userId,
    name: DIEGO.name,
    email: DIEGO.email,
    majors: ["Marketing", "Spanish"],
    college: "Hughes School of Business",
    graduationDate: days(400),
    counselorUserId: USER_ID,
    counselorName: ME.name,
    assignmentSource: "Manual",
    signalCount: 1,
    score: 3,
    signals: [sig("doc_returned_not_acted", "low", "Resume review returned 24 days ago and not opened.", "/career-center/document-review")],
    snoozedSignals: [sig("unanswered_thread", "medium", "Message from 5 days ago has no reply.")],
    lastContactAt: null,
  },
  {
    userId: EMILY.userId,
    name: EMILY.name,
    email: EMILY.email,
    majors: [],
    college: null,
    graduationDate: null,
    counselorUserId: null,
    counselorName: null,
    assignmentSource: "Pool",
    signalCount: 0,
    score: 0,
    signals: [],
    snoozedSignals: [],
    lastContactAt: days(-3),
  },
];

const caseloadBody = (ctx: FixtureContext) => {
  const scope = ctx.url.searchParams.get("scope") ?? "mine";
  return { scope, total: 3, flagged: 2, students: CASELOAD };
};

const studentPanel = (ctx: FixtureContext) => {
  const id = lastSegment(ctx);
  const row = CASELOAD.find((s) => s.userId === id) ?? CASELOAD[0];
  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    majors: row.majors,
    college: row.college,
    graduationDate: row.graduationDate,
    counselorName: row.counselorName,
    assignmentSource: row.assignmentSource,
    signals: [
      ...row.signals.map((s) => ({ ...s, snooze: null })),
      ...row.snoozedSignals.map((s) => ({ ...s, snooze: { id: "snz-1", until: days(9), reason: "Student is abroad until next week.", byName: PRIYA.name } })),
    ],
    timeline: [
      { at: days(-3), kind: "appointment", title: "Resume review", detail: "Attended with Priya Raman" },
      { at: days(-12), kind: "document", title: "Cover letter submitted for review", detail: null },
      { at: days(-30), kind: "contact", title: "Contacted by email", detail: "Shared internship-for-credit steps" },
    ],
    copilotEnabled: true,
  };
};

const caseloadRules = [
  { id: "rule-1", counselorUserId: PRIYA.userId, counselorName: PRIYA.name, kind: "College", value: "College of Engineering", alphaFrom: null, alphaTo: null, priority: 10 },
  { id: "rule-2", counselorUserId: USER_ID, counselorName: ME.name, kind: "Major", value: "Computer Science", alphaFrom: null, alphaTo: null, priority: 20 },
  { id: "rule-3", counselorUserId: MARCUS.userId, counselorName: MARCUS.name, kind: "Alpha", value: null, alphaFrom: "A", alphaTo: "M", priority: 100 },
];

const copilotLog = [
  { id: "ai-1", kind: "Brief", createdAt: hours(-5), actorName: ME.name, studentName: AISHA.name, promptSha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", provider: "azure-openai", model: "gpt-4o-mini", simulated: false, injectionSuspected: false, sentThreadId: null },
  { id: "ai-2", kind: "Outreach", createdAt: days(-1), actorName: PRIYA.name, studentName: DIEGO.name, promptSha256: "60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752", provider: "azure-openai", model: "gpt-4o-mini", simulated: false, injectionSuspected: true, sentThreadId: "thread-88" },
  { id: "ai-3", kind: "Brief", createdAt: days(-4), actorName: null, studentName: null, promptSha256: "fd61a03af4f77d870fc21e05e7e80678095c92d808cfb3b5c279ee04c74aca13", provider: "stub", model: "development", simulated: true, injectionSuspected: false, sentThreadId: null },
];

// ---------------------------------------------------------------- employer challenges

const CHALLENGES = [
  {
    status: "Pending",
    autoApproved: false,
    decisionNote: null,
    requestedAt: days(-1),
    decidedAt: null,
    challenge: { id: "ch-1", title: "Hospital readmissions dashboard", description: "Build a small dashboard that flags 30-day readmission risk from a synthetic dataset.\nShow your SQL and explain one trade-off.", opensAt: days(5), closesAt: days(26), status: "Draft", degreeLevels: ["Bachelor's"], majors: ["Computer Science", "Statistics"], externalJobUrl: "https://prairiehealth.example/careers/data-intern", prizeText: "Top three get a guaranteed first-round interview.", maxParticipants: 60 },
    sprint: { title: "SQL analytics sprint", requiredLanguage: "SQL", taskType: "Analysis" },
    employer: { id: "emp-1", name: "Prairie Health Systems", website: "https://prairiehealth.example", verificationStatus: "DomainVerified" },
    participants: 0,
  },
  {
    status: "Approved",
    autoApproved: true,
    decisionNote: null,
    requestedAt: days(-20),
    decidedAt: days(-20),
    challenge: { id: "ch-2", title: "Warehouse robot path planning", description: "Plan collision-free routes for two robots on a grid.", opensAt: days(-10), closesAt: days(11), status: "Open", degreeLevels: [], majors: [], externalJobUrl: null, prizeText: null, maxParticipants: null },
    sprint: { title: "Graph search sprint", requiredLanguage: "Python", taskType: "Algorithm" },
    employer: { id: "emp-5", name: "Lakeshore Robotics", website: "https://lakeshorerobotics.example", verificationStatus: "DomainVerified" },
    participants: 34,
  },
  {
    status: "Declined",
    autoApproved: false,
    decisionNote: "Please remove the unpaid work-sample requirement and resubmit.",
    requestedAt: days(-15),
    decidedAt: days(-14),
    challenge: { id: "ch-3", title: "Rebrand our social media", description: "", opensAt: days(-7), closesAt: days(7), status: "Draft", degreeLevels: ["Associate", "Bachelor's"], majors: ["Marketing"], externalJobUrl: null, prizeText: "$100 gift card", maxParticipants: 20 },
    sprint: null,
    employer: { id: "emp-3", name: "BrightPath Media", website: null, verificationStatus: "Flagged" },
    participants: 0,
  },
];

// ---------------------------------------------------------------- document review

const RUBRIC_RESUME = [
  { key: "format", label: "Format and layout" },
  { key: "impact", label: "Impact statements" },
  { key: "tailoring", label: "Tailored to the role" },
  { key: "errors", label: "Spelling and grammar" },
];
const RUBRIC_COVER = [
  { key: "opening", label: "Strong opening" },
  { key: "fit", label: "Shows fit with the employer" },
  { key: "close", label: "Clear closing and next step" },
];
const RUBRIC_STATEMENT = [
  { key: "story", label: "Clear personal story" },
  { key: "goals", label: "Goals connect to the program" },
];

const docReviewOptions = {
  slaBusinessDays: 3,
  urgentWithinDays: 2,
  timeZone: TZ,
  ratings: ["Strong", "Satisfactory", "NeedsWork", "NotApplicable"],
  kinds: [
    { kind: "Resume", label: "Resume", rubric: RUBRIC_RESUME },
    { kind: "CoverLetter", label: "Cover letter", rubric: RUBRIC_COVER },
    { kind: "PersonalStatement", label: "Personal statement", rubric: RUBRIC_STATEMENT },
  ],
};

const reviewers = [
  { userId: USER_ID, name: ME.name, email: ME.email, role: "CareerAdmin" },
  { userId: PRIYA.userId, name: PRIYA.name, email: PRIYA.email, role: "Counselor" },
  { userId: MARCUS.userId, name: MARCUS.name, email: MARCUS.email, role: "Counselor" },
];

const docQueue = {
  total: 4,
  overdueCount: 1,
  items: [
    { id: "dr-1", kind: "Resume", kindLabel: "Resume", target: "Summer data analyst internships", status: "Unassigned", urgent: false, studentDeadline: null, currentVersion: 1, submittedAt: days(-5), dueAt: days(-1), overdue: true, waitingHours: 118, student: TYLER.name, assignee: null },
    { id: "dr-2", kind: "CoverLetter", kindLabel: "Cover letter", target: "Prairie Health Systems, Data Intern", status: "InReview", urgent: true, studentDeadline: ymd(2), currentVersion: 2, submittedAt: hours(-20), dueAt: days(2), overdue: false, waitingHours: 20, student: AISHA.name, assignee: { userId: USER_ID, name: ME.name } },
    { id: "dr-3", kind: "PersonalStatement", kindLabel: "Personal statement", target: "MPH applications", status: "Assigned", urgent: false, studentDeadline: null, currentVersion: 1, submittedAt: hours(-6), dueAt: days(3), overdue: false, waitingHours: 6, student: EMILY.name, assignee: { userId: PRIYA.userId, name: PRIYA.name } },
    { id: "dr-4", kind: "Resume", kindLabel: "Resume", target: "Marketing coordinator roles", status: "Returned", urgent: false, studentDeadline: null, currentVersion: 1, submittedAt: days(-9), dueAt: days(-6), overdue: false, waitingHours: 0, student: null, assignee: { userId: MARCUS.userId, name: MARCUS.name } },
  ],
};

const COVER_TEXT = [
  "Dear Hiring Team,",
  "",
  "I am excited to apply for the Data Intern position at Prairie Health Systems. As a junior studying Computer Science at Lakeside State University, I have built dashboards that help my campus food pantry predict demand.",
  "",
  "Last spring I cleaned and analyzed three years of visit records in SQL and Python, which cut weekly over-ordering by 18 percent. I would bring the same care to your readmissions work.",
  "",
  "Thank you for your consideration. I would welcome the chance to talk.",
  "",
  "Sincerely,",
  "Aisha Thompson",
].join("\n");

const anchored = (text: string, quote: string) => {
  const start = text.indexOf(quote);
  return { anchorStart: start, anchorEnd: start + quote.length, quote };
};

const docReviewDetail = (ctx: FixtureContext) => {
  const id = ctx.url.pathname.split("/")[6] ?? "dr-2";
  const q = docQueue.items.find((i) => i.id === id) ?? docQueue.items[1];
  const rubric = q.kind === "Resume" ? RUBRIC_RESUME : q.kind === "CoverLetter" ? RUBRIC_COVER : RUBRIC_STATEMENT;
  const student = STUDENTS.find((s) => s.name === q.student) ?? AISHA;
  const v1 = {
    id: `${id}-v1`,
    number: 1,
    submittedAt: days(-12),
    dueAt: days(-9),
    text: null,
    jobDescription: null,
    notesToReviewer: "First draft. I'm not sure about the opening.",
    file: { id: "file-1", fileName: "Thompson_CoverLetter_v1.pdf", contentType: "application/pdf", sizeBytes: 84_211 },
    returnedAt: days(-10),
    reviewStartedAt: days(-11),
    reviewer: { userId: PRIYA.userId, name: PRIYA.name },
    summary: "Good energy. Lead with the food-pantry project and name the employer in the first line.",
    rubric: rubric.map((r, i) => ({ key: r.key, label: r.label, rating: i === 0 ? "NeedsWork" : "Satisfactory", note: i === 0 ? "Opening is generic." : null })),
    annotatedFile: { id: "file-2", fileName: "Thompson_CoverLetter_v1_marked.pdf", contentType: "application/pdf", sizeBytes: 120_448 },
    comments: [{ id: "c-old-1", body: "Name the team you'd join.", anchorStart: null, anchorEnd: null, quote: null, page: 1, createdAt: days(-10), author: PRIYA.name, mine: false }],
  };
  const current = {
    id: `${id}-v2`,
    number: q.currentVersion > 1 ? 2 : 1,
    submittedAt: q.submittedAt,
    dueAt: q.dueAt,
    text: COVER_TEXT,
    jobDescription: "Support the analytics team with SQL reporting on patient outcomes. Familiarity with Python or R preferred.",
    notesToReviewer: "Applying Friday, so a quick look would be great.",
    file: null,
    returnedAt: null,
    reviewStartedAt: hours(-2),
    reviewer: { userId: USER_ID, name: ME.name },
    summary: "Much stronger opening.",
    rubric: rubric.map((r, i) => ({ key: r.key, label: r.label, rating: i === 0 ? "Strong" : null, note: null })),
    annotatedFile: null,
    comments: [
      { id: "c-1", body: "Great concrete result. Mention the tool you used for the dashboard.", ...anchored(COVER_TEXT, "cut weekly over-ordering by 18 percent"), page: null, createdAt: hours(-1), author: ME.name, mine: true },
      { id: "c-2", body: "Consider ending with a specific availability window.", anchorStart: null, anchorEnd: null, quote: null, page: null, createdAt: hours(-0.5), author: PRIYA.name, mine: false },
    ],
  };
  const versions = q.currentVersion > 1 ? [v1, current] : [current];
  return {
    id: q.id,
    kind: q.kind,
    kindLabel: q.kindLabel,
    target: q.target,
    status: q.status,
    urgent: q.urgent,
    studentDeadline: q.studentDeadline,
    currentVersion: q.currentVersion > 1 ? 2 : 1,
    submittedAt: q.submittedAt,
    dueAt: q.dueAt,
    overdue: q.overdue,
    returnedAt: null,
    completedAt: null,
    rating: 4,
    ratingComment: "The first round of feedback was really clear.",
    assignee: q.assignee,
    student: { userId: student.userId, name: student.name, email: student.email },
    rubricTemplate: rubric,
    versions,
  };
};

const docMetrics = {
  from: ymd(-90),
  to: ymd(0),
  submitted: 312,
  returned: 287,
  medianTurnaroundHours: 30.5,
  onTimePercent: 91,
  averageRating: 4.6,
  open: 25,
  unassigned: 7,
  overdue: 3,
  byKind: [
    { kind: "Resume", label: "Resume", submitted: 201 },
    { kind: "CoverLetter", label: "Cover letter", submitted: 84 },
    { kind: "PersonalStatement", label: "Personal statement", submitted: 27 },
  ],
  reviewers: [
    { userId: USER_ID, name: ME.name, email: ME.email, returned: 96, medianTurnaroundHours: 26, onTimePercent: 94, averageRating: 4.7, openAssigned: 4 },
    { userId: PRIYA.userId, name: PRIYA.name, email: PRIYA.email, returned: 141, medianTurnaroundHours: 31, onTimePercent: 90, averageRating: 4.6, openAssigned: 9 },
    { userId: null, name: "Former staff", email: "", returned: 50, medianTurnaroundHours: null, onTimePercent: null, averageRating: null, openAssigned: 0 },
  ],
};

const docSettings = { slaBusinessDays: 3, urgentWithinDays: 2, timeZone: TZ, rubrics: { Resume: RUBRIC_RESUME, CoverLetter: RUBRIC_COVER, PersonalStatement: RUBRIC_STATEMENT } };

// ---------------------------------------------------------------- experiences (internships for credit)

const PROGRAMS = [
  {
    id: "prog-cs",
    code: "CS 4950",
    title: "Computing Internship for Credit",
    description: "Supervised professional experience in software or data roles.",
    creditHours: 3,
    requiredHours: 120,
    requiredDocuments: ["Offer letter", "Job description"],
    midtermForm: [
      { key: "m1", text: "Quality of work", type: "rating" as const },
      { key: "m2", text: "Communication with the team", type: "rating" as const },
      { key: "m3", text: "What should the intern focus on next?", type: "text" as const },
    ],
    finalForm: [
      { key: "f1", text: "Technical growth over the internship", type: "rating" as const },
      { key: "f2", text: "Professionalism", type: "rating" as const },
      { key: "f3", text: "Would you hire this intern again? Why?", type: "text" as const },
    ],
    ratingScaleMax: 5,
    reflectionPrompts: ["What did you build, and who used it?", "Which course prepared you best?"],
    facultyApprovers: ["66666666-6666-4666-8666-666666666601"],
    requireCpt: true,
    agreementTerms: "The intern will not work more than 20 hours per week during the fall and spring terms.",
    active: true,
  },
  {
    id: "prog-mkt",
    code: "MKT 3900",
    title: "Marketing Practicum",
    description: null,
    creditHours: 1.5,
    requiredHours: 60,
    requiredDocuments: ["Offer letter"],
    midtermForm: [],
    finalForm: [{ key: "f1", text: "Overall performance", type: "rating" as const }],
    ratingScaleMax: 4,
    reflectionPrompts: ["Describe one campaign you contributed to."],
    facultyApprovers: [],
    requireCpt: false,
    agreementTerms: null,
    active: false,
  },
];
const [PROG_CS] = PROGRAMS;
const progRef = (p: (typeof PROGRAMS)[number]) => ({ id: p.id, code: p.code, title: p.title });

const EXPERIENCES = [
  { id: "exp-submitted", status: "Submitted", studentName: DIEGO.name, studentEmail: DIEGO.email, program: progRef(PROG_CS), employerName: "Lakeshore Robotics", roleTitle: "Software Engineering Intern", startDate: days(20), endDate: days(110), isF1: true, cptStatus: "Requested", facultyApproved: true, agreementSigned: false, finalGrade: null, submittedAt: days(-3), updatedAt: days(-1) },
  { id: "exp-submitted-2", status: "Submitted", studentName: TYLER.name, studentEmail: TYLER.email, program: progRef(PROGRAMS[1]), employerName: "Midwest Mutual Insurance", roleTitle: "Marketing Intern", startDate: days(30), endDate: days(100), isF1: false, cptStatus: null, facultyApproved: false, agreementSigned: false, finalGrade: null, submittedAt: days(-1), updatedAt: days(-1) },
  { id: "exp-approved", status: "Approved", studentName: AISHA.name, studentEmail: AISHA.email, program: progRef(PROG_CS), employerName: "Prairie Health Systems", roleTitle: "Data Analyst Intern", startDate: days(6), endDate: days(96), isF1: false, cptStatus: null, facultyApproved: true, agreementSigned: false, finalGrade: null, submittedAt: days(-20), updatedAt: days(-4) },
  { id: "exp-eval", status: "Evaluations", studentName: EMILY.name, studentEmail: EMILY.email, program: progRef(PROG_CS), employerName: "Northwind Analytics", roleTitle: "Data Engineering Intern", startDate: days(-100), endDate: days(-5), isF1: true, cptStatus: "Authorized", facultyApproved: true, agreementSigned: true, finalGrade: null, submittedAt: days(-130), updatedAt: days(-2) },
];

const experienceDashboard = {
  byStatus: { Submitted: 3, Approved: 1, AgreementSigned: 2, Active: 5, Evaluations: 2, Completed: 8, Declined: 1 },
  total: 22,
  awaitingFaculty: 1,
  awaitingCareerCenter: 2,
  pendingHourApprovals: 4,
  missingAgreements: [
    { id: "exp-approved", studentName: AISHA.name, employerName: "Prairie Health Systems", startDate: days(6), approvedAt: days(-4), startsInDays: 6 },
    { id: "exp-late", studentName: TYLER.name, employerName: "Midwest Mutual Insurance", startDate: days(-3), approvedAt: days(-15), startsInDays: -3 },
  ],
  overdueEvaluations: [{ id: "exp-eval", studentName: EMILY.name, employerName: "Northwind Analytics", kind: "Final", dueDate: days(-2) }],
  cptPending: [{ id: "exp-submitted", studentName: DIEGO.name, employerName: "Lakeshore Robotics", status: "Submitted", cptStatus: "Requested", cptStartDate: null, startDate: days(20) }],
};

const facultyChoices = [
  { userId: "66666666-6666-4666-8666-666666666601", name: "Dr. Ruth Okafor", email: "r.okafor@lakeside.edu", role: "Faculty" },
  { userId: "66666666-6666-4666-8666-666666666602", name: "Prof. Alan Weiss", email: "a.weiss@lakeside.edu", role: "Faculty" },
  { userId: USER_ID, name: ME.name, email: ME.email, role: "CareerAdmin" },
];

function experienceDetail(id: string) {
  const submitted = id.startsWith("exp-submitted");
  const student = submitted ? DIEGO : EMILY;
  const agreementText = [
    "LEARNING AGREEMENT: CS 4950 Computing Internship for Credit",
    `Student: ${student.name}`,
    "Organization: Northwind Analytics",
    "Role: Data Engineering Intern",
    "",
    "1. The intern will complete at least 120 supervised work hours.",
    "2. The site supervisor will complete a midterm and final evaluation.",
    "3. The intern will not work more than 20 hours per week during the fall and spring terms.",
  ].join("\n");
  return {
    id,
    status: submitted ? "Submitted" : "Evaluations",
    student: { userId: student.userId, name: student.name, email: student.email },
    program: PROG_CS,
    employer: submitted ? { id: "emp-5", name: "Lakeshore Robotics", website: "https://lakeshorerobotics.example" } : { id: "emp-nw", name: "Northwind Analytics", website: null },
    supervisor: submitted ? { name: "Hannah Price", email: "hprice@lakeshorerobotics.example", title: "Engineering Manager", confirmedAt: days(-2) } : { name: "Kevin Osei", email: "kosei@northwind.example", title: "Data Platform Lead", confirmedAt: days(-120) },
    roleTitle: submitted ? "Software Engineering Intern" : "Data Engineering Intern",
    startDate: submitted ? days(20) : days(-100),
    endDate: submitted ? days(110) : days(-5),
    hoursPerWeek: 20,
    paid: true,
    location: submitted ? "Chicago, IL" : null,
    remote: !submitted,
    learningObjectives: ["Ship a production feature with code review.", "Write automated tests for data pipelines.", "Present results to a non-technical audience."],
    cpt: submitted
      ? { required: true, isF1: true, status: "Requested", dsoApprovalDate: null, startDate: null, endDate: null, missing: true }
      : { required: true, isF1: true, status: "Authorized", dsoApprovalDate: ymd(-110), startDate: ymd(-100), endDate: ymd(-5), missing: false },
    approvals: submitted ? { facultyApprovedAt: days(-2), staffApprovedAt: null, declineReason: null } : { facultyApprovedAt: days(-125), staffApprovedAt: days(-122), declineReason: null },
    agreement: submitted
      ? null
      : {
          id: "agr-2",
          version: 2,
          text: agreementText,
          sha256: "3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b",
          createdAt: days(-121),
          completedAt: days(-118),
          signatures: [
            { role: "Student", name: student.name, email: student.email, signedAt: days(-120), typedName: student.name, textSha256: "3a7bd3e2", ip: "10.20.4.18", userAgent: "Firefox 131 on Windows", provider: "Click-to-sign" },
            { role: "Supervisor", name: "Kevin Osei", email: "kosei@northwind.example", signedAt: days(-119), typedName: "Kevin Osei", textSha256: "3a7bd3e2", ip: "203.0.113.7", userAgent: "Safari 18 on macOS", provider: "Click-to-sign" },
            { role: "Faculty", name: "Dr. Ruth Okafor", email: "r.okafor@lakeside.edu", signedAt: days(-118), typedName: "Ruth Okafor", textSha256: "3a7bd3e2", ip: null, userAgent: null, provider: "Click-to-sign" },
          ],
          canSign: false,
          pendingRoles: [],
        },
    agreementHistory: submitted
      ? []
      : [{ version: 1, sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9", createdAt: days(-124), voidedAt: days(-121), voidReason: "Start date changed", signatures: [{ role: "Student", name: student.name, signedAt: days(-123), voidedAt: days(-121) }] }],
    hours: submitted
      ? []
      : [
          { id: "h-1", weekStart: ymd(-21), hours: 20, description: "Migrated nightly ETL jobs to the new scheduler.", status: "Approved", decisionNote: null, submittedAt: days(-14) },
          { id: "h-2", weekStart: ymd(-14), hours: 18, description: "Wrote data-quality tests.", status: "Rejected", decisionNote: "Please split out the training day.", submittedAt: days(-7) },
          { id: "h-3", weekStart: ymd(-7), hours: 20, description: null, status: "Pending", decisionNote: null, submittedAt: days(-1) },
        ],
    hoursSummary: submitted ? { approved: 0, pending: 0, required: 120 } : { approved: 104, pending: 20, required: 120 },
    reflections: submitted ? [] : [{ id: "r-1", prompt: "What did you build, and who used it?", body: "A data-quality report the analytics team checks every morning.", facultyComment: "Nice clear impact statement.", updatedAt: days(-6) }],
    evaluations: submitted
      ? []
      : [
          {
            id: "ev-1",
            kind: "Midterm",
            submittedAt: days(-50),
            submittedByName: "Kevin Osei",
            ratingScaleMax: 5,
            comments: "Emily ramped up quickly.",
            questions: PROG_CS.midtermForm,
            answers: { m1: 5, m2: 4, m3: "Speak up more in design reviews." },
          },
        ],
    documents: [
      { id: "doc-1", kind: "Offer letter", fileName: "offer-letter.pdf", uploadedAt: days(-6) },
      ...(submitted ? [] : [{ id: "doc-2", kind: "Job description", fileName: "job-description.docx", uploadedAt: days(-130) }]),
    ],
    missingDocuments: submitted ? ["Job description"] : [],
    grade: { finalGrade: submitted ? null : "A-", gradeComment: submitted ? null : "Strong evaluations and reflections.", gradedAt: submitted ? null : days(-1) },
    timeline: [
      { actorName: student.name, actorRole: "Student", action: "submitted", comment: null, at: days(-3) },
      { actorName: "Dr. Ruth Okafor", actorRole: "Faculty", action: "faculty.approved", comment: "Fits the CS 4950 learning outcomes.", at: days(-2) },
      { actorName: "System", actorRole: "System", action: "link.reissued", comment: null, at: days(-1) },
    ],
    supervisorLinks: submitted
      ? null
      : [
          { purpose: "FinalEvaluation", issuedAt: days(-4), expiresAt: days(26), lastUsedAt: null, useCount: 0, state: "Active" },
          { purpose: "Hours", issuedAt: days(-40), expiresAt: days(-10), lastUsedAt: days(-12), useCount: 6, state: "Expired" },
        ],
    canEdit: false,
  };
}

const defenseState = (ctx: FixtureContext) => {
  const id = ctx.url.pathname.split("/")[5] ?? "exp-eval";
  return {
    experience: { id, status: "Evaluations", roleTitle: "Data Engineering Intern", employerName: "Northwind Analytics", supervisorName: "Kevin Osei", studentName: EMILY.name, startDate: days(-100), endDate: days(-5) },
    verification: { status: "PartlyVerified", label: "Partly verified" },
    eligibility: { canStart: false, reason: null },
    options: { writtenAvailable: true, voiceAvailable: false, consentText: "I agree to share my answers with my site supervisor.", threshold: 70, canOverride: true },
    defense: {
      id: "def-1",
      mode: "Written",
      status: "Decided",
      artifacts: [
        { kind: "repo", title: "Pipeline data-quality checks", url: "https://git.example/northwind/dq-checks", description: "Great Expectations suites for the nightly ETL." },
        { kind: "description", title: "Morning data report", url: null, description: "A report the analytics team reads every morning." },
      ],
      startedAt: days(-4),
      finishedAt: days(-4),
      maxQuestions: 6,
      answered: 6,
      awaitingAnswer: false,
      canFinish: false,
      simulated: false,
      turns: [
        { role: "interviewer", text: "Which check caught the most real problems, and why?", at: days(-4) },
        { role: "student", text: "The row-count drift check: upstream exports were silently truncated twice.", at: days(-4) },
      ],
      result: {
        score: 74,
        threshold: 70,
        rubric: { ownership: 80, technicalDepth: 72, decisions: 70, outcomes: 75 },
        evidence: { items: [{ dimension: "ownership", quote: "I wrote the suites and set up the alerting myself.", note: null }], concerns: ["The answer about test coverage was vague."] },
        summary: "Clear ownership of the checks; trade-offs were described briefly.",
        graderSource: "model",
        gradedAt: days(-4),
      },
      supervisor: { name: "Kevin Osei", email: "kosei@northwind.example", answer: "Partly", comment: "She built most of it; alerting was a pair effort.", answeredByName: "Kevin Osei", answeredAt: days(-2) },
      computedStatus: "PartlyVerified",
      overrideInfo: null,
      consent: { consentedAt: days(-4), text: "I agree to share my answers with my site supervisor.", active: true },
      supervisorLinks: [{ issuedAt: days(-4), expiresAt: days(26), lastUsedAt: days(-2), useCount: 1, state: "Used" }],
    },
    credential: null,
    voice: null,
    devToken: null,
  };
};

// ---------------------------------------------------------------- outcome frameworks

const FRAMEWORKS = [
  {
    key: "nace",
    name: "NACE Career Readiness",
    description: "The eight NACE career readiness competencies.",
    builtIn: true,
    enabled: true,
    note: "Competency names follow NACE's published definitions.",
    allowsProgramSpecific: false,
    mappingCount: 3,
    outcomes: [
      { code: "CT", title: "Critical thinking" },
      { code: "COM", title: "Communication" },
      { code: "TW", title: "Teamwork" },
      { code: "TECH", title: "Technology" },
    ],
  },
  {
    key: "abet-cac",
    name: "ABET Computing (CAC) student outcomes",
    description: "Student outcomes 1-6 for computing programs.",
    builtIn: true,
    enabled: true,
    note: "Use alongside your program's own assessment plan.",
    allowsProgramSpecific: true,
    mappingCount: 2,
    outcomes: [
      { code: "SO1", title: "Analyze a complex computing problem and apply principles of computing" },
      { code: "SO2", title: "Design, implement and evaluate a computing-based solution" },
      { code: "SO3", title: "Communicate effectively in a variety of professional contexts" },
    ],
  },
  {
    key: "lsu-cs",
    name: "Lakeside CS program goals",
    description: "Department goals adopted in 2024.",
    builtIn: false,
    enabled: false,
    note: "",
    allowsProgramSpecific: false,
    mappingCount: 0,
    outcomes: [
      { code: "G1", title: "Write correct, tested programs" },
      { code: "G2", title: "Work on a team project" },
    ],
  },
];

const frameworkCatalog = {
  role: "CareerAdmin",
  canEdit: true,
  minCellSize: 5,
  minCellSizeFloor: 3,
  enabled: ["nace", "abet-cac"],
  frameworks: FRAMEWORKS,
  sources: [
    { key: "sprint_tests", label: "Coding sprint hidden tests", direct: true, refLabel: "Sprint", description: "Share of hidden tests passed in a timed sprint." },
    { key: "doc_review_rubric", label: "Document review checklist", direct: true, refLabel: "Checklist item", description: "Counselor ratings on a document review checklist item." },
    { key: "internship_evaluation", label: "Internship supervisor evaluation", direct: true, refLabel: "Evaluation question", description: "Site supervisor rating on an evaluation question." },
    { key: "mentoring_participation", label: "Mentoring participation", direct: false, refLabel: "None needed", description: "Students who completed a mentoring relationship." },
  ],
};

const frameworkFor = (ctx: FixtureContext) => FRAMEWORKS.find((f) => f.key === ctx.url.pathname.split("/")[4]) ?? FRAMEWORKS[0];

const mappingsBody = (ctx: FixtureContext) => {
  const f = frameworkFor(ctx);
  const [a, b] = f.outcomes;
  return {
    mappings: [
      { id: "map-1", outcomeCode: a.code, source: "sprint_tests", sourceRef: "sprint-sql", weight: 1, targetScore: 60, level3: 70, level2: 60, level1: 50 },
      { id: "map-2", outcomeCode: b.code, source: "doc_review_rubric", sourceRef: "Resume:impact", weight: 0.5, targetScore: 70, level3: 70, level2: 60, level1: 50 },
      { id: "map-3", outcomeCode: b.code, source: "mentoring_participation", sourceRef: null, weight: 0.3, targetScore: 50, level3: 60, level2: 50, level1: 40 },
    ],
  };
};

const referenceOptions = {
  sprints: [
    { value: "sprint-sql", label: "SQL analytics sprint" },
    { value: "sprint-graph", label: "Graph search sprint" },
  ],
  sprintsWithEvidence: [{ value: "sprint-sql", label: "SQL analytics sprint (42 students)" }],
  checklistItems: [
    { value: "Resume:impact", label: "Resume: Impact statements" },
    { value: "CoverLetter:fit", label: "Cover letter: Shows fit with the employer" },
  ],
  evaluationQuestions: [
    { value: "prog-cs:f1", label: "CS 4950 final: Technical growth over the internship" },
    { value: "prog-cs:f2", label: "CS 4950 final: Professionalism" },
  ],
};

const attainmentBody = (ctx: FixtureContext) => {
  const f = frameworkFor(ctx);
  const grouped = !!ctx.url.searchParams.get("groupBy");
  const values = [2.71, 1.84, 1.12, null];
  const outcomes = f.outcomes.map((o, i) => ({
    code: o.code,
    title: o.title,
    directAttainment: values[i % values.length],
    indirectAttainment: i === 1 ? 2.2 : null,
    directSuppressed: false,
    indirectSuppressed: i !== 1,
    mappings:
      i < 2
        ? [
            {
              mappingId: `att-${o.code}`,
              source: i === 0 ? "sprint_tests" : "doc_review_rubric",
              sourceLabel: i === 0 ? "Coding sprint hidden tests" : "Document review checklist",
              sourceRefLabel: i === 0 ? "SQL analytics sprint" : "Resume: Impact statements",
              direct: true,
              weight: i === 0 ? 1 : 0.5,
              targetScore: 60,
              level3: 70,
              level2: 60,
              level1: 50,
              assessed: i === 0 ? "42" : "<5",
              atOrAboveTarget: i === 0 ? 31 : null,
              percent: i === 0 ? 73.8 : null,
              level: i === 0 ? 3 : null,
              suppressed: i !== 0,
            },
          ]
        : [],
  }));
  return {
    framework: { key: f.key, name: f.name, note: f.note || "Custom framework." },
    options: { programs: ["Computer Science", "Data Science", "Nursing"], cohorts: ["Spring 2026", "Fall 2026", "Spring 2027"], terms: ["Fall 2025", "Spring 2026"] },
    minCellSize: 5,
    students: "118",
    outcomes,
    groups: grouped
      ? [
          { name: "Computer Science", students: "71", outcomes: outcomes.map((o) => ({ ...o, mappings: undefined })) },
          { name: "Nursing", students: "<5", outcomes: outcomes.map((o) => ({ ...o, directAttainment: null, directSuppressed: true, mappings: undefined })) },
        ]
      : [],
    note: "Attainment level 3: at least 70% of assessed students reach the target score; level 2: 60%; level 1: 50%.",
  };
};

// ---------------------------------------------------------------- imports

const IMPORT_FIELDS = {
  Students: [
    { key: "email", label: "School email", required: true, hint: "Used to match people who already have accounts." },
    { key: "firstName", label: "First name", required: true, hint: null },
    { key: "lastName", label: "Last name", required: true, hint: null },
    { key: "studentNumber", label: "Student ID", required: false, hint: "Optional, also used for matching." },
    { key: "major", label: "Major", required: false, hint: null },
    { key: "graduationDate", label: "Expected graduation", required: false, hint: "Any common date format." },
  ],
  Appointments: [
    { key: "studentEmail", label: "Student email", required: true, hint: null },
    { key: "date", label: "Appointment date", required: true, hint: null },
    { key: "type", label: "Appointment type", required: false, hint: null },
    { key: "notes", label: "Notes", required: false, hint: "Imported as private staff notes." },
  ],
  Experiences: [
    { key: "studentEmail", label: "Student email", required: true, hint: null },
    { key: "employer", label: "Organization", required: true, hint: null },
  ],
  Mentoring: [
    { key: "menteeEmail", label: "Mentee email", required: true, hint: null },
    { key: "mentorEmail", label: "Mentor email", required: true, hint: null },
  ],
  Placements: [
    { key: "studentEmail", label: "Student email", required: false, hint: "Student email or student id number is required." },
    { key: "employerName", label: "Employer (or institution for further study)", required: true, hint: null },
    { key: "roleTitle", label: "Job title, role or program", required: false, hint: null },
    { key: "employmentType", label: "Job, offer or contract type", required: false, hint: null },
    { key: "salary", label: "Salary, package (CTC) or stipend", required: false, hint: "Kept as reported." },
  ],
};

const importPresets = {
  notice: "Column names are based on typical exports and may differ for your school. Check each mapping before you import.",
  sources: ["Handshake", "Symplicity", "12twenty", "Superset", "CareerHub", "Orbis", "Target Connect", "JobTeaser", "Esup-Stage", "Other"],
  kinds: ["Students", "Appointments", "Experiences", "Mentoring", "Placements"],
  fields: IMPORT_FIELDS,
  sourceNotes: { Superset: "India placement platform. Exports: placement drives' offers per student." },
  defaultOptions: { Superset: { dayFirst: true, currency: "INR" }, Handshake: { dayFirst: false, currency: "USD" } },
};

const connectorsBody = {
  note: "Job postings and applications stay on these platforms. Only your school's records of where students went are imported.",
  platforms: [
    {
      provider: "superset", displayName: "Superset", source: "Superset", markets: "India", holds: "Placement drives, offers per student.",
      fileExport: "Placement reports exported as Excel/CSV.", apiStatus: "File import available. No API connector built.",
      apiWouldNeed: ["Institution id", "API key issued to the institution"], implemented: false, testOnly: false,
      notice: "Not verified with the vendor.", settings: [],
      connection: { id: "conn-1", portalUrl: "https://lakeside.example-placements.test/", active: true, lastPullAt: null, lastPullStatus: null, settings: {}, secretsSet: [] },
    },
    {
      provider: "test", displayName: "Test platform (sample data)", source: "Test platform", markets: "Testing only", holds: "Sample placement records.",
      fileExport: "Not applicable.", apiStatus: "Test connector: implemented.", apiWouldNeed: ["API key"], implemented: true, testOnly: true,
      notice: "Not verified with the vendor.",
      settings: [
        { key: "fixture", label: "Sample records (JSON array)", secret: false, hint: "Objects keyed by placement field names." },
        { key: "apiKey", label: "API key", secret: true, hint: null },
      ],
      connection: { id: "conn-2", portalUrl: null, active: true, lastPullAt: hours(-2), lastPullStatus: "3 records ready to review.", settings: { fixture: "[]" }, secretsSet: ["apiKey"] },
    },
  ],
};

const STUDENT_HEADERS = ["Email", "First Name", "Last Name", "Student ID", "Major", "Graduation Date"];

const dryRunResult = {
  total: 418,
  valid: 409,
  errors: 9,
  warnings: 14,
  toCreate: 380,
  newRecords: 380,
  matchedExisting: 29,
  matchedToStudents: 0,
  waitingForSignIn: 352,
  alreadyImported: 0,
  issues: [
    { line: 14, field: "email", message: "Not a valid email address.", severity: "error" as const },
    { line: 57, field: "graduationDate", message: "Date couldn't be read; left blank.", severity: "warning" as const },
    { line: 203, field: null, message: "Duplicate of line 198.", severity: "error" as const },
  ],
  issuesTruncated: false,
  matches: [
    { line: 2, email: AISHA.email, name: AISHA.name, studentNumber: AISHA.studentNumber, role: "Student", linked: true, outcome: "Matched" },
    { line: 9, email: "sam.nguyen@lakeside.edu", name: "Sam Nguyen", studentNumber: null, role: "Student", linked: false, outcome: "Matched" },
  ],
};

const commitResult = { created: 1204, matched: 31, waitingForSignIn: 980, failed: 0, alreadyImported: 0, skippedWithErrors: 6, issues: [{ line: 88, field: "email", message: "Not a valid email address.", severity: "error" as const }], label: "Imported from Handshake" };

const IMPORT_BATCHES = [
  {
    id: "imp-validated",
    source: "Handshake",
    entityKind: "Students",
    fileName: "handshake_students_fall.csv",
    rowCount: 418,
    status: "Validated",
    createdAt: hours(-3),
    committedAt: null,
    undoneAt: null,
    label: null,
    headers: STUDENT_HEADERS,
    mapping: { email: "Email", firstName: "First Name", lastName: "Last Name", studentNumber: "Student ID", major: "Major" },
    detection: [
      { source: "Handshake", entityKind: "Students", score: 0.92, matched: 5, total: 6 },
      { source: "Symplicity", entityKind: "Students", score: 0.4, matched: 2, total: 6 },
    ],
    dryRun: dryRunResult,
    result: null,
    presetNotice: importPresets.notice,
  },
  {
    id: "imp-committed",
    source: "Handshake",
    entityKind: "Students",
    fileName: "handshake_students_2025.csv",
    rowCount: 1241,
    status: "Committed",
    createdAt: days(-14),
    committedAt: days(-14),
    undoneAt: null,
    label: "Imported from Handshake",
    headers: STUDENT_HEADERS,
    mapping: { email: "Email", firstName: "First Name", lastName: "Last Name", studentNumber: "Student ID" },
    detection: null,
    dryRun: null,
    result: commitResult,
    presetNotice: importPresets.notice,
  },
  {
    id: "imp-undone",
    source: "Symplicity",
    entityKind: "Appointments",
    fileName: "csm_appointments.csv",
    rowCount: 3310,
    status: "Undone",
    createdAt: days(-30),
    committedAt: days(-30),
    undoneAt: days(-29),
    label: "Imported from Symplicity",
    headers: ["Student Email", "Appt Date", "Appt Type", "Notes"],
    mapping: null,
    detection: null,
    dryRun: null,
    result: null,
    presetNotice: importPresets.notice,
  },
  {
    id: "imp-failed",
    source: "12twenty",
    entityKind: "Experiences",
    fileName: "12twenty_internships.csv",
    rowCount: 96,
    status: "Failed",
    createdAt: days(-45),
    committedAt: null,
    undoneAt: null,
    label: null,
    headers: ["Email", "Employer"],
    mapping: null,
    detection: null,
    dryRun: null,
    result: null,
    presetNotice: importPresets.notice,
  },
];

const importHistory = [
  { batch: IMPORT_BATCHES[0], records: {} },
  { batch: IMPORT_BATCHES[1], records: { Students: 1204, Pending: 980 } },
  { batch: IMPORT_BATCHES[2], records: {} },
  { batch: IMPORT_BATCHES[3], records: { Experiences: 12 } },
];

const batchView = (id: string) => {
  const batch = IMPORT_BATCHES.find((b) => b.id === id) ?? IMPORT_BATCHES[0];
  return {
    batch,
    sample: [
      [AISHA.email, "Aisha", "Thompson", AISHA.studentNumber, "Computer Science", "2027-05-15"],
      [DIEGO.email, "Diego", "Martinez", DIEGO.studentNumber, "Marketing", "2027-12-18"],
    ],
  };
};

// ---------------------------------------------------------------- fixtures

const raw: ApiFixture[] = [
  // Home and shared admin endpoints
  { path: "/api/career/admin/settings", body: adminSettings },
  { path: "/api/career/admin/members", body: membersBody },
  { path: "/api/career/admin/employers", body: (ctx: FixtureContext) => EMPLOYER_REQUESTS.filter((r) => !ctx.url.searchParams.get("status") || r.status === ctx.url.searchParams.get("status")) },

  // Appointments
  { path: "/api/career/appointments/types", body: { timeZone: TZ, types: APPT_TYPES } },
  { path: "/api/career/appointments/counselors", body: COUNSELORS },
  { path: "/api/career/appointments/counselors/me", body: counselorProfile },
  { method: "PUT", path: /^\/api\/career\/appointments\/counselors\/[^/]+$/, body: counselorProfile },
  { method: "POST", path: "/api/career/appointments/counselors/me/calendar-token/rotate", body: { ...counselorProfile, calendarFeedPath: "/api/career/appointments/feed/1b9e44a0.ics" } },
  { method: "*", path: /^\/api\/career\/appointments\/counselors\/[^/]+\/(availability|exceptions)(\/[^/]+)?$/, body: availability },
  { path: "/api/career/appointments/schedule", body: (ctx: FixtureContext) => ({ timeZone: TZ, items: APPOINTMENTS.filter((a) => ctx.url.searchParams.get("includeCancelled") === "true" || a.status !== "Cancelled"), groupSessions: scheduleGroupSessions }) },
  { path: "/api/career/appointments/slots", body: slotsBody },
  { method: "POST", path: "/api/career/appointments/book", body: APPOINTMENTS[1] },
  { path: "/api/career/appointments/dropin/sessions", body: DROPIN_SESSIONS },
  { method: "POST", path: "/api/career/appointments/dropin/sessions", body: DROPIN_SESSIONS[0] },
  { path: /^\/api\/career\/appointments\/dropin\/sessions\/[^/]+\/queue$/, body: dropinQueue },
  { method: "POST", path: /^\/api\/career\/appointments\/dropin\/sessions\/[^/]+\/call-next$/, body: { called: { queueNumber: 6, student: { name: DIEGO.name } } } },
  { method: "POST", path: /^\/api\/career\/appointments\/dropin\/sessions\/[^/]+\/add$/, body: { queueNumber: 8 } },
  { path: "/api/career/appointments/kiosk", body: { kioskPath: "/kiosk/lakeside-7c1f0e", kioskTokenRotatedAt: days(-30) } },
  { method: "POST", path: "/api/career/appointments/kiosk/rotate", body: { kioskPath: "/kiosk/lakeside-a93d22", kioskTokenRotatedAt: hours(0) } },
  { path: "/api/career/appointments/reports", body: appointmentsReport },
  { path: "/api/career/appointments/reports.csv", contentType: "text/csv", body: "key,total,attended,noShow\nResume review,121,99,7\n" },
  { path: /^\/api\/career\/appointments\/[^/]+\/ics$/, contentType: "text/calendar", body: "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n" },
  { path: /^\/api\/career\/appointments\/[^/]+$/, body: appointmentDetail },

  // Calendar sync
  { path: "/api/career/calendar/status", body: calendarStatus },
  { path: "/api/career/calendar/busy", body: { busy: [{ startUtc: hours(20), endUtc: hours(21) }, { startUtc: hours(44), endUtc: hours(46) }] } },
  { method: "POST", path: "/api/career/calendar/sync-now", body: { created: 2, updated: 1, deleted: 0, failed: 0 } },
  { method: "POST", path: "/api/career/calendar/connect", body: { authorizeUrl: "about:blank" } },

  // Caseload
  { path: "/api/career/triage/settings", body: triageSettings },
  { method: "PUT", path: "/api/career/triage/settings", body: (ctx: FixtureContext) => ({ ...triageSettings, ...(ctx.postData ? (JSON.parse(ctx.postData) as object) : {}), updatedAt: hours(0) }) },
  { path: "/api/career/triage/counselors", body: [ME, PRIYA, MARCUS].map((c) => ({ userId: c.userId, name: c.name })) },
  { path: "/api/career/triage/caseload", body: caseloadBody },
  { path: "/api/career/triage/rules", body: caseloadRules },
  { path: "/api/career/triage/copilot/log", body: copilotLog },
  {
    method: "POST",
    path: "/api/career/triage/copilot/brief",
    body: { generationId: "gen-1", text: "Aisha Thompson, Computer Science, graduating in May.\n- Internship at Prairie Health starts in 6 days; agreement not signed.\n- Last appointment 8 months ago.\nSuggested focus: agreement next steps and full-time search timeline.", label: "AI-drafted: check before using", simulated: false, includesStaffOnlyNotes: false, injectionSuspected: false },
  },
  {
    method: "POST",
    path: "/api/career/triage/copilot/outreach",
    body: { generationId: "gen-2", subject: "Quick check-in before your internship", body: "Hi Aisha,\n\nYour internship at Prairie Health starts next week. Your learning agreement still needs your supervisor's signature. Can we meet this week?\n\nJordan", label: "AI-drafted: edit before sending", simulated: false, injectionSuspected: false },
  },
  { path: /^\/api\/career\/triage\/students\/[^/]+$/, body: studentPanel },

  // Employer challenges
  { path: "/api/career/challenges/staff", body: (ctx: FixtureContext) => CHALLENGES.filter((c) => !ctx.url.searchParams.get("status") || c.status === ctx.url.searchParams.get("status")) },
  { path: "/api/career/challenges/staff/settings", body: { autoApproveVerified: true } },
  { method: "PUT", path: "/api/career/challenges/staff/settings", body: (ctx: FixtureContext) => (ctx.postData ? JSON.parse(ctx.postData) : { autoApproveVerified: false }) },
  { path: "/api/career/challenges/staff/export.csv", contentType: "text/csv", body: "challenge,employer,joined\nWarehouse robot path planning,Lakeshore Robotics,34\n" },
  { path: /^\/api\/career\/challenges\/staff\/[^/]+\/stats$/, body: { joined: 34, withdrawn: 3, submitted: 21, defended: 12, consentActive: 18, invited: 5 } },

  // Document review
  { path: "/api/career/doc-review/options", body: docReviewOptions },
  { path: "/api/career/doc-review/staff/reviewers", body: reviewers },
  { path: "/api/career/doc-review/staff/queue", body: docQueue },
  { path: "/api/career/doc-review/staff/metrics", body: docMetrics },
  { path: "/api/career/doc-review/staff/metrics.csv", contentType: "text/csv", body: "reviewer,returned\nJordan Lee,96\n" },
  { method: "*", path: "/api/career/doc-review/staff/settings", body: docSettings },
  { path: /^\/api\/career\/doc-review\/files\/[^/]+$/, contentType: "application/pdf", body: "%PDF-1.4\n%a11y fixture\n" },
  { method: "*", path: /^\/api\/career\/doc-review\/staff\/requests\/[^/]+(\/.*)?$/, body: docReviewDetail },

  // Internships for credit
  { path: "/api/career/experiences/staff/dashboard", body: experienceDashboard },
  { path: "/api/career/experiences/staff/export.csv", contentType: "text/csv", body: "student,employer,status\nDiego Martinez,Lakeshore Robotics,Submitted\n" },
  { path: "/api/career/experiences/staff/experiences", body: (ctx: FixtureContext) => EXPERIENCES.filter((x) => !ctx.url.searchParams.get("status") || x.status === ctx.url.searchParams.get("status")) },
  { path: "/api/career/experiences/staff/programs", body: PROGRAMS },
  { method: "POST", path: "/api/career/experiences/staff/programs", body: PROGRAMS[0] },
  { method: "PUT", path: /^\/api\/career\/experiences\/staff\/programs\/[^/]+$/, body: PROGRAMS[0] },
  { path: "/api/career/experiences/staff/faculty", body: facultyChoices },
  { path: /^\/api\/career\/experiences\/staff\/experiences\/[^/]+$/, body: (ctx: FixtureContext) => experienceDetail(lastSegment(ctx)) },
  { method: "*", path: /^\/api\/career\/experiences\/staff\/experiences\/[^/]+\/(approve|decline|cpt|comments|start-evaluations)$/, body: (ctx: FixtureContext) => experienceDetail(lastSegment(ctx, 1)) },
  { path: /^\/api\/career\/experiences\/documents\/[^/]+$/, contentType: "application/pdf", body: "%PDF-1.4\n%a11y fixture\n" },
  { method: "POST", path: /^\/api\/career\/internship-defense\/staff\/[^/]+\/supervisor-link$/, body: { sentTo: "kosei@northwind.example" } },
  { method: "*", path: /^\/api\/career\/internship-defense\/staff\/[^/]+(\/override)?$/, body: defenseState },

  // Outcome frameworks
  { path: "/api/career/frameworks", body: frameworkCatalog },
  { path: "/api/career/frameworks/reference-options", body: referenceOptions },
  { method: "*", path: /^\/api\/career\/frameworks\/[^/]+\/mappings$/, body: mappingsBody },
  { path: /^\/api\/career\/frameworks\/[^/]+\/attainment$/, body: attainmentBody },
  { path: /^\/api\/career\/frameworks\/[^/]+\/attainment\.csv$/, contentType: "text/csv", body: "outcome,attainment\nCT,2.71\n" },
  { path: /^\/api\/career\/frameworks\/[^/]+\/report\.html$/, contentType: "text/html", body: "<!doctype html><title>Attainment report</title><h1>Attainment report</h1>" },

  // Imports
  { path: "/api/career/imports/presets", body: importPresets },
  { path: "/api/career/imports/connectors", body: connectorsBody },
  { method: "PUT", path: /^\/api\/career\/imports\/connectors\/[^/]+$/, body: connectorsBody.platforms[0] },
  { method: "DELETE", path: /^\/api\/career\/imports\/connectors\/[^/]+$/, body: {} },
  { method: "POST", path: /^\/api\/career\/imports\/connectors\/[^/]+\/pull$/, body: batchView("imp-validated") },
  { path: "/api/career/imports/placement-facts", body: [] },
  { path: "/api/career/imports", body: importHistory },
  { method: "POST", path: "/api/career/imports/upload", body: batchView("imp-validated") },
  { method: "POST", path: "/api/career/imports/apply-pending", body: { created: 2 } },
  { method: "PUT", path: /^\/api\/career\/imports\/[^/]+\/mapping$/, body: (ctx: FixtureContext) => batchView(lastSegment(ctx, 1)) },
  { method: "POST", path: /^\/api\/career\/imports\/[^/]+\/dry-run$/, body: dryRunResult },
  { method: "POST", path: /^\/api\/career\/imports\/[^/]+\/commit$/, body: commitResult },
  { method: "POST", path: /^\/api\/career\/imports\/[^/]+\/undo$/, body: { removed: { Students: 1204 }, pendingCancelled: 980 } },
  { path: /^\/api\/career\/imports\/[^/]+\/report\.csv$/, contentType: "text/csv", body: "line,type,field,problem\n14,error,email,Not a valid email address.\n" },
  { path: /^\/api\/career\/imports\/[^/]+$/, body: (ctx: FixtureContext) => batchView(lastSegment(ctx)) },
];

/** Only answer for the career-center persona, so other personas' fixtures for the same paths win for them. */
export const careerCenterAFixtures: ApiFixture[] = raw.map((f) => {
  const when = f.when;
  return { ...f, when: (ctx: FixtureContext) => ctx.persona === "career-center" && (when ? when(ctx) : true) };
});

const route = (name: string, path: string): A11yRoute => ({ name, path, persona: "career-center" });

export const careerCenterARoutes: A11yRoute[] = [
  route("cc-home", "/career-center"),
  route("cc-appointments", "/career-center/appointments"),
  route("cc-appointments-dropin", "/career-center/appointments?tab=dropin"),
  route("cc-appointments-availability", "/career-center/appointments?tab=availability"),
  route("cc-appointments-types", "/career-center/appointments?tab=types"),
  route("cc-appointments-reports", "/career-center/appointments?tab=reports"),
  route("cc-appointment-detail", "/career-center/appointments?id=appt-1"),
  route("cc-calendar", "/career-center/calendar"),
  route("cc-caseload", "/career-center/caseload"),
  route("cc-caseload-rules", "/career-center/caseload/rules"),
  route("cc-caseload-settings", "/career-center/caseload/settings"),
  route("cc-challenges", "/career-center/challenges"),
  route("cc-document-review", "/career-center/document-review"),
  route("cc-document-review-workspace", "/career-center/document-review?id=dr-2"),
  route("cc-employers", "/career-center/employers"),
  route("cc-experiences", "/career-center/experiences"),
  route("cc-experience-detail", "/career-center/experiences/exp-eval"),
  route("cc-experience-detail-submitted", "/career-center/experiences/exp-submitted"),
  route("cc-frameworks", "/career-center/frameworks"),
  route("cc-imports", "/career-center/imports"),
];
