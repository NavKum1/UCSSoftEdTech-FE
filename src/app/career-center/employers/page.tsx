"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { RELATIONSHIP_KEYS, RELATIONSHIP_TONES, useRelationshipLabels, useVerification } from "@/components/career/coreLabels";

interface EmployerRequest {
  id: string;
  status: string;
  requestNote?: string | null;
  decisionNote?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
  employer: {
    id: string;
    name: string;
    website?: string | null;
    emailDomain?: string | null;
    industry?: string | null;
    sizeBand?: string | null;
    hqCity?: string | null;
    hqState?: string | null;
    verificationStatus: string;
    flagReason?: string | null;
  } | null;
}

const TABS = RELATIONSHIP_KEYS;

export default function CareerCenterEmployersPage() {
  const tr = useCareerT("careerCenterEmployers");
  const VERIFICATION = useVerification();
  const STATUS = useRelationshipLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const [tab, setTab] = useState("Pending");
  const list = useLoad(() => api<EmployerRequest[]>(`/api/career/admin/employers?status=${tab}`), [api, schoolId, tab]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const decide = async (r: EmployerRequest, status: string) => {
    if (status === "Blocked" && !window.confirm(tr("blockNameTheyWontBe", { name: r.employer?.name ?? tr("thisEmployer") }))) return;
    setBusy(r.id + status);
    setErr(null);
    setMsg(null);
    try {
      await api(`/api/career/admin/employers/${r.id}/decision`, { method: "POST", json: { status, note: notes[r.id] || null } });
      setMsg(tr("nameStatusTheyveBeenNotified", { name: r.employer?.name ?? tr("employer"), status }));
      list.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title={tr("employers")} description={tr("companiesAskingToRecruitYour")} />
      <ErrorBanner error={err ?? list.error} onRetry={list.error ? list.reload : undefined} />
      <SuccessBanner message={msg} />

      <div role="tablist" aria-label={tr("requestStatus")} className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            aria-controls="employer-panel"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t ? "font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            style={tab === t ? { borderColor: "var(--brand, #4f46e5)" } : undefined}
          >
            {STATUS[t]}
          </button>
        ))}
      </div>

      <div id="employer-panel" role="tabpanel">
        {list.loading && !list.data ? (
          <Loading />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState title={tr("noTabEmployers", { tab })} />
        ) : (
          <ul className="space-y-3">
            {list.data!.map((r) => {
              const v = VERIFICATION[r.employer?.verificationStatus ?? ""] ?? { label: r.employer?.verificationStatus ?? tr("unknown"), tone: "neutral" as const, explain: "" };
              return (
                <li key={r.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold">{r.employer?.name ?? tr("unknownEmployer")}</h2>
                      <p className="text-sm text-muted-foreground">
                        {[r.employer?.industry, r.employer?.sizeBand, [r.employer?.hqCity, r.employer?.hqState].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || tr("noCompanyDetails")}
                      </p>
                      {r.employer?.website && (
                        <a href={r.employer.website.includes("://") ? r.employer.website : `https://${r.employer.website}`} target="_blank" rel="noreferrer noopener" className="text-sm underline">
                          {r.employer.website}
                        </a>
                      )}
                      {r.employer?.emailDomain && <p className="text-xs text-muted-foreground">{tr("accountEmailDomainEmailDomain", { emailDomain: r.employer.emailDomain })}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={v.tone}>{v.label}</Badge>
                      <Badge tone={RELATIONSHIP_TONES[r.status] ?? "neutral"}>{STATUS[r.status] ?? r.status}</Badge>
                    </div>
                  </div>
                  {r.employer?.flagReason && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{tr("flaggedFlagReason", { flagReason: r.employer.flagReason })}</p>}
                  {r.requestNote && <p className="mt-3 rounded-md bg-muted p-3 text-sm">&ldquo;{r.requestNote}&rdquo;</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {tr("requestedRequestedAt", { requestedAt: formatDate(r.requestedAt, true) })}
                    {r.decidedAt && tr("decidedDecidedAt", { decidedAt: formatDate(r.decidedAt, true) })}
                    {r.decisionNote && tr("noteDecisionNote", { decisionNote: r.decisionNote })}
                  </p>
                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <div className="min-w-56 flex-1">
                      <Field label={tr("noteToTheEmployerOptional")}>
                        {(p) => <input {...p} value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />}
                      </Field>
                    </div>
                    {r.status !== "Approved" && <Button onClick={() => decide(r, "Approved")} busy={busy === r.id + "Approved"}>{tr("approve")}</Button>}
                    {r.status !== "Declined" && <Button variant="secondary" onClick={() => decide(r, "Declined")} busy={busy === r.id + "Declined"}>{tr("decline")}</Button>}
                    {r.status !== "Blocked" && <Button variant="danger" onClick={() => decide(r, "Blocked")} busy={busy === r.id + "Blocked"}>{tr("block")}</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
