"use client";

/**
 * H14: shared types, labels and small widgets for group sessions (student and career-center views) and the
 * per-meeting Teams / Google Meet links of video appointments.
 */

import React from "react";
import { Badge, useCareerLabels, useCareerT } from "@/components/career/ui";

export interface GroupEligibility {
  majors?: string[];
  classYears?: number[];
  cohortIds?: string[];
  degreeLevels?: string[];
}

export interface GroupHost {
  userId: string;
  name: string;
  isLead: boolean;
}

export interface MyGroupRegistration {
  id: string;
  status: "Registered" | "Waitlisted" | "Cancelled";
  attendance?: "Present" | "NoShow" | null;
  waitlistPosition?: number | null;
  canCancel: boolean;
  registeredAt?: string | null;
  promotedAt?: string | null;
}

export interface GroupSession {
  id: string;
  typeId: string;
  typeName: string;
  kind: string;
  title: string;
  description?: string | null;
  startUtc: string;
  endUtc: string;
  timeZone: string;
  localStart: string;
  capacity: number;
  registered: number;
  waitlisted: number;
  seatsLeft: number;
  mode: string;
  location?: string | null;
  meetingUrl?: string | null;
  meetingSource?: string | null;
  meetingProvider?: string | null;
  meetingFallbackReason?: string | null;
  status: "Scheduled" | "Cancelled";
  cancelReason?: string | null;
  seriesId?: string | null;
  seriesIndex?: number | null;
  seriesCount?: number | null;
  hosts: GroupHost[];
  eligibility: GroupEligibility;
  allowStudents: boolean;
  allowAlumni: boolean;
  minLeadMinutes: number;
  maxLeadDays: number;
  cancelCutoffMinutes: number;
  registrationOpensUtc: string;
  registrationClosesUtc: string;
  cancelCutoffUtc: string;
  registrationOpen: boolean;
  eligible: boolean;
  ineligibleReason?: string | null;
  myRegistration?: MyGroupRegistration | null;
}

export interface GroupType {
  id: string;
  name: string;
  description?: string | null;
  kind: string;
  durationMinutes: number;
  capacity: number;
  mode: string;
  location?: string | null;
  allowStudents: boolean;
  allowAlumni: boolean;
  eligibility: GroupEligibility;
  minLeadMinutes: number;
  maxLeadDays: number;
  cancelCutoffMinutes: number;
  active: boolean;
  sortOrder: number;
}

export const GROUP_KIND_KEYS = ["Workshop", "GroupAdvising", "ResumeClinic", "InfoSession", "Other"];
/** Session kinds in the career language */
export function useGroupKindLabels(): Record<string, string> {
  return useCareerLabels("groupShared.kind", GROUP_KIND_KEYS);
}

export const MEETING_REASON_KEYS = [
  "NoConnectedCalendar",
  "CalendarNeedsReconnect",
  "CalendarWritingOff",
  "MeetingLinksOff",
  "HostUsesOwnLink",
  "ProviderRefused",
  "ProviderNoMeeting",
  "ProviderError",
  "MeetingPending",
];
/** Why a video appointment or session uses the host's fixed link (staff only) */
export function useMeetingReasonLabels(): Record<string, string> {
  return useCareerLabels("groupShared.meetingReason", MEETING_REASON_KEYS);
}

export const DEGREE_LEVEL_KEYS = ["Certificate", "Associate", "Bachelor", "Master", "Doctorate", "Professional"];
export function useDegreeLevelLabels(): Record<string, string> {
  return useCareerLabels("groupShared.degreeLevel", DEGREE_LEVEL_KEYS);
}

/** For staff: where a video meeting's link came from (generated Teams / Meet, or the host's room and why). */
export function MeetingSourceNote({ x }: { x: { mode: string; meetingSource?: string | null; meetingProvider?: string | null; meetingFallbackReason?: string | null } }) {
  const t = useCareerT("groupShared");
  const REASONS = useMeetingReasonLabels();
  if (x.mode !== "Video") return null;
  if (x.meetingSource === "Generated")
    return <p className="text-xs text-muted-foreground">{t("meetingGenerated", { provider: x.meetingProvider === "GoogleMeet" ? "Google Meet" : "Microsoft Teams" })}</p>;
  const reason = x.meetingFallbackReason ? REASONS[x.meetingFallbackReason] ?? x.meetingFallbackReason : null;
  return (
    <p className="text-xs text-muted-foreground">
      {x.meetingSource === "HostLink" ? t("meetingHostLink") : t("meetingNoLink")}
      {reason && <span className="block">{t("meetingReasonText", { reason })}</span>}
    </p>
  );
}

/** Registration status for a student, e.g. "Registered", "Waitlist: number 2", "Attended". */
export function RegistrationBadge({ r }: { r: Pick<MyGroupRegistration, "status" | "attendance" | "waitlistPosition"> }) {
  const t = useCareerT("groupShared");
  if (r.attendance === "Present") return <Badge tone="good">{t("attended")}</Badge>;
  if (r.attendance === "NoShow") return <Badge tone="bad">{t("noShow")}</Badge>;
  if (r.status === "Registered") return <Badge tone="info">{t("registered")}</Badge>;
  if (r.status === "Waitlisted") return <Badge tone="warn">{r.waitlistPosition ? t("waitlistNumber", { position: r.waitlistPosition }) : t("waitlisted")}</Badge>;
  return <Badge tone="neutral">{t("cancelled")}</Badge>;
}

/** "Résumé clinic · 3 of 12 sessions" */
export function SeriesNote({ s }: { s: Pick<GroupSession, "seriesIndex" | "seriesCount"> }) {
  const t = useCareerT("groupShared");
  if (!s.seriesIndex || !s.seriesCount) return null;
  return <span className="text-xs text-muted-foreground">{t("seriesPosition", { index: s.seriesIndex, count: s.seriesCount })}</span>;
}

/** Hosts as a sentence-safe list ("with Casey and Gail"). */
export function hostNames(s: Pick<GroupSession, "hosts">, locale: string) {
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(s.hosts.map((h) => h.name));
  } catch {
    return s.hosts.map((h) => h.name).join(", ");
  }
}

export function eligibilityParts(e: GroupEligibility, cohortNames: Record<string, string>, degreeLabels: Record<string, string>) {
  return {
    majors: e.majors ?? [],
    classYears: (e.classYears ?? []).map(String),
    degreeLevels: (e.degreeLevels ?? []).map((d) => degreeLabels[d] ?? d),
    cohorts: (e.cohortIds ?? []).map((id) => cohortNames[id] ?? id),
  };
}

export function EligibilitySummary({ e, cohortNames = {} }: { e: GroupEligibility; cohortNames?: Record<string, string> }) {
  const t = useCareerT("groupShared");
  const DEGREES = useDegreeLevelLabels();
  const p = eligibilityParts(e, cohortNames, DEGREES);
  const any = p.majors.length + p.classYears.length + p.degreeLevels.length + p.cohorts.length > 0;
  if (!any) return <span className="text-xs text-muted-foreground">{t("openToEveryone")}</span>;
  return (
    <ul className="text-xs text-muted-foreground">
      {p.majors.length > 0 && <li>{t("forMajors", { list: p.majors.join(", ") })}</li>}
      {p.classYears.length > 0 && <li>{t("forClassYears", { list: p.classYears.join(", ") })}</li>}
      {p.degreeLevels.length > 0 && <li>{t("forDegreeLevels", { list: p.degreeLevels.join(", ") })}</li>}
      {p.cohorts.length > 0 && <li>{t("forCohorts", { list: p.cohorts.join(", ") })}</li>}
    </ul>
  );
}

/** Seats left, or that the session is full and the waitlist is open. */
export function SeatsBadge({ s }: { s: Pick<GroupSession, "seatsLeft" | "waitlisted" | "capacity" | "status"> }) {
  const t = useCareerT("groupShared");
  if (s.status === "Cancelled") return <Badge tone="neutral">{t("cancelled")}</Badge>;
  if (s.seatsLeft > 0) return <Badge tone="good">{t("seatsLeft", { count: s.seatsLeft })}</Badge>;
  return <Badge tone="warn">{t("fullWaitlist", { count: s.waitlisted })}</Badge>;
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <p className="whitespace-pre-wrap text-sm">{children}</p>;
}
