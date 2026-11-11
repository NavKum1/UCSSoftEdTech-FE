"use client";

import React, { useEffect, useState } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { AlertCircle, AlertTriangle, CheckCircle2, Download, Info, Loader2 } from "lucide-react";
import { Button, PageHeader, ScrollArea, StatTile } from "@/components/career/ui";
import { useEn } from "@/lib/english/EnglishProvider";

interface ValidityResult {
  predictor: string;
  outcome: string;
  n: number;
  correlation: number | null;
  confidenceInterval95: [number, number] | null;
  interpretation: string;
}

interface ValidityReport {
  hiresWithOutcomes: number;
  results: ValidityResult[];
  method: string;
}

interface BiasGroup {
  group: string;
  candidates: number | null;
  selectionRate: number | null;
  selectionImpactRatio: number | null;
  scoringRate: number | null;
  scoringImpactRatio: number | null;
  belowFourFifths: boolean;
  suppressed: boolean;
}

interface BiasCategory {
  category: string;
  undisclosed: number;
  groups: BiasGroup[];
}

interface BiasAudit {
  candidatesInScope: number;
  selfIdentified: number;
  medianDefenseScore: number | null;
  definitions: { selectionRate: string; scoringRate: string; impactRatio: string; suppression: string };
  categories: BiasCategory[];
  notice: string;
}

interface SprintOption {
  sprintId: string;
  title: string;
}

interface Loaded<T> {
  key: string;
  data: T | null;
  error: string | null;
}

async function fetchJson<T>(path: string, getToken: () => Promise<string | null>, what: string): Promise<T> {
  const res = await authenticatedFetch(path, {}, getToken);
  if (res.status === 401 || res.status === 403) throw new Error(`You need recruiter access to view the ${what}.`);
  if (!res.ok) throw new Error(`Could not load the ${what}. Please try again.`);
  return (await res.json()) as T;
}

function rate(v: number | null) {
  return v == null ? "—" : `${(v * 100).toFixed(1)}%`;
}

function ratio(v: number | null) {
  return v == null ? "—" : v.toFixed(2);
}

function csvCell(v: string | number | boolean | null) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadBiasCsv(audit: BiasAudit) {
  const header = ["Category", "Group", "Candidates", "Selection rate", "Selection impact ratio", "Scoring rate", "Scoring impact ratio", "Below four-fifths", "Suppressed"];
  const lines = [header.join(",")];
  for (const c of audit.categories) {
    for (const g of c.groups) {
      lines.push(
        [c.category, g.group, g.candidates, g.selectionRate, g.selectionImpactRatio, g.scoringRate, g.scoringImpactRatio, g.belowFourFifths, g.suppressed]
          .map(csvCell)
          .join(",")
      );
    }
    lines.push([c.category, "(not disclosed)", c.undisclosed, "", "", "", "", "", ""].map(csvCell).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bias-audit-data-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ValidityPage() {
  const en = useEn();
  const { getToken } = useAuth();

  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [reportSprint, setReportSprint] = useState("");
  const [reportVersion, setReportVersion] = useState(0);
  const [report, setReport] = useState<Loaded<ValidityReport> | null>(null);

  const [auditSprint, setAuditSprint] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [audit, setAudit] = useState<Loaded<BiasAudit> | null>(null);

  const [email, setEmail] = useState("");
  const [hired, setHired] = useState(true);
  const [rating, setRating] = useState("");
  const [retained, setRetained] = useState("");
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [outcomeMessage, setOutcomeMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetchJson<{ sprints: SprintOption[] }>("/api/sprint", getToken, "sprints")
      .then((d) => active && setSprints(d.sprints ?? []))
      .catch(() => {
        // Sprint filter is optional; fall back to "All sprints"
      });
    return () => {
      active = false;
    };
  }, [getToken]);

  const reportKey = `${reportSprint}|${reportVersion}`;
  useEffect(() => {
    let active = true;
    const qs = reportSprint ? `?sprintId=${encodeURIComponent(reportSprint)}` : "";
    fetchJson<ValidityReport>(`/api/validity/report${qs}`, getToken, "validity report")
      .then((data) => active && setReport({ key: reportKey, data, error: null }))
      .catch((e) => active && setReport({ key: reportKey, data: null, error: e instanceof Error ? e.message : "Could not load the report." }));
    return () => {
      active = false;
    };
  }, [getToken, reportSprint, reportKey]);

  const auditKey = `${auditSprint}|${auditFrom}|${auditTo}`;
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (auditSprint) params.set("sprintId", auditSprint);
    if (auditFrom) params.set("from", `${auditFrom}T00:00:00`);
    if (auditTo) params.set("to", `${auditTo}T23:59:59`);
    const qs = params.toString() ? `?${params}` : "";
    fetchJson<BiasAudit>(`/api/validity/bias-audit${qs}`, getToken, "bias audit data")
      .then((data) => active && setAudit({ key: auditKey, data, error: null }))
      .catch((e) => active && setAudit({ key: auditKey, data: null, error: e instanceof Error ? e.message : "Could not load the bias audit." }));
    return () => {
      active = false;
    };
  }, [getToken, auditSprint, auditFrom, auditTo, auditKey]);

  const reportLoading = report?.key !== reportKey;
  const auditLoading = audit?.key !== auditKey;

  const recordOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSavingOutcome(true);
    setOutcomeMessage(null);
    try {
      const res = await authenticatedFetch(
        "/api/validity/outcomes",
        {
          method: "POST",
          body: JSON.stringify({
            candidateEmail: email.trim(),
            hired,
            performanceRating: hired && rating ? Number(rating) : null,
            retained90Days: hired && retained ? retained === "yes" : null,
          }),
        },
        getToken
      );
      if (!res.ok) {
        let text = `Could not record the outcome. Please try again.`;
        try {
          const body = await res.json();
          if (body?.error) text = body.error;
        } catch {
          // non-JSON body
        }
        setOutcomeMessage({ ok: false, text });
        return;
      }
      setOutcomeMessage({ ok: true, text: `Outcome recorded for ${email.trim()}.` });
      setEmail("");
      setRating("");
      setRetained("");
      setReportVersion((v) => v + 1);
    } catch {
      setOutcomeMessage({ ok: false, text: en("We couldn't reach Edulexa while recording the outcome. Please check your connection and try again.") });
    } finally {
      setSavingOutcome(false);
    }
  };

  const inputClass = "mt-1 w-full rounded-lg bg-card border border-border px-3 py-2 text-sm font-normal text-foreground shadow-sm placeholder:text-muted-foreground";
  const selectClass = "px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground shadow-sm";
  const sprintSelect = (value: string, onChange: (v: string) => void) => (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{en("All sprints")}</option>
      {sprints.map((s) => (
        <option key={s.sprintId} value={s.sprintId}>{s.title}</option>
      ))}
    </select>
  );

  const auditData = audit?.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title={en("Predictive validity and bias audit data")}
        description={en("Check whether assessment scores track on-the-job outcomes, and whether selection or scoring rates differ across self-identified groups. Demographic data is voluntary and only reported in aggregate.")}
      />

      {/* Predictive validity */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{en("Predictive validity")}</h2>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {en("Sprint ")}{sprintSelect(reportSprint, setReportSprint)}
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="min-w-0 lg:col-span-2 rounded-xl border border-border bg-card shadow-sm p-5 space-y-3">
            {reportLoading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />{en("Loading report...")}
              </div>
            ) : report?.error ? (
              <p role="alert" className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" aria-hidden /> {report.error}</p>
            ) : report?.data ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {en("{hiresWithOutcomes} hire{value} with recorded outcomes.", { hiresWithOutcomes: report.data.hiresWithOutcomes, value: report.data.hiresWithOutcomes === 1 ? "" : "s" })}
                </p>
                <ScrollArea>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-start text-xs text-muted-foreground border-b border-border">
                        <th className="py-2 pe-3 text-start font-medium">{en("Predictor → outcome")}</th>
                        <th className="py-2 pe-3 text-start font-medium">n</th>
                        <th className="py-2 pe-3 text-start font-medium">{en("Correlation (r)")}</th>
                        <th className="py-2 pe-3 text-start font-medium">{en("95% CI")}</th>
                        <th className="py-2 text-start font-medium">{en("Interpretation")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.data.results.map((r) => (
                        <tr key={`${r.predictor}-${r.outcome}`} className="border-b border-border last:border-0 align-top">
                          <td className="py-2 pe-3 text-foreground">
                            {r.predictor} <span className="text-muted-foreground">→</span> {r.outcome}
                          </td>
                          <td className="py-2 pe-3 text-foreground">{r.n}</td>
                          <td className="py-2 pe-3 text-foreground tabular-nums">{r.correlation == null ? "—" : r.correlation.toFixed(2)}</td>
                          <td className="py-2 pe-3 text-muted-foreground tabular-nums whitespace-nowrap">
                            {r.confidenceInterval95 ? `[${r.confidenceInterval95[0].toFixed(2)}, ${r.confidenceInterval95[1].toFixed(2)}]` : "—"}
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">{r.interpretation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
                <p className="text-xs text-muted-foreground flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden /> {report.data.method}</p>
              </>
            ) : null}
          </div>

          <form onSubmit={recordOutcome} className="min-w-0 rounded-xl border border-border bg-card shadow-sm p-5 space-y-3">
            <h3 className="text-base font-semibold text-foreground">{en("Record a hiring outcome")}</h3>
            <p className="text-sm text-muted-foreground">{en("Linked to the candidate's most recent submission.")}</p>
            <label className="block text-sm font-medium text-foreground">
              {en("Candidate email")}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={en("candidate@example.com")} className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input type="checkbox" checked={hired} onChange={(e) => setHired(e.target.checked)} />{en("Hired")}
            </label>
            {hired && (
              <>
                <label className="block text-sm font-medium text-foreground">
                  {en("Manager performance rating")}
                  <select value={rating} onChange={(e) => setRating(e.target.value)} className={inputClass}>
                    <option value="">{en("Not yet available")}</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}{n === 1 ? en(" (lowest)") : n === 5 ? en(" (highest)") : ""}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-foreground">
                  {en("Retained after 90 days")}
                  <select value={retained} onChange={(e) => setRetained(e.target.value)} className={inputClass}>
                    <option value="">{en("Not yet known")}</option>
                    <option value="yes">{en("Yes")}</option>
                    <option value="no">{en("No")}</option>
                  </select>
                </label>
              </>
            )}
            {outcomeMessage && (
              <p role="status" className={`text-sm flex items-center gap-1.5 ${outcomeMessage.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                {outcomeMessage.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden /> : <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />} {outcomeMessage.text}
              </p>
            )}
            <Button type="submit" busy={savingOutcome} disabled={!email.trim()} className="w-full">
              {en("Save outcome")}
            </Button>
          </form>
        </div>
      </section>

      {/* Bias audit */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{en("Bias audit data")}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">{en("Sprint ")}{sprintSelect(auditSprint, setAuditSprint)}</label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {en("From ")}<input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} className={selectClass} />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {en("To ")}<input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} className={selectClass} />
            </label>
            <Button variant="secondary" onClick={() => auditData && downloadBiasCsv(auditData)} disabled={!auditData || auditLoading}>
              <Download className="w-4 h-4" aria-hidden />{en("Download spreadsheet (CSV)")}
            </Button>
          </div>
        </div>

        {auditData && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 text-sm text-foreground flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden />
            <p>{auditData.notice}</p>
          </div>
        )}

        {auditLoading ? (
          <div className="rounded-xl border border-border bg-card shadow-sm py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />{en("Loading bias audit data...")}
          </div>
        ) : audit?.error ? (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden /> {audit.error}
          </div>
        ) : auditData ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatTile label={en("Candidates in scope")} value={auditData.candidatesInScope} />
              <StatTile label={en("Self-identified (voluntary)")} value={auditData.selfIdentified} />
              <StatTile label={en("Median defense score")} value={auditData.medianDefenseScore == null ? "—" : Math.round(auditData.medianDefenseScore)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {auditData.categories.map((c) => (
                <div key={c.category} className="min-w-0 rounded-xl border border-border bg-card shadow-sm p-4 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground">{c.category}</h3>
                    <span className="text-xs text-muted-foreground">{en("{undisclosed} not disclosed", { undisclosed: c.undisclosed })}</span>
                  </div>
                  {c.groups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{en("No self-identification data in this category.")}</p>
                  ) : (
                    <ScrollArea>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-start text-muted-foreground border-b border-border">
                            <th className="py-1.5 pe-2 text-start font-medium">{en("Group")}</th>
                            <th className="py-1.5 pe-2 text-start font-medium">n</th>
                            <th className="py-1.5 pe-2 text-start font-medium">{en("Selection rate")}</th>
                            <th className="py-1.5 pe-2 text-start font-medium">{en("Impact ratio")}</th>
                            <th className="py-1.5 pe-2 text-start font-medium">{en("Scoring rate")}</th>
                            <th className="py-1.5 text-start font-medium">{en("Impact ratio")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.groups.map((g) => (
                            <tr
                              key={g.group}
                              className={`border-b border-border last:border-0 ${g.belowFourFifths ? "bg-red-50 dark:bg-red-950/30" : ""}`}
                            >
                              <td className="py-1.5 pe-2 text-foreground">
                                {g.group}
                                {g.belowFourFifths && (
                                  <span className="ms-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                                    <AlertTriangle className="w-3 h-3" aria-hidden />{en("below 0.80")}
                                  </span>
                                )}
                              </td>
                              {g.suppressed ? (
                                <td colSpan={5} className="py-1.5 text-muted-foreground italic">{en("Suppressed (fewer than 5 candidates)")}</td>
                              ) : (
                                <>
                                  <td className="py-1.5 pe-2 text-foreground">{g.candidates ?? "—"}</td>
                                  <td className="py-1.5 pe-2 text-foreground">{rate(g.selectionRate)}</td>
                                  <td className={`py-1.5 pe-2 tabular-nums ${g.selectionImpactRatio != null && g.selectionImpactRatio < 0.8 ? "text-red-700 dark:text-red-400 font-semibold" : "text-foreground"}`}>
                                    {ratio(g.selectionImpactRatio)}
                                  </td>
                                  <td className="py-1.5 pe-2 text-foreground">{rate(g.scoringRate)}</td>
                                  <td className={`py-1.5 tabular-nums ${g.scoringImpactRatio != null && g.scoringImpactRatio < 0.8 ? "text-red-700 dark:text-red-400 font-semibold" : "text-foreground"}`}>
                                    {ratio(g.scoringImpactRatio)}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm p-4">
              <h3 className="text-base font-semibold text-foreground mb-2">{en("Definitions")}</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><dt className="font-medium text-foreground">{en("Selection rate")}</dt><dd className="text-muted-foreground">{auditData.definitions.selectionRate}</dd></div>
                <div><dt className="font-medium text-foreground">{en("Scoring rate")}</dt><dd className="text-muted-foreground">{auditData.definitions.scoringRate}</dd></div>
                <div><dt className="font-medium text-foreground">{en("Impact ratio")}</dt><dd className="text-muted-foreground">{auditData.definitions.impactRatio}</dd></div>
                <div><dt className="font-medium text-foreground">{en("Suppression")}</dt><dd className="text-muted-foreground">{auditData.definitions.suppression}</dd></div>
              </dl>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
