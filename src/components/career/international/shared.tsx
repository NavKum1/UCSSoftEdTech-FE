"use client";

/** Shared types and pieces for the international-students pages (OPT tracker, sponsorship history). */

import React from "react";
import { ShieldAlert } from "lucide-react";
import { Badge, useCareerT, useCareerLabels } from "@/components/career/ui";
import { currentFormatLocale } from "@/components/career/i18n/CareerI18nProvider";

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


/** Formats a yyyy-mm-dd date without shifting it through UTC. */
export function formatDay(value: string | null | undefined) {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(currentFormatLocale(), { dateStyle: "medium" });
}

export function NotLegalAdvice({ text, children }: { text?: string; children?: React.ReactNode }) {
  const t = useCareerT("internationalShared");
  return (
    <div role="note" className="mb-6 flex items-start gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="text-sm">
        <p className="font-semibold">{text ?? t("notLegalAdvice")}</p>
        {children && <div className="mt-1">{children}</div>}
      </div>
    </div>
  );
}

export function DsoCard({ dso }: { dso: DsoContact }) {
  const t = useCareerT("internationalShared");
  if (!dso.configured) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("yourSchoolHasntListedIts")}
        {dso.careerCenterEmail ? (
          <>
            {" "}{t.rich("askTheCareerCenterAt", { link: (chunks) => <a className="underline" href={`mailto:${dso.careerCenterEmail}`}>{chunks}</a>, careerCenterEmail: dso.careerCenterEmail })}
          </>
        ) : (
          t("contactYourInternationalStudentOffice")
        )}
      </p>
    );
  }
  return (
    <dl className="grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
      {dso.name && (
        <>
          <dt className="text-muted-foreground">{t("dSO")}</dt>
          <dd>{dso.name}</dd>
        </>
      )}
      <dt className="text-muted-foreground">{t("email")}</dt>
      <dd>
        <a className="underline" href={`mailto:${dso.email}`}>{dso.email}</a>
      </dd>
      {dso.phone && (
        <>
          <dt className="text-muted-foreground">{t("phone")}</dt>
          <dd>{dso.phone}</dd>
        </>
      )}
      {dso.officeUrl && (
        <>
          <dt className="text-muted-foreground">{t("office")}</dt>
          <dd>
            <a className="underline" href={dso.officeUrl} target="_blank" rel="noreferrer">
              {t("internationalStudentOfficeWebsite")}
            </a>
          </dd>
        </>
      )}
      {dso.note && <dd className="sm:col-span-2 text-muted-foreground">{dso.note}</dd>}
    </dl>
  );
}

export const LEVEL_TEXT_KEYS = ["ok", "notice", "warning", "urgent", "limit"];
/** level text in the career language (G1) */
export function useLevelText(): Record<string, string> {
  return useCareerLabels("internationalShared.level", LEVEL_TEXT_KEYS);
}

export function LevelBadge({ level }: { level: OptStatus["level"] }) {
  const LEVEL_TEXT = useLevelText();
  const tone = level === "ok" ? "good" : level === "notice" || level === "warning" ? "warn" : "bad";
  return <Badge tone={tone}>{LEVEL_TEXT[level]}</Badge>;
}

export const STATE_TEXT_KEYS = ["NoAuthorization", "PreCompletionOnly", "NotStarted", "Active", "Ended"];
/** state text in the career language (G1) */
export function useStateText(): Record<string, string> {
  return useCareerLabels("internationalShared.state", STATE_TEXT_KEYS);
}

export const DEADLINE_TEXT_KEYS = ["due", "overdue", "done", "upcoming", "info"];
/** deadline text in the career language (G1) */
export function useDeadlineText(): Record<string, string> {
  return useCareerLabels("internationalShared.deadline", DEADLINE_TEXT_KEYS);
}

export function DeadlineBadge({ status }: { status: OptDeadline["status"] }) {
  const DEADLINE_TEXT = useDeadlineText();
  const tone = status === "done" ? "good" : status === "overdue" ? "bad" : status === "due" ? "warn" : "neutral";
  return <Badge tone={tone}>{DEADLINE_TEXT[status]}</Badge>;
}
