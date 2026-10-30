/**
 * Career guidance forms v2 (API: /api/guidance-forms, /api/public/guidance): the form definition, and the logic shared by
 * the form people fill in and the editor's preview (which questions show, translations, time estimate, checks).
 */

export type Kind = "choice" | "multi" | "dropdown" | "text" | "longtext" | "number" | "date" | "email" | "phone" | "yesno" | "scale" | "slider" | "list" | "file" | "consent" | "info" | "booking";

export interface FormText {
  label?: string | null;
  help?: string | null;
  placeholder?: string | null;
  options?: string[] | null;
  title?: string | null;
  description?: string | null;
  /** Form settings: the notice shown while the form saves as people go */
  notice?: string | null;
  /** scale, slider: the words at each end */
  minLabel?: string | null;
  maxLabel?: string | null;
  /** list: the column names, and each column's choices (one to one with the form's own) */
  columns?: string[] | null;
  columnOptions?: string[][] | null;
}

/** The results' words in another language (outcomes and bands one to one with the form's own) */
export interface ResultsText {
  outcomeTitle?: string | null;
  matchTitle?: string | null;
  /** name and summary of each outcome */
  outcomes?: { name?: string | null; summary?: string | null }[] | null;
  /** label (as name) and message (as summary) of each band */
  bands?: { name?: string | null; summary?: string | null }[] | null;
}

/** A note for the counsellor beside an answer in the CRM (never shown to the person) */
export interface Tip {
  /** an option, Yes or No, left or right (sliders), or answered (any answer) */
  when: string;
  text: string;
}

export type MeetingMode = "InPerson" | "Video" | "Phone";
export const MEETING_MODES: { mode: MeetingMode; label: string }[] = [
  { mode: "Phone", label: "Phone call" },
  { mode: "Video", label: "Video call" },
  { mode: "InPerson", label: "In person" },
];

/** A "Book a meeting" question: a request (a day and time of day; the team confirms) or a free time from counsellors' hours */
export interface Booking {
  mode: "request" | "slots";
  /** slots: the appointment type (Career centre → Appointments) */
  typeId?: string | null;
  modes: MeetingMode[];
  /** request: how many days ahead they can pick */
  daysAhead: number;
  timeZone: string;
}

/** A message the form sends by itself */
export interface Automation {
  id: string;
  name: string;
  active: boolean;
  /** sent, stopped (part way), booking (a meeting asked for) */
  trigger: "sent" | "stopped" | "booking";
  delayMinutes: number;
  /** email (to the person), team (email to the team: toOwner, members, emails), sms, whatsapp */
  channel: "email" | "team" | "sms" | "whatsapp";
  /** team: to the lead's owner (else the CRM admins); on unless set to false */
  toOwner?: boolean;
  /** team: these CRM team members too (ids) */
  members?: string[];
  /** team: these addresses too (e.g. an admissions inbox) */
  emails?: string[];
  subject?: string | null;
  body?: string | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  variables?: string[];
  dltTemplateId?: string | null;
  outcome?: string | null;
  matchFrom?: number | null;
  matchTo?: number | null;
  unlessReportOpened?: boolean;
  unlessMeeting?: boolean;
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

/** A column of a "list" question: typed, or picked from options */
export interface ListColumn {
  id: string;
  label: string;
  options: string[];
}

/** What an answer counts for in the results. Sliders: when is "left" or "right" (counts by how far towards that end) */
export interface Score {
  when: string;
  outcomes: string[];
  match?: number | null;
}

export interface Outcome {
  id: string;
  name: string;
  /** Shown to the person */
  summary?: string | null;
  /** Shown to the counsellor */
  coaching?: string | null;
}

/** From this percentage up (the highest band reached applies) */
export interface Band {
  from: number;
  label: string;
  message?: string | null;
  coaching?: string | null;
}

export interface Results {
  outcomeEnabled: boolean;
  outcomeTitle?: string | null;
  outcomes: Outcome[];
  matchEnabled: boolean;
  matchTitle?: string | null;
  bands: Band[];
  showToPerson: boolean;
  /** per language code: the words the person reads */
  translations?: Record<string, ResultsText>;
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
  columns?: ListColumn[];
  showIf?: Condition | null;
  rules?: Rule[];
  scores?: Score[];
  /** Notes for the counsellor beside the answer in the CRM */
  tips?: Tip[];
  /** booking: how the meeting is arranged */
  booking?: Booking | null;
  /** The card on the person's profile (People) the answer shows on */
  profileCard?: "background" | "logistics" | "motivation" | null;
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
  /** classic: a plain card; cover: a full-page photo (or the colour) behind the card, step titles over it */
  layout?: "classic" | "cover";
  backgroundUrl?: string | null;
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
  results?: Results | null;
  /** Messages the form sends by itself (the editor only; not on the public form) */
  automations?: Automation[];
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
  /** list: one entry per row, column id → value */
  rows?: Record<string, string>[];
  /** booking: the meeting they ask for */
  booking?: BookingAnswer;
}

export interface BookingAnswer {
  topics?: string[];
  /** request: yyyy-mm-dd */
  date?: string;
  /** request: morning, afternoon, evening or any */
  timeOfDay?: string;
  mode?: MeetingMode;
  /** slots: the picked start (UTC ISO), and how it reads to the person */
  start?: string;
  startLabel?: string;
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
  { kind: "slider", label: "Slider", hint: "Between two ends" },
  { kind: "list", label: "List of rows", hint: "e.g. supporters" },
  { kind: "number", label: "Number", hint: "With limits" },
  { kind: "date", label: "Date", hint: "Calendar" },
  { kind: "email", label: "Email", hint: "Checked format" },
  { kind: "phone", label: "Phone", hint: "Checked format" },
  { kind: "file", label: "File upload", hint: "CV, marksheet (5 MB)" },
  { kind: "consent", label: "Consent checkbox", hint: "Must be ticked" },
  { kind: "info", label: "Text block", hint: "Instructions, no answer" },
  { kind: "booking", label: "Book a meeting", hint: "Next steps: a day or a free time" },
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

/**
 * A list's columns in the chosen language: the name, and optionLabels beside the form's own options (the answer stays
 * the form's own choice, which the server checks; only what the person reads is translated).
 */
export function trColumns(q: Question, lang: string): (ListColumn & { optionLabels: string[] })[] {
  const t = q.translations?.[lang];
  return (q.columns ?? []).map((c, i) => {
    const opts = t?.columnOptions?.[i];
    return {
      ...c,
      label: t?.columns?.[i]?.trim() || c.label,
      optionLabels: c.options.map((o, j) => (opts && opts.length === c.options.length && opts[j]?.trim() ? opts[j] : o)),
    };
  });
}

/** The results' words in the chosen language */
export function trResult(def: FormDef, result: FormResult, lang: string): FormResult {
  const t = def.results?.translations?.[lang];
  if (!t || !def.results) return result;
  const oi = result.outcome ? def.results.outcomes.findIndex((o) => o.id === result.outcome!.id) : -1;
  const sorted = def.results.bands;
  const bi = result.match ? sorted.findIndex((b) => b.label === result.match!.label) : -1;
  return {
    ...result,
    outcomeTitle: t.outcomeTitle?.trim() || result.outcomeTitle,
    matchTitle: t.matchTitle?.trim() || result.matchTitle,
    outcome: result.outcome && oi >= 0 ? { ...result.outcome, name: t.outcomes?.[oi]?.name?.trim() || result.outcome.name, summary: t.outcomes?.[oi]?.summary?.trim() || result.outcome.summary } : result.outcome,
    match: result.match && bi >= 0 ? { ...result.match, label: t.bands?.[bi]?.name?.trim() || result.match.label, message: t.bands?.[bi]?.summary?.trim() || result.match.message } : result.match,
  };
}

/** A booking answer counts once it has a day (requests) or a picked time (free times) */
export const bookingGiven = (a: Answer | undefined) => !!(a?.booking?.start || a?.booking?.date);

function matches(def: FormDef, c: Condition | null | undefined, answers: Answers): boolean {
  if (!c || !c.questionId) return true;
  const a = answers[c.questionId];
  const single = (a?.value ?? "").trim();
  const multi = a?.values ?? [];
  // A list counts as answered with a row that has something in one of its columns (as the server checks it)
  const list = def.questions.find((q) => q.id === c.questionId && q.kind === "list");
  switch (c.op) {
    case "answered":
      return single.length > 0 || multi.length > 0 || (a?.files?.length ?? 0) > 0 || (!!list && filledRows(list, a).length > 0) || bookingGiven(a);
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

export const sectionVisible = (def: FormDef, s: Section, answers: Answers) => matches(def, s.showIf, answers);
export const questionVisible = (def: FormDef, q: Question, answers: Answers) => {
  const s = def.sections.find((x) => x.id === q.sectionId);
  return (!s || matches(def, s.showIf, answers)) && matches(def, q.showIf, answers);
};

/** Roughly how long the form takes, in minutes */
export function estimateMinutes(def: FormDef): number {
  const secs = def.questions.reduce((n, q) => n + (({ longtext: 45, list: 40, file: 30, booking: 30, text: 15, multi: 15, info: 8, slider: 6 } as Record<string, number>)[q.kind] ?? 10), def.settings.askUnsure ? 75 : 30);
  return Math.max(1, Math.round(secs / 60));
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;

/** The problem with an answer, or null (checked again by the server) */
export function check(q: Question, a: Answer | undefined): string | null {
  if (q.kind === "info") return null;
  if (q.kind === "booking") {
    const b = a?.booking;
    if (!bookingGiven(a)) return q.required ? (q.booking?.mode === "slots" ? "Please pick a time." : "Please choose a day.") : null;
    if ((q.booking?.modes?.length ?? 0) > 1 && !b?.mode) return "Please choose how you'd like to meet.";
    return null;
  }
  const v = (a?.value ?? "").trim();
  const picked = (a?.values ?? []).filter((x) => x !== OTHER);
  const otherPicked = (a?.values ?? []).includes(OTHER);
  if (q.kind === "multi" && otherPicked && !(a?.other ?? "").trim()) return 'Please say what "Other" is.';
  const n = picked.length + (otherPicked && (a?.other ?? "").trim() ? 1 : 0);
  const rows = q.kind === "list" ? filledRows(q, a) : [];
  const empty = q.kind === "multi" ? n === 0 : q.kind === "file" ? (a?.files?.length ?? 0) === 0 : q.kind === "list" ? rows.length === 0 : v.length === 0;
  if (empty) return q.required ? (q.kind === "consent" ? "Please tick this to continue." : q.kind === "list" ? "Please add at least one." : "Please answer this question.") : null;
  if (q.kind === "list") {
    const first = q.columns?.[0];
    if (first && rows.some((r) => !(r[first.id] ?? "").trim())) return `Please fill in “${first.label}” on each row.`;
    if (rows.length > (q.max ?? 5)) return `Add at most ${q.max ?? 5}.`;
  }
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
        rows: q.kind === "list" ? filledRows(q, a) : null,
        booking:
          q.kind === "booking" && bookingGiven(a)
            ? {
                topics: a.booking?.topics ?? [],
                date: q.booking?.mode === "slots" ? null : a.booking?.date ?? null,
                timeOfDay: q.booking?.mode === "slots" ? null : a.booking?.timeOfDay ?? "any",
                mode: a.booking?.mode ?? (q.booking?.modes?.length === 1 ? q.booking.modes[0] : null),
                start: q.booking?.mode === "slots" ? a.booking?.start ?? null : null,
              }
            : null,
      };
    })
    .filter((x) => x.answer || x.values?.length || x.other || x.fileIds?.length || x.rows?.length || x.booking);
}

/** list: the rows with anything in them */
export function filledRows(q: Question, a: Answer | undefined): Record<string, string>[] {
  const cols = q.columns ?? [];
  return (a?.rows ?? []).filter((r) => cols.some((c) => (r[c.id] ?? "").trim()));
}

/** A slider's middle position (where it starts, and the answer when it's left there) */
export const sliderMiddle = (q: Question) => String(Math.round(((q.min ?? 1) + (q.max ?? 7)) / 2));

export interface FormResult {
  outcomeTitle?: string | null;
  outcome?: Outcome | null;
  points: { name: string; points: number }[];
  matchTitle?: string | null;
  match?: { percent: number; label?: string | null; message?: string | null } | null;
}

/**
 * The form's results from the answers: the same rules as the server (Services/Counselling/GuidanceScoring.cs), which
 * keeps its own copy for the CRM. Outcome: each answer gives a point to the outcomes it lists (a slider up to one point,
 * by how far towards that end); the most points wins, ties going to the outcome listed first. Match: the answers' match
 * points out of the most every question shown could give (a multi-pick question: its best answers, up to how many may
 * be picked), as a percentage, in the highest band reached (one band always starts at 0%). A skipped question gives no
 * points; no scored question answered, no match.
 */
export function computeResult(def: FormDef, answers: Answers): FormResult | null {
  const r = def.results;
  if (!r) return null;
  const outcomeOn = r.outcomeEnabled && r.outcomes.length > 0;
  const matchOn = r.matchEnabled && r.bands.length > 0;
  if (!outcomeOn && !matchOn) return null;
  const totals = new Map(r.outcomes.map((o) => [o.id, 0]));
  let earned = 0;
  let possible = 0;
  let answered = false;
  for (const q of def.questions) {
    const scores = q.scores ?? [];
    if (scores.length === 0 || !questionVisible(def, q, answers)) continue;
    const a = answers[q.id];
    const positive = (s: Score) => Math.max(0, s.match ?? 0);
    let weight: ((s: Score) => number) | null = null;
    // The most it could give counts whether or not they answered it (skipping isn't a perfect answer)
    const best =
      q.kind === "multi"
        ? scores
            .map(positive)
            .sort((x, y) => y - x)
            .slice(0, q.max != null && q.max >= 1 ? q.max : undefined)
            .reduce((n, m) => n + m, 0)
        : Math.max(0, ...scores.map(positive));
    possible += best;
    if (q.kind === "slider") {
      const pos = Number.parseInt(a?.value ?? "", 10);
      if (!Number.isFinite(pos)) continue;
      const lo = q.min ?? 1;
      const hi = q.max ?? 7;
      const mid = (lo + hi) / 2;
      const half = (hi - lo) / 2;
      const left = pos < mid ? (mid - pos) / half : 0;
      const right = pos > mid ? (pos - mid) / half : 0;
      weight = (s) => (s.when === "left" ? left : right);
    } else if (q.kind === "multi") {
      const picked = (a?.values ?? []).map((v) => v.trim()).filter(Boolean);
      if (picked.length === 0) continue;
      weight = (s) => (picked.includes(s.when) ? 1 : 0);
    } else {
      const single = (a?.value ?? "").trim();
      if (!single) continue;
      weight = (s) => (s.when === single ? 1 : 0);
    }
    // A match needs at least one answer to a question that gives match points (not only work-style sliders)
    if (best > 0) answered = true;
    for (const s of scores) {
      const w = weight(s);
      if (w <= 0) continue;
      for (const o of s.outcomes) if (totals.has(o)) totals.set(o, totals.get(o)! + w);
      earned += (s.match ?? 0) * w;
    }
  }
  const result: FormResult = { points: [] };
  if (outcomeOn) {
    const ranked = r.outcomes.map((o, i) => ({ o, i, p: totals.get(o.id) ?? 0 })).sort((x, y) => y.p - x.p || x.i - y.i);
    result.outcomeTitle = r.outcomeTitle;
    result.points = ranked.map((x) => ({ name: x.o.name, points: Math.round(x.p * 100) / 100 }));
    if (ranked[0].p > 0) result.outcome = ranked[0].o;
  }
  if (matchOn && answered && possible > 0) {
    const percent = Math.round((100 * Math.min(Math.max(earned, 0), possible)) / possible);
    const sorted = [...r.bands].sort((x, y) => x.from - y.from);
    const band = [...sorted].reverse().find((b) => b.from <= percent) ?? sorted[0];
    result.matchTitle = r.matchTitle;
    result.match = { percent, label: band.label, message: band.message };
  }
  return result.outcome || result.match ? result : null;
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
