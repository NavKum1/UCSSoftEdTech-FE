"use client";

import React, { useEffect, useState } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { AlertCircle, AlertTriangle, CheckCircle2, Download, Info, Loader2, Scale, TrendingUp, UserCheck } from "lucide-react";

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
      setOutcomeMessage({ ok: false, text: "We couldn't reach the server while recording the outcome. Please check your connection and try again." });
    } finally {
      setSavingOutcome(false);
    }
  };

  const inputClass = "mt-1 w-full rounded-xl bg-card border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground";
  const selectClass = "px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground";
  const sprintSelect = (value: string, onChange: (v: string) => void) => (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All sprints</option>
      {sprints.map((s) => (
        <option key={s.sprintId} value={s.sprintId}>{s.title}</option>
      ))}
    </select>
  );

  const auditData = audit?.data;

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-border">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
          <Scale className="w-4 h-4" /> Validity &amp; fairness
        </div>
        <h1 className="text-2xl font-extrabold text-foreground mt-1">Predictive validity and bias audit data</h1>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
          Check whether assessment scores track on-the-job outcomes, and whether selection or scoring rates differ across
          self-identified groups. Demographic data is voluntary and only reported in aggregate.
        </p>
      </div>

      {/* Predictive validity */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Predictive validity
          </h2>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Sprint {sprintSelect(reportSprint, setReportSprint)}
          </label>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel rounded-2xl border border-border p-5 space-y-3">
            {reportLoading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading report...
              </div>
            ) : report?.error ? (
              <p className="text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {report.error}</p>
            ) : report?.data ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {report.data.hiresWithOutcomes} hire{report.data.hiresWithOutcomes === 1 ? "" : "s"} with recorded outcomes.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="py-2 pr-3 font-semibold">Predictor → outcome</th>
                        <th className="py-2 pr-3 font-semibold">n</th>
                        <th className="py-2 pr-3 font-semibold">Correlation (r)</th>
                        <th className="py-2 pr-3 font-semibold">95% CI</th>
                        <th className="py-2 font-semibold">Interpretation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.data.results.map((r) => (
                        <tr key={`${r.predictor}-${r.outcome}`} className="border-b border-border last:border-0 align-top">
                          <td className="py-2 pr-3 text-foreground">
                            {r.predictor} <span className="text-muted-foreground">→</span> {r.outcome}
                          </td>
                          <td className="py-2 pr-3 text-foreground">{r.n}</td>
                          <td className="py-2 pr-3 text-foreground font-mono">{r.correlation == null ? "—" : r.correlation.toFixed(2)}</td>
                          <td className="py-2 pr-3 text-muted-foreground font-mono whitespace-nowrap">
                            {r.confidenceInterval95 ? `[${r.confidenceInterval95[0].toFixed(2)}, ${r.confidenceInterval95[1].toFixed(2)}]` : "—"}
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">{r.interpretation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted-foreground flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {report.data.method}</p>
              </>
            ) : null}
          </div>

          <form onSubmit={recordOutcome} className="glass-panel rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><UserCheck className="w-4 h-4" /> Record a hiring outcome</h3>
            <p className="text-[11px] text-muted-foreground">Linked to the candidate&apos;s most recent submission.</p>
            <label className="block text-xs font-semibold text-foreground">
              Candidate email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="candidate@example.com" className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <input type="checkbox" checked={hired} onChange={(e) => setHired(e.target.checked)} /> Hired
            </label>
            {hired && (
              <>
                <label className="block text-xs font-semibold text-foreground">
                  Manager performance rating
                  <select value={rating} onChange={(e) => setRating(e.target.value)} className={inputClass}>
                    <option value="">Not yet available</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}{n === 1 ? " (lowest)" : n === 5 ? " (highest)" : ""}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-foreground">
                  Retained after 90 days
                  <select value={retained} onChange={(e) => setRetained(e.target.value)} className={inputClass}>
                    <option value="">Not yet known</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </>
            )}
            {outcomeMessage && (
              <p className={`text-xs flex items-center gap-1.5 ${outcomeMessage.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                {outcomeMessage.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />} {outcomeMessage.text}
              </p>
            )}
            <button
              type="submit"
              disabled={savingOutcome || !email.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              {savingOutcome && <Loader2 className="w-4 h-4 animate-spin" />} Save outcome
            </button>
          </form>
        </div>
      </section>

      {/* Bias audit */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Bias audit data
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">Sprint {sprintSelect(auditSprint, setAuditSprint)}</label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              From <input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} className={selectClass} />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              To <input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} className={selectClass} />
            </label>
            <button
              onClick={() => auditData && downloadBiasCsv(auditData)}
              disabled={!auditData || auditLoading}
              className="py-2 px-3 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Download CSV
            </button>
          </div>
        </div>

        {auditData && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-foreground flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p>{auditData.notice}</p>
          </div>
        )}

        {auditLoading ? (
          <div className="glass-panel rounded-2xl border border-border py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading bias audit data...
          </div>
        ) : audit?.error ? (
          <div className="glass-panel rounded-2xl border border-border p-6 text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {audit.error}
          </div>
        ) : auditData ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-muted/40 border border-border px-3 py-2">
                <div className="text-[11px] text-muted-foreground">Candidates in scope</div>
                <div className="text-lg font-bold text-foreground">{auditData.candidatesInScope}</div>
              </div>
              <div className="rounded-xl bg-muted/40 border border-border px-3 py-2">
                <div className="text-[11px] text-muted-foreground">Self-identified (voluntary)</div>
                <div className="text-lg font-bold text-foreground">{auditData.selfIdentified}</div>
              </div>
              <div className="rounded-xl bg-muted/40 border border-border px-3 py-2">
                <div className="text-[11px] text-muted-foreground">Median defense score</div>
                <div className="text-lg font-bold text-foreground">{auditData.medianDefenseScore == null ? "—" : Math.round(auditData.medianDefenseScore)}</div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {auditData.categories.map((c) => (
                <div key={c.category} className="glass-panel rounded-2xl border border-border p-4 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-bold text-foreground">{c.category}</h3>
                    <span className="text-[11px] text-muted-foreground">{c.undisclosed} not disclosed</span>
                  </div>
                  {c.groups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No self-identification data in this category.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="py-1.5 pr-2 font-semibold">Group</th>
                            <th className="py-1.5 pr-2 font-semibold">n</th>
                            <th className="py-1.5 pr-2 font-semibold">Selection rate</th>
                            <th className="py-1.5 pr-2 font-semibold">Impact ratio</th>
                            <th className="py-1.5 pr-2 font-semibold">Scoring rate</th>
                            <th className="py-1.5 font-semibold">Impact ratio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.groups.map((g) => (
                            <tr
                              key={g.group}
                              className={`border-b border-border last:border-0 ${g.belowFourFifths ? "bg-rose-500/10" : ""}`}
                            >
                              <td className="py-1.5 pr-2 text-foreground">
                                {g.group}
                                {g.belowFourFifths && (
                                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                                    <AlertTriangle className="w-3 h-3" /> below 0.80
                                  </span>
                                )}
                              </td>
                              {g.suppressed ? (
                                <td colSpan={5} className="py-1.5 text-muted-foreground italic">Suppressed (fewer than 5 candidates)</td>
                              ) : (
                                <>
                                  <td className="py-1.5 pr-2 text-foreground">{g.candidates ?? "—"}</td>
                                  <td className="py-1.5 pr-2 text-foreground">{rate(g.selectionRate)}</td>
                                  <td className={`py-1.5 pr-2 font-mono ${g.selectionImpactRatio != null && g.selectionImpactRatio < 0.8 ? "text-rose-700 dark:text-rose-400 font-bold" : "text-foreground"}`}>
                                    {ratio(g.selectionImpactRatio)}
                                  </td>
                                  <td className="py-1.5 pr-2 text-foreground">{rate(g.scoringRate)}</td>
                                  <td className={`py-1.5 font-mono ${g.scoringImpactRatio != null && g.scoringImpactRatio < 0.8 ? "text-rose-700 dark:text-rose-400 font-bold" : "text-foreground"}`}>
                                    {ratio(g.scoringImpactRatio)}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="glass-panel rounded-2xl border border-border p-4">
              <h3 className="text-sm font-bold text-foreground mb-2">Definitions</h3>
              <dl className="grid sm:grid-cols-2 gap-3 text-xs">
                <div><dt className="font-semibold text-foreground">Selection rate</dt><dd className="text-muted-foreground">{auditData.definitions.selectionRate}</dd></div>
                <div><dt className="font-semibold text-foreground">Scoring rate</dt><dd className="text-muted-foreground">{auditData.definitions.scoringRate}</dd></div>
                <div><dt className="font-semibold text-foreground">Impact ratio</dt><dd className="text-muted-foreground">{auditData.definitions.impactRatio}</dd></div>
                <div><dt className="font-semibold text-foreground">Suppression</dt><dd className="text-muted-foreground">{auditData.definitions.suppression}</dd></div>
              </dl>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
