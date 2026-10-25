"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad, useCareerT } from "@/components/career/ui";
import {
  AgreementCard,
  DocumentsList,
  EvaluationsCard,
  HoursCard,
  OverviewCard,
  StatusBadge,
  Stepper,
  TimelineCard,
  downloadWith,
  type ExperienceDetail,
  type Program,
} from "@/components/career/experiences/shared";
import { DefenseSummaryCard } from "@/components/career/experiences/InternshipDefense";
import { RegistrationForm, toPayload, valuesFrom } from "@/components/career/experiences/RegistrationForm";
import { PackExperienceCard, type PackView } from "@/components/career/experiences/InternshipPack";

export default function StudentExperienceDetailPage() {
  const t = useCareerT("studentExperiencesDetail");
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const detail = useLoad(() => api<ExperienceDetail>(`/api/career/experiences/mine/${id}`), [api, id, schoolId]);
  const programs = useLoad(() => api<{ programs: Program[]; isF1: boolean; cptStatuses: string[] }>("/api/career/experiences/programs"), [api, schoolId]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // G2: with a country pack, hours are logged through the pack logbook instead of the plain weekly form
  const [packActive, setPackActive] = useState(false);
  const onPackLoaded = useCallback((v: PackView) => setPackActive(!!v.pack), []);

  const x = detail.data;
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

  if (detail.loading && !x) return <Loading />;
  if (!x) return <ErrorBanner error={detail.error} onRetry={detail.reload} />;
  const working = ["AgreementSigned", "Active", "Evaluations"].includes(x.status);
  const signed = x.agreement?.signatures.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("roleTitleAtName", { roleTitle: x.roleTitle, name: x.employer.name })}
        description={
          <>
            <Link href="/student/experiences" className="underline">
              {t("allExperiences")}
            </Link>{" "}
            · <StatusBadge status={x.status} />
          </>
        }
        actions={
          <>
            {x.canEdit && !editing && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                {t("editDetails")}
              </Button>
            )}
            {x.status === "Draft" && <Button onClick={() => act(() => api(`/api/career/experiences/mine/${id}/submit`, { method: "POST" }), t("submittedForFacultyApproval"))}>{t("submitForApproval")}</Button>}
            {!["Completed", "Declined", "Withdrawn"].includes(x.status) && (
              <Button
                variant="danger"
                onClick={() => {
                  const reason = window.prompt(t("whyAreYouWithdrawingOptional"));
                  if (reason !== null) act(() => api(`/api/career/experiences/mine/${id}/withdraw`, { json: { reason } }), t("withdrawn"));
                }}
              >
                {t("withdraw")}
              </Button>
            )}
          </>
        }
      />
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      <Stepper status={x.status} />

      {editing && programs.data && (
        <Card title={t("editDetails")}>
          {signed > 0 && <p className="mb-3 text-sm font-medium">{t("changingDetailsThatAppearIn")}</p>}
          <RegistrationForm
            api={api}
            programs={programs.data.programs}
            isF1={programs.data.isF1 || x.cpt.isF1}
            cptStatuses={programs.data.cptStatuses}
            initial={{ ...valuesFrom(x), employerId: "" }}
            lockProgram={x.status !== "Draft"}
            submitLabel={t("saveChanges")}
            onSubmit={async (v) => {
              await act(() => api(`/api/career/experiences/mine/${id}`, { method: "PUT", json: toPayload(v, programs.data!.isF1 || x.cpt.isF1) }), t("saved"));
              setEditing(false);
            }}
          />
          <Button variant="ghost" className="mt-2" onClick={() => setEditing(false)}>
            {t("cancel")}
          </Button>
        </Card>
      )}

      <OverviewCard x={x} />

      <Card title={t("documents")}>
        <DocumentsList x={x} onDownload={(docId, name) => downloadWith(api, `/api/career/experiences/documents/${docId}`, name, t("downloadFailed")).catch((e) => setErr(e.message))} />
        {!["Completed", "Declined", "Withdrawn"].includes(x.status) && <UploadForm program={x.program} onUpload={(fd) => act(() => api(`/api/career/experiences/mine/${id}/documents`, { method: "POST", body: fd }), t("documentUploaded"))} />}
      </Card>

      <AgreementCard
        x={x}
        onSign={(typedName, sha256) => act(() => api(`/api/career/experiences/mine/${id}/sign`, { json: { typedName, sha256, consent: true } }), t("youSignedTheLearningAgreement"))}
      />

      {(working || x.hours.length > 0) && (
        <HoursCard x={x}>{working && !packActive && <HoursForm onSave={(body) => act(() => api(`/api/career/experiences/mine/${id}/hours`, { json: body }), t("hoursSentToYourSupervisor"))} />}</HoursCard>
      )}

      {x.status !== "Draft" && <PackExperienceCard api={api} scope="mine" experienceId={id} onLoaded={onPackLoaded} onChanged={detail.reload} />}

      {(working || x.reflections.length > 0) && (
        <Card title={t("reflections")}>
          {x.program.reflectionPrompts.map((prompt) => {
            const existing = x.reflections.find((r) => r.prompt === prompt);
            return <ReflectionForm key={prompt} prompt={prompt} existing={existing} editable={working} onSave={(body) => act(() => api(`/api/career/experiences/mine/${id}/reflections`, { json: { prompt, body } }), t("reflectionSaved"))} />;
          })}
        </Card>
      )}

      {x.evaluations.length > 0 && <EvaluationsCard x={x} />}
      {x.grade.finalGrade && (
        <Card title={t("gradeRecommendation")}>
          <p className="text-sm">
            <strong>{x.grade.finalGrade}</strong>
            {x.grade.gradeComment ? `: ${x.grade.gradeComment}` : ""}
          </p>
        </Card>
      )}
      {["Evaluations", "Completed"].includes(x.status) && <DefenseSummaryCard experienceId={id} />}
      <TimelineCard x={x} />
    </div>
  );
}

function UploadForm({ program, onUpload }: { program: Program; onUpload: (fd: FormData) => Promise<void> }) {
  const t = useCareerT("studentExperiencesDetail");
  const [kind, setKind] = useState(program.requiredDocuments[0] ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        const fd = new FormData();
        fd.append("kind", kind);
        fd.append("file", file);
        setBusy(true);
        try {
          await onUpload(fd);
          setFile(null);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={t("documentType")}>
        {(p) => (
          <input {...p} list="exp-doc-kinds" value={kind} onChange={(e) => setKind(e.target.value)} required />
        )}
      </Field>
      <datalist id="exp-doc-kinds">
        {program.requiredDocuments.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      <Field label={t("file")} hint={t("pDFWordPNGJPEGOr")}>
        {(p) => <input {...p} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />}
      </Field>
      <Button type="submit" variant="secondary" busy={busy} disabled={!file}>
        {t("upload")}
      </Button>
    </form>
  );
}

function HoursForm({ onSave }: { onSave: (body: { weekStart: string; hours: number; description: string }) => Promise<void> }) {
  const t = useCareerT("studentExperiencesDetail");
  const [week, setWeek] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mb-4 grid gap-3 sm:grid-cols-4 sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave({ weekStart: week, hours: Number(hours), description });
          setHours("");
          setDescription("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={t("anyDayInTheWeek")}>{(p) => <input {...p} type="date" value={week} onChange={(e) => setWeek(e.target.value)} required />}</Field>
      <Field label={t("hoursWorked")}>{(p) => <input {...p} type="number" min={0.5} max={80} step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} required />}</Field>
      <Field label={t("whatYouWorkedOn")}>{(p) => <input {...p} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
      <Button type="submit" busy={busy}>
        {t("logHours")}
      </Button>
    </form>
  );
}

function ReflectionForm({ prompt, existing, editable, onSave }: { prompt: string; existing?: ExperienceDetail["reflections"][number]; editable: boolean; onSave: (body: string) => Promise<void> }) {
  const t = useCareerT("studentExperiencesDetail");
  const [body, setBody] = useState(existing?.body ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mb-6 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave(body);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={prompt}>{(p) => <textarea {...p} rows={5} value={body} onChange={(e) => setBody(e.target.value)} readOnly={!editable} required />}</Field>
      {existing?.facultyComment && <p className="text-sm">{t("facultyCommentFacultyComment", { facultyComment: existing.facultyComment })}</p>}
      {editable && (
        <Button type="submit" variant="secondary" busy={busy}>
          {existing ? t("updateReflection") : t("saveReflection")}
        </Button>
      )}
    </form>
  );
}
