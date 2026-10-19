import { useCareerLabels } from "@/components/career/ui";
/**
 * H1 campus drives and the student job board: shared types and label hooks for the employer, placement-office and
 * student pages. Rupee amounts use the placement helpers (Indian grouping, lakh/crore).
 */

export const JOB_STATUS_KEYS = ["Draft", "Published", "Paused", "Closed", "Cancelled"];
export function useJobStatusLabels(): Record<string, string> {
  return useCareerLabels("campusShared.jobStatus", JOB_STATUS_KEYS);
}
export const APPROVAL_KEYS = ["Pending", "Approved", "Rejected", "Withdrawn"];
export function useApprovalLabels(): Record<string, string> {
  return useCareerLabels("campusShared.approval", APPROVAL_KEYS);
}
export const APP_STATUS_KEYS = ["Applied", "InProcess", "NotSelected", "Offered", "Accepted", "OfferDeclined", "Withdrawn"];
export function useAppStatusLabels(): Record<string, string> {
  return useCareerLabels("campusShared.appStatus", APP_STATUS_KEYS);
}
export const TIER_KEYS = ["Normal", "Dream", "SuperDream"];
export function useTierLabels(): Record<string, string> {
  return useCareerLabels("campusShared.tier", TIER_KEYS);
}
export const JOB_TYPE_KEYS = ["FullTime", "Internship", "PartTime", "Contract"];
export function useJobTypeLabels(): Record<string, string> {
  return useCareerLabels("campusShared.jobType", JOB_TYPE_KEYS);
}
export const DOC_KIND_KEYS = ["Resume", "Transcript", "Marksheet", "CoverLetter", "IdProof", "Portfolio", "Other"];
export function useDocKindLabels(): Record<string, string> {
  return useCareerLabels("campusShared.docKind", DOC_KIND_KEYS);
}
export const ELIG_KEYS = ["eligible", "notEligible", "dataMissing"];
export function useEligLabels(): Record<string, string> {
  return useCareerLabels("campusShared.eligibility", ELIG_KEYS);
}

export const APPROVAL_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = { Pending: "warn", Approved: "good", Rejected: "bad", Withdrawn: "neutral" };
export const APP_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = {
  Applied: "info", InProcess: "info", NotSelected: "neutral", Offered: "good", Accepted: "good", OfferDeclined: "neutral", Withdrawn: "neutral",
};
export const ELIG_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = { eligible: "good", notEligible: "bad", dataMissing: "warn" };

export interface Criteria {
  batches: number[];
  degrees: string[];
  branches: string[];
  minCgpa?: number | null;
  maxActiveBacklogs?: number | null;
  maxTotalBacklogs?: number | null;
  minClass10Percent?: number | null;
  minClass12Percent?: number | null;
  criteriaNotes?: string | null;
  excludePlaced?: boolean;
}

export interface CampusJob {
  id: string;
  employerId?: string | null;
  companyName: string;
  origin: string;
  title: string;
  jobType: string;
  description?: string | null;
  locations: string[];
  ctcAnnual?: number | null;
  ctcDisplay?: string | null;
  stipendMonthly?: number | null;
  ctcNotes?: string | null;
  degrees: string[];
  branches: string[];
  batches: number[];
  minCgpa?: number | null;
  maxActiveBacklogs?: number | null;
  rounds: string[];
  requiredDocuments: string[];
  applicationMode: string;
  applyDeadline?: string | null;
  visibility: string;
  status: string;
  premiumVisibility: boolean;
  source: string;
  hireStatus?: string | null;
  // H2: the Hire job this job is linked to
  externalSource?: string | null;
  externalJobId?: string | null;
  externalStatus?: string | null;
}

export interface CampusDrive {
  id: string;
  instituteId: string;
  school?: string | null;
  companyName: string;
  title: string;
  jobType: string;
  driveDate?: string | null;
  mode: string;
  location?: string | null;
  status: string;
  criteria: Criteria;
  origin: string;
  jobId?: string | null;
  employerId?: string | null;
  approvalStatus: string;
  approvalNote?: string | null;
  autoApproved: boolean;
  applicationsOpen: boolean;
  applyDeadline?: string | null;
  tier: string;
  ctcAnnual?: number | null;
  ctcDisplay?: string | null;
}

export interface CampusRound {
  id: string;
  sequence: number;
  name: string;
  roundDate?: string | null;
  ocrScheduleId?: string | null;
  shortlisted: number;
  pending: number;
  cleared: number;
  notCleared: number;
  slots: number;
}

export interface CampusOffer {
  id: string;
  applicationId?: string | null;
  companyName: string;
  roleTitle: string;
  ctcAnnual?: number | null;
  ctcDisplay?: string | null;
  joiningDate?: string | null;
  status: string;
  tier: string;
  respondBy?: string | null;
  policyOverride?: boolean;
  canRespond?: boolean;
  source?: string;
  // H5: the current offer letter (student view)
  letter?: { id: string; status: string; version: number; kind: string; signedAt?: string | null; hasSignedCopy: boolean } | null;
}

export interface Applicant {
  id: string;
  status: string;
  released: boolean;
  reason?: string | null;
  eligibilityAtApply?: string;
  eligibilityNow?: string;
  reasons?: string[];
  student?: {
    name: string;
    email: string;
    rollNumber?: string | null;
    degree?: string | null;
    branch?: string | null;
    batch?: number | null;
    cgpa?: number | null;
    activeBacklogs?: number | null;
    class10Percent?: number | null;
    class12Percent?: number | null;
  } | null;
  documents?: { fileId: string; kind: string; fileName: string }[];
  progress?: {
    rounds: { roundId: string; result?: string | null }[];
    slot?: { id: string; roundId: string; startUtc: string; location?: string | null; videoUrl?: string | null } | null;
    offer?: CampusOffer | null;
  };
}

/** Comma- or line-separated text to a trimmed list */
export const toList = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export const toNum = (s: string): number | undefined => {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

/** A local datetime-local input value to ISO UTC */
export const localToIso = (v: string): string | undefined => (v ? new Date(v).toISOString() : undefined);
