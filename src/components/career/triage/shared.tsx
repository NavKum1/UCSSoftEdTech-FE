"use client";

import React from "react";
import { Badge } from "@/components/career/ui";
import { useCareerShell } from "@/components/career/CareerShell";

export interface Signal {
  key: string;
  title: string;
  severity: "high" | "medium" | "low" | string;
  reason: string;
  since?: string | null;
  link?: string | null;
}

export interface Counselor {
  userId: string;
  name: string;
}

export interface TriageSettings {
  finalYearMonths: number;
  noAppointmentMonths: number;
  agreementDaysBeforeStart: number;
  docReturnedDays: number;
  unansweredThreadDays: number;
  mentoringPendingDays: number;
  passingSprintPercent: number;
  disabledRules: string[];
  copilotEnabled: boolean;
  copilotIncludePrivateNotes: boolean;
  copilotAvailable: boolean;
  copilotSimulated: boolean;
  updatedAt: string;
  rules: { key: string; title: string; description: string }[];
}

export const SEVERITY_LABEL: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

/** Severity is shown as text as well as color. */
export function SeverityBadge({ severity, children }: { severity: string; children: React.ReactNode }) {
  const tone = severity === "high" ? "bad" : severity === "medium" ? "warn" : "neutral";
  return (
    <Badge tone={tone}>
      <span className="sr-only">{SEVERITY_LABEL[severity] ?? severity} severity: </span>
      {children}
    </Badge>
  );
}

export function useIsTriageAdmin() {
  const { me, schoolId } = useCareerShell();
  const m = me?.memberships.find((x) => (schoolId ? x.instituteId === schoolId : true) && x.role === "CareerAdmin");
  return !!m || !!me?.isSuperAdmin;
}
