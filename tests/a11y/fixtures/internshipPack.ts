/**
 * Fixtures for G2 country internship packs (India: UGC/AICTE): the career-center "Country pack" tab, the pack card on
 * the student, career-center and faculty internship pages, and the supervisor's logbook sign-off link.
 * Listed first in index.ts so the supervisor logbook token is answered here.
 */
import type { A11yRoute, ApiFixture, FixtureContext } from "./types";
import { days, SCHOOL_NAME } from "./types";

const ymd = (n: number) => days(n).slice(0, 10);
const monday = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const plus = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const sources = [
  { id: "ugc-internship-2024", title: "Guidelines for Internship/Research Internship for Under Graduate Students", issuer: "University Grants Commission (UGC)", url: "https://www.ugc.gov.in/pdfnews/2051511_Internship-Research-Internship-Guidelines.pdf", date: "2023 (listed 02/02/2024)", status: "Verified", note: "No numeric weightage or templates." },
  { id: "aicte-policy-2019", title: "AICTE Internship Policy (revised, 02.04.2019)", issuer: "All India Council for Technical Education (AICTE)", url: "https://aicte.gov.in/sites/default/files/Aicte%20Internship%20Policy-%2002.04.2019.pdf", date: "2 April 2019", status: "Verified", note: null },
  { id: "aicte-internship-portal", title: "AICTE Internship Portal", issuer: "All India Council for Technical Education (AICTE)", url: "https://internship.aicte-india.org/", date: "accessed 11 Oct 2026", status: "Unconfirmed", note: "No published list of reporting fields." },
];

const hourRules = [
  { key: "ugc-ug-internship", label: "UGC UG internship (3-year UG, 4-year UG Honours or Honours with Research)", regulator: "UGC", programmeType: "UG degree (NEP 2020 / CCFUP)", minHours: 60, maxHours: 120, minCredits: 2, maxCredits: 4, hoursPerCredit: 30, timing: "After the 4th semester", mandatory: true, status: "Verified", sources: ["ugc-internship-2024"], note: "An internship of 60 to 120 hours after the 4th semester is mandatory; one credit = 30 hours.", overridden: false },
  { key: "aicte-be-btech", label: "AICTE internship for B.E./B.Tech", regulator: "AICTE", programmeType: "B.E./B.Tech (4-year engineering degree)", minHours: 640, maxHours: 900, minCredits: 14, maxCredits: 20, hoursPerCredit: 45, timing: "Summer/winter breaks after semesters 2–6", mandatory: true, status: "Verified", sources: ["aicte-policy-2019"], note: "14–20 credits; 1 credit is at least 45 hours.", overridden: true },
];

const documents = [
  { key: "offer-letter", name: "Offer letter", stage: "BeforeApproval", issuer: "Organization", required: true, templateKey: null, status: "Verified", sources: ["ugc-internship-2024"], note: null },
  { key: "noc", name: "No Objection Certificate (NOC)", stage: "BeforeApproval", issuer: "Institution", required: true, templateKey: "noc", status: "Verified", sources: ["aicte-policy-2019"], note: "Issued by the training and placement cell." },
  { key: "internship-report", name: "Internship report", stage: "AtCompletion", issuer: "Student", required: true, templateKey: null, status: "Verified", sources: ["ugc-internship-2024"], note: null },
  { key: "org-certificate", name: "Internship certificate from the organization", stage: "AtCompletion", issuer: "Organization", required: true, templateKey: null, status: "Verified", sources: ["aicte-policy-2019"], note: null },
];

const logFields = [
  { key: "tasks", label: "Work done (summary for the week)", required: true, maxLength: 4000 },
  { key: "learning", label: "What I learned / skills used", required: true, maxLength: 4000 },
  { key: "challenges", label: "Problems faced and how they were handled", required: false, maxLength: 4000 },
  { key: "nextPlan", label: "Plan for next week", required: false, maxLength: 2000 },
];

const facultyForm = {
  key: "institute-panel",
  kind: "Faculty",
  title: "Institute evaluation (seminar presentation / viva-voce)",
  scaleMax: 10,
  criteria: [
    { key: "content", text: "Quality of content presented", weight: 20, type: "rating" },
    { key: "planning", text: "Proper planning for presentation", weight: 20, type: "rating" },
    { key: "effectiveness", text: "Effectiveness of presentation", weight: 20, type: "rating" },
    { key: "depth", text: "Depth of knowledge and skills", weight: 20, type: "rating" },
    { key: "records", text: "Attendance record, daily diary and internship report", weight: 20, type: "rating" },
  ],
  status: "Verified",
  sources: ["aicte-policy-2019"],
  note: "Equal weights are a default; neither regulator sets per-criterion weights.",
};

const flags = {
  stipendTracked: true,
  insuranceRequired: true,
  currency: "INR",
  internshipTypes: ["Industry", "Government", "NGO", "MSME", "Research"],
  stipendNote: "No stipend is mandated for credit internships.",
  insuranceNote: "AICTE asks institutions to ensure insurance of all students.",
  sources: ["aicte-policy-2019"],
};

const packDefinition = {
  key: "in-ugc-aicte",
  version: "2026.10.1",
  country: "IN",
  countryName: "India",
  regulators: ["UGC", "AICTE"],
  title: "India: UGC and AICTE internships",
  summary: "UGC's mandatory 60–120-hour internship for UG degrees and AICTE's 14–20-credit internship for B.E./B.Tech, with a daily diary, supervisor sign-off and regulator exports.",
  reviewedOn: "2026-10-11",
  hourRules,
  documents,
  logbook: { frequency: "Daily", allowedFrequencies: ["Daily", "Weekly"], supervisorSignOff: true, facultyReview: true, fields: logFields, status: "Verified", sources: ["aicte-policy-2019"], note: "AICTE requires a daily diary; weekly supervisor sign-off is this product's design." },
  supervisorEvaluation: { ...facultyForm, key: "aicte-industry-supervisor", kind: "Supervisor", title: "Industry supervisor evaluation (AICTE format)" },
  facultyEvaluation: facultyForm,
  supervisorWeight: 70,
  facultyWeight: 30,
  flags,
  templates: [
    { key: "noc", title: "No Objection Certificate", text: "This is to certify that {{studentName}} has been permitted to undertake an internship at {{organization}}.", status: "Template", note: "Generic wording; edit it to match your letterhead." },
    { key: "agreement-terms", title: "Internship agreement terms", text: "1. The student keeps a daily diary.\n2. The organization issues an internship certificate.", status: "Template", note: "Added to the learning agreement." },
  ],
  exports: [
    { key: "register", title: "Internship register (UGC/AICTE records)", description: "One row per internship with hours, evaluation, grade and certificate.", status: "Unconfirmed", sources: ["aicte-internship-portal"] },
    { key: "credits", title: "Credit summary (for Academic Bank of Credits preparation)", description: "Completed internships with verified hours and credit equivalent.", status: "Unconfirmed", sources: ["aicte-internship-portal"] },
  ],
  sources,
  reflectionPrompts: ["What did you learn?"],
  notes: ["Recheck the rules each academic year.", "Unconfirmed: the ABC upload format."],
};

const settings = {
  selected: { key: "in-ugc-aicte", reviewedVersion: "2026.10.1", latestVersion: "2026.10.1", newVersionAvailable: false, updatedAt: days(-3) },
  effective: packDefinition,
  overrides: { hourRules: { "aicte-be-btech": { minHours: 640 } }, certificateSignatory: "Dr. A. Rao", certificateSignatoryTitle: "Training and Placement Officer" },
  programs: [
    { id: "prog-ug", code: "BSC-INT", title: "B.Sc. internship (UGC)", creditHours: 2, requiredHours: 60, active: true, ruleKey: "ugc-ug-internship", belowMinimum: false },
    { id: "prog-bt", code: "BTECH-INT", title: "B.Tech internship", creditHours: 14, requiredHours: 500, active: true, ruleKey: "aicte-be-btech", belowMinimum: true },
    { id: "prog-x", code: "CS 4950", title: "Computer Science Internship", creditHours: 3, requiredHours: 120, active: true, ruleKey: null, belowMinimum: false },
  ],
  catalog: [
    { key: "in-ugc-aicte", version: "2026.10.1", countryName: "India", regulators: ["UGC", "AICTE"], title: "India: UGC and AICTE internships", summary: "", unconfirmed: 0 },
    { key: "custom", version: "1.0.0", countryName: "Any country", regulators: [], title: "School-defined internship pack", summary: "", unconfirmed: 0 },
  ],
  canEdit: true,
};

const w1 = monday(-21), w2 = monday(-14), w3 = monday(-7);
const weeks = [
  { hourLogId: "h-3", weekStart: w3, hours: 20, status: "Pending", decisionNote: null, days: [0, 1, 2].map((i) => ({ date: plus(w3, i), hours: [7, 7, 6][i], activity: ["Profiling the export job", "Pairing on SQL", "Writing tests"][i] })), tasks: "Optimised the report export.", learning: "Query plans and indexes.", challenges: null, nextPlan: "Ship the export.", supervisorSignedName: null, supervisorSignedAt: null, facultyStatus: "Pending", facultyNote: null, facultyReviewedAt: null },
  { hourLogId: "h-2", weekStart: w2, hours: 20, status: "Approved", decisionNote: null, days: [0, 1, 2].map((i) => ({ date: plus(w2, i), hours: [8, 8, 4][i], activity: "Reporting module" })), tasks: "Built the reporting module.", learning: "SQL window functions.", challenges: "Flaky test data.", nextPlan: null, supervisorSignedName: "Pat Kulkarni", supervisorSignedAt: days(-9), facultyStatus: "Pending", facultyNote: null, facultyReviewedAt: null },
  { hourLogId: "h-1", weekStart: w1, hours: 20, status: "Approved", decisionNote: null, days: [], tasks: "Onboarding and data access.", learning: "The team's code review process.", challenges: null, nextPlan: null, supervisorSignedName: "Pat Kulkarni", supervisorSignedAt: days(-16), facultyStatus: "Approved", facultyNote: "Good detail.", facultyReviewedAt: days(-15) },
];

const packView = (ctx: FixtureContext) => {
  const scope = ctx.url.pathname.split("/")[5];
  return {
    pack: { key: "in-ugc-aicte", version: "2026.10.1", title: "India: UGC and AICTE internships", country: "IN", countryName: "India", regulators: ["UGC", "AICTE"], frozen: true },
    rule: hourRules[0],
    program: { id: "prog-ug", code: "BSC-INT", title: "B.Sc. internship (UGC)", requiredHours: 60, creditHours: 2 },
    progress: { required: 60, supervisorApproved: 40, facultyVerified: 20, pending: 20, returned: 0, creditEquivalent: 0, meetsRequirement: false, belowRegulatorMinimum: false },
    evaluation: {
      supervisorPercent: null,
      facultyPercent: 80,
      combinedPercent: null,
      supervisorWeight: 70,
      facultyWeight: 30,
      facultyForm,
      faculty: { criteria: facultyForm.criteria, scores: { content: 8, planning: 7, effectiveness: 9, depth: 8, records: 8 }, weightedPercent: 80, comments: "Good viva.", evaluatorName: "Dr. Meera Iyer", submittedAt: days(-2), updatedAt: days(-2) },
      canSubmitFaculty: scope === "faculty",
    },
    logbook: { frequency: "Daily", fields: logFields, status: "Verified", note: "AICTE requires a daily diary; weekly supervisor sign-off is this product's design.", canLog: scope === "mine", canReview: scope === "faculty", weeks },
    details: { internshipType: "Industry", stipendPaid: true, stipendMonthly: 8000, stipendCurrency: "INR", insuranceCovered: true, insuranceProvider: "Group Mediclaim", insurancePolicyNumber: "GM-123", canEdit: scope !== "faculty" },
    flags,
    documents: documents.map((d, i) => ({ ...d, done: i < 2, generated: d.issuer === "Institution" })),
    checklist: [
      { key: "rule", label: "Hour rule assigned to the program", done: true, note: hourRules[0].label },
      { key: "documents", label: "Required documents", done: false, note: "Internship report, Internship certificate from the organization" },
      { key: "agreement", label: "Learning agreement signed by all parties", done: true, note: null },
      { key: "stipend", label: "Stipend recorded", done: true, note: null },
      { key: "insurance", label: "Insurance cover confirmed", done: true, note: null },
      { key: "logbook", label: "Logbook weeks signed off by the supervisor", done: false, note: "2 of 3 weeks" },
      { key: "hours", label: "Faculty-verified hours meet the requirement", done: false, note: "20 of 60" },
      { key: "supervisor-evaluation", label: "Supervisor final evaluation received", done: false, note: null },
      { key: "faculty-evaluation", label: "Faculty evaluation submitted", done: true, note: null },
      { key: "grade", label: "Grade recorded", done: false, note: null },
      { key: "certificate", label: "Completion certificate issued", done: false, note: null },
    ],
    noc: { available: true, name: "No Objection Certificate (NOC)", issuedAt: days(-40), canIssue: scope === "staff" },
    certificate: { eligible: false, number: null, issuedAt: null, sha256: null, canIssue: false, reason: "The certificate is available once the internship is graded and complete." },
    sources,
  };
};

const supervisorLogbook = {
  purpose: "Hours",
  expiresAt: days(20),
  school: { displayName: SCHOOL_NAME, slug: "lakeside" },
  experience: {
    studentName: "Asha Sharma",
    employerName: "Infotech Pvt Ltd",
    roleTitle: "Software Intern",
    startDate: ymd(-25),
    endDate: ymd(10),
    hoursPerWeek: 20,
    paid: true,
    location: "Pune, Maharashtra",
    remote: false,
    supervisorName: "Pat Kulkarni",
    supervisorTitle: "Engineering Manager",
    status: "Active",
    learningObjectives: ["Build a reporting feature"],
    program: { code: "BSC-INT", title: "B.Sc. internship (UGC)", creditHours: 2, requiredHours: 60 },
    supervisorConfirmedAt: days(-30),
  },
  agreement: null,
  evaluation: null,
  hours: weeks.map((w) => ({ id: w.hourLogId, weekStart: w.weekStart, hours: w.hours, description: w.tasks, status: w.status, decisionNote: w.decisionNote })),
  logbook: weeks.map((w) => ({ hourLogId: w.hourLogId, days: w.days, tasks: w.tasks, learning: w.learning, challenges: w.challenges, nextPlan: w.nextPlan, supervisorSignedName: w.supervisorSignedName, supervisorSignedAt: w.supervisorSignedAt })),
};

export const internshipPackFixtures: ApiFixture[] = [
  { path: "/api/career/experiences/pack/settings", body: settings },
  { method: "PUT", path: "/api/career/experiences/pack/settings", body: settings },
  { path: "/api/career/experiences/pack/catalog", body: settings.catalog },
  { path: /^\/api\/career\/experiences\/pack\/catalog\/[^/]+$/, body: packDefinition },
  { method: "POST", path: "/api/career/experiences/pack/programs", body: { program: { id: "prog-new" }, ruleKey: "ugc-ug-internship" } },
  { path: "/api/career/experiences/pack/export.csv", contentType: "text/csv", body: "Internship Id,Student name\n1,Asha Sharma\n" },
  { path: /^\/api\/career\/experiences\/pack\/[a-z]+\/[^/]+\/[a-z]+\.pdf$/, contentType: "application/pdf", body: "%PDF-1.4\n%a11y\n" },
  { path: /^\/api\/career\/experiences\/pack\/(mine|staff|faculty)\/[^/]+$/, body: packView },
  { method: "*", path: /^\/api\/career\/experiences\/pack\/(mine|staff|faculty)\/[^/]+\/.+$/, body: packView },
  { path: /^\/api\/career\/experiences\/supervisor\/tok-logbook$/, body: supervisorLogbook },
];

export const internshipPackRoutes: A11yRoute[] = [
  { name: "cc-experiences-pack", path: "/career-center/experiences#country-pack", persona: "career-center", ready: 'h2:has-text("Hour rules and programs")' },
  { name: "cc-experience-detail-pack", path: "/career-center/experiences/exp-eval", persona: "career-center", ready: 'h2:has-text("Internship requirements")' },
  { name: "student-experience-pack", path: "/student/experiences/exp-1", persona: "student", ready: 'h2:has-text("Internship requirements")' },
  { name: "faculty-experience-pack", path: "/faculty/experiences/exp-1001", persona: "faculty", ready: 'h2:has-text("Internship requirements")' },
  { name: "supervisor-logbook", path: "/supervisor/tok-logbook", persona: "public", ready: 'h1:has-text("Hours for")' },
];
