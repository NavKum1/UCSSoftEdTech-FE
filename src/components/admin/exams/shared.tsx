"use client";

/**
 * H12 exam administration (/admin/exams): types for /api/quiz/admin and a small JSON helper over useLegacyApi.
 * The API decides who may manage which exam (SuperAdmin; an InstituteAdmin for their institute; a creator for their own
 * exams) and answers 404 for anything else.
 */

import { useCallback } from "react";
import { useLegacyApi } from "@/lib/legacyApi";
import { Badge } from "@/components/career/ui";

export const ADMIN_BASE = "/api/quiz/admin";

export class ExamApiError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message);
  }
}

/** JSON calls to the exam admin API. Errors carry the API's message (`error`) and status. */
export function useExamAdminApi() {
  const { apiFetch, ready, access } = useLegacyApi();
  const call = useCallback(
    async <T,>(path: string, init: { method?: string; json?: unknown } = {}): Promise<T> => {
      const res = await apiFetch(path, {
        method: init.method ?? "GET",
        headers: init.json !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      });
      const text = await res.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      if (!res.ok) {
        const msg = (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string" ? (body as { error: string }).error : null)
          ?? (res.status === 404 ? "We couldn't find this exam, or you don't manage it." : "Something went wrong. Please try again in a moment.");
        throw new ExamApiError(msg, res.status, body);
      }
      return body as T;
    },
    [apiFetch],
  );
  return { call, ready, access };
}

export interface PoolHealth {
  level: "ok" | "warning" | "error";
  poolSize: number;
  questionsPerAttempt: number;
  recommendedPoolSize: number;
  message: string;
}

export interface Policy {
  issuesCredential: boolean;
  revealAnswerKey: boolean;
  maxAttempts: number;
  cooldownMinutes: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questionsPerAttempt: number;
  poolSize: number;
  timeLimitMinutes: number;
  graceMinutes: number;
  overrides: { maxAttempts: number | null; cooldownMinutes: number | null; questionsPerAttempt: number | null; graceMinutes: number | null };
}

export interface AttemptStats {
  total: number;
  submitted: number;
  passed: number;
  expired: number;
  voided: number;
  inProgress: number;
  students: number;
  passRate: number | null;
}

export interface ExamRow {
  id: string;
  title: string;
  stream: string;
  scope: string;
  source: string;
  builtIn: boolean;
  durationMinutes: number;
  passingPercentage: number;
  version: number;
  updatedAt: string;
  policy: Policy;
  questions: { approved: number; draft: number; retired: number };
  poolHealth: PoolHealth;
  attempts: AttemptStats;
  credentialsUnderReview: number;
}

export interface ExamDetail extends ExamRow {
  description: string;
  difficulty: string;
  createdAt: string;
  defaults: { credentialMaxAttempts: number; credentialCooldownMinutes: number; practiceMaxAttempts: number; practiceCooldownMinutes: number; graceMinutes: number };
  permissions: { canIssueCredential: boolean };
}

export interface Question {
  number: number;
  questionText: string;
  codeSnippet: string | null;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  topic: string;
  status: "Draft" | "Approved" | "Retired";
  source: "Manual" | "Import" | "AiDraft";
  revision: number;
  previousNumber: number | null;
  supersededByNumber: number | null;
  version: number;
  timesServed: number;
  updatedAt: string | null;
}

export interface QuestionStat {
  number: number;
  revision: number;
  status: string;
  questionText: string;
  topic: string;
  timesServed: number;
  timesAnswered: number;
  timesCorrect: number;
  percentCorrect: number | null;
  discrimination: number | null;
  flags: string[];
}

export interface Statistics {
  attemptsAnalyzed: number;
  gradedAttempts: number;
  groupSize: number;
  capped: boolean;
  flagged: number;
  thresholds: { minSample: number; tooEasyPercent: number; tooHardPercent: number; groupShare: number };
  questions: QuestionStat[];
}

export interface StudentRow {
  userId: string;
  name: string | null;
  email: string | null;
  attemptsUsed: number;
  maxAttempts: number;
  extraAttempts: number;
  attemptsRemaining: number | null;
  nextAttemptAt: string | null;
  hasOpenAttempt: boolean;
  cooldownResetAt: string | null;
  voided: number;
  bestPercentage: number | null;
  passed: boolean;
  lastAttemptAt: string;
}

export interface StudentAttempt {
  attemptId: string;
  attemptNumber: number | null;
  status: string;
  source: string;
  countsTowardLimit: boolean;
  startedAt: string | null;
  submittedAt: string | null;
  percentage: number;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
  certificateNumber: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  credential: { claimId: string; certificateNumber: string; reviewStatus: string | null } | null;
}

export interface StudentDetail {
  userId: string;
  name: string | null;
  email: string | null;
  status: { attemptsUsed: number; maxAttempts: number; extraAttempts: number; attemptsRemaining: number | null; nextAttemptAt: string | null; hasOpenAttempt: boolean };
  exceptions: { extraAttempts: number; cooldownResetAt: string | null };
  attempts: StudentAttempt[];
}

export interface AuditEvent {
  id: string;
  at: string;
  action: string;
  actorUserId: string | null;
  actorName: string | null;
  details: Record<string, unknown> | null;
}

export interface CredentialReview {
  claimId: string;
  examId: string;
  examTitle: string;
  userId: string;
  name: string | null;
  email: string | null;
  attemptId: string;
  certificateNumber: string;
  percentage: number;
  reviewStatus: string;
  reviewReason: string | null;
  flaggedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export const SCOPE_LABEL: Record<string, string> = {
  Platform: "Platform (everyone)",
  Institute: "Institute",
  Private: "Private (creator only)",
  Legacy: "Imported, no owner",
};

export function PoolHealthBadge({ health }: { health: PoolHealth }) {
  const tone = health.level === "ok" ? "good" : health.level === "warning" ? "warn" : "bad";
  const text = health.level === "ok" ? "Pool OK" : health.level === "warning" ? "Small pool" : "Pool too small";
  return <Badge tone={tone}>{text}</Badge>;
}

export function KindBadge({ issuesCredential }: { issuesCredential: boolean }) {
  return issuesCredential ? <Badge tone="info">Credential</Badge> : <Badge>Practice</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "Approved" ? "good" : status === "Draft" ? "warn" : status === "Voided" ? "bad" : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

export const FLAG_LABEL: Record<string, string> = {
  too_easy: "Almost everyone gets it right",
  too_hard: "Almost everyone gets it wrong",
  negative_discrimination: "Weaker students do better",
  low_sample: "Not enough answers yet",
};

export const ACTION_LABEL: Record<string, string> = {
  "exam.policy.updated": "Changed the attempts policy",
  "exam.question.added": "Added a question",
  "exam.question.edited": "Edited a question",
  "exam.question.versioned": "Edited a used question (new version)",
  "exam.question.approved": "Approved a question",
  "exam.question.retired": "Retired a question",
  "exam.questions.imported": "Imported questions",
  "exam.student.extra_attempts": "Changed a student's extra attempts",
  "exam.student.cooldown_reset": "Reset a student's cooldown",
  "exam.attempt.voided": "Voided an attempt",
  "exam.credential.kept": "Kept a credential after review",
  "exam.credential.revoked": "Revoked a credential",
};

/** "3" or "Unlimited", with "(default)" when the exam uses the configured value. */
export function attemptsLabel(n: number, isDefault: boolean) {
  return `${n === 0 ? "Unlimited" : n}${isDefault ? " (default)" : ""}`;
}

export function minutesLabel(n: number) {
  if (n === 0) return "None";
  if (n % 1440 === 0) return `${n / 1440} day${n === 1440 ? "" : "s"}`;
  if (n % 60 === 0) return `${n / 60} h`;
  return `${n} min`;
}
