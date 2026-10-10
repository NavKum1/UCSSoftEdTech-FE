"use client";

/**
 * Shared types and widgets for the appointments pages (C3): tabs, school-time formatting, slot picker,
 * intake questions and authenticated downloads (.ics / .csv).
 */

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import { Button, Field } from "@/components/career/ui";

export interface IntakeQuestion {
  id: string;
  label: string;
  required: boolean;
  kind: "text" | "textarea" | "choice";
  options?: string[] | null;
}

export interface ApptType {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  modes: string[];
  allowStudents: boolean;
  allowAlumni: boolean;
  minLeadMinutes: number;
  maxLeadDays: number;
  bufferMinutes: number;
  cancelCutoffMinutes: number;
  intakeQuestions: IntakeQuestion[];
  active: boolean;
  sortOrder: number;
}

export interface Appointment {
  id: string;
  typeId: string;
  typeName: string;
  startUtc: string;
  endUtc: string;
  localStart: string;
  timeZone: string;
  mode: string;
  location?: string | null;
  meetingUrl?: string | null;
  status: string;
  outcome?: string | null;
  counselor: { userId: string; name: string };
  student?: { userId: string; name: string; email?: string | null; studentNumber?: string | null } | null;
  intakeAnswers: Record<string, string>;
  intakeQuestions: IntakeQuestion[];
  cancelCutoffUtc: string;
  canChange: boolean;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  bookedOnBehalf: boolean;
  rescheduleCount: number;
  createdAt: string;
}

export interface Slot {
  startUtc: string;
  endUtc: string;
  localStart: string;
  counselorUserIds: string[];
}

export interface SlotResponse {
  timeZone: string;
  slots: Slot[];
}

export interface Note {
  id: string;
  appointmentId?: string | null;
  visibility?: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author?: string;
  canEdit?: boolean;
}

export interface Task {
  id: string;
  appointmentId?: string | null;
  title: string;
  details?: string | null;
  dueDate?: string | null;
  status: string;
  assigneeType: string;
  completedAt?: string | null;
  mine?: boolean;
}

export const MODE_LABELS: Record<string, string> = { InPerson: "In person", Video: "Video", Phone: "Phone" };
export const OUTCOME_LABELS: Record<string, string> = { Attended: "Attended", NoShow: "No-show", CancelledLate: "Late cancellation" };
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Format a UTC instant in the school's time zone. */
export function inZone(utc: string, timeZone: string, opts: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZone }).format(new Date(utc));
  } catch {
    return new Date(utc).toLocaleString();
  }
}

export function whenText(a: { startUtc: string; endUtc: string }, timeZone: string) {
  const day = inZone(a.startUtc, timeZone, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const start = inZone(a.startUtc, timeZone, { hour: "numeric", minute: "2-digit" });
  const end = inZone(a.endUtc, timeZone, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  return `${day}, ${start} – ${end}`;
}

/** Today's date (yyyy-mm-dd) in a time zone. */
export function todayIn(timeZone: string, offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function statusTone(a: Pick<Appointment, "status" | "outcome">): "good" | "warn" | "bad" | "info" | "neutral" {
  if (a.outcome === "Attended") return "good";
  if (a.outcome === "NoShow" || a.outcome === "CancelledLate") return "bad";
  if (a.status === "Cancelled") return "warn";
  if (a.status === "Booked") return "info";
  return "neutral";
}

export function statusLabel(a: Pick<Appointment, "status" | "outcome">) {
  if (a.outcome) return OUTCOME_LABELS[a.outcome] ?? a.outcome;
  return a.status === "Booked" ? "Booked" : a.status === "Cancelled" ? "Cancelled" : a.status;
}

/** Downloads an authenticated file (ICS, CSV) through the API helper. */
export function useDownload() {
  const api = useApi();
  return async (path: string, fileName: string) => {
    const res = await api<Response>(path, { raw: true });
    if (!res.ok) {
      let message = `Download failed (${res.status})`;
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        // not JSON
      }
      throw new Error(message);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}

/**
 * Loads `path` whenever it (or `nonce`) changes; null path means "nothing to load".
 * Loading is derived from whether the stored result belongs to the current request.
 */
export function useFetch<T>(path: string | null, nonce = 0) {
  const api = useApi();
  const key = path ? `${path}#${nonce}` : null;
  const [result, setResult] = useState<{ key: string; data?: T; error?: string } | null>(null);
  useEffect(() => {
    if (!key || !path) return;
    let cancelled = false;
    api<T>(path)
      .then((data) => !cancelled && setResult({ key, data }))
      .catch((e: Error) => !cancelled && setResult({ key, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [api, key, path]);
  const current = result && result.key === key ? result : null;
  return { data: current?.data ?? null, error: current?.error ?? null, loading: !!key && !current };
}

/** Accessible tab strip (arrow keys move between tabs). */
export function Tabs<T extends string>({ label, tabs, value, onChange }: { label: string; tabs: { key: T; label: string }[]; value: T; onChange: (key: T) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(tabs[next].key);
      refs.current[next]?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} className="mb-4 flex flex-wrap gap-1 border-b border-border">
      {tabs.map((t, i) => (
        <button
          key={t.key}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          type="button"
          id={`tab-${t.key}`}
          aria-selected={value === t.key}
          aria-controls={`panel-${t.key}`}
          tabIndex={value === t.key ? 0 : -1}
          onKeyDown={(e) => onKey(e, i)}
          onClick={() => onChange(t.key)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 ${value === t.key ? "border-[var(--brand,#4f46e5)]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}

/**
 * Two-step slot chooser: a day, then a time. Days and times are shown in the school's time zone.
 * `from` is the first day of the 14-day window; the parent loads slots for it.
 */
export function SlotPicker({
  data,
  loading,
  from,
  minFrom,
  onFrom,
  value,
  onChange,
  counselorNames,
}: {
  data: SlotResponse | null;
  loading: boolean;
  from: string;
  minFrom: string;
  onFrom: (from: string) => void;
  value: Slot | null;
  onChange: (slot: Slot | null) => void;
  counselorNames?: Record<string, string>;
}) {
  const tz = data?.timeZone ?? "UTC";
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of data?.slots ?? []) {
      const day = s.localStart.slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), s]);
    }
    return map;
  }, [data]);
  const [day, setDay] = useState<string | null>(null);
  const days = [...byDay.keys()];
  const activeDay = day && byDay.has(day) ? day : days[0] ?? null;
  const headingId = useId();

  const label = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const time = (s: Slot) => {
    const [h, m] = s.localStart.slice(11, 16).split(":").map(Number);
    const d = new Date(Date.UTC(2000, 0, 1, h, m));
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={headingId} className="text-sm font-medium">
          {label(from)} – {label(addDays(from, 13))} <span className="font-normal text-muted-foreground">(times in {tz})</span>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => onFrom(addDays(from, -14) < minFrom ? minFrom : addDays(from, -14))} disabled={from <= minFrom || loading} aria-label="Previous two weeks">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Earlier
          </Button>
          <Button type="button" variant="secondary" onClick={() => onFrom(addDays(from, 14))} disabled={loading} aria-label="Next two weeks">
            Later <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Finding open times…
        </p>
      ) : days.length === 0 ? (
        <p role="status" className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          No open times in these two weeks. Try later dates or another counselor.
        </p>
      ) : (
        <>
          <div role="group" aria-labelledby={headingId} className="flex flex-wrap gap-2">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={activeDay === d}
                onClick={() => setDay(d)}
                className={`rounded-md border px-3 py-2 text-sm focus-visible:outline-2 ${activeDay === d ? "border-[var(--brand,#4f46e5)] font-semibold ring-1 ring-[var(--brand,#4f46e5)]" : "border-border hover:bg-muted"}`}
              >
                {label(d)} <span className="text-xs text-muted-foreground">({byDay.get(d)!.length})</span>
              </button>
            ))}
          </div>
          {activeDay && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Times on {label(activeDay)}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {byDay.get(activeDay)!.map((s) => {
                  const selected = value?.startUtc === s.startUtc;
                  const names = counselorNames ? s.counselorUserIds.map((id) => counselorNames[id]).filter(Boolean) : [];
                  return (
                    <button
                      key={s.startUtc}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onChange(selected ? null : s)}
                      title={names.length ? names.join(", ") : undefined}
                      className={`rounded-md border px-2 py-2 text-sm focus-visible:outline-2 ${selected ? "border-transparent text-white" : "border-border hover:bg-muted"}`}
                      style={selected ? { background: "var(--brand, #4f46e5)" } : undefined}
                    >
                      {time(s)}
                      {selected && <span className="sr-only"> (selected)</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        </>
      )}
    </div>
  );
}

export function IntakeFields({ questions, answers, onChange }: { questions: IntakeQuestion[]; answers: Record<string, string>; onChange: (a: Record<string, string>) => void }) {
  if (questions.length === 0) return null;
  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <Field key={q.id} label={q.label + (q.required ? " (required)" : "")}>
          {(p) =>
            q.kind === "choice" ? (
              <select {...p} required={q.required} value={answers[q.id] ?? ""} onChange={(e) => onChange({ ...answers, [q.id]: e.target.value })}>
                <option value="">Choose…</option>
                {(q.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : q.kind === "text" ? (
              <input {...p} required={q.required} maxLength={2000} value={answers[q.id] ?? ""} onChange={(e) => onChange({ ...answers, [q.id]: e.target.value })} />
            ) : (
              <textarea {...p} rows={3} required={q.required} maxLength={2000} value={answers[q.id] ?? ""} onChange={(e) => onChange({ ...answers, [q.id]: e.target.value })} />
            )
          }
        </Field>
      ))}
    </div>
  );
}

export function IntakeAnswers({ appointment }: { appointment: Pick<Appointment, "intakeQuestions" | "intakeAnswers"> }) {
  const entries = Object.entries(appointment.intakeAnswers ?? {});
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No intake answers.</p>;
  const label = (id: string) => appointment.intakeQuestions.find((q) => q.id === id)?.label ?? id;
  return (
    <dl className="space-y-2 text-sm">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt className="font-medium">{label(k)}</dt>
          <dd className="whitespace-pre-wrap text-muted-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MeetingInfo({ a }: { a: Pick<Appointment, "mode" | "location" | "meetingUrl"> }) {
  if (a.mode === "Video")
    return a.meetingUrl ? (
      <a href={a.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">
        Join video meeting<span className="sr-only"> (opens in a new tab)</span>
      </a>
    ) : (
      <span className="text-sm text-muted-foreground">Video link will be shared by your counselor</span>
    );
  if (a.mode === "Phone") return <span className="text-sm text-muted-foreground">Phone call</span>;
  return <span className="text-sm text-muted-foreground">{a.location ? `In person: ${a.location}` : "In person"}</span>;
}
