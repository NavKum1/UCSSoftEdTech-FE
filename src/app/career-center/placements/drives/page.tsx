"use client";

/**
 * H1 placement office: the campus-drive approvals queue (employer drives wait here until approved or rejected), the
 * college's drive rules (auto-approval, placement policy, tiers by CTC, pricing flags) and drives the office creates itself.
 */

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { TabPanel, Tabs } from "@/components/career/appointments/shared";
import { inrShort, label } from "@/components/career/placements/shared";
import { APPROVAL_KEYS, APPROVAL_TONE, JOB_TYPE_KEYS, localToIso, toList, toNum, useApprovalLabels, useJobTypeLabels, useTierLabels, type CampusDrive, type CampusJob } from "@/components/career/campus/shared";

interface Settings {
  autoApproveVerifiedEmployers: boolean;
  acceptOpenJobs: boolean;
  allowIneligibleApplications: boolean;
  oneOfferPerStudent: boolean;
  dreamCtcMin?: number | null;
  superDreamCtcMin?: number | null;
  tiersOn: boolean;
  blockAfterAcceptance: boolean;
  pricing: { employerPostingFeeRequired: boolean; premiumVisibilityEnabled: boolean; charging: boolean; note: string };
}

interface Queue {
  items: { drive: CampusDrive; job?: CampusJob | null; employer?: { name: string; campusVerified: boolean; gstinValid: boolean; emailDomainVerified: boolean } | null; applications: number }[];
  counts: { pending: number; approved: number; rejected: number; withdrawn: number };
  settings: Settings;
  canDecide: boolean;
}

type Tab = "queue" | "settings" | "create";

export default function PlacementDrivesPage() {
  const t = useCareerT("careerCenterDrives");
  const [tab, setTab] = useState<Tab>("queue");
  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link className="text-sm underline" href="/career-center/placements">
            {t("backToOffice")}
          </Link>
        }
      />
      <Tabs<Tab>
        label={t("sections")}
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "queue", label: t("tabQueue") },
          { key: "settings", label: t("tabSettings") },
          { key: "create", label: t("tabCreate") },
        ]}
      />
      <TabPanel id={tab}>
        {tab === "queue" && <QueueView />}
        {tab === "settings" && <SettingsView />}
        {tab === "create" && <CreateView onDone={() => setTab("queue")} />}
      </TabPanel>
    </div>
  );
}

function QueueView() {
  const t = useCareerT("careerCenterDrives");
  const APPROVAL = useApprovalLabels();
  const TIER = useTierLabels();
  const TYPE = useJobTypeLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const [filter, setFilter] = useState("all");
  const q = useLoad(() => api<Queue>(`/api/career/campus/staff/drives?approval=${filter}`), [api, schoolId, filter]);
  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBanner error={q.error} onRetry={q.reload} />;
  const data = q.data!;
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("show")}>
          {(p) => (
            <select {...p} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">{t("all")}</option>
              {APPROVAL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {label(APPROVAL, k)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <p className="text-sm text-muted-foreground" role="status">
          {t("counts", data.counts)}
        </p>
      </div>
      {!data.canDecide && <p className="text-sm text-muted-foreground">{t("viewOnly")}</p>}
      {data.items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="space-y-3">
          {data.items.map(({ drive: d, employer, applications }) => (
            <li key={d.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/career-center/placements/drives/${d.id}`} className="font-medium underline">
                      {d.companyName}: {d.title}
                    </Link>
                    <div className="text-sm text-muted-foreground">
                      {label(TYPE, d.jobType)} · {d.ctcDisplay ?? "—"} · {label(TIER, d.tier)} · {t("deadline", { date: formatDate(d.applyDeadline) })} · {t("applications", { count: applications })}
                    </div>
                    {employer && (
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <Badge tone={employer.campusVerified ? "good" : "warn"}>{employer.campusVerified ? t("verifiedEmployer") : t("unverifiedEmployer")}</Badge>
                        {employer.gstinValid && <Badge tone="neutral">{t("gstinChecked")}</Badge>}
                        {employer.emailDomainVerified && <Badge tone="neutral">{t("domainChecked")}</Badge>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={APPROVAL_TONE[d.approvalStatus] ?? "neutral"}>{label(APPROVAL, d.approvalStatus)}</Badge>
                    {d.origin === "Office" && <Badge tone="info">{t("officeDrive")}</Badge>}
                    {d.autoApproved && <Badge tone="info">{t("autoApproved")}</Badge>}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SettingsView() {
  const t = useCareerT("careerCenterDrives");
  const api = useApi();
  const { schoolId } = useCareerShell();
  const s = useLoad(() => api<{ settings: Settings; canEdit: boolean }>("/api/career/campus/staff/settings"), [api, schoolId]);
  const [form, setForm] = useState<Record<string, string | boolean> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (s.loading && !s.data) return <Loading />;
  if (s.error) return <ErrorBanner error={s.error} onRetry={s.reload} />;
  const cur = s.data!.settings;
  const v = form ?? {
    autoApproveVerifiedEmployers: cur.autoApproveVerifiedEmployers, acceptOpenJobs: cur.acceptOpenJobs, allowIneligibleApplications: cur.allowIneligibleApplications,
    oneOfferPerStudent: cur.oneOfferPerStudent, blockAfterAcceptance: cur.blockAfterAcceptance, dream: cur.dreamCtcMin ? String(cur.dreamCtcMin) : "",
    superDream: cur.superDreamCtcMin ? String(cur.superDreamCtcMin) : "", fee: cur.pricing.employerPostingFeeRequired, premium: cur.pricing.premiumVisibilityEnabled,
  };
  const set = (k: string, val: string | boolean) => setForm({ ...v, [k]: val });
  const save = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const dream = toNum(String(v.dream));
      const superDream = toNum(String(v.superDream));
      await api("/api/career/campus/staff/settings", {
        method: "PUT",
        json: {
          autoApproveVerifiedEmployers: v.autoApproveVerifiedEmployers, acceptOpenJobs: v.acceptOpenJobs, allowIneligibleApplications: v.allowIneligibleApplications,
          oneOfferPerStudent: v.oneOfferPerStudent, blockAfterAcceptance: v.blockAfterAcceptance, clearTiers: dream === undefined && superDream === undefined,
          dreamCtcMin: dream, superDreamCtcMin: superDream, employerPostingFeeRequired: v.fee, premiumVisibilityEnabled: v.premium,
        },
      });
      setMsg(t("saved"));
      setForm(null);
      s.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const box = (k: string, text: string) => (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" disabled={!s.data!.canEdit} checked={Boolean(v[k])} onChange={(e) => set(k, e.target.checked)} />
      <span>{text}</span>
    </label>
  );
  return (
    <div className="mt-4 space-y-4">
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      {!s.data!.canEdit && <p className="text-sm text-muted-foreground">{t("adminOnly")}</p>}
      <Card title={t("approvalRules")}>
        <div className="space-y-2">
          {box("autoApproveVerifiedEmployers", t("autoApprove"))}
          {box("acceptOpenJobs", t("acceptOpen"))}
          {box("allowIneligibleApplications", t("allowIneligible"))}
        </div>
      </Card>
      <Card title={t("policyTitle")}>
        <div className="space-y-2">
          {box("oneOfferPerStudent", t("oneOffer"))}
          {box("blockAfterAcceptance", t("blockAfter"))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label={t("dream")} hint={cur.dreamCtcMin ? inrShort(cur.dreamCtcMin) : t("tiersHint")}>
            {(p) => <input {...p} inputMode="numeric" disabled={!s.data!.canEdit} value={String(v.dream)} onChange={(e) => set("dream", e.target.value)} />}
          </Field>
          <Field label={t("superDream")} hint={cur.superDreamCtcMin ? inrShort(cur.superDreamCtcMin) : t("tiersHint")}>
            {(p) => <input {...p} inputMode="numeric" disabled={!s.data!.canEdit} value={String(v.superDream)} onChange={(e) => set("superDream", e.target.value)} />}
          </Field>
        </div>
      </Card>
      <Card title={t("pricingTitle")}>
        <p className="mb-2 text-sm text-muted-foreground">{t("pricingNote")}</p>
        <div className="space-y-2">
          {box("fee", t("feeRequired"))}
          {box("premium", t("premium"))}
        </div>
      </Card>
      {s.data!.canEdit && (
        <Button busy={busy} onClick={save}>
          {t("save")}
        </Button>
      )}
    </div>
  );
}

function CreateView({ onDone }: { onDone: () => void }) {
  const t = useCareerT("careerCenterDrives");
  const TYPE = useJobTypeLabels();
  const api = useApi();
  const [f, setF] = useState({ companyName: "", title: "", jobType: "FullTime", ctcText: "", stipendMonthly: "", batches: "", degrees: "", branches: "", minCgpa: "", rounds: "", applyDeadline: "", driveDate: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const on = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/career/campus/staff/drives", {
        method: "POST",
        json: {
          companyName: f.companyName, title: f.title, jobType: f.jobType, ctcText: f.ctcText || undefined, stipendMonthly: toNum(f.stipendMonthly),
          batches: toList(f.batches).map(Number).filter(Number.isFinite), degrees: toList(f.degrees), branches: toList(f.branches), minCgpa: toNum(f.minCgpa),
          rounds: toList(f.rounds), applyDeadline: localToIso(f.applyDeadline), driveDate: f.driveDate || undefined,
        },
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={t("createTitle")} className="mt-4">
      <p className="mb-3 text-sm text-muted-foreground">{t("createHelp")}</p>
      <ErrorBanner error={err} />
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("company")}>{(p) => <input {...p} value={f.companyName} onChange={on("companyName")} />}</Field>
        <Field label={t("jobTitle")}>{(p) => <input {...p} value={f.title} onChange={on("title")} />}</Field>
        <Field label={t("jobType")}>
          {(p) => (
            <select {...p} value={f.jobType} onChange={on("jobType")}>
              {JOB_TYPE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {label(TYPE, k)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("ctc")} hint={t("ctcHint")}>{(p) => <input {...p} value={f.ctcText} onChange={on("ctcText")} />}</Field>
        <Field label={t("stipend")}>{(p) => <input {...p} inputMode="numeric" value={f.stipendMonthly} onChange={on("stipendMonthly")} />}</Field>
        <Field label={t("batches")}>{(p) => <input {...p} value={f.batches} onChange={on("batches")} />}</Field>
        <Field label={t("degrees")}>{(p) => <input {...p} value={f.degrees} onChange={on("degrees")} />}</Field>
        <Field label={t("branches")}>{(p) => <input {...p} value={f.branches} onChange={on("branches")} />}</Field>
        <Field label={t("minCgpa")}>{(p) => <input {...p} inputMode="decimal" value={f.minCgpa} onChange={on("minCgpa")} />}</Field>
        <Field label={t("rounds")}>{(p) => <input {...p} value={f.rounds} onChange={on("rounds")} />}</Field>
        <Field label={t("applyDeadline")}>{(p) => <input {...p} type="datetime-local" value={f.applyDeadline} onChange={on("applyDeadline")} />}</Field>
        <Field label={t("driveDate")}>{(p) => <input {...p} type="date" value={f.driveDate} onChange={on("driveDate")} />}</Field>
      </div>
      <Button className="mt-4" busy={busy} disabled={!f.companyName.trim() || !f.title.trim()} onClick={create}>
        {t("createDrive")}
      </Button>
    </Card>
  );
}
