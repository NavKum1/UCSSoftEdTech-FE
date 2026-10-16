"use client";

/** G15: WIOA primary indicators from participant, wage, credential and skill-gain records, with exports and definitions. */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, ErrorBanner, Field, Loading, SuccessBanner, useCareerFormat, useCareerT, useLoad } from "@/components/career/ui";
import { ReportTableView, type ReportTable } from "@/components/career/reports/ReportTableView";
import { VerifyNotice } from "@/components/career/international/WorkRights";
import { FactList, SourceList, checkboxClass, useDateOnly, useDownload, useIsCareerAdmin, type Fact, type Source } from "./shared";

export interface WioaDefinitions {
  reviewedOn: string;
  verifyFormat: string;
  wageGap: string;
  indicators: { key: string; name: string; definition: string; method: string; rules: Fact[]; unconfirmedCount: number }[];
  exclusions: Fact[];
  apprenticeship: Fact[];
  sources: Source[];
  programs: string[];
  trainingTypes: string[];
  wageSources: string[];
  gainTypes: string[];
  exitReasons: string[];
  credentialTypes: number[];
}

interface Indicator {
  key: string;
  numerator?: number;
  denominator?: number;
  rate?: string;
  pending?: number;
  count?: number;
  value?: number | string | null;
}

interface WioaReport {
  filters: { programYear: number | null; exitFrom: string; exitTo: string; msgFrom: string; msgTo: string; program: string | null; includeOutcomes: boolean };
  participants: number;
  exiters: number;
  excluded: number;
  waitingForWageData: number;
  fromOutcomes: number;
  minCellSize: number;
  indicators: Indicator[];
  tables: ReportTable[];
  notes: string[];
}

const thisProgramYear = () => {
  const d = new Date();
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
};

export function WioaReportPanel({ defs }: { defs: WioaDefinitions }) {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const t = useCareerT("workforce");
  const fmt = useCareerFormat();
  const dateOnly = useDateOnly();
  const isAdmin = useIsCareerAdmin();
  const { busy, error: dlError, download } = useDownload();
  const [msg, setMsg] = useState<string | null>(null);
  const years = Array.from({ length: 6 }, (_, i) => thisProgramYear() - i);
  const [form, setForm] = useState({ mode: "py" as "py" | "range", py: String(thisProgramYear() - 1), from: "", to: "", program: "", outcomes: false });
  const [applied, setApplied] = useState(form);
  const params = new URLSearchParams();
  if (applied.mode === "py") params.set("programYear", applied.py);
  else {
    if (applied.from) params.set("exitFrom", applied.from);
    if (applied.to) params.set("exitTo", applied.to);
  }
  if (applied.program) params.set("program", applied.program);
  if (applied.outcomes) params.set("includeOutcomes", "true");
  const q = params.toString();
  const report = useLoad(() => api<WioaReport>(`/api/career/workforce/wioa/report?${q}`), [api, schoolId, q]);
  const r = report.data;
  const def = (key: string) => defs.indicators.find((i) => i.key === key);

  const exportFile = async (format: "csv" | "xlsx", detail: boolean) => {
    setMsg(null);
    const okDl = await download(`${format}-${detail}`, `/api/career/workforce/wioa/report/export?${q}&format=${format}${detail ? "&detail=true" : ""}`, `wioa.${format}`);
    if (okDl) setMsg(t("downloadStarted"));
  };

  const value = (i: Indicator) => {
    if (i.key === "medianEarningsQ2") return typeof i.value === "number" ? fmt.currency(i.value, "USD") : (i.value ?? "—");
    return i.rate ?? "—";
  };
  const detailLine = (i: Indicator) =>
    i.key === "medianEarningsQ2" ? t("medianDetail", { count: i.count ?? 0 }) : t("rateDetail", { numerator: i.numerator ?? 0, denominator: i.denominator ?? 0 });

  return (
    <div className="space-y-6">
      <VerifyNotice text={defs.verifyFormat} extra={defs.wageGap} />
      <ErrorBanner error={dlError} />
      <SuccessBanner message={msg} />
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(form);
          }}
        >
          <Field label={t("periodType")}>
            {(props) => (
              <select {...props} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as "py" | "range" })}>
                <option value="py">{t("periodProgramYear")}</option>
                <option value="range">{t("periodExitRange")}</option>
              </select>
            )}
          </Field>
          {form.mode === "py" ? (
            <Field label={t("programYear")} hint={t("programYearHint")}>
              {(props) => (
                <select {...props} value={form.py} onChange={(e) => setForm({ ...form, py: e.target.value })}>
                  {years.map((y) => (
                    <option key={y} value={String(y)}>
                      {t("programYearOption", { year: y, next: y + 1 })}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : (
            <>
              <Field label={t("exitFrom")}>{(props) => <input {...props} type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />}</Field>
              <Field label={t("exitTo")}>{(props) => <input {...props} type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />}</Field>
            </>
          )}
          <Field label={t("program")}>
            {(props) => (
              <select {...props} value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })}>
                <option value="">{t("allPrograms")}</option>
                {defs.programs.map((p) => (
                  <option key={p} value={p}>
                    {t(`programs.${p}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div className="flex items-center gap-2 lg:col-span-2">
            <input id="wioa-outcomes" type="checkbox" className={checkboxClass} checked={form.outcomes} onChange={(e) => setForm({ ...form, outcomes: e.target.checked })} />
            <label htmlFor="wioa-outcomes" className="text-sm">
              {t("includeOutcomes")}
            </label>
          </div>
          <div className="flex flex-wrap gap-2 lg:col-span-2 lg:justify-end">
            <Button type="submit">{t("apply")}</Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" busy={busy === "csv-false"} onClick={() => exportFile("csv", false)}>
          {t("exportCsv")}
        </Button>
        <Button variant="secondary" busy={busy === "xlsx-false"} onClick={() => exportFile("xlsx", false)}>
          {t("exportXlsx")}
        </Button>
        {isAdmin && (
          <Button variant="secondary" busy={busy === "csv-true"} onClick={() => exportFile("csv", true)} title={t("exportDetailHint")}>
            {t("exportDetail")}
          </Button>
        )}
      </div>

      <ErrorBanner error={report.error} onRetry={report.reload} />
      {report.loading && !r ? (
        <Loading />
      ) : (
        r && (
          <section aria-labelledby="wioa-results" className="space-y-4" aria-live="polite">
            <h2 id="wioa-results" className="text-lg font-semibold">
              {t("resultsHeading")}
            </h2>
            <p className="text-sm" role="status">
              {t("periodSummary", { from: dateOnly(r.filters.exitFrom), to: dateOnly(r.filters.exitTo), exiters: r.exiters, excluded: r.excluded, participants: r.participants })}{" "}
              {r.waitingForWageData > 0 && t("waitingForWages", { count: r.waitingForWageData })}{" "}
              {r.fromOutcomes > 0 && t("fromOutcomes", { count: r.fromOutcomes })}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {r.indicators.map((i) => (
                <li key={i.key} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-medium">{def(i.key)?.name ?? i.key}</p>
                  <p className="mt-1 text-2xl font-semibold">{value(i)}</p>
                  <p className="text-xs text-muted-foreground">{detailLine(i)}</p>
                  {(i.pending ?? 0) > 0 && <p className="mt-1 text-xs text-muted-foreground">{t("pendingCount", { count: i.pending ?? 0 })}</p>}
                  {i.key === "retention" && (
                    <p className="mt-1">
                      <Badge tone="info">{t("informational")}</Badge>
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {r.tables.map((tb) => (
              <ReportTableView key={tb.key} table={tb} />
            ))}
            <ul className="list-disc space-y-1 ps-5 text-xs text-muted-foreground">
              {r.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
        )
      )}

      <Card title={t("definitionsTitle")}>
        <div className="space-y-5">
          {defs.indicators.map((i) => (
            <section key={i.key} aria-labelledby={`def-${i.key}`}>
              <h3 id={`def-${i.key}`} className="font-semibold">
                {i.name}
              </h3>
              <p className="mt-1 text-sm">{i.definition}</p>
              <p className="mt-1 text-xs text-muted-foreground">{i.method}</p>
              <div className="mt-2">
                <FactList facts={i.rules} />
              </div>
            </section>
          ))}
          <section aria-labelledby="def-exclusions">
            <h3 id="def-exclusions" className="font-semibold">
              {t("exclusionsTitle")}
            </h3>
            <FactList facts={defs.exclusions} />
          </section>
          <section aria-labelledby="def-sources">
            <h3 id="def-sources" className="font-semibold">
              {t("sourcesTitle")}
            </h3>
            <SourceList sources={defs.sources} />
            <p className="mt-2 text-xs text-muted-foreground">{t("reviewedOn", { date: dateOnly(defs.reviewedOn) })}</p>
          </section>
        </div>
      </Card>
    </div>
  );
}
