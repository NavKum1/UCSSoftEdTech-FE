import type { ApiFixture, A11yRoute, FixtureContext } from "./types";
import { EMPLOYER_ID, INSTITUTE_ID, SCHOOL_NAME, USER_ID, days, hours } from "./types";
import type { Appointment, ApptType, Note, SlotResponse, Task } from "@/components/career/appointments/shared";
import type { ExperienceDetail, ExperienceSummary, Program } from "@/components/career/experiences/shared";
import type { DefenseState } from "@/components/career/experiences/InternshipDefense";
import type { ReviewDetail, ReviewOptions } from "@/components/career/docReview/shared";
import type { OptView } from "@/components/career/international/shared";
import type { SponsorSummary } from "@/components/career/international/SponsorLookup";
import type { OcrSchedule } from "@/components/career/interviews/shared";
import type { MentoringOptions, PairDetail, RelationshipSummary } from "@/components/career/mentoring/MentorshipPanel";
import type { ThreadRow } from "@/components/career/messaging/shared";
import type { Placement } from "@/components/career/outcomesLabels";

/* ------------------------------------------------------------------ helpers */

/** yyyy-mm-dd, n days from today */
const ymd = (n: number) => days(n).slice(0, 10);

/** An ISO instant on day `dayOffset` at a whole UTC hour (appointment and interview slots). */
function at(dayOffset: number, hourUtc: number, minute = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hourUtc, minute, 0, 0);
  return d.toISOString();
}

const TZ = "America/Chicago";
/** School-local wall time (CDT, UTC-5) for slot/appointment `localStart` */
const local = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().slice(0, 19);
const plusMinutes = (iso: string, m: number) => new Date(new Date(iso).getTime() + m * 60_000).toISOString();

/** The last path segment captured by a RegExp, e.g. the id in /things/{id}. */
const segment = (ctx: FixtureContext, re: RegExp, fallback: string) => re.exec(ctx.url.pathname)?.[1] ?? fallback;

const STUDENT_NAME = "Jordan Lee";
const STUDENT_EMAIL = "jordan.lee@lakeside.edu";

/* ------------------------------------------------------------------ record, privacy */

const studentRecord = {
  school: { instituteId: INSTITUTE_ID, displayName: SCHOOL_NAME, slug: "lakeside" },
  role: "Student",
  ferpaHold: false,
  profile: {
    preferredName: "Jordan",
    pronouns: "they/them",
    phone: "(614) 555-0142",
    workAuthorization: "F1",
    requiresSponsorshipNow: false,
    requiresSponsorshipFuture: true,
  },
  education: [
    {
      id: "edu-1",
      schoolName: SCHOOL_NAME,
      degreeLevel: "Bachelor",
      majors: ["Computer Science"],
      minors: ["Statistics"],
      college: "College of Engineering",
      startDate: "2023-08-21",
      graduationDate: "2027-05-15",
      isPrimary: true,
      verifiedBySchool: true,
    },
    {
      id: "edu-2",
      schoolName: "Columbus State Community College",
      degreeLevel: "Associate",
      majors: ["Mathematics"],
      minors: [],
      college: null,
      startDate: "2021-08-23",
      graduationDate: "2023-05-06",
      isPrimary: false,
      verifiedBySchool: false,
    },
  ],
  workAuthorizationOptions: ["USCitizen", "PermanentResident", "AsyleeRefugee", "F1", "J1", "H4EAD", "OtherVisa", "PreferNotToSay"],
  degreeLevels: ["Certificate", "Associate", "Bachelor", "Master", "Doctorate", "Professional"],
};

const consents = [
  {
    id: "con-1",
    recipientType: "Employer",
    recipientName: "Northwind Analytics",
    categories: ["Profile", "Education", "Resume"],
    purpose: "On-campus interview: Software Engineering Intern",
    source: "ocr.signup",
    grantedAt: days(-21),
    expiresAt: days(160),
    revokedAt: null,
    active: true,
  },
  {
    id: "con-2",
    recipientType: "Mentor",
    recipientName: "Marcus Johnson",
    categories: ["Profile", "ContactInfo"],
    purpose: "Mentoring match",
    source: "mentoring.request",
    grantedAt: days(-60),
    expiresAt: null,
    revokedAt: null,
    active: true,
  },
  {
    id: "con-3",
    recipientType: "Employer",
    recipientName: "Contoso Health",
    categories: ["Assessments", "EvidencePack"],
    purpose: "Employer challenge: Patient data pipeline",
    source: "challenge.join",
    grantedAt: days(-120),
    expiresAt: null,
    revokedAt: days(-90),
    active: false,
  },
  {
    id: "con-4",
    recipientType: "Employer",
    recipientName: "Fabrikam Logistics",
    categories: null,
    purpose: "",
    source: null,
    grantedAt: days(-400),
    expiresAt: days(-35),
    revokedAt: null,
    active: false,
  },
];

const disclosures = [
  {
    id: "dis-1",
    recipientType: "Employer",
    recipientName: "Northwind Analytics",
    categories: ["Profile", "Education", "Resume"],
    purpose: "Interview schedule resume book",
    legalBasis: "Consent",
    occurredAt: days(-14),
  },
  {
    id: "dis-2",
    recipientType: "Employer",
    recipientName: "Tailspin Robotics",
    categories: ["Profile", "Education"],
    purpose: "Career fair attendee list",
    legalBasis: "DirectoryInformation",
    occurredAt: days(-48),
  },
];

/* ------------------------------------------------------------------ appointments */

const intakeQuestions = [
  { id: "q-goal", label: "What would you like to focus on?", required: true, kind: "textarea" as const, options: null },
  { id: "q-year", label: "Class year", required: false, kind: "choice" as const, options: ["First year", "Sophomore", "Junior", "Senior", "Graduate"] },
];

const apptTypes: ApptType[] = [
  {
    id: "type-resume",
    name: "Resume review",
    description: "Go through your resume with a counselor and leave with a clear list of edits.",
    durationMinutes: 30,
    modes: ["Video", "InPerson"],
    allowStudents: true,
    allowAlumni: true,
    minLeadMinutes: 120,
    maxLeadDays: 30,
    bufferMinutes: 10,
    cancelCutoffMinutes: 240,
    intakeQuestions,
    active: true,
    sortOrder: 1,
  },
  {
    id: "type-explore",
    name: "Career exploration",
    description: "Not sure where to start? Talk through majors, industries and next steps.",
    durationMinutes: 45,
    modes: ["InPerson", "Phone"],
    allowStudents: true,
    allowAlumni: false,
    minLeadMinutes: 30,
    maxLeadDays: 21,
    bufferMinutes: 15,
    cancelCutoffMinutes: 60,
    intakeQuestions: [],
    active: true,
    sortOrder: 2,
  },
];

const counselors = [
  { userId: "cou-1", name: "Priya Patel", title: "Senior Career Counselor", bio: "Supports engineering and computing students." },
  { userId: "cou-2", name: "Daniel Okafor", title: "Career Counselor", bio: null },
];

function appointment(over: Partial<Appointment> & Pick<Appointment, "id" | "startUtc">): Appointment {
  const end = plusMinutes(over.startUtc, 30);
  return {
    typeId: "type-resume",
    typeName: "Resume review",
    endUtc: end,
    localStart: local(over.startUtc),
    timeZone: TZ,
    mode: "Video",
    location: null,
    meetingUrl: "https://meet.lakeside.example/r/priya-patel",
    status: "Booked",
    outcome: null,
    counselor: { userId: "cou-1", name: "Priya Patel" },
    student: { userId: USER_ID, name: STUDENT_NAME, email: STUDENT_EMAIL, studentNumber: "A00412345" },
    intakeAnswers: { "q-goal": "Tailor my resume for data engineering internships." },
    intakeQuestions,
    cancelCutoffUtc: plusMinutes(over.startUtc, -240),
    canChange: true,
    cancelReason: null,
    cancelledAt: null,
    bookedOnBehalf: false,
    rescheduleCount: 0,
    createdAt: days(-5),
    ...over,
  };
}

const myAppointments = () => ({
  timeZone: TZ,
  upcoming: [
    appointment({ id: "appt-1", startUtc: at(2, 15) }),
    appointment({
      id: "appt-2",
      startUtc: at(0, 23),
      typeId: "type-explore",
      typeName: "Career exploration",
      endUtc: plusMinutes(at(0, 23), 45),
      mode: "InPerson",
      location: "Career Center, Hale Hall 210",
      meetingUrl: null,
      counselor: { userId: "cou-2", name: "Daniel Okafor" },
      intakeAnswers: {},
      canChange: false,
    }),
  ],
  past: [
    appointment({ id: "appt-3", startUtc: at(-14, 16), outcome: "Attended", canChange: false }),
    appointment({
      id: "appt-4",
      startUtc: at(-30, 19),
      status: "Cancelled",
      canChange: false,
      cancelReason: "Exam was moved to the same time.",
      cancelledAt: days(-31),
      mode: "Phone",
      meetingUrl: null,
    }),
  ],
});

const slotResponse = (): SlotResponse => {
  const slots = [
    [1, 14],
    [1, 15],
    [1, 19],
    [2, 14],
    [2, 16],
    [4, 15],
  ].map(([d, h]) => {
    const start = at(d, h);
    return { startUtc: start, endUtc: plusMinutes(start, 30), localStart: local(start), counselorUserIds: h % 2 === 0 ? ["cou-1"] : ["cou-1", "cou-2"] };
  });
  return { timeZone: TZ, slots };
};

const apptNotes: Note[] = [
  {
    id: "note-1",
    appointmentId: "appt-3",
    visibility: "Shared",
    body: "Great progress. Move the capstone project above coursework and quantify the results (for example, query time cut by 40%).",
    createdAt: days(-14),
    updatedAt: days(-14),
    author: "Priya Patel",
    canEdit: false,
  },
  {
    id: "note-2",
    appointmentId: null,
    visibility: "Shared",
    body: "Links from today: the internship search checklist and the STEM OPT overview session recording.",
    createdAt: days(-40),
    updatedAt: days(-40),
    author: "Daniel Okafor",
    canEdit: false,
  },
];

const apptTasks: Task[] = [
  { id: "task-1", appointmentId: "appt-3", title: "Send updated resume to Priya", details: "Upload the PDF in Document review.", dueDate: ymd(3), status: "Open", assigneeType: "Student", completedAt: null, mine: true },
  { id: "task-2", appointmentId: "appt-3", title: "Apply to two data engineering internships", details: null, dueDate: ymd(10), status: "Done", assigneeType: "Student", completedAt: days(-2), mine: true },
  { id: "task-3", appointmentId: "appt-3", title: "Introduce Jordan to an alum at Northwind Analytics", details: null, dueDate: null, status: "Open", assigneeType: "Counselor", completedAt: null, mine: false },
];

const dropIn = [
  {
    id: "drop-1",
    name: "Quick questions drop-in",
    location: "Career Center front desk, Hale Hall",
    waiting: 3,
    estimatedWaitMinutes: 20,
    myEntry: null,
  },
  {
    id: "drop-2",
    name: "Virtual resume drop-in",
    location: null,
    waiting: 5,
    estimatedWaitMinutes: 35,
    myEntry: { id: "entry-9", queueNumber: 7, status: "Waiting", topic: "Cover letter for a research lab", ahead: 2, estimatedWaitMinutes: 15, checkedInAt: hours(-0.2) },
  },
];

/* ------------------------------------------------------------------ experiences (internships for credit) */

const programs: Program[] = [
  {
    id: "prog-1",
    code: "CSE 3999",
    title: "Computing Internship for Credit",
    description: "Earn credit for a computing internship of at least 120 hours.",
    creditHours: 3,
    requiredHours: 120,
    requiredDocuments: ["Offer letter", "Final report"],
    midtermForm: [
      { key: "skills", text: "Technical skills", type: "rating" },
      { key: "comments", text: "Comments on progress", type: "text" },
    ],
    finalForm: [
      { key: "overall", text: "Overall performance", type: "rating" },
      { key: "communication", text: "Communication", type: "rating" },
      { key: "summary", text: "Summary", type: "text" },
    ],
    ratingScaleMax: 5,
    reflectionPrompts: ["What did you learn about working on a professional team?", "Which course concepts did you apply, and how?"],
    facultyApprovers: ["Dr. Elena Ruiz"],
    requireCpt: true,
    agreementTerms: null,
    active: true,
  },
  {
    id: "prog-2",
    code: "BUS 4890",
    title: "Business Analytics Practicum",
    description: null,
    creditHours: 2,
    requiredHours: 90,
    requiredDocuments: [],
    midtermForm: [],
    finalForm: [{ key: "overall", text: "Overall performance", type: "rating" }],
    ratingScaleMax: 4,
    reflectionPrompts: ["Describe one decision your analysis informed."],
    facultyApprovers: [],
    requireCpt: false,
    agreementTerms: null,
    active: true,
  },
];

const experiencePrograms = { programs, isF1: true, cptStatuses: ["NotStarted", "Requested", "Approved"] };

const experienceSummaries: ExperienceSummary[] = [
  {
    id: "exp-1",
    status: "Evaluations",
    studentName: STUDENT_NAME,
    studentEmail: STUDENT_EMAIL,
    program: { id: "prog-1", code: "CSE 3999", title: "Computing Internship for Credit" },
    employerName: "Northwind Analytics",
    roleTitle: "Software Engineering Intern",
    startDate: ymd(-90),
    endDate: ymd(5),
    isF1: true,
    cptStatus: "Approved",
    facultyApproved: true,
    agreementSigned: true,
    finalGrade: null,
    submittedAt: days(-120),
    updatedAt: days(-1),
  },
  {
    id: "exp-2",
    status: "Active",
    studentName: STUDENT_NAME,
    studentEmail: STUDENT_EMAIL,
    program: { id: "prog-2", code: "BUS 4890", title: "Business Analytics Practicum" },
    employerName: "Contoso Health",
    roleTitle: "Data Analyst Intern",
    startDate: ymd(-30),
    endDate: ymd(60),
    isF1: true,
    cptStatus: "Approved",
    facultyApproved: true,
    agreementSigned: true,
    finalGrade: null,
    submittedAt: days(-50),
    updatedAt: days(-3),
  },
  {
    id: "exp-3",
    status: "Completed",
    studentName: STUDENT_NAME,
    studentEmail: STUDENT_EMAIL,
    program: { id: "prog-1", code: "CSE 3999", title: "Computing Internship for Credit" },
    employerName: "Tailspin Robotics",
    roleTitle: "Embedded Software Intern",
    startDate: ymd(-400),
    endDate: ymd(-300),
    isF1: true,
    cptStatus: "Approved",
    facultyApproved: true,
    agreementSigned: true,
    finalGrade: "A",
    submittedAt: days(-430),
    updatedAt: days(-290),
  },
  {
    id: "exp-4",
    status: "Draft",
    studentName: STUDENT_NAME,
    studentEmail: STUDENT_EMAIL,
    program: null,
    employerName: "Fabrikam Logistics",
    roleTitle: "Operations Research Intern",
    startDate: ymd(120),
    endDate: ymd(200),
    isF1: true,
    cptStatus: null,
    facultyApproved: false,
    agreementSigned: false,
    finalGrade: null,
    submittedAt: null,
    updatedAt: days(-2),
  },
];

function experienceDetail(id: string): ExperienceDetail {
  return {
    id,
    status: "Evaluations",
    student: { userId: USER_ID, name: STUDENT_NAME, email: STUDENT_EMAIL },
    program: programs[0],
    employer: { id: EMPLOYER_ID, name: "Northwind Analytics", website: "https://northwind.example" },
    supervisor: { name: "Marcus Johnson", email: "marcus.johnson@northwind.example", title: "Engineering Manager", confirmedAt: days(-118) },
    roleTitle: "Software Engineering Intern",
    startDate: ymd(-90),
    endDate: ymd(5),
    hoursPerWeek: 20,
    paid: true,
    location: "Columbus, OH",
    remote: false,
    learningObjectives: [
      "Ship a production feature through code review and CI.",
      "Write automated tests for a data ingestion service.",
      "Present a technical design to the team.",
    ],
    cpt: { required: true, isF1: true, status: "Approved", dsoApprovalDate: ymd(-100), startDate: ymd(-90), endDate: ymd(5), missing: false },
    approvals: { facultyApprovedAt: days(-112), staffApprovedAt: days(-105), declineReason: null },
    agreement: {
      id: "agr-2",
      version: 2,
      text:
        "LEARNING AGREEMENT\n\nStudent: Jordan Lee\nOrganization: Northwind Analytics\nRole: Software Engineering Intern\n\n1. The student will work about 20 hours per week.\n2. The site supervisor will complete a midterm and a final evaluation.\n3. The faculty sponsor assigns the final grade.",
      sha256: "9f2c4b7e1a0d3c6f8e5b2a9d7c4f1e0b3a6d9c2f5e8b1a4d7c0f3e6b9a2d5c8f",
      createdAt: days(-110),
      completedAt: days(-104),
      signatures: [
        { role: "Student", name: STUDENT_NAME, email: STUDENT_EMAIL, signedAt: days(-109), typedName: "Jordan Lee", textSha256: "9f2c", ip: null, userAgent: null, provider: "click-to-sign" },
        { role: "Supervisor", name: "Marcus Johnson", email: "marcus.johnson@northwind.example", signedAt: days(-107), typedName: "Marcus Johnson", textSha256: "9f2c", ip: null, userAgent: null, provider: "click-to-sign" },
        { role: "Faculty", name: "Dr. Elena Ruiz", email: "elena.ruiz@lakeside.edu", signedAt: days(-104), typedName: "Elena Ruiz", textSha256: "9f2c", ip: null, userAgent: null, provider: "click-to-sign" },
      ],
      canSign: false,
      pendingRoles: [],
    },
    agreementHistory: [
      {
        version: 1,
        sha256: "1a2b3c",
        createdAt: days(-115),
        voidedAt: days(-110),
        voidReason: "Hours per week changed",
        signatures: [{ role: "Student", name: STUDENT_NAME, signedAt: days(-114), voidedAt: days(-110) }],
      },
    ],
    hours: [
      { id: "h-1", weekStart: ymd(-21), hours: 20, description: "Built the CSV import validator", status: "Approved", decisionNote: null, submittedAt: days(-14) },
      { id: "h-2", weekStart: ymd(-14), hours: 22, description: "Load testing and bug fixes", status: "Rejected", decisionNote: "Please split the overtime into its own week.", submittedAt: days(-7) },
      { id: "h-3", weekStart: ymd(-7), hours: 18, description: null, status: "Pending", decisionNote: null, submittedAt: days(-1) },
    ],
    hoursSummary: { approved: 96, pending: 18, required: 120 },
    reflections: [
      {
        id: "ref-1",
        prompt: "What did you learn about working on a professional team?",
        body: "Code review felt slow at first, but it caught two bugs that would have reached hospitals' data feeds.",
        facultyComment: "Good example. Say more about how you responded to feedback.",
        updatedAt: days(-10),
      },
    ],
    evaluations: [
      {
        id: "ev-1",
        kind: "Midterm",
        submittedAt: days(-45),
        submittedByName: "Marcus Johnson",
        ratingScaleMax: 5,
        comments: "Jordan ramps up quickly and asks good questions.",
        questions: programs[0].midtermForm,
        answers: { skills: 4, comments: "Strong progress on the ingestion service." },
      },
    ],
    documents: [
      { id: "doc-1", kind: "Offer letter", fileName: "northwind-offer-letter.pdf", uploadedAt: days(-121) },
    ],
    missingDocuments: ["Final report"],
    grade: { finalGrade: null, gradeComment: null, gradedAt: null },
    timeline: [
      { actorName: STUDENT_NAME, actorRole: "Student", action: "submitted", comment: null, at: days(-120) },
      { actorName: "Dr. Elena Ruiz", actorRole: "Faculty", action: "faculty.approved", comment: "Looks like a solid placement.", at: days(-112) },
      { actorName: "Priya Patel", actorRole: "Staff", action: "approved", comment: null, at: days(-105) },
      { actorName: "System", actorRole: "System", action: "evaluations.opened", comment: null, at: days(-2) },
    ],
    supervisorLinks: null,
    canEdit: true,
  };
}

/* ------------------------------------------------------------------ internship defense */

const defenseBase = (id: string): Omit<DefenseState, "defense" | "credential" | "verification" | "eligibility"> => {
  const s = experienceSummaries.find((x) => x.id === id) ?? experienceSummaries[0];
  return {
    experience: {
      id: s.id,
      status: s.status,
      roleTitle: s.roleTitle,
      employerName: s.employerName,
      supervisorName: "Marcus Johnson",
      studentName: STUDENT_NAME,
      startDate: s.startDate,
      endDate: s.endDate,
    },
    options: {
      writtenAvailable: true,
      voiceAvailable: false,
      consentText: "I agree that my answers, and an automated score based on them, are shared with my faculty sponsor, the career center and my site supervisor.",
      threshold: 70,
      canOverride: false,
    },
    voice: null,
    devToken: null,
  };
};

const defenseArtifacts = [
  {
    kind: "repo",
    title: "CSV import validator",
    url: "https://github.example/northwind/import-validator",
    description: "A validation step that rejects malformed hospital census files before they are loaded. I designed the rule format and wrote most of the tests.",
  },
  {
    kind: "description",
    title: "Load-testing report",
    url: null,
    description: "I load-tested the ingestion API with synthetic data and wrote up the bottlenecks I found, which led to a batching change.",
  },
];

const defenseTurns = [
  { role: "interviewer" as const, text: "Tell me about the CSV import validator. What part of it was yours?", at: days(-6) },
  { role: "student" as const, text: "I wrote the rule engine and the test suite. My manager reviewed the design before I started.", at: days(-6) },
  { role: "interviewer" as const, text: "What trade-off did you make in the rule format?", at: days(-6) },
  { role: "student" as const, text: "I chose a declarative YAML format so analysts could add rules without code, at the cost of some flexibility.", at: days(-6) },
];

function defenseState(id: string, phase?: "start" | "decided"): DefenseState {
  const base = defenseBase(id);
  const which = phase ?? (id === "exp-2" ? "none" : id === "exp-3" ? "start" : "decided");
  if (which === "none") {
    return {
      ...base,
      verification: { status: "None", label: "Not started" },
      eligibility: { canStart: true, reason: null },
      defense: null,
      credential: null,
    };
  }
  const common = {
    id: `def-${id}`,
    mode: "Written" as const,
    artifacts: defenseArtifacts,
    startedAt: days(-6),
    maxQuestions: 5,
    simulated: false,
    supervisorLinks: null,
    overrideInfo: null,
    consent: { consentedAt: days(-6), text: base.options.consentText, active: true },
  };
  if (which === "start") {
    return {
      ...base,
      verification: { status: "Pending", label: "Pending" },
      eligibility: { canStart: false, reason: null },
      defense: {
        ...common,
        status: "InProgress",
        finishedAt: null,
        answered: 2,
        awaitingAnswer: true,
        canFinish: true,
        turns: [...defenseTurns, { role: "interviewer", text: "What happened after the batching change shipped?", at: days(-6) }],
        result: null,
        supervisor: { name: "Marcus Johnson", email: "marcus.johnson@northwind.example", answer: null, comment: null, answeredByName: null, answeredAt: null },
        computedStatus: "Pending",
      },
      credential: null,
    };
  }
  return {
    ...base,
    verification: { status: "Verified", label: "Verified" },
    eligibility: { canStart: false, reason: null },
    defense: {
      ...common,
      status: "Decided",
      finishedAt: days(-5),
      answered: 5,
      awaitingAnswer: false,
      canFinish: false,
      turns: defenseTurns,
      result: {
        score: 84,
        threshold: 70,
        rubric: { ownership: 88, technicalDepth: 80, decisions: 85, outcomes: 82 },
        evidence: {
          items: [
            { dimension: "ownership", quote: "I wrote the rule engine and the test suite.", note: "Clear personal contribution." },
            { dimension: "decisions", quote: "I chose a declarative YAML format so analysts could add rules without code.", note: null },
          ],
          concerns: ["The load-testing numbers were not described in detail."],
        },
        summary: "Jordan explained the work clearly and owned the key design decision.",
        graderSource: "model",
        gradedAt: days(-5),
      },
      supervisor: {
        name: "Marcus Johnson",
        email: "marcus.johnson@northwind.example",
        answer: "Yes",
        comment: "Jordan built this and it is in production.",
        answeredByName: "Marcus Johnson",
        answeredAt: days(-3),
      },
      computedStatus: "Verified",
    },
    credential: { id: "cred-1", status: "Valid", issuedAt: days(-3), publicUrlSlug: "jl-northwind-2026", verifyPath: "/verify/jl-northwind-2026" },
  };
}

/* ------------------------------------------------------------------ document review */

const rubricTemplate = [
  { key: "format", label: "Format and layout" },
  { key: "impact", label: "Impact statements" },
  { key: "fit", label: "Fit to the role" },
];

const reviewOptions: ReviewOptions = {
  slaBusinessDays: 3,
  urgentWithinDays: 2,
  timeZone: TZ,
  ratings: ["Strong", "Satisfactory", "NeedsWork", "NotApplicable"],
  kinds: [
    { kind: "Resume", label: "Resume", rubric: rubricTemplate },
    { kind: "CoverLetter", label: "Cover letter", rubric: [{ key: "opening", label: "Opening" }, { key: "fit", label: "Fit to the role" }] },
    { kind: "PersonalStatement", label: "Personal statement", rubric: [{ key: "story", label: "Story" }] },
  ],
};

const reviewRequests = [
  { id: "dr-1", kind: "Resume", kindLabel: "Resume", target: "Data engineering internships", status: "Returned", currentVersion: 2, submittedAt: days(-6), dueAt: days(-3), returnedAt: days(-2), urgent: false, rating: null },
  { id: "dr-2", kind: "CoverLetter", kindLabel: "Cover letter", target: "Northwind Analytics", status: "InReview", currentVersion: 1, submittedAt: days(-1), dueAt: days(2), returnedAt: null, urgent: true, rating: null },
  { id: "dr-3", kind: "PersonalStatement", kindLabel: "Personal statement", target: "Graduate school applications", status: "Unassigned", currentVersion: 1, submittedAt: hours(-5), dueAt: days(3), returnedAt: null, urgent: false, rating: null },
  { id: "dr-4", kind: "Resume", kindLabel: "Resume", target: "Campus jobs", status: "Done", currentVersion: 1, submittedAt: days(-60), dueAt: days(-57), returnedAt: days(-58), urgent: false, rating: 5 },
];

const reviewText =
  "JORDAN LEE\nColumbus, OH · jordan.lee@lakeside.edu\n\nEXPERIENCE\nSoftware Engineering Intern, Northwind Analytics\n- Worked on data import tools\n- Helped with testing\n\nPROJECTS\nCampus Bus Tracker: real-time arrival map used by 1,200 students";

function reviewDetail(id: string): ReviewDetail {
  const row = reviewRequests.find((r) => r.id === id) ?? reviewRequests[0];
  const reviewer = { userId: "cou-1", name: "Priya Patel" };
  return {
    id: row.id,
    kind: row.kind,
    kindLabel: row.kindLabel,
    target: row.target,
    status: row.status,
    urgent: row.urgent,
    studentDeadline: ymd(7),
    currentVersion: 2,
    submittedAt: days(-6),
    dueAt: days(-3),
    overdue: false,
    returnedAt: row.returnedAt,
    completedAt: null,
    rating: null,
    ratingComment: null,
    assignee: reviewer,
    student: { userId: USER_ID, name: STUDENT_NAME, email: STUDENT_EMAIL },
    rubricTemplate,
    versions: [
      {
        id: `${row.id}-v1`,
        number: 1,
        submittedAt: days(-12),
        dueAt: days(-9),
        text: null,
        jobDescription: null,
        notesToReviewer: "First draft. Is one page enough?",
        file: { id: "file-1", fileName: "Jordan_Lee_Resume_v1.pdf", contentType: "application/pdf", sizeBytes: 184_320 },
        returnedAt: days(-9),
        reviewStartedAt: days(-10),
        reviewer,
        summary: "A solid start. One page is right for you now; focus on results.",
        rubric: [
          { key: "format", label: "Format and layout", rating: "Satisfactory", note: null },
          { key: "impact", label: "Impact statements", rating: "NeedsWork", note: "Add numbers where you can." },
          { key: "fit", label: "Fit to the role", rating: null, note: null },
        ],
        annotatedFile: { id: "file-2", fileName: "Jordan_Lee_Resume_v1_annotated.pdf", contentType: "application/pdf", sizeBytes: 201_400 },
        comments: [
          { id: "c-1", body: "Move Projects above Coursework.", anchorStart: null, anchorEnd: null, quote: null, page: 1, createdAt: days(-9), author: "Priya Patel", mine: false },
        ],
      },
      {
        id: `${row.id}-v2`,
        number: 2,
        submittedAt: days(-6),
        dueAt: days(-3),
        text: reviewText,
        jobDescription: "Data Engineering Intern: build and test data pipelines in Python and SQL.",
        notesToReviewer: null,
        file: null,
        returnedAt: row.returnedAt,
        reviewStartedAt: days(-4),
        reviewer,
        summary: "Much stronger. Two bullet points still describe duties rather than results.",
        rubric: [
          { key: "format", label: "Format and layout", rating: "Strong", note: null },
          { key: "impact", label: "Impact statements", rating: "NeedsWork", note: "See comments 1 and 2." },
          { key: "fit", label: "Fit to the role", rating: "Satisfactory", note: "Mention Python and SQL explicitly." },
        ],
        annotatedFile: null,
        comments: [
          { id: "c-2", body: "What did the tools do, and for whom?", anchorStart: 113, anchorEnd: 140, quote: "Worked on data import tools", page: null, createdAt: days(-2), author: "Priya Patel", mine: false },
          { id: "c-3", body: "Say how many tests and what they caught.", anchorStart: 143, anchorEnd: 162, quote: "Helped with testing", page: null, createdAt: days(-2), author: "Priya Patel", mine: false },
          { id: "c-4", body: "Great, concrete result.", anchorStart: null, anchorEnd: null, quote: null, page: null, createdAt: days(-2), author: "Priya Patel", mine: false },
        ],
      },
    ],
  };
}

/* ------------------------------------------------------------------ international (OPT) */

const optView: OptView = {
  eligible: true,
  workAuthorization: "F1",
  disclaimer: "This is not legal advice. Your Designated School Official (DSO) is the authority.",
  asOf: ymd(0),
  dso: {
    name: "Grace Kim",
    email: "international@lakeside.edu",
    phone: "(614) 555-0199",
    officeUrl: "https://lakeside.example/international",
    note: "Walk-in hours are Tuesdays and Thursdays, 1 to 4 p.m.",
    configured: true,
    careerCenterEmail: "careers@lakeside.edu",
  },
  tracker: { id: "trk-1", programEndDate: ymd(-320), notes: null, updatedAt: days(-20) },
  authorizations: [
    { id: "auth-1", optType: "PreCompletion", label: "Pre-completion OPT", eadStart: ymd(-700), eadEnd: ymd(-610), countsTowardUnemployment: false, evaluations: null },
    { id: "auth-2", optType: "PostCompletion", label: "Post-completion OPT", eadStart: ymd(-300), eadEnd: ymd(65), countsTowardUnemployment: true, evaluations: null },
    {
      id: "auth-3",
      optType: "StemExtension",
      label: "STEM OPT extension",
      eadStart: ymd(66),
      eadEnd: ymd(796),
      countsTowardUnemployment: true,
      evaluations: [
        { month: 12, dueOn: ymd(431), submittedOn: null },
        { month: 24, dueOn: ymd(796), submittedOn: null },
      ],
    },
  ],
  employments: [
    {
      id: "job-1",
      employerName: "Tailspin Robotics",
      jobTitle: "Junior Software Engineer",
      startDate: ymd(-262),
      endDate: ymd(-120),
      hoursPerWeek: 40,
      relatedToMajor: true,
      relationExplanation: "Embedded software development.",
      eVerifyEmployer: true,
      startReportedOn: ymd(-258),
      endReportedOn: null,
      countsForPostCompletion: true,
      countsForStem: true,
    },
    {
      id: "job-2",
      employerName: "Northwind Analytics",
      jobTitle: "Data Engineer",
      startDate: ymd(-98),
      endDate: null,
      hoursPerWeek: 32,
      relatedToMajor: true,
      relationExplanation: null,
      eVerifyEmployer: true,
      startReportedOn: null,
      endReportedOn: null,
      countsForPostCompletion: true,
      countsForStem: true,
    },
  ],
  status: {
    state: "Active",
    daysUsed: 60,
    limit: 150,
    daysRemaining: 90,
    hasStem: true,
    employedToday: true,
    phaseToday: "PostCompletion",
    level: "notice",
    nextWarningAt: 90,
    limitReachedOn: null,
    countingFrom: ymd(-300),
    countingThrough: ymd(0),
    warningThresholds: [60, 90, 120],
    unemployedSpans: [
      { start: ymd(-300), end: ymd(-263), days: 38, phase: "PostCompletion" },
      { start: ymd(-119), end: ymd(-99), days: 21, phase: "PostCompletion" },
      { start: ymd(-50), end: ymd(-50), days: 1, phase: "PostCompletion" },
    ],
  },
  deadlines: [
    { key: "d-1", kind: "report-start", label: "Report your job at Northwind Analytics", dueOn: ymd(-88), status: "overdue", refId: "job-2" },
    { key: "d-2", kind: "report-end", label: "Report the end of your job at Tailspin Robotics", dueOn: ymd(-110), status: "due", refId: "job-1" },
    { key: "d-3", kind: "report-start", label: "Report your job at Tailspin Robotics", dueOn: ymd(-252), status: "done", refId: "job-1" },
    { key: "d-4", kind: "stem-apply", label: "Earliest date to apply for the STEM extension", dueOn: ymd(-25), status: "info", refId: null },
    { key: "d-5", kind: "stem-eval-12", label: "STEM 12-month self-evaluation", dueOn: ymd(431), status: "upcoming", refId: "auth-3" },
  ],
  checks: [
    { level: "bad", text: "Your job at Northwind Analytics hasn't been reported to your DSO yet." },
    { level: "warn", text: "You have used 60 unemployment days. Plan ahead if your job might end." },
    { level: "info", text: "Your STEM extension starts after your post-completion EAD ends." },
  ],
  cpt: {
    fullTimeDays: 84,
    limitDays: 365,
    periods: [{ startDate: ymd(-760), endDate: ymd(-676), hoursPerWeek: 40, employerName: "Tailspin Robotics", fullTime: true }],
  },
  rules: {
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
    note: "Rules summarized from public SEVP guidance as of 2026. Check with your DSO.",
  },
  optTypes: [
    { value: "PreCompletion", label: "Pre-completion OPT" },
    { value: "PostCompletion", label: "Post-completion OPT" },
    { value: "StemExtension", label: "STEM OPT extension" },
  ],
};

const sponsorMeta = {
  lastUpdated: days(-30),
  fiscalYears: [2023, 2024, 2025],
  employers: 48_210,
  disclaimer: "Past filings don't guarantee future sponsorship. Data comes from public Department of Labor disclosures.",
  source: "U.S. Department of Labor, OFLC LCA disclosure data",
};

const sponsors: SponsorSummary[] = [
  { normalizedKey: "northwind-analytics", name: "Northwind Analytics", otherNames: ["Northwind Analytics", "Northwind Analytics LLC"], totalCases: 214, totalCertified: 201, firstFiscalYear: 2023, latestFiscalYear: 2025, latestCertified: 78 },
  { normalizedKey: "northwind-health", name: "Northwind Health Partners", otherNames: ["Northwind Health Partners"], totalCases: 1, totalCertified: 1, firstFiscalYear: 2025, latestFiscalYear: 2025, latestCertified: 1 },
];

const sponsorDetail = (key: string) => ({
  employer: sponsors.find((s) => s.normalizedKey === key) ?? sponsors[0],
  disclaimer: sponsorMeta.disclaimer,
  years: [2025, 2024].map((fy, i) => ({
    fiscalYear: fy,
    displayName: "Northwind Analytics",
    totalCases: 80 - i * 10,
    certified: 78 - i * 10,
    certifiedWithdrawn: i,
    denied: 1,
    withdrawn: 1 - i,
    wages: { min: 82_000, median: 104_500 - i * 3_000, max: 165_000, basis: "Year" },
    names: ["Northwind Analytics LLC"],
    topJobTitles: [
      { title: "Software Engineer", count: 41 - i * 5 },
      { title: "Data Engineer", count: 18 },
    ],
    topSocCodes: [{ code: "15-1252", title: "Software Developers", count: 52 }],
    states: [
      { state: "OH", count: 60 },
      { state: "TX", count: 12 },
    ],
    visaClasses: [{ visaClass: "H-1B", count: 78 }],
  })),
});

/* ------------------------------------------------------------------ on-campus interviews */

function ocrSchedule(id: string, over: Partial<OcrSchedule>): OcrSchedule {
  return {
    id,
    instituteId: INSTITUTE_ID,
    school: SCHOOL_NAME,
    employerId: EMPLOYER_ID,
    employerName: "Northwind Analytics",
    positionTitle: "Software Engineering Intern",
    description: "Thirty-minute technical conversations about a project you're proud of.",
    externalJobUrl: "https://northwind.example/careers/swe-intern",
    externalJobId: "NW-1042",
    externalJobSource: "greenhouse",
    virtual: false,
    virtualUrl: null,
    tracks: 2,
    slotMinutes: 30,
    breakMinutes: 10,
    days: [
      { date: ymd(9), start: "09:00", end: "16:00", lunchStart: "12:00", lunchEnd: "13:00" },
      { date: ymd(10), start: "09:00", end: "12:00", lunchStart: null, lunchEnd: null },
    ],
    interviewers: [{ name: "Marcus Johnson", email: "marcus.johnson@northwind.example" }],
    signupType: "Open",
    degreeLevels: ["Bachelor", "Master"],
    majors: ["Computer Science", "Computer Engineering"],
    gradFrom: "2026-12-01",
    gradTo: "2027-08-31",
    workAuthRequirement: "None",
    workAuthStatement: "I am authorized to work in the United States.",
    signupOpensAt: days(-3),
    signupClosesAt: days(6),
    cancelCutoffHours: 48,
    status: "Published",
    decisionNote: null,
    publishedAt: days(-4),
    createdAt: days(-10),
    ...over,
  };
}

const ocrMine = () => ({
  timeZone: TZ,
  items: [
    {
      scheduleId: "sch-1",
      employerName: "Northwind Analytics",
      positionTitle: "Software Engineering Intern",
      externalJobUrl: "https://northwind.example/careers/swe-intern",
      scheduleStatus: "Published",
      candidateStatus: "Registered",
      booking: {
        id: "bk-1",
        status: "Booked",
        source: "Promoted",
        startUtc: at(9, 15),
        endUtc: at(9, 15, 30),
        room: "Career Center, Interview Room 3",
        virtualUrl: null,
        attendance: null,
        cancelBy: at(7, 15),
        canCancel: true,
      },
    },
    {
      scheduleId: "sch-2",
      employerName: "Contoso Health",
      positionTitle: "Data Analyst Intern",
      externalJobUrl: null,
      scheduleStatus: "Published",
      candidateStatus: "Waitlisted",
      booking: null,
    },
    {
      scheduleId: "sch-3",
      employerName: "Tailspin Robotics",
      positionTitle: "Firmware Co-op",
      externalJobUrl: null,
      scheduleStatus: "Completed",
      candidateStatus: "Registered",
      booking: {
        id: "bk-0",
        status: "Booked",
        source: "Student",
        startUtc: at(-20, 18),
        endUtc: at(-20, 18, 30),
        room: null,
        virtualUrl: "https://meet.tailspin.example/ocr-0412",
        attendance: "Attended",
        cancelBy: at(-22, 18),
        canCancel: false,
      },
    },
  ],
});

const ocrListed = () => ({
  timeZone: TZ,
  schedules: [
    ocrSchedule("sch-4", {
      employerName: "Fabrikam Logistics",
      positionTitle: "Operations Research Intern",
      virtual: true,
      virtualUrl: "https://meet.fabrikam.example/ocr",
      signupType: "PreSelect",
      workAuthRequirement: "AuthorizedUS",
      extra: { invited: true, tier: "Primary", candidateStatus: "Invited", canBook: true, freeSlots: 6, signupOpen: true },
    }),
    ocrSchedule("sch-5", {
      employerName: "Woodgrove Bank",
      positionTitle: "Technology Analyst",
      signupType: "Open",
      majors: [],
      gradFrom: null,
      gradTo: null,
      extra: { invited: false, tier: null, candidateStatus: null, canBook: false, freeSlots: 0, signupOpen: true },
    }),
    ocrSchedule("sch-1", {
      extra: { invited: false, tier: null, candidateStatus: "Registered", canBook: false, freeSlots: 3, signupOpen: true },
    }),
    ocrSchedule("sch-6", {
      employerName: "Litware Games",
      positionTitle: "Gameplay Engineer Intern",
      signupOpensAt: days(4),
      signupClosesAt: days(12),
      extra: { invited: false, tier: null, candidateStatus: null, canBook: false, freeSlots: 12, signupOpen: false },
    }),
  ],
});

const ocrScheduleDetail = (id: string) =>
  ocrSchedule(id, {
    extra: {
      slots: [0, 1, 2].map((i) => ({ id: `slot-${id}-${i}`, date: ymd(9), startUtc: at(9, 14 + i), endUtc: at(9, 14 + i, 30) })),
      hasConsent: false,
      canBook: true,
    },
  });

/* ------------------------------------------------------------------ mentoring */

const mentoringOptions: MentoringOptions = {
  topics: [
    { key: "resume", label: "Resume and LinkedIn" },
    { key: "interviewing", label: "Interviewing" },
    { key: "industry", label: "Industry insight" },
    { key: "gradschool", label: "Graduate school" },
  ],
  meetingFormats: ["Video", "Phone", "InPerson", "Email"],
  reportReasons: ["Inappropriate", "Harassment", "Unresponsive", "Spam", "SafetyConcern", "Other"],
  functions: ["Software engineering", "Data science", "Product management"],
  industries: ["Software", "Healthcare", "Finance", "Logistics"],
  requireStaffApproval: true,
  maxOpenRequests: 3,
  scoring: "Suggestions are ranked by shared majors, topics and industries. Nothing else about you is used.",
};

const mentors = [
  {
    id: "men-1",
    name: "Marcus Johnson",
    kind: "Alumni",
    headline: "Engineering manager who loves helping first-generation students break into tech.",
    employer: "Northwind Analytics",
    jobTitle: "Engineering Manager",
    industry: "Software",
    functions: ["Software engineering"],
    majors: ["Computer Science"],
    topics: ["resume", "interviewing"],
    meetingPreferences: ["Video", "Phone"],
    capacity: 3,
    spotsLeft: 0,
    availabilityNotes: "Weekday evenings",
    bio: "Lakeside '14. Previously at Tailspin Robotics.",
    graduationYear: 2014,
    match: { score: 72, reasons: ["Studied Computer Science, like you", "Helps with interviewing"] },
    myStatus: "Active",
  },
  {
    id: "men-2",
    name: "Aisha Rahman",
    kind: "Professional",
    headline: "Data scientist in healthcare analytics.",
    employer: "Contoso Health",
    jobTitle: "Senior Data Scientist",
    industry: "Healthcare",
    functions: ["Data science"],
    majors: ["Statistics"],
    topics: ["industry", "gradschool"],
    meetingPreferences: ["Video"],
    capacity: 2,
    spotsLeft: 1,
    availabilityNotes: null,
    bio: null,
    graduationYear: null,
    match: { score: 45, reasons: ["Works in Healthcare, which you're interested in"] },
    myStatus: null,
  },
  {
    id: "men-3",
    name: "Luis Hernández",
    kind: "Alumni",
    headline: "Product manager; happy to talk about moving from engineering into product.",
    employer: "Woodgrove Bank",
    jobTitle: "Product Manager",
    industry: "Finance",
    functions: ["Product management"],
    majors: ["Computer Science", "Economics"],
    topics: ["industry", "interviewing"],
    meetingPreferences: ["InPerson", "Video"],
    capacity: 4,
    spotsLeft: 2,
    availabilityNotes: "Saturdays in Columbus",
    bio: "Lakeside '18.",
    graduationYear: 2018,
    match: null,
    myStatus: "Requested",
  },
  {
    id: "men-4",
    name: "Hannah Brooks",
    kind: "Professional",
    headline: "Logistics analyst.",
    employer: null,
    jobTitle: null,
    industry: null,
    functions: [],
    majors: [],
    topics: ["resume"],
    meetingPreferences: ["Email"],
    capacity: 1,
    spotsLeft: 0,
    availabilityNotes: null,
    bio: null,
    graduationYear: null,
    match: { score: 0, reasons: [] },
    myStatus: null,
  },
];

const relationships: RelationshipSummary[] = [
  {
    id: "rel-1",
    status: "Active",
    side: "Student",
    mentorProfileId: "men-1",
    mentorName: "Marcus Johnson",
    studentName: STUDENT_NAME,
    message: "Hi Marcus, I'm a CS junior interested in data engineering. I'd love advice on interviewing for internships.",
    goals: ["Prepare for technical interviews", "Learn what data engineers do day to day"],
    matchReasons: ["Studied Computer Science, like you"],
    mentorNote: "Happy to help. Let's meet every two weeks.",
    requestedAt: days(-60),
    mentorDecidedAt: days(-58),
    startedAt: days(-57),
    endedAt: null,
    endReason: null,
    lastActivityAt: days(-30),
    sessions: 3,
    totalMinutes: 135,
    lastSession: ymd(-30),
    checkInDue: true,
    contactShared: true,
  },
  {
    id: "rel-2",
    status: "PendingStaff",
    side: "Student",
    mentorProfileId: "men-3",
    mentorName: "Luis Hernández",
    studentName: STUDENT_NAME,
    message: "Hello Luis, I'm curious about product management and would value your perspective.",
    goals: ["Understand the PM role"],
    matchReasons: [],
    mentorNote: null,
    requestedAt: days(-4),
    mentorDecidedAt: days(-2),
    startedAt: null,
    endedAt: null,
    endReason: null,
    lastActivityAt: days(-2),
    sessions: 0,
    totalMinutes: 0,
    lastSession: null,
    checkInDue: false,
    contactShared: false,
  },
  {
    id: "rel-3",
    status: "Completed",
    side: "Student",
    mentorProfileId: "men-2",
    mentorName: "Aisha Rahman",
    studentName: STUDENT_NAME,
    message: "Hi Aisha, I'd like to learn about data science in healthcare.",
    goals: ["Explore healthcare analytics"],
    matchReasons: ["Works in Healthcare"],
    mentorNote: null,
    requestedAt: days(-300),
    mentorDecidedAt: days(-298),
    startedAt: days(-297),
    endedAt: days(-200),
    endReason: "Goals met",
    lastActivityAt: days(-200),
    sessions: 4,
    totalMinutes: 180,
    lastSession: ymd(-205),
    checkInDue: false,
    contactShared: true,
  },
];

function pairDetail(id: string): PairDetail {
  const relationship = relationships.find((r) => r.id === id) ?? relationships[0];
  const active = relationship.status === "Active";
  return {
    relationship,
    contact: relationship.contactShared ? { name: relationship.mentorName, email: "marcus.johnson@northwind.example", phone: "(614) 555-0177" } : null,
    sessions: active
      ? [
          { id: "ses-1", occurredOn: ymd(-30), durationMinutes: 45, format: "Video", privateNotes: "Mock system design interview.", sharedSummary: "Interview practice", loggedByMe: true },
          { id: "ses-2", occurredOn: ymd(-44), durationMinutes: 60, format: "InPerson", privateNotes: null, sharedSummary: "Resume review", loggedByMe: false },
        ]
      : [],
    myFeedback: relationship.status === "Completed" ? { rating: 5, comment: "Very helpful." } : null,
    canLogSession: active,
    canGiveFeedback: false,
  };
}

/* ------------------------------------------------------------------ messages */

const threads: ThreadRow[] = [
  {
    id: "th-1",
    kind: "CareerCenter",
    subject: "Question about CPT paperwork",
    status: "Open",
    studentUserId: USER_ID,
    studentName: STUDENT_NAME,
    mentorshipId: null,
    mentorName: null,
    assigneeUserId: "cou-1",
    assigneeName: "Priya Patel",
    lastMessageAt: hours(-2),
    lastMessagePreview: "Yes, upload the signed offer letter and we'll take it from there.",
    unread: 1,
    mentorshipStatus: null,
  },
  {
    id: "th-2",
    kind: "Mentorship",
    subject: "Mentorship with Marcus Johnson",
    status: "Open",
    studentUserId: USER_ID,
    studentName: STUDENT_NAME,
    mentorshipId: "rel-1",
    mentorName: "Marcus Johnson",
    assigneeUserId: null,
    assigneeName: null,
    lastMessageAt: days(-1),
    lastMessagePreview: "See you Thursday at 6.",
    unread: 0,
    mentorshipStatus: "Active",
  },
  {
    id: "th-3",
    kind: "CareerCenter",
    subject: "Career fair accommodations",
    status: "Closed",
    studentUserId: USER_ID,
    studentName: STUDENT_NAME,
    mentorshipId: null,
    mentorName: null,
    assigneeUserId: "cou-2",
    assigneeName: "Daniel Okafor",
    lastMessageAt: days(-40),
    lastMessagePreview: "Glad that worked out!",
    unread: 0,
    mentorshipStatus: null,
  },
];

function threadDetail(id: string) {
  const t = threads.find((x) => x.id === id) ?? threads[0];
  return {
    thread: { id: t.id, kind: t.kind, subject: t.subject, status: t.status, studentName: t.studentName, mentorName: t.mentorName, assigneeUserId: t.assigneeUserId, mentorshipStatus: t.mentorshipStatus },
    viewerSide: "Student",
    canPost: t.status === "Open",
    canAddNotes: false,
    otherLastReadAt: hours(-1),
    staff: null,
    posts: [
      {
        id: `${t.id}-p1`,
        authorUserId: USER_ID,
        authorName: STUDENT_NAME,
        authorSide: "Student",
        body: "Hi! Do I need anything besides the offer letter to request CPT?",
        isInternalNote: false,
        createdAt: days(-1),
        attachment: { id: "att-1", name: "northwind-offer-letter.pdf" },
        mine: true,
        seen: true,
      },
      {
        id: `${t.id}-p2`,
        authorUserId: "cou-1",
        authorName: t.kind === "Mentorship" ? "Marcus Johnson" : "Priya Patel",
        authorSide: t.kind === "Mentorship" ? "Mentor" : "Staff",
        body: "Yes, upload the signed offer letter and we'll take it from there.",
        isInternalNote: false,
        createdAt: hours(-2),
        attachment: null,
        mine: false,
        seen: false,
      },
    ],
  };
}

/* ------------------------------------------------------------------ next step (outcomes) */

const placements: Placement[] = [
  {
    id: "pl-1",
    studentUserId: USER_ID,
    studentName: STUDENT_NAME,
    studentEmail: STUDENT_EMAIL,
    employerId: EMPLOYER_ID,
    employerName: "Northwind Analytics",
    title: "Data Engineer I",
    employmentType: "FullTime",
    startDate: ymd(240),
    location: "Columbus, OH",
    salaryBand: "75to100k",
    source: "EmployerReported",
    verificationLevel: "EmployerVerified",
    sources: ["EmployerReported", "StudentReported"],
    evidenceNotes: null,
    verifiedAt: days(-6),
    createdAt: days(-10),
    updatedAt: days(-6),
    studentEditable: false,
  },
  {
    id: "pl-2",
    studentUserId: USER_ID,
    studentName: STUDENT_NAME,
    studentEmail: STUDENT_EMAIL,
    employerId: null,
    employerName: "Lakeside State University Graduate School",
    title: "M.S. in Data Science (deferred admission)",
    employmentType: "ContinuingEducation",
    startDate: null,
    location: null,
    salaryBand: null,
    source: "StudentReported",
    verificationLevel: "SelfReported",
    sources: ["StudentReported"],
    evidenceNotes: "Admission letter received.",
    verifiedAt: null,
    createdAt: days(-20),
    updatedAt: days(-20),
    studentEditable: true,
  },
];

const outcomesMine = {
  placements,
  status: "Seeking",
  offers: [{ bookingId: "bk-0", employerName: "Tailspin Robotics", positionTitle: "Firmware Co-op", outcomeAt: days(-12) }],
  employmentTypes: ["FullTime", "PartTime", "Internship", "Contract", "Fellowship", "ContinuingEducation", "Military", "Volunteer"],
  salaryBands: ["Under30k", "30to50k", "50to75k", "75to100k", "100to150k", "150kPlus"],
};

/* ------------------------------------------------------------------ challenges */

const challenge = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: "Patient data pipeline",
  description: "Build a small pipeline that cleans and loads synthetic patient census data.\nAutomated tests check correctness.",
  opensAt: days(-7),
  closesAt: days(14),
  degreeLevels: ["Bachelor"],
  majors: ["Computer Science", "Data Science"],
  gradFrom: "2026-12-01",
  gradTo: "2027-12-31",
  externalJobUrl: "https://northwind.example/careers/data-eng-intern",
  prizeText: "Top scorers are invited to a final-round interview.",
  maxParticipants: 100,
  status: "Published",
  ...over,
});

const challengesBrowse = [
  {
    challenge: challenge("ch-1"),
    employer: { id: EMPLOYER_ID, name: "Northwind Analytics", website: "https://northwind.example", verificationStatus: "Verified" },
    isOpen: true,
    eligible: true,
    ineligibleReason: null,
    full: false,
    joined: false,
    consentCategories: ["Profile", "Education", "Assessments", "EvidencePack"],
  },
  {
    challenge: challenge("ch-2", { title: "Route optimizer sprint", degreeLevels: ["Master"], majors: ["Operations Research"], prizeText: null, externalJobUrl: null }),
    employer: { id: "emp-fab", name: "Fabrikam Logistics", website: null, verificationStatus: "Verified" },
    isOpen: true,
    eligible: false,
    ineligibleReason: "This challenge is for master's students.",
    full: false,
    joined: false,
    consentCategories: ["Profile", "Assessments"],
  },
  {
    challenge: challenge("ch-3", { title: "Accessible dashboard", degreeLevels: [], majors: [], gradFrom: null, gradTo: null, opensAt: days(3) }),
    employer: { id: "emp-wg", name: "Woodgrove Bank", website: "https://woodgrove.example", verificationStatus: "Verified" },
    isOpen: false,
    eligible: true,
    ineligibleReason: null,
    full: true,
    joined: false,
    consentCategories: ["Profile", "Assessments"],
  },
  {
    challenge: challenge("ch-4", { title: "Firmware debugging challenge" }),
    employer: { id: "emp-ts", name: "Tailspin Robotics", website: null, verificationStatus: "Verified" },
    isOpen: true,
    eligible: true,
    ineligibleReason: null,
    full: false,
    joined: true,
    consentCategories: ["Profile", "Assessments"],
  },
];

const challengesMine = [
  {
    challenge: challenge("ch-4", { title: "Firmware debugging challenge" }),
    employer: "Tailspin Robotics",
    participation: {
      participantId: "pp-1",
      joinedAt: days(-5),
      withdrawnAt: null,
      consentActive: true,
      attemptUrl: "/sprint/attempt/pp-1",
      submissions: 2,
      score: 87,
      testsPassed: 13,
      testsTotal: 15,
      defended: true,
      defenseScore: 79,
      credentialSlug: "jl-tailspin-firmware",
      inviteCount: 1,
    },
  },
  {
    challenge: challenge("ch-5", { title: "SQL performance tune-up", externalJobUrl: null }),
    employer: "Contoso Health",
    participation: {
      participantId: "pp-2",
      joinedAt: days(-2),
      withdrawnAt: null,
      consentActive: false,
      attemptUrl: "/sprint/attempt/pp-2",
      submissions: 0,
      score: null,
      testsPassed: null,
      testsTotal: null,
      defended: false,
      defenseScore: null,
      credentialSlug: null,
      inviteCount: 0,
    },
  },
  {
    challenge: challenge("ch-6", { title: "Old challenge" }),
    employer: "Woodgrove Bank",
    participation: {
      participantId: "pp-3",
      joinedAt: days(-90),
      withdrawnAt: days(-80),
      consentActive: false,
      attemptUrl: null,
      submissions: 0,
      score: null,
      testsPassed: null,
      testsTotal: null,
      defended: false,
      defenseScore: null,
      credentialSlug: null,
      inviteCount: 0,
    },
  },
];

/* ------------------------------------------------------------------ competencies */

const competencies = {
  available: [
    { key: "nace", name: "NACE Career Readiness" },
    { key: "lakeside-core", name: "Lakeside Core Skills" },
  ],
  framework: { key: "nace", name: "NACE Career Readiness", note: "Competency names and definitions from NACE, used with permission." },
  note: "Evidence comes from activities your school records, such as appointments, challenges and internships for credit.",
  competencies: [
    {
      code: "CT",
      title: "Critical thinking",
      mapped: true,
      evidence: [
        { activity: "Employer challenge: Firmware debugging", measure: "Automated tests", direct: true, score: 87, metTarget: true, at: days(-4) },
        { activity: "Internship defense: Northwind Analytics", measure: "Defense rubric", direct: true, score: 62, metTarget: false, at: days(-5) },
        { activity: "Career exploration appointment", measure: null, direct: false, score: null, metTarget: null, at: days(-30) },
      ],
    },
    { code: "COM", title: "Communication", mapped: true, evidence: [] },
    { code: "LEAD", title: "Leadership", mapped: false, evidence: [] },
    {
      code: "TECH",
      title: "Technology",
      mapped: true,
      evidence: [{ activity: "Internship for credit: CSE 3999", measure: "Supervisor evaluation", direct: true, score: 4, metTarget: true, at: days(-45) }],
    },
  ],
};

/* ------------------------------------------------------------------ fixtures */

const PDF = "%PDF-1.4\n% a11y fixture\n";

const raw: ApiFixture[] = [
  // Record, profile, privacy
  { path: "/api/career/student/record", body: studentRecord },
  { method: "PUT", path: "/api/career/student/profile", body: studentRecord.profile },
  { method: "PUT", path: "/api/career/student/ferpa-hold", body: { ferpaHold: true } },
  { path: "/api/career/student/consents", body: consents },
  { path: "/api/career/student/disclosures", body: disclosures },

  // Appointments (exact paths first; the /student/{id} RegExp would also match them)
  { path: "/api/career/appointments/student", body: myAppointments },
  { path: "/api/career/appointments/student/types", body: { timeZone: TZ, types: apptTypes } },
  { path: "/api/career/appointments/student/counselors", body: counselors },
  { path: "/api/career/appointments/student/slots", body: slotResponse },
  { path: "/api/career/appointments/student/dropin", body: dropIn },
  { path: "/api/career/appointments/student/notes", body: apptNotes },
  { path: "/api/career/appointments/student/tasks", body: apptTasks },
  { method: "POST", path: "/api/career/appointments/student/book", body: () => appointment({ id: "appt-new", startUtc: at(1, 15) }) },
  {
    method: "POST",
    path: /^\/api\/career\/appointments\/student\/tasks\/[^/]+$/,
    body: (ctx: FixtureContext) => ({ id: segment(ctx, /tasks\/([^/]+)$/, "task-1"), status: ctx.postData?.includes('"done":true') ? "Done" : "Open", completedAt: ctx.postData?.includes('"done":true') ? days(0) : null }),
  },
  {
    method: "POST",
    path: /^\/api\/career\/appointments\/student\/[^/]+\/reschedule$/,
    body: (ctx: FixtureContext) => appointment({ id: segment(ctx, /student\/([^/]+)\/reschedule$/, "appt-1"), startUtc: at(4, 15), rescheduleCount: 1 }),
  },
  {
    path: /^\/api\/career\/appointments\/student\/[^/]+\/ics$/,
    contentType: "text/calendar",
    body: "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//a11y//EN\nBEGIN:VEVENT\nUID:appt-1\nSUMMARY:Resume review\nEND:VEVENT\nEND:VCALENDAR\n",
  },
  { path: /^\/api\/career\/appointments\/student\/[^/]+$/, body: { notes: [apptNotes[0]], tasks: apptTasks.slice(0, 2) } },

  // Internships for credit
  { path: "/api/career/experiences/mine", body: experienceSummaries },
  { method: "POST", path: "/api/career/experiences/mine", body: experienceDetail("exp-4") },
  { path: "/api/career/experiences/programs", body: experiencePrograms },
  {
    path: "/api/career/experiences/employers",
    body: [
      { id: EMPLOYER_ID, name: "Northwind Analytics", website: "https://northwind.example", verificationStatus: "Verified" },
      { id: "emp-ch", name: "Contoso Health", website: null, verificationStatus: "Unverified" },
    ],
  },
  { path: /^\/api\/career\/experiences\/documents\/[^/]+$/, contentType: "application/pdf", body: PDF },
  // Detail plus every action on it (submit, withdraw, sign, hours, reflections, documents, PUT edit) answers with the detail
  {
    method: "*",
    path: /^\/api\/career\/experiences\/mine\/[^/]+(\/[a-z]+)?$/,
    body: (ctx: FixtureContext) => experienceDetail(segment(ctx, /mine\/([^/]+)/, "exp-1")),
  },

  // Internship defense: start/answer return the in-progress state, finish the decided one
  {
    method: "*",
    path: /^\/api\/career\/internship-defense\/mine\/[^/]+(\/.+)?$/,
    body: (ctx: FixtureContext) => {
      const id = segment(ctx, /mine\/([^/]+)/, "exp-1");
      const action = /mine\/[^/]+\/(.+)$/.exec(ctx.url.pathname)?.[1];
      if (action === "start" || action === "answer") return defenseState(id, "start");
      if (action === "finish" || action === "voice/complete") return defenseState(id, "decided");
      return defenseState(id);
    },
  },

  // Document review
  { path: "/api/career/doc-review/options", body: reviewOptions },
  { path: "/api/career/doc-review/requests", body: reviewRequests },
  { method: "POST", path: "/api/career/doc-review/requests", body: () => ({ ...reviewDetail("dr-3"), dueAt: days(3) }) },
  { method: "POST", path: /^\/api\/career\/doc-review\/requests\/[^/]+\/versions$/, body: (ctx: FixtureContext) => reviewDetail(segment(ctx, /requests\/([^/]+)\//, "dr-1")) },
  { path: /^\/api\/career\/doc-review\/requests\/[^/]+$/, body: (ctx: FixtureContext) => reviewDetail(segment(ctx, /requests\/([^/]+)$/, "dr-1")) },
  { path: /^\/api\/career\/doc-review\/files\/[^/]+$/, contentType: "application/pdf", body: PDF },

  // International students: OPT tracker (every write returns the updated view) and sponsorship lookup
  { method: "*", path: /^\/api\/career\/international\/opt(\/.*)?$/, body: optView },
  { path: "/api/career/international/sponsor-meta", body: sponsorMeta },
  {
    path: "/api/career/international/sponsors",
    body: (ctx: FixtureContext) => {
      const q = (ctx.url.searchParams.get("q") ?? "").toLowerCase();
      return { items: q.startsWith("zz") ? [] : sponsors };
    },
  },
  { path: /^\/api\/career\/international\/sponsors\/[^/]+$/, body: (ctx: FixtureContext) => sponsorDetail(decodeURIComponent(segment(ctx, /sponsors\/([^/]+)$/, "northwind-analytics"))) },

  // On-campus interviews
  { path: "/api/career/ocr/student/status", body: { noShows: 0, limit: 2, blocked: false } },
  { path: "/api/career/ocr/student/mine", body: ocrMine },
  { path: "/api/career/ocr/student/schedules", body: ocrListed },
  {
    path: "/api/career/ocr/student/resumes",
    body: [
      { id: "res-1", fileName: "Jordan_Lee_Resume_2026.pdf", sizeBytes: 182_000 },
      { id: "res-2", fileName: "Jordan_Lee_Resume_Data.pdf", sizeBytes: 176_500 },
    ],
  },
  { method: "POST", path: "/api/career/ocr/student/resumes", body: { id: "res-3", fileName: "uploaded-resume.pdf", sizeBytes: 150_000 } },
  { method: "POST", path: /^\/api\/career\/ocr\/student\/schedules\/[^/]+\/signup$/, body: { candidateStatus: "Registered", bookingId: "bk-9" } },
  { path: /^\/api\/career\/ocr\/student\/schedules\/[^/]+$/, body: (ctx: FixtureContext) => ocrScheduleDetail(segment(ctx, /schedules\/([^/]+)$/, "sch-4")) },

  // Mentoring
  { path: "/api/career/mentoring/options", body: mentoringOptions },
  { path: "/api/career/mentoring/student/relationships", body: relationships },
  {
    path: "/api/career/mentoring/student/mentors",
    body: (ctx: FixtureContext) => {
      const items = ctx.url.searchParams.get("hasCapacity") === "true" ? mentors.filter((m) => m.spotsLeft > 0 || m.myStatus) : mentors;
      return { total: items.length, items };
    },
  },
  {
    path: "/api/career/mentoring/student/suggestions",
    body: { explanation: "Ranked by your major (Computer Science) and the topics you picked.", items: mentors.slice(0, 2) },
  },
  { path: "/api/career/mentoring/student/preferences", body: { industries: ["Software", "Healthcare"], functions: ["Data science"], topics: ["interviewing", "industry"], majors: ["Computer Science"] } },
  { method: "PUT", path: "/api/career/mentoring/student/preferences", body: { industries: ["Software"], functions: ["Data science"], topics: ["interviewing"], majors: ["Computer Science"] } },
  { method: "POST", path: "/api/career/mentoring/student/requests", body: { relationship: { id: "rel-2" } } },
  { path: /^\/api\/career\/mentoring\/relationships\/[^/]+$/, body: (ctx: FixtureContext) => pairDetail(segment(ctx, /relationships\/([^/]+)$/, "rel-1")) },

  // Messages
  {
    path: "/api/career/messaging/student/threads",
    body: (ctx: FixtureContext) => {
      const q = (ctx.url.searchParams.get("q") ?? "").toLowerCase();
      return q ? threads.filter((t) => t.subject.toLowerCase().includes(q) || (t.lastMessagePreview ?? "").toLowerCase().includes(q)) : threads;
    },
  },
  { method: "POST", path: "/api/career/messaging/student/threads", body: { id: "th-1" } },
  { path: /^\/api\/career\/messaging\/threads\/[^/]+\/files\/[^/]+$/, contentType: "application/pdf", body: PDF },
  { path: /^\/api\/career\/messaging\/threads\/[^/]+$/, body: (ctx: FixtureContext) => threadDetail(segment(ctx, /threads\/([^/]+)$/, "th-1")) },

  // My next step
  { path: "/api/career/outcomes/me", body: outcomesMine },
  { method: "POST", path: "/api/career/outcomes/me/placements", body: { merged: false } },

  // Employer challenges
  { path: "/api/career/challenges/student", body: challengesBrowse },
  { path: "/api/career/challenges/student/mine", body: challengesMine },

  // Competencies
  {
    path: "/api/career/frameworks/me/competencies",
    body: (ctx: FixtureContext) => {
      const key = ctx.url.searchParams.get("framework");
      if (key === "lakeside-core") {
        return { ...competencies, framework: { key: "lakeside-core", name: "Lakeside Core Skills", note: "Defined by the Lakeside faculty senate." }, competencies: competencies.competencies.slice(0, 2) };
      }
      return competencies;
    },
  },
];

/** Student-only: these answer only for the student persona so other personas' pages keep their own fixtures. */
export const studentFixtures: ApiFixture[] = raw.map((f) => ({
  ...f,
  when: (ctx: FixtureContext) => ctx.persona === "student" && (f.when ? f.when(ctx) : true),
}));

const route = (name: string, path: string): A11yRoute => ({ name, path, persona: "student" });

export const studentRoutes: A11yRoute[] = [
  route("student-home", "/student"),
  route("student-appointments", "/student/appointments"),
  route("student-challenges", "/student/challenges"),
  route("student-competencies", "/student/competencies"),
  route("student-document-review", "/student/document-review"),
  route("student-document-review-detail", "/student/document-review?id=dr-1"),
  route("student-experiences", "/student/experiences"),
  route("student-experience-detail", "/student/experiences/exp-1"),
  route("student-experience-defend-result", "/student/experiences/exp-1/defend"),
  route("student-experience-defend-start", "/student/experiences/exp-2/defend"),
  route("student-experience-defend-written", "/student/experiences/exp-3/defend"),
  route("student-international", "/student/international"),
  route("student-interviews", "/student/interviews"),
  route("student-mentoring", "/student/mentoring"),
  route("student-messages", "/student/messages"),
  route("student-messages-thread", "/student/messages?thread=th-1"),
  route("student-next-step", "/student/next-step"),
  route("student-notifications", "/student/notifications"),
  route("student-privacy", "/student/privacy"),
  route("student-record", "/student/record"),
];
