/** Types and a small fetch helper for the institute admissions CRM (API: /api/institute/crm, CrmController). */

import React from "react";

import { authenticatedFetch } from "@/lib/apiClient";

export type GetToken = () => Promise<string | null>;

export const STAGES = ["New", "Contacted", "CounsellingBooked", "Applied", "Enrolled", "Lost"] as const;
export type Stage = (typeof STAGES)[number];
export const OPEN_STAGES: Stage[] = ["New", "Contacted", "CounsellingBooked", "Applied"];

export const STAGE_LABEL: Record<string, string> = {
  New: "New",
  Contacted: "Contacted",
  CounsellingBooked: "Counselling booked",
  Applied: "Applied",
  Enrolled: "Enrolled",
  Lost: "Lost",
};

/** Badge colours per stage (text stays readable in light and dark) */
export const STAGE_TONE: Record<string, string> = {
  New: "bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/30",
  Contacted: "bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border-indigo-500/30",
  CounsellingBooked: "bg-violet-500/10 text-violet-800 dark:text-violet-300 border-violet-500/30",
  Applied: "bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-500/30",
  Enrolled: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
  Lost: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
};

/** Solid stage colours (selected buttons, dots, bars, column accents): the same hue as STAGE_TONE everywhere */
export const STAGE_SOLID: Record<string, string> = {
  New: "bg-sky-600 border-sky-600 text-white",
  Contacted: "bg-indigo-600 border-indigo-600 text-white",
  CounsellingBooked: "bg-violet-600 border-violet-600 text-white",
  Applied: "bg-amber-500 border-amber-500 text-white",
  Enrolled: "bg-emerald-600 border-emerald-600 text-white",
  Lost: "bg-zinc-500 border-zinc-500 text-white",
};
export const STAGE_BORDER: Record<string, string> = {
  New: "border-t-sky-600",
  Contacted: "border-t-indigo-600",
  CounsellingBooked: "border-t-violet-600",
  Applied: "border-t-amber-500",
  Enrolled: "border-t-emerald-600",
  Lost: "border-t-zinc-500",
};
/** The stage key for a label as written in the timeline ("Counselling booked" → CounsellingBooked) */
export const stageFromLabel = (label: string) => Object.keys(STAGE_LABEL).find((k) => STAGE_LABEL[k] === label.trim()) ?? null;

export function StageDot({ stage }: { stage: string }) {
  return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-full ${(STAGE_SOLID[stage] ?? STAGE_SOLID.Lost).split(" ")[0]}`} />;
}

export const CALL_OUTCOMES: Record<string, string> = {
  Reached: "Spoke to them",
  NoAnswer: "No answer",
  Busy: "Busy",
  WrongNumber: "Wrong number",
  CallBack: "Asked for a call back",
};

export const LOST_REASONS = ["Chose another institute", "Fees too high", "Not interested any more", "Couldn't reach them", "Timing doesn't suit", "Not eligible"];

export interface Filters {
  q?: string;
  stage?: string;
  owner?: string;
  tag?: string;
  source?: string;
  type?: string;
  overdue?: boolean;
  awaiting?: boolean;
  /** Only high-priority leads */
  priority?: boolean;
  /** Only leads the spam check flagged */
  spam?: boolean;
  /** Received on or after (ISO) */
  from?: string;
  /** activity (default), received, followup or name */
  sort?: string;
}

export interface LeadRow {
  leadId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  requestType: "guidance" | "course";
  course: string | null;
  source: string | null;
  stage: string;
  ownerMemberId: string | null;
  owner: string | null;
  tags: string[];
  nextFollowUpAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  quizShared: boolean;
  duplicate: boolean;
  doNotContact: boolean;
  overdue: boolean;
  lastContactAt: string | null;
  lastReplyAt: string | null;
  awaitingReply: boolean;
  highPriority?: boolean;
  spam?: boolean;
  spamReasons?: string | null;
}

export interface LeadList {
  leads: LeadRow[];
  /** Leads matching the filters */
  total: number;
  /** All the institute's leads */
  totalAll: number;
  page: number;
  hasMore: boolean;
  counts: Record<string, number>;
  sources: string[];
  tags: string[];
  me: { id: string; name: string } | null;
  mineOpen: number;
  awaiting: number;
  highPriority?: number;
  /** Leads in Possible spam */
  spam?: number;
  unassignedOpen: number;
}

export interface QuizShare {
  takenAt: string;
  primaryTrack: string;
  secondaryTrack: string;
  matchConfidence: string;
  ranking: { track: string; percent: number; picked: number; offered: number }[];
  reasons: { track: string; question: string; answer: string }[];
  answers: { question: string; answer: string }[];
}

export interface Activity {
  id: string;
  kind: string;
  body: string;
  subject: string | null;
  meta: Record<string, unknown> | null;
  actorName: string;
  pinned: boolean;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  dueAt: string;
  doneAt: string | null;
  assigneeMemberId: string | null;
  assignee: string | null;
}

export interface LeadFull {
  leadId: string;
  instituteName?: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source: string | null;
  createdAt: string;
  requestType: "guidance" | "course";
  course: string | null;
  situation: { question: string; answer: string; files?: { id: string; name: string; size: number }[] }[] | null;
  quiz: QuizShare | null;
  stage: string;
  lostReason: string | null;
  ownerMemberId: string | null;
  owner: string | null;
  tags: string[];
  nextFollowUpAt: string | null;
  firstResponseAt: string | null;
  doNotContact: boolean;
  highPriority?: boolean;
  spam?: boolean;
  spamReasons?: string | null;
  duplicates: string[];
  channels: { email: boolean; sms: boolean; whatsapp: boolean; replyByEmail: boolean };
  activities: Activity[];
  tasks: Task[];
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Counsellor";
  active: boolean;
}

export interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface SavedView {
  id: string;
  name: string;
  filters: Filters;
}

export interface OpenTask {
  id: string;
  leadId: string;
  lead: string | null;
  title: string;
  dueAt: string;
  overdue: boolean;
  assignee: string | null;
}

export class CrmError extends Error {}

/** Calls /api/institute/crm{path}; throws CrmError with the API's message when the call fails. */
export async function crm<T>(getToken: GetToken, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await authenticatedFetch(
    `/api/institute/crm${path}`,
    {
      method: init?.method ?? "GET",
      headers: { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    },
    getToken
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 403) throw new CrmError(data?.error ?? "You don't have access to this.");
    throw new CrmError(data?.error ?? "Something went wrong. Please try again.");
  }
  return data as T;
}

export function query(f: Filters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "" && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** "in 3 h", "2 d ago" */
export function relative(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const unit = abs < 3600e3 ? [Math.max(1, Math.round(abs / 60e3)), "min"] : abs < 86400e3 ? [Math.round(abs / 3600e3), "h"] : [Math.round(abs / 86400e3), "d"];
  return diff >= 0 ? `in ${unit[0]} ${unit[1]}` : `${unit[0]} ${unit[1]} ago`;
}

/** A datetime-local value for a Date (local time) */
export function localInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function PriorityBadge() {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-medium text-rose-800 dark:text-rose-300">
      High priority
    </span>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${STAGE_TONE[stage] ?? STAGE_TONE.Lost}`}>
      {STAGE_LABEL[stage] ?? stage}
    </span>
  );
}
