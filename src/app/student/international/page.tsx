"use client";

/** D3: OPT / STEM OPT tracker for F-1 students, plus employer sponsorship-history lookup. Not legal advice. */

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad } from "@/components/career/ui";
import { DsoCard, NotLegalAdvice, type NotEligibleView, type OptEmployment, type OptView } from "@/components/career/international/shared";
import { AuthorizationsTable, ChecksList, DeadlinesTable, EmploymentsTable, SpansAndRules, UnemploymentMeter } from "@/components/career/international/OptOverview";
import SponsorLookup from "@/components/career/international/SponsorLookup";

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
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBanner error={error} onRetry={reload} />;

  const header = (
    <PageHeader
      title="International students"
      description="Track your OPT unemployment days and reporting deadlines, and look up employers' past sponsorship filings."
    />
  );

  if (!data.eligible) {
    return (
      <div>
        {header}
        <NotLegalAdvice text={data.disclaimer} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="OPT tracker">
            <p className="text-sm">{data.explanation}</p>
            <p className="mt-3 text-sm">
              <Link href="/student/record" className="underline">
                Open My record
              </Link>
            </p>
          </Card>
          <Card title="Your international student office">
            <DsoCard dso={data.dso} />
          </Card>
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
      "Program end date saved.",
    ).then((ok) => ok && setProgramEnd(null));
  };

  const addAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.eadStart || !auth.eadEnd) {
      setErr("Enter both EAD dates from your card.");
      return;
    }
    void run(() => api<View>("/api/career/international/opt/authorizations", { json: auth }), "Authorization added.").then(
      (ok) => ok && setAuth({ optType: "PostCompletion", eadStart: "", eadEnd: "" }),
    );
  };

  const saveJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;
    const hours = Number(job.hoursPerWeek);
    if (!job.employerName.trim() || !job.startDate || !Number.isFinite(hours) || hours <= 0) {
      setErr("Employer, start date and hours per week are required.");
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
    void run(send, editingJob ? "Job updated." : "Job added.").then((ok) => {
      if (ok) {
        setJob(null);
        setEditingJob(null);
      }
    });
  };

  const markReported = (id: string, kind: "start" | "end", on: string | null) =>
    run(() => api<View>(`/api/career/international/opt/employments/${id}/reported`, { method: "PUT", json: { kind, reportedOn: on } }), on ? "Marked as reported." : "Report mark removed.");

  const markEvaluation = (authId: string, month: number, on: string | null) =>
    run(() => api<View>(`/api/career/international/opt/authorizations/${authId}/evaluations/${month}`, { method: "PUT", json: { submittedOn: on } }), on ? "Self-evaluation marked submitted." : "Mark removed.");

  return (
    <div>
      {header}
      <NotLegalAdvice text={view.disclaimer}>
        This tracker helps you keep count. It doesn&apos;t report anything to SEVIS or USCIS: you still report changes as your DSO instructs.
      </NotLegalAdvice>
      <ErrorBanner error={err ?? error} />
      <SuccessBanner message={msg} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Unemployment days" className="lg:col-span-2">
          <div aria-live="polite">
            <UnemploymentMeter view={view} />
          </div>
        </Card>
        <Card title="Your DSO">
          <DsoCard dso={view.dso} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Things to check">
          <ChecksList checks={view.checks} />
        </Card>
        <Card title="Program end date">
          <form onSubmit={saveProgramEnd} className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1">
              <Field label="Program end date" hint="From your I-20.">
                {(p) => <input {...p} type="date" value={programEndValue} onChange={(e) => setProgramEnd(e.target.value)} />}
              </Field>
            </div>
            <Button type="submit" busy={busy} className="mb-5">
              Save
            </Button>
          </form>
        </Card>
      </div>

      <Card title="OPT authorization (EAD card)" className="mt-6">
        <AuthorizationsTable
          items={view.authorizations}
          actions={(a) => (
            <div className="flex flex-col items-end gap-1">
              {a.evaluations?.map((ev) =>
                ev.submittedOn ? (
                  <Button key={ev.month} variant="ghost" disabled={busy} onClick={() => markEvaluation(a.id, ev.month, null)}>
                    Undo {ev.month}-month
                  </Button>
                ) : (
                  <Button key={ev.month} variant="secondary" disabled={busy} onClick={() => markEvaluation(a.id, ev.month, todayIso())}>
                    {ev.month}-month submitted
                  </Button>
                ),
              )}
              <Button
                variant="ghost"
                disabled={busy}
                aria-label={`Remove ${a.label} period`}
                onClick={() => {
                  if (window.confirm(`Remove this ${a.label} period?`)) void run(() => api<View>(`/api/career/international/opt/authorizations/${a.id}`, { method: "DELETE" }), "Authorization removed.");
                }}
              >
                Remove
              </Button>
            </div>
          )}
        />
        <form onSubmit={addAuth} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-4 sm:items-end">
          <Field label="OPT type">
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
          <Field label="EAD start (valid from)">
            {(p) => <input {...p} type="date" value={auth.eadStart} onChange={(e) => setAuth({ ...auth, eadStart: e.target.value })} required />}
          </Field>
          <Field label="EAD end (card expires)">
            {(p) => <input {...p} type="date" value={auth.eadEnd} onChange={(e) => setAuth({ ...auth, eadEnd: e.target.value })} required />}
          </Field>
          <Button type="submit" busy={busy}>
            Add period
          </Button>
        </form>
      </Card>

      <Card
        title="Employment"
        className="mt-6"
        actions={
          !job ? (
            <Button
              onClick={() => {
                setEditingJob(null);
                setJob({ ...emptyJob, eVerifyEmployer: view.status.hasStem });
              }}
            >
              Add a job
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
                Edit
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                aria-label={`Remove job at ${j.employerName}`}
                onClick={() => {
                  if (window.confirm(`Remove the job at ${j.employerName}?`)) void run(() => api<View>(`/api/career/international/opt/employments/${j.id}`, { method: "DELETE" }), "Job removed.");
                }}
              >
                Remove
              </Button>
            </div>
          )}
        />
        {job && (
          <form onSubmit={saveJob} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <h3 className="text-sm font-semibold sm:col-span-2">{editingJob ? "Edit job" : "Add a job"}</h3>
            <Field label="Employer">
              {(p) => <input {...p} value={job.employerName} onChange={(e) => setJob({ ...job, employerName: e.target.value })} maxLength={200} required />}
            </Field>
            <Field label="Job title (optional)">
              {(p) => <input {...p} value={job.jobTitle} onChange={(e) => setJob({ ...job, jobTitle: e.target.value })} maxLength={200} />}
            </Field>
            <Field label="Start date">
              {(p) => <input {...p} type="date" value={job.startDate} onChange={(e) => setJob({ ...job, startDate: e.target.value })} required />}
            </Field>
            <Field label="End date" hint="Leave empty if you still work there.">
              {(p) => <input {...p} type="date" value={job.endDate} onChange={(e) => setJob({ ...job, endDate: e.target.value })} />}
            </Field>
            <Field label="Hours per week" hint={`At least ${view.rules.minHoursPerWeek} hours a week counts as employment for post-completion and STEM OPT.`}>
              {(p) => <input {...p} type="number" min={1} max={80} step={0.5} value={job.hoursPerWeek} onChange={(e) => setJob({ ...job, hoursPerWeek: e.target.value })} required />}
            </Field>
            <div className="space-y-2 pt-6">
              <Checkbox label="This work is directly related to my major" checked={job.relatedToMajor} onChange={(v) => setJob({ ...job, relatedToMajor: v })} />
              <Checkbox
                label="The employer uses E-Verify"
                hint="Required for employment during a STEM extension."
                checked={job.eVerifyEmployer}
                onChange={(v) => setJob({ ...job, eVerifyEmployer: v })}
              />
            </div>
            <div className="sm:col-span-2">
              <Field label="How the work relates to your major (optional)">
                {(p) => <textarea {...p} rows={3} value={job.relationExplanation} onChange={(e) => setJob({ ...job, relationExplanation: e.target.value })} maxLength={2000} />}
              </Field>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" busy={busy}>
                {editingJob ? "Save job" : "Add job"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setJob(null);
                  setEditingJob(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card title="Deadlines and reporting" className="mt-6">
        <DeadlinesTable
          deadlines={view.deadlines}
          actions={(d) => {
            if ((d.kind === "report-start" || d.kind === "report-end") && d.refId && d.status !== "upcoming") {
              const kind = d.kind === "report-start" ? "start" : "end";
              return d.status === "done" ? (
                <Button variant="ghost" disabled={busy} onClick={() => markReported(d.refId!, kind, null)}>
                  Undo
                </Button>
              ) : (
                <Button variant="secondary" disabled={busy} onClick={() => markReported(d.refId!, kind, todayIso())}>
                  I reported this
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
        <SponsorLookup />
      </div>
    </div>
  );
}
