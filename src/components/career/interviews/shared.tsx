"use client";

/** Types and helpers shared by the on-campus recruiting (interview scheduling) pages. */

import React from "react";
import { Badge } from "@/components/career/ui";

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

export const SIGNUP_LABELS: Record<string, string> = {
  Open: "Open to qualified students",
  PreSelect: "Pre-select list",
  Alternates: "Pre-select with alternates",
};

export const WORK_AUTH_LABELS: Record<string, string> = {
  None: "No requirement",
  AuthorizedUS: "Authorized to work in the US",
  NoSponsorship: "Authorized, no sponsorship needed",
};

export const OUTCOME_LABELS: Record<string, string> = { Offer: "Offer", NoOffer: "No offer", Pending: "Pending" };

export const DEGREE_LEVELS = ["Certificate", "Associate", "Bachelor", "Master", "Doctorate", "Professional"];

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "Published" || status === "Registered" || status === "Booked" || status === "Attended" || status === "Offer"
    ? "good"
    : status === "Requested" || status === "Approved" || status === "Waitlisted" || status === "Invited" || status === "Pending"
      ? "info"
      : status === "NoShow" || status === "Declined" || status === "Cancelled"
        ? "bad"
        : "neutral";
  const label = status === "Waitlisted" ? "Alternate" : status === "NoShow" ? "No-show" : status === "NoOffer" ? "No offer" : status;
  return <Badge tone={tone}>{label}</Badge>;
}

export function daysText(days: OcrDay[]) {
  return days
    .map((d) => {
      const date = new Date(`${d.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
      return `${date} ${d.start}–${d.end}`;
    })
    .join("; ");
}

export function eligibilityText(s: Pick<OcrSchedule, "degreeLevels" | "majors" | "gradFrom" | "gradTo">) {
  const parts: string[] = [];
  if (s.degreeLevels.length) parts.push(s.degreeLevels.join(", "));
  if (s.majors.length) parts.push(`majors: ${s.majors.join(", ")}`);
  if (s.gradFrom || s.gradTo) parts.push(`graduating ${s.gradFrom ?? "any time"} to ${s.gradTo ?? "any time"}`);
  return parts.length ? parts.join(" · ") : "All students";
}

/** Opens an HTML document (fetched with auth) in a new tab for printing. */
export async function openHtml(res: Response) {
  if (!res.ok) throw new Error(`Couldn't load the agenda (${res.status})`);
  const blob = new Blob([await res.text()], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
