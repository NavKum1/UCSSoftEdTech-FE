import { formatDate } from "@/components/career/ui";

// Build & Defend 1.0 Stage 2: teachers' classes and assessments (API: /api/career/class-assessments)
export const CA_API = "/api/career/class-assessments";

export type Template = "project" | "coding" | "exam";
export type VivaMode = "voice" | "text" | "choice";

export interface Teacher {
  userId: string;
  name: string;
  email: string;
  role: "Owner" | "CoTeacher";
}

export interface ClassSummary {
  id: string;
  name: string;
  program: string;
  graduationYear: number | null;
  students: number;
  signedIn: number;
  assessments: number;
  myRole: string | null;
  teachers: Teacher[];
}

export interface ClassDetail {
  id: string;
  name: string;
  program: string;
  graduationYear: number | null;
  canManage: boolean;
  myUserId: string;
  members: { id: string; name: string; email: string; rollNumber: string; branch: string; signedIn: boolean }[];
  teachers: Teacher[];
  assignments: { id: string; assessmentId: string; title: string; template: Template; opensAt: string; dueAt: string; acceptLate: boolean }[];
}

export interface Criterion {
  key: string;
  name: string;
  description: string;
  weight: number;
}

export interface TemplateInfo {
  key: Template;
  name: string;
  description: string;
  rubric: Criterion[];
}

export interface AssessmentDetail {
  id: string;
  title: string;
  instructions: string;
  template: Template;
  sprintId: string | null;
  examId: string | null;
  rubric: Criterion[];
  vivaMode: VivaMode;
  vivaQuestions: number;
  vivaMinutes: number;
  vivaLanguage: string | null;
  changeTask: boolean;
  changeTaskMinutes: number;
  status: "Draft" | "Published" | "Archived";
  canEdit: boolean;
  locked: boolean;
  assignments: { id: string; classId: string; className: string; opensAt: string; dueAt: string; acceptLate: boolean }[];
}

export interface AssessmentSummary {
  id: string;
  title: string;
  template: Template;
  status: string;
  updatedAt: string;
  mine: boolean;
  classes: { assignmentId: string; classId: string; className: string; dueAt: string }[];
  toReview: number;
}

export type StudentState = "upcoming" | "open" | "late" | "closed" | "in-progress" | "submitted" | "decided";

export interface StudentAssessmentSummary {
  assignmentId: string;
  title: string;
  template: Template;
  className: string;
  opensAt: string;
  dueAt: string;
  acceptLate: boolean;
  state: StudentState;
  decision: "pass" | "resubmit" | "fail" | null;
  score: number | null;
}

export interface StudentAssessmentDetail extends StudentAssessmentSummary {
  teachers: string[];
  instructions: string | null;
  task: { kind: "coding" | "exam"; title: string; language: string | null; minutes: number | null } | null;
  rubric: { name: string; description: string; weight: number }[];
  viva: { mode: VivaMode; questions: number; minutes: number; language: string };
  changeTaskMinutes: number | null;
  comment: string | null;
}

export interface TaskChoices {
  codingTasks: { id: string; title: string; language: string; schools: boolean }[];
  exams: { id: string; title: string; durationMinutes: number }[];
}

/** "2026-11-13T17:00" for a datetime-local input, in the browser's time */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Date and time in the career locale (US English unless the school or user chose otherwise) */
export function formatWhen(iso: string) {
  return formatDate(iso, true);
}

// ----- 2.7: the evidence for teachers -----

export type AttemptStatus = "Started" | "Viva" | "Submitted" | "Decided";
export type WorkKind = "repo" | "upload" | "sprint" | "exam";
/** ready | after_viva (not handed in yet) | pending (being worked out) | off (no AI key) | none (the AI couldn't) */
export type SuggestionState = "ready" | "after_viva" | "pending" | "off" | "none";
export type Decision = "pass" | "resubmit" | "fail";

export interface StudentRow {
  memberId: string | null;
  userId: string | null;
  name: string;
  email: string;
  rollNumber: string;
  signedIn: boolean;
  inClass: boolean;
  attempt: {
    id: string;
    number: number;
    attempts: number;
    status: AttemptStatus;
    late: boolean;
    startedAt: string;
    submittedAt: string | null;
    workKind: WorkKind | null;
    vivaStarted: boolean;
    voiceTries: number;
    suggestions: SuggestionState;
    decision: Decision | null;
    score: number | null;
  } | null;
}

export interface AssignmentStudents {
  assessment: { id: string; title: string; template: Template; vivaMode: VivaMode };
  class: { id: string; name: string };
  assignment: { id: string; opensAt: string; dueAt: string; acceptLate: boolean };
  counts: { students: number; notStarted: number; working: number; vivaNext: number; toReview: number; decided: number };
  students: StudentRow[];
}

export interface EvidenceFile {
  path: string;
  content: string;
  linesByStudent?: number;
}

export type EvidenceWork =
  | { kind: WorkKind; gone: true }
  | { kind: "repo"; gone?: undefined; repository: string; pullRequest: number | null; url: string; ownershipVerified: boolean; files: EvidenceFile[] }
  | { kind: "upload"; gone?: undefined; fileName: string; sizeBytes: number; uploadedAt: string; files: EvidenceFile[]; listing: string[] }
  | {
      kind: "sprint";
      gone?: undefined;
      title: string | null;
      tests: { passed: number; total: number; status: string; cases: Record<string, boolean> };
      changes: { file: string; linesAdded: number; linesRemoved: number; diff: string }[];
      aiUse: { prompts: number; shareOfFinalCodeFromAssistant: number; conversation: { at: string; prompt: string; response: string; charactersUsed: number }[] } | null;
    }
  | {
      kind: "exam";
      gone?: undefined;
      title: string;
      correct: number;
      total: number;
      percentage: number;
      startedAt: string | null;
      submittedAt: string | null;
      answers: { number: number; question: string; code: string | null; answer: string | null; correctAnswer: string | null; correct: boolean }[];
    };

export type EvidenceViva =
  | { state: "not_done" | "not_yet" | "missing"; voiceTries: number }
  | {
      state: "done";
      mode: "voice" | "typed" | "typed_after_voice";
      language: string | null;
      startedAt: string;
      seconds: number;
      voiceTries: number;
      answered: number;
      asked: number;
      turns: { who: "ai" | "student"; text: string }[];
    };

export interface EvidenceSignal {
  code: string;
  tone: "info" | "warn";
  values: Record<string, unknown>;
}

export interface AttemptEvidence {
  id: string;
  evidenceHash: string;
  student: { userId: string; name: string; email: string; rollNumber: string | null; inClass: boolean };
  assessment: { id: string; title: string; template: Template; instructions: string; vivaMode: VivaMode; vivaQuestions: number };
  class: { id: string; name: string | null; assignmentId: string; dueAt: string; acceptLate: boolean };
  attempt: {
    number: number;
    status: AttemptStatus;
    startedAt: string;
    submittedAt: string | null;
    late: boolean;
    vivaStartedAt: string | null;
    decision: Decision | null;
    score: number | null;
    comment: string | null;
    decidedBy: string | null;
    decidedAt: string | null;
  };
  attempts: { id: string; number: number; status: AttemptStatus }[];
  work: EvidenceWork | null;
  viva: EvidenceViva;
  suggestions: {
    state: SuggestionState;
    at: string | null;
    criteria: { key: string; name: string; description: string; weight: number; score: number | null; reason: string | null; quote: string | null; quoteFrom: string | null }[];
  };
  signals: EvidenceSignal[];
  review: AttemptReview;
  /** The work or viva changed after the decision was made (the fingerprint differs) */
  evidenceChangedSinceDecision: boolean;
}

// ----- 2.8: the decision, the appeal and the review queue -----

export type AppealStatus = "Open" | "Upheld" | "Changed";

export interface AttemptReview {
  id: string;
  status: AttemptStatus;
  decision: {
    value: Decision;
    score: number | null;
    comment: string | null;
    by: string | null;
    at: string | null;
    evidenceHash: string | null;
    scores: { key: string; score: number; suggested: number | null }[];
  } | null;
  appeal: { status: AppealStatus; reason: string | null; at: string | null; response: string | null; by: string | null; resolvedAt: string | null; canResolve: boolean } | null;
}

export interface ReviewRow {
  attemptId: string;
  assessment: string;
  class: string;
  student: string;
  number: number;
  submittedAt: string | null;
  late: boolean;
  suggested: boolean;
  appealedAt: string | null;
  decidedBy: string | null;
}

export interface ReviewQueue {
  toDecide: ReviewRow[];
  appeals: ReviewRow[];
}

/** What the student sees once their attempt is decided (no AI suggestions) */
export interface StudentResult {
  decision: Decision;
  score: number | null;
  comment: string | null;
  decidedAt: string | null;
  number: number;
  criteria: { key: string; name: string; weight: number; score: number | null }[];
  appeal: { status: AppealStatus; reason: string | null; at: string | null; response: string | null; resolvedAt: string | null } | null;
  canAppeal: boolean;
  appealUntil: string | null;
}
