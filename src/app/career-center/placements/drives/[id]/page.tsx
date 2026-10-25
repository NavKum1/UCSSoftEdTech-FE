"use client";

/**
 * H1 placement office: one campus drive. Approve (optionally editing the eligibility first) or reject it, open or close
 * applications, then run the selection: applicants, rounds, shortlists, slots and offers (policy overrides are audited).
 */

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { label } from "@/components/career/placements/shared";
import { DriveWorkspace } from "@/components/career/campus/DriveWorkspace";
import { HireDriveStatus } from "@/components/career/campus/HireDrivePanels";
import { APPROVAL_TONE, TIER_KEYS, localToIso, toList, toNum, useApprovalLabels, useTierLabels, type Applicant, type CampusDrive, type CampusJob, type CampusRound } from "@/components/career/campus/shared";

interface StaffDrive {
  drive: CampusDrive;
  job?: CampusJob | null;
  employer?: { name: string; website?: string | null; campusVerified: boolean; verificationBasis: string; gstinValid: boolean; gstinState?: string | null; emailDomainVerified: boolean } | null;
  rounds: CampusRound[];
  applicants: Applicant[];
  canDecide: boolean;
}

export default function StaffDrivePage() {
  const t = useCareerT("careerCenterDrive");
  const APPROVAL = useApprovalLabels();
  const TIER = useTierLabels();
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const base = `/api/career/campus/staff/drives/${id}`;
  const view = useLoad(() => api<StaffDrive>(base), [api, base]);
  const [note, setNote] = useState("");
  const [crit, setCrit] = useState<{ minCgpa: string; maxActiveBacklogs: string; branches: string; batches: string } | null>(null);
  const [deadline, setDeadline] = useState("");
  const [tier, setTier] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (view.loading && !view.data) return <Loading />;
  if (view.error) return <ErrorBanner error={view.error} onRetry={view.reload} />;
  const { drive: d, job, employer, canDecide } = view.data!;
  const c = crit ?? {
    minCgpa: d.criteria.minCgpa != null ? String(d.criteria.minCgpa) : "",
    maxActiveBacklogs: d.criteria.maxActiveBacklogs != null ? String(d.criteria.maxActiveBacklogs) : "",
    branches: d.criteria.branches.join(", "),
    batches: d.criteria.batches.join(", "),
  };
  const eligibility = () => ({
    minCgpa: toNum(c.minCgpa),
    maxActiveBacklogs: toNum(c.maxActiveBacklogs),
    branches: toList(c.branches),
    batches: toList(c.batches).map(Number).filter(Number.isFinite),
    clear: [...(c.minCgpa.trim() ? [] : ["minCgpa"]), ...(c.maxActiveBacklogs.trim() ? [] : ["maxActiveBacklogs"])],
  });
  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(done);
      setCrit(null);
      view.reload();
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={`${d.companyName}: ${d.title}`}
        description={t("description")}
        actions={
          <Link className="text-sm underline" href="/career-center/placements/drives">
            {t("backToQueue")}
          </Link>
        }
      />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <div className="space-y-6">
        <Card title={t("summary")}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={APPROVAL_TONE[d.approvalStatus] ?? "neutral"}>{label(APPROVAL, d.approvalStatus)}</Badge>
            <span>{d.ctcDisplay ?? "—"}</span>
            <span>· {label(TIER, d.tier)}</span>
            <span>· {t("deadline", { date: formatDate(d.applyDeadline, true) })}</span>
            <span>· {d.applicationsOpen ? t("open") : t("closed")}</span>
          </div>
          {employer && (
            <p className="mt-2 text-sm">
              {t("employerLine", {
                name: employer.name,
                verified: employer.campusVerified ? t("verified") : t("notVerified"),
                state: employer.gstinState ?? "—",
              })}
            </p>
          )}
          {job?.description && <p className="mt-2 whitespace-pre-line text-sm">{job.description}</p>}
        </Card>

        <Card title={t("eligibilityTitle")}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("minCgpa")}>{(p) => <input {...p} inputMode="decimal" disabled={!canDecide} value={c.minCgpa} onChange={(e) => setCrit({ ...c, minCgpa: e.target.value })} />}</Field>
            <Field label={t("maxBacklogs")}>{(p) => <input {...p} inputMode="numeric" disabled={!canDecide} value={c.maxActiveBacklogs} onChange={(e) => setCrit({ ...c, maxActiveBacklogs: e.target.value })} />}</Field>
            <Field label={t("branches")}>{(p) => <input {...p} disabled={!canDecide} value={c.branches} onChange={(e) => setCrit({ ...c, branches: e.target.value })} />}</Field>
            <Field label={t("batches")}>{(p) => <input {...p} disabled={!canDecide} value={c.batches} onChange={(e) => setCrit({ ...c, batches: e.target.value })} />}</Field>
          </div>
          {canDecide && d.approvalStatus === "Approved" && (
            <Button className="mt-3" variant="secondary" busy={busy === "elig"} onClick={() => act("elig", () => api(`${base}/eligibility`, { method: "PUT", json: eligibility() }), t("eligibilitySaved"))}>
              {t("saveEligibility")}
            </Button>
          )}
        </Card>

        {canDecide && d.approvalStatus === "Pending" && (
          <Card title={t("decisionTitle")}>
            <Field label={t("note")} hint={t("noteHint")}>{(p) => <textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button busy={busy === "approve"} onClick={() => act("approve", () => api(`${base}/decision`, { method: "POST", json: { decision: "Approve", note: note || undefined, eligibility: crit ? eligibility() : undefined } }), t("approved"))}>
                {t("approve")}
              </Button>
              <Button variant="danger" busy={busy === "reject"} onClick={() => act("reject", () => api(`${base}/decision`, { method: "POST", json: { decision: "Reject", note } }), t("rejected"))}>
                {t("reject")}
              </Button>
            </div>
          </Card>
        )}

        {canDecide && d.approvalStatus === "Approved" && (
          <Card title={t("publishingTitle")}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("newDeadline")}>{(p) => <input {...p} type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />}</Field>
              <Field label={t("tierOverride")}>
                {(p) => (
                  <select {...p} value={tier} onChange={(e) => setTier(e.target.value)}>
                    <option value="">{t("tierAuto")}</option>
                    {TIER_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {label(TIER, k)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                busy={busy === "pub"}
                onClick={() =>
                  act(
                    "pub",
                    () => api(`${base}/publishing`, { method: "PUT", json: { applyDeadline: localToIso(deadline), tierOverride: tier || undefined, clearTierOverride: !tier } }),
                    t("publishingSaved"),
                  )
                }
              >
                {t("saveChanges")}
              </Button>
              <Button
                busy={busy === "toggle"}
                onClick={() => act("toggle", () => api(`${base}/publishing`, { method: "PUT", json: { applicationsOpen: !d.applicationsOpen } }), d.applicationsOpen ? t("closedNow") : t("openedNow"))}
              >
                {d.applicationsOpen ? t("closeApplications") : t("openApplications")}
              </Button>
            </div>
          </Card>
        )}

        <DriveWorkspace base={base} mode="staff" rounds={view.data!.rounds} applicants={view.data!.applicants} onChanged={view.reload} />
        <HireDriveStatus base={base} mode="staff" applicants={view.data!.applicants} />
      </div>
    </div>
  );
}
