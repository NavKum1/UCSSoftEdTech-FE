"use client";

/**
 * The meetings a lead asked for on a form's "Next steps": a request (a day and a time of day) the team confirms with a
 * time, or a time they booked from the counsellors' free hours. Confirming or moving one emails the person a calendar
 * invite and moves the lead to Counselling booked; cancelling emails the cancellation.
 */

import React, { useState } from "react";
import { CalendarCheck, CalendarClock, Link2, MapPin, Phone, Video } from "lucide-react";
import { localInput, type LeadFull, type Meeting } from "./api";

const MODE: Record<Meeting["mode"], { label: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }> }> = {
  Phone: { label: "Phone call", icon: Phone },
  Video: { label: "Video call", icon: Video },
  InPerson: { label: "In person", icon: MapPin },
};
const HOUR: Record<string, number> = { morning: 10, afternoon: 14, evening: 18, any: 11 };
const field = "mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm";

/** "Tue 4 Nov 2026, morning" */
function wanted(m: Meeting): string {
  const day = m.preferredDate ? new Date(`${m.preferredDate}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "any day";
  return `${day}, ${!m.timeOfDay || m.timeOfDay === "any" ? "any time" : m.timeOfDay}`;
}

export default function Meetings({ lead, busy, act }: { lead: LeadFull; busy: boolean; act: (path: string, body: unknown, done?: string, method?: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const meetings = lead.meetings ?? [];
  const open = meetings.filter((m) => m.status !== "Cancelled");
  const cancelled = meetings.length - open.length;
  if (meetings.length === 0) return null;

  const cancel = (m: Meeting) => {
    const reason = window.prompt(m.status === "Booked" ? "Cancel this meeting? They'll get an email. Add a reason for them (optional):" : "Close this request? Add a note (optional):");
    if (reason === null) return;
    act(`/leads/${lead.leadId}/meetings/${m.id}/cancel`, { reason }, m.status === "Booked" ? "Meeting cancelled; they've been emailed." : "Request closed.");
  };

  return (
    <section className="mt-3 space-y-2" aria-label="Meetings">
      {open.map((m) => {
        const Icon = MODE[m.mode].icon;
        const booked = m.status === "Booked";
        return (
          <div key={m.id} className={`rounded-xl border px-3 py-2.5 text-sm ${booked ? "border-emerald-600/30 bg-emerald-600/5" : "border-amber-500/40 bg-amber-500/10"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-medium">
                  {booked ? <CalendarCheck aria-hidden="true" className="h-4 w-4 text-emerald-700" /> : <CalendarClock aria-hidden="true" className="h-4 w-4 text-amber-700" />}
                  {booked ? `Meeting: ${m.when}` : `Asked for a meeting: ${wanted(m)}`}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Icon aria-hidden="true" className="h-3.5 w-3.5" /> {MODE[m.mode].label}
                  </span>
                  {booked && m.counsellor && <span>with {m.counsellor}</span>}
                  {m.meetingUrl && (
                    <a href={m.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-700 hover:underline dark:text-cyan-400">
                      <Link2 aria-hidden="true" className="h-3.5 w-3.5" /> Video link
                    </a>
                  )}
                  {m.location && <span>{m.location}</span>}
                  {m.kind === "slot" && booked && <span>Booked by them</span>}
                </p>
                {m.topics.length > 0 && <p className="mt-0.5 text-xs">To talk about: {m.topics.join(", ")}</p>}
                {m.note && <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">{m.note}</p>}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" disabled={busy} onClick={() => setEditing(editing === m.id ? null : m.id)} className="rounded-lg bg-cyan-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-cyan-800 disabled:opacity-50">
                  {booked ? "Move" : "Confirm a time"}
                </button>
                <button type="button" disabled={busy} onClick={() => cancel(m)} className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50">
                  {booked ? "Cancel" : "Close"}
                </button>
              </div>
            </div>
            {editing === m.id && (
              <ConfirmForm
                m={m}
                busy={busy}
                onConfirm={async (body) => {
                  if (await act(`/leads/${lead.leadId}/meetings/${m.id}/confirm`, body, booked ? "Meeting moved; they've been emailed the new time." : "Meeting booked; they've been emailed a calendar invite.")) setEditing(null);
                }}
              />
            )}
          </div>
        );
      })}
      {cancelled > 0 && <p className="text-xs text-muted-foreground">{cancelled === 1 ? "1 meeting was cancelled." : `${cancelled} meetings were cancelled.`}</p>}
    </section>
  );
}

function ConfirmForm({ m, busy, onConfirm }: { m: Meeting; busy: boolean; onConfirm: (body: { at: string; minutes: number; mode: string; meetingUrl: string | null; location: string | null }) => void }) {
  const start = () => {
    if (m.start) return localInput(new Date(m.start));
    const d = m.preferredDate ? new Date(`${m.preferredDate}T00:00:00`) : new Date(Date.now() + 86400e3);
    d.setHours(HOUR[m.timeOfDay ?? "any"] ?? 11, 0, 0, 0);
    return localInput(d);
  };
  const [at, setAt] = useState(start);
  const [minutes, setMinutes] = useState(m.start && m.end ? Math.round((new Date(m.end).getTime() - new Date(m.start).getTime()) / 60000) : 30);
  const [mode, setMode] = useState<Meeting["mode"]>(m.mode);
  const [url, setUrl] = useState(m.meetingUrl ?? "");
  const [place, setPlace] = useState(m.location ?? "");
  return (
    <form
      className="mt-2 grid gap-2 border-t border-border pt-2 text-xs sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm({ at: new Date(at).toISOString(), minutes, mode, meetingUrl: mode === "Video" && url.trim() ? url.trim() : null, location: mode === "InPerson" && place.trim() ? place.trim() : null });
      }}
    >
      <label className="font-medium">
        When <span className="font-normal text-muted-foreground">(your time zone)</span>
        <input type="datetime-local" required className={field} value={at} onChange={(e) => setAt(e.target.value)} />
      </label>
      <label className="font-medium">
        Length
        <select className={field} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {[15, 20, 30, 45, 60, 90].map((n) => (
            <option key={n} value={n}>
              {n} minutes
            </option>
          ))}
        </select>
      </label>
      <label className="font-medium">
        How
        <select className={field} value={mode} onChange={(e) => setMode(e.target.value as Meeting["mode"])}>
          {Object.entries(MODE).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      {mode === "Video" && (
        <label className="font-medium">
          Video link
          <input type="url" className={field} value={url} placeholder="https://meet…" onChange={(e) => setUrl(e.target.value)} />
        </label>
      )}
      {mode === "InPerson" && (
        <label className="font-medium">
          Where
          <input className={field} maxLength={300} value={place} placeholder="e.g. Admissions office, 2nd floor" onChange={(e) => setPlace(e.target.value)} />
        </label>
      )}
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-cyan-700 px-3 py-1.5 font-medium text-white hover:bg-cyan-800 disabled:opacity-50">
          {m.status === "Booked" ? "Move and email them" : "Book and email them"}
        </button>
        <span className="ml-2 text-muted-foreground">They get the time and a calendar invite by email.</span>
      </div>
    </form>
  );
}
