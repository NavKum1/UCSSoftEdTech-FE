"use client";

/**
 * Shared pieces for the mentoring network (C10): types, labels and the mentorship detail panel used by both
 * the student and the mentor. Private session notes are shown only here (to the pair), never on staff pages.
 */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";

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

export const MEETING_LABELS: Record<string, string> = { Video: "Video call", Phone: "Phone", InPerson: "In person", Email: "Email" };
export const REPORT_REASON_LABELS: Record<string, string> = {
  Inappropriate: "Inappropriate behavior",
  Harassment: "Harassment",
  Unresponsive: "Not responding",
  Spam: "Spam or selling",
  SafetyConcern: "Safety concern",
  Other: "Something else",
};
export const STATUS_LABELS: Record<string, string> = {
  Requested: "Waiting for mentor",
  PendingStaff: "Waiting for career center",
  Active: "Active",
  Declined: "Not accepted",
  Withdrawn: "Withdrawn",
  Completed: "Completed",
  Ended: "Ended",
  Invited: "Invited",
  Draft: "Draft",
  Pending: "Waiting for approval",
  Approved: "Listed",
  Paused: "Paused",
  Rejected: "Changes requested",
  Suspended: "Suspended",
  Open: "Open",
  Upheld: "Upheld",
  Dismissed: "Dismissed",
};

export function statusTone(status: string): "neutral" | "good" | "warn" | "bad" | "info" {
  if (["Active", "Approved", "Completed"].includes(status)) return "good";
  if (["Requested", "PendingStaff", "Pending", "Invited", "Draft", "Paused", "Open"].includes(status)) return "warn";
  if (["Declined", "Rejected", "Suspended", "Ended", "Upheld"].includes(status)) return "bad";
  return "neutral";
}

export function StatusBadge({ status }: { status: string }) {
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
      <Card title={`Mentorship with ${other}`} actions={<StatusBadge status={r.status} />}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Requested</dt>
            <dd>{formatDate(r.requestedAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">Started</dt>
            <dd>{formatDate(r.startedAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">Sessions</dt>
            <dd>
              {r.sessions} ({Math.round((r.totalMinutes / 60) * 10) / 10} hours)
            </dd>
          </div>
          {r.endedAt && (
            <div>
              <dt className="font-medium">Ended</dt>
              <dd>
                {formatDate(r.endedAt)}
                {r.endReason ? ` – ${r.endReason}` : ""}
              </dd>
            </div>
          )}
        </dl>
        {r.checkInDue && (
          <p className="mt-3 text-sm" role="status">
            <Badge tone="warn">Check-in due</Badge> No session has been logged for a while. Plan your next conversation, or mark the mentorship completed.
          </p>
        )}
        <h3 className="mt-4 text-sm font-semibold">Request message</h3>
        <p className="whitespace-pre-wrap text-sm">{r.message}</p>
        {r.mentorNote && (
          <>
            <h3 className="mt-3 text-sm font-semibold">Mentor&apos;s note</h3>
            <p className="text-sm">{r.mentorNote}</p>
          </>
        )}
        <h3 className="mt-4 text-sm font-semibold">Goals</h3>
        {goalsText === null ? (
          <>
            <ul className="list-disc pl-5 text-sm">
              {r.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            {isStudent && ["Requested", "PendingStaff", "Active"].includes(r.status) && (
              <Button variant="ghost" className="mt-1" onClick={() => setGoalsText(r.goals.join("\n"))}>
                Edit goals
              </Button>
            )}
          </>
        ) : (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run("goals", () => api(`${base}/goals`, { method: "PUT", json: { goals: goalsText.split("\n").map((x) => x.trim()).filter(Boolean) } }), "Goals updated.");
              if (ok) setGoalsText(null);
            }}
          >
            <Field label="Goals (one per line, up to 5)">
              {(p) => <textarea {...p} rows={4} value={goalsText} onChange={(e) => setGoalsText(e.target.value)} />}
            </Field>
            <div className="flex gap-2">
              <Button type="submit" busy={busy === "goals"}>
                Save goals
              </Button>
              <Button type="button" variant="secondary" onClick={() => setGoalsText(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
        {r.matchReasons.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-semibold">Why this match</h3>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {r.matchReasons.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card title="Contact details">
        {d.contact ? (
          <div className="text-sm">
            <p className="font-medium">{d.contact.name}</p>
            {d.contact.email && (
              <p>
                Email: <a className="underline" href={`mailto:${d.contact.email}`}>{d.contact.email}</a>
              </p>
            )}
            {d.contact.phone && <p>Phone: {d.contact.phone}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              {isStudent
                ? "Shared because you both accepted. Your contact details were shared with your mentor with your consent, and the sharing is recorded on your Privacy page."
                : "Shared with the student's consent. Use it only for this mentorship."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Contact details are exchanged once both of you accept{r.status === "PendingStaff" ? " and the career center confirms the match" : ""}.</p>
        )}
      </Card>

      <Card title="Session log">
        <p className="mb-3 text-xs text-muted-foreground">
          Private notes are visible only to you and {other}. The career center sees dates, length and any summary you choose to share.
        </p>
        {d.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions logged yet.</p>
        ) : (
          <ul className="mb-4 divide-y divide-border">
            {d.sessions.map((s) => (
              <li key={s.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {formatDate(s.occurredOn)} · {s.durationMinutes} min · {MEETING_LABELS[s.format] ?? s.format}
                  </span>
                  {s.loggedByMe && (
                    <Button
                      variant="ghost"
                      busy={busy === s.id}
                      onClick={() => {
                        if (window.confirm("Delete this session from the log?")) void run(s.id, () => api(`${base}/sessions/${s.id}`, { method: "DELETE" }), "Session deleted.");
                      }}
                    >
                      Delete<span className="sr-only"> session on {formatDate(s.occurredOn)}</span>
                    </Button>
                  )}
                </div>
                {s.privateNotes && (
                  <p className="whitespace-pre-wrap">
                    <span className="font-medium">Private notes: </span>
                    {s.privateNotes}
                  </p>
                )}
                {s.sharedSummary && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Shared with career center: </span>
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
                "Session logged.",
              );
              if (ok) setSession({ ...session, privateNotes: "", sharedSummary: "" });
            }}
          >
            <h3 className="text-sm font-semibold sm:col-span-3">Log a session</h3>
            <Field label="Date">{(p) => <input {...p} type="date" required max={today()} value={session.occurredOn} onChange={(e) => setSession({ ...session, occurredOn: e.target.value })} />}</Field>
            <Field label="Length (minutes)">
              {(p) => <input {...p} type="number" min={5} max={480} required value={session.durationMinutes} onChange={(e) => setSession({ ...session, durationMinutes: e.target.value })} />}
            </Field>
            <Field label="How you met">
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
              <Field label="Private notes (only the two of you)">
                {(p) => <textarea {...p} rows={3} maxLength={4000} value={session.privateNotes} onChange={(e) => setSession({ ...session, privateNotes: e.target.value })} />}
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field label="Summary for the career center (optional)" hint="Keep it short and general, e.g. “Reviewed resume draft”.">
                {(p) => <input {...p} maxLength={1000} value={session.sharedSummary} onChange={(e) => setSession({ ...session, sharedSummary: e.target.value })} />}
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" busy={busy === "session"}>
                Log session
              </Button>
            </div>
          </form>
        )}
      </Card>

      {r.status === "Active" && (
        <Card title="Finish the mentorship">
          <Field label="Reason or wrap-up (optional)">{(p) => <input {...p} maxLength={1000} value={endReason} onChange={(e) => setEndReason(e.target.value)} />}</Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button busy={busy === "complete"} onClick={() => void run("complete", () => api(`${base}/end`, { json: { completed: true, reason: endReason } }), "Marked as completed. Please leave feedback.")}>
              Mark completed
            </Button>
            <Button
              variant="secondary"
              busy={busy === "end"}
              onClick={() => {
                if (window.confirm(`End the mentorship with ${other} early?`)) void run("end", () => api(`${base}/end`, { json: { completed: false, reason: endReason } }), "Mentorship ended.");
              }}
            >
              End early
            </Button>
          </div>
        </Card>
      )}

      {(d.canGiveFeedback || d.myFeedback) && (
        <Card title="Feedback">
          {d.myFeedback ? (
            <p className="text-sm">
              You rated this mentorship {d.myFeedback.rating} out of 5{d.myFeedback.comment ? `: “${d.myFeedback.comment}”` : "."} Your feedback goes to the career center only.
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run("feedback", () => api(`${base}/feedback`, { json: { rating: Number(rating), comment } }), "Thanks for your feedback.");
              }}
            >
              <p className="text-xs text-muted-foreground">Your rating and comment go to the career center, not to {other}.</p>
              <Field label="Rating (1 = poor, 5 = excellent)">
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
              <Field label="Comment (optional)">{(p) => <textarea {...p} rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />}</Field>
              <Button type="submit" busy={busy === "feedback"}>
                Send feedback
              </Button>
            </form>
          )}
        </Card>
      )}

      <Card title="Safety">
        {!report.open ? (
          <div className="text-sm">
            <p className="mb-2">If something felt wrong, tell the career center. They review every report; new matches for the reported person are paused meanwhile.</p>
            <Button variant="secondary" onClick={() => setReport({ ...report, open: true })}>
              Report a problem
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
                "Your report was sent to the career center.",
              );
              if (ok) setReport({ open: false, reason: "Inappropriate", details: "", block: false });
            }}
          >
            <Field label="What happened?">
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
            <Field label="Details">{(p) => <textarea {...p} rows={4} required minLength={10} maxLength={4000} value={report.details} onChange={(e) => setReport({ ...report, details: e.target.value })} />}</Field>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={report.block} onChange={(e) => setReport({ ...report, block: e.target.checked })} />
              Block {other} (ends this mentorship and hides you from each other)
            </label>
            <div className="flex gap-2">
              <Button type="submit" variant="danger" busy={busy === "report"}>
                Send report
              </Button>
              <Button type="button" variant="secondary" onClick={() => setReport({ ...report, open: false })}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
