"use client";

/** H1 employer: one job, its campus drives per college (approval status), publish / pause / close, and sending it to colleges. */

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { HireJobLink } from "@/components/career/campus/HireDrivePanels";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { useEmployers } from "@/components/career/EmployerPicker";
import { inrFull, label, usePlacementModeLabels, MODE_LABELS_KEYS } from "@/components/career/placements/shared";
import { APPROVAL_TONE, useApprovalLabels, useJobStatusLabels, useJobTypeLabels, useTierLabels, type CampusDrive, type CampusJob } from "@/components/career/campus/shared";

interface JobDetail {
  job: CampusJob;
  drives: { drive: CampusDrive; applications: number; postingFeeRequired: boolean; premiumVisibilityAvailable: boolean }[];
}

interface Relationship {
  instituteId: string;
  school?: string | null;
  status: string;
}

export default function EmployerJobPage() {
  const t = useCareerT("employerJobDetail");
  const { id } = useParams<{ id: string }>();
  const emp = useEmployers();
  const employerId = emp.current?.employer.id;
  if (emp.loading) return <Loading />;
  if (!employerId) return <EmptyState title={t("noEmployer")} />;
  return <Detail employerId={employerId} jobId={id} />;
}

function Detail({ employerId, jobId }: { employerId: string; jobId: string }) {
  const t = useCareerT("employerJobDetail");
  const STATUS = useJobStatusLabels();
  const TYPE = useJobTypeLabels();
  const APPROVAL = useApprovalLabels();
  const TIER = useTierLabels();
  const MODE = usePlacementModeLabels();
  const api = useApi();
  const base = `/api/career/campus/employer/${employerId}/jobs/${jobId}`;
  const detail = useLoad(() => api<JobDetail>(base), [api, base]);
  const schools = useLoad(() => api<Relationship[]>(`/api/career/employer/${employerId}/schools`), [api, employerId]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [driveDate, setDriveDate] = useState("");
  const [mode, setMode] = useState("OnCampus");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<void>, done: string) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(done);
      detail.reload();
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (detail.loading && !detail.data) return <Loading />;
  if (detail.error) return <ErrorBanner error={detail.error} onRetry={detail.reload} />;
  const { job, drives } = detail.data!;
  const sent = new Set(drives.filter((d) => d.drive.approvalStatus === "Pending" || d.drive.approvalStatus === "Approved").map((d) => d.drive.instituteId));
  const partners = (schools.data ?? []).filter((s) => s.status === "Approved" && !sent.has(s.instituteId));

  return (
    <div>
      <PageHeader
        title={job.title}
        description={`${label(TYPE, job.jobType)} · ${job.jobType === "Internship" ? inrFull(job.stipendMonthly) : inrFull(job.ctcAnnual)}`}
        actions={
          <>
            {(job.status === "Draft" || job.status === "Paused") && (
              <Button busy={busy === "publish"} onClick={() => act("publish", () => api(`${base}/publish`, { method: "POST" }), t("published"))}>
                {t("publish")}
              </Button>
            )}
            {job.status === "Published" && (
              <Button variant="secondary" busy={busy === "pause"} onClick={() => act("pause", () => api(`${base}/pause`, { method: "POST" }), t("paused"))}>
                {t("pause")}
              </Button>
            )}
            {job.status !== "Closed" && job.status !== "Cancelled" && (
              <Button variant="danger" busy={busy === "close"} onClick={() => act("close", () => api(`${base}/close`, { method: "POST" }), t("closed"))}>
                {t("close")}
              </Button>
            )}
          </>
        }
      />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <div className="space-y-6">
        <Card title={t("summary")}>
          <dl className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("status")}</dt>
              <dd>
                <Badge tone={job.status === "Published" ? "good" : "neutral"}>{label(STATUS, job.status)}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("visibility")}</dt>
              <dd>{job.visibility === "Open" ? t("visibilityOpen") : t("visibilityTargeted")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("deadline")}</dt>
              <dd>{formatDate(job.applyDeadline, true)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("locations")}</dt>
              <dd>{job.locations.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("criteria")}</dt>
              <dd>{t("criteriaLine", { branches: job.branches.join(", ") || t("any"), cgpa: job.minCgpa ?? "—", batches: job.batches.join(", ") || t("any") })}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("rounds")}</dt>
              <dd>{job.rounds.join(" → ") || "—"}</dd>
            </div>
          </dl>
        </Card>

        <HireJobLink employerId={employerId} job={job} onChanged={detail.reload} />

        <Card title={t("drivesTitle")}>
          {drives.length === 0 ? (
            <EmptyState title={t("noDrives")} />
          ) : (
            <ul className="divide-y divide-border">
              {drives.map(({ drive: d, applications, postingFeeRequired }) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <Link href={`/employer/drives/${d.id}`} className="font-medium underline">
                      {d.school ?? d.instituteId}
                    </Link>
                    <div className="text-sm text-muted-foreground">
                      {label(TIER, d.tier)} · {t("applicationsCount", { count: applications })}
                      {d.approvalNote ? ` · ${t("collegeNote", { note: d.approvalNote })}` : ""}
                    </div>
                    {postingFeeRequired && <p className="text-xs text-muted-foreground">{t("feeFlag")}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={APPROVAL_TONE[d.approvalStatus] ?? "neutral"}>{label(APPROVAL, d.approvalStatus)}</Badge>
                    {d.autoApproved && <Badge tone="info">{t("autoApproved")}</Badge>}
                    {(d.approvalStatus === "Pending" || d.approvalStatus === "Approved") && (
                      <Button
                        variant="ghost"
                        busy={busy === "w-" + d.id}
                        onClick={() => act("w-" + d.id, () => api(`/api/career/campus/employer/${employerId}/drives/${d.id}/withdraw`, { method: "POST" }), t("withdrawn"))}
                      >
                        {t("withdraw")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {job.status === "Published" && job.visibility === "Targeted" && (
          <Card title={t("sendTitle")}>
            {partners.length === 0 ? (
              <EmptyState title={t("noPartners")}>{t.rich("requestSchools", { link: (c) => <Link className="underline" href="/employer/schools">{c}</Link> })}</EmptyState>
            ) : (
              <>
                <fieldset>
                  <legend className="text-sm font-medium">{t("chooseColleges")}</legend>
                  <div className="mt-2 space-y-1 text-sm">
                    {partners.map((s) => (
                      <label key={s.instituteId} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={chosen.includes(s.instituteId)}
                          onChange={(e) => setChosen(e.target.checked ? [...chosen, s.instituteId] : chosen.filter((x) => x !== s.instituteId))}
                        />
                        {s.school ?? s.instituteId}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field label={t("driveDate")}>{(p) => <input {...p} type="date" value={driveDate} onChange={(e) => setDriveDate(e.target.value)} />}</Field>
                  <Field label={t("mode")}>
                    {(p) => (
                      <select {...p} value={mode} onChange={(e) => setMode(e.target.value)}>
                        {MODE_LABELS_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {label(MODE, k)}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>
                <Button
                  className="mt-3"
                  busy={busy === "send"}
                  disabled={chosen.length === 0}
                  onClick={() =>
                    act(
                      "send",
                      async () => {
                        await api(`${base}/drives`, { method: "POST", json: { instituteIds: chosen, driveDate: driveDate || undefined, mode } });
                        setChosen([]);
                      },
                      t("sent"),
                    )
                  }
                >
                  {t("send", { count: chosen.length })}
                </Button>
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
