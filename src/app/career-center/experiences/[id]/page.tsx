"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import {
  AgreementCard,
  CPT_NOTICE,
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

const LINK_LABELS: Record<string, string> = {
  Agreement: "Confirm and sign the agreement",
  Hours: "Approve hours",
  MidtermEvaluation: "Midterm evaluation",
  FinalEvaluation: "Final evaluation",
};

export default function CareerCenterExperienceDetailPage() {
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
        title={`${x.student.name}: ${x.roleTitle} at ${x.employer.name}`}
        description={
          <>
            <Link href="/career-center/experiences" className="underline">
              All experiences
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
        <Card title="Career-center review">
          <ul className="mb-4 space-y-1 text-sm">
            <li>Faculty approval: {x.approvals.facultyApprovedAt ? `approved ${formatDate(x.approvals.facultyApprovedAt, true)}` : "waiting"}</li>
            <li>Required documents: {x.missingDocuments.length ? `missing ${x.missingDocuments.join(", ")}` : "complete"}</li>
            {x.cpt.required && <li>F-1 CPT: {x.cpt.missing ? "dates still needed" : "recorded"}</li>}
          </ul>
          <ApproveDecline
            canApprove={!!x.approvals.facultyApprovedAt && !x.cpt.missing && x.missingDocuments.length === 0}
            onApprove={(comment) => act(() => api(`${base}/approve`, { json: { comment } }), "Approved. The learning agreement was generated and sent for signatures.")}
            onDecline={(comment) => act(() => api(`${base}/decline`, { json: { comment } }), "Declined.")}
          />
        </Card>
      )}

      <OverviewCard x={x} />

      {x.cpt.isF1 && !["Completed", "Declined", "Withdrawn"].includes(x.status) && (
        <CptCard x={x} onSave={(body) => act(() => api(`${base}/cpt`, { method: "PUT", json: body }), "CPT details saved.")} />
      )}

      <Card title="Documents">
        <DocumentsList x={x} onDownload={(docId, name) => downloadWith(api, `/api/career/experiences/documents/${docId}`, name).catch((e) => setErr(e.message))} />
      </Card>

      <AgreementCard x={x} showAudit />

      {open && (
        <Card title="Site supervisor links">
          <p className="mb-3 text-sm text-muted-foreground">
            Supervisors don&apos;t have accounts. Each secure link does one job and expires in 30 days; sending a new link replaces the previous one for that job.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(LINK_LABELS).map(([purpose, label]) => (
              <Button key={purpose} variant="secondary" onClick={() => act(() => api(`${base}/supervisor-link`, { json: { purpose } }), `Sent “${label}” link to ${x.supervisor.email}.`, true)}>
                Send: {label}
              </Button>
            ))}
          </div>
          {x.supervisorLinks && x.supervisorLinks.length > 0 && (
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Links sent</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-1">Purpose</th>
                  <th scope="col">Sent</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Last opened</th>
                  <th scope="col">State</th>
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
          )}
          {x.status === "Active" && (
            <Button className="mt-4" onClick={() => act(() => api(`${base}/start-evaluations`, { method: "POST" }), "Final evaluations opened; the supervisor was emailed.")}>
              Open final evaluations now
            </Button>
          )}
        </Card>
      )}

      {x.hours.length > 0 && <HoursCard x={x} />}
      {x.reflections.length > 0 && (
        <Card title="Reflections">
          {x.reflections.map((r) => (
            <section key={r.id} className="mb-4 text-sm">
              <h3 className="font-semibold">{r.prompt}</h3>
              <p className="whitespace-pre-wrap">{r.body}</p>
              {r.facultyComment && <p className="mt-1 text-muted-foreground">Faculty: {r.facultyComment}</p>}
            </section>
          ))}
        </Card>
      )}
      {x.evaluations.length > 0 && <EvaluationsCard x={x} />}
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
      {["Evaluations", "Completed"].includes(x.status) && <DefenseReviewPanel experienceId={id} scope="staff" />}
      <TimelineCard x={x} />
    </div>
  );
}

function CptCard({ x, onSave }: { x: ExperienceDetail; onSave: (body: unknown) => Promise<void> }) {
  const [status, setStatus] = useState(x.cpt.status ?? "");
  const [dso, setDso] = useState(x.cpt.dsoApprovalDate ?? "");
  const [start, setStart] = useState(x.cpt.startDate ?? "");
  const [end, setEnd] = useState(x.cpt.endDate ?? "");
  return (
    <Card title="Record CPT (F-1)">
      <p className="mb-3 text-xs text-muted-foreground">{CPT_NOTICE} Record what the international student office authorized on the I-20.</p>
      <form
        className="grid gap-3 sm:grid-cols-5 sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ status: status || undefined, dsoApprovalDate: dso || undefined, startDate: start || undefined, endDate: end || undefined });
        }}
      >
        <Field label="Status">
          {(p) => (
            <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Not recorded</option>
              {["NotStarted", "Requested", "Authorized", "Denied"].map((s) => (
                <option key={s} value={s}>
                  {s.replace(/([a-z])([A-Z])/g, "$1 $2")}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="DSO approval date">{(p) => <input {...p} type="date" value={dso} onChange={(e) => setDso(e.target.value)} />}</Field>
        <Field label="I-20 CPT start">{(p) => <input {...p} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
        <Field label="I-20 CPT end">{(p) => <input {...p} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
        <Button type="submit" variant="secondary">
          Save CPT
        </Button>
      </form>
    </Card>
  );
}
