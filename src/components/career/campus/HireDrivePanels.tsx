"use client";

/**
 * H2: the Hire side of one job and one drive. HireJobLink (employer job page) links a campus job to one of the company's
 * Hire jobs, so applications to its drives can go to Hire. HireDriveStatus (employer and placement-office drive pages)
 * shows each applicant's Hire stage and the last push, and lets the employer send the consented applicants now.
 */

import React, { useState } from "react";
import { Badge, Button, Card, ErrorBanner, Field, Loading, ScrollArea, SuccessBanner, formatDate, useCareerT, useLoad } from "@/components/career/ui";
import { useRunner } from "@/components/career/placements/useRunner";
import { label } from "@/components/career/placements/shared";
import { APP_TONE, useAppStatusLabels, type Applicant, type CampusJob } from "@/components/career/campus/shared";
import { useHireSyncLabels } from "@/components/career/campus/HireConnection";

interface HireJobs {
  items: { id: string; title: string; status: string; location?: string | null; campusJob?: { id: string } | null }[];
}

export function HireJobLink({ employerId, job, onChanged }: { employerId: string; job: CampusJob; onChanged: () => void }) {
  const t = useCareerT("campusHire");
  const { api, busy, err, msg, setMsg, run } = useRunner();
  const [choice, setChoice] = useState("");
  const [jobs, setJobs] = useState<HireJobs | null>(null);
  const fromHire = job.source === "Hire";
  const linked = job.externalSource === "hire" && job.externalJobId;

  const load = () => run("load", async () => setJobs(await api<HireJobs>(`/api/career/campus/employer/${employerId}/hire/jobs`)));
  const link = (hireJobId: string | null) =>
    run("link", async () => {
      await api(`/api/career/campus/employer/${employerId}/jobs/${job.id}/hire-link`, { method: "PUT", json: { hireJobId } });
      setMsg(hireJobId ? t("linked") : t("unlinked"));
      onChanged();
    });

  return (
    <Card title={t("jobTitle")}>
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      {linked ? (
        <div className="space-y-2 text-sm">
          <p>
            {fromHire ? t("fromHire") : t("linkedTo")} <code dir="ltr" className="text-xs">{job.externalJobId}</code> {job.externalStatus && <Badge>{job.externalStatus}</Badge>}
          </p>
          {fromHire && job.status === "Draft" && <p className="text-muted-foreground">{t("fromHireDraft")}</p>}
          {!fromHire && (
            <Button variant="ghost" busy={busy === "link"} onClick={() => link(null)}>
              {t("unlink")}
            </Button>
          )}
        </div>
      ) : jobs ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("hireJob")}>
            {(p) => (
              <select {...p} value={choice} onChange={(e) => setChoice(e.target.value)}>
                <option value="">{t("chooseHireJob")}</option>
                {jobs.items.filter((j) => !j.campusJob).map((j) => (
                  <option key={j.id} value={j.id}>{`${j.title} (${j.status})`}</option>
                ))}
              </select>
            )}
          </Field>
          <Button busy={busy === "link"} disabled={!choice} onClick={() => link(choice)}>
            {t("link")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">{t("notLinked")}</p>
          <Button variant="secondary" busy={busy === "load"} onClick={load}>
            {t("chooseHireJob")}
          </Button>
        </div>
      )}
    </Card>
  );
}

interface DriveHire {
  connected: boolean;
  jobLinked: boolean;
  hireJobId?: string | null;
  applications: { applicationId: string; status: string; hireApplicationId?: string | null; hireStageCategory?: string | null; hireStageName?: string | null; hireSyncedAt?: string | null; lastSync?: { kind: string; status: string; errorCode?: string | null } | null }[];
}

const th = "py-2 pe-3 font-medium";
const td = "py-2 pe-3 align-top";

export function HireDriveStatus({ base, mode, applicants }: { base: string; mode: "employer" | "staff"; applicants: Applicant[] }) {
  const t = useCareerT("campusHire");
  const STATUS = useAppStatusLabels();
  const SYNC = useHireSyncLabels();
  const { api, busy, err, msg, setMsg, run } = useRunner();
  const view = useLoad(() => api<DriveHire>(`${base}/hire`), [api, base]);
  if (view.loading && !view.data) return <Loading />;
  if (!view.data) return <ErrorBanner error={view.error} onRetry={view.reload} />;
  const v = view.data;
  if (!v.jobLinked) return null;
  const nameOf = (id: string) => applicants.find((a) => a.id === id)?.student?.name;

  return (
    <Card
      title={t("driveTitle")}
      actions={
        mode === "employer" && v.connected ? (
          <Button
            variant="secondary"
            busy={busy === "push"}
            onClick={() => run("push", async () => { const r = await api<{ queued: number }>(`${base}/hire/push`, { method: "POST" }); setMsg(t("pushed", { count: r.queued })); view.reload(); })}
          >
            {t("push")}
          </Button>
        ) : undefined
      }
    >
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      {!v.connected && <p className="text-sm text-muted-foreground">{t("driveNotConnected")}</p>}
      <ScrollArea label={t("driveTable")}>
        <table className="w-full text-sm">
          <caption className="sr-only">{t("driveTable")}</caption>
          <thead>
            <tr className="border-b border-border [&_th]:text-start">
              <th scope="col" className={th}>{t("colApplicant")}</th>
              <th scope="col" className={th}>{t("colStatus")}</th>
              <th scope="col" className={th}>{t("colHireStage")}</th>
              <th scope="col" className={th}>{t("colLastSync")}</th>
            </tr>
          </thead>
          <tbody>
            {v.applications.map((a) => (
              <tr key={a.applicationId} className="border-b border-border last:border-0">
                <th scope="row" className={`${td} text-start font-normal`}>
                  {nameOf(a.applicationId) ? <bdi>{nameOf(a.applicationId)}</bdi> : <span className="text-muted-foreground">{t("notShown")}</span>}
                </th>
                <td className={td}>
                  <Badge tone={APP_TONE[a.status] ?? "neutral"}>{label(STATUS, a.status)}</Badge>
                </td>
                <td className={td}>{a.hireApplicationId ? <span>{a.hireStageName ?? a.hireStageCategory ?? "—"}</span> : <span className="text-muted-foreground">{t("notInHire")}</span>}</td>
                <td className={td}>
                  {a.lastSync ? (
                    <>
                      <Badge tone={a.lastSync.status === "Failed" ? "bad" : a.lastSync.status === "Done" ? "good" : "info"}>{label(SYNC, a.lastSync.status)}</Badge>{" "}
                      {a.lastSync.errorCode && <code dir="ltr" className="text-xs">{a.lastSync.errorCode}</code>}
                    </>
                  ) : (
                    "—"
                  )}
                  {a.hireSyncedAt && <div className="text-xs text-muted-foreground">{formatDate(a.hireSyncedAt, true)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </Card>
  );
}
