"use client";

/** Types and helpers shared by the on-campus recruiting (interview scheduling) pages. */

import React from "react";
import { Badge, useCareerT, useCareerLabels, useCareerFormat } from "@/components/career/ui";

export interface OcrDay {
  date: string;
  start: string;
  end: string;
  lunchStart?: string | null;
  lunchEnd?: string | null;
}

export interface OcrInterviewer {
  name: string;
  email?: string | null;
}

export interface OcrSchedule {
  id: string;
  instituteId: string;
  school?: string | null;
  employerId: string;
  employerName?: string | null;
  positionTitle: string;
  description?: string | null;
  externalJobUrl?: string | null;
  externalJobId?: string | null;
  externalJobSource?: string | null;
  virtual: boolean;
  virtualUrl?: string | null;
  tracks: number;
  slotMinutes: number;
  breakMinutes: number;
  days: OcrDay[];
  interviewers: OcrInterviewer[];
  signupType: string;
  degreeLevels: string[];
  majors: string[];
  gradFrom?: string | null;
  gradTo?: string | null;
  workAuthRequirement: string;
  workAuthStatement: string;
  signupOpensAt?: string | null;
  signupClosesAt?: string | null;
  cancelCutoffHours: number;
  status: string;
  decisionNote?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra?: any;
}

export const SIGNUP_LABELS_KEYS = ["Open", "PreSelect", "Alternates"];
/** signup labels in the career language (G1) */
export function useSignupLabels(): Record<string, string> {
  return useCareerLabels("interviewsShared.signup", SIGNUP_LABELS_KEYS);
}

export const WORK_AUTH_LABELS_KEYS = ["None", "AuthorizedUS", "NoSponsorship"];
/** work auth labels in the career language (G1) */
export function useInterviewWorkAuthLabels(): Record<string, string> {
  return useCareerLabels("interviewsShared.workAuth", WORK_AUTH_LABELS_KEYS);
}

export const OUTCOME_LABELS_KEYS = ["Offer", "NoOffer", "Pending"];
/** outcome labels in the career language (G1) */
export function useInterviewOutcomeLabels(): Record<string, string> {
  return useCareerLabels("interviewsShared.outcome", OUTCOME_LABELS_KEYS);
}

export const DEGREE_LEVELS = ["Certificate", "Associate", "Bachelor", "Master", "Doctorate", "Professional"];

export function StatusBadge({ status }: { status: string }) {
  const t = useCareerT("interviewsShared");
  const tone = status === "Published" || status === "Registered" || status === "Booked" || status === "Attended" || status === "Offer"
    ? "good"
    : status === "Requested" || status === "Approved" || status === "Waitlisted" || status === "Invited" || status === "Pending"
      ? "info"
      : status === "NoShow" || status === "Declined" || status === "Cancelled"
        ? "bad"
        : "neutral";
  const label = status === "Waitlisted" ? t("alternate") : status === "NoShow" ? t("noShow") : status === "NoOffer" ? t("noOffer") : status;
  return <Badge tone={tone}>{label}</Badge>;
}

/** Degree levels in the career language (G1) */
export function useDegreeLevelLabels(): Record<string, string> {
  return useCareerLabels("interviewsShared.degreeLevel", DEGREE_LEVELS);
}

/** Interview days as text ("Mon, Oct 5 09:00–12:00; ..."), dates in the career locale (G1). */
export function useDaysText() {
  const fmt = useCareerFormat();
  return (days: OcrDay[]) =>
    days
      .map((d) => {
        const date = new Date(`${d.date}T12:00:00Z`).toLocaleDateString(fmt.locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
        return `${date} ${d.start}–${d.end}`;
      })
      .join("; ");
}

/** Who a schedule is open to, in the career language (G1). */
export function useEligibilityText() {
  const tr = useCareerT("interviewsShared");
  const DEGREES = useDegreeLevelLabels();
  return (s: Pick<OcrSchedule, "degreeLevels" | "majors" | "gradFrom" | "gradTo">) => {
    const parts: string[] = [];
    if (s.degreeLevels.length) parts.push(s.degreeLevels.map((l) => DEGREES[l] ?? l).join(", "));
    if (s.majors.length) parts.push(tr("eligibilityMajors", { list: s.majors.join(", ") }));
    if (s.gradFrom || s.gradTo) parts.push(tr("eligibilityGraduating", { from: s.gradFrom ?? tr("anyTime"), to: s.gradTo ?? tr("anyTime") }));
    return parts.length ? parts.join(" · ") : tr("allStudents");
  };
}

/** Opens an HTML document (fetched with auth) in a new tab for printing. */
export async function openHtml(res: Response, failedMessage: (status: number) => string) {
  if (!res.ok) throw new Error(failedMessage(res.status));
  const blob = new Blob([await res.text()], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
