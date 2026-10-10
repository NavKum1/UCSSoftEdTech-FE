"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad } from "@/components/career/ui";
import {
  AgreementCard,
  ApproveDecline,
  CommentBox,
  DocumentsList,
  EvaluationsCard,
  HoursCard,
  OverviewCard,
  StatusBadge,
  Stepper,
  TimelineCard,
  downloadWith,
  type ExperienceDetail,
} from "@/components/career/experiences/shared";
import { DefenseReviewPanel } from "@/components/career/experiences/InternshipDefense";

const GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F", "Pass", "Fail", "Credit", "NoCredit", "Incomplete"];

export default function FacultyExperienceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const detail = useLoad(() => api<ExperienceDetail>(`/api/career/experiences/faculty/experiences/${id}`), [api, id, schoolId]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const base = `/api/career/experiences/faculty/experiences/${id}`;

  const act = async (fn: () => Promise<ExperienceDetail>, success: string) => {
    setErr(null);
    setMsg(null);
    try {
      detail.setData(await fn());
      setMsg(success);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const x = detail.data;
  if (detail.loading && !x) return <Loading />;
  if (!x) return <ErrorBanner error={detail.error} onRetry={detail.reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${x.student.name}: ${x.roleTitle} at ${x.employer.name}`}
        description={
          <>
            <Link href="/faculty/experiences" className="underline">
              All internships
            </Link>{" "}
            · <StatusBadge status={x.status} />
          </>
        }
      />
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      <Stepper status={x.status} />

      {x.status === "Submitted" && !x.approvals.facultyApprovedAt && (
        <Card title="Faculty approval">
          <p className="mb-3 text-sm">Approve if this experience fits the program&apos;s academic goals. The career center reviews it next.</p>
          <ApproveDecline
            canApprove
            onApprove={(comment) => act(() => api(`${base}/approve`, { json: { comment } }), "Approved. The career center reviews it next.")}
            onDecline={(comment) => act(() => api(`${base}/decline`, { json: { comment } }), "Declined.")}
          />
        </Card>
      )}

      <OverviewCard x={x} />
      <Card title="Documents">
        <DocumentsList x={x} onDownload={(docId, name) => downloadWith(api, `/api/career/experiences/documents/${docId}`, name).catch((e) => setErr(e.message))} />
      </Card>
      <AgreementCard x={x} onSign={(typedName, sha256) => act(() => api(`${base}/sign`, { json: { typedName, sha256, consent: true } }), "You signed the learning agreement.")} />
      {x.hours.length > 0 && <HoursCard x={x} />}
      {x.reflections.length > 0 && (
        <Card title="Reflections">
          {x.reflections.map((r) => (
            <section key={r.id} className="mb-6 text-sm">
              <h3 className="font-semibold">{r.prompt}</h3>
              <p className="mb-2 whitespace-pre-wrap">{r.body}</p>
              {r.facultyComment && <p className="mb-2 text-muted-foreground">Your comment: {r.facultyComment}</p>}
              <CommentBox
                label={`Comment on “${r.prompt}”`}
                submitLabel="Save comment"
                onSubmit={(c) => act(() => api(`${base}/reflections/${r.id}/comment`, { json: { comment: c } }), "Comment saved.")}
              />
            </section>
          ))}
        </Card>
      )}
      <EvaluationsCard x={x} />
      {x.status === "Evaluations" && <GradeCard x={x} onGrade={(body) => act(() => api(`${base}/grade`, { json: body }), "Grade recorded; the experience is complete.")} />}
      {x.grade.finalGrade && (
        <Card title="Grade recommendation">
          <p className="text-sm">
            <strong>{x.grade.finalGrade}</strong> {x.grade.gradeComment}
          </p>
        </Card>
      )}
      <Card title="Comment to the student">
        <CommentBox label="Comment" onSubmit={(c) => act(() => api(`${base}/comments`, { json: { comment: c } }), "Comment added.")} />
      </Card>
      {["Evaluations", "Completed"].includes(x.status) && <DefenseReviewPanel experienceId={id} scope="faculty" />}
      <TimelineCard x={x} />
    </div>
  );
}

function GradeCard({ x, onGrade }: { x: ExperienceDetail; onGrade: (body: unknown) => Promise<void> }) {
  const [grade, setGrade] = useState("");
  const [comment, setComment] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const short = x.hoursSummary.approved < x.hoursSummary.required;
  const hasFinal = x.evaluations.some((v) => v.kind === "Final");
  return (
    <Card title="Final grade recommendation">
      {!hasFinal && <p className="mb-3 text-sm">The site supervisor&apos;s final evaluation hasn&apos;t arrived yet.</p>}
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onGrade({ grade, comment, acknowledgeHoursShortfall: ack });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Grade">
          {(p) => (
            <select {...p} value={grade} onChange={(e) => setGrade(e.target.value)} required>
              <option value="">Choose</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g === "NoCredit" ? "No credit" : g}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Comment for the student">{(p) => <textarea {...p} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />}</Field>
        {short && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>
              Only {x.hoursSummary.approved} of {x.hoursSummary.required} required hours are approved. I want to record the grade anyway.
            </span>
          </label>
        )}
        <Button type="submit" busy={busy} disabled={!hasFinal || !grade || (short && !ack)}>
          Record grade and complete
        </Button>
      </form>
    </Card>
  );
}
