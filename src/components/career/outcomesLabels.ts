import { useCareerLabels } from "@/components/career/ui";
// Shared labels for D4 verified outcomes (staff outcomes page and the student "My next step" page)

export const EMPLOYMENT_TYPE_LABELS_KEYS = ["FullTime", "PartTime", "Internship", "Contract", "Fellowship", "ContinuingEducation", "Military", "Volunteer"];
/** employment type labels in the career language (G1) */
export function useEmploymentTypeLabels(): Record<string, string> {
  return useCareerLabels("outcomesLabels.employmentType", EMPLOYMENT_TYPE_LABELS_KEYS);
}

export const SOURCE_LABELS_KEYS = ["EmployerReported", "AtsWebhook", "HireWebhook", "StaffResearch", "PlatformImport", "StudentReported"];
/** source labels in the career language (G1) */
export function useSourceLabels(): Record<string, string> {
  return useCareerLabels("outcomesLabels.source", SOURCE_LABELS_KEYS);
}

export const VERIFICATION_LABELS_KEYS = ["EmployerVerified", "StaffConfirmed", "SelfReported"];
/** verification labels in the career language (G1) */
export function useVerificationLabels(): Record<string, string> {
  return useCareerLabels("outcomesLabels.verification", VERIFICATION_LABELS_KEYS);
}

export const VERIFICATION_TONE: Record<string, "good" | "info" | "neutral"> = {
  EmployerVerified: "good",
  StaffConfirmed: "info",
  SelfReported: "neutral",
};

export const SALARY_BAND_LABELS_KEYS = ["Under30k", "30to50k", "50to75k", "75to100k", "100to150k", "150kPlus"];
/** salary band labels in the career language (G1) */
export function useSalaryBandLabels(): Record<string, string> {
  return useCareerLabels("outcomesLabels.salaryBand", SALARY_BAND_LABELS_KEYS);
}

export const STATUS_LABELS_KEYS = ["Seeking", "NotSeeking"];
/** status labels in the career language (G1) */
export function useStatusLabels(): Record<string, string> {
  return useCareerLabels("outcomesLabels.status", STATUS_LABELS_KEYS);
}

export interface Placement {
  id: string;
  studentUserId: string;
  studentName?: string | null;
  studentEmail?: string | null;
  employerId?: string | null;
  employerName: string;
  title: string;
  employmentType: string;
  startDate?: string | null;
  location?: string | null;
  salaryBand?: string | null;
  source: string;
  verificationLevel: string;
  sources: string[];
  evidenceNotes?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  studentEditable: boolean;
}

export const emptyPlacementForm = { employerName: "", title: "", employmentType: "FullTime", startDate: "", location: "", salaryBand: "", evidenceNotes: "" };
export type PlacementForm = typeof emptyPlacementForm;

export const placementPayload = (f: PlacementForm) => ({
  employerName: f.employerName.trim(),
  title: f.title.trim(),
  employmentType: f.employmentType,
  startDate: f.startDate || null,
  location: f.location.trim() || null,
  salaryBand: f.salaryBand || null,
  evidenceNotes: f.evidenceNotes.trim() || null,
});
