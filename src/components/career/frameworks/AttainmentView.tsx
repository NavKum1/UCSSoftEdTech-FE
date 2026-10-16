"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, SuccessBanner, useLoad, ScrollArea, useCareerT } from "@/components/career/ui";

export interface FrameworkOutcome {
  code: string;
  title: string;
}

export interface FrameworkInfo {
  key: string;
  name: string;
  description: string;
  builtIn: boolean;
  enabled: boolean;
  note: string;
  allowsProgramSpecific: boolean;
  mappingCount: number;
  outcomes: FrameworkOutcome[];
}

export interface SourceInfo {
  key: string;
  label: string;
  direct: boolean;
  refLabel: string;
  description: string;
}

export interface Catalog {
  role: string;
  canEdit: boolean;
  minCellSize: number;
  minCellSizeFloor: number;
  enabled: string[];
  frameworks: FrameworkInfo[];
  sources: SourceInfo[];
}

interface MappingRow {
  mappingId: string;
  source: string;
  sourceLabel: string;
  sourceRefLabel: string | null;
  direct: boolean;
  weight: number;
  targetScore: number;
  level3: number;
  level2: number;
  level1: number;
  assessed: string;
  atOrAboveTarget: number | null;
  percent: number | null;
  level: number | null;
  suppressed: boolean;
}

interface OutcomeRow {
  code: string;
  title: string;
  directAttainment: number | null;
  indirectAttainment: number | null;
  directSuppressed: boolean;
  indirectSuppressed: boolean;
  mappings?: MappingRow[];
}

interface Attainment {
  framework: { key: string; name: string; note: string };
  options: { programs: string[]; cohorts: string[]; terms: string[] };
  minCellSize: number;
  students: string;
  outcomes: OutcomeRow[];
  groups: { name: string; students: string; outcomes: OutcomeRow[] }[];
  note: string;
}

interface Filters {
  program: string;
  cohort: string;
  term: string;
  groupBy: string;
}

const EMPTY: Filters = { program: "", cohort: "", term: "", groupBy: "program" };

function toQuery(f: Filters) {
  const p = new URLSearchParams();
  if (f.program) p.set("program", f.program);
  if (f.cohort) p.set("cohort", f.cohort);
  if (f.term) p.set("term", f.term);
  if (f.groupBy && f.groupBy !== "none") p.set("groupBy", f.groupBy);
  return p.toString();
}

// Heat colors back up the printed value and its band word; meaning never depends on color alone
function band(v: number | null, suppressed: boolean, k: number) {
  if (v === null) return suppressed ? { text: `<${k}`, word: "suppressed", cls: "bg-muted text-muted-foreground" } : { text: "—", word: "noEvidence", cls: "" };
  if (v >= 2.5) return { text: v.toFixed(2), word: "high", cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100" };
  if (v >= 1.5) return { text: v.toFixed(2), word: "moderate", cls: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100" };
  return { text: v.toFixed(2), word: "low", cls: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100" };
}

function Cell({ v, suppressed, k }: { v: number | null; suppressed: boolean; k: number }) {
  const t = useCareerT("attainmentView");
  const b = band(v, suppressed, k);
  return (
    <td className={`border border-border px-2 py-1 text-end tabular-nums ${b.cls}`}>
      <span className="font-medium">{b.text}</span> <span className="text-xs">({t(`band.${b.word}`)})</span>
    </td>
  );
}

export function AttainmentView({ framework }: { framework: FrameworkInfo }) {
  const t = useCareerT("attainmentView");
  const api = useApi();
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const q = toQuery(applied);
  const base = `/api/career/frameworks/${encodeURIComponent(framework.key)}`;
  const att = useLoad(() => api<Attainment>(`${base}/attainment?${q}`), [base, q]);

  const download = async () => {
    setBusy("csv");
    setError(null);
    setSuccess(null);
    try {
      const res = await api<Response>(`${base}/attainment.csv?${q}`, { raw: true });
      if (!res.ok) throw new Error(t("exportFailedStatus", { status: res.status }));
      const name = /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "attainment.csv";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess(t("downloadStarted"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const printable = async () => {
    setBusy("print");
    setError(null);
    setSuccess(null);
    try {
      const res = await api<Response>(`${base}/report.html?${q}`, { raw: true });
      if (!res.ok) throw new Error(t("couldntBuildTheReportStatus", { status: res.status }));
      const url = URL.createObjectURL(new Blob([await res.text()], { type: "text/html" }));
      const w = window.open(url, "_blank", "noopener");
      if (!w) throw new Error(t("allowPopUpsToOpen"));
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const data = att.data;
  const k = data?.minCellSize ?? 5;

  return (
    <div className="space-y-6">
      <Card title={t("filters")}>
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(draft);
          }}
        >
          <Field label={t("programMajor")}>
            {(p) => (
              <select {...p} value={draft.program} onChange={(e) => setDraft({ ...draft, program: e.target.value })}>
                <option value="">{t("allPrograms")}</option>
                {data?.options.programs.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            )}
          </Field>
          <Field label={t("cohortGraduationTerm")}>
            {(p) => (
              <select {...p} value={draft.cohort} onChange={(e) => setDraft({ ...draft, cohort: e.target.value })}>
                <option value="">{t("allCohorts")}</option>
                {data?.options.cohorts.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            )}
          </Field>
          <Field label={t("evidenceTerm")}>
            {(p) => (
              <select {...p} value={draft.term} onChange={(e) => setDraft({ ...draft, term: e.target.value })}>
                <option value="">{t("allTerms")}</option>
                {data?.options.terms.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            )}
          </Field>
          <Field label={t("heatmapColumns")}>
            {(p) => (
              <select {...p} value={draft.groupBy} onChange={(e) => setDraft({ ...draft, groupBy: e.target.value })}>
                <option value="none">{t("overallOnly")}</option>
                <option value="program">{t("byProgram")}</option>
                <option value="cohort">{t("byCohort")}</option>
                <option value="term">{t("byEvidenceTerm")}</option>
              </select>
            )}
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit">{t("apply")}</Button>
            <Button type="button" variant="secondary" busy={busy === "csv"} onClick={download}>{t("downloadCSV")}</Button>
            <Button type="button" variant="secondary" busy={busy === "print"} onClick={printable}>{t("printableEvidenceReport")}</Button>
          </div>
        </form>
      </Card>

      <ErrorBanner error={error} />
      <SuccessBanner message={success} />

      {att.loading && <Loading label={t("computingAttainment")} />}
      {att.error && <ErrorBanner error={att.error} onRetry={att.reload} />}
      {data && !att.loading && (
        <div className="space-y-6">
          <p role="status" className="text-sm text-muted-foreground">
            {t.rich("studentsInScopeStudentsValues", { strong: (chunks) => <strong>{chunks}</strong>, students: data.students, k })}
          </p>

          {framework.mappingCount === 0 && (
            <EmptyState title={t("noEvidenceIsMappedTo")}>{t("aCareerAdminMapsEvidence")}</EmptyState>
          )}

          <Card title={t("attainmentHeatmapDirectMeasures")}>
            <ScrollArea>
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t("directAttainmentByOutcome")}{data.groups.length > 0 ? t("andGroup") : ""}{t("eachCellShowsTheLevel")}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="border border-border px-2 py-1 text-start">{t("outcome")}</th>
                    <th scope="col" className="border border-border px-2 py-1 text-end">{t("overallNStudents", { students: data.students })}</th>
                    {data.groups.map((g) => (
                      <th key={g.name} scope="col" className="border border-border px-2 py-1 text-end">{t("nameNStudents", { name: g.name, students: g.students })}</th>
                    ))}
                    <th scope="col" className="border border-border px-2 py-1 text-end">{t("indirectOverall")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.outcomes.map((o) => (
                    <tr key={o.code}>
                      <th scope="row" className="border border-border px-2 py-1 text-start font-normal">
                        <span className="font-semibold">{o.code}</span> <span className="text-muted-foreground">{o.title}</span>
                      </th>
                      <Cell v={o.directAttainment} suppressed={o.directSuppressed} k={k} />
                      {data.groups.map((g) => {
                        const go = g.outcomes.find((x) => x.code === o.code);
                        return <Cell key={g.name} v={go?.directAttainment ?? null} suppressed={go?.directSuppressed ?? false} k={k} />;
                      })}
                      <Cell v={o.indirectAttainment} suppressed={o.indirectSuppressed} k={k} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
            <p className="mt-2 text-xs text-muted-foreground">{t("bandsHighIs25")}</p>
          </Card>

          <Card title={t("evidenceByMeasure")}>
            <ScrollArea>
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t("eachEvidenceMeasureMappedTo")}</caption>
                <thead>
                  <tr>
                    {[t("colOutcome"), t("colMeasure"), t("colType"), t("colSource"), t("colWeight"), t("colTarget"), t("colThresholds321"), t("colAssessed"), t("colAtOrAboveTarget"), "%", t("colLevel")].map((h) => (
                      <th key={h} scope="col" className="border border-border px-2 py-1 text-start">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.outcomes.flatMap((o) =>
                    (o.mappings ?? []).map((m) => (
                      <tr key={m.mappingId}>
                        <th scope="row" className="border border-border px-2 py-1 text-start">{o.code}</th>
                        <td className="border border-border px-2 py-1">{m.sourceLabel}</td>
                        <td className="border border-border px-2 py-1">{m.direct ? <Badge tone="info">{t("direct")}</Badge> : <Badge>{t("indirect")}</Badge>}</td>
                        <td className="border border-border px-2 py-1">{m.sourceRefLabel}</td>
                        <td className="border border-border px-2 py-1 text-end">{m.weight}</td>
                        <td className="border border-border px-2 py-1 text-end">{m.targetScore}</td>
                        <td className="border border-border px-2 py-1 text-end">{m.level3}/{m.level2}/{m.level1}%</td>
                        <td className="border border-border px-2 py-1 text-end">{m.assessed}</td>
                        <td className="border border-border px-2 py-1 text-end">{m.suppressed ? `<${k}` : (m.atOrAboveTarget ?? "—")}</td>
                        <td className="border border-border px-2 py-1 text-end">{m.suppressed || m.percent === null ? "—" : `${m.percent}%`}</td>
                        <td className="border border-border px-2 py-1 text-end">{m.suppressed ? `<${k}` : (m.level ?? "—")}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </Card>

          <div className="space-y-2 text-xs text-muted-foreground">
            <p>{data.note}</p>
            <p>{data.framework.note}</p>
          </div>
        </div>
      )}
    </div>
  );
}
