// Shared types and helpers for candidate results, appeals, accommodations and written defenses

export const APPEAL_CATEGORIES = [
  { value: "TechnicalProblem", label: "Technical problem", hint: "Something broke during the assessment (crash, lost work, tests could not run)." },
  { value: "Accessibility", label: "Accessibility", hint: "The assessment was not accessible to you, or an accommodation was not applied." },
  { value: "IntegritySignalDisputed", label: "Integrity review", hint: "You believe your work is being questioned unfairly." },
  { value: "ScoringError", label: "Scoring error", hint: "A test, score or defense evaluation looks wrong." },
  { value: "Other", label: "Other", hint: "Anything else a reviewer should know." },
] as const;

export const ACCOMMODATION_TYPES = [
  { value: "ExtraTime", label: "Extra time" },
  { value: "WrittenDefense", label: "Written defense instead of voice" },
  { value: "ScreenReader", label: "Screen-reader support" },
  { value: "Other", label: "Other" },
] as const;

export const APPEAL_MIN = 50;
export const APPEAL_MAX = 4000;

export function categoryLabel(value: string) {
  return APPEAL_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function accommodationLabel(value: string) {
  return ACCOMMODATION_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function fmtDate(v: string | null | undefined) {
  return v ? new Date(v).toLocaleString() : "—";
}

// Reads { error } from a failed response, falling back to the HTTP status
export async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === "string" && body.error) return body.error;
  } catch {
    // non-JSON body
  }
  return `${fallback} (HTTP ${res.status}).`;
}

export const STATUS_STYLES: Record<string, string> = {
  Open: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Requested: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Upheld: "bg-muted text-muted-foreground border-border",
  Overturned: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Declined: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
  Withdrawn: "bg-muted text-muted-foreground border-border",
};

export function statusLabel(status: string) {
  if (status === "Upheld") return "Original result upheld";
  if (status === "Overturned") return "Appeal successful";
  return status;
}

export interface MySubmissionRow {
  submissionId: string;
  sprintId: string;
  sprintTitle: string;
  submittedAt: string;
  testStatus: string;
  passedTests: number;
  totalTests: number;
  defenseStatus: string;
  reviewStatus: string;
  outcome: string | null;
  hasOpenAppeal: boolean;
}

export interface AppealDto {
  id: string;
  submissionId?: string;
  sprintTitle?: string | null;
  category: string;
  reason: string;
  status: string;
  response: string | null;
  resolverName: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AccommodationDto {
  id: string;
  type: string;
  details: string;
  status: string;
  sprintId: string | null;
  sprintTitle?: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface SubmissionReport {
  submissionId: string;
  sprint: { id: string | null; title: string; language: string | null; taskType: string | null; aiPolicy: string | null };
  submittedAt: string;
  tests: { status: string; passed: number; total: number; cases: { name: string; passed: boolean }[] };
  defects: { title: string | null; fixedDefect: boolean }[];
  codeChanges: { file: string; linesAdded: number; linesRemoved: number; diff: string }[];
  defense: {
    sessionId: string;
    mode: "voice" | "written";
    status: string;
    technicalScore: number | null;
    communicationScore: number | null;
    missingSkills: string[];
    durationSeconds: number;
    recordingUrl: string | null;
    questionsAndAnswers: { question: string; answer: string }[];
  } | null;
  feedback: { summary: string; strengths: string[]; gaps: string[]; nextSteps: string[]; simulated: boolean; generatedAt: string } | null;
  review: { status: string; reviewedAt: string | null; outcomeShared: boolean; outcome: string | null; note: string | null };
  integrity: string;
  appeals: AppealDto[];
  canAppeal: boolean;
  accommodations: AccommodationDto[];
  writtenDefense: { eligible: boolean; reason: string; activeSessionId: string | null; alreadyDefended: boolean };
}

export interface WrittenDefenseState {
  sessionId: string;
  submissionId: string | null;
  sprintTitle: string | null;
  maxQuestions: number;
  answered: number;
  awaitingAnswer: boolean;
  canFinish: boolean;
  finished: boolean;
  simulated: boolean;
  turns: { role: "interviewer" | "candidate"; text: string; at: string }[];
  result: { technicalScore: number; communicationScore: number | null; missingSkills: string[] } | null;
  resultStatus: string | null;
}
