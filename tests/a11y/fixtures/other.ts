/**
 * Fixtures for the employer, faculty, alumni, signed-link (supervisor, kiosk, unsubscribe), verify, platform admin
 * and login pages. Career data is brand-neutral.
 */

import { type A11yRoute, type ApiFixture, type FixtureContext, EMPLOYER_ID, INSTITUTE_ID, SCHOOL_NAME, USER_ID, days, hours } from "./types";

/** yyyy-mm-dd, n days from today (date-only fields such as internship dates and interview days). */
const ymd = (n: number) => days(n).slice(0, 10);

const OTHER_SCHOOL_ID = "44444444-4444-4444-8444-444444444444";
const THIRD_SCHOOL_ID = "55555555-5555-4555-8555-555555555555";
const FOURTH_SCHOOL_ID = "66666666-6666-4666-8666-666666666666";

const lastSegment = (ctx: FixtureContext) => ctx.url.pathname.split("/").filter(Boolean).pop() ?? "";

// ---------------------------------------------------------------------------------------------------------------
// Employer
// ---------------------------------------------------------------------------------------------------------------

const employerSchools = [
  { id: "rel-1", instituteId: INSTITUTE_ID, school: SCHOOL_NAME, status: "Approved", requestNote: "We hire data analysts and software interns every summer.", decisionNote: "Welcome to Lakeside recruiting.", requestedAt: days(-90), decidedAt: days(-85) },
  { id: "rel-2", instituteId: OTHER_SCHOOL_ID, school: "Ridgeview College", status: "Approved", requestNote: null, decisionNote: null, requestedAt: days(-60), decidedAt: days(-58) },
  { id: "rel-3", instituteId: THIRD_SCHOOL_ID, school: "Northern Plains University", status: "Pending", requestNote: "Interested in your health informatics program.", decisionNote: null, requestedAt: days(-4), decidedAt: null },
  { id: "rel-4", instituteId: FOURTH_SCHOOL_ID, school: "Bayshore Community College", status: "Declined", requestNote: null, decisionNote: "We only work with employers in our county right now.", requestedAt: days(-120), decidedAt: days(-110) },
];

const searchSchools = [
  { instituteId: INSTITUTE_ID, slug: "lakeside", displayName: SCHOOL_NAME, logoUrl: null },
  { instituteId: FOURTH_SCHOOL_ID, slug: "bayshore", displayName: "Bayshore Community College", logoUrl: null },
  { instituteId: "77777777-7777-4777-8777-777777777777", slug: "summit-tech", displayName: "Summit Technical Institute", logoUrl: null },
];

const team = [
  { id: "tm-1", userId: "u-owner-1", email: "dana.whitfield@northwind.example", name: "Dana Whitfield", title: "Head of Talent", role: "Owner", status: "Active" },
  { id: "tm-2", userId: USER_ID, email: "jordan.lee@northwind.example", name: "Jordan Lee", title: "Campus Recruiter", role: "Admin", status: "Active" },
  { id: "tm-3", userId: "u-member-3", email: "luis.ortega@northwind.example", name: "Luis Ortega", title: "Engineering Manager", role: "Member", status: "Active" },
  { id: "tm-4", userId: null, email: "priya.shah@northwind.example", name: "Priya Shah", title: "Recruiting Coordinator", role: "Member", status: "Invited" },
];

const challenges = [
  {
    id: "ch-1",
    title: "Hospital bed-occupancy dashboard",
    status: "Published",
    sourceKind: "WorkTrial",
    opensAt: days(-7),
    closesAt: days(14),
    maxParticipants: 60,
    participants: 23,
    schools: [
      { instituteId: INSTITUTE_ID, status: "Approved" },
      { instituteId: OTHER_SCHOOL_ID, status: "Pending" },
    ],
  },
  { id: "ch-2", title: "Clinical data cleanup sprint", status: "Draft", sourceKind: "Sprint", opensAt: days(10), closesAt: days(30), maxParticipants: null, participants: 0, schools: [] },
  { id: "ch-3", title: "Spring analytics challenge", status: "Closed", sourceKind: "Sprint", opensAt: days(-120), closesAt: days(-90), maxParticipants: 40, participants: 1, schools: [{ instituteId: INSTITUTE_ID, status: "Approved" }] },
];

const challengeDetail = (id: string) => {
  const row = challenges.find((c) => c.id === id) ?? challenges[0];
  return {
    challenge: {
      id: row.id,
      title: row.title,
      status: row.status,
      description: "Build a small dashboard that shows bed occupancy by ward from a CSV extract, with tests for the aggregation logic.",
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      externalJobUrl: "https://northwind.example/careers/data-analyst-intern",
      prizeText: "Top three get a mock interview with our analytics team.",
    },
    sprint: { title: "Occupancy dashboard work trial", requiredLanguage: "Python" },
    participants: row.participants,
    schools:
      row.status === "Draft"
        ? []
        : [
            { instituteId: INSTITUTE_ID, school: SCHOOL_NAME, status: "Approved", autoApproved: false, decisionNote: "Shared with our data science students." },
            { instituteId: OTHER_SCHOOL_ID, school: "Ridgeview College", status: "Pending", autoApproved: false, decisionNote: null },
          ],
  };
};

const challengeResults = {
  hiddenWithoutConsent: 4,
  note: "Only students who chose to share their results with your company are listed. Scores come from automated tests; they are not a hiring recommendation.",
  results: [
    { participantId: "p-1", name: "Maya Patel", school: SCHOOL_NAME, degreeLevel: "Bachelor", majors: ["Computer Science"], graduationDate: ymd(220), submissions: 2, score: 92, testsPassed: 18, testsTotal: 20, integrityRiskLevel: "Clear", defended: true, defenseScore: 86, credentialSlug: "cred-7f3a9c21", credentialUnderReview: false, inviteCount: 1 },
    { participantId: "p-2", name: "Marcus Johnson", school: SCHOOL_NAME, degreeLevel: "Master", majors: ["Data Science", "Statistics"], graduationDate: ymd(400), submissions: 1, score: 74, testsPassed: 15, testsTotal: 20, integrityRiskLevel: "Review", defended: false, defenseScore: null, credentialSlug: null, credentialUnderReview: false, inviteCount: 0 },
    { participantId: "p-3", name: "Sofia Ramirez", school: "Ridgeview College", degreeLevel: "Associate", majors: ["Information Technology"], graduationDate: null, submissions: 0, score: null, testsPassed: null, testsTotal: null, integrityRiskLevel: null, defended: false, defenseScore: null, credentialSlug: null, credentialUnderReview: false, inviteCount: 0 },
  ],
};

const evidencePack = {
  candidate: { name: "Maya Patel" },
  tests: { passed: 18, total: 20 },
  defects: [
    { title: "Off-by-one in the weekly window", fixedDefect: true },
    { title: "Null ward codes counted as a ward", fixedDefect: true },
    { title: "Time zone of admission timestamps", fixedDefect: false },
  ],
  integrity: { riskLevel: "Clear", signals: [{ description: "Typing cadence consistent with the rest of the session." }] },
  consistencyNotes: ["The defense answers matched the submitted code."],
  disclaimer: "Signals for people to weigh. Not a hiring recommendation.",
};

const assessments = {
  workTrials: [
    { id: "wt-1", title: "Occupancy dashboard work trial", roleTitle: "Data Analyst Intern", language: "Python", sprintId: "sp-11", validated: true },
    { id: "wt-2", title: "Claims ETL work trial", roleTitle: "Data Engineer", language: "SQL", sprintId: "sp-12", validated: false },
  ],
  ownSprints: [{ id: "sp-21", title: "HL7 message parser", requiredLanguage: "TypeScript" }],
  catalogSprints: [
    { id: "sp-31", title: "REST API with rate limiting", requiredLanguage: "Java" },
    { id: "sp-32", title: "Data cleaning with pandas", requiredLanguage: "Python" },
  ],
};

const ocrBase = {
  instituteId: INSTITUTE_ID,
  school: SCHOOL_NAME,
  employerId: EMPLOYER_ID,
  employerName: "Northwind Analytics",
  description: "30-minute first-round interviews. Bring a laptop if you want to show a project.",
  externalJobSource: "Company careers site",
  virtualUrl: null,
  slotMinutes: 30,
  breakMinutes: 10,
  interviewers: [
    { name: "Luis Ortega", email: "luis.ortega@northwind.example" },
    { name: "Dana Whitfield", email: "dana.whitfield@northwind.example" },
  ],
  workAuthRequirement: "AuthorizedUS",
  workAuthStatement: "Applicants must be authorized to work in the US.",
  cancelCutoffHours: 24,
  createdAt: days(-21),
};

const ocrSchedules = [
  {
    ...ocrBase,
    id: "ocr-1",
    positionTitle: "Data Analyst Intern",
    externalJobUrl: "https://northwind.example/careers/data-analyst-intern",
    externalJobId: "NW-2291",
    virtual: false,
    tracks: 2,
    days: [{ date: ymd(12), start: "09:00", end: "16:00", lunchStart: "12:00", lunchEnd: "13:00" }],
    signupType: "PreSelect",
    degreeLevels: ["Bachelor", "Master"],
    majors: ["Computer Science", "Statistics"],
    gradFrom: ymd(90),
    gradTo: ymd(450),
    signupOpensAt: days(-3),
    signupClosesAt: days(9),
    status: "Published",
    decisionNote: null,
    publishedAt: days(-3),
    extra: { booked: 6, slots: 22 },
  },
  {
    ...ocrBase,
    id: "ocr-2",
    positionTitle: "Software Engineer I",
    externalJobUrl: null,
    externalJobId: null,
    virtual: true,
    virtualUrl: "https://meet.example/northwind-campus",
    tracks: 1,
    days: [
      { date: ymd(25), start: "10:00", end: "15:00", lunchStart: null, lunchEnd: null },
      { date: ymd(26), start: "10:00", end: "15:00", lunchStart: null, lunchEnd: null },
    ],
    signupType: "Open",
    degreeLevels: [],
    majors: [],
    gradFrom: null,
    gradTo: null,
    workAuthRequirement: "None",
    signupOpensAt: null,
    signupClosesAt: null,
    status: "Requested",
    decisionNote: null,
    publishedAt: null,
    extra: { booked: 0, slots: 20 },
  },
  {
    ...ocrBase,
    id: "ocr-3",
    instituteId: OTHER_SCHOOL_ID,
    school: "Ridgeview College",
    positionTitle: "IT Support Associate",
    externalJobUrl: null,
    externalJobId: null,
    virtual: false,
    tracks: 1,
    days: [{ date: ymd(5), start: "13:00", end: "17:00", lunchStart: null, lunchEnd: null }],
    signupType: "Alternates",
    degreeLevels: ["Associate"],
    majors: ["Information Technology"],
    gradFrom: null,
    gradTo: null,
    signupOpensAt: null,
    signupClosesAt: null,
    status: "Declined",
    decisionNote: "Our interview rooms are booked that week. Please pick a date in November.",
    publishedAt: null,
    extra: { booked: 0, slots: 0 },
  },
];

const ocrCandidates = {
  timeZone: "America/Chicago",
  candidates: [
    {
      id: "cand-1",
      source: "PreSelect",
      tier: "Primary",
      status: "Booked",
      invitedEmail: "maya.patel@lakeside.edu",
      packet: {
        released: true,
        name: "Maya Patel",
        email: "maya.patel@lakeside.edu",
        pronouns: "she/her",
        education: [{ schoolName: SCHOOL_NAME, degreeLevel: "Bachelor", majors: ["Computer Science"], graduationDate: ymd(220) }],
        resume: { id: "res-1", fileName: "Maya-Patel-Resume.pdf" },
      },
      booking: { id: "bk-1", startUtc: hours(12 * 24 + 15), endUtc: hours(12 * 24 + 15.5), room: "Career Center Room 204", interviewer: "Luis Ortega", checkedInAt: null, attendance: null, outcome: null, outcomeNote: null },
    },
    {
      id: "cand-2",
      source: "PreSelect",
      tier: "Primary",
      status: "Attended",
      invitedEmail: "marcus.johnson@lakeside.edu",
      packet: {
        released: true,
        name: "Marcus Johnson",
        email: "marcus.johnson@lakeside.edu",
        pronouns: null,
        education: [{ schoolName: SCHOOL_NAME, degreeLevel: "Master", majors: ["Statistics"], graduationDate: null }],
        resume: null,
      },
      booking: { id: "bk-2", startUtc: hours(12 * 24 + 16), endUtc: hours(12 * 24 + 16.5), room: "Career Center Room 206", interviewer: "Dana Whitfield", checkedInAt: hours(12 * 24 + 15.9), attendance: "Attended", outcome: "Pending", outcomeNote: null },
    },
    { id: "cand-3", source: "PreSelect", tier: "Primary", status: "Invited", invitedEmail: "aiden.brooks@lakeside.edu", packet: null, booking: null },
    {
      id: "cand-4",
      source: "PreSelect",
      tier: "Alternate",
      status: "Waitlisted",
      invitedEmail: "hannah.kim@lakeside.edu",
      packet: { released: false, reason: "The student hasn't agreed to share their details yet." },
      booking: null,
    },
  ],
};

// ---------------------------------------------------------------------------------------------------------------
// Faculty
// ---------------------------------------------------------------------------------------------------------------

const program = { id: "prog-1", code: "CS 4950", title: "Computer Science Internship" };

const facultyExperiences = [
  { id: "exp-1001", status: "Evaluations", studentName: "Maya Patel", studentEmail: "maya.patel@lakeside.edu", program, employerName: "Northwind Analytics", roleTitle: "Data Analyst Intern", startDate: ymd(-80), endDate: ymd(5), isF1: false, cptStatus: null, facultyApproved: true, agreementSigned: true, finalGrade: null, submittedAt: days(-100), updatedAt: days(-2) },
  { id: "exp-1002", status: "Submitted", studentName: "Wei Chen", studentEmail: "wei.chen@lakeside.edu", program, employerName: "Great Lakes Health", roleTitle: "Software Engineering Intern", startDate: ymd(30), endDate: ymd(120), isF1: true, cptStatus: "Requested", facultyApproved: false, agreementSigned: false, finalGrade: null, submittedAt: days(-3), updatedAt: days(-3) },
  { id: "exp-1003", status: "Active", studentName: "Aaliyah Thompson", studentEmail: "aaliyah.thompson@lakeside.edu", program: { id: "prog-2", code: "BUS 4900", title: "Business Internship" }, employerName: "Midwest Credit Union", roleTitle: "Marketing Intern", startDate: ymd(-30), endDate: ymd(60), isF1: false, cptStatus: null, facultyApproved: true, agreementSigned: true, finalGrade: null, submittedAt: days(-50), updatedAt: days(-6) },
  { id: "exp-1004", status: "Completed", studentName: "Daniel Okafor", studentEmail: "daniel.okafor@lakeside.edu", program, employerName: "Cedar Valley Software", roleTitle: "QA Intern", startDate: ymd(-200), endDate: ymd(-110), isF1: false, cptStatus: null, facultyApproved: true, agreementSigned: true, finalGrade: "A-", submittedAt: days(-230), updatedAt: days(-100) },
];

const agreementText = `LEARNING AGREEMENT
Student: Maya Patel
Site: Northwind Analytics, Columbus, OH
Role: Data Analyst Intern
Program: CS 4950 Computer Science Internship (3 credit hours, 120 hours)

Learning objectives
1. Build a reproducible data pipeline for hospital occupancy data.
2. Present weekly findings to the analytics team.
3. Write automated tests for data transformations.

The site supervisor agrees to provide a safe workplace, weekly supervision and two evaluations.
The student agrees to log hours weekly and complete two reflections.`;

const experienceDetail = (id: string) => ({
  id,
  status: "Evaluations",
  student: { userId: "stu-1", name: "Maya Patel", email: "maya.patel@lakeside.edu" },
  program: {
    id: "prog-1",
    code: "CS 4950",
    title: "Computer Science Internship",
    description: "Academic credit for a supervised computing internship.",
    creditHours: 3,
    requiredHours: 120,
    requiredDocuments: ["Offer letter", "Job description"],
    midtermForm: [
      { key: "quality", text: "Quality of work", type: "rating" },
      { key: "communication", text: "Communication", type: "rating" },
      { key: "strengths", text: "Main strengths", type: "text" },
    ],
    finalForm: [
      { key: "quality", text: "Quality of work", type: "rating" },
      { key: "initiative", text: "Initiative", type: "rating" },
      { key: "growth", text: "Areas for growth", type: "text" },
    ],
    ratingScaleMax: 5,
    reflectionPrompts: ["What did you learn about working on a data team?", "Which objective was hardest, and why?"],
    facultyApprovers: ["jordan.lee@lakeside.edu"],
    requireCpt: false,
    agreementTerms: null,
    active: true,
  },
  employer: { id: EMPLOYER_ID, name: "Northwind Analytics", website: "https://northwind.example" },
  supervisor: { name: "Luis Ortega", email: "luis.ortega@northwind.example", title: "Engineering Manager", confirmedAt: days(-95) },
  roleTitle: "Data Analyst Intern",
  startDate: ymd(-80),
  endDate: ymd(5),
  hoursPerWeek: 15,
  paid: true,
  location: "Columbus, OH",
  remote: false,
  learningObjectives: ["Build a reproducible data pipeline for hospital occupancy data.", "Present weekly findings to the analytics team.", "Write automated tests for data transformations."],
  cpt: { required: false, isF1: false, status: null, dsoApprovalDate: null, startDate: null, endDate: null, missing: false },
  approvals: { facultyApprovedAt: days(-98), staffApprovedAt: days(-96), declineReason: null },
  agreement: {
    id: "agr-2",
    version: 2,
    text: agreementText,
    sha256: "9f2c4e7a1b3d5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8",
    createdAt: days(-94),
    completedAt: days(-90),
    signatures: [
      { role: "Student", name: "Maya Patel", email: "maya.patel@lakeside.edu", signedAt: days(-93), typedName: "Maya Patel", textSha256: "9f2c4e7a", ip: null, userAgent: null, provider: "Typed" },
      { role: "Supervisor", name: "Luis Ortega", email: "luis.ortega@northwind.example", signedAt: days(-92), typedName: "Luis Ortega", textSha256: "9f2c4e7a", ip: null, userAgent: null, provider: "Typed" },
      { role: "Faculty", name: "Jordan Lee", email: "jordan.lee@lakeside.edu", signedAt: days(-90), typedName: "Jordan Lee", textSha256: "9f2c4e7a", ip: null, userAgent: null, provider: "Typed" },
    ],
    canSign: false,
    pendingRoles: [],
  },
  agreementHistory: [
    { version: 1, sha256: "1a2b3c4d", createdAt: days(-97), voidedAt: days(-94), voidReason: "Hours per week changed", signatures: [{ role: "Student", name: "Maya Patel", signedAt: days(-96), voidedAt: days(-94) }] },
  ],
  hours: [
    { id: "h-1", weekStart: ymd(-21), hours: 15, description: "Built the ward-level occupancy model.", status: "Approved", decisionNote: null, submittedAt: days(-14) },
    { id: "h-2", weekStart: ymd(-14), hours: 16, description: "Wrote tests for the admissions transform.", status: "Approved", decisionNote: null, submittedAt: days(-7) },
    { id: "h-3", weekStart: ymd(-7), hours: 14, description: "Prepared the final presentation.", status: "Pending", decisionNote: null, submittedAt: days(-1) },
    { id: "h-4", weekStart: ymd(-28), hours: 20, description: "Onboarding and data access.", status: "Rejected", decisionNote: "Please split onboarding across the two weeks you did it.", submittedAt: days(-21) },
  ],
  hoursSummary: { approved: 108, pending: 14, required: 120 },
  reflections: [
    { id: "r-1", prompt: "What did you learn about working on a data team?", body: "Code review made my SQL much easier to read. I also learned to ask for the data dictionary first.", facultyComment: "Good habit. Keep it up.", updatedAt: days(-30) },
    { id: "r-2", prompt: "Which objective was hardest, and why?", body: "Presenting weekly findings. I rewrote my slides three times before they were short enough.", facultyComment: null, updatedAt: days(-5) },
  ],
  evaluations: [
    {
      id: "ev-1",
      kind: "Midterm",
      submittedAt: days(-40),
      submittedByName: "Luis Ortega",
      ratingScaleMax: 5,
      comments: "Maya ramps up quickly and asks good questions.",
      questions: [
        { key: "quality", text: "Quality of work", type: "rating" },
        { key: "communication", text: "Communication", type: "rating" },
        { key: "strengths", text: "Main strengths", type: "text" },
      ],
      answers: { quality: 4, communication: 5, strengths: "Careful with data quality." },
    },
    {
      id: "ev-2",
      kind: "Final",
      submittedAt: days(-2),
      submittedByName: "Luis Ortega",
      ratingScaleMax: 5,
      comments: null,
      questions: [
        { key: "quality", text: "Quality of work", type: "rating" },
        { key: "initiative", text: "Initiative", type: "rating" },
        { key: "growth", text: "Areas for growth", type: "text" },
      ],
      answers: { quality: 5, initiative: 4, growth: "Estimating how long tasks take." },
    },
  ],
  documents: [
    { id: "doc-1", kind: "Offer letter", fileName: "Northwind-offer-letter.pdf", uploadedAt: days(-101) },
    { id: "doc-2", kind: "Job description", fileName: "Data-Analyst-Intern-JD.pdf", uploadedAt: days(-101) },
  ],
  missingDocuments: [],
  grade: { finalGrade: null, gradeComment: null, gradedAt: null },
  timeline: [
    { actorName: "Maya Patel", actorRole: "Student", action: "submitted", comment: null, at: days(-100) },
    { actorName: "Jordan Lee", actorRole: "Faculty", action: "faculty.approved", comment: "Fits the program well.", at: days(-98) },
    { actorName: "Career Center", actorRole: "Staff", action: "approved", comment: null, at: days(-96) },
    { actorName: "System", actorRole: "System", action: "agreement.completed", comment: null, at: days(-90) },
    { actorName: "Luis Ortega", actorRole: "Supervisor", action: "evaluation.final", comment: null, at: days(-2) },
  ],
  supervisorLinks: [{ purpose: "FinalEvaluation", issuedAt: days(-10), expiresAt: days(20), lastUsedAt: days(-2), useCount: 2, state: "Used" }],
  canEdit: false,
});

const facultyDefense = {
  experience: { id: "exp-1001", status: "Evaluations", roleTitle: "Data Analyst Intern", employerName: "Northwind Analytics", supervisorName: "Luis Ortega", studentName: "Maya Patel", startDate: ymd(-80), endDate: ymd(5) },
  verification: { status: "Verified", label: "Verified" },
  eligibility: { canStart: false, reason: null },
  options: { writtenAvailable: true, voiceAvailable: true, consentText: "I agree to share my work descriptions and a summary with my site supervisor.", threshold: 70, canOverride: true },
  defense: {
    id: "def-1",
    mode: "Written",
    status: "Decided",
    artifacts: [
      { kind: "repo", title: "Occupancy pipeline", url: "https://git.example.org/mpatel/occupancy-pipeline", description: "Python package that loads nightly census extracts and aggregates occupancy by ward." },
      { kind: "document", title: "Final presentation", url: null, description: "Twelve slides summarizing seasonal occupancy trends for the operations team." },
    ],
    startedAt: days(-6),
    finishedAt: days(-6),
    maxQuestions: 6,
    answered: 6,
    awaitingAnswer: false,
    canFinish: false,
    simulated: false,
    turns: [
      { role: "interviewer", text: "Why did you aggregate by ward instead of by unit?", at: days(-6) },
      { role: "student", text: "Staffing decisions are made per ward, so that is the level the operations team asked for.", at: days(-6) },
    ],
    result: {
      score: 84,
      threshold: 70,
      rubric: { ownership: 88, technicalDepth: 80, decisions: 85, outcomes: 82 },
      evidence: { items: [{ dimension: "decisions", quote: "Staffing decisions are made per ward.", note: "Ties the design to a user need." }], concerns: [] },
      summary: "Clear ownership of the pipeline and good reasoning about trade-offs.",
      graderSource: "model",
      gradedAt: days(-6),
    },
    supervisor: { name: "Luis Ortega", email: "luis.ortega@northwind.example", answer: "Yes", comment: "Maya built this end to end.", answeredByName: "Luis Ortega", answeredAt: days(-4) },
    computedStatus: "Verified",
    overrideInfo: null,
    consent: { consentedAt: days(-6), text: "I agree to share my work descriptions and a summary with my site supervisor.", active: true },
    supervisorLinks: [{ issuedAt: days(-6), expiresAt: days(8), lastUsedAt: days(-4), useCount: 1, state: "Used" }],
  },
  credential: { id: "icred-1", status: "Valid", issuedAt: days(-4), publicUrlSlug: "int-cred-4821", verifyPath: "/verify/internship/int-cred-4821" },
  voice: null,
  devToken: null,
};

const frameworkCatalog = {
  role: "Faculty",
  canEdit: false,
  minCellSize: 5,
  minCellSizeFloor: 5,
  enabled: ["nace", "abet-cs"],
  frameworks: [
    {
      key: "nace",
      name: "NACE Career Readiness Competencies",
      description: "Eight competencies employers look for in new graduates.",
      builtIn: true,
      enabled: true,
      note: "Competency definitions from the National Association of Colleges and Employers.",
      allowsProgramSpecific: false,
      mappingCount: 6,
      outcomes: [
        { code: "CT", title: "Critical thinking" },
        { code: "COM", title: "Communication" },
        { code: "TW", title: "Teamwork" },
      ],
    },
    {
      key: "abet-cs",
      name: "ABET Computing Student Outcomes",
      description: "Student outcomes for accredited computing programs.",
      builtIn: true,
      enabled: true,
      note: "Use with your program's own assessment plan.",
      allowsProgramSpecific: true,
      mappingCount: 0,
      outcomes: [
        { code: "SO1", title: "Analyze a complex computing problem" },
        { code: "SO2", title: "Design and implement a solution" },
      ],
    },
    { key: "custom-1", name: "Lakeside Graduate Attributes", description: "School-defined attributes.", builtIn: false, enabled: false, note: "", allowsProgramSpecific: false, mappingCount: 0, outcomes: [] },
  ],
  sources: [
    { key: "evaluation", label: "Supervisor evaluations", direct: true, refLabel: "Question", description: "Ratings from internship supervisors." },
    { key: "survey", label: "Student self-assessment", direct: false, refLabel: "Survey item", description: "Students rate their own growth." },
  ],
};

const mapping = (id: string, label: string, direct: boolean, assessed: string, at: number | null, percent: number | null, level: number | null, suppressed = false) => ({
  mappingId: id,
  source: direct ? "evaluation" : "survey",
  sourceLabel: label,
  sourceRefLabel: direct ? "Final evaluation: Quality of work" : "Self-assessment item 4",
  direct,
  weight: direct ? 2 : 1,
  targetScore: direct ? 4 : 3,
  level3: 70,
  level2: 60,
  level1: 50,
  assessed,
  atOrAboveTarget: at,
  percent,
  level,
  suppressed,
});

const attainment = (ctx: FixtureContext) => {
  const key = decodeURIComponent(ctx.url.pathname.split("/")[4] ?? "nace");
  const fw = frameworkCatalog.frameworks.find((f) => f.key === key) ?? frameworkCatalog.frameworks[0];
  return {
    framework: { key: fw.key, name: fw.name, note: fw.note },
    options: { programs: ["Computer Science", "Business Administration", "Nursing"], cohorts: ["Spring 2026", "Fall 2026"], terms: ["Summer 2026", "Fall 2026"] },
    minCellSize: 5,
    students: "142",
    outcomes: [
      { code: "CT", title: "Critical thinking", directAttainment: 2.62, indirectAttainment: 2.1, directSuppressed: false, indirectSuppressed: false, mappings: [mapping("m-1", "Supervisor evaluations", true, "96", 71, 74, 3), mapping("m-2", "Student self-assessment", false, "120", 80, 67, 2)] },
      { code: "COM", title: "Communication", directAttainment: 1.84, indirectAttainment: null, directSuppressed: false, indirectSuppressed: true, mappings: [mapping("m-3", "Supervisor evaluations", true, "96", 58, 60, 2), mapping("m-4", "Student self-assessment", false, "4", null, null, null, true)] },
      { code: "TW", title: "Teamwork", directAttainment: 1.2, indirectAttainment: 1.6, directSuppressed: false, indirectSuppressed: false, mappings: [mapping("m-5", "Supervisor evaluations", true, "96", 44, 46, 0)] },
    ],
    groups: [
      { name: "Computer Science", students: "88", outcomes: [{ code: "CT", title: "Critical thinking", directAttainment: 2.71, indirectAttainment: 2.2, directSuppressed: false, indirectSuppressed: false }, { code: "COM", title: "Communication", directAttainment: 1.9, indirectAttainment: null, directSuppressed: false, indirectSuppressed: true }] },
      { name: "Nursing", students: "<5", outcomes: [{ code: "CT", title: "Critical thinking", directAttainment: null, indirectAttainment: null, directSuppressed: true, indirectSuppressed: true }] },
    ],
    note: "Attainment levels: 3 when at least 70% reach the target, 2 at 60%, 1 at 50%, otherwise 0.",
  };
};

// ---------------------------------------------------------------------------------------------------------------
// Alumni (mentoring)
// ---------------------------------------------------------------------------------------------------------------

const mentorProfile = {
  id: "mp-1",
  name: "Jordan Lee",
  kind: "Alumni",
  status: "Approved",
  headline: "Product analyst helping students break into health tech",
  employer: "Great Lakes Health",
  jobTitle: "Senior Product Analyst",
  industry: "Healthcare",
  functions: ["Analytics", "Product"],
  majors: ["Statistics", "Computer Science"],
  topics: ["resume", "interviewing", "industry"],
  meetingPreferences: ["Video", "Email"],
  capacity: 3,
  activeMentees: 1,
  availabilityNotes: "Weekday evenings, Eastern time",
  bio: "Lakeside class of 2016. I moved from hospital operations into analytics and now work on patient scheduling tools.",
  graduationYear: 2016,
  contactEmail: "jordan.lee.alum@example.com",
  contactPhone: null,
  decisionNote: null,
};

const alumniHome = {
  instituteId: INSTITUTE_ID,
  school: SCHOOL_NAME,
  isAlumni: true,
  name: "Jordan Lee",
  profile: mentorProfile,
  counts: { pendingRequests: 1, activeMentees: 1, completed: 4 },
};

const mentoringOptions = {
  topics: [
    { key: "resume", label: "Resumes and cover letters" },
    { key: "interviewing", label: "Interviewing" },
    { key: "industry", label: "Learning about an industry" },
    { key: "grad-school", label: "Graduate school" },
  ],
  meetingFormats: ["Video", "Phone", "InPerson", "Email"],
  reportReasons: ["Inappropriate", "Harassment", "Unresponsive", "Spam", "SafetyConcern", "Other"],
  functions: ["Analytics", "Engineering", "Marketing", "Operations", "Product"],
  industries: ["Healthcare", "Finance", "Manufacturing", "Software", "Education"],
  requireStaffApproval: false,
  maxOpenRequests: 3,
  scoring: "topics+majors",
};

const mentorRelationships = [
  {
    id: "mr-1",
    status: "Requested",
    side: "Mentor",
    mentorProfileId: "mp-1",
    mentorName: "Jordan Lee",
    studentName: "Aaliyah Thompson",
    message: "Hi Jordan, I'm a junior in statistics and want to learn how people move into healthcare analytics. Could we talk once or twice this fall?",
    goals: ["Understand entry-level analytics roles in hospitals", "Get feedback on my resume"],
    matchReasons: ["Statistics major", "Interested in healthcare"],
    mentorNote: null,
    requestedAt: days(-2),
    mentorDecidedAt: null,
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
    id: "mr-2",
    status: "Active",
    side: "Mentor",
    mentorProfileId: "mp-1",
    mentorName: "Jordan Lee",
    studentName: "Wei Chen",
    message: "I'd love advice on preparing for product analyst interviews.",
    goals: ["Practice case interviews", "Build a portfolio project"],
    matchReasons: ["Computer Science major"],
    mentorNote: "Happy to help. Let's start with a mock interview.",
    requestedAt: days(-40),
    mentorDecidedAt: days(-38),
    startedAt: days(-38),
    endedAt: null,
    endReason: null,
    lastActivityAt: days(-25),
    sessions: 2,
    totalMinutes: 75,
    lastSession: ymd(-25),
    checkInDue: true,
    contactShared: true,
  },
  {
    id: "mr-3",
    status: "Completed",
    side: "Mentor",
    mentorProfileId: "mp-1",
    mentorName: "Jordan Lee",
    studentName: "Daniel Okafor",
    message: "Looking for help choosing between two internship offers.",
    goals: ["Decide between offers"],
    matchReasons: [],
    mentorNote: null,
    requestedAt: days(-200),
    mentorDecidedAt: days(-199),
    startedAt: days(-199),
    endedAt: days(-150),
    endReason: "Goals met",
    lastActivityAt: days(-150),
    sessions: 3,
    totalMinutes: 120,
    lastSession: ymd(-152),
    checkInDue: false,
    contactShared: true,
  },
];

const pairDetail = (id: string) => {
  const r = mentorRelationships.find((x) => x.id === id) ?? mentorRelationships[1];
  return {
    relationship: r,
    contact: r.contactShared ? { name: r.studentName, email: `${r.studentName.toLowerCase().replace(/\s+/g, ".")}@lakeside.edu`, phone: null } : null,
    sessions:
      r.sessions > 0
        ? [
            { id: `${r.id}-s1`, occurredOn: ymd(-35), durationMinutes: 45, format: "Video", privateNotes: "Walked through two practice cases.", sharedSummary: "Mock interview practice", loggedByMe: true },
            { id: `${r.id}-s2`, occurredOn: ymd(-25), durationMinutes: 30, format: "Email", privateNotes: null, sharedSummary: null, loggedByMe: false },
          ]
        : [],
    myFeedback: r.status === "Completed" ? { rating: 5, comment: "Great to work with." } : null,
    canLogSession: r.status === "Active",
    canGiveFeedback: false,
  };
};

// ---------------------------------------------------------------------------------------------------------------
// Signed-link pages
// ---------------------------------------------------------------------------------------------------------------

const supervisorExperience = {
  studentName: "Maya Patel",
  employerName: "Northwind Analytics",
  roleTitle: "Data Analyst Intern",
  startDate: ymd(-80),
  endDate: ymd(5),
  hoursPerWeek: 15,
  paid: true,
  location: "Columbus, OH",
  remote: false,
  supervisorName: "Luis Ortega",
  supervisorTitle: "Engineering Manager",
  status: "Active",
  learningObjectives: ["Build a reproducible data pipeline for hospital occupancy data.", "Present weekly findings to the analytics team."],
  program: { code: "CS 4950", title: "Computer Science Internship", creditHours: 3, requiredHours: 120 },
  supervisorConfirmedAt: null,
};

const supervisorView = (ctx: FixtureContext) => {
  const token = lastSegment(ctx);
  const base = { expiresAt: days(14), school: { displayName: SCHOOL_NAME, slug: "lakeside" }, experience: supervisorExperience, agreement: null, hours: null, evaluation: null };
  if (token === "tok-hours") {
    return {
      ...base,
      purpose: "Hours",
      experience: { ...supervisorExperience, supervisorConfirmedAt: days(-95) },
      hours: [
        { id: "h-1", weekStart: ymd(-21), hours: 15, description: "Built the ward-level occupancy model.", status: "Approved", decisionNote: null },
        { id: "h-3", weekStart: ymd(-7), hours: 14, description: "Prepared the final presentation.", status: "Pending", decisionNote: null },
        { id: "h-4", weekStart: ymd(-28), hours: 20, description: "Onboarding and data access.", status: "Rejected", decisionNote: "Please split onboarding across two weeks." },
      ],
    };
  }
  if (token === "tok-eval") {
    return {
      ...base,
      purpose: "FinalEvaluation",
      experience: { ...supervisorExperience, supervisorConfirmedAt: days(-95) },
      evaluation: {
        kind: "Final",
        ratingScaleMax: 5,
        submitted: false,
        canSubmit: true,
        questions: [
          { key: "quality", text: "Quality of work", type: "rating" },
          { key: "initiative", text: "Initiative", type: "rating" },
          { key: "communication", text: "Communication with the team", type: "rating" },
          { key: "growth", text: "Areas for growth", type: "text" },
        ],
      },
    };
  }
  return {
    ...base,
    purpose: "Agreement",
    agreement: {
      version: 2,
      text: agreementText,
      sha256: "9f2c4e7a1b3d5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8",
      signatures: [{ role: "Student", name: "Maya Patel", signedAt: days(-1) }],
      supervisorSigned: false,
      canSign: true,
    },
  };
};

const supervisorDefense = {
  expiresAt: days(10),
  school: { displayName: SCHOOL_NAME, slug: "lakeside" },
  experience: { studentName: "Maya Patel", employerName: "Northwind Analytics", roleTitle: "Data Analyst Intern", startDate: ymd(-80), endDate: ymd(5), supervisorName: "Luis Ortega", supervisorTitle: "Engineering Manager" },
  defense: {
    mode: "Written",
    defendedAt: days(-6),
    artifacts: facultyDefense.defense.artifacts,
    summary: "Maya explained how she designed the occupancy pipeline, why it aggregates by ward, and how she tested the admissions transform. She credited a teammate for the dashboard styling.",
  },
};

const kioskInfo = {
  school: SCHOOL_NAME,
  logoUrl: null,
  primaryColor: "#1d4ed8",
  brandName: "Lakeside Careers",
  showPoweredBy: true,
  sessions: [
    { id: "dropin-1", name: "Resume and cover letter drop-ins", location: "Student Union, Room 210", waiting: 3, estimatedWaitMinutes: 15 },
    { id: "dropin-2", name: "Internship search drop-ins", location: "Career Center front desk", waiting: 0, estimatedWaitMinutes: 5 },
  ],
};

// ---------------------------------------------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------------------------------------------

/** A real ES256 JWS signed offline with a throwaway test key; the JWKS fixture publishes that key so the browser check passes. */
const DEMO_JWS =
  "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImExMXktdGVzdC1rZXktMSJ9.eyJpc3MiOiJodHRwczovL2NyZWRlbnRpYWxzLmV4YW1wbGUub3JnIiwic3ViIjoiY3JlZC03ZjNhOWMyMSIsInR5cCI6IkJ1aWxkRGVmZW5kQ3JlZGVudGlhbCIsIm5hbWUiOiJNYXlhIFBhdGVsIiwidGFzayI6eyJ0aXRsZSI6IlJhdGUtbGltaXRlZCBvcmRlcnMgQVBJIiwidGFza1R5cGUiOiJCYWNrZW5kIiwiYWlQb2xpY3kiOiJBbGxvd2VkIiwibGFuZ3VhZ2UiOiJUeXBlU2NyaXB0In0sInJlc3VsdHMiOnsidGVzdHNQYXNzZWQiOjE4LCJ0ZXN0c1RvdGFsIjoyMCwiZGVmZW5zZVNjb3JlIjo4Ni40LCJkZWZlY3RzRml4ZWQiOjIsImRlZmVjdHNUb3RhbCI6M30sImludGVncml0eSI6Ik5vIGNvbmNlcm5zIiwiaHVtYW5EZWNpc2lvbiI6IkFkdmFuY2VkIiwiZXZpZGVuY2VIYXNoIjoic2hhMjU2OjRiMWU5ZDBjN2EyZjVlOGIzYzZkOWEwZjFlMmIzYzRkNWU2ZjdhOGI5YzBkMWUyZjNhNGI1YzZkN2U4ZjlhMGIiLCJpYXQiOjE3ODkwMDAwMDAsImV4cCI6MTg1MjAwMDAwMH0.V4lcMp_88gjxI5R_kH93I3Fak5D44HyKjKm6xBYeQ1T-RKvZMMgrehTIe1j5_uP9MHCB3-3VbtiGZRWfpEVrrQ";

const DEMO_KID = "a11y-test-key-1";

/** The claims encoded in DEMO_JWS (kept in sync so the page shows the same values the signature covers). */
const demoClaims = {
  iss: "https://credentials.example.org",
  sub: "cred-7f3a9c21",
  typ: "BuildDefendCredential",
  name: "Maya Patel",
  task: { title: "Rate-limited orders API", taskType: "Backend", aiPolicy: "Allowed", language: "TypeScript" },
  results: { testsPassed: 18, testsTotal: 20, defenseScore: 86.4, defectsFixed: 2, defectsTotal: 3 },
  integrity: "No concerns",
  humanDecision: "Advanced",
  evidenceHash: "sha256:4b1e9d0c7a2f5e8b3c6d9a0f1e2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
  iat: 1789000000,
  exp: 1852000000,
};

const jwks = {
  keys: [{ kty: "EC", crv: "P-256", x: "X2Y4P3s6XL1Tfvc4WYZCBq1lyrRsYuYmpq_g29KTq2E", y: "BTt4D4VU6D0HD2CF8LC_BRY6wvpGmdKhz9XCS1sK4Dw", kid: DEMO_KID, alg: "ES256", use: "sig" }],
};

const verifyShare = {
  status: "Valid",
  claims: demoClaims,
  jws: DEMO_JWS,
  issuerKeyId: DEMO_KID,
  alg: "ES256",
  evidence: {
    included: { code: true, recording: false, transcript: true, humanDecision: true },
    codeFiles: [
      { name: "src/rateLimiter.ts", content: "export function allow(key: string, now = Date.now()) {\n  const bucket = buckets.get(key) ?? refill(key, now);\n  if (bucket.tokens < 1) return false;\n  bucket.tokens -= 1;\n  return true;\n}" },
      { name: "src/orders.ts", content: "router.post('/orders', limit(10), async (req, res) => {\n  const order = await createOrder(req.body);\n  res.status(201).json(order);\n});" },
    ],
    recordingUrl: null,
    transcript: "Interviewer: Why a token bucket instead of a fixed window?\nCandidate: A fixed window lets a client send twice the limit across a boundary; the bucket smooths that out.\nInterviewer: How would you share limits across instances?\nCandidate: Move the buckets into Redis and update them with a Lua script so the check and decrement are atomic.",
  },
  share: { recipientLabel: "Northwind Analytics", expiresAt: days(21) },
  issuedAt: new Date(demoClaims.iat * 1000).toISOString(),
  validUntil: new Date(demoClaims.exp * 1000).toISOString(),
  verifiedAt: hours(0),
  disclaimer: "This credential records one task and its defense. It is not a hiring recommendation.",
};

const publicInternship = {
  credentialId: "icred-1",
  status: "Valid",
  issuedAt: days(-4),
  validUntil: days(361),
  revokedAt: null,
  holderName: "Maya Patel",
  title: "Verified internship: Data Analyst Intern",
  roleTitle: "Data Analyst Intern",
  employerName: "Northwind Analytics",
  startDate: ymd(-80),
  endDate: ymd(5),
  school: { displayName: SCHOOL_NAME, slug: "lakeside" },
  defenseScore: 84,
  supervisorConfirmedAt: days(-4),
  decidedByPerson: false,
  disclaimer: "This page confirms that the school verified the internship described here. It does not rate the holder's suitability for any job.",
};

// ---------------------------------------------------------------------------------------------------------------
// Platform admin
// ---------------------------------------------------------------------------------------------------------------

const platformBrands = [
  { id: "br-1", key: "default", displayName: "Career Services", legalName: null, logoUrl: null, primaryColor: "#4338ca", hosts: "careers.example.org", emailFromName: "Career Services", emailFromAddress: "no-reply@careers.example.org", supportEmail: "help@careers.example.org", privacyUrl: "https://careers.example.org/privacy", termsUrl: "https://careers.example.org/terms", showPoweredBy: false, isWhiteLabel: false },
  { id: "br-2", key: "lakeside", displayName: "Lakeside Careers", legalName: "Lakeside State University", logoUrl: null, primaryColor: "#1d4ed8", hosts: "careers.lakeside.edu", emailFromName: "Lakeside Career Center", emailFromAddress: "careers@lakeside.edu", supportEmail: "careers@lakeside.edu", privacyUrl: "https://lakeside.example/privacy", termsUrl: "https://lakeside.example/terms", showPoweredBy: true, isWhiteLabel: true },
];

const platformSchools = [
  { instituteId: INSTITUTE_ID, slug: "lakeside", displayName: SCHOOL_NAME, emailDomains: "lakeside.edu", brandId: "br-2", partnerKey: "seekjobs", partnerOrgId: "org-1042" },
  { instituteId: OTHER_SCHOOL_ID, slug: "ridgeview", displayName: "Ridgeview College", emailDomains: "ridgeview.edu, alumni.ridgeview.edu", brandId: "br-1", partnerKey: null, partnerOrgId: null },
  { instituteId: THIRD_SCHOOL_ID, slug: "northern-plains", displayName: "Northern Plains University", emailDomains: "", brandId: "br-1", partnerKey: null, partnerOrgId: null },
];

const platformEmployers = [
  { id: EMPLOYER_ID, name: "Northwind Analytics", website: "https://northwind.example", emailDomain: "northwind.example", verificationStatus: "DomainVerified", flagReason: null, activeUsers: 4, approvedSchools: 2 },
  { id: "88888888-8888-4888-8888-888888888888", name: "Great Lakes Health", website: "https://greatlakeshealth.example", emailDomain: null, verificationStatus: "Unverified", flagReason: null, activeUsers: 1, approvedSchools: 0 },
  { id: "99999999-9999-4999-8999-999999999999", name: "QuickHire Staffing", website: null, emailDomain: "gmail.com", verificationStatus: "Flagged", flagReason: "Reports of fee-based job offers", activeUsers: 2, approvedSchools: 0 },
];

const sponsorMeta = {
  lastUpdated: days(-9),
  fiscalYears: [2026, 2025, 2024],
  employers: 61842,
  disclaimer: "Past Labor Condition Applications show an employer filed for H-1B workers; they don't promise sponsorship for any job.",
  source: "U.S. Department of Labor, OFLC LCA disclosure data",
};

const sponsorImports = [
  {
    id: "imp-1",
    fileName: "LCA_Disclosure_Data_FY2026_Q3.csv",
    sizeBytes: 412_000_000,
    status: "Completed",
    fallbackFiscalYear: null,
    columnsUsed: { CaseNumber: "CASE_NUMBER", EmployerName: "EMPLOYER_NAME", CaseStatus: "CASE_STATUS" },
    rowsRead: 512_340,
    rowsImported: 509_118,
    rowsSkipped: 3_222,
    skipReasons: { "missing employer name": 2_100, "withdrawn case": 1_122 },
    fiscalYears: [2026],
    error: null,
    createdAt: days(-9),
    startedAt: days(-9),
    completedAt: days(-9),
  },
  {
    id: "imp-2",
    fileName: "lca_fy2025_export.xlsx.csv",
    sizeBytes: 2_400_000,
    status: "Failed",
    fallbackFiscalYear: 2025,
    columnsUsed: {},
    rowsRead: 0,
    rowsImported: 0,
    rowsSkipped: 0,
    skipReasons: {},
    fiscalYears: [],
    error: "No case number column was found. Add a column mapping and try again.",
    createdAt: days(-30),
    startedAt: days(-30),
    completedAt: days(-30),
  },
];

const sponsorColumns = {
  fields: [
    { field: "CaseNumber", required: true, aliases: ["CASE_NUMBER", "Case Number"] },
    { field: "EmployerName", required: true, aliases: ["EMPLOYER_NAME", "Employer"] },
    { field: "CaseStatus", required: false, aliases: ["CASE_STATUS", "Status"] },
  ],
  note: "Column names are matched without regard to case or spaces.",
};

const partnerKeys = {
  notice: "Proposal: not active until partner agreement.",
  items: [
    { id: "pk-1", partnerName: "SeekJobs (pilot)", keyPrefix: "pk_live_7Hq2", createdAt: days(-40), lastUsedAt: days(-1), useCount: 18_204, revokedAt: null, active: true },
    { id: "pk-2", partnerName: "Old test key", keyPrefix: "pk_test_Zx91", createdAt: days(-200), lastUsedAt: days(-150), useCount: 37, revokedAt: days(-120), active: false },
  ],
};

// ---------------------------------------------------------------------------------------------------------------

export const otherFixtures: ApiFixture[] = [
  // Employer
  { path: /^\/api\/career\/employer\/[^/]+\/schools$/, body: employerSchools },
  { path: /^\/api\/career\/employer\/[^/]+\/team$/, body: team },
  { method: "POST", path: /^\/api\/career\/employer\/[^/]+\/team\/invites\/[^/]+\/resend$/, body: { notified: true, message: "Reminder sent." } },
  { path: "/api/career/schools", body: searchSchools },
  { path: /^\/api\/career\/challenges\/employer\/[^/]+\/assessments$/, body: assessments },
  { path: /^\/api\/career\/challenges\/employer\/[^/]+\/[^/]+\/results$/, body: challengeResults },
  { path: /^\/api\/career\/challenges\/employer\/[^/]+\/[^/]+\/participants\/[^/]+\/evidence$/, body: evidencePack },
  { path: /^\/api\/career\/challenges\/employer\/[^/]+\/[^/]+$/, body: (ctx: FixtureContext) => challengeDetail(lastSegment(ctx)) },
  { path: /^\/api\/career\/challenges\/employer\/[^/]+$/, body: challenges },
  { method: "POST", path: /^\/api\/career\/challenges\/employer\/[^/]+$/, body: { challenge: { id: "ch-new" } } },
  { path: /^\/api\/career\/ocr\/employer\/[^/]+\/schedules$/, body: ocrSchedules },
  { path: /^\/api\/career\/ocr\/employer\/[^/]+\/schedules\/[^/]+\/candidates$/, body: ocrCandidates },
  { method: "POST", path: /^\/api\/career\/ocr\/employer\/[^/]+\/schedules\/[^/]+\/preselect$/, body: { added: 2, alreadyListed: 0, notMatched: [] } },
  { path: /^\/api\/career\/ocr\/employer\/[^/]+\/schedules\/[^/]+\/candidates\/[^/]+\/resume$/, contentType: "application/pdf", body: "%PDF-1.4\n%a11y\n" },

  // Faculty
  { path: "/api/career/experiences/faculty/experiences", body: (ctx: FixtureContext) => {
    const status = ctx.url.searchParams.get("status");
    return status ? facultyExperiences.filter((x) => x.status === status) : facultyExperiences;
  } },
  { path: /^\/api\/career\/experiences\/faculty\/experiences\/[^/]+$/, body: (ctx: FixtureContext) => experienceDetail(lastSegment(ctx)) },
  { path: /^\/api\/career\/internship-defense\/faculty\/[^/]+$/, body: facultyDefense },
  { path: /^\/api\/career\/experiences\/documents\/[^/]+$/, contentType: "application/pdf", body: "%PDF-1.4\n%a11y\n" },
  { path: "/api/career/frameworks", body: frameworkCatalog },
  { path: /^\/api\/career\/frameworks\/[^/]+\/attainment$/, body: attainment },
  { path: /^\/api\/career\/frameworks\/[^/]+\/attainment\.csv$/, contentType: "text/csv", body: "outcome,overall\nCT,2.62\nCOM,1.84\nTW,1.20\n" },
  { path: /^\/api\/career\/frameworks\/[^/]+\/report\.html$/, contentType: "text/html", body: "<!doctype html><html lang=\"en\"><head><title>Attainment report</title></head><body><h1>Attainment report</h1></body></html>" },

  // Alumni
  { path: "/api/career/mentoring/alumni/home", body: alumniHome },
  { path: "/api/career/mentoring/options", body: mentoringOptions },
  { path: "/api/career/mentoring/mentor/relationships", body: mentorRelationships },
  { path: /^\/api\/career\/mentoring\/relationships\/[^/]+$/, when: (ctx: FixtureContext) => ctx.persona === "alumni", body: (ctx: FixtureContext) => pairDetail(lastSegment(ctx)) },

  // Signed-link pages
  { path: /^\/api\/career\/experiences\/supervisor\/[^/]+$/, body: supervisorView },
  { path: /^\/api\/career\/internship-defense\/supervisor\/[^/]+$/, body: supervisorDefense },
  { path: /^\/api\/career\/appointments\/public\/kiosk\/[^/]+$/, body: kioskInfo },
  { method: "POST", path: /^\/api\/career\/appointments\/public\/kiosk\/[^/]+\/check-in$/, body: { queueNumber: 14, ahead: 2, estimatedWaitMinutes: 15 } },
  {
    path: /^\/api\/career\/messaging\/unsubscribe\/[^/]+$/,
    body: { school: { displayName: SCHOOL_NAME, slug: "lakeside" }, category: "Events", email: "maya.patel@lakeside.edu", unsubscribed: [] },
  },

  // Verify
  { path: "/.well-known/edulexa-credential-keys.json", body: jwks },
  { method: "POST", path: "/api/verify/jws", body: { valid: true, error: null, keyId: DEMO_KID, claims: demoClaims, revoked: false, expired: false, status: "Valid", checkedAt: hours(0) } },
  { method: "POST", path: "/api/verify/ob3", body: { valid: false, status: "Invalid", error: "The signature does not match the issuer's published key.", problems: [] } },
  { path: /^\/api\/career\/internship-defense\/public\/[^/]+$/, body: publicInternship },
  { path: /^\/api\/verify\/[^/]+$/, body: verifyShare },

  // Platform admin
  { path: "/api/career/platform/brands", body: platformBrands },
  { path: "/api/career/platform/schools", body: platformSchools },
  { path: "/api/career/platform/employers", body: platformEmployers },
  { path: "/api/career/international/admin/sponsor-meta", body: sponsorMeta },
  { path: "/api/career/international/admin/sponsor-imports", body: sponsorImports },
  { path: "/api/career/international/admin/sponsor-columns", body: sponsorColumns },
  { path: "/api/career/international/admin/partner-keys", body: partnerKeys },
  { method: "POST", path: "/api/career/international/admin/partner-keys", body: { apiKey: "pk_live_a11yDemoKey0000000000000000" } },

  // Login
  { path: "/api/sso/discovery", body: { domain: "lakeside.edu", organizationName: SCHOOL_NAME, protocol: "saml", defaultRole: "Candidate", ssoEnabled: true } },

  // Shared signed-in-required state (components/SignInRequired): the API refuses the session (401) or the role (403)
  { path: /^\/api\/passport(\/radar)?$/, status: 401, body: { message: "Unauthorized" } },
  { path: "/api/leaderboard", status: 403, body: { message: "Forbidden" } },
];

export const otherRoutes: A11yRoute[] = [
  // Employer
  { name: "employer-home", path: "/employer", persona: "employer" },
  { name: "employer-challenges", path: "/employer/challenges", persona: "employer", ready: 'button:has-text("Manage")' },
  { name: "employer-company", path: "/employer/company", persona: "employer" },
  { name: "employer-interviews", path: "/employer/interviews", persona: "employer", ready: 'button:has-text("Candidates and details")' },
  { name: "employer-notifications", path: "/employer/notifications", persona: "employer" },
  { name: "employer-schools", path: "/employer/schools", persona: "employer", ready: "table" },
  { name: "employer-team", path: "/employer/team", persona: "employer", ready: 'li:has-text("Priya Shah")' },

  // Faculty
  { name: "faculty-home", path: "/faculty", persona: "faculty" },
  { name: "faculty-experiences", path: "/faculty/experiences", persona: "faculty", ready: "table" },
  { name: "faculty-experience-detail", path: "/faculty/experiences/exp-1001", persona: "faculty", ready: 'h2:has-text("Internship defense and verification")' },
  { name: "faculty-frameworks", path: "/faculty/frameworks", persona: "faculty", ready: 'table:has-text("Critical thinking")' },
  { name: "faculty-notifications", path: "/faculty/notifications", persona: "faculty" },

  // Alumni
  { name: "alumni-home", path: "/alumni", persona: "alumni" },
  { name: "alumni-mentoring", path: "/alumni/mentoring", persona: "alumni", ready: 'button:has-text("Wei Chen")' },

  // Signed links (no sign-in)
  { name: "supervisor-agreement", path: "/supervisor/tok-demo", persona: "public", ready: 'h1:has-text("Learning agreement for")' },
  { name: "supervisor-hours", path: "/supervisor/tok-hours", persona: "public", ready: 'h1:has-text("Hours for")' },
  { name: "supervisor-evaluation", path: "/supervisor/tok-eval", persona: "public", ready: 'h1:has-text("Final evaluation for")' },
  { name: "supervisor-defense", path: "/supervisor/defense/tok-demo", persona: "public", ready: 'h1:has-text("Maya Patel")' },
  { name: "kiosk", path: "/kiosk/tok-demo", persona: "public" },
  { name: "career-unsubscribe", path: "/career-unsubscribe/tok-demo", persona: "public", ready: 'p:has-text("Address:")' },
  { name: "partner-callback", path: "/partner/callback", persona: "public" },

  // Verify
  { name: "verify-jws", path: "/verify", persona: "public" },
  { name: "verify-token", path: "/verify/share-demo", persona: "public", ready: 'text=Signature verified' },
  { name: "verify-internship", path: "/verify/internship/int-cred-4821", persona: "public", ready: 'dt:has-text("Holder")' },

  // Platform admin
  { name: "admin-career", path: "/admin/career", persona: "admin", ready: 'table:has-text("Ridgeview College")' },
  { name: "admin-career-sponsors", path: "/admin/career/sponsors", persona: "admin", ready: 'table:has-text("LCA_Disclosure_Data_FY2026_Q3.csv")' },

  // Login
  { name: "login", path: "/login", persona: "public" },
  { name: "login-sso", path: "/login/sso", persona: "public" },
  { name: "login-signup", path: "/login?mode=signup&redirect_url=%2Fcredentials", persona: "public" },

  // Shared signed-in-required state on an older page (session ended, then a role that can't use the page)
  { name: "access-notice-signin", path: "/passport", persona: "student", ready: '[data-access-notice="signin"] h1' },
  { name: "access-notice-forbidden", path: "/leaderboard", persona: "student", ready: '[data-access-notice="forbidden"] h1' },
];
