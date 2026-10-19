"use client";

/**
 * H1 employer: India verification (GSTIN + company email domain), campus job postings and a new-job form.
 * A job is sent to chosen colleges as campus drives from its own page; each college approves its drive first.
 */

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { EmployerPicker, useEmployers } from "@/components/career/EmployerPicker";
import { inrFull, label } from "@/components/career/placements/shared";
import { HireConnection } from "@/components/career/campus/HireConnection";
import { DOC_KIND_KEYS, JOB_TYPE_KEYS, localToIso, toList, toNum, useDocKindLabels, useJobStatusLabels, useJobTypeLabels, type CampusJob } from "@/components/career/campus/shared";

interface Verification {
  verified: boolean;
  basis: string;
  status: string;
  gstin?: string | null;
  gstinValid: boolean;
  gstinState?: string | null;
  emailDomainVerified: boolean;
  problems: string[];
}

interface JobList {
  verification: Verification;
  items: { job: CampusJob; colleges: number; approved: number; pending: number }[];
}

const emptyJob = {
  title: "", jobType: "FullTime", description: "", locations: "", ctcText: "", stipendMonthly: "", ctcNotes: "", degrees: "", branches: "", batches: "",
  minCgpa: "", maxActiveBacklogs: "", minClass10Percent: "", minClass12Percent: "", rounds: "", requiredDocuments: ["Resume"] as string[], applicationMode: "Apply",
  applyDeadline: "", visibility: "Targeted", premiumVisibility: false,
};

export default function EmployerJobsPage() {
  const t = useCareerT("employerJobs");
  const emp = useEmployers();
  const employerId = emp.current?.employer.id;
  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={emp.accounts.length > 1 ? <EmployerPicker accounts={emp.accounts} current={emp.current} onSelect={emp.select} /> : undefined}
      />
      {emp.loading ? (
        <Loading />
      ) : !employerId ? (
        <EmptyState title={t("noEmployer")}>{t.rich("createProfileFirst", { link: (c) => <Link className="underline" href="/employer/company">{c}</Link> })}</EmptyState>
      ) : (
        <Jobs employerId={employerId} />
      )}
    </div>
  );
}

function Jobs({ employerId }: { employerId: string }) {
  const t = useCareerT("employerJobs");
  const STATUS = useJobStatusLabels();
  const TYPE = useJobTypeLabels();
  const KIND = useDocKindLabels();
  const api = useApi();
  const list = useLoad(() => api<JobList>(`/api/career/campus/employer/${employerId}/jobs`), [api, employerId]);
  const [gstin, setGstin] = useState("");
  const [job, setJob] = useState(emptyJob);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const verify = () =>
    act("verify", async () => {
      const v = await api<Verification>(`/api/career/campus/employer/${employerId}/verification`, { method: "PUT", json: { gstin } });
      setMsg(v.verified ? t("verifiedNow") : t("verificationFailed"));
      list.reload();
    });

  const create = () =>
    act("create", async () => {
      await api(`/api/career/campus/employer/${employerId}/jobs`, {
        method: "POST",
        json: {
          title: job.title,
          jobType: job.jobType,
          description: job.description || undefined,
          locations: toList(job.locations),
          ctcText: job.ctcText || undefined,
          stipendMonthly: toNum(job.stipendMonthly),
          ctcNotes: job.ctcNotes || undefined,
          degrees: toList(job.degrees),
          branches: toList(job.branches),
          batches: toList(job.batches).map(Number).filter(Number.isFinite),
          minCgpa: toNum(job.minCgpa),
          maxActiveBacklogs: toNum(job.maxActiveBacklogs),
          minClass10Percent: toNum(job.minClass10Percent),
          minClass12Percent: toNum(job.minClass12Percent),
          rounds: toList(job.rounds),
          requiredDocuments: job.requiredDocuments,
          applicationMode: job.applicationMode,
          applyDeadline: localToIso(job.applyDeadline),
          visibility: job.visibility,
          premiumVisibility: job.premiumVisibility,
        },
      });
      setJob(emptyJob);
      setMsg(t("jobCreated"));
      list.reload();
    });

  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorBanner error={list.error} onRetry={list.reload} />;
  const v = list.data!.verification;
  const f = (k: keyof typeof emptyJob) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setJob({ ...job, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      {/* H2: the company's Hire account (jobs sync, applications, stage and offer updates) */}
      <HireConnection employerId={employerId} />
      <Card title={t("verificationTitle")}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={v.verified ? "good" : "warn"}>{v.verified ? t("verified") : t("notVerified")}</Badge>
          {v.gstin && <span>{t("gstinOnFile", { gstin: v.gstin, state: v.gstinState ?? "—" })}</span>}
        </div>
        {v.problems.length > 0 && (
          <ul className="mt-2 list-disc ps-5 text-sm text-red-700 dark:text-red-300">
            {v.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {!v.verified && (
          <>
            <p className="mt-3 text-sm text-muted-foreground">{t("verificationHelp")}</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Field label={t("gstin")}>{(p) => <input {...p} value={gstin} maxLength={20} autoComplete="off" onChange={(e) => setGstin(e.target.value)} />}</Field>
              <Button busy={busy === "verify"} disabled={!gstin.trim()} onClick={verify}>
                {t("verify")}
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card title={t("jobsTitle")}>
        {list.data!.items.length === 0 ? (
          <EmptyState title={t("noJobs")} />
        ) : (
          <ul className="divide-y divide-border">
            {list.data!.items.map(({ job: j, colleges, approved, pending }) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <Link href={`/employer/jobs/${j.id}`} className="font-medium underline">
                    {j.title}
                  </Link>
                  <div className="text-sm text-muted-foreground">
                    {label(TYPE, j.jobType)} · {j.jobType === "Internship" ? t("stipendLine", { amount: inrFull(j.stipendMonthly) }) : inrFull(j.ctcAnnual)} ·{" "}
                    {t("deadline", { date: formatDate(j.applyDeadline) })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={j.status === "Published" ? "good" : "neutral"}>{label(STATUS, j.status)}</Badge>
                  <span>{t("collegeCounts", { colleges, approved, pending })}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t("newJob")}>
        {!v.verified && <p className="mb-3 text-sm text-muted-foreground">{t("verifyBeforePosting")}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("jobTitle")}>{(p) => <input {...p} value={job.title} onChange={f("title")} />}</Field>
          <Field label={t("jobType")}>
            {(p) => (
              <select {...p} value={job.jobType} onChange={f("jobType")}>
                {JOB_TYPE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {label(TYPE, k)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("ctc")} hint={t("ctcHint")}>{(p) => <input {...p} value={job.ctcText} onChange={f("ctcText")} />}</Field>
          <Field label={t("stipend")}>{(p) => <input {...p} inputMode="numeric" value={job.stipendMonthly} onChange={f("stipendMonthly")} />}</Field>
          <Field label={t("ctcNotes")}>{(p) => <input {...p} value={job.ctcNotes} onChange={f("ctcNotes")} />}</Field>
          <Field label={t("locations")} hint={t("commaHint")}>{(p) => <input {...p} value={job.locations} onChange={f("locations")} />}</Field>
          <Field label={t("degrees")} hint={t("commaHint")}>{(p) => <input {...p} value={job.degrees} onChange={f("degrees")} />}</Field>
          <Field label={t("branches")} hint={t("commaHint")}>{(p) => <input {...p} value={job.branches} onChange={f("branches")} />}</Field>
          <Field label={t("batches")} hint={t("batchesHint")}>{(p) => <input {...p} value={job.batches} onChange={f("batches")} />}</Field>
          <Field label={t("minCgpa")}>{(p) => <input {...p} inputMode="decimal" value={job.minCgpa} onChange={f("minCgpa")} />}</Field>
          <Field label={t("maxBacklogs")}>{(p) => <input {...p} inputMode="numeric" value={job.maxActiveBacklogs} onChange={f("maxActiveBacklogs")} />}</Field>
          <Field label={t("min10")}>{(p) => <input {...p} inputMode="decimal" value={job.minClass10Percent} onChange={f("minClass10Percent")} />}</Field>
          <Field label={t("min12")}>{(p) => <input {...p} inputMode="decimal" value={job.minClass12Percent} onChange={f("minClass12Percent")} />}</Field>
          <Field label={t("rounds")} hint={t("roundsHint")}>{(p) => <input {...p} value={job.rounds} onChange={f("rounds")} />}</Field>
          <Field label={t("applyDeadline")}>{(p) => <input {...p} type="datetime-local" value={job.applyDeadline} onChange={f("applyDeadline")} />}</Field>
          <Field label={t("visibility")}>
            {(p) => (
              <select {...p} value={job.visibility} onChange={f("visibility")}>
                <option value="Targeted">{t("visibilityTargeted")}</option>
                <option value="Open">{t("visibilityOpen")}</option>
              </select>
            )}
          </Field>
          <Field label={t("applicationMode")}>
            {(p) => (
              <select {...p} value={job.applicationMode} onChange={f("applicationMode")}>
                <option value="Apply">{t("modeApply")}</option>
                <option value="OptIn">{t("modeOptIn")}</option>
              </select>
            )}
          </Field>
        </div>
        <Field label={t("jobDescription")}>{(p) => <textarea {...p} rows={4} value={job.description} onChange={f("description")} />}</Field>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium">{t("requiredDocuments")}</legend>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {DOC_KIND_KEYS.map((k) => (
              <label key={k} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={job.requiredDocuments.includes(k)}
                  onChange={(e) => setJob({ ...job, requiredDocuments: e.target.checked ? [...job.requiredDocuments, k] : job.requiredDocuments.filter((x) => x !== k) })}
                />
                {label(KIND, k)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={job.premiumVisibility} onChange={(e) => setJob({ ...job, premiumVisibility: e.target.checked })} />
          {t("premiumVisibility")}
        </label>
        <Button className="mt-4" busy={busy === "create"} disabled={!v.verified || !job.title.trim()} onClick={create}>
          {t("saveDraft")}
        </Button>
      </Card>
    </div>
  );
}
