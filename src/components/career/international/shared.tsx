"use client";

/** Shared types and pieces for the international-students pages (OPT tracker, sponsorship history). */

import React from "react";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/career/ui";

export interface DsoContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  officeUrl?: string | null;
  note?: string | null;
  configured: boolean;
  careerCenterEmail?: string | null;
}

export interface OptRulesInfo {
  postCompletionUnemploymentDays: number;
  stemAdditionalUnemploymentDays: number;
  stemTotalUnemploymentDays: number;
  minHoursPerWeek: number;
  combineHoursAcrossJobs: boolean;
  postCompletionWarningDays: number[];
  stemWarningDays: number[];
  reportingWindowDays: number;
  stemEvaluationMonths: number[];
  stemValidationReportMonths: number;
  fullTimeCptLimitDays: number;
  note: string;
}

export interface OptAuthorization {
  id: string;
  optType: "PreCompletion" | "PostCompletion" | "StemExtension";
  label: string;
  eadStart: string;
  eadEnd: string;
  countsTowardUnemployment: boolean;
  evaluations: { month: number; dueOn: string; submittedOn: string | null }[] | null;
}

export interface OptEmployment {
  id: string;
  employerName: string;
  jobTitle?: string | null;
  startDate: string;
  endDate?: string | null;
  hoursPerWeek: number;
  relatedToMajor: boolean;
  relationExplanation?: string | null;
  eVerifyEmployer: boolean;
  startReportedOn?: string | null;
  endReportedOn?: string | null;
  countsForPostCompletion: boolean;
  countsForStem: boolean;
}

export interface OptStatus {
  state: "NoAuthorization" | "PreCompletionOnly" | "NotStarted" | "Active" | "Ended";
  daysUsed: number;
  limit: number;
  daysRemaining: number;
  hasStem: boolean;
  employedToday: boolean;
  phaseToday?: string | null;
  level: "ok" | "notice" | "warning" | "urgent" | "limit";
  nextWarningAt?: number | null;
  limitReachedOn?: string | null;
  countingFrom?: string | null;
  countingThrough?: string | null;
  warningThresholds: number[];
  unemployedSpans: { start: string; end: string; days: number; phase: string }[];
}

export interface OptDeadline {
  key: string;
  kind: string;
  label: string;
  dueOn: string;
  status: "due" | "overdue" | "done" | "upcoming" | "info";
  refId?: string | null;
}

export interface OptView {
  eligible: true;
  workAuthorization: string;
  disclaimer: string;
  asOf: string;
  dso: DsoContact;
  tracker: { id: string; programEndDate?: string | null; notes?: string | null; updatedAt: string } | null;
  authorizations: OptAuthorization[];
  employments: OptEmployment[];
  status: OptStatus;
  deadlines: OptDeadline[];
  checks: { level: "bad" | "warn" | "info"; text: string }[];
  cpt: { fullTimeDays: number; limitDays: number; periods: { startDate: string; endDate: string; hoursPerWeek: number; employerName: string; fullTime: boolean }[] };
  rules: OptRulesInfo;
  optTypes: { value: string; label: string }[];
}

export interface NotEligibleView {
  eligible: false;
  workAuthorization: string;
  explanation: string;
  disclaimer: string;
  dso: DsoContact;
}

export const NOT_LEGAL_ADVICE = "This is not legal advice. Your Designated School Official (DSO) is the authority.";

/** Formats a yyyy-mm-dd date without shifting it through UTC. */
export function formatDay(value: string | null | undefined) {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function NotLegalAdvice({ text = NOT_LEGAL_ADVICE, children }: { text?: string; children?: React.ReactNode }) {
  return (
    <div role="note" className="mb-6 flex items-start gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="text-sm">
        <p className="font-semibold">{text}</p>
        {children && <div className="mt-1">{children}</div>}
      </div>
    </div>
  );
}

export function DsoCard({ dso }: { dso: DsoContact }) {
  if (!dso.configured) {
    return (
      <p className="text-sm text-muted-foreground">
        Your school hasn&apos;t listed its DSO contact here yet.
        {dso.careerCenterEmail ? (
          <>
            {" "}Ask the career center at <a className="underline" href={`mailto:${dso.careerCenterEmail}`}>{dso.careerCenterEmail}</a> how to reach your international student office.
          </>
        ) : (
          " Contact your international student office."
        )}
      </p>
    );
  }
  return (
    <dl className="grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
      {dso.name && (
        <>
          <dt className="text-muted-foreground">DSO</dt>
          <dd>{dso.name}</dd>
        </>
      )}
      <dt className="text-muted-foreground">Email</dt>
      <dd>
        <a className="underline" href={`mailto:${dso.email}`}>{dso.email}</a>
      </dd>
      {dso.phone && (
        <>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>{dso.phone}</dd>
        </>
      )}
      {dso.officeUrl && (
        <>
          <dt className="text-muted-foreground">Office</dt>
          <dd>
            <a className="underline" href={dso.officeUrl} target="_blank" rel="noreferrer">
              International student office website
            </a>
          </dd>
        </>
      )}
      {dso.note && <dd className="sm:col-span-2 text-muted-foreground">{dso.note}</dd>}
    </dl>
  );
}

export const LEVEL_TEXT: Record<OptStatus["level"], string> = {
  ok: "On track",
  notice: "Notice",
  warning: "Warning",
  urgent: "Urgent",
  limit: "Limit reached",
};

export function LevelBadge({ level }: { level: OptStatus["level"] }) {
  const tone = level === "ok" ? "good" : level === "notice" || level === "warning" ? "warn" : "bad";
  return <Badge tone={tone}>{LEVEL_TEXT[level]}</Badge>;
}

export const STATE_TEXT: Record<OptStatus["state"], string> = {
  NoAuthorization: "No OPT period recorded",
  PreCompletionOnly: "Pre-completion OPT only",
  NotStarted: "Not started",
  Active: "Active",
  Ended: "Ended",
};

export const DEADLINE_TEXT: Record<OptDeadline["status"], string> = {
  due: "Due",
  overdue: "Overdue",
  done: "Done",
  upcoming: "Upcoming",
  info: "Past",
};

export function DeadlineBadge({ status }: { status: OptDeadline["status"] }) {
  const tone = status === "done" ? "good" : status === "overdue" ? "bad" : status === "due" ? "warn" : "neutral";
  return <Badge tone={tone}>{DEADLINE_TEXT[status]}</Badge>;
}
