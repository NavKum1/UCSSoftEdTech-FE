"use client";

/**
 * Editing a "Book a meeting" question (a form's "Next steps"): the topics people can pick, how the time is set (they ask
 * for a day and a time of day and the team confirms, or they pick a free time from the counsellors' hours of one of the
 * institute's appointment types), the ways they can meet, how far ahead, and the time zone.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLegacyApi } from "@/lib/legacyApi";
import { MEETING_MODES, type MeetingMode, type Question } from "@/components/guidance/form/model";

/** The institute whose form is being edited (for its appointment types) */
export const EditingInstitute = createContext<string | null>(null);

interface BookingOptions {
  timeZone: string | null;
  types: { id: string; name: string; minutes: number; modes: string[]; counsellors: number }[];
}

const field = "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20";

function zones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Chicago", "America/Los_Angeles", "UTC"];
  }
}

export default function MeetingEditor({ q, update }: { q: Question; update: (p: Partial<Question>) => void }) {
  const institute = useContext(EditingInstitute);
  const { apiFetch, ready } = useLegacyApi();
  const [options, setOptions] = useState<BookingOptions | null>(null);
  const b = q.booking ?? { mode: "request", modes: ["Phone", "Video"], daysAhead: 14, timeZone: "Asia/Kolkata" };
  const set = (patch: Partial<NonNullable<Question["booking"]>>) => update({ booking: { ...b, ...patch } });
  const allZones = useMemo(() => zones(), []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    apiFetch(`/api/guidance-forms/booking-options${institute ? `?instituteId=${institute}` : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setOptions(d))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ready, apiFetch, institute]);

  const type = options?.types.find((t) => t.id === b.typeId);
  // Free times: only the ways of meeting the appointment offers
  const offered = b.mode === "slots" && type ? MEETING_MODES.filter((m) => type.modes.includes(m.mode)) : MEETING_MODES;
  const topics = q.options;

  return (
    <div className="space-y-3 rounded-lg border border-cyan-600/30 bg-cyan-600/5 p-3 text-xs">
      <div>
        <p className="font-medium">How the time is set</p>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["request", "They ask for a day", "They choose a day and a time of day; your team confirms a time from the lead, and they get a calendar invite."],
              ["slots", "They pick a free time", "They pick from your counsellors' free hours (Career centre → Appointments); it's booked straight away."],
            ] as const
          ).map(([mode, title, detail]) => (
            <label key={mode} className={`flex cursor-pointer gap-2 rounded-lg border p-2.5 ${b.mode === mode ? "border-cyan-600 bg-background" : "border-border"}`}>
              <input type="radio" name={`mode-${q.id}`} className="mt-0.5" checked={b.mode === mode} onChange={() => set({ mode, typeId: mode === "slots" ? (b.typeId ?? options?.types[0]?.id ?? null) : null })} />
              <span>
                <span className="block font-medium">{title}</span>
                <span className="text-muted-foreground">{detail}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {b.mode === "slots" && (
        <label className="block font-medium">
          Appointment people book
          {options && options.types.length === 0 ? (
            <span className="mt-1 block rounded-lg bg-amber-500/10 p-2 font-normal text-amber-900 dark:text-amber-200" role="alert">
              Set up an appointment type and your counsellors&apos; weekly hours in Career centre → Appointments first. Until then, let people ask for a day.
            </span>
          ) : (
            <select className={field} value={b.typeId ?? ""} onChange={(e) => set({ typeId: e.target.value || null })}>
              <option value="">Choose…</option>
              {(options?.types ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.minutes} min, {t.counsellors === 1 ? "1 counsellor" : `${t.counsellors} counsellors`})
                </option>
              ))}
            </select>
          )}
          {type && type.counsellors === 0 && (
            <span className="mt-1 block font-normal text-amber-800 dark:text-amber-300">No counsellor offers this appointment with weekly hours yet, so no times will show.</span>
          )}
        </label>
      )}

      <div>
        <p className="font-medium">Ways to meet</p>
        <div className="mt-1.5 flex flex-wrap gap-3">
          {offered.map((m) => {
            const on = b.modes.includes(m.mode);
            return (
              <label key={m.mode} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    const next = on ? b.modes.filter((x) => x !== m.mode) : [...b.modes, m.mode];
                    if (next.length) set({ modes: MEETING_MODES.map((x) => x.mode).filter((x): x is MeetingMode => next.includes(x)) });
                  }}
                />
                {m.label}
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {b.mode === "request" && (
          <label className="block font-medium">
            Days ahead they can choose
            <input type="number" min={1} max={60} className={field} value={b.daysAhead} onChange={(e) => set({ daysAhead: Math.min(60, Math.max(1, Number(e.target.value) || 14)) })} />
          </label>
        )}
        <label className="block font-medium">
          Time zone of the times
          {b.mode === "slots" ? (
            <span className="mt-1 block font-normal text-muted-foreground">{options?.timeZone ?? b.timeZone} (your counsellors&apos; hours are set in it)</span>
          ) : (
            <select className={field} value={b.timeZone} onChange={(e) => set({ timeZone: e.target.value })}>
              {(allZones.includes(b.timeZone) ? allZones : [b.timeZone, ...allZones]).map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      <div>
        <p className="font-medium">Topics they can pick <span className="font-normal text-muted-foreground">(optional)</span></p>
        <textarea
          rows={Math.max(2, topics.length)}
          className={field}
          placeholder={"One per line, e.g.\nCourse content\nFees and payment plans"}
          value={topics.join("\n")}
          onChange={(e) => update({ options: e.target.value.split("\n").slice(0, 15) })}
        />
      </div>
      <p className="text-muted-foreground">
        Meetings appear on the lead with a task for your team, and in Automatic messages you can send something when one is asked for.
      </p>
    </div>
  );
}
