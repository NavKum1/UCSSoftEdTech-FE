"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, ScrollArea, useCareerT, useCareerLabels } from "@/components/career/ui";
import {
  AgreementCard,
  CommentBox,
  DocumentsList,
  EvaluationsCard,
  HoursCard,
  OverviewCard,
  StatusBadge,
  Stepper,
  ApproveDecline,
  TimelineCard,
  downloadWith,
  type ExperienceDetail,
} from "@/components/career/experiences/shared";
import { DefenseReviewPanel } from "@/components/career/experiences/InternshipDefense";
import { PackExperienceCard } from "@/components/career/experiences/InternshipPack";

const LINK_LABELS_KEYS = ["Agreement", "Hours", "MidtermEvaluation", "FinalEvaluation"];
/** link labels in the career language (G1) */
function useLinkLabels(): Record<string, string> {
  return useCareerLabels("careerCenterExperiencesDetail.linkPurpose", LINK_LABELS_KEYS);
}

export default function CareerCenterExperienceDetailPage() {
  const t = useCareerT("careerCenterExperiencesDetail");
  const LINK_LABELS = useLinkLabels();
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const detail = useLoad(() => api<ExperienceDetail>(`/api/career/experiences/staff/experiences/${id}`), [api, id, schoolId]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const base = `/api/career/experiences/staff/experiences/${id}`;

  const act = async (fn: () => Promise<unknown>, success: string, reload = false) => {
    setErr(null);
    setMsg(null);
    try {
      const r = await fn();
      if (reload) detail.reload();
      else detail.setData(r as ExperienceDetail);
      setMsg(success);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const x = detail.data;
  if (detail.loading && !x) return <Loading />;
  if (!x) return <ErrorBanner error={detail.error} onRetry={detail.reload} />;
  const open = !["Draft", "Submitted", "Declined", "Withdrawn", "Completed"].includes(x.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nameRoleTitleAtName2", { name: x.student.name, roleTitle: x.roleTitle, name2: x.employer.name })}
        description={
          <>
            <Link href="/career-center/experiences" className="underline">
              {t("allExperiences")}
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

      {x.status === "Submitted" && (
        <Card title={t("careerCenterReview")}>
          <ul className="mb-4 space-y-1 text-sm">
            <li>{t("facultyApproval")}{" "}{x.approvals.facultyApprovedAt ? t("approvedFacultyApprovedAt", { facultyApprovedAt: formatDate(x.approvals.facultyApprovedAt, true) }) : t("waiting")}</li>
            <li>{t("requiredDocuments")}{" "}{x.missingDocuments.length ? t("missingMissingDocuments", { missingDocuments: x.missingDocuments.join(", ") }) : t("complete")}</li>
            {x.cpt.required && <li>{t("f1CPT")}{" "}{x.cpt.missing ? t("datesStillNeeded") : t("recorded")}</li>}
          </ul>
          <ApproveDecline
            canApprove={!!x.approvals.facultyApprovedAt && !x.cpt.missing && x.missingDocuments.length === 0}
            onApprove={(comment) => act(() => api(`${base}/approve`, { json: { comment } }), t("approvedTheLearningAgreementWas"))}
            onDecline={(comment) => act(() => api(`${base}/decline`, { json: { comment } }), t("declined"))}
          />
        </Card>
      )}

      <OverviewCard x={x} />

      {x.cpt.isF1 && !["Completed", "Declined", "Withdrawn"].includes(x.status) && (
        <CptCard x={x} onSave={(body) => act(() => api(`${base}/cpt`, { method: "PUT", json: body }), t("cPTDetailsSaved"))} />
      )}

      <Card title={t("documents")}>
        <DocumentsList x={x} onDownload={(docId, name) => downloadWith(api, `/api/career/experiences/documents/${docId}`, name, t("downloadFailed")).catch((e) => setErr(e.message))} />
      </Card>

      <AgreementCard x={x} showAudit />

      <PackExperienceCard api={api} scope="staff" experienceId={id} onChanged={detail.reload} />

      {open && (
        <Card title={t("siteSupervisorLinks")}>
          <p className="mb-3 text-sm text-muted-foreground">
            {t("supervisorsDontHaveAccountsEach")}
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(LINK_LABELS).map(([purpose, label]) => (
              <Button key={purpose} variant="secondary" onClick={() => act(() => api(`${base}/supervisor-link`, { json: { purpose } }), t("sentLabelLinkToEmail", { label, email: x.supervisor.email }), true)}>
                {t("sendLabel", { label })}
              </Button>
            ))}
          </div>
          {x.supervisorLinks && x.supervisorLinks.length > 0 && (
            <ScrollArea>
              <table className="w-full text-start text-sm [&_th]:text-start">
                <caption className="sr-only">{t("linksSent")}</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-1">{t("purpose")}</th>
                    <th scope="col">{t("sent")}</th>
                    <th scope="col">{t("expires")}</th>
                    <th scope="col">{t("lastOpened")}</th>
                    <th scope="col">{t("state")}</th>
                  </tr>
                </thead>
                <tbody>
                  {x.supervisorLinks.map((l, i) => (
                    <tr key={i} className="border-b border-border/60">
                      <td className="py-1">{LINK_LABELS[l.purpose] ?? l.purpose}</td>
                      <td>{formatDate(l.issuedAt, true)}</td>
                      <td>{formatDate(l.expiresAt)}</td>
                      <td>{l.lastUsedAt ? formatDate(l.lastUsedAt, true) : "—"}</td>
                      <td>
                        <Badge tone={l.state === "Active" ? "good" : "neutral"}>{l.state}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
          {x.status === "Active" && (
            <Button className="mt-4" onClick={() => act(() => api(`${base}/start-evaluations`, { method: "POST" }), t("finalEvaluationsOpenedTheSupervisor"))}>
              {t("openFinalEvaluationsNow")}
            </Button>
          )}
        </Card>
      )}

      {x.hours.length > 0 && <HoursCard x={x} />}
      {x.reflections.length > 0 && (
        <Card title={t("reflections")}>
          {x.reflections.map((r) => (
            <section key={r.id} className="mb-4 text-sm">
              <h3 className="font-semibold">{r.prompt}</h3>
              <p className="whitespace-pre-wrap">{r.body}</p>
              {r.facultyComment && <p className="mt-1 text-muted-foreground">{t("facultyFacultyComment", { facultyComment: r.facultyComment })}</p>}
            </section>
          ))}
        </Card>
      )}
      {x.evaluations.length > 0 && <EvaluationsCard x={x} />}
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
      {["Evaluations", "Completed"].includes(x.status) && <DefenseReviewPanel experienceId={id} scope="staff" />}
      <TimelineCard x={x} />
    </div>
  );
}

const CPT_STATUSES = ["NotStarted", "Requested", "Authorized", "Denied"];

function CptCard({ x, onSave }: { x: ExperienceDetail; onSave: (body: unknown) => Promise<void> }) {
  const t = useCareerT("careerCenterExperiencesDetail");
  const tShared = useCareerT("experiencesShared");
  const CPT_STATUS = useCareerLabels("careerCenterExperiencesDetail.cptStatus", CPT_STATUSES);
  const [status, setStatus] = useState(x.cpt.status ?? "");
  const [dso, setDso] = useState(x.cpt.dsoApprovalDate ?? "");
  const [start, setStart] = useState(x.cpt.startDate ?? "");
  const [end, setEnd] = useState(x.cpt.endDate ?? "");
  return (
    <Card title={t("recordCPTF1")}>
      <p className="mb-3 text-xs text-muted-foreground">{t("cptNoticeRecordWhatThe", { notice: tShared("cptNotice") })}</p>
      <form
        className="grid gap-3 sm:grid-cols-5 sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ status: status || undefined, dsoApprovalDate: dso || undefined, startDate: start || undefined, endDate: end || undefined });
        }}
      >
        <Field label={t("status")}>
          {(p) => (
            <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t("notRecorded")}</option>
              {CPT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CPT_STATUS[s]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("dSOApprovalDate")}>{(p) => <input {...p} type="date" value={dso} onChange={(e) => setDso(e.target.value)} />}</Field>
        <Field label={t("i20CPTStart")}>{(p) => <input {...p} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
        <Field label={t("i20CPTEnd")}>{(p) => <input {...p} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
        <Button type="submit" variant="secondary">
          {t("saveCPT")}
        </Button>
      </form>
    </Card>
  );
}
