/**
 * Fixtures for H1 campus drives: the employer's jobs and drives, the placement office's approvals queue and drive page,
 * and the student job board and applications. Shapes follow the interfaces each page casts its response to.
 */
import type { A11yRoute, ApiFixture, FixtureContext } from "./types";
import { days, EMPLOYER_ID, INSTITUTE_ID, SCHOOL_NAME } from "./types";

const JOB_ID = "a1a1a1a1-0000-4000-8000-000000000001";
const DRIVE_ID = "a1a1a1a1-0000-4000-8000-000000000002";
const PENDING_ID = "a1a1a1a1-0000-4000-8000-000000000003";
const R1 = "a1a1a1a1-0000-4000-8000-000000000011";
const R2 = "a1a1a1a1-0000-4000-8000-000000000012";

const criteria = { batches: [2026], degrees: ["B.Tech"], branches: ["Computer Science and Engineering"], minCgpa: 7, maxActiveBacklogs: 0, maxTotalBacklogs: null, minClass10Percent: 60, minClass12Percent: null, criteriaNotes: null, excludePlaced: false };

const job = {
  id: JOB_ID, employerId: EMPLOYER_ID, companyName: "Northwind Analytics", origin: "Employer", title: "Software Engineer", jobType: "FullTime",
  description: "Build data products for Indian small businesses.", locations: ["Bengaluru", "Pune"], ctcAnnual: 1200000, ctcDisplay: "₹12 lakh", stipendMonthly: null,
  ctcNotes: "Fixed 10 L + 2 L variable", degrees: ["B.Tech"], branches: ["Computer Science and Engineering"], batches: [2026], minCgpa: 7, maxActiveBacklogs: 0,
  rounds: ["Online test", "Technical interview"], requiredDocuments: ["Resume"], applicationMode: "Apply", applyDeadline: days(10), visibility: "Targeted",
  status: "Published", premiumVisibility: false, source: "Edulexa", hireStatus: "Open",
};

const drive = (id: string, approvalStatus: string) => ({
  id, instituteId: INSTITUTE_ID, school: SCHOOL_NAME, companyName: "Northwind Analytics", title: "Software Engineer", jobType: "FullTime", driveDate: days(20).slice(0, 10),
  mode: "OnCampus", location: "Bengaluru", status: "Planned", criteria, origin: "Employer", jobId: JOB_ID, employerId: EMPLOYER_ID, approvalStatus,
  approvalNote: approvalStatus === "Approved" ? "Welcome to campus" : null, autoApproved: false, applicationsOpen: approvalStatus === "Approved", applyDeadline: days(10),
  tier: "Dream", ctcAnnual: 1200000, ctcDisplay: "₹12 lakh",
});

const rounds = [
  { id: R1, sequence: 1, name: "Online test", roundDate: null, ocrScheduleId: null, shortlisted: 2, pending: 0, cleared: 2, notCleared: 0, slots: 0 },
  { id: R2, sequence: 2, name: "Technical interview", roundDate: null, ocrScheduleId: null, shortlisted: 2, pending: 2, cleared: 0, notCleared: 0, slots: 2 },
];

const applicant = (n: number, name: string, status: string, cgpa: number, offer = false) => ({
  id: `app-${n}`, status, released: true, mode: "Apply", eligibilityAtApply: "eligible", eligibilityNow: "eligible", reasons: [],
  membershipId: `m-${n}`,
  student: { name, email: `${name.split(" ")[0].toLowerCase()}@college.example.in`, rollNumber: `RN00${n}`, degree: "B.Tech", branch: "Computer Science and Engineering", batch: 2026, cgpa, activeBacklogs: 0, class10Percent: 90, class12Percent: 86 },
  documents: [{ fileId: `f-${n}`, kind: "Resume", fileName: `${name.split(" ")[0]}_resume.pdf` }],
  progress: {
    rounds: [{ roundId: R1, result: "Cleared" }, { roundId: R2, result: "Pending" }],
    slot: { id: `s-${n}`, roundId: R2, startUtc: days(3), location: null, videoUrl: "https://meet.example/northwind" },
    offer: offer ? { id: `o-${n}`, applicationId: `app-${n}`, companyName: "Northwind Analytics", roleTitle: "Software Engineer", ctcAnnual: 1200000, ctcDisplay: "₹12 lakh", status: "Offered", tier: "Dream", respondBy: days(14).slice(0, 10) } : null,
  },
});
const applicants = [applicant(1, "Aarav Sharma", "Offered", 8.5, true), applicant(2, "Meera Iyer", "InProcess", 9.1), { id: "app-3", status: "Withdrawn", released: false }];

const settings = {
  autoApproveVerifiedEmployers: false, acceptOpenJobs: true, allowIneligibleApplications: false, oneOfferPerStudent: true, dreamCtcMin: 1000000, superDreamCtcMin: 2000000,
  tiersOn: true, blockAfterAcceptance: true, pricing: { employerPostingFeeRequired: false, premiumVisibilityEnabled: false, charging: false, note: "Flags only." },
};
const employerSummary = { id: EMPLOYER_ID, name: "Northwind Analytics", website: "https://northwind.example", campusVerified: true, verificationBasis: "GstinAndDomain", gstinValid: true, gstinState: "Karnataka", emailDomainVerified: true };

const card = (id: string, title: string, eligibility: { status: string; reasons: string[] }, policy = { blocked: false, reasons: [] as string[] }, mine: { id: string; status: string } | null = null) => ({
  driveId: id, companyName: "Northwind Analytics", title, jobType: "FullTime", description: "Build data products for Indian small businesses.", locations: ["Bengaluru"], ctcAnnual: 1200000,
  stipendMonthly: null, ctcNotes: "Fixed 10 L + 2 L variable", driveDate: days(20).slice(0, 10), tier: "Dream", applyDeadline: days(10), applicationMode: "Apply", requiredDocuments: ["Resume"],
  rounds: ["Online test", "Technical interview"], criteria, eligibility, policy, closed: false, canApply: eligibility.status !== "notEligible" && !policy.blocked && !mine,
  sharesWith: "Northwind Analytics", myApplication: mine,
});

export const campusDrivesFixtures: ApiFixture[] = [
  {
    path: `/api/career/campus/employer/${EMPLOYER_ID}/jobs`,
    body: {
      verification: { verified: true, basis: "GstinAndDomain", status: "Verified", gstin: "29••••••••1Z5", gstinValid: true, gstinState: "Karnataka", emailDomainVerified: true, problems: [] },
      items: [{ job, colleges: 2, approved: 1, pending: 1 }, { job: { ...job, id: "a1a1a1a1-0000-4000-8000-000000000009", title: "Data Intern", jobType: "Internship", ctcAnnual: null, stipendMonthly: 25000, status: "Draft" }, colleges: 0, approved: 0, pending: 0 }],
    },
  },
  {
    path: `/api/career/campus/employer/${EMPLOYER_ID}/jobs/${JOB_ID}`,
    body: { job, drives: [{ drive: drive(DRIVE_ID, "Approved"), applications: 3, postingFeeRequired: false, premiumVisibilityAvailable: false }, { drive: { ...drive(PENDING_ID, "Pending"), school: "Riverside College" }, applications: 0, postingFeeRequired: true, premiumVisibilityAvailable: false }] },
  },
  {
    path: `/api/career/campus/employer/${EMPLOYER_ID}/drives/${DRIVE_ID}`,
    body: {
      drive: drive(DRIVE_ID, "Approved"), job, rounds, counts: { Applied: 0, InProcess: 1, Offered: 1, Withdrawn: 1 },
      policy: { oneOfferPerStudent: true, blockAfterAcceptance: true, tiersOn: true, dreamCtcMin: 1000000, superDreamCtcMin: 2000000 },
      pricing: { employerPostingFeeRequired: false, premiumVisibilityEnabled: false, charging: false },
    },
  },
  { path: `/api/career/campus/employer/${EMPLOYER_ID}/drives/${DRIVE_ID}/applicants`, body: { timeZone: "Asia/Kolkata", applicants: applicants.map((a) => ({ ...a, membershipId: null })) } },
  {
    path: "/api/career/campus/staff/drives",
    body: {
      items: [
        { drive: { ...drive(PENDING_ID, "Pending") }, job, employer: employerSummary, applications: 0 },
        { drive: drive(DRIVE_ID, "Approved"), job, employer: employerSummary, applications: 3 },
        { drive: { ...drive("a1a1a1a1-0000-4000-8000-000000000004", "Approved"), companyName: "Gamma Services", origin: "Office", employerId: null, tier: "Normal", ctcDisplay: "₹6 lakh" }, job: null, employer: null, applications: 5 },
      ],
      counts: { pending: 1, approved: 2, rejected: 0, withdrawn: 0 }, settings, canDecide: true,
    },
  },
  { path: "/api/career/campus/staff/settings", body: { settings, canEdit: true } },
  {
    path: new RegExp(`^/api/career/campus/staff/drives/(${DRIVE_ID}|${PENDING_ID})$`),
    body: (ctx: FixtureContext) => {
      const pending = ctx.url.pathname.endsWith(PENDING_ID);
      return { drive: drive(pending ? PENDING_ID : DRIVE_ID, pending ? "Pending" : "Approved"), job, employer: employerSummary, rounds: pending ? [] : rounds, applicants: pending ? [] : applicants, offers: [], canDecide: true, canOverridePolicy: true, settings };
    },
  },
  {
    path: "/api/career/campus/student/jobs",
    body: {
      items: [
        card(DRIVE_ID, "Software Engineer", { status: "eligible", reasons: [] }, undefined, { id: "app-1", status: "InProcess" }),
        card(PENDING_ID, "Platform Engineer", { status: "dataMissing", reasons: ["CGPA not recorded"] }),
        card("a1a1a1a1-0000-4000-8000-000000000004", "Graduate Engineer Trainee", { status: "notEligible", reasons: ["CGPA 6.2 is below 7"] }, { blocked: true, reasons: ["You hold a dream offer. Your college's policy lets you take part only in higher-tier drives (this one is regular)."] }),
      ],
      note: "Drives approved by your placement office.",
    },
  },
  { path: "/api/career/campus/student/documents", body: [{ id: "f-1", fileName: "Aarav_resume.pdf", sizeBytes: 52000, purpose: "campus-drive-document", createdAt: days(-3) }] },
  {
    path: "/api/career/campus/student/applications",
    body: {
      timeZone: "Asia/Kolkata",
      items: [
        {
          id: "app-1", driveId: DRIVE_ID, status: "Offered", mode: "Apply", companyName: "Northwind Analytics", title: "Software Engineer", jobType: "FullTime", appliedAt: days(-5),
          sharedWith: "Northwind Analytics", consentCategories: ["Profile", "ContactInfo", "Education", "Gpa", "Resume"], documents: [{ fileId: "f-1", kind: "Resume", fileName: "Aarav_resume.pdf" }],
          rounds: [
            { id: R1, name: "Online test", sequence: 1, result: "Cleared", slot: null, ocrLinked: false },
            { id: R2, name: "Technical interview", sequence: 2, result: "Cleared", slot: { startUtc: days(-1), endUtc: days(-1), location: null, videoUrl: "https://meet.example/northwind", panel: "Priya" }, ocrLinked: false },
          ],
          offer: { id: "o-1", applicationId: "app-1", companyName: "Northwind Analytics", roleTitle: "Software Engineer", ctcAnnual: 1200000, ctcDisplay: "₹12 lakh", joiningDate: days(250).slice(0, 10), status: "Offered", tier: "Dream", respondBy: days(14).slice(0, 10), canRespond: true, letter: { id: "l-1", status: "Issued", version: 1, kind: "Generated", signedAt: null, hasSignedCopy: false } },
        },
        {
          id: "app-2", driveId: PENDING_ID, status: "InProcess", mode: "Apply", companyName: "Gamma Services", title: "Graduate Engineer Trainee", jobType: "FullTime", appliedAt: days(-2),
          sharedWith: null, consentCategories: [], documents: [], rounds: [{ id: "r-g", name: "Group discussion", sequence: 1, result: "Pending", slot: null, ocrLinked: true }], offer: null,
        },
      ],
      offers: [],
    },
  },
];

export const campusDrivesRoutes: A11yRoute[] = [
  { name: "employer-jobs", path: "/employer/jobs", persona: "employer" },
  { name: "employer-job", path: `/employer/jobs/${JOB_ID}`, persona: "employer" },
  { name: "employer-drive", path: `/employer/drives/${DRIVE_ID}`, persona: "employer", ready: "table" },
  { name: "cc-drives", path: "/career-center/placements/drives", persona: "career-center" },
  { name: "cc-drive", path: `/career-center/placements/drives/${DRIVE_ID}`, persona: "career-center", ready: "table" },
  { name: "cc-drive-pending", path: `/career-center/placements/drives/${PENDING_ID}`, persona: "career-center" },
  { name: "student-jobs", path: "/student/jobs", persona: "student" },
  { name: "student-applications", path: "/student/jobs/applications", persona: "student" },
];
