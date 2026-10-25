"use client";

/** D3: OPT / STEM OPT tracker for F-1 students, plus employer sponsorship-history lookup. Not legal advice. */

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad, useCareerT } from "@/components/career/ui";
import { DsoCard, NotLegalAdvice, type NotEligibleView, type OptEmployment, type OptView } from "@/components/career/international/shared";
import { AuthorizationsTable, ChecksList, DeadlinesTable, EmploymentsTable, SpansAndRules, UnemploymentMeter } from "@/components/career/international/OptOverview";
import SponsorLookup from "@/components/career/international/SponsorLookup";
import WorkRightsTracker from "@/components/career/international/WorkRights";
import NationalityCard from "@/components/career/localisation/NationalityCard";

type View = OptView | NotEligibleView;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface JobForm {
  employerName: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  hoursPerWeek: string;
  relatedToMajor: boolean;
  relationExplanation: string;
  eVerifyEmployer: boolean;
}

const emptyJob: JobForm = { employerName: "", jobTitle: "", startDate: "", endDate: "", hoursPerWeek: "40", relatedToMajor: true, relationExplanation: "", eVerifyEmployer: false };

const jobFrom = (j: OptEmployment): JobForm => ({
  employerName: j.employerName,
  jobTitle: j.jobTitle ?? "",
  startDate: j.startDate,
  endDate: j.endDate ?? "",
  hoursPerWeek: String(j.hoursPerWeek),
  relatedToMajor: j.relatedToMajor,
  relationExplanation: j.relationExplanation ?? "",
  eVerifyEmployer: j.eVerifyEmployer,
});

function Checkbox({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1 h-4 w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export default function StudentInternationalPage() {
  const tr = useCareerT("studentInternational");
  const api = useApi();
  const { schoolId } = useCareerShell();
  const { data, setData, error, loading, reload } = useLoad(() => api<View>("/api/career/international/opt"), [api, schoolId]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [programEnd, setProgramEnd] = useState<string | null>(null);
  const [auth, setAuth] = useState({ optType: "PostCompletion", eadStart: "", eadEnd: "" });
  const [job, setJob] = useState<JobForm | null>(null);
  const [editingJob, setEditingJob] = useState<string | null>(null);

  const run = async (fn: () => Promise<View>, success: string) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      setData(await fn());
      setMsg(success);
      return true;
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBanner error={error} onRetry={reload} />;

  const header = (
    <PageHeader
      title={tr("internationalStudents")}
      description={tr("trackYourOPTUnemploymentDays")}
    />
  );

  if (!data.eligible) {
    return (
      <div>
        {header}
        <NotLegalAdvice text={data.disclaimer} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={tr("oPTTracker")}>
            <p className="text-sm">{data.explanation}</p>
            <p className="mt-3 text-sm">
              <Link href="/student/record" className="underline">
                {tr("openMyRecord")}
              </Link>
            </p>
          </Card>
          <Card title={tr("yourInternationalStudentOffice")}>
            <DsoCard dso={data.dso} />
          </Card>
        </div>
        <div className="mt-6">
          <WorkRightsTracker />
        </div>
        <div className="mt-6">
          <NationalityCard />
        </div>
        <div className="mt-6">
          <SponsorLookup />
        </div>
      </div>
    );
  }

  const view = data;
  const programEndValue = programEnd ?? view.tracker?.programEndDate ?? "";

  const saveProgramEnd = (e: React.FormEvent) => {
    e.preventDefault();
    void run(
      () => api<View>("/api/career/international/opt", { method: "PUT", json: programEndValue ? { programEndDate: programEndValue } : { clearProgramEndDate: true } }),
      tr("programEndDateSaved"),
    ).then((ok) => ok && setProgramEnd(null));
  };

  const addAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.eadStart || !auth.eadEnd) {
      setErr(tr("enterBothEADDatesFrom"));
      return;
    }
    void run(() => api<View>("/api/career/international/opt/authorizations", { json: auth }), tr("authorizationAdded")).then(
      (ok) => ok && setAuth({ optType: "PostCompletion", eadStart: "", eadEnd: "" }),
    );
  };

  const saveJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;
    const hours = Number(job.hoursPerWeek);
    if (!job.employerName.trim() || !job.startDate || !Number.isFinite(hours) || hours <= 0) {
      setErr(tr("employerStartDateAndHours"));
      return;
    }
    const payload = {
      employerName: job.employerName,
      jobTitle: job.jobTitle,
      startDate: job.startDate,
      endDate: job.endDate || null,
      clearEndDate: !job.endDate,
      hoursPerWeek: hours,
      relatedToMajor: job.relatedToMajor,
      relationExplanation: job.relationExplanation,
      eVerifyEmployer: job.eVerifyEmployer,
    };
    const send = () =>
      editingJob
        ? api<View>(`/api/career/international/opt/employments/${editingJob}`, { method: "PUT", json: payload })
        : api<View>("/api/career/international/opt/employments", { json: payload });
    void run(send, editingJob ? tr("jobUpdated") : tr("jobAdded")).then((ok) => {
      if (ok) {
        setJob(null);
        setEditingJob(null);
      }
    });
  };

  const markReported = (id: string, kind: "start" | "end", on: string | null) =>
    run(() => api<View>(`/api/career/international/opt/employments/${id}/reported`, { method: "PUT", json: { kind, reportedOn: on } }), on ? tr("markedAsReported") : tr("reportMarkRemoved"));

  const markEvaluation = (authId: string, month: number, on: string | null) =>
    run(() => api<View>(`/api/career/international/opt/authorizations/${authId}/evaluations/${month}`, { method: "PUT", json: { submittedOn: on } }), on ? tr("selfEvaluationMarkedSubmitted") : tr("markRemoved"));

  return (
    <div>
      {header}
      <NotLegalAdvice text={view.disclaimer}>
        {tr("thisTrackerHelpsYouKeep")}
      </NotLegalAdvice>
      <ErrorBanner error={err ?? error} />
      <SuccessBanner message={msg} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={tr("unemploymentDays")} className="lg:col-span-2">
          <div aria-live="polite">
            <UnemploymentMeter view={view} />
          </div>
        </Card>
        <Card title={tr("yourDSO")}>
          <DsoCard dso={view.dso} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={tr("thingsToCheck")}>
          <ChecksList checks={view.checks} />
        </Card>
        <Card title={tr("programEndDate")}>
          <form onSubmit={saveProgramEnd} className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1">
              <Field label={tr("programEndDate")} hint={tr("fromYourI20")}>
                {(p) => <input {...p} type="date" value={programEndValue} onChange={(e) => setProgramEnd(e.target.value)} />}
              </Field>
            </div>
            <Button type="submit" busy={busy} className="mb-5">
              {tr("save")}
            </Button>
          </form>
        </Card>
      </div>

      <Card title={tr("oPTAuthorizationEADCard")} className="mt-6">
        <AuthorizationsTable
          items={view.authorizations}
          actions={(a) => (
            <div className="flex flex-col items-end gap-1">
              {a.evaluations?.map((ev) =>
                ev.submittedOn ? (
                  <Button key={ev.month} variant="ghost" disabled={busy} onClick={() => markEvaluation(a.id, ev.month, null)}>
                    {tr("undoMonthMonth", { month: ev.month })}
                  </Button>
                ) : (
                  <Button key={ev.month} variant="secondary" disabled={busy} onClick={() => markEvaluation(a.id, ev.month, todayIso())}>
                    {tr("monthMonthSubmitted", { month: ev.month })}
                  </Button>
                ),
              )}
              <Button
                variant="ghost"
                disabled={busy}
                aria-label={tr("removeLabelPeriod", { label: a.label })}
                onClick={() => {
                  if (window.confirm(tr("removeThisLabelPeriod", { label: a.label }))) void run(() => api<View>(`/api/career/international/opt/authorizations/${a.id}`, { method: "DELETE" }), tr("authorizationRemoved"));
                }}
              >
                {tr("remove")}
              </Button>
            </div>
          )}
        />
        <form onSubmit={addAuth} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-4 sm:items-end">
          <Field label={tr("oPTType")}>
            {(p) => (
              <select {...p} value={auth.optType} onChange={(e) => setAuth({ ...auth, optType: e.target.value })}>
                {view.optTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={tr("eADStartValidFrom")}>
            {(p) => <input {...p} type="date" value={auth.eadStart} onChange={(e) => setAuth({ ...auth, eadStart: e.target.value })} required />}
          </Field>
          <Field label={tr("eADEndCardExpires")}>
            {(p) => <input {...p} type="date" value={auth.eadEnd} onChange={(e) => setAuth({ ...auth, eadEnd: e.target.value })} required />}
          </Field>
          <Button type="submit" busy={busy}>
            {tr("addPeriod")}
          </Button>
        </form>
      </Card>

      <Card
        title={tr("employment")}
        className="mt-6"
        actions={
          !job ? (
            <Button
              onClick={() => {
                setEditingJob(null);
                setJob({ ...emptyJob, eVerifyEmployer: view.status.hasStem });
              }}
            >
              {tr("addAJob")}
            </Button>
          ) : undefined
        }
      >
        <EmploymentsTable
          items={view.employments}
          hasStem={view.status.hasStem}
          actions={(j) => (
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setEditingJob(j.id);
                  setJob(jobFrom(j));
                }}
              >
                {tr("edit")}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                aria-label={tr("removeJobAtEmployerName", { employerName: j.employerName })}
                onClick={() => {
                  if (window.confirm(tr("removeTheJobAtEmployerName", { employerName: j.employerName }))) void run(() => api<View>(`/api/career/international/opt/employments/${j.id}`, { method: "DELETE" }), tr("jobRemoved"));
                }}
              >
                {tr("remove")}
              </Button>
            </div>
          )}
        />
        {job && (
          <form onSubmit={saveJob} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <h3 className="text-sm font-semibold sm:col-span-2">{editingJob ? tr("editJob") : tr("addAJob")}</h3>
            <Field label={tr("employer")}>
              {(p) => <input {...p} value={job.employerName} onChange={(e) => setJob({ ...job, employerName: e.target.value })} maxLength={200} required />}
            </Field>
            <Field label={tr("jobTitleOptional")}>
              {(p) => <input {...p} value={job.jobTitle} onChange={(e) => setJob({ ...job, jobTitle: e.target.value })} maxLength={200} />}
            </Field>
            <Field label={tr("startDate")}>
              {(p) => <input {...p} type="date" value={job.startDate} onChange={(e) => setJob({ ...job, startDate: e.target.value })} required />}
            </Field>
            <Field label={tr("endDate")} hint={tr("leaveEmptyIfYouStill")}>
              {(p) => <input {...p} type="date" value={job.endDate} onChange={(e) => setJob({ ...job, endDate: e.target.value })} />}
            </Field>
            <Field label={tr("hoursPerWeek")} hint={tr("atLeastMinHoursPerWeekHoursA", { minHoursPerWeek: view.rules.minHoursPerWeek })}>
              {(p) => <input {...p} type="number" min={1} max={80} step={0.5} value={job.hoursPerWeek} onChange={(e) => setJob({ ...job, hoursPerWeek: e.target.value })} required />}
            </Field>
            <div className="space-y-2 pt-6">
              <Checkbox label={tr("thisWorkIsDirectlyRelated")} checked={job.relatedToMajor} onChange={(v) => setJob({ ...job, relatedToMajor: v })} />
              <Checkbox
                label={tr("theEmployerUsesEVerify")}
                hint={tr("requiredForEmploymentDuringA")}
                checked={job.eVerifyEmployer}
                onChange={(v) => setJob({ ...job, eVerifyEmployer: v })}
              />
            </div>
            <div className="sm:col-span-2">
              <Field label={tr("howTheWorkRelatesTo")}>
                {(p) => <textarea {...p} rows={3} value={job.relationExplanation} onChange={(e) => setJob({ ...job, relationExplanation: e.target.value })} maxLength={2000} />}
              </Field>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" busy={busy}>
                {editingJob ? tr("saveJob") : tr("addJob")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setJob(null);
                  setEditingJob(null);
                }}
              >
                {tr("cancel")}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card title={tr("deadlinesAndReporting")} className="mt-6">
        <DeadlinesTable
          deadlines={view.deadlines}
          actions={(d) => {
            if ((d.kind === "report-start" || d.kind === "report-end") && d.refId && d.status !== "upcoming") {
              const kind = d.kind === "report-start" ? "start" : "end";
              return d.status === "done" ? (
                <Button variant="ghost" disabled={busy} onClick={() => markReported(d.refId!, kind, null)}>
                  {tr("undo")}
                </Button>
              ) : (
                <Button variant="secondary" disabled={busy} onClick={() => markReported(d.refId!, kind, todayIso())}>
                  {tr("iReportedThis")}
                </Button>
              );
            }
            return null;
          }}
        />
      </Card>

      <div className="mt-6">
        <SpansAndRules view={view} />
      </div>

      <div className="mt-6">
        <WorkRightsTracker />
      </div>
      <div className="mt-6">
        <NationalityCard />
      </div>
      <div className="mt-6">
        <SponsorLookup />
      </div>
    </div>
  );
}
