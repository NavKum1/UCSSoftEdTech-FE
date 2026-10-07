"use client";

import React from "react";
import {
  Accessibility,
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Download,
  Gavel,
  HeartHandshake,
  Info,
  Scale,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { downloadJson, formatDate, formatPeriod, pct, type ShareRow, type TransparencyReport } from "@/lib/transparency";

interface Meta {
  id: string;
  status: string;
  publishedAt: string | null;
  notes: string | null;
}

const LABELS: Record<string, string> = {
  HighRisk: "High risk",
  Prohibited: "AI prohibited",
  Allowed: "AI allowed (logged)",
  Evaluated: "AI use evaluated",
  Greenfield: "Greenfield (new code)",
  Brownfield: "Brownfield (existing codebase)",
  AgentSupervision: "Agent supervision",
};

const label = (key: string) => LABELS[key] ?? key;

function hours(v: number | null) {
  if (v == null) return "—";
  return v < 48 ? `${v.toFixed(1)} h` : `${(v / 24).toFixed(1)} days`;
}

function Section({ icon, title, children, id }: { icon: React.ReactNode; title: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="glass-panel rounded-2xl border border-border p-5 sm:p-6 space-y-4">
      <h2 id={id} className="text-lg font-bold text-foreground flex items-center gap-2">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ title, value, hint }: { title: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-muted/40 border border-border px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{title}</div>
      <div className="text-xl font-bold text-foreground">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function Bar({ share }: { share: number | null }) {
  const width = share == null ? 0 : Math.max(0, Math.min(100, share * 100));
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden" aria-hidden="true">
      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${width}%` }} />
    </div>
  );
}

function ShareTable({ rows, keyHeader, caption, formatKey = label }: { rows: ShareRow[]; keyHeader: string; caption: string; formatKey?: (k: string) => string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No data for this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th scope="col" className="py-2 pr-3 font-semibold">{keyHeader}</th>
            <th scope="col" className="py-2 pr-3 font-semibold text-right">Count</th>
            <th scope="col" className="py-2 pr-3 font-semibold text-right">Share</th>
            <th scope="col" className="py-2 font-semibold w-1/3"><span className="sr-only">Bar</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border last:border-0 align-top">
              <th scope="row" className="py-2 pr-3 text-left font-normal text-foreground">
                <span className={/^[A-Z_]+$/.test(r.key) ? "font-mono text-xs" : ""}>{formatKey(r.key)}</span>
                {r.description && <div className="text-[11px] text-muted-foreground">{r.description}</div>}
              </th>
              <td className="py-2 pr-3 text-right text-foreground tabular-nums">{r.count}</td>
              <td className="py-2 pr-3 text-right text-foreground tabular-nums">{pct(r.share)}</td>
              <td className="py-2 pt-3.5"><Bar share={r.share} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Insufficient({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
      <Info className="w-3.5 h-3.5 shrink-0" /> {children}
    </span>
  );
}

export default function TransparencyReportView({ report, meta, draft = false }: { report: TransparencyReport; meta: Meta; draft?: boolean }) {
  const { headline, volume, integrity, appeals, validity, fairness, accessibility } = report;
  const oversight = integrity.oversight;

  return (
    <div className="space-y-6">
      {draft && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p>Preview of a <strong>{meta.status.toLowerCase()}</strong> report. It is not public unless it is published.</p>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Reporting period</p>
          <h2 className="text-2xl font-extrabold text-foreground">{formatPeriod(report.periodStart, report.periodEnd)}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {meta.publishedAt ? `Published ${formatDate(meta.publishedAt)}` : `Generated ${formatDate(report.generatedAt)}`} · Methodology v{report.methodologyVersion} · All dates UTC
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadJson(`transparency-report-${report.periodStart}-to-${report.periodEnd}.json`, { id: meta.id, status: meta.status, publishedAt: meta.publishedAt, notes: meta.notes, report })}
          className="py-2 px-3 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" /> Download JSON
        </button>
      </div>

      {meta.notes && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-foreground">
          <span className="font-semibold">Release notes: </span>
          {meta.notes}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat title="Candidates assessed" value={headline.candidatesAssessed} />
        <Stat title="Submissions" value={headline.submissions} />
        <Stat title="Voice defenses completed" value={headline.defensesCompleted} />
        <Stat title="Submissions with a human decision" value={pct(headline.humanDecisionShare)} />
        <Stat title="Flagged, yet advanced by a human" value={pct(headline.flaggedAdvancedShare)} hint="of decided Review / High-risk submissions" />
        <Stat title="Appeals filed" value={headline.appeals == null ? "Not yet available" : headline.appeals} />
      </div>

      <Section id="tr-volume" icon={<Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />} title="Volume">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat title="Timed attempts started" value={volume.attemptsStarted} />
          <Stat title="Completion rate" value={pct(volume.completionRate)} hint={`${volume.attemptsSubmitted} submitted`} />
          <Stat title="Submissions defended" value={pct(volume.defenseRate)} hint={`${volume.submissionsDefended} of ${volume.submissions}`} />
          <Stat title="Defense languages used" value={volume.defenseLanguagesUsed} hint={`${volume.sprintDefenses} sprint · ${volume.realWorkDefenses} real-work defenses`} />
        </div>
        {[
          { title: "By task type", rows: volume.byTaskType },
          { title: "By AI policy", rows: volume.byAiPolicy },
        ].map((t) => (
          <div key={t.title} className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="text-left text-xs font-semibold text-muted-foreground pb-1">{t.title}</caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th scope="col" className="py-2 pr-3 font-semibold">Category</th>
                  <th scope="col" className="py-2 pr-3 font-semibold text-right">Attempts started</th>
                  <th scope="col" className="py-2 pr-3 font-semibold text-right">Attempts submitted</th>
                  <th scope="col" className="py-2 pr-3 font-semibold text-right">Submissions</th>
                  <th scope="col" className="py-2 font-semibold text-right">Defended</th>
                </tr>
              </thead>
              <tbody>
                {t.rows.length === 0 ? (
                  <tr><td colSpan={5} className="py-2 text-muted-foreground">No activity in this period.</td></tr>
                ) : (
                  t.rows.map((r) => (
                    <tr key={r.key} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2 pr-3 text-left font-normal text-foreground">{label(r.key)}</th>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.attemptsStarted}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.attemptsSubmitted}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.submissions}</td>
                      <td className="py-2 text-right tabular-nums">{r.submissionsDefended}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ))}
      </Section>

      <Section id="tr-integrity" icon={<ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />} title="Integrity signals and human oversight">
        <p className="text-sm text-muted-foreground">
          Integrity signals are prompts for a reviewer to look closer, not verdicts. {integrity.analysedSubmissions} of {integrity.submissions} submissions had an integrity analysis.
        </p>
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-bold text-foreground mb-2">Integrity level</h3>
            <ShareTable rows={integrity.riskLevels} keyHeader="Level" caption="Distribution of integrity levels" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground mb-2">How often each signal appeared</h3>
            <ShareTable rows={integrity.signals} keyHeader="Signal" caption="Share of analysed submissions with each signal" formatKey={(k) => k} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat title="With a human decision" value={pct(oversight.humanDecisionShare)} hint={`${oversight.withHumanDecision} of ${oversight.submissions}`} />
          <Stat title="Flagged but advanced" value={pct(oversight.flaggedAdvancedShare)} hint={`${oversight.flaggedAdvanced} of ${oversight.flaggedDecided} decided flagged`} />
          <Stat title="Flagged submissions" value={oversight.flaggedSubmissions} hint="Review or High risk" />
          <Stat title="Median time to decision" value={hours(oversight.medianHoursToDecision)} hint={`${oversight.decisionTimesMeasured} decisions measured`} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-left text-xs font-semibold text-muted-foreground pb-1">Human decisions by integrity level (latest decision per submission)</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th scope="col" className="py-2 pr-3 font-semibold">Integrity level</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">Submissions</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">Decided</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">Advance</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">Hold</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">Decline</th>
                <th scope="col" className="py-2 font-semibold text-right">Advanced</th>
              </tr>
            </thead>
            <tbody>
              {oversight.byRiskLevel.map((r) => (
                <tr key={r.riskLevel} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-foreground">{label(r.riskLevel)}</th>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.submissions}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.decided}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.advance}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.hold}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.decline}</td>
                  <td className="py-2 text-right tabular-nums">{pct(r.advanceShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="tr-appeals" icon={<Gavel className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />} title="Appeals">
        {!appeals.available ? (
          <Insufficient>{appeals.statusText}</Insufficient>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat title="Appeals filed" value={appeals.total} hint={`${pct(appeals.appealRate)} of submissions`} />
              <Stat title="Resolved (upheld or overturned)" value={appeals.resolved} />
              <Stat title="Overturned" value={pct(appeals.overturnedShareOfResolved)} hint="of resolved appeals" />
              <Stat title="Median resolution time" value={hours(appeals.medianResolutionHours)} />
            </div>
            {appeals.total > 0 ? (
              <ShareTable rows={appeals.outcomes} keyHeader="Status" caption="Appeal outcomes" />
            ) : (
              <p className="text-sm text-muted-foreground">{appeals.statusText}</p>
            )}
          </>
        )}
      </Section>

      <Section id="tr-validity" icon={<TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />} title="Predictive validity">
        <p className="text-sm text-muted-foreground">
          Do scores track what happens after hiring? {validity.scope} Contributing employers: {validity.contributingEmployers}.
          {validity.enoughEmployers && ` ${validity.hiresWithOutcomes} hires with outcomes.`}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Correlations between assessment scores and post-hire outcomes</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th scope="col" className="py-2 pr-3 font-semibold">Predictor → outcome</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">n</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">r</th>
                <th scope="col" className="py-2 pr-3 font-semibold">95% CI</th>
                <th scope="col" className="py-2 font-semibold">Reading</th>
              </tr>
            </thead>
            <tbody>
              {validity.results.map((c) => (
                <tr key={`${c.predictor}-${c.outcome}`} className="border-b border-border last:border-0 align-top">
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-foreground">
                    {c.predictor} <span className="text-muted-foreground">→</span> {c.outcome}
                  </th>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.n}</td>
                  <td className="py-2 pr-3 text-right font-mono">{c.reported && c.r != null ? c.r.toFixed(2) : "—"}</td>
                  <td className="py-2 pr-3 font-mono whitespace-nowrap text-muted-foreground">
                    {c.reported && c.ciLow != null && c.ciHigh != null ? `[${c.ciLow.toFixed(2)}, ${c.ciHigh.toFixed(2)}]` : "—"}
                  </td>
                  <td className="py-2 text-xs">{c.reported ? <span className="text-muted-foreground">{c.summary}</span> : <Insufficient>{c.summary}</Insufficient>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {validity.caveat}</p>
      </Section>

      <Section id="tr-fairness" icon={<Scale className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />} title="Fairness by self-identified group">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat title="Candidates in scope" value={fairness.candidatesInScope} />
          <Stat title="Self-identified (voluntary)" value={pct(fairness.selfIdentifiedShare)} hint={`${fairness.selfIdentified} candidates`} />
          <Stat title="Median defense score" value={fairness.medianDefenseScore == null ? "—" : fairness.medianDefenseScore} hint="threshold for scoring rate" />
          <Stat title="Smallest group shown" value={fairness.minimumGroupSize} hint="smaller groups are suppressed" />
        </div>
        <p className="text-xs text-muted-foreground">
          Selection rate = share advanced by a human; scoring rate = share above the median defense score. Impact ratio = group rate ÷ highest group rate.
          Rows marked <span className="font-semibold text-rose-700 dark:text-rose-400">below 4/5</span> have a ratio under 0.80, a screening threshold that warrants investigation.
        </p>
        <div className="grid xl:grid-cols-2 gap-4">
          {fairness.categories.map((c) => (
            <div key={c.category} className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold text-foreground">{c.category}</h3>
                <span className="text-[11px] text-muted-foreground">
                  Disclosed by {pct(c.disclosureShare)} · {c.notReported} not reported{c.suppressedGroups > 0 ? ` (incl. ${c.suppressedGroups} suppressed group${c.suppressedGroups === 1 ? "" : "s"})` : ""}
                </span>
              </div>
              {c.groups.length === 0 ? (
                <Insufficient>No group reached {fairness.minimumGroupSize} candidates, so nothing is shown.</Insufficient>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <caption className="sr-only">{`Selection and scoring rates by ${c.category}`}</caption>
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th scope="col" className="py-1.5 pr-2 font-semibold">Group</th>
                        <th scope="col" className="py-1.5 pr-2 font-semibold text-right">n</th>
                        <th scope="col" className="py-1.5 pr-2 font-semibold text-right">Selection</th>
                        <th scope="col" className="py-1.5 pr-2 font-semibold text-right">Ratio</th>
                        <th scope="col" className="py-1.5 pr-2 font-semibold text-right">Scoring</th>
                        <th scope="col" className="py-1.5 font-semibold text-right">Ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.groups.map((g) => (
                        <tr key={g.group} className="border-b border-border last:border-0">
                          <th scope="row" className="py-1.5 pr-2 text-left font-normal text-foreground">{g.group}</th>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{g.candidates}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums" title={`${g.decided} with a decision`}>
                            {g.selectionRate == null ? <span className="text-muted-foreground">too few ({g.decided})</span> : pct(g.selectionRate)}
                          </td>
                          <td className={`py-1.5 pr-2 text-right tabular-nums ${g.selectionBelowFourFifths ? "text-rose-700 dark:text-rose-400 font-semibold" : ""}`}>
                            {g.selectionImpactRatio == null ? "—" : g.selectionImpactRatio.toFixed(2)}
                            {g.selectionBelowFourFifths && <span className="block text-[10px]">below 4/5</span>}
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums" title={`${g.scored} with a defense score`}>
                            {g.scoringRate == null ? <span className="text-muted-foreground">too few ({g.scored})</span> : pct(g.scoringRate)}
                          </td>
                          <td className={`py-1.5 text-right tabular-nums ${g.scoringBelowFourFifths ? "text-rose-700 dark:text-rose-400 font-semibold" : ""}`}>
                            {g.scoringImpactRatio == null ? "—" : g.scoringImpactRatio.toFixed(2)}
                            {g.scoringBelowFourFifths && <span className="block text-[10px]">below 4/5</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {fairness.notice}</p>
      </Section>

      <Section id="tr-accessibility" icon={<Accessibility className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />} title="Accessibility and voice">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat title="Defenses completed" value={accessibility.defensesCompleted} />
          <Stat
            title="Average voice minutes per defense"
            value={accessibility.averageVoiceMinutesPerDefense == null ? "—" : accessibility.averageVoiceMinutesPerDefense.toFixed(1)}
            hint={`${accessibility.defensesWithDuration} defenses with a recorded duration`}
          />
        </div>
        <ShareTable rows={accessibility.languages} keyHeader="Interview language" caption="Share of defenses per language" formatKey={(k) => k} />
      </Section>

      <Section id="tr-commitments" icon={<HeartHandshake className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />} title="Our commitments">
        <ul className="grid md:grid-cols-2 gap-3">
          {report.commitments.map((c) => (
            <li key={c.title} className="rounded-xl border border-border bg-muted/30 p-4">
              <h3 className="text-sm font-bold text-foreground">{c.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{c.text}</p>
              {c.note && <p className="mt-2"><Insufficient>{c.note}</Insufficient></p>}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="tr-methodology" icon={<BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />} title={`Methodology (version ${report.methodology.version})`}>
        <div className="space-y-2">
          {report.methodology.sections.map((s) => (
            <details key={s.title} className="group rounded-xl border border-border bg-muted/20">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground flex items-center justify-between gap-2">
                {s.title}
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <dl className="px-4 pb-4 space-y-2">
                {s.items.map((i) => (
                  <div key={i.metric}>
                    <dt className="text-xs font-semibold text-foreground">{i.metric}</dt>
                    <dd className="text-xs text-muted-foreground">{i.definition}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
        {report.limitations.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-foreground mb-1">Limitations</h3>
            <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
              {report.limitations.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </div>
        )}
      </Section>
    </div>
  );
}
