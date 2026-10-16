import { useCareerLabels } from "@/components/career/ui";
/**
 * Shared types, labels and formatting for the placement-office pages (G14a) and the India report packs (G3/G4).
 * Rupee amounts use Indian grouping (12,50,000) and lakh/crore display, whatever the page language.
 */

export const MODE_LABELS_KEYS = ["OnCampus", "Virtual", "PoolCampus", "OffCampus"];
/** mode labels in the career language (G1) */
export function usePlacementModeLabels(): Record<string, string> {
  return useCareerLabels("placementsShared.mode", MODE_LABELS_KEYS);
}
export const DRIVE_STATUS_LABELS_KEYS = ["Planned", "InProgress", "Completed", "Cancelled"];
/** drive status labels in the career language (G1) */
export function useDriveStatusLabels(): Record<string, string> {
  return useCareerLabels("placementsShared.driveStatus", DRIVE_STATUS_LABELS_KEYS);
}
export const RESULT_LABELS_KEYS = ["Cleared", "NotCleared", "Absent", "Pending"];
/** result labels in the career language (G1) */
export function useResultLabels(): Record<string, string> {
  return useCareerLabels("placementsShared.result", RESULT_LABELS_KEYS);
}
export const OFFER_STATUS_LABELS_KEYS = ["Offered", "Accepted", "Declined", "Revoked"];
/** offer status labels in the career language (G1) */
export function useOfferStatusLabels(): Record<string, string> {
  return useCareerLabels("placementsShared.offerStatus", OFFER_STATUS_LABELS_KEYS);
}
export const OFFER_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = { Offered: "info", Accepted: "good", Declined: "neutral", Revoked: "bad" };
export const RESULT_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = { Cleared: "good", NotCleared: "neutral", Absent: "warn", Pending: "info" };
export const KIND_LABELS_KEYS = ["HigherStudies", "QualifyingExam", "Entrepreneurship"];
/** kind labels in the career language (G1) */
export function useProgressionKindLabels(): Record<string, string> {
  return useCareerLabels("placementsShared.kind", KIND_LABELS_KEYS);
}
export const PROGRESSION_LEVEL_LABELS_KEYS = ["UGtoPG", "PGtoMPhil", "PGtoPhD", "MPhilToPhD", "PhDToPostDoc", "Other"];
/** progression level labels in the career language (G1) */
export function useProgressionLevelLabels(): Record<string, string> {
  return useCareerLabels("placementsShared.progressionLevel", PROGRESSION_LEVEL_LABELS_KEYS);
}
export const EXAM_LABELS_KEYS = ["CivilServices", "StateGovernment"];
/** exam labels in the career language (G1) */
export function useExamLabels(): Record<string, string> {
  return useCareerLabels("placementsShared.exam", EXAM_LABELS_KEYS);
}
export const ELIGIBILITY_LABELS_KEYS = ["eligible", "check", "notEligible"];
/** eligibility labels in the career language (G1) */
export function useEligibilityLabels(): Record<string, string> {
  return useCareerLabels("placementsShared.eligibility", ELIGIBILITY_LABELS_KEYS);
}

export const label = (map: Record<string, string>, key: string | null | undefined) => (key ? map[key] ?? key : "—");

/** Indian digit grouping: 1250000 -> "12,50,000" */
export function inrGrouped(amount: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(amount));
}

/** "₹12.5 lakh", "₹1.2 crore", "₹85,000" */
export function inrShort(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  const trim = (v: number) => String(Math.round(v * 100) / 100);
  if (amount >= 10_000_000) return `₹${trim(amount / 10_000_000)} crore`;
  if (amount >= 100_000) return `₹${trim(amount / 100_000)} lakh`;
  return `₹${inrGrouped(amount)}`;
}

/** Full amount with both forms, e.g. "₹12 lakh (₹12,00,000)" */
export function inrFull(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return amount >= 100_000 ? `${inrShort(amount)} (₹${inrGrouped(amount)})` : `₹${inrGrouped(amount)}`;
}

export interface StudentRef {
  membershipId: string;
  userId?: string | null;
  name: string;
  email: string;
  studentNumber?: string | null;
  signedIn?: boolean;
}

export interface AcademicRecord {
  id: string;
  membershipId: string;
  rollNumber?: string | null;
  degree: string;
  branch: string;
  programme: string;
  level: string;
  durationYears: number;
  admissionYear?: number | null;
  batch: number;
  lateralEntry: boolean;
  cgpa?: number | null;
  activeBacklogs?: number | null;
  totalBacklogs?: number | null;
  class10Percent?: number | null;
  class12Percent?: number | null;
  diplomaPercent?: number | null;
  graduatedOnTime?: boolean | null;
  optedOut: boolean;
}

export interface DriveRole {
  title: string;
  employmentType?: string;
  ctcAnnual?: number | null;
  stipendMonthly?: number | null;
}

export interface Drive {
  id: string;
  companyName: string;
  companyContact?: string | null;
  driveDate?: string | null;
  mode: string;
  location?: string | null;
  status: string;
  roles: DriveRole[];
  batches: number[];
  degrees: string[];
  branches: string[];
  minCgpa?: number | null;
  maxActiveBacklogs?: number | null;
  maxTotalBacklogs?: number | null;
  minClass10Percent?: number | null;
  minClass12Percent?: number | null;
  criteriaNotes?: string | null;
  excludePlaced: boolean;
  notes?: string | null;
}

export interface Offer {
  id: string;
  driveId?: string | null;
  membershipId: string;
  student?: StudentRef | null;
  companyName: string;
  roleTitle: string;
  employmentType: string;
  ctcAnnual?: number | null;
  stipendMonthly?: number | null;
  offerDate?: string | null;
  joiningDate?: string | null;
  location?: string | null;
  status: string;
  placementId?: string | null;
  outcomePending?: boolean;
  notes?: string | null;
}

export interface Vocabulary {
  modes: string[];
  driveStatuses: string[];
  roundResults: string[];
  offerStatuses: string[];
  employmentTypes: string[];
  levels: string[];
  progressionKinds: string[];
  progressionLevels: string[];
  exams: string[];
}

/** Comma- or line-separated text to a trimmed list */
export const splitList = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
