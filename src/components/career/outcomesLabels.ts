// Shared labels for D4 verified outcomes (staff outcomes page and the student "My next step" page)

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FullTime: "Full-time job",
  PartTime: "Part-time job",
  Internship: "Internship",
  Contract: "Contract",
  Fellowship: "Fellowship",
  ContinuingEducation: "Continuing education",
  Military: "Military service",
  Volunteer: "Volunteer or service",
};

export const SOURCE_LABELS: Record<string, string> = {
  EmployerReported: "Employer offer (on-campus recruiting)",
  AtsWebhook: "Employer applicant tracking system",
  HireWebhook: "Employer hiring system",
  StaffResearch: "Career center research",
  StudentReported: "Student",
};

export const VERIFICATION_LABELS: Record<string, string> = {
  EmployerVerified: "Verified by employer",
  StaffConfirmed: "Confirmed by staff",
  SelfReported: "Self-reported",
};

export const VERIFICATION_TONE: Record<string, "good" | "info" | "neutral"> = {
  EmployerVerified: "good",
  StaffConfirmed: "info",
  SelfReported: "neutral",
};

export const SALARY_BAND_LABELS: Record<string, string> = {
  Under30k: "Under $30,000",
  "30to50k": "$30,000–$49,999",
  "50to75k": "$50,000–$74,999",
  "75to100k": "$75,000–$99,999",
  "100to150k": "$100,000–$149,999",
  "150kPlus": "$150,000 or more",
};

export const STATUS_LABELS: Record<string, string> = { Seeking: "Still looking", NotSeeking: "Not looking right now" };

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
