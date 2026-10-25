"use client";

/**
 * G12: workforce-localisation reporting on top of D4 outcomes. Citizen-graduate employment for Saudization (Nitaqat),
 * Emiratisation, Qatarisation and South Africa SETA, with CSV/XLSX exports. Every rule shows its source and whether it was
 * confirmed on an official page; exports say "verify against the current official format".
 */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useCareerFormat, useCareerT, useLoad } from "@/components/career/ui";
import { ReportTableView, type ReportTable } from "@/components/career/reports/ReportTableView";
import { VerifyNotice } from "@/components/career/international/WorkRights";

interface Rule {
  text: string;
  verified: boolean;
  sourceUrl?: string | null;
}
interface Framework {
  key: string;
  citizenCountry: string;
  country: string;
  name: string;
  authority: string;
  summary: string;
  rules: Rule[];
  sources: { title: string; url: string; official: boolean }[];
  exportNote: string;
  unconfirmedCount: number;
}
interface FrameworksResponse {
  reviewedOn: string;
  verifyFormat: string;
  frameworks: Framework[];
}
interface Report {
  framework: string;
  frameworkName: string;
  filters: { cohort: number | null; program: string | null; cohorts: number[]; programs: string[] };
  coverage: { graduates: number; nationalityRecorded: number; nationalityRate: string; missingGraduationDate: number };
  tables: ReportTable[];
  notes: string[];
  verifyFormat: string;
}
interface ImportResult {
  updated: number;
  skipped: { line: number; reason: string }[];
}

export default function LocalisationReportsPage() {
  const api = useApi();
  const { schoolId, me } = useCareerShell();
  const t = useCareerT("localisation");
  const fmt = useCareerFormat();
  const isAdmin = !!me?.memberships.some((m) => m.role === "CareerAdmin" && (!schoolId || m.instituteId === schoolId));
  const fws = useLoad(() => api<FrameworksResponse>("/api/career/localisation/frameworks"), [api]);
  const [fw, setFw] = useState("emiratisation");
  const [cohort, setCohort] = useState("");
  const [program, setProgram] = useState("");
  const [applied, setApplied] = useState({ fw: "emiratisation", cohort: "", program: "" });
  const q = new URLSearchParams({ framework: applied.fw, ...(applied.cohort ? { cohort: applied.cohort } : {}), ...(applied.program ? { program: applied.program } : {}) }).toString();
  const report = useLoad(() => api<Report>(`/api/career/localisation/report?${q}`), [api, schoolId, q]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [imported, setImported] = useState<ImportResult | null>(null);

  const download = async (format: "csv" | "xlsx", detail: boolean) => {
    const key = `${format}-${detail}`;
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      const res = await api<Response>(`/api/career/localisation/report/export?${q}&format=${format}${detail ? "&detail=true" : ""}`, { raw: true });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body && body.message) || t("exportFailedStatus", { status: res.status }));
      }
      const name = /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `localisation.${format}`;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(t("downloadStarted"));
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const runImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("import");
    setErr(null);
    setMsg(null);
    try {
      const r = await api<ImportResult>("/api/career/localisation/staff/nationalities/import", { json: { csv } });
      setImported(r);
      setMsg(t("importResult", { updated: r.updated, skipped: r.skipped.length }));
      report.reload();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (fws.loading && !fws.data) return <Loading />;
  if (!fws.data) return <ErrorBanner error={fws.error} onRetry={fws.reload} />;
  const current = fws.data.frameworks.find((f) => f.key === applied.fw) ?? fws.data.frameworks[0];
  const r = report.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <>
            <Button variant="secondary" busy={busy === "csv-false"} onClick={() => download("csv", false)}>
              {t("exportCsv")}
            </Button>
            <Button variant="secondary" busy={busy === "xlsx-false"} onClick={() => download("xlsx", false)}>
              {t("exportXlsx")}
            </Button>
            {isAdmin && (
              <Button variant="secondary" busy={busy === "xlsx-true"} onClick={() => download("xlsx", true)} title={t("exportDetailHint")}>
                {t("exportDetail")}
              </Button>
            )}
          </>
        }
      />
      <VerifyNotice text={`${t("verifyFormat")} ${fws.data.verifyFormat}`} />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />

      <Card>
        <form
          className="grid gap-3 sm:grid-cols-4 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied({ fw, cohort, program });
          }}
        >
          <Field label={t("framework")}>
            {(props) => (
              <select {...props} value={fw} onChange={(e) => setFw(e.target.value)}>
                {fws.data!.frameworks.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.name} ({f.country})
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("cohort")}>
            {(props) => (
              <select {...props} value={cohort} onChange={(e) => setCohort(e.target.value)}>
                <option value="">{t("allCohorts")}</option>
                {r?.filters.cohorts.map((c) => (
                  <option key={c} value={String(c)}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("program")}>
            {(props) => (
              <select {...props} value={program} onChange={(e) => setProgram(e.target.value)}>
                <option value="">{t("allPrograms")}</option>
                {r?.filters.programs.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Button type="submit">{t("apply")}</Button>
        </form>
      </Card>

      <ErrorBanner error={report.error} onRetry={report.reload} />
      {report.loading && !r ? (
        <Loading />
      ) : (
        r && (
          <div className="space-y-4" aria-live="polite">
            <h2 className="text-lg font-semibold">{t("tablesHeading")}</h2>
            <p className="text-sm" role="status">
              {t("coverage", { recorded: r.coverage.nationalityRecorded, graduates: r.coverage.graduates, rate: r.coverage.nationalityRate })}{" "}
              {t("missingDates", { count: r.coverage.missingGraduationDate })}
            </p>
            {r.tables.map((tb) => (
              <ReportTableView key={tb.key} table={tb} />
            ))}
            <ul className="list-disc space-y-1 ps-5 text-xs text-muted-foreground">
              {r.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )
      )}

      {current && (
        <Card title={t("rulesTitle", { name: current.name })}>
          <p className="text-sm">{current.summary}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("authority", { authority: current.authority })}</p>
          <ul className="mt-3 list-disc space-y-2 ps-5 text-sm">
            {current.rules.map((rule, i) => (
              <li key={i}>
                {rule.text}{" "}
                <span className="inline-flex flex-wrap items-center gap-2">
                  <Badge tone={rule.verified ? "good" : "warn"}>{rule.verified ? t("verified") : t("unconfirmed")}</Badge>
                  {rule.sourceUrl && (
                    <a href={rule.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                      {t("sources")}
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-sm font-semibold">{t("sources")}</h3>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {current.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {s.title}
                </a>{" "}
                <span className="text-xs text-muted-foreground">({s.official ? t("official") : t("secondary")})</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">{current.exportNote}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t("rulesReviewed", { date: fmt.date(fws.data.reviewedOn) })}</p>
        </Card>
      )}

      <Card title={t("nationalityTitle")}>
        <p className="mb-3 text-sm">{t("nationalityIntro")}</p>
        {isAdmin && (
          <form onSubmit={runImport} className="space-y-3">
            <Field label={t("importLabel")}>
              {(props) => <textarea {...props} rows={5} dir="ltr" value={csv} onChange={(e) => setCsv(e.target.value)} />}
            </Field>
            <Button type="submit" busy={busy === "import"} disabled={!csv.trim()}>
              {t("importButton")}
            </Button>
            {imported && imported.skipped.length > 0 && (
              <ul className="list-disc space-y-1 ps-5 text-xs">
                {imported.skipped.map((s) => (
                  <li key={s.line}>{t("skippedLine", { line: s.line, reason: s.reason })}</li>
                ))}
              </ul>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}
