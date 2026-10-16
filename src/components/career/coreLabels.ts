/** Plain-language labels shared by the career-suite foundation pages (records, privacy, people, employers). */
import { useMemo } from "react";
import { useCareerLabels, useCareerT } from "@/components/career/ui";

export const ROLE_LABELS_KEYS = ["Student", "Alumni", "Counselor", "CareerAdmin", "EmployerRelations", "Faculty"];
/** role labels in the career language (G1) */
export function useRoleLabels(): Record<string, string> {
  return useCareerLabels("roles", ROLE_LABELS_KEYS);
}
export const ROLES = ROLE_LABELS_KEYS;

export const WORK_AUTH_LABELS_KEYS = ["USCitizen", "PermanentResident", "AsyleeRefugee", "F1", "J1", "H4EAD", "OtherVisa", "PreferNotToSay"];
/** work auth labels in the career language (G1) */
export function useWorkAuthLabels(): Record<string, string> {
  return useCareerLabels("coreLabels.workAuth", WORK_AUTH_LABELS_KEYS);
}

export const FERPA_CATEGORY_LABELS_KEYS = ["Profile", "ContactInfo", "Education", "Gpa", "WorkAuthorization", "Resume", "Transcript", "Documents", "Assessments", "EvidencePack", "Credentials", "Outcomes"];
/** ferpa category labels in the career language (G1) */
export function useFerpaCategoryLabels(): Record<string, string> {
  return useCareerLabels("coreLabels.ferpaCategory", FERPA_CATEGORY_LABELS_KEYS);
}

export const LEGAL_BASIS_LABELS_KEYS = ["Consent", "DirectoryInformation", "SchoolOfficial", "StudentSelf"];
/** legal basis labels in the career language (G1) */
export function useLegalBasisLabels(): Record<string, string> {
  return useCareerLabels("coreLabels.legalBasis", LEGAL_BASIS_LABELS_KEYS);
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "info";

const VERIFICATION_TONES: Record<string, Tone> = { Unverified: "warn", DomainVerified: "good", StaffVerified: "good", Flagged: "bad" };

/** Employer verification status: label, tone and a plain explanation, in the career language (G1). */
export function useVerification(): Record<string, { label: string; tone: Tone; explain: string }> {
  const t = useCareerT("coreLabels.verification");
  return useMemo(
    () => Object.fromEntries(Object.entries(VERIFICATION_TONES).map(([k, tone]) => [k, { label: t(`${k}.label`), tone, explain: t(`${k}.explain`) }])),
    [t],
  );
}

export const RELATIONSHIP_TONES: Record<string, Tone> = { Pending: "warn", Approved: "good", Declined: "neutral", Blocked: "bad" };
export const RELATIONSHIP_KEYS = ["Pending", "Approved", "Declined", "Blocked"];
/** Employer–school relationship statuses in the career language (G1) */
export function useRelationshipLabels(): Record<string, string> {
  return useCareerLabels("coreLabels.relationship", RELATIONSHIP_KEYS);
}

export function labelOf(map: Record<string, string>, key: string | null | undefined) {
  if (!key) return "—";
  return map[key] ?? key;
}
