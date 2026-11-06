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
