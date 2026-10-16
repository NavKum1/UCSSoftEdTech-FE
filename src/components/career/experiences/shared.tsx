"use client";

/**
 * Shared pieces for C9 experiential learning (internships for credit): types, status labels and the
 * detail panels used by the student, career-center and faculty pages. Brand-neutral.
 */

import React, { useState } from "react";
import { Badge, Button, Card, Field, formatDate, useCareerT, useCareerLabels } from "@/components/career/ui";
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

export const STATUS_LABELS_KEYS = ["Draft", "Submitted", "Approved", "AgreementSigned", "Active", "Evaluations", "Completed", "Declined", "Withdrawn"];
/** status labels in the career language (G1) */
export function useExperienceStatusLabels(): Record<string, string> {
  return useCareerLabels("experiencesShared.statusLabel", STATUS_LABELS_KEYS);
}

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

const SIGNER_ROLES = ["Student", "Supervisor", "Faculty"];

export const STEPS = ["Draft", "Submitted", "Approved", "AgreementSigned", "Active", "Evaluations", "Completed"];

export function StatusBadge({ status }: { status: string }) {
  const STATUS_LABELS = useExperienceStatusLabels();
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{STATUS_LABELS[status] ?? status}</Badge>;
}


const ACTION_LABELS_KEYS = ["created", "edited", "submitted", "faculty.approved", "approved", "declined", "withdrawn", "comment", "document.uploaded", "cpt.updated", "agreement.signed", "agreement.voided", "agreement.regenerated", "agreement.completed", "supervisor.confirmed", "supervisor.corrections", "link.reissued", "started", "hours.approved", "hours.rejected", "evaluation.midterm", "evaluation.final", "evaluations.opened", "evaluations.started", "graded", "defense.started", "defense.finished", "defense.link.reissued", "defense.supervisor.yes", "defense.supervisor.partly", "defense.supervisor.no", "defense.override", "defense.override.cleared", "defense.credential.issued", "defense.credential.revoked"];
/** action labels in the career language (G1) */
function useActionLabels(): Record<string, string> {
  return useCareerLabels("experiencesShared.action", ACTION_LABELS_KEYS);
}

/** Progress through the workflow, as an ordered list (not color-only: each step says done/current). */
export function Stepper({ status }: { status: string }) {
  const tr = useCareerT("experiencesShared");
  const STATUS_LABELS = useExperienceStatusLabels();
  if (status === "Declined" || status === "Withdrawn") return <p className="text-sm">{tr("thisExperienceWasStatus", { status: status.toLowerCase() })}</p>;
  const current = STEPS.indexOf(status);
  return (
    <ol className="flex flex-wrap gap-2 text-xs" aria-label={tr("progress")}>
      {STEPS.map((s, i) => (
        <li
          key={s}
          aria-current={i === current ? "step" : undefined}
          className={`rounded-full border px-2 py-1 ${i === current ? "border-[var(--brand,#4f46e5)] font-semibold" : "border-border"} ${i < current ? "bg-muted" : ""}`}
        >
          {i < current ? "✓ " : ""}
          {STATUS_LABELS[s]}
          <span className="sr-only">{i < current ? tr("done") : i === current ? tr("currentStep") : tr("toDo")}</span>
        </li>
      ))}
    </ol>
  );
}

export function OverviewCard({ x }: { x: ExperienceDetail }) {
  const tr = useCareerT("experiencesShared");
  return (
    <Card title={tr("experience")}>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Row label={tr("student")} value={`${x.student.name} (${x.student.email})`} />
        <Row label={tr("program")} value={tr("programSummary", { code: x.program.code, title: x.program.title, creditHours: x.program.creditHours, requiredHours: x.program.requiredHours })} />
        <Row label={tr("organization")} value={x.employer.website ? `${x.employer.name} (${x.employer.website})` : x.employer.name} />
        <Row label={tr("role")} value={x.roleTitle} />
        <Row label={tr("siteSupervisor")} value={`${x.supervisor.name}${x.supervisor.title ? `, ${x.supervisor.title}` : ""} · ${x.supervisor.email}`} />
        <Row label={tr("supervisorConfirmed")} value={x.supervisor.confirmedAt ? formatDate(x.supervisor.confirmedAt, true) : tr("notYet")} />
        <Row label={tr("dates")} value={tr("startDateToEndDate", { startDate: formatDate(x.startDate), endDate: formatDate(x.endDate) })} />
        <Row label={tr("hoursPerWeek")} value={`${x.hoursPerWeek} · ${x.paid ? tr("paid") : tr("unpaid")}`} />
        <Row label={tr("location")} value={[x.remote ? tr("remote") : null, x.location].filter(Boolean).join(" · ") || "—"} />
      </dl>
      <h3 className="mt-4 text-sm font-semibold">{tr("learningObjectives")}</h3>
      <ol className="ms-5 list-decimal text-sm">
        {x.learningObjectives.map((o, i) => (
          <li key={i}>{o}</li>
        ))}
      </ol>
      {x.cpt.isF1 && (
        <div className="mt-4 rounded-md border border-border p-3 text-sm">
          <h3 className="font-semibold">{tr("curricularPracticalTrainingF1")}</h3>
          <p>
            {tr("statusStatusDSOApprovalDsoApprovalDate", { status: x.cpt.status ?? tr("notRecorded"), dsoApprovalDate: formatDate(x.cpt.dsoApprovalDate), startDate: formatDate(x.cpt.startDate), endDate: formatDate(x.cpt.endDate) })}
          </p>
          {x.cpt.missing && <p className="mt-1 font-medium">{tr("cPTDatesAndDSOApproval")}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{tr("cptNotice")}</p>
        </div>
      )}
      {x.approvals.declineReason && (
        <p className="mt-4 text-sm">
          <strong>{tr("declineReason")}</strong> {x.approvals.declineReason}
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
  const tr = useCareerT("experiencesShared");
  const [typed, setTyped] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const SIGNERS = useCareerLabels("experiencesShared.signer", SIGNER_ROLES);
  const a = x.agreement;
  if (!a) return null;
  return (
    <Card title={tr("learningAgreementVersionVersion", { version: a.version })}>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs" tabIndex={0} aria-label={tr("agreementText")}>
        {a.text}
      </pre>
      <p className="mt-2 break-all text-xs text-muted-foreground">{tr("documentFingerprintSHA256Sha256", { sha256: a.sha256 })}</p>
      <h3 className="mt-4 text-sm font-semibold">{tr("signatures")}</h3>
      <ul className="text-sm">
        {SIGNER_ROLES.map((role) => {
          const s = a.signatures.find((x) => x.role === role);
          return (
            <li key={role}>
              {tr("signerRole", { role: SIGNERS[role] })}{" "}{s ? tr("signedByNameOnSignedAt", { name: s.name, signedAt: formatDate(s.signedAt, true) }) : tr("notSignedYet")}
              {s && showAudit && (
                <span className="block text-xs text-muted-foreground">
                  {tr("typedTypedNameEmailIPIp", { typedName: s.typedName, email: s.email, ip: s.ip ?? "—", userAgent: s.userAgent ?? "—", provider: s.provider })}
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
          <Field label={tr("typeYourFullNameTo")}>{(p) => <input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="name" required />}</Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" required />
            <span>{tr("iHaveReadThisVersion")}</span>
          </label>
          <Button type="submit" busy={busy} disabled={!consent || typed.trim().length < 2}>
            {tr("signAgreement")}
          </Button>
        </form>
      )}
      {x.agreementHistory.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer">{tr("earlierVersionsCount", { count: x.agreementHistory.length })}</summary>
          <ul className="mt-2 space-y-1">
            {x.agreementHistory.map((h) => (
              <li key={h.version}>
                {tr("versionVersionReplacedVoidedAtVoidReason", { version: h.version, voidedAt: formatDate(h.voidedAt, true), voidReason: h.voidReason ?? tr("changed"), count: h.signatures.length })}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

export function HoursCard({ x, children }: { x: ExperienceDetail; children?: React.ReactNode }) {
  const tr = useCareerT("experiencesShared");
  const s = x.hoursSummary;
  return (
    <Card title={tr("hours")}>
      <p className="mb-3 text-sm">
        {tr("approvedOfRequiredRequiredHours", { approved: s.approved, required: s.required })}{s.pending ? tr("pendingWaitingForTheSupervisor", { pending: s.pending }) : ""}.
      </p>
      {children}
      {x.hours.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr("noHoursLoggedYet")}</p>
      ) : (
        <table className="w-full text-start text-sm [&_th]:text-start">
          <caption className="sr-only">{tr("weeklyHours")}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-1">{tr("weekOf")}</th>
              <th scope="col">{tr("hours")}</th>
              <th scope="col">{tr("whatYouWorkedOn")}</th>
              <th scope="col">{tr("status")}</th>
            </tr>
          </thead>
          <tbody>
            {x.hours.map((h) => (
              <tr key={h.id} className="border-b border-border/60 align-top">
                <td className="py-1">{formatDate(h.weekStart)}</td>
                <td>{h.hours}</td>
                <td>{h.description ?? "—"}</td>
                <td>
                  <Badge tone={h.status === "Approved" ? "good" : h.status === "Rejected" ? "bad" : "warn"}>{h.status === "Rejected" ? tr("returned") : h.status}</Badge>
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
  const tr = useCareerT("experiencesShared");
  return (
    <Card title={tr("supervisorEvaluations")}>
      {x.evaluations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr("noEvaluationsYetTheSite")}</p>
      ) : (
        <div className="space-y-4">
          {x.evaluations.map((v) => (
            <section key={v.id} aria-label={tr("kindEvaluation", { kind: v.kind })}>
              <h3 className="text-sm font-semibold">
                {tr("kindEvaluationSubmittedByNameSubmittedAt", { kind: v.kind, submittedByName: v.submittedByName, submittedAt: formatDate(v.submittedAt) })}
              </h3>
              <dl className="mt-1 space-y-1 text-sm">
                {v.questions.map((q) => (
                  <div key={q.key}>
                    <dt className="text-muted-foreground">{q.text}</dt>
                    <dd>{q.type === "rating" ? tr("answersOutOfRatingScaleMax", { answers: v.answers[q.key] ?? "—", ratingScaleMax: v.ratingScaleMax }) : (v.answers[q.key] ?? "—")}</dd>
                  </div>
                ))}
              </dl>
              {v.comments && <p className="mt-1 text-sm">{tr("commentsComments", { comments: v.comments })}</p>}
            </section>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{tr("evaluationsArePartOfThe")}</p>
    </Card>
  );
}

export function TimelineCard({ x }: { x: ExperienceDetail }) {
  const tr = useCareerT("experiencesShared");
  const ACTION_LABELS = useActionLabels();
  return (
    <Card title={tr("activityAndComments")}>
      <ol className="space-y-2 text-sm">
        {x.timeline.map((t, i) => (
          <li key={i}>
            {tr.rich("atActionByActorName", { span: (chunks) => <span className="text-xs text-muted-foreground">{chunks}</span>, at: formatDate(t.at, true), strong: (chunks) => <strong>{chunks}</strong>, action: ACTION_LABELS[t.action] ?? t.action, actorName: t.actorName })}
            {t.actorRole !== "System" ? ` (${t.actorRole.toLowerCase()})` : ""}
            {t.comment && <span className="block whitespace-pre-wrap ps-4">{t.comment}</span>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function DocumentsList({ x, onDownload }: { x: ExperienceDetail; onDownload: (id: string, name: string) => void }) {
  const tr = useCareerT("experiencesShared");
  return (
    <div className="text-sm">
      {x.program.requiredDocuments.length > 0 && <p>{tr("requiredRequiredDocuments", { requiredDocuments: x.program.requiredDocuments.join(", ") })}{x.missingDocuments.length > 0 ? tr("missingMissingDocuments", { missingDocuments: x.missingDocuments.join(", ") }) : tr("allUploaded")}</p>}
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
export async function downloadWith(api: Api, path: string, fileName: string, failedMessage: string) {
  const res = await api<Response>(path, { raw: true });
  if (!res.ok) throw new Error(failedMessage);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function CommentBox({ label, onSubmit, submitLabel, required = true }: { label: string; onSubmit: (text: string) => Promise<void>; submitLabel?: string; required?: boolean }) {
  const tr = useCareerT("experiencesShared");
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
        {submitLabel ?? tr("addComment")}
      </Button>
    </form>
  );
}

export function ApproveDecline({ canApprove, onApprove, onDecline }: { canApprove: boolean; onApprove: (c: string) => Promise<void>; onDecline: (c: string) => Promise<void> }) {
  const tr = useCareerT("experiencesShared");
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
      <Field label={tr("comment")} hint={tr("requiredWhenDecliningShownTo")}>{(p) => <textarea {...p} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />}</Field>
      <div className="flex gap-2">
        <Button busy={busy === "a"} disabled={!canApprove} onClick={() => run("a", onApprove)}>
          {tr("approve")}
        </Button>
        <Button variant="danger" busy={busy === "d"} disabled={!comment.trim()} onClick={() => run("d", onDecline)}>
          {tr("decline")}
        </Button>
      </div>
    </div>
  );
}
