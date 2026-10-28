"use client";

/**
 * The "Book a meeting" question of a guidance form ("Next steps"): what to talk about, how to meet, and either a day and
 * a time of day (the team confirms a time) or a free time picked from the counsellors' hours (two weeks at a time, in the
 * institute's time zone). And what the person is told once the form is sent.
 */

import React, { useEffect, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { getApiBaseUrl } from "@/lib/apiClient";
import type { Answer, Fillable, Question } from "./model";
import type { MeetingTold } from "./GuidanceForm";

const TIMES_OF_DAY = ["morning", "afternoon", "evening", "any"] as const;

/** yyyy-mm-dd today in a time zone, plus some days */
function dayIn(timeZone: string, plus = 0): string {
  let today: string;
  try {
    today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  } catch {
    today = new Date().toISOString().slice(0, 10);
  }
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + plus);
  return d.toISOString().slice(0, 10);
}

/** "Tue 4 Nov" for a yyyy-mm-dd day, in the person's language */
function dayLabel(date: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  } catch {
    return date;
  }
}

function Choice({ on, onClick, children, id }: { on: boolean; onClick: () => void; children: React.ReactNode; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? "border-[var(--gf-accent)] bg-[var(--gf-accent)] text-[var(--gf-on)]" : "border-border hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}

interface SlotDay {
  date: string;
  times: { start: string; label: string }[];
}

export function MeetingField({
  q,
  a,
  onChange,
  t,
  lang,
  options,
  preview,
  fill,
  id,
}: {
  q: Question;
  a: Answer | undefined;
  onChange: (a: Answer) => void;
  t: (k: string) => string;
  lang: string;
  /** The topics in the person's language (one to one with q.options) */
  options: string[];
  preview: boolean;
  fill: Fillable;
  id: string;
}) {
  const cfg = q.booking ?? { mode: "request", modes: ["Phone"], daysAhead: 14, timeZone: "Asia/Kolkata" };
  const b = a?.booking ?? {};
  const set = (patch: Partial<NonNullable<Answer["booking"]>>) => onChange({ booking: { ...b, ...patch } });
  const topics = b.topics ?? [];
  const slots = cfg.mode === "slots";

  // Free times (forms that offer them), two weeks at a time
  const [from, setFrom] = useState<string | null>(null);
  const [days, setDays] = useState<SlotDay[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!slots || preview) return;
    let cancelled = false;
    const base = getApiBaseUrl().replace(/\/$/, "");
    fetch(`${base}/api/public/guidance/${fill.instituteId}/slots?form=${fill.formId}&question=${encodeURIComponent(q.id)}${from ? `&from=${from}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { days: SlotDay[]; next: string | null }) => {
        if (cancelled) return;
        setFailed(false);
        setDays(d.days);
        setNext(d.next);
        setDay(d.days[0]?.date ?? null);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [slots, preview, fill.instituteId, fill.formId, q.id, from]);

  const shownDay = days?.find((d) => d.date === day) ?? days?.[0];

  return (
    <div className="mt-2 space-y-4">
      {q.options.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("topics")}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {q.options.map((o, i) => {
              const on = topics.includes(o);
              return (
                <Choice key={o} on={on} onClick={() => set({ topics: on ? topics.filter((x) => x !== o) : [...topics, o] })}>
                  {options[i]}
                </Choice>
              );
            })}
          </div>
        </div>
      )}

      {cfg.modes.length > 1 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("howMeet")}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {cfg.modes.map((m) => (
              <Choice key={m} on={b.mode === m} onClick={() => set({ mode: m })}>
                {t(m)}
              </Choice>
            ))}
          </div>
        </div>
      )}

      {slots ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("pickTime")}</p>
          {preview ? (
            <p className="mt-1.5 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
              People pick from your counsellors&apos; free times here, two weeks at a time.
            </p>
          ) : failed ? (
            <p className="mt-1.5 text-xs text-muted-foreground">{t("noTimes")}</p>
          ) : !days ? (
            <p className="mt-1.5 text-xs text-muted-foreground" aria-busy="true">
              {t("loadingTimes")}
            </p>
          ) : days.length === 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">{t("noTimes")}</p>
          ) : (
            <>
              <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t("pickDay")}>
                {days.map((d) => (
                  <Choice key={d.date} on={shownDay?.date === d.date} onClick={() => setDay(d.date)}>
                    {dayLabel(d.date, lang)}
                  </Choice>
                ))}
              </div>
              {shownDay && (
                <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4" role="group" aria-label={dayLabel(shownDay.date, lang)}>
                  {shownDay.times.map((x, i) => (
                    <button
                      key={x.start}
                      id={i === 0 ? id : undefined}
                      type="button"
                      aria-pressed={b.start === x.start}
                      onClick={() => set({ start: x.start, startLabel: `${dayLabel(shownDay.date, lang)}, ${x.label}` })}
                      className={`rounded-xl border px-2 py-2 text-sm tabular-nums ${b.start === x.start ? "border-[var(--gf-accent)] bg-[var(--gf-accent)] text-[var(--gf-on)]" : "border-border hover:bg-muted"}`}
                    >
                      {x.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {!preview && (from || next) && (
            <div className="mt-2 flex justify-between text-xs">
              {from ? (
                <button type="button" onClick={() => setFrom(null)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" /> {t("earlierTimes")}
                </button>
              ) : (
                <span />
              )}
              {next && (
                <button type="button" onClick={() => setFrom(next)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  {t("laterTimes")} <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {b.start && b.startLabel && (
            <p className="mt-2 text-sm font-medium" role="status">
              {b.startLabel}
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
          <label className="block text-xs font-medium text-muted-foreground">
            {t("pickDay")}
            <input
              id={id}
              type="date"
              min={dayIn(cfg.timeZone, 1)}
              max={dayIn(cfg.timeZone, cfg.daysAhead)}
              value={b.date ?? ""}
              onChange={(e) => set({ date: e.target.value, timeOfDay: b.timeOfDay ?? "any" })}
              className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-2 focus:outline-[var(--gf-accent)]"
            />
          </label>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t("timeOfDay")}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {TIMES_OF_DAY.map((x) => (
                <Choice key={x} on={(b.timeOfDay ?? "any") === x && !!b.date} onClick={() => set({ timeOfDay: x })}>
                  {t(x === "any" ? "anyTime" : x)}
                </Choice>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t("timesIn").replace("{tz}", cfg.timeZone)}</span>
        {!q.required && (b.date || b.start) && (
          <button type="button" onClick={() => onChange({ booking: { topics } })} className="underline-offset-2 hover:text-foreground hover:underline">
            {t("clearMeeting")}
          </button>
        )}
      </div>
    </div>
  );
}

/** What the person is told about their meeting once the form is in */
export function MeetingNotice({ meeting, t }: { meeting: MeetingTold; t: (k: string) => string }) {
  const text =
    meeting.status === "Booked" && meeting.when ? t("meetingBooked").replace("{when}", meeting.when) : meeting.taken ? t("meetingTaken") : t("meetingAsked");
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border p-4" role="status">
      <CalendarCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gf-accent)]" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
