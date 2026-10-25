"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad, useCareerT } from "@/components/career/ui";
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
import { PackExperienceCard } from "@/components/career/experiences/InternshipPack";

const WORD_GRADES = ["Pass", "Fail", "Credit", "Incomplete"];
const GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F", "Pass", "Fail", "Credit", "NoCredit", "Incomplete"];

export default function FacultyExperienceDetailPage() {
  const t = useCareerT("facultyExperiencesDetail");
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
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    }
  };

  const x = detail.data;
  if (detail.loading && !x) return <Loading />;
  if (!x) return <ErrorBanner error={detail.error} onRetry={detail.reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nameRoleTitleAtName2", { name: x.student.name, roleTitle: x.roleTitle, name2: x.employer.name })}
        description={
          <>
            <Link href="/faculty/experiences" className="underline">
              {t("allInternships")}
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
        <Card title={t("facultyApproval")}>
          <p className="mb-3 text-sm">{t("approveIfThisExperienceFits")}</p>
          <ApproveDecline
            canApprove
            onApprove={(comment) => act(() => api(`${base}/approve`, { json: { comment } }), t("approvedTheCareerCenterReviews"))}
            onDecline={(comment) => act(() => api(`${base}/decline`, { json: { comment } }), t("declined"))}
          />
        </Card>
      )}

      <OverviewCard x={x} />
      <Card title={t("documents")}>
        <DocumentsList x={x} onDownload={(docId, name) => downloadWith(api, `/api/career/experiences/documents/${docId}`, name, t("downloadFailed")).catch((e) => setErr(e.message))} />
      </Card>
      <AgreementCard x={x} onSign={(typedName, sha256) => act(() => api(`${base}/sign`, { json: { typedName, sha256, consent: true } }), t("youSignedTheLearningAgreement"))} />
      {x.hours.length > 0 && <HoursCard x={x} />}
      <PackExperienceCard api={api} scope="faculty" experienceId={id} onChanged={detail.reload} />
      {x.reflections.length > 0 && (
        <Card title={t("reflections")}>
          {x.reflections.map((r) => (
            <section key={r.id} className="mb-6 text-sm">
              <h3 className="font-semibold">{r.prompt}</h3>
              <p className="mb-2 whitespace-pre-wrap">{r.body}</p>
              {r.facultyComment && <p className="mb-2 text-muted-foreground">{t("yourCommentFacultyComment", { facultyComment: r.facultyComment })}</p>}
              <CommentBox
                label={t("commentOnPrompt", { prompt: r.prompt })}
                submitLabel={t("saveComment")}
                onSubmit={(c) => act(() => api(`${base}/reflections/${r.id}/comment`, { json: { comment: c } }), t("commentSaved"))}
              />
            </section>
          ))}
        </Card>
      )}
      <EvaluationsCard x={x} />
      {x.status === "Evaluations" && <GradeCard x={x} onGrade={(body) => act(() => api(`${base}/grade`, { json: body }), t("gradeRecordedTheExperienceIs"))} />}
      {x.grade.finalGrade && (
        <Card title={t("gradeRecommendation")}>
          <p className="text-sm">
            <strong>{x.grade.finalGrade}</strong> {x.grade.gradeComment}
          </p>
        </Card>
      )}
      <Card title={t("commentToTheStudent")}>
        <CommentBox label={t("comment")} onSubmit={(c) => act(() => api(`${base}/comments`, { json: { comment: c } }), t("commentAdded"))} />
      </Card>
      {["Evaluations", "Completed"].includes(x.status) && <DefenseReviewPanel experienceId={id} scope="faculty" />}
      <TimelineCard x={x} />
    </div>
  );
}

function GradeCard({ x, onGrade }: { x: ExperienceDetail; onGrade: (body: unknown) => Promise<void> }) {
  const t = useCareerT("facultyExperiencesDetail");
  const [grade, setGrade] = useState("");
  const [comment, setComment] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const short = x.hoursSummary.approved < x.hoursSummary.required;
  const hasFinal = x.evaluations.some((v) => v.kind === "Final");
  return (
    <Card title={t("finalGradeRecommendation")}>
      {!hasFinal && <p className="mb-3 text-sm">{t("theSiteSupervisorsFinalEvaluation")}</p>}
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
        <Field label={t("grade")}>
          {(p) => (
            <select {...p} value={grade} onChange={(e) => setGrade(e.target.value)} required>
              <option value="">{t("choose")}</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g === "NoCredit" ? t("noCredit") : WORD_GRADES.includes(g) ? t(`gradeLabel.${g}`) : g}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("commentForTheStudent")}>{(p) => <textarea {...p} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />}</Field>
        {short && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>
              {t("onlyApprovedOfRequiredRequired", { approved: x.hoursSummary.approved, required: x.hoursSummary.required })}
            </span>
          </label>
        )}
        <Button type="submit" busy={busy} disabled={!hasFinal || !grade || (short && !ack)}>
          {t("recordGradeAndComplete")}
        </Button>
      </form>
    </Card>
  );
}
