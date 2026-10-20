/** Fixtures for H12 exam administration (/admin/exams): the exam list, one exam's tabs, the import preview. */
import type { A11yRoute, ApiFixture } from "./types";
import { INSTITUTE_ID, USER_ID, days, hours } from "./types";

export const EXAM_ID = "custom-a11y0001";
const STUDENT_A = "aaaaaaaa-1111-4111-8111-111111111111";
const STUDENT_B = "bbbbbbbb-2222-4222-8222-222222222222";

const policy = (over: object = {}) => ({
  issuesCredential: true,
  revealAnswerKey: false,
  maxAttempts: 3,
  cooldownMinutes: 1440,
  shuffleQuestions: true,
  shuffleOptions: true,
  questionsPerAttempt: 5,
  poolSize: 12,
  timeLimitMinutes: 20,
  graceMinutes: 2,
  overrides: { maxAttempts: null, cooldownMinutes: null, questionsPerAttempt: 5, graceMinutes: null },
  ...over,
});
const health = (level: string, poolSize: number, per: number, message: string) => ({ level, poolSize, questionsPerAttempt: per, recommendedPoolSize: per * 3, message });

const exams = [
  {
    id: EXAM_ID, title: "Data Structures Midterm (Section B)", stream: "Computer Science", scope: "Institute", source: "upload", builtIn: false, instituteId: INSTITUTE_ID,
    ownerUserId: USER_ID, durationMinutes: 20, passingPercentage: 60, version: 4, updatedAt: days(-1), policy: policy(),
    questions: { approved: 12, draft: 2, retired: 1 }, poolHealth: health("warning", 12, 5, "The pool (12) is less than three times the questions per attempt (5); repeat attempts will see many of the same questions."),
    attempts: { total: 41, submitted: 37, passed: 26, expired: 2, voided: 1, inProgress: 2, students: 19, passRate: 70.3 }, credentialsUnderReview: 1,
  },
  {
    id: "swe-core-systems", title: "Software Engineering & Distributed Systems Diagnostic", stream: "Software Engineering", scope: "Platform", source: "seed", builtIn: true,
    instituteId: null, ownerUserId: null, durationMinutes: 20, passingPercentage: 70, version: 1, updatedAt: days(-20), policy: policy({ questionsPerAttempt: 5, poolSize: 5, overrides: { maxAttempts: null, cooldownMinutes: null, questionsPerAttempt: null, graceMinutes: null } }),
    questions: { approved: 5, draft: 0, retired: 0 }, poolHealth: health("warning", 5, 5, "Every attempt shows all 5 questions. A pool of at least 15 lets each attempt draw a different set."),
    attempts: { total: 120, submitted: 110, passed: 64, expired: 6, voided: 0, inProgress: 4, students: 52, passRate: 58.2 }, credentialsUnderReview: 0,
  },
  {
    id: "custom-a11y0002", title: "SQL practice set", stream: "Databases", scope: "Private", source: "generated", builtIn: false, instituteId: null, ownerUserId: USER_ID,
    durationMinutes: 15, passingPercentage: 70, version: 1, updatedAt: days(-3),
    policy: policy({ issuesCredential: false, revealAnswerKey: true, maxAttempts: 0, cooldownMinutes: 0, questionsPerAttempt: 6, poolSize: 6, overrides: { maxAttempts: null, cooldownMinutes: null, questionsPerAttempt: null, graceMinutes: null } }),
    questions: { approved: 6, draft: 0, retired: 0 }, poolHealth: health("warning", 6, 6, "Every attempt shows all 6 questions. A pool of at least 18 lets each attempt draw a different set."),
    attempts: { total: 0, submitted: 0, passed: 0, expired: 0, voided: 0, inProgress: 0, students: 0, passRate: null }, credentialsUnderReview: 0,
  },
];

const detail = {
  ...exams[0],
  description: "Midterm for section B: arrays, linked lists, trees and hashing.",
  difficulty: "Intermediate",
  createdAt: days(-30),
  defaults: { credentialMaxAttempts: 3, credentialCooldownMinutes: 1440, practiceMaxAttempts: 0, practiceCooldownMinutes: 0, graceMinutes: 2 },
  permissions: { canIssueCredential: true },
};

const q = (number: number, text: string, extra: object = {}) => ({
  number, questionText: text, codeSnippet: null, options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"], correctOptionIndex: 1, explanation: "Balanced trees halve the search space.",
  topic: "Trees", status: "Approved", source: "Manual", revision: 1, previousNumber: null, supersededByNumber: null, createdByUserId: USER_ID, approvedByUserId: USER_ID,
  approvedAt: days(-20), retiredAt: null, createdAt: days(-20), updatedAt: days(-20), version: 1, timesServed: 14, ...extra,
});
const questions = [
  q(1, "What is the lookup cost in a balanced binary search tree?", { status: "Retired", supersededByNumber: 13, retiredAt: days(-2) }),
  q(2, "Which structure gives O(1) average lookups by key?", { correctOptionIndex: 0, topic: "Hashing", source: "Import" }),
  q(3, "What does a stack return on pop?", { options: ["The oldest item", "The newest item"], topic: "Stacks", timesServed: 11 }),
  q(13, "What is the worst-case lookup cost in a balanced binary search tree?", { revision: 2, previousNumber: 1, timesServed: 3 }),
  q(14, "Which traversal visits the root first?", { status: "Draft", source: "AiDraft", approvedByUserId: null, approvedAt: null, timesServed: 0, options: ["Pre-order", "In-order", "Post-order"], correctOptionIndex: 0 }),
];

const stats = {
  examId: EXAM_ID, attemptsAnalyzed: 39, gradedAttempts: 37, groupSize: 10, capped: false, flagged: 2,
  thresholds: { minSample: 5, tooEasyPercent: 90, tooHardPercent: 10, groupShare: 0.27 },
  questions: [
    { number: 1, revision: 1, status: "Retired", questionText: questions[0].questionText, topic: "Trees", timesServed: 14, timesAnswered: 13, timesCorrect: 12, percentCorrect: 92.3, discrimination: 0.1, flags: ["too_easy"] },
    { number: 2, revision: 1, status: "Approved", questionText: questions[1].questionText, topic: "Hashing", timesServed: 15, timesAnswered: 14, timesCorrect: 9, percentCorrect: 64.3, discrimination: 0.6, flags: [] },
    { number: 3, revision: 1, status: "Approved", questionText: questions[2].questionText, topic: "Stacks", timesServed: 11, timesAnswered: 10, timesCorrect: 4, percentCorrect: 40, discrimination: -0.2, flags: ["negative_discrimination"] },
    { number: 13, revision: 2, status: "Approved", questionText: questions[3].questionText, topic: "Trees", timesServed: 3, timesAnswered: 3, timesCorrect: 2, percentCorrect: 66.7, discrimination: null, flags: ["low_sample"] },
  ],
};

const students = [
  { userId: STUDENT_A, name: "Priya Raman", email: "priya.raman@lakeside.edu", attemptsUsed: 3, maxAttempts: 4, extraAttempts: 1, attemptsRemaining: 1, nextAttemptAt: hours(20), hasOpenAttempt: false, cooldownResetAt: null, voided: 1, bestPercentage: 80, passed: true, lastAttemptAt: hours(-4) },
  { userId: STUDENT_B, name: null, email: "m.okafor@lakeside.edu", attemptsUsed: 1, maxAttempts: 3, extraAttempts: 0, attemptsRemaining: 2, nextAttemptAt: null, hasOpenAttempt: false, cooldownResetAt: null, voided: 0, bestPercentage: 40, passed: false, lastAttemptAt: days(-2) },
];

const studentDetail = {
  examId: EXAM_ID, userId: STUDENT_A, name: "Priya Raman", email: "priya.raman@lakeside.edu",
  status: { attemptsUsed: 3, maxAttempts: 4, extraAttempts: 1, attemptsRemaining: 1, nextAttemptAt: hours(20), hasOpenAttempt: false },
  exceptions: { extraAttempts: 1, cooldownResetAt: null, updatedAt: days(-1) },
  attempts: [
    { attemptId: "att-4", attemptNumber: 4, status: "Submitted", source: "server", countsTowardLimit: true, startedAt: hours(-5), expiresAt: hours(-4), submittedAt: hours(-4), totalQuestions: 5, correctAnswers: 4, percentage: 80, passed: true, gradedByServer: true, certificateNumber: null, voidedAt: null, voidReason: null, credential: null },
    { attemptId: "att-2", attemptNumber: 2, status: "Voided", source: "server", countsTowardLimit: false, startedAt: days(-3), submittedAt: days(-3), totalQuestions: 5, correctAnswers: 5, percentage: 100, passed: true, gradedByServer: true, certificateNumber: "CERT-EXAM-2026-A11Y0002", voidedAt: days(-1), voidReason: "Notes found on the desk", credential: { claimId: "claim-1", certificateNumber: "CERT-EXAM-2026-A11Y0002", reviewStatus: "Flagged" } },
    { attemptId: "att-1", attemptNumber: 1, status: "Expired", source: "server", countsTowardLimit: true, startedAt: days(-5), submittedAt: null, totalQuestions: 5, correctAnswers: 0, percentage: 0, passed: false, gradedByServer: false, certificateNumber: null, voidedAt: null, voidReason: null, credential: null },
  ],
};

const audit = [
  { id: "ev-1", at: hours(-2), action: "exam.attempt.voided", actorUserId: USER_ID, actorName: "Jordan Lee", details: { attemptId: "att-2", userId: STUDENT_A, reason: "Notes found on the desk", credentialFlagged: true } },
  { id: "ev-2", at: days(-1), action: "exam.student.extra_attempts", actorUserId: USER_ID, actorName: "Jordan Lee", details: { userId: STUDENT_A, count: 1, before: 0, after: 1, reason: "Medical certificate" } },
  { id: "ev-3", at: days(-2), action: "exam.question.versioned", actorUserId: USER_ID, actorName: "Jordan Lee", details: { number: 1, newNumber: 13, revision: 2 } },
  { id: "ev-4", at: days(-4), action: "exam.policy.updated", actorUserId: USER_ID, actorName: "Jordan Lee", details: { before: { maxAttempts: null, questionsPerAttempt: null }, after: { maxAttempts: null, questionsPerAttempt: 5 } } },
];

const reviews = [
  { claimId: "claim-1", examId: EXAM_ID, examTitle: exams[0].title, userId: STUDENT_A, name: "Priya Raman", email: "priya.raman@lakeside.edu", attemptId: "att-2", certificateNumber: "CERT-EXAM-2026-A11Y0002", verificationUrl: "/credential/cred-exam-a11y0002", percentage: 100, reviewStatus: "Flagged", reviewReason: "Notes found on the desk", flaggedAt: days(-1), flaggedByUserId: USER_ID, reviewedAt: null, reviewedByUserId: null, reviewNote: null },
];

export const importPreview = {
  dryRun: true, imported: false, status: "Approved", total: 3, valid: 2, invalid: 1, errors: [], warnings: ["These columns are ignored: notes."], numbers: [],
  poolBefore: 12, poolAfter: 14, poolHealthAfter: health("warning", 14, 5, "The pool (14) is less than three times the questions per attempt (5); repeat attempts will see many of the same questions."),
  rows: [
    { row: 2, questionText: "Which structure is FIFO?", options: ["Stack", "Queue"], correctOptionIndex: 1, explanation: "", topic: "Queues", codeSnippet: null, errors: [], warnings: [] },
    { row: 3, questionText: "What is a heap's peek cost?", options: ["O(1)", "O(n)"], correctOptionIndex: 0, explanation: "", topic: "Heaps", codeSnippet: null, errors: [], warnings: ["Question 9 of this exam has the same text."] },
    { row: 4, questionText: "Broken row", options: ["Only one"], correctOptionIndex: 0, explanation: "", topic: "", codeSnippet: null, errors: ["A question needs at least two options."], warnings: [] },
  ],
};

const A = "/api/quiz/admin";
export const examAdminFixtures: ApiFixture[] = [
  { path: `${A}/exams`, body: exams },
  { path: `${A}/credential-reviews`, body: { status: "Flagged", reviews } },
  { path: new RegExp(`^${A}/exams/[^/]+$`), body: detail },
  { path: new RegExp(`^${A}/exams/[^/]+/questions$`), body: { examId: EXAM_ID, poolHealth: detail.poolHealth, questions } },
  { path: new RegExp(`^${A}/exams/[^/]+/statistics$`), body: stats },
  { path: new RegExp(`^${A}/exams/[^/]+/students$`), body: { examId: EXAM_ID, total: students.length, students } },
  { path: new RegExp(`^${A}/exams/[^/]+/students/[^/]+/attempts$`), body: studentDetail },
  { path: new RegExp(`^${A}/exams/[^/]+/audit$`), body: { examId: EXAM_ID, events: audit } },
  { method: "POST", path: new RegExp(`^${A}/exams/[^/]+/questions/import$`), body: importPreview },
];

export const examAdminRoutes: A11yRoute[] = [
  { name: "admin-exams", path: "/admin/exams", persona: "admin", ready: 'table:has-text("Data Structures Midterm")' },
  { name: "admin-exam-settings", path: `/admin/exams/${EXAM_ID}`, persona: "admin", ready: 'button:has-text("Save settings")' },
  { name: "admin-exam-questions", path: `/admin/exams/${EXAM_ID}?tab=questions`, persona: "admin", ready: 'table:has-text("Which traversal visits the root first?")' },
  { name: "admin-exam-statistics", path: `/admin/exams/${EXAM_ID}?tab=statistics`, persona: "admin", ready: 'table:has-text("Weaker students do better")' },
  { name: "admin-exam-students", path: `/admin/exams/${EXAM_ID}?tab=students`, persona: "admin", ready: 'table:has-text("Priya Raman")' },
  { name: "admin-exam-activity", path: `/admin/exams/${EXAM_ID}?tab=activity`, persona: "admin", ready: 'text=Medical certificate' },
];
