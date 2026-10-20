"use client";

/**
 * H12 exam administration: the written exams the signed-in user manages (SuperAdmin: all, including the built-in ones;
 * InstituteAdmin: their institute's; a creator: their own), with the attempts policy, the question pool, attempt counts
 * and pass rate, and the queue of credentials flagged for review after their attempt was voided.
 */

import React, { useId, useState } from "react";
import Link from "next/link";
import { AccessNotice } from "@/lib/legacyApi";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, Modal, PageHeader, ScrollArea, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import {
  ADMIN_BASE,
  KindBadge,
  PoolHealthBadge,
  SCOPE_LABEL,
  attemptsLabel,
  minutesLabel,
  useExamAdminApi,
  type CredentialReview,
  type ExamRow,
} from "@/components/admin/exams/shared";

function ReviewDialog({ review, decision, onClose, onDone }: { review: CredentialReview; decision: "keep" | "revoke"; onClose: () => void; onDone: (msg: string) => void }) {
  const { call } = useExamAdminApi();
  const titleId = useId();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await call(`${ADMIN_BASE}/credential-reviews/${review.claimId}`, { method: "POST", json: { decision, note } });
      onDone(decision === "keep" ? `Kept certificate ${review.certificateNumber}.` : `Revoked certificate ${review.certificateNumber}.`);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal labelledBy={titleId} onClose={onClose}>
      <form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 id={titleId} className="text-lg font-semibold">
          {decision === "keep" ? "Keep this credential" : "Revoke this credential"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Certificate {review.certificateNumber} ({review.examTitle}). The attempt was voided: {review.reviewReason ?? "no reason recorded"}.
          {decision === "keep" ? " Keeping it clears the under-review notice on its public page." : " Revoking it marks the credential as revoked on its public page."}
        </p>
        <ErrorBanner error={err} />
        <Field label={decision === "keep" ? "Note (optional)" : "Note (required)"} hint="Kept in the audit log.">
          {(p) => <textarea {...p} rows={3} value={note} onChange={(e) => setNote(e.target.value)} required={decision === "revoke"} maxLength={500} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={decision === "revoke" ? "danger" : "primary"} busy={busy}>
            {decision === "keep" ? "Keep credential" : "Revoke credential"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ExamAdminListPage() {
  const { call, ready, access } = useExamAdminApi();
  const exams = useLoad(() => (ready ? call<ExamRow[]>(`${ADMIN_BASE}/exams`) : Promise.resolve(null)), [ready, call]);
  const reviews = useLoad(
    () => (ready ? call<{ reviews: CredentialReview[] }>(`${ADMIN_BASE}/credential-reviews`) : Promise.resolve(null)),
    [ready, call],
  );
  const [search, setSearch] = useState("");
  const [deciding, setDeciding] = useState<{ review: CredentialReview; decision: "keep" | "revoke" } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (access) return <AccessNotice problem={access} feature="exam administration" />;

  const term = search.trim().toLowerCase();
  const rows = (exams.data ?? []).filter((e) => !term || e.title.toLowerCase().includes(term) || e.stream.toLowerCase().includes(term) || e.id.toLowerCase().includes(term));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam administration"
        description="Attempts policy, question pools, per-student exceptions and statistics for the written exams you manage. Built-in exams can be changed by platform admins only."
      />
      <SuccessBanner message={message} />
      <ErrorBanner error={exams.error} onRetry={exams.reload} />

      {(reviews.data?.reviews.length ?? 0) > 0 && (
        <Card title={`Credentials waiting for a review (${reviews.data!.reviews.length})`}>
          <p className="mb-3 text-sm text-muted-foreground">
            These credentials were issued for an attempt that was voided later. They show as under review on their public page until someone decides.
          </p>
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">Credentials waiting for a review</caption>
              <thead>
                <tr className="border-b border-border text-start [&_th]:py-2 [&_th]:pe-3 [&_th]:text-start">
                  <th scope="col">Certificate</th>
                  <th scope="col">Exam</th>
                  <th scope="col">Student</th>
                  <th scope="col">Why the attempt was voided</th>
                  <th scope="col">Flagged</th>
                  <th scope="col">Decision</th>
                </tr>
              </thead>
              <tbody>
                {reviews.data!.reviews.map((r) => (
                  <tr key={r.claimId} className="border-b border-border align-top last:border-0 [&_td]:py-2 [&_td]:pe-3">
                    <td className="font-mono text-xs">{r.certificateNumber}</td>
                    <td>
                      <Link href={`/admin/exams/${encodeURIComponent(r.examId)}`} className="underline">
                        {r.examTitle}
                      </Link>
                    </td>
                    <td>{r.name ?? r.email ?? <span className="font-mono text-xs">{r.userId}</span>}</td>
                    <td>{r.reviewReason}</td>
                    <td>{formatDate(r.flaggedAt, true)}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => setDeciding({ review: r, decision: "keep" })} aria-label={`Keep certificate ${r.certificateNumber}`}>
                          Keep
                        </Button>
                        <Button variant="danger" onClick={() => setDeciding({ review: r, decision: "revoke" })} aria-label={`Revoke certificate ${r.certificateNumber}`}>
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </Card>
      )}

      <Card>
        <div className="mb-4 max-w-sm">
          <Field label="Find an exam" hint="Title, stream or id">
            {(p) => <input {...p} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}
          </Field>
        </div>
        {exams.loading || !ready ? (
          <Loading label="Loading exams" />
        ) : rows.length === 0 ? (
          <EmptyState title={term ? "No exam matches your search" : "You don't manage any exams yet"}>
            {!term && "Exams you create on the prep page, and your institute's exams if you are its admin, show up here."}
          </EmptyState>
        ) : (
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">Exams you manage</caption>
              <thead>
                <tr className="border-b border-border [&_th]:py-2 [&_th]:pe-3 [&_th]:text-start">
                  <th scope="col">Exam</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Attempts allowed</th>
                  <th scope="col">Questions</th>
                  <th scope="col">Attempts</th>
                  <th scope="col">Pass rate</th>
                  <th scope="col">Under review</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-b border-border align-top last:border-0 [&_td]:py-2 [&_td]:pe-3">
                    <td>
                      <Link href={`/admin/exams/${encodeURIComponent(e.id)}`} className="font-medium underline">
                        {e.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {e.stream} · {SCOPE_LABEL[e.scope] ?? e.scope}
                        {e.builtIn && " · built-in"}
                      </div>
                    </td>
                    <td>
                      <KindBadge issuesCredential={e.policy.issuesCredential} />
                    </td>
                    <td>
                      {attemptsLabel(e.policy.maxAttempts, e.policy.overrides.maxAttempts === null)}
                      <div className="text-xs text-muted-foreground">Cooldown: {minutesLabel(e.policy.cooldownMinutes)}</div>
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>
                          {e.policy.questionsPerAttempt} of {e.questions.approved} per attempt
                        </span>
                        <PoolHealthBadge health={e.poolHealth} />
                      </div>
                      {(e.questions.draft > 0 || e.questions.retired > 0) && (
                        <div className="text-xs text-muted-foreground">
                          {e.questions.draft} draft, {e.questions.retired} retired
                        </div>
                      )}
                    </td>
                    <td>
                      {e.attempts.total}
                      <div className="text-xs text-muted-foreground">
                        {e.attempts.students} student{e.attempts.students === 1 ? "" : "s"}
                        {e.attempts.voided > 0 && `, ${e.attempts.voided} voided`}
                      </div>
                    </td>
                    <td>{e.attempts.passRate === null ? "—" : `${e.attempts.passRate}%`}</td>
                    <td>{e.credentialsUnderReview > 0 ? <Badge tone="warn">{e.credentialsUnderReview}</Badge> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Card>

      {deciding && (
        <ReviewDialog
          review={deciding.review}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
          onDone={(msg) => {
            setDeciding(null);
            setMessage(msg);
            reviews.reload();
            exams.reload();
          }}
        />
      )}
    </div>
  );
}
