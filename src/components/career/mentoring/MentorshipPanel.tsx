"use client";

/**
 * Shared pieces for the mentoring network (C10): types, labels and the mentorship detail panel used by both
 * the student and the mentor. Private session notes are shown only here (to the pair), never on staff pages.
 */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useLoad, useCareerT, useCareerLabels } from "@/components/career/ui";
import MentorshipMessages from "@/components/career/messaging/MentorshipMessages";

export interface MentoringOptions {
  topics: { key: string; label: string }[];
  meetingFormats: string[];
  reportReasons: string[];
  functions: string[];
  industries: string[];
  requireStaffApproval: boolean;
  maxOpenRequests: number;
  scoring: string;
}

export interface RelationshipSummary {
  id: string;
  status: string;
  side: "Student" | "Mentor" | "Staff";
  mentorProfileId: string;
  mentorName: string;
  studentName: string;
  message: string;
  goals: string[];
  matchReasons: string[];
  mentorNote?: string | null;
  requestedAt: string;
  mentorDecidedAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  endReason?: string | null;
  lastActivityAt: string;
  sessions: number;
  totalMinutes: number;
  lastSession?: string | null;
  checkInDue: boolean;
  contactShared: boolean;
}

export interface SessionRow {
  id: string;
  occurredOn: string;
  durationMinutes: number;
  format: string;
  privateNotes?: string | null;
  sharedSummary?: string | null;
  loggedByMe: boolean;
}

export interface PairDetail {
  relationship: RelationshipSummary;
  contact: { name: string; email?: string | null; phone?: string | null } | null;
  sessions: SessionRow[];
  myFeedback: { rating: number; comment?: string | null } | null;
  canLogSession: boolean;
  canGiveFeedback: boolean;
}

export const MEETING_LABELS_KEYS = ["Video", "Phone", "InPerson", "Email"];
/** meeting labels in the career language (G1) */
export function useMeetingLabels(): Record<string, string> {
  return useCareerLabels("mentorshipPanel.meeting", MEETING_LABELS_KEYS);
}
export const REPORT_REASON_LABELS_KEYS = ["Inappropriate", "Harassment", "Unresponsive", "Spam", "SafetyConcern", "Other"];
/** report reason labels in the career language (G1) */
export function useReportReasonLabels(): Record<string, string> {
  return useCareerLabels("mentorshipPanel.reportReason", REPORT_REASON_LABELS_KEYS);
}
export const STATUS_LABELS_KEYS = ["Requested", "PendingStaff", "Active", "Declined", "Withdrawn", "Completed", "Ended", "Invited", "Draft", "Pending", "Approved", "Paused", "Rejected", "Suspended", "Open", "Upheld", "Dismissed"];
/** status labels in the career language (G1) */
export function useMentoringStatusLabels(): Record<string, string> {
  return useCareerLabels("mentorshipPanel.status", STATUS_LABELS_KEYS);
}

export function statusTone(status: string): "neutral" | "good" | "warn" | "bad" | "info" {
  if (["Active", "Approved", "Completed"].includes(status)) return "good";
  if (["Requested", "PendingStaff", "Pending", "Invited", "Draft", "Paused", "Open"].includes(status)) return "warn";
  if (["Declined", "Rejected", "Suspended", "Ended", "Upheld"].includes(status)) return "bad";
  return "neutral";
}

export function StatusBadge({ status }: { status: string }) {
  const STATUS_LABELS = useMentoringStatusLabels();
  return <Badge tone={statusTone(status)}>{STATUS_LABELS[status] ?? status}</Badge>;
}

export function topicLabel(options: MentoringOptions | null, key: string) {
  return options?.topics.find((t) => t.key === key)?.label ?? key;
}

/** Multi-select rendered as a group of labelled checkboxes (keyboard and screen-reader friendly). */
export function CheckboxGroup({
  legend,
  options,
  value,
  onChange,
  hint,
}: {
  legend: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  hint?: string;
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((o) => (
          <label key={o.value} className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.includes(o.value)}
              onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export const splitList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const today = () => new Date().toISOString().slice(0, 10);

/** Detail of one mentorship for the student or the mentor: goals, contact, session log, end, feedback, report. */
export function MentorshipPanel({ id, options, onChanged }: { id: string; options: MentoringOptions | null; onChanged?: () => void }) {
  const tr = useCareerT("mentorshipPanel");
  const REPORT_REASON_LABELS = useReportReasonLabels();
  const MEETING_LABELS = useMeetingLabels();
  const api = useApi();
  const detail = useLoad(() => api<PairDetail>(`/api/career/mentoring/relationships/${id}`), [api, id]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [session, setSession] = useState({ occurredOn: today(), durationMinutes: "30", format: "Video", privateNotes: "", sharedSummary: "" });
  const [endReason, setEndReason] = useState("");
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [report, setReport] = useState({ open: false, reason: "Inappropriate", details: "", block: false });
  const [goalsText, setGoalsText] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<PairDetail | unknown>, success: string) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      const result = await fn();
      if (result && typeof result === "object" && "relationship" in (result as object)) detail.setData(result as PairDetail);
      else detail.reload();
      setMsg(success);
      onChanged?.();
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (detail.loading && !detail.data) return <Loading />;
  if (!detail.data) return <ErrorBanner error={detail.error} onRetry={detail.reload} />;
  const d = detail.data;
  const r = d.relationship;
  const isStudent = r.side === "Student";
  const other = isStudent ? r.mentorName : r.studentName;
  const base = `/api/career/mentoring/relationships/${id}`;

  return (
    <div className="space-y-4">
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <Card title={tr("mentorshipWithOther", { other })} actions={<StatusBadge status={r.status} />}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">{tr("requested")}</dt>
            <dd>{formatDate(r.requestedAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">{tr("started")}</dt>
            <dd>{formatDate(r.startedAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">{tr("sessions")}</dt>
            <dd>
              {r.sessions} ({Math.round((r.totalMinutes / 60) * 10) / 10}{" "}{tr("hours")}
            </dd>
          </div>
          {r.endedAt && (
            <div>
              <dt className="font-medium">{tr("ended")}</dt>
              <dd>
                {formatDate(r.endedAt)}
                {r.endReason ? ` – ${r.endReason}` : ""}
              </dd>
            </div>
          )}
        </dl>
        {r.checkInDue && (
          <p className="mt-3 text-sm" role="status">
            <Badge tone="warn">{tr("checkInDue")}</Badge>{" "}{tr("noSessionHasBeenLogged")}
          </p>
        )}
        <h3 className="mt-4 text-sm font-semibold">{tr("requestMessage")}</h3>
        <p className="whitespace-pre-wrap text-sm">{r.message}</p>
        {r.mentorNote && (
          <>
            <h3 className="mt-3 text-sm font-semibold">{tr("mentorsNote")}</h3>
            <p className="text-sm">{r.mentorNote}</p>
          </>
        )}
        <h3 className="mt-4 text-sm font-semibold">{tr("goals")}</h3>
        {goalsText === null ? (
          <>
            <ul className="list-disc ps-5 text-sm">
              {r.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            {isStudent && ["Requested", "PendingStaff", "Active"].includes(r.status) && (
              <Button variant="ghost" className="mt-1" onClick={() => setGoalsText(r.goals.join("\n"))}>
                {tr("editGoals")}
              </Button>
            )}
          </>
        ) : (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run("goals", () => api(`${base}/goals`, { method: "PUT", json: { goals: goalsText.split("\n").map((x) => x.trim()).filter(Boolean) } }), tr("goalsUpdated"));
              if (ok) setGoalsText(null);
            }}
          >
            <Field label={tr("goalsOnePerLineUp")}>
              {(p) => <textarea {...p} rows={4} value={goalsText} onChange={(e) => setGoalsText(e.target.value)} />}
            </Field>
            <div className="flex gap-2">
              <Button type="submit" busy={busy === "goals"}>
                {tr("saveGoals")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setGoalsText(null)}>
                {tr("cancel")}
              </Button>
            </div>
          </form>
        )}
        {r.matchReasons.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold">{tr("whyThisMatch")}</h3>
            <ul className="list-disc ps-5 text-sm text-muted-foreground">
              {r.matchReasons.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card title={tr("contactDetails")}>
        {d.contact ? (
          <div className="text-sm">
            <p className="font-medium">{d.contact.name}</p>
            {d.contact.email && (
              <p>
                {tr.rich("emailEmail", { link: (chunks) => <a className="underline" href={`mailto:${d.contact!.email}`}>{chunks}</a>, email: d.contact.email })}
              </p>
            )}
            {d.contact.phone && <p>{tr("phonePhone", { phone: d.contact.phone })}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              {isStudent
                ? tr("sharedBecauseYouBothAccepted")
                : tr("sharedWithTheStudentsConsent")}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{tr("contactDetailsAreExchangedOnce")}{r.status === "PendingStaff" ? tr("andTheCareerCenterConfirms") : ""}.</p>
        )}
      </Card>

      {["Active", "Completed", "Ended"].includes(r.status) && (
        <Card title={tr("messages")}>
          <p className="mb-3 text-xs text-muted-foreground">
            {r.status === "Active"
              ? tr("privateMessagesBetweenYouAnd", { other })
              : tr("thisMentorshipHasEndedSo")}
          </p>
          <MentorshipMessages mentorshipId={id} status={r.status} />
        </Card>
      )}

      <Card title={tr("sessionLog")}>
        <p className="mb-3 text-xs text-muted-foreground">
          {tr("privateNotesAreVisibleOnly", { other })}
        </p>
        {d.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr("noSessionsLoggedYet")}</p>
        ) : (
          <ul className="mb-4 divide-y divide-border">
            {d.sessions.map((s) => (
              <li key={s.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {tr("occurredOnDurationMinutesMinFormat", { occurredOn: formatDate(s.occurredOn), durationMinutes: s.durationMinutes, format: MEETING_LABELS[s.format] ?? s.format })}
                  </span>
                  {s.loggedByMe && (
                    <Button
                      variant="ghost"
                      busy={busy === s.id}
                      onClick={() => {
                        if (window.confirm(tr("deleteThisSessionFromThe"))) void run(s.id, () => api(`${base}/sessions/${s.id}`, { method: "DELETE" }), tr("sessionDeleted"));
                      }}
                    >
                      {tr.rich("deleteSessionOnOccurredOn", { span: (chunks) => <span className="sr-only">{chunks}</span>, occurredOn: formatDate(s.occurredOn) })}
                    </Button>
                  )}
                </div>
                {s.privateNotes && (
                  <p className="whitespace-pre-wrap">
                    <span className="font-medium">{tr("privateNotes")}{" "}</span>
                    {s.privateNotes}
                  </p>
                )}
                {s.sharedSummary && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">{tr("sharedWithCareerCenter")}{" "}</span>
                    {s.sharedSummary}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        {d.canLogSession && (
          <form
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(
                "session",
                () => api(`${base}/sessions`, { json: { ...session, durationMinutes: Number(session.durationMinutes) } }),
                tr("sessionLogged"),
              );
              if (ok) setSession({ ...session, privateNotes: "", sharedSummary: "" });
            }}
          >
            <h3 className="text-sm font-semibold sm:col-span-3">{tr("logASession")}</h3>
            <Field label={tr("date")}>{(p) => <input {...p} type="date" required max={today()} value={session.occurredOn} onChange={(e) => setSession({ ...session, occurredOn: e.target.value })} />}</Field>
            <Field label={tr("lengthMinutes")}>
              {(p) => <input {...p} type="number" min={5} max={480} required value={session.durationMinutes} onChange={(e) => setSession({ ...session, durationMinutes: e.target.value })} />}
            </Field>
            <Field label={tr("howYouMet")}>
              {(p) => (
                <select {...p} value={session.format} onChange={(e) => setSession({ ...session, format: e.target.value })}>
                  {(options?.meetingFormats ?? ["Video", "Phone", "InPerson", "Email"]).map((f) => (
                    <option key={f} value={f}>
                      {MEETING_LABELS[f] ?? f}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="sm:col-span-3">
              <Field label={tr("privateNotesOnlyTheTwo")}>
                {(p) => <textarea {...p} rows={3} maxLength={4000} value={session.privateNotes} onChange={(e) => setSession({ ...session, privateNotes: e.target.value })} />}
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field label={tr("summaryForTheCareerCenter")} hint={tr("keepItShortAndGeneral")}>
                {(p) => <input {...p} maxLength={1000} value={session.sharedSummary} onChange={(e) => setSession({ ...session, sharedSummary: e.target.value })} />}
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" busy={busy === "session"}>
                {tr("logSession")}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {r.status === "Active" && (
        <Card title={tr("finishTheMentorship")}>
          <Field label={tr("reasonOrWrapUpOptional")}>{(p) => <input {...p} maxLength={1000} value={endReason} onChange={(e) => setEndReason(e.target.value)} />}</Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button busy={busy === "complete"} onClick={() => void run("complete", () => api(`${base}/end`, { json: { completed: true, reason: endReason } }), tr("markedAsCompletedPleaseLeave"))}>
              {tr("markCompleted")}
            </Button>
            <Button
              variant="secondary"
              busy={busy === "end"}
              onClick={() => {
                if (window.confirm(tr("endTheMentorshipWithOther", { other }))) void run("end", () => api(`${base}/end`, { json: { completed: false, reason: endReason } }), tr("mentorshipEnded"));
              }}
            >
              {tr("endEarly")}
            </Button>
          </div>
        </Card>
      )}

      {(d.canGiveFeedback || d.myFeedback) && (
        <Card title={tr("feedback")}>
          {d.myFeedback ? (
            <p className="text-sm">
              {tr("youRatedThisMentorshipRating", { rating: d.myFeedback.rating })}{d.myFeedback.comment ? `: “${d.myFeedback.comment}”` : "."}{" "}{tr("yourFeedbackGoesToThe")}
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run("feedback", () => api(`${base}/feedback`, { json: { rating: Number(rating), comment } }), tr("thanksForYourFeedback"));
              }}
            >
              <p className="text-xs text-muted-foreground">{tr("yourRatingAndCommentGo", { other })}</p>
              <Field label={tr("rating1Poor5Excellent")}>
                {(p) => (
                  <select {...p} value={rating} onChange={(e) => setRating(e.target.value)}>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={tr("commentOptional")}>{(p) => <textarea {...p} rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />}</Field>
              <Button type="submit" busy={busy === "feedback"}>
                {tr("sendFeedback")}
              </Button>
            </form>
          )}
        </Card>
      )}

      <Card title={tr("safety")}>
        {!report.open ? (
          <div className="text-sm">
            <p className="mb-2">{tr("ifSomethingFeltWrongTell")}</p>
            <Button variant="secondary" onClick={() => setReport({ ...report, open: true })}>
              {tr("reportAProblem")}
            </Button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(
                "report",
                () => api(`${base}/report`, { json: { reason: report.reason, details: report.details, block: report.block } }),
                tr("yourReportWasSentTo"),
              );
              if (ok) setReport({ open: false, reason: "Inappropriate", details: "", block: false });
            }}
          >
            <Field label={tr("whatHappened")}>
              {(p) => (
                <select {...p} value={report.reason} onChange={(e) => setReport({ ...report, reason: e.target.value })}>
                  {(options?.reportReasons ?? Object.keys(REPORT_REASON_LABELS)).map((x) => (
                    <option key={x} value={x}>
                      {REPORT_REASON_LABELS[x] ?? x}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={tr("details")}>{(p) => <textarea {...p} rows={4} required minLength={10} maxLength={4000} value={report.details} onChange={(e) => setReport({ ...report, details: e.target.value })} />}</Field>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={report.block} onChange={(e) => setReport({ ...report, block: e.target.checked })} />
              {tr("blockOtherEndsThisMentorship", { other })}
            </label>
            <div className="flex gap-2">
              <Button type="submit" variant="danger" busy={busy === "report"}>
                {tr("sendReport")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setReport({ ...report, open: false })}>
                {tr("cancel")}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
