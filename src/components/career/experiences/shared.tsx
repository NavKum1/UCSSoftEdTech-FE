"use client";

/**
 * Shared pieces for C9 experiential learning (internships for credit): types, status labels and the
 * detail panels used by the student, career-center and faculty pages. Brand-neutral.
 */

import React, { useState } from "react";
import { Badge, Button, Card, Field, formatDate } from "@/components/career/ui";
import type { useApi } from "@/lib/appAuth";

export type Api = ReturnType<typeof useApi>;

export interface Question {
  key: string;
  text: string;
  type: "rating" | "text";
}

export interface Program {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  creditHours: number;
  requiredHours: number;
  requiredDocuments: string[];
  midtermForm: Question[];
  finalForm: Question[];
  ratingScaleMax: number;
  reflectionPrompts: string[];
  facultyApprovers: string[];
  requireCpt: boolean;
  agreementTerms?: string | null;
  active: boolean;
}

export interface ExperienceSummary {
  id: string;
  status: string;
  studentName: string;
  studentEmail: string;
  program: { id: string; code: string; title: string } | null;
  employerName: string;
  roleTitle: string;
  startDate: string;
  endDate: string;
  isF1: boolean;
  cptStatus?: string | null;
  facultyApproved: boolean;
  agreementSigned: boolean;
  finalGrade?: string | null;
  submittedAt?: string | null;
  updatedAt: string;
}

export interface Signature {
  role: string;
  name: string;
  email?: string | null;
  signedAt: string;
  typedName: string;
  textSha256: string;
  ip?: string | null;
  userAgent?: string | null;
  provider: string;
}

export interface ExperienceDetail {
  id: string;
  status: string;
  student: { userId: string; name: string; email: string };
  program: Program;
  employer: { id?: string | null; name: string; website?: string | null };
  supervisor: { name: string; email: string; title?: string | null; confirmedAt?: string | null };
  roleTitle: string;
  startDate: string;
  endDate: string;
  hoursPerWeek: number;
  paid: boolean;
  location?: string | null;
  remote: boolean;
  learningObjectives: string[];
  cpt: { required: boolean; isF1: boolean; status?: string | null; dsoApprovalDate?: string | null; startDate?: string | null; endDate?: string | null; missing: boolean };
  approvals: { facultyApprovedAt?: string | null; staffApprovedAt?: string | null; declineReason?: string | null };
  agreement: {
    id: string;
    version: number;
    text: string;
    sha256: string;
    createdAt: string;
    completedAt?: string | null;
    signatures: Signature[];
    canSign: boolean;
    pendingRoles: string[];
  } | null;
  agreementHistory: { version: number; sha256: string; createdAt: string; voidedAt?: string | null; voidReason?: string | null; signatures: { role: string; name: string; signedAt: string; voidedAt?: string | null }[] }[];
  hours: { id: string; weekStart: string; hours: number; description?: string | null; status: string; decisionNote?: string | null; submittedAt: string }[];
  hoursSummary: { approved: number; pending: number; required: number };
  reflections: { id: string; prompt: string; body: string; facultyComment?: string | null; updatedAt: string }[];
  evaluations: { id: string; kind: string; submittedAt: string; submittedByName: string; ratingScaleMax: number; comments?: string | null; questions: Question[]; answers: Record<string, string | number | null> }[];
  documents: { id: string; kind: string; fileName: string; uploadedAt: string }[];
  missingDocuments: string[];
  grade: { finalGrade?: string | null; gradeComment?: string | null; gradedAt?: string | null };
  timeline: { actorName: string; actorRole: string; action: string; comment?: string | null; at: string }[];
  supervisorLinks?: { purpose: string; issuedAt: string; expiresAt: string; lastUsedAt?: string | null; useCount: number; state: string }[] | null;
  canEdit: boolean;
}

export const STATUS_LABELS: Record<string, string> = {
  Draft: "Draft",
  Submitted: "Submitted",
  Approved: "Approved: agreement to sign",
  AgreementSigned: "Agreement signed",
  Active: "Active",
  Evaluations: "Evaluations",
  Completed: "Completed",
  Declined: "Declined",
  Withdrawn: "Withdrawn",
};

const STATUS_TONES: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = {
  Draft: "neutral",
  Submitted: "info",
  Approved: "warn",
  AgreementSigned: "info",
  Active: "good",
  Evaluations: "warn",
  Completed: "good",
  Declined: "bad",
  Withdrawn: "neutral",
};

export const STEPS = ["Draft", "Submitted", "Approved", "AgreementSigned", "Active", "Evaluations", "Completed"];

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{STATUS_LABELS[status] ?? status}</Badge>;
}

export const CPT_NOTICE =
  "This is not legal advice. Your school's international student office (your DSO) decides whether you are eligible for CPT and authorizes it on your I-20. Don't start work before the CPT start date on your I-20.";

const ACTION_LABELS: Record<string, string> = {
  created: "Registration created",
  edited: "Registration edited",
  submitted: "Submitted for approval",
  "faculty.approved": "Faculty approved",
  approved: "Career center approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
  comment: "Comment",
  "document.uploaded": "Document uploaded",
  "cpt.updated": "CPT details recorded",
  "agreement.signed": "Agreement signed",
  "agreement.voided": "Agreement changed: signatures voided",
  "agreement.regenerated": "Agreement regenerated",
  "agreement.completed": "Agreement fully signed",
  "supervisor.confirmed": "Supervisor confirmed details",
  "supervisor.corrections": "Supervisor asked for corrections",
  "link.reissued": "Supervisor link sent",
  started: "Experience started",
  "hours.approved": "Hours approved",
  "hours.rejected": "Hours returned",
  "evaluation.midterm": "Midterm evaluation submitted",
  "evaluation.final": "Final evaluation submitted",
  "evaluations.opened": "Final evaluations opened",
  "evaluations.started": "Final evaluations opened",
  graded: "Grade recorded",
  // D2 defend your internship
  "defense.started": "Internship defense started",
  "defense.finished": "Internship defense finished",
  "defense.link.reissued": "Supervisor confirmation link sent",
  "defense.supervisor.yes": "Supervisor confirmed the work",
  "defense.supervisor.partly": "Supervisor partly confirmed the work",
  "defense.supervisor.no": "Supervisor did not confirm the work",
  "defense.override": "Verification changed",
  "defense.override.cleared": "Verification override removed",
  "defense.credential.issued": "Internship credential issued",
  "defense.credential.revoked": "Internship credential revoked",
};

/** Progress through the workflow, as an ordered list (not color-only: each step says done/current). */
export function Stepper({ status }: { status: string }) {
  if (status === "Declined" || status === "Withdrawn") return <p className="text-sm">This experience was {status.toLowerCase()}.</p>;
  const current = STEPS.indexOf(status);
  return (
    <ol className="flex flex-wrap gap-2 text-xs" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li
          key={s}
          aria-current={i === current ? "step" : undefined}
          className={`rounded-full border px-2 py-1 ${i === current ? "border-[var(--brand,#4f46e5)] font-semibold" : "border-border"} ${i < current ? "bg-muted" : ""}`}
        >
          {i < current ? "✓ " : ""}
          {STATUS_LABELS[s]}
          <span className="sr-only">{i < current ? " (done)" : i === current ? " (current step)" : " (to do)"}</span>
        </li>
      ))}
    </ol>
  );
}

export function OverviewCard({ x }: { x: ExperienceDetail }) {
  return (
    <Card title="Experience">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Row label="Student" value={`${x.student.name} (${x.student.email})`} />
        <Row label="Program" value={`${x.program.code} ${x.program.title} · ${x.program.creditHours} credits · ${x.program.requiredHours} hours`} />
        <Row label="Organization" value={x.employer.website ? `${x.employer.name} (${x.employer.website})` : x.employer.name} />
        <Row label="Role" value={x.roleTitle} />
        <Row label="Site supervisor" value={`${x.supervisor.name}${x.supervisor.title ? `, ${x.supervisor.title}` : ""} · ${x.supervisor.email}`} />
        <Row label="Supervisor confirmed" value={x.supervisor.confirmedAt ? formatDate(x.supervisor.confirmedAt, true) : "Not yet"} />
        <Row label="Dates" value={`${formatDate(x.startDate)} to ${formatDate(x.endDate)}`} />
        <Row label="Hours per week" value={`${x.hoursPerWeek} · ${x.paid ? "Paid" : "Unpaid"}`} />
        <Row label="Location" value={[x.remote ? "Remote" : null, x.location].filter(Boolean).join(" · ") || "—"} />
      </dl>
      <h3 className="mt-4 text-sm font-semibold">Learning objectives</h3>
      <ol className="ml-5 list-decimal text-sm">
        {x.learningObjectives.map((o, i) => (
          <li key={i}>{o}</li>
        ))}
      </ol>
      {x.cpt.isF1 && (
        <div className="mt-4 rounded-md border border-border p-3 text-sm">
          <h3 className="font-semibold">Curricular practical training (F-1)</h3>
          <p>
            Status: {x.cpt.status ?? "Not recorded"} · DSO approval: {formatDate(x.cpt.dsoApprovalDate)} · I-20 CPT dates: {formatDate(x.cpt.startDate)} to {formatDate(x.cpt.endDate)}
          </p>
          {x.cpt.missing && <p className="mt-1 font-medium">CPT dates and DSO approval date are still needed before the career center can approve.</p>}
          <p className="mt-1 text-xs text-muted-foreground">{CPT_NOTICE}</p>
        </div>
      )}
      {x.approvals.declineReason && (
        <p className="mt-4 text-sm">
          <strong>Decline reason:</strong> {x.approvals.declineReason}
        </p>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Agreement text, signature status, and the click-to-sign form for the current viewer. */
export function AgreementCard({ x, onSign, showAudit = false }: { x: ExperienceDetail; onSign?: (typedName: string, sha256: string) => Promise<void>; showAudit?: boolean }) {
  const [typed, setTyped] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const a = x.agreement;
  if (!a) return null;
  return (
    <Card title={`Learning agreement (version ${a.version})`}>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs" tabIndex={0} aria-label="Agreement text">
        {a.text}
      </pre>
      <p className="mt-2 break-all text-xs text-muted-foreground">Document fingerprint (SHA-256): {a.sha256}</p>
      <h3 className="mt-4 text-sm font-semibold">Signatures</h3>
      <ul className="text-sm">
        {["Student", "Supervisor", "Faculty"].map((role) => {
          const s = a.signatures.find((x) => x.role === role);
          return (
            <li key={role}>
              {role}: {s ? `Signed by ${s.name} on ${formatDate(s.signedAt, true)}` : "Not signed yet"}
              {s && showAudit && (
                <span className="block text-xs text-muted-foreground">
                  Typed “{s.typedName}” · {s.email} · IP {s.ip ?? "—"} · {s.userAgent ?? "—"} · {s.provider}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {a.canSign && onSign && (
        <form
          className="mt-4 space-y-3 border-t border-border pt-4"
          onSubmit={async (ev) => {
            ev.preventDefault();
            setBusy(true);
            try {
              await onSign(typed, a.sha256);
              setTyped("");
              setConsent(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Type your full name to sign">{(p) => <input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="name" required />}</Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" required />
            <span>I have read this version of the agreement, agree to it, and agree to sign electronically.</span>
          </label>
          <Button type="submit" busy={busy} disabled={!consent || typed.trim().length < 2}>
            Sign agreement
          </Button>
        </form>
      )}
      {x.agreementHistory.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer">Earlier versions ({x.agreementHistory.length})</summary>
          <ul className="mt-2 space-y-1">
            {x.agreementHistory.map((h) => (
              <li key={h.version}>
                Version {h.version}: replaced {formatDate(h.voidedAt, true)} ({h.voidReason ?? "changed"}); {h.signatures.length} signature(s) voided.
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

export function HoursCard({ x, children }: { x: ExperienceDetail; children?: React.ReactNode }) {
  const s = x.hoursSummary;
  return (
    <Card title="Hours">
      <p className="mb-3 text-sm">
        {s.approved} of {s.required} required hours approved{s.pending ? ` · ${s.pending} waiting for the supervisor` : ""}.
      </p>
      {children}
      {x.hours.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hours logged yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Weekly hours</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-1">Week of</th>
              <th scope="col">Hours</th>
              <th scope="col">What you worked on</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {x.hours.map((h) => (
              <tr key={h.id} className="border-b border-border/60 align-top">
                <td className="py-1">{formatDate(h.weekStart)}</td>
                <td>{h.hours}</td>
                <td>{h.description ?? "—"}</td>
                <td>
                  <Badge tone={h.status === "Approved" ? "good" : h.status === "Rejected" ? "bad" : "warn"}>{h.status === "Rejected" ? "Returned" : h.status}</Badge>
                  {h.decisionNote && <span className="block text-xs">{h.decisionNote}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function EvaluationsCard({ x }: { x: ExperienceDetail }) {
  return (
    <Card title="Supervisor evaluations">
      {x.evaluations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No evaluations yet. The site supervisor gets a secure link for the midterm and the final evaluation.</p>
      ) : (
        <div className="space-y-4">
          {x.evaluations.map((v) => (
            <section key={v.id} aria-label={`${v.kind} evaluation`}>
              <h3 className="text-sm font-semibold">
                {v.kind} evaluation · {v.submittedByName} · {formatDate(v.submittedAt)}
              </h3>
              <dl className="mt-1 space-y-1 text-sm">
                {v.questions.map((q) => (
                  <div key={q.key}>
                    <dt className="text-muted-foreground">{q.text}</dt>
                    <dd>{q.type === "rating" ? `${v.answers[q.key] ?? "—"} out of ${v.ratingScaleMax}` : (v.answers[q.key] ?? "—")}</dd>
                  </div>
                ))}
              </dl>
              {v.comments && <p className="mt-1 text-sm">Comments: {v.comments}</p>}
            </section>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Evaluations are part of the student&apos;s education record. They are never shared with other employers.</p>
    </Card>
  );
}

export function TimelineCard({ x }: { x: ExperienceDetail }) {
  return (
    <Card title="Activity and comments">
      <ol className="space-y-2 text-sm">
        {x.timeline.map((t, i) => (
          <li key={i}>
            <span className="text-xs text-muted-foreground">{formatDate(t.at, true)}</span> · <strong>{ACTION_LABELS[t.action] ?? t.action}</strong> by {t.actorName}
            {t.actorRole !== "System" ? ` (${t.actorRole.toLowerCase()})` : ""}
            {t.comment && <span className="block whitespace-pre-wrap pl-4">{t.comment}</span>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function DocumentsList({ x, onDownload }: { x: ExperienceDetail; onDownload: (id: string, name: string) => void }) {
  return (
    <div className="text-sm">
      {x.program.requiredDocuments.length > 0 && <p>Required: {x.program.requiredDocuments.join(", ")}.{x.missingDocuments.length > 0 ? ` Missing: ${x.missingDocuments.join(", ")}.` : " All uploaded."}</p>}
      <ul className="mt-2 space-y-1">
        {x.documents.map((d) => (
          <li key={d.id}>
            {d.kind}:{" "}
            <button type="button" className="underline" onClick={() => onDownload(d.id, d.fileName)}>
              {d.fileName}
            </button>{" "}
            <span className="text-xs text-muted-foreground">({formatDate(d.uploadedAt)})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Downloads a protected file via the authenticated API caller. */
export async function downloadWith(api: Api, path: string, fileName: string) {
  const res = await api<Response>(path, { raw: true });
  if (!res.ok) throw new Error("Download failed.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function CommentBox({ label, onSubmit, submitLabel = "Add comment", required = true }: { label: string; onSubmit: (text: string) => Promise<void>; submitLabel?: string; required?: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(text);
          setText("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={label}>{(p) => <textarea {...p} rows={3} value={text} onChange={(e) => setText(e.target.value)} required={required} />}</Field>
      <Button type="submit" variant="secondary" busy={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}

export function ApproveDecline({ canApprove, onApprove, onDecline }: { canApprove: boolean; onApprove: (c: string) => Promise<void>; onDecline: (c: string) => Promise<void> }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (kind: string, fn: (c: string) => Promise<void>) => {
    setBusy(kind);
    try {
      await fn(comment);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-3">
      <Field label="Comment" hint="Required when declining; shown to the student.">{(p) => <textarea {...p} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />}</Field>
      <div className="flex gap-2">
        <Button busy={busy === "a"} disabled={!canApprove} onClick={() => run("a", onApprove)}>
          Approve
        </Button>
        <Button variant="danger" busy={busy === "d"} disabled={!comment.trim()} onClick={() => run("d", onDecline)}>
          Decline
        </Button>
      </div>
    </div>
  );
}
