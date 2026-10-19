"use client";

/**
 * H1 student job board: campus drives approved by the student's own placement office. Each card shows eligibility against
 * the student's academic record (eligible, not eligible with reasons, or data missing) and the college's placement policy.
 * Applying shares the listed data and documents with that employer only (consent recorded; every employer view is logged).
 */

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { inrFull, label } from "@/components/career/placements/shared";
import { APP_TONE, DOC_KIND_KEYS, ELIG_TONE, useAppStatusLabels, useDocKindLabels, useEligLabels, useJobTypeLabels, useTierLabels, type Criteria } from "@/components/career/campus/shared";

interface BoardCard {
  driveId: string;
  companyName: string;
  title: string;
  jobType: string;
  description?: string | null;
  locations: string[];
  ctcAnnual?: number | null;
  stipendMonthly?: number | null;
  ctcNotes?: string | null;
  driveDate?: string | null;
  tier: string;
  applyDeadline?: string | null;
  applicationMode: string;
  requiredDocuments: string[];
  rounds: string[];
  criteria: Criteria;
  eligibility: { status: string; reasons: string[] };
  policy: { blocked: boolean; reasons: string[] };
  closed: boolean;
  canApply: boolean;
  sharesWith?: string | null;
  myApplication?: { id: string; status: string } | null;
}

interface Board {
  items: BoardCard[];
  note: string;
}

interface Doc {
  id: string;
  fileName: string;
}

export default function StudentJobsPage() {
  const t = useCareerT("studentJobs");
  const api = useApi();
  const { schoolId } = useCareerShell();
  const board = useLoad(() => api<Board>("/api/career/campus/student/jobs"), [api, schoolId]);
  const docs = useLoad(() => api<Doc[]>("/api/career/campus/student/documents"), [api, schoolId]);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link className="text-sm underline" href="/student/jobs/applications">
            {t("myApplications")}
          </Link>
        }
      />
      <SuccessBanner message={msg} />
      {board.loading && !board.data ? (
        <Loading />
      ) : board.error ? (
        <ErrorBanner error={board.error} onRetry={board.reload} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{board.data!.note}</p>
          {board.data!.items.length === 0 ? (
            <EmptyState title={t("empty")} />
          ) : (
            board.data!.items.map((c) => (
              <JobCard
                key={c.driveId}
                card={c}
                docs={docs.data ?? []}
                expanded={open === c.driveId}
                onToggle={() => setOpen(open === c.driveId ? null : c.driveId)}
                onUploaded={docs.reload}
                onApplied={() => {
                  setOpen(null);
                  setMsg(t("applied", { company: c.companyName }));
                  board.reload();
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function JobCard({ card: c, docs, expanded, onToggle, onUploaded, onApplied }: { card: BoardCard; docs: Doc[]; expanded: boolean; onToggle: () => void; onUploaded: () => void; onApplied: () => void }) {
  const t = useCareerT("studentJobs");
  const TYPE = useJobTypeLabels();
  const TIER = useTierLabels();
  const ELIG = useEligLabels();
  const STATUS = useAppStatusLabels();
  const KIND = useDocKindLabels();
  const api = useApi();
  const [picked, setPicked] = useState<{ fileId: string; kind: string }[]>([]);
  const [kind, setKind] = useState(c.requiredDocuments[0] ?? "Resume");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const titleId = `job-${c.driveId}`;

  const upload = async (file: File) => {
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const d = await api<Doc>("/api/career/campus/student/documents", { method: "POST", body: fd });
      setPicked([...picked, { fileId: d.id, kind }]);
      onUploaded();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const apply = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/career/campus/student/jobs/${c.driveId}/apply`, { method: "POST", json: { documents: picked, consent } });
      onApplied();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <article aria-labelledby={titleId}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              {c.companyName}: {c.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {label(TYPE, c.jobType)} · {c.jobType === "Internship" ? t("stipend", { amount: inrFull(c.stipendMonthly) }) : t("ctc", { amount: inrFull(c.ctcAnnual) })} · {label(TIER, c.tier)}
              {c.locations.length > 0 && ` · ${c.locations.join(", ")}`}
            </p>
            <p className="text-sm text-muted-foreground">{t("deadline", { date: formatDate(c.applyDeadline, true) })}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ELIG_TONE[c.eligibility.status] ?? "neutral"}>{label(ELIG, c.eligibility.status)}</Badge>
            {c.myApplication && <Badge tone={APP_TONE[c.myApplication.status] ?? "neutral"}>{label(STATUS, c.myApplication.status)}</Badge>}
            {c.closed && <Badge tone="neutral">{t("closed")}</Badge>}
          </div>
        </div>
        {c.eligibility.reasons.length > 0 && (
          <ul className="mt-2 list-disc ps-5 text-sm">
            {c.eligibility.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {c.policy.blocked && (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300" role="note">
            {c.policy.reasons.join(" ")}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" aria-expanded={expanded} aria-controls={`${titleId}-details`} onClick={onToggle}>
            {expanded ? t("hideDetails") : c.canApply ? t("detailsAndApply") : t("details")}
          </Button>
        </div>
        {expanded && (
          <div id={`${titleId}-details`} className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
            {c.description && <p className="whitespace-pre-line">{c.description}</p>}
            {c.ctcNotes && <p>{t("ctcNotes", { notes: c.ctcNotes })}</p>}
            <p>{t("criteriaLine", { branches: c.criteria.branches.join(", ") || t("any"), cgpa: c.criteria.minCgpa ?? "—", backlogs: c.criteria.maxActiveBacklogs ?? "—", batches: c.criteria.batches.join(", ") || t("any") })}</p>
            {c.rounds.length > 0 && <p>{t("roundsLine", { rounds: c.rounds.join(" → ") })}</p>}
            {c.canApply && (
              <div className="space-y-3">
                <ErrorBanner error={err} />
                {c.requiredDocuments.length > 0 && <p>{t("required", { kinds: c.requiredDocuments.map((k) => label(KIND, k)).join(", ") })}</p>}
                <fieldset>
                  <legend className="font-medium">{t("attach")}</legend>
                  <div className="mt-1 space-y-1">
                    {docs.map((d) => {
                      const on = picked.find((p) => p.fileId === d.id);
                      return (
                        <label key={d.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!on}
                            onChange={(e) => setPicked(e.target.checked ? [...picked, { fileId: d.id, kind }] : picked.filter((p) => p.fileId !== d.id))}
                          />
                          <bdi>{d.fileName}</bdi>
                          {on && <span className="text-muted-foreground">({label(KIND, on.kind)})</span>}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label={t("kind")}>
                    {(p) => (
                      <select {...p} value={kind} onChange={(e) => setKind(e.target.value)}>
                        {DOC_KIND_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {label(KIND, k)}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field label={t("upload")}>{(p) => <input {...p} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />}</Field>
                </div>
                {c.sharesWith && (
                  <label className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>{t("consent", { company: c.sharesWith })}</span>
                  </label>
                )}
                <Button busy={busy} disabled={!!c.sharesWith && !consent} onClick={apply}>
                  {c.applicationMode === "OptIn" ? t("optIn") : t("apply")}
                </Button>
              </div>
            )}
          </div>
        )}
      </article>
    </Card>
  );
}
