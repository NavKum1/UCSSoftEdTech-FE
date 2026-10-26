/**
 * Career guidance forms v2 (API: /api/guidance-forms, /api/public/guidance): the form definition, and the logic shared by
 * the form people fill in and the editor's preview (which questions show, translations, time estimate, checks).
 */

export type Kind = "choice" | "multi" | "dropdown" | "text" | "longtext" | "number" | "date" | "email" | "phone" | "yesno" | "scale" | "file" | "consent" | "info";

export interface FormText {
  label?: string | null;
  help?: string | null;
  placeholder?: string | null;
  options?: string[] | null;
  title?: string | null;
  description?: string | null;
  /** Form settings: the notice shown while the form saves as people go */
  notice?: string | null;
}

export interface Condition {
  questionId: string;
  op: "is" | "isNot" | "includes" | "answered";
  value?: string | null;
}

export interface Rule {
  when: string;
  tag?: string | null;
  ownerMemberId?: string | null;
  priority?: "High" | null;
}

export interface Question {
  id: string;
  sectionId: string;
  kind: Kind;
  label: string;
  help?: string | null;
  placeholder?: string | null;
  required: boolean;
  options: string[];
  allowOther?: boolean;
  min?: number | null;
  max?: number | null;
  minLabel?: string | null;
  maxLabel?: string | null;
  showIf?: Condition | null;
  rules?: Rule[];
  translations?: Record<string, FormText>;
}

export interface Section {
  id: string;
  title: string;
  description?: string | null;
  showIf?: Condition | null;
  translations?: Record<string, FormText>;
}

export interface Settings {
  title?: string | null;
  intro?: string | null;
  thankYou?: string | null;
  redirectUrl?: string | null;
  accent?: string | null;
  logoUrl?: string | null;
  askUnsure: boolean;
  askPhone: boolean;
  phoneRequired: boolean;
  /** Website inquiries reach the CRM only after the person confirms their email (on by default) */
  requireEmailConfirmation?: boolean;
  /** Website inquiries need the phone checked by an SMS code */
  requirePhoneCheck?: boolean;
  /** Website forms: what people give reaches the CRM as an Incomplete lead as they go (off by default) */
  savePartial?: boolean;
  /** null: after the contact details (then asked first); else a question id (saved once people move past its step) */
  partialAfter?: string | null;
  /** Incomplete leads nobody worked on are removed after this many days (1–365, 30 by default) */
  partialRetentionDays?: number;
  /** Email the team when someone stops part way */
  notifyOnPartial?: boolean;
  /** The notice shown while saving as people go ({institute} is the institute's name); empty: the built-in one */
  partialNotice?: string | null;
  translations?: Record<string, FormText>;
}

export interface FormDef {
  languages: string[];
  sections: Section[];
  questions: Question[];
  settings: Settings;
}

/** A form ready to fill in */
export interface Fillable {
  formId: string;
  name: string;
  version: number;
  instituteId: string;
  instituteName: string;
  definition: FormDef;
  languageNames: Record<string, string>;
  /** Website forms: when the form was opened, signed by the server */
  startToken?: string;
  /** Website forms: Cloudflare Turnstile, when Edulexa has it set up */
  turnstileSiteKey?: string | null;
}

/** An answer as the form holds it */
export interface Answer {
  value?: string;
  values?: string[];
  other?: string;
  files?: { id: string; name: string; size: number }[];
}
export type Answers = Record<string, Answer>;

export const KINDS: { kind: Kind; label: string; hint: string }[] = [
  { kind: "choice", label: "Single choice", hint: "Pick one (buttons)" },
  { kind: "multi", label: "Multiple choice", hint: "Pick several" },
  { kind: "dropdown", label: "Dropdown", hint: "Pick one from a list" },
  { kind: "text", label: "Short answer", hint: "One line" },
  { kind: "longtext", label: "Long answer", hint: "A few lines" },
  { kind: "yesno", label: "Yes / No", hint: "Two buttons" },
  { kind: "scale", label: "Rating scale", hint: "1 to 5, 0 to 10…" },
  { kind: "number", label: "Number", hint: "With limits" },
  { kind: "date", label: "Date", hint: "Calendar" },
  { kind: "email", label: "Email", hint: "Checked format" },
  { kind: "phone", label: "Phone", hint: "Checked format" },
  { kind: "file", label: "File upload", hint: "CV, marksheet (5 MB)" },
  { kind: "consent", label: "Consent checkbox", hint: "Must be ticked" },
  { kind: "info", label: "Text block", hint: "Instructions, no answer" },
];
export const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.kind, k.label]));
export const WITH_OPTIONS: Kind[] = ["choice", "multi", "dropdown"];

export const OTHER = "__other__";

/** Text in the chosen language, falling back to the form's own */
export function tr(t: Record<string, FormText> | undefined, lang: string, key: keyof FormText, fallback: string | null | undefined): string {
  const v = t?.[lang]?.[key];
  return (typeof v === "string" && v.trim() ? v : fallback) ?? "";
}

export function trOptions(q: Question, lang: string): string[] {
  const o = q.translations?.[lang]?.options;
  return o && o.length === q.options.length ? o.map((x, i) => x || q.options[i]) : q.options;
}

function matches(c: Condition | null | undefined, answers: Answers): boolean {
  if (!c || !c.questionId) return true;
  const a = answers[c.questionId];
  const single = (a?.value ?? "").trim();
  const multi = a?.values ?? [];
  switch (c.op) {
    case "answered":
      return single.length > 0 || multi.length > 0 || (a?.files?.length ?? 0) > 0;
    case "is":
      return single === c.value;
    case "isNot":
      return single !== c.value;
    case "includes":
      return multi.includes(c.value ?? "");
    default:
      return true;
  }
}

export const sectionVisible = (def: FormDef, s: Section, answers: Answers) => matches(s.showIf, answers);
export const questionVisible = (def: FormDef, q: Question, answers: Answers) => {
  const s = def.sections.find((x) => x.id === q.sectionId);
  return (!s || matches(s.showIf, answers)) && matches(q.showIf, answers);
};

/** Roughly how long the form takes, in minutes */
export function estimateMinutes(def: FormDef): number {
  const secs = def.questions.reduce((n, q) => n + (({ longtext: 45, file: 30, text: 15, multi: 15, info: 8 } as Record<string, number>)[q.kind] ?? 10), def.settings.askUnsure ? 75 : 30);
  return Math.max(1, Math.round(secs / 60));
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;

/** The problem with an answer, or null (checked again by the server) */
export function check(q: Question, a: Answer | undefined): string | null {
  if (q.kind === "info") return null;
  const v = (a?.value ?? "").trim();
  const picked = (a?.values ?? []).filter((x) => x !== OTHER);
  const otherPicked = (a?.values ?? []).includes(OTHER);
  if (q.kind === "multi" && otherPicked && !(a?.other ?? "").trim()) return 'Please say what "Other" is.';
  const n = picked.length + (otherPicked && (a?.other ?? "").trim() ? 1 : 0);
  const empty = q.kind === "multi" ? n === 0 : q.kind === "file" ? (a?.files?.length ?? 0) === 0 : v.length === 0;
  if (empty) return q.required ? (q.kind === "consent" ? "Please tick this to continue." : "Please answer this question.") : null;
  if ((q.kind === "choice" || q.kind === "dropdown") && v === OTHER && !(a?.other ?? "").trim()) return 'Please say what "Other" is.';
  if (q.kind === "multi") {
    if (q.min != null && n < q.min) return `Choose at least ${q.min}.`;
    if (q.max != null && n > q.max) return `Choose at most ${q.max}.`;
  }
  if (q.kind === "number") {
    const x = Number(v);
    if (!Number.isFinite(x)) return "Enter a number.";
    if (q.min != null && x < q.min) return `Enter ${q.min} or more.`;
    if (q.max != null && x > q.max) return `Enter ${q.max} or less.`;
  }
  if (q.kind === "email" && !EMAIL.test(v)) return "Enter a valid email address.";
  if (q.kind === "phone" && !PHONE.test(v)) return "Enter a valid phone number.";
  return null;
}

/** The answers in the API's shape (visible, answered questions only) */
export function toApi(def: FormDef, answers: Answers) {
  return def.questions
    .filter((q) => q.kind !== "info" && questionVisible(def, q, answers))
    .map((q) => {
      const a = answers[q.id] ?? {};
      const otherOn = a.value === OTHER || (a.values ?? []).includes(OTHER);
      return {
        questionId: q.id,
        answer: a.value ?? null,
        values: a.values?.filter((x) => x !== OTHER) ?? null,
        other: otherOn ? (a.other ?? "").trim() || null : null,
        fileIds: a.files?.map((f) => f.id) ?? null,
      };
    })
    .filter((x) => x.answer || x.values?.length || x.other || x.fileIds?.length);
}

export function newId() {
  return Math.random().toString(16).slice(2, 14);
}

/** Readable text on the accent colour */
export function onAccent(hex: string | null | undefined): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#111827" : "#ffffff";
}
