/** Plain-language labels shared by the career-suite foundation pages (records, privacy, people, employers). */

export const ROLE_LABELS: Record<string, string> = {
  Student: "Student",
  Alumni: "Alumni",
  Counselor: "Counselor",
  CareerAdmin: "Career center admin",
  EmployerRelations: "Employer relations",
  Faculty: "Faculty",
};
export const ROLES = Object.keys(ROLE_LABELS);

export const WORK_AUTH_LABELS: Record<string, string> = {
  USCitizen: "U.S. citizen",
  PermanentResident: "Permanent resident",
  AsyleeRefugee: "Asylee or refugee",
  F1: "F-1 student visa",
  J1: "J-1 exchange visitor",
  H4EAD: "H-4 EAD",
  OtherVisa: "Other visa",
  PreferNotToSay: "Prefer not to say",
};

export const FERPA_CATEGORY_LABELS: Record<string, string> = {
  Profile: "Name and profile",
  ContactInfo: "Contact information",
  Education: "Education (school, degree, major, graduation)",
  Gpa: "GPA",
  WorkAuthorization: "Work authorization",
  Resume: "Resume",
  Transcript: "Transcript",
  Documents: "Documents",
  Assessments: "Assessments",
  EvidencePack: "Evidence pack",
  Credentials: "Credentials",
  Outcomes: "Outcomes",
};

export const LEGAL_BASIS_LABELS: Record<string, string> = {
  Consent: "Your consent",
  DirectoryInformation: "Directory information",
  SchoolOfficial: "School official",
  StudentSelf: "You",
};

export type Tone = "neutral" | "good" | "warn" | "bad" | "info";

export const VERIFICATION: Record<string, { label: string; tone: Tone; explain: string }> = {
  Unverified: { label: "Unverified", tone: "warn", explain: "We couldn't confirm the company automatically. Schools may ask for more detail before approving requests." },
  DomainVerified: { label: "Domain verified", tone: "good", explain: "Your sign-in email matches the company website's domain." },
  StaffVerified: { label: "Staff verified", tone: "good", explain: "Platform staff reviewed and verified this company." },
  Flagged: { label: "Under review", tone: "bad", explain: "This account is under review. You can't request new schools until the review is finished." },
};

export const RELATIONSHIP_TONES: Record<string, Tone> = { Pending: "warn", Approved: "good", Declined: "neutral", Blocked: "bad" };

export function labelOf(map: Record<string, string>, key: string | null | undefined) {
  if (!key) return "—";
  return map[key] ?? key;
}
