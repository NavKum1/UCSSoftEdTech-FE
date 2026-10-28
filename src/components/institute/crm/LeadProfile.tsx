"use client";

/**
 * What the person shared with their inquiry: their question or what they're unsure about, their answers to the
 * institute's guidance form, and (when they chose to share it) their counselling quiz result with every answer. Helps a
 * counsellor understand someone who can't decide which area or certification suits them before calling.
 */

import React from "react";
import { CheckCircle2, CircleSlash, Clock, Lightbulb, MailQuestion, ShieldAlert, ShieldCheck } from "lucide-react";
import type { FormResultView, FormVisit, LeadFull, VisitorInfo } from "./api";
import AnswerFiles from "@/components/guidance/AnswerFiles";

const CONFIDENCE: Record<string, string> = {
  clear: "A clear match: their answers point mostly to one area.",
  moderate: "A moderate match: one area leads, with a second close behind.",
  close: "A close call: two areas are nearly tied, so they may be unsure between them.",
  none: "No clear match: their answers are spread across areas.",
};

/** "7 minutes", "about 1 hour" */
function took(seconds: number): string {
  if (seconds < 60) return "under a minute";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.round(m / 60);
  return h === 1 ? "about 1 hour" : `about ${h} hours`;
}

/** The result the form worked out, with the institute's notes on how to talk with this person */
function FormResultCard({ r, name, from }: { r: FormResultView; name: string; from: LeadFull["formResultFrom"] }) {
  const max = Math.max(1, ...(r.points ?? []).map((p) => p.points));
  return (
    <section className="space-y-3">
      {from?.otherInquiry && (
        <p className="text-xs text-muted-foreground">
          From their other inquiry{from.form ? ` (${from.form})` : ""}, sent <time dateTime={from.at}>{new Date(from.at).toLocaleDateString(undefined, { dateStyle: "medium" })}</time>.
        </p>
      )}
      {r.outcome && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p>
            {name} is <span className="font-semibold">{r.outcome.name}</span>
            {r.outcomeTitle ? <span className="text-muted-foreground"> ({r.outcomeTitle.toLowerCase()})</span> : null}.
          </p>
          {r.outcome.coaching && <p className="mt-1 whitespace-pre-wrap">{r.outcome.coaching}</p>}
        </div>
      )}
      {r.match && (
        <div className="flex items-start gap-3 rounded-xl border border-border p-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-4 border-emerald-600/70 text-xs font-semibold tabular-nums">{r.match.percent}%</span>
          <div className="min-w-0">
            <p>
              <span className="text-muted-foreground">{r.matchTitle || "Match"}:</span> <span className="font-semibold">{r.match.label}</span>
            </p>
            {r.match.coaching && <p className="mt-1 whitespace-pre-wrap">{r.match.coaching}</p>}
          </div>
        </div>
      )}
      {(r.points?.length ?? 0) > 1 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">How close it was</summary>
          <ul className="mt-2 space-y-1.5">
            {r.points!.map((p) => (
              <li key={p.name} className="grid grid-cols-[7rem_minmax(0,1fr)_2.5rem] items-center gap-2">
                <span className="truncate">{p.name}</span>
                <span className="h-2 rounded-full bg-muted" aria-hidden="true">
                  <span className="block h-full rounded-full bg-amber-500" style={{ width: `${(p.points / max) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-muted-foreground">{p.points}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Every visit to the institute's forms by this person: sent, waiting for the email to be confirmed, stopped part way
 * (where, after how long), or still going */
function Visits({ visits }: { visits: FormVisit[] }) {
  return (
    <section>
      <h3 className="font-semibold">Visits to your forms</h3>
      <ul className="mt-1 divide-y divide-border">
        {visits.map((v) => (
          <li key={v.id} className="flex items-start gap-2 py-2">
            {v.status === "completed" ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : v.status === "awaitingConfirmation" ? (
              <MailQuestion aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            ) : v.status === "inProgress" ? (
              <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
            ) : (
              <CircleSlash aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <p className="font-medium">{v.form}</p>
              <p className="text-xs text-muted-foreground">
                {v.status === "completed"
                  ? "Sent"
                  : v.status === "awaitingConfirmation"
                    ? "Sent, waiting for them to confirm their email"
                    : v.status === "inProgress"
                      ? "Filling it in now"
                      : "Stopped part way"}
                {(v.status === "inProgress" || v.status === "stopped") && v.step ? <>, last answer in “{v.step}”</> : null} after {took(v.seconds)} ·{" "}
                <time dateTime={v.startedAt}>{new Date(v.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
                {v.campaign ? ` · ${v.campaign}` : ""}
                {v.otherInquiry ? " · another inquiry" : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A country code as a name in the reader's language ("IN" → "India") */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** What the server saw when the form was sent: device, country (no IP address is kept), the page, and the spam check */
function Visitor({ v }: { v: VisitorInfo }) {
  const flagged = v.spamScore != null && v.spamScore >= v.spamThreshold;
  return (
    <section>
      <h3 className="font-semibold">How they sent it</h3>
      <dl className="mt-1 grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">When</dt>
        <dd>
          {new Date(v.sentAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          {v.seconds ? ` · took ${took(v.seconds)}` : ""}
        </dd>
        {v.device && (
          <>
            <dt className="text-muted-foreground">Device</dt>
            <dd>{v.device}</dd>
          </>
        )}
        {v.country && (
          <>
            <dt className="text-muted-foreground">Country</dt>
            <dd>{countryName(v.country)}</dd>
          </>
        )}
        {v.page && (
          <>
            <dt className="text-muted-foreground">Page</dt>
            <dd className="break-all">{v.page}</dd>
          </>
        )}
        {v.campaign && (
          <>
            <dt className="text-muted-foreground">Campaign</dt>
            <dd>{v.campaign}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Sent from</dt>
        <dd>{v.channel === "website" ? "Your website form" : "Inside Edulexa"}</dd>
        {v.spamScore != null && (
          <>
            <dt className="text-muted-foreground">Spam check</dt>
            <dd className={`flex items-start gap-1 ${flagged ? "text-red-800 dark:text-red-300" : "text-emerald-800 dark:text-emerald-300"}`}>
              {flagged ? <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
              <span>
                {flagged ? "Flagged" : "Passed"} (score {v.spamScore}; {v.spamThreshold} or more is flagged)
                {v.spamReasons ? `: ${v.spamReasons}` : ""}
              </span>
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}

export default function LeadProfile({ lead }: { lead: LeadFull }) {
  const q = lead.quiz;
  const tips = new Map((lead.coaching ?? []).map((c) => [c.questionId, c.tips]));
  return (
    <div className="space-y-6 text-sm">
      {lead.formResult && <FormResultCard r={lead.formResult} from={lead.formResultFrom} name={lead.name?.split(" ")[0] || "This person"} />}
      <section>
        <h3 className="font-semibold">{lead.requestType === "guidance" ? "What they're unsure about" : "Their question"}</h3>
        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{lead.notes?.trim() || "They didn't add a question."}</p>
      </section>

      {lead.situation && lead.situation.length > 0 && (
        <section>
          <h3 className="font-semibold">Their answers to your guidance form</h3>
          <dl className="mt-1 space-y-2">
            {lead.situation.map((s, i) => (
              <div key={i}>
                <dt className="text-muted-foreground">{s.question}</dt>
                <dd className="whitespace-pre-wrap font-medium">
                  {s.table && s.table.rows.length > 0 ? (
                    <div className="mt-1 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            {s.table.columns.map((c) => (
                              <th key={c} className="pb-1 pr-3 font-medium">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {s.table.rows.map((r, ri) => (
                            <tr key={ri} className="border-t border-border">
                              {r.map((cell, ci) => (
                                <td key={ci} className="py-1 pr-3">
                                  {cell || "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    s.answer
                  )}
                  <AnswerFiles files={s.files} />
                  {/* The form's notes for the counsellor on this answer */}
                  {s.questionId &&
                    tips.get(s.questionId)?.map((tip, ti) => (
                      <p key={ti} className="mt-1.5 flex gap-2 rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-2.5 py-1.5 text-xs font-normal text-emerald-950 dark:text-emerald-100">
                        <Lightbulb aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                        <span>{tip}</span>
                      </p>
                    ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {lead.visitor && <Visitor v={lead.visitor} />}

      {(lead.visits?.length ?? 0) > 0 && <Visits visits={lead.visits!} />}

      {!q ? (
        <p className="rounded-xl bg-muted/60 p-3 text-muted-foreground">They didn&apos;t share counselling quiz answers with this inquiry.</p>
      ) : (
        <>
          <section>
            <h3 className="font-semibold">Counselling quiz result</h3>
            <p className="mt-1 text-xs text-muted-foreground">Taken {new Date(q.takenAt).toLocaleDateString()}. Shared by the person with this inquiry.</p>
            <p className="mt-2">
              Suggested area: <span className="font-medium">{q.primaryTrack}</span>
              {q.secondaryTrack && (
                <>
                  , then <span className="font-medium">{q.secondaryTrack}</span>
                </>
              )}
            </p>
            <p className="mt-1 text-muted-foreground">{CONFIDENCE[q.matchConfidence] ?? q.matchConfidence}</p>
            <ul className="mt-3 space-y-1.5">
              {q.ranking.map((r) => (
                <li key={r.track}>
                  <div className="flex justify-between text-xs">
                    <span>{r.track}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {r.percent}% ({r.picked} of {r.offered})
                    </span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-cyan-600" style={{ width: `${Math.min(100, r.percent)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">Score per area: of the questions that offered that area, the share where they picked it.</p>
          </section>

          {q.reasons.length > 0 && (
            <section>
              <h3 className="font-semibold">Why the quiz suggested it</h3>
              <ul className="mt-1 space-y-1.5">
                {q.reasons.map((r, i) => (
                  <li key={i}>
                    <span className="text-muted-foreground">{r.question}</span> <span className="font-medium">{r.answer}</span>{" "}
                    <span className="text-xs text-muted-foreground">({r.track})</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <details>
            <summary className="cursor-pointer font-semibold">All their answers ({q.answers.length})</summary>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {q.answers.map((a, i) => (
                <li key={i}>
                  <span className="text-muted-foreground">{a.question}</span>
                  <span className="block font-medium">{a.answer}</span>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </div>
  );
}
