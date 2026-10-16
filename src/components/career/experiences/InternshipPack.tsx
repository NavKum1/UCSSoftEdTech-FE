"use client";

/**
 * G2 country internship packs (India: UGC/AICTE first) on top of C9 internships for credit:
 * - PackSettingsPanel: the career center picks a pack, reviews its sourced rules, overrides values, links programs to
 *   hour rules and downloads the regulator exports.
 * - PackExperienceCard: per internship, for students, career-center staff and faculty: hours progress against the
 *   requirement, checklist, stipend/insurance, the logbook (supervisor sign-off happens on the signed-link page),
 *   faculty logbook review and rubric evaluation, NOC, logbook and completion-certificate PDFs.
 * Brand-neutral. English strings are kept together per component so they can move to messages/career later (G1).
 */

import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useLoad, useCareerT, useCareerLabels } from "@/components/career/ui";
import { downloadWith, type Api } from "@/components/career/experiences/shared";
import type { CareerTranslator } from "@/components/career/i18n/CareerI18nProvider";

// ----------------------------------------------------------------- types (mirror the API)

export interface PackSource {
  id: string;
  title: string;
  issuer: string;
  url: string;
  date: string;
  status: string;
  note?: string | null;
}

export interface HourRule {
  key: string;
  label: string;
  regulator: string;
  programmeType: string;
  minHours: number;
  maxHours?: number | null;
  minCredits?: number | null;
  maxCredits?: number | null;
  hoursPerCredit?: number | null;
  timing: string;
  mandatory: boolean;
  status: string;
  sources: string[];
  note?: string | null;
  overridden?: boolean;
}

interface PackDocument {
  key: string;
  name: string;
  stage: string;
  issuer: string;
  required: boolean;
  templateKey?: string | null;
  status: string;
  sources: string[];
  note?: string | null;
}

interface Criterion {
  key: string;
  text: string;
  weight: number;
  type: string;
}

interface PackEvaluation {
  key: string;
  kind: string;
  title: string;
  scaleMax: number;
  criteria: Criterion[];
  status: string;
  sources: string[];
  note?: string | null;
}

interface LogField {
  key: "tasks" | "learning" | "challenges" | "nextPlan";
  label: string;
  required: boolean;
  maxLength: number;
}

interface Flags {
  stipendTracked: boolean;
  insuranceRequired: boolean;
  currency: string;
  internshipTypes: string[];
  stipendNote: string;
  insuranceNote: string;
  sources: string[];
}

interface PackDefinition {
  key: string;
  version: string;
  country: string;
  countryName: string;
  regulators: string[];
  title: string;
  summary: string;
  reviewedOn: string;
  hourRules: HourRule[];
  documents: PackDocument[];
  logbook: { frequency: string; allowedFrequencies: string[]; supervisorSignOff: boolean; facultyReview: boolean; fields: LogField[]; status: string; sources: string[]; note?: string | null };
  supervisorEvaluation: PackEvaluation;
  facultyEvaluation: PackEvaluation;
  supervisorWeight: number;
  facultyWeight: number;
  flags: Flags;
  templates: { key: string; title: string; text: string; status: string; note: string }[];
  exports: { key: string; title: string; description: string; status: string; sources: string[] }[];
  sources: PackSource[];
  reflectionPrompts: string[];
  notes: string[];
}

interface Overrides {
  hourRules?: Record<string, { minHours?: number | null; maxHours?: number | null; minCredits?: number | null; maxCredits?: number | null; hoursPerCredit?: number | null }> | null;
  documents?: Record<string, { required?: boolean | null; name?: string | null }> | null;
  templates?: Record<string, string> | null;
  logbookFrequency?: string | null;
  stipendTracked?: boolean | null;
  insuranceRequired?: boolean | null;
  supervisorWeight?: number | null;
  facultyWeight?: number | null;
  facultyRubric?: { key?: string; text: string; weight: number }[] | null;
  certificateSignatory?: string | null;
  certificateSignatoryTitle?: string | null;
}

interface PackSettings {
  selected: { key: string; reviewedVersion?: string | null; latestVersion: string; newVersionAvailable: boolean; updatedAt?: string | null } | null;
  effective: PackDefinition | null;
  overrides: Overrides;
  programs: { id: string; code: string; title: string; creditHours: number; requiredHours: number; active: boolean; ruleKey?: string | null; belowMinimum: boolean }[];
  catalog: { key: string; version: string; countryName: string; regulators: string[]; title: string; summary: string; unconfirmed: number }[];
  canEdit: boolean;
}

interface LogWeek {
  hourLogId: string;
  weekStart: string;
  hours: number;
  status: string;
  decisionNote?: string | null;
  days: { date: string; hours: number; activity?: string | null }[];
  tasks?: string | null;
  learning?: string | null;
  challenges?: string | null;
  nextPlan?: string | null;
  supervisorSignedName?: string | null;
  supervisorSignedAt?: string | null;
  facultyStatus: string;
  facultyNote?: string | null;
  facultyReviewedAt?: string | null;
}

export interface PackView {
  pack: { key: string; version: string; title: string; country: string; countryName: string; regulators: string[]; frozen: boolean } | null;
  rule?: HourRule | null;
  program?: { id: string; code: string; title: string; requiredHours: number; creditHours: number };
  progress?: { required: number; supervisorApproved: number; facultyVerified: number; pending: number; returned: number; creditEquivalent?: number | null; meetsRequirement: boolean; belowRegulatorMinimum: boolean };
  evaluation?: {
    supervisorPercent?: number | null;
    facultyPercent?: number | null;
    combinedPercent?: number | null;
    supervisorWeight: number;
    facultyWeight: number;
    facultyForm: PackEvaluation;
    faculty?: { criteria: Criterion[]; scores: Record<string, number>; weightedPercent: number; comments?: string | null; evaluatorName: string; submittedAt: string; updatedAt: string } | null;
    canSubmitFaculty: boolean;
  };
  logbook?: { frequency: string; fields: LogField[]; status: string; note?: string | null; canLog: boolean; canReview: boolean; weeks: LogWeek[] };
  details?: { internshipType?: string | null; stipendPaid?: boolean | null; stipendMonthly?: number | null; stipendCurrency?: string | null; insuranceCovered?: boolean | null; insuranceProvider?: string | null; insurancePolicyNumber?: string | null; canEdit: boolean };
  flags?: Flags;
  documents?: (PackDocument & { done: boolean; generated: boolean })[];
  checklist?: { key: string; label: string; done: boolean; note?: string | null }[];
  noc?: { available: boolean; name?: string | null; issuedAt?: string | null; canIssue: boolean };
  certificate?: { eligible: boolean; number?: string | null; issuedAt?: string | null; sha256?: string | null; canIssue: boolean; reason?: string | null };
  sources?: PackSource[];
}

export type PackScope = "mine" | "staff" | "faculty";

const BASE = "/api/career/experiences/pack";

// ----------------------------------------------------------------- small pieces

// Labels: messages internshipPack.sourceStatus.<status>
const STATUS_TONE: Record<string, "good" | "warn" | "info" | "neutral"> = { Verified: "good", Secondary: "warn", Unconfirmed: "warn", Template: "info" };

function SourceStatus({ status }: { status: string }) {
  const tr = useCareerT("internshipPack");
  const s = STATUS_TONE[status] ? { label: tr(`sourceStatus.${status}`), tone: STATUS_TONE[status] } : { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

function SourceLinks({ ids, sources }: { ids: string[]; sources: PackSource[] }) {
  const tr = useCareerT("internshipPack");
  if (!ids.length) return null;
  return (
    <span className="text-xs">
      {tr("sources")}{" "}
      {ids.map((id, i) => {
        const s = sources.find((x) => x.id === id);
        return (
          <React.Fragment key={id}>
            {i > 0 && ", "}
            {s ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                {s.issuer.replace(/ \(.*\)$/, "")}: {s.title}
                <span className="sr-only">{" "}{tr("opensInANewTab")}</span>
              </a>
            ) : (
              id
            )}
          </React.Fragment>
        );
      })}
    </span>
  );
}

const hoursText = (r: HourRule, tr: CareerTranslator) => (r.maxHours && r.maxHours !== r.minHours ? tr("hoursRange", { min: r.minHours, max: r.maxHours }) : tr("hoursValue", { n: r.minHours }));
const creditsText = (r: HourRule, tr: CareerTranslator) =>
  r.minCredits == null ? "—" : r.maxCredits && r.maxCredits !== r.minCredits ? tr("creditsRange", { min: r.minCredits, max: r.maxCredits }) : tr("creditsValue", { n: r.minCredits });

/** Progress toward the required hours: a visual bar plus the same information as text (not colour-only). */
function HoursProgress({ p }: { p: NonNullable<PackView["progress"]> }) {
  const tr = useCareerT("internshipPack");
  const pct = p.required > 0 ? Math.min(100, Math.round((p.facultyVerified / p.required) * 100)) : 100;
  const supPct = p.required > 0 ? Math.min(100, Math.round((p.supervisorApproved / p.required) * 100)) : 100;
  return (
    <div>
      <p className="text-sm">
        {tr.rich("facultyVerifiedOfRequiredRequiredHours", { strong: (chunks) => <strong>{chunks}</strong>, facultyVerified: p.facultyVerified, required: p.required, pct, supervisorApproved: p.supervisorApproved })}
        {p.pending ? tr("waitingForTheSupervisorPending", { pending: p.pending }) : ""}
        {p.returned ? tr("returnedForCorrectionReturned", { returned: p.returned }) : ""}.
        {p.creditEquivalent != null && tr("creditEquivalentCreditEquivalent", { creditEquivalent: p.creditEquivalent })}
      </p>
      <div className="relative mt-2 h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="absolute inset-y-0 start-0 bg-[var(--brand,#4f46e5)] opacity-40" style={{ width: `${supPct}%` }} />
        <div className="absolute inset-y-0 start-0 bg-[var(--brand,#4f46e5)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{tr("darkBarVerifiedByFaculty")}</p>
      {p.meetsRequirement && <p className="mt-1 text-sm font-medium">{tr("theHourRequirementIsMet")}</p>}
      {p.belowRegulatorMinimum && <p className="mt-1 text-sm font-medium">{tr("thisProgramsRequiredHoursAre")}</p>}
    </div>
  );
}

// ----------------------------------------------------------------- per-internship card

export function PackExperienceCard({ api, scope, experienceId, onLoaded, onChanged }: { api: Api; scope: PackScope; experienceId: string; onLoaded?: (v: PackView) => void; onChanged?: () => void }) {
  const tr = useCareerT("internshipPack");
  const view = useLoad(() => api<PackView>(`${BASE}/${scope}/${experienceId}`), [api, scope, experienceId]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const v = view.data;

  useEffect(() => {
    if (v && onLoaded) onLoaded(v);
  }, [v, onLoaded]);

  const act = async (fn: () => Promise<PackView>, success: string) => {
    setErr(null);
    setMsg(null);
    try {
      view.setData(await fn());
      setMsg(success);
      onChanged?.();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const download = (file: string, name: string) => downloadWith(api, `${BASE}/${scope}/${experienceId}/${file}`, name, tr("downloadFailed")).catch((e) => setErr(e.message));

  if (view.loading && !v) return <Loading />;
  if (!v) return <ErrorBanner error={view.error} onRetry={view.reload} />;
  if (!v.pack) return null;
  const staffLike = scope !== "mine";

  return (
    <Card title={tr("internshipRequirementsTitle", { title: v.pack.title })}>
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        {tr("countryNamePackVersionVersion", { countryName: v.pack.countryName, version: v.pack.version })}
        {v.pack.frozen ? tr("fixedForThisInternship") : ""}. {v.rule ? `${v.rule.label}: ${hoursText(v.rule, tr)}, ${creditsText(v.rule, tr)}${v.rule.hoursPerCredit ? tr("atHoursPerCreditHoursPerCredit", { hoursPerCredit: v.rule.hoursPerCredit }) : ""}; ${v.rule.timing}.` : tr("thisProgramIsntLinkedTo")}
      </p>
      {v.progress && <HoursProgress p={v.progress} />}

      <section className="mt-6" aria-labelledby={`pack-check-${experienceId}`}>
        <h3 id={`pack-check-${experienceId}`} className="text-sm font-semibold">
          {tr("checklist")}
        </h3>
        <ul className="mt-2 space-y-1 text-sm">
          {v.checklist?.map((c) => (
            <li key={c.key} className="flex flex-wrap items-baseline gap-2">
              <span aria-hidden>{c.done ? "✓" : "○"}</span>
              <span>
                {c.label}
                <span className="sr-only">{c.done ? tr("done") : tr("toDo")}</span>
              </span>
              {c.note && <span className="text-xs text-muted-foreground">{c.note}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6" aria-labelledby={`pack-docs-${experienceId}`}>
        <h3 id={`pack-docs-${experienceId}`} className="text-sm font-semibold">
          {tr("documents")}
        </h3>
        <ul className="mt-2 space-y-1 text-sm">
          {v.documents?.map((d) => (
            <li key={d.key}>
              <span aria-hidden>{d.done ? "✓ " : "○ "}</span>
              {d.name}
              <span className="text-xs text-muted-foreground">
                {" "}
                · {d.required ? tr("required") : tr("optional")} · {issuerText(d.issuer, tr)} · {stageText(d.stage, tr)}
                {d.done ? tr("done2") : ""}
              </span>
            </li>
          ))}
        </ul>
        {scope === "mine" && <p className="mt-1 text-xs text-muted-foreground">{tr("uploadDocumentsFromTheOrganization")}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {v.noc?.canIssue && !v.noc.issuedAt && (
            <Button variant="secondary" onClick={() => act(() => api(`${BASE}/staff/${experienceId}/noc`, { method: "POST" }), tr("noObjectionCertificateIssuedThe"))}>
              {tr("issueName", { name: v.noc.name ?? tr("nOC") })}
            </Button>
          )}
          {v.noc?.issuedAt && (
            <Button variant="secondary" onClick={() => download("noc.pdf", "no-objection-certificate.pdf")}>
              {tr("downloadNamePDF", { name: v.noc.name ?? tr("nOC") })}
            </Button>
          )}
          <Button variant="secondary" onClick={() => download("logbook.pdf", "internship-logbook.pdf")}>
            {tr("downloadLogbookPDF")}
          </Button>
          {v.certificate?.canIssue && (
            <Button
              onClick={() => act(() => api(`${BASE}/${scope === "faculty" ? "faculty" : "staff"}/${experienceId}/certificate`, { method: "POST" }), tr("completionCertificateIssuedTheStudent"))}
            >
              {tr("issueCompletionCertificate")}
            </Button>
          )}
          {v.certificate?.issuedAt && (
            <Button variant="secondary" onClick={() => download("certificate.pdf", `internship-certificate-${v.certificate?.number}.pdf`)}>
              {tr("downloadCompletionCertificatePDF")}
            </Button>
          )}
        </div>
        {v.certificate?.issuedAt && (
          <p className="mt-2 break-all text-xs text-muted-foreground">
            {tr("certificateNumberIssuedIssuedAtFingerpri", { number: v.certificate.number, issuedAt: formatDate(v.certificate.issuedAt), sha256: v.certificate.sha256 })}
          </p>
        )}
        {!v.certificate?.issuedAt && v.certificate?.reason && <p className="mt-2 text-xs text-muted-foreground">{v.certificate.reason}</p>}
      </section>

      {v.details && v.flags && (
        <DetailsSection
          v={v}
          onSave={(body) => act(() => api(`${BASE}/${scope === "mine" ? "mine" : "staff"}/${experienceId}/details`, { method: "PUT", json: body }), tr("saved"))}
          editable={v.details.canEdit && scope !== "faculty"}
        />
      )}

      {v.logbook && (
        <LogbookSection
          v={v}
          scope={scope}
          onLog={(body) => act(() => api(`${BASE}/mine/${experienceId}/logbook`, { json: body }), tr("logbookWeekSentToYour"))}
          onReview={(logId, approve, note) =>
            act(() => api(`${BASE}/faculty/${experienceId}/logbook/${logId}/review`, { json: { approve, note } }), approve ? tr("weekApproved") : tr("weekReturnedToTheStudent"))
          }
        />
      )}

      {v.evaluation && (
        <EvaluationSection v={v} canSubmit={scope === "faculty" && v.evaluation.canSubmitFaculty} onSubmit={(body) => act(() => api(`${BASE}/faculty/${experienceId}/evaluation`, { json: body }), tr("facultyEvaluationSaved"))} />
      )}

      {staffLike && v.sources && v.sources.length > 0 && (
        <details className="mt-6 text-sm">
          <summary className="cursor-pointer">{tr("whereTheseRulesComeFrom")}</summary>
          <SourceList sources={v.sources} />
        </details>
      )}
    </Card>
  );
}

const ISSUERS = ["Student", "Organization", "Institution"];
const STAGES = ["BeforeApproval", "BeforeStart", "DuringInternship", "AtCompletion"];
const issuerText = (i: string, tr: CareerTranslator) => (ISSUERS.includes(i) ? tr(`issuer.${i}`) : i);
const stageText = (s: string, tr: CareerTranslator) => (STAGES.includes(s) ? tr(`stage.${s}`) : s);

function DetailsSection({ v, onSave, editable }: { v: PackView; onSave: (body: unknown) => Promise<void>; editable: boolean }) {
  const tr = useCareerT("internshipPack");
  const d = v.details!;
  const f = v.flags!;
  const [type, setType] = useState(d.internshipType ?? "");
  const [paid, setPaid] = useState(d.stipendPaid == null ? "" : d.stipendPaid ? "yes" : "no");
  const [amount, setAmount] = useState(d.stipendMonthly != null ? String(d.stipendMonthly) : "");
  const [currency, setCurrency] = useState(d.stipendCurrency ?? f.currency ?? "");
  const [covered, setCovered] = useState(d.insuranceCovered == null ? "" : d.insuranceCovered ? "yes" : "no");
  const [provider, setProvider] = useState(d.insuranceProvider ?? "");
  const [policy, setPolicy] = useState(d.insurancePolicyNumber ?? "");
  const [busy, setBusy] = useState(false);

  if (!editable) {
    return (
      <section className="mt-6 text-sm">
        <h3 className="font-semibold">{tr("internshipDetails")}</h3>
        <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{tr("internshipType")}</dt>
            <dd>{d.internshipType ?? tr("notRecorded")}</dd>
          </div>
          {f.stipendTracked && (
            <div>
              <dt className="text-xs text-muted-foreground">{tr("stipend")}</dt>
              <dd>{d.stipendPaid == null ? tr("notRecorded") : d.stipendPaid ? tr("yesValue", { value: d.stipendMonthly != null ? tr("stipendMonthlyStipendCurrencyAMonth", { stipendMonthly: d.stipendMonthly, stipendCurrency: d.stipendCurrency ?? "" }) : "" }) : tr("no")}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">{tr("insurance")}</dt>
            <dd>{d.insuranceCovered == null ? tr("notRecorded") : d.insuranceCovered ? tr("coveredValue", { value: d.insuranceProvider ? ` (${d.insuranceProvider}${d.insurancePolicyNumber ? `, ${d.insurancePolicyNumber}` : ""})` : "" }) : tr("notCovered")}</dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section className="mt-6" aria-labelledby="pack-details">
      <h3 id="pack-details" className="text-sm font-semibold">
        {tr("internshipDetails")}
      </h3>
      <form
        className="mt-2 grid gap-3 sm:grid-cols-3 sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave({
              internshipType: type,
              stipendPaid: paid === "" ? undefined : paid === "yes",
              stipendMonthly: paid === "yes" && amount !== "" ? Number(amount) : undefined,
              stipendCurrency: currency || undefined,
              insuranceCovered: covered === "" ? undefined : covered === "yes",
              insuranceProvider: provider,
              insurancePolicyNumber: policy,
            });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={tr("internshipType")}>
          {(p) => (
            <select {...p} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{tr("notRecorded")}</option>
              {f.internshipTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </Field>
        {f.stipendTracked && (
          <>
            <Field label={tr("stipend")}>
              {(p) => (
                <select {...p} value={paid} onChange={(e) => setPaid(e.target.value)}>
                  <option value="">{tr("notRecorded")}</option>
                  <option value="yes">{tr("yes")}</option>
                  <option value="no">{tr("no")}</option>
                </select>
              )}
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Field label={tr("stipendPerMonth")}>{(p) => <input {...p} type="number" min={0} step="1" value={amount} disabled={paid !== "yes"} onChange={(e) => setAmount(e.target.value)} />}</Field>
              </div>
              <Field label={tr("currency")}>{(p) => <input {...p} value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />}</Field>
            </div>
          </>
        )}
        <Field label={f.insuranceRequired ? tr("insuranceCoverRequired") : tr("insuranceCover")}>
          {(p) => (
            <select {...p} value={covered} onChange={(e) => setCovered(e.target.value)}>
              <option value="">{tr("notRecorded")}</option>
              <option value="yes">{tr("covered")}</option>
              <option value="no">{tr("notCovered")}</option>
            </select>
          )}
        </Field>
        <Field label={tr("insurer")}>{(p) => <input {...p} value={provider} onChange={(e) => setProvider(e.target.value)} />}</Field>
        <Field label={tr("policyNumber")}>{(p) => <input {...p} value={policy} onChange={(e) => setPolicy(e.target.value)} />}</Field>
        <Button type="submit" variant="secondary" busy={busy}>
          {tr("saveDetails")}
        </Button>
      </form>
      {(f.stipendNote || f.insuranceNote) && (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer">{tr("aboutStipendAndInsuranceRules")}</summary>
          <p className="mt-1">{f.stipendNote}</p>
          <p className="mt-1">{f.insuranceNote}</p>
        </details>
      )}
    </section>
  );
}

const STATUS_LABEL_KEYS = ["Pending", "Approved", "Rejected"];
/** status label in the career language (G1) */
function useHoursStatusLabels(): Record<string, string> {
  return useCareerLabels("internshipPack.hoursStatus", STATUS_LABEL_KEYS);
}
const FACULTY_LABEL_KEYS = ["Pending", "Approved", "Returned"];
/** faculty label in the career language (G1) */
function useFacultyStatusLabels(): Record<string, string> {
  return useCareerLabels("internshipPack.facultyStatus", FACULTY_LABEL_KEYS);
}

function LogbookSection({
  v,
  scope,
  onLog,
  onReview,
}: {
  v: PackView;
  scope: PackScope;
  onLog: (body: unknown) => Promise<void>;
  onReview: (logId: string, approve: boolean, note: string) => Promise<void>;
}) {
  const tr = useCareerT("internshipPack");
  const lb = v.logbook!;
  return (
    <section className="mt-6" aria-labelledby="pack-logbook">
      <h3 id="pack-logbook" className="text-sm font-semibold">
        {tr("logbook")}{lb.frequency === "Daily" ? tr("dailyDiarySignedOffWeekly") : tr("weeklyEntries")})
      </h3>
      {lb.note && <p className="mt-1 text-xs text-muted-foreground">{lb.note}</p>}
      {lb.canLog && <LogbookForm fields={lb.fields} daily={lb.frequency === "Daily"} onSubmit={onLog} />}
      {lb.weeks.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{tr("noLogbookWeeksYet")}</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {lb.weeks.map((w) => (
            <WeekItem key={w.hourLogId} w={w} fields={lb.fields} canReview={scope === "faculty" && lb.canReview} onReview={onReview} />
          ))}
        </ol>
      )}
    </section>
  );
}

function WeekItem({ w, fields, canReview, onReview }: { w: LogWeek; fields: LogField[]; canReview: boolean; onReview: (logId: string, approve: boolean, note: string) => Promise<void> }) {
  const tr = useCareerT("internshipPack");
  const FACULTY_LABEL = useFacultyStatusLabels();
  const STATUS_LABEL = useHoursStatusLabels();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (kind: string, approve: boolean) => {
    setBusy(kind);
    try {
      await onReview(w.hourLogId, approve, note);
      setNote("");
    } finally {
      setBusy(null);
    }
  };
  const label = (k: LogField["key"]) => fields.find((f) => f.key === k)?.label ?? k;
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">
          {tr("weekOfWeekStartHoursHours", { weekStart: formatDate(w.weekStart), hours: w.hours })}
        </h4>
        <span className="flex flex-wrap gap-1">
          <Badge tone={w.status === "Approved" ? "good" : w.status === "Rejected" ? "bad" : "warn"}>{STATUS_LABEL[w.status] ?? w.status}</Badge>
          <Badge tone={w.facultyStatus === "Approved" ? "good" : w.facultyStatus === "Returned" ? "bad" : "neutral"}>{FACULTY_LABEL[w.facultyStatus] ?? w.facultyStatus}</Badge>
        </span>
      </div>
      {w.days.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {w.days.map((d) => (
            <li key={d.date}>
              {tr("dateHoursH", { date: formatDate(d.date), hours: d.hours })}{d.activity ? `, ${d.activity}` : ""}
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-2 space-y-1">
        {(["tasks", "learning", "challenges", "nextPlan"] as const).map((k) =>
          w[k] ? (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{label(k)}</dt>
              <dd className="whitespace-pre-wrap">{w[k]}</dd>
            </div>
          ) : null,
        )}
      </dl>
      {w.supervisorSignedAt && (
        <p className="mt-2 text-xs">
          {tr("signedOffBySupervisorSignedNameOn", { supervisorSignedName: w.supervisorSignedName, supervisorSignedAt: formatDate(w.supervisorSignedAt, true) })}
        </p>
      )}
      {w.decisionNote && <p className="mt-1 text-xs">{tr("noteDecisionNote", { decisionNote: w.decisionNote })}</p>}
      {w.facultyNote && w.facultyStatus !== "Returned" && <p className="mt-1 text-xs">{tr("facultyNoteFacultyNote", { facultyNote: w.facultyNote })}</p>}
      {canReview && w.facultyStatus !== "Approved" && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <Field label={tr("noteForTheWeekOf", { weekStart: formatDate(w.weekStart) })}>{(p) => <input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          <div className="flex flex-wrap gap-2">
            <Button busy={busy === "a"} disabled={w.status !== "Approved"} onClick={() => run("a", true)}>
              {tr("approveWeek")}
            </Button>
            <Button variant="secondary" busy={busy === "r"} disabled={!note.trim()} onClick={() => run("r", false)}>
              {tr("returnToStudent")}
            </Button>
          </div>
          {w.status !== "Approved" && <p className="text-xs text-muted-foreground">{tr("theSiteSupervisorSignsThe")}</p>}
        </div>
      )}
    </li>
  );
}

const weekDates = (anyDay: string) => {
  if (!anyDay) return [] as string[];
  const d = new Date(`${anyDay}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return [];
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10));
};

function LogbookForm({ fields, daily, onSubmit }: { fields: LogField[]; daily: boolean; onSubmit: (body: unknown) => Promise<void> }) {
  const tr = useCareerT("internshipPack");
  const [week, setWeek] = useState("");
  const [hours, setHours] = useState("");
  const [days, setDays] = useState<Record<string, { hours: string; activity: string }>>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const dates = useMemo(() => weekDates(week), [week]);
  const total = dates.reduce((s, d) => s + (Number(days[d]?.hours) || 0), 0);

  return (
    <form
      className="mt-3 space-y-3 rounded-md border border-border p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit({
            weekStart: week,
            hours: daily ? undefined : Number(hours),
            days: daily ? dates.filter((d) => Number(days[d]?.hours) > 0).map((d) => ({ date: d, hours: Number(days[d].hours), activity: days[d].activity })) : undefined,
            tasks: text.tasks,
            learning: text.learning,
            challenges: text.challenges,
            nextPlan: text.nextPlan,
          });
          setDays({});
          setText({});
          setHours("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm font-medium">{tr("addOrCorrectALogbook")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={tr("anyDayInTheWeek")}>{(p) => <input {...p} type="date" value={week} onChange={(e) => setWeek(e.target.value)} required />}</Field>
        {!daily && <Field label={tr("hoursWorkedThisWeek")}>{(p) => <input {...p} type="number" min={0.5} max={80} step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} required />}</Field>}
      </div>
      {daily && dates.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium">{tr("dailyDiaryLeaveADay")}</legend>
          <div className="mt-2 space-y-2">
            {dates.map((d) => (
              <div key={d} className="grid gap-2 sm:grid-cols-[10rem_7rem_1fr] sm:items-end">
                <span className="text-sm">{formatDate(d)}</span>
                <Field label={tr("hoursOnD", { d: formatDate(d) })}>
                  {(p) => <input {...p} type="number" min={0} max={24} step="0.5" value={days[d]?.hours ?? ""} onChange={(e) => setDays((x) => ({ ...x, [d]: { hours: e.target.value, activity: x[d]?.activity ?? "" } }))} />}
                </Field>
                <Field label={tr("activityOnD", { d: formatDate(d) })}>
                  {(p) => <input {...p} value={days[d]?.activity ?? ""} onChange={(e) => setDays((x) => ({ ...x, [d]: { hours: x[d]?.hours ?? "", activity: e.target.value } }))} />}
                </Field>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm" aria-live="polite">
            {tr("totalForTheWeekTotal", { total })}
          </p>
        </fieldset>
      )}
      {fields.map((f) => (
        <Field key={f.key} label={f.required ? f.label : tr("labelOptional", { label: f.label })}>
          {(p) => <textarea {...p} rows={f.key === "tasks" ? 3 : 2} maxLength={f.maxLength} value={text[f.key] ?? ""} onChange={(e) => setText((x) => ({ ...x, [f.key]: e.target.value }))} required={f.required} />}
        </Field>
      ))}
      <Button type="submit" busy={busy} disabled={!week || (daily && total <= 0)}>
        {tr("sendWeekForSignOff")}
      </Button>
      <p className="text-xs text-muted-foreground">{tr("yourSiteSupervisorGetsA")}</p>
    </form>
  );
}

function EvaluationSection({ v, canSubmit, onSubmit }: { v: PackView; canSubmit: boolean; onSubmit: (body: unknown) => Promise<void> }) {
  const tr = useCareerT("internshipPack");
  const ev = v.evaluation!;
  const form = ev.facultyForm;
  const [scores, setScores] = useState<Record<string, number>>(ev.faculty?.scores ?? {});
  const [comments, setComments] = useState(ev.faculty?.comments ?? "");
  const [busy, setBusy] = useState(false);
  const scale = Array.from({ length: form.scaleMax }, (_, i) => i + 1);
  const pct = (n?: number | null) => (n == null ? tr("notYetLower") : `${n}%`);
  return (
    <section className="mt-6" aria-labelledby="pack-eval">
      <h3 id="pack-eval" className="text-sm font-semibold">
        {tr("evaluation")}
      </h3>
      <ul className="mt-2 space-y-1 text-sm">
        <li>
          {tr("supervisorEvaluationSupervisorWeightSupe", { supervisorWeight: ev.supervisorWeight, supervisorPercent: pct(ev.supervisorPercent) })}
        </li>
        <li>
          {form.title} ({ev.facultyWeight}%): {pct(ev.facultyPercent)}
          {ev.faculty ? tr("byEvaluatorNameUpdatedAt", { evaluatorName: ev.faculty.evaluatorName, updatedAt: formatDate(ev.faculty.updatedAt) }) : ""}
        </li>
        <li>
          <strong>{tr("combinedCombinedPercent", { combinedPercent: pct(ev.combinedPercent) })}</strong>
        </li>
      </ul>
      {ev.faculty?.comments && <p className="mt-1 text-sm">{tr("facultyCommentsComments", { comments: ev.faculty.comments })}</p>}
      {canSubmit && (
        <form
          className="mt-3 space-y-4 rounded-md border border-border p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onSubmit({ scores, comments });
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm text-muted-foreground">
            {tr("scoreEachCriterionFrom1", { scaleMax: form.scaleMax, note: form.note })}
          </p>
          {form.criteria.map((c) => (
            <fieldset key={c.key}>
              <legend className="text-sm font-medium">
                {c.text} <span className="text-xs text-muted-foreground">{tr("weightWeight", { weight: c.weight })}</span>
              </legend>
              <div className="mt-1 flex flex-wrap gap-3">
                {scale.map((n) => (
                  <label key={n} className="flex items-center gap-1 text-sm">
                    <input type="radio" name={`fe-${c.key}`} value={n} checked={scores[c.key] === n} onChange={() => setScores((s) => ({ ...s, [c.key]: n }))} required />
                    {n}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <Field label={tr("comments")}>{(p) => <textarea {...p} rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />}</Field>
          <Button type="submit" busy={busy}>
            {ev.faculty ? tr("updateFacultyEvaluation") : tr("saveFacultyEvaluation")}
          </Button>
        </form>
      )}
    </section>
  );
}

function SourceList({ sources }: { sources: PackSource[] }) {
  const tr = useCareerT("internshipPack");
  return (
    <ul className="mt-2 space-y-2">
      {sources.map((s) => (
        <li key={s.id}>
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
            {s.title}
            <span className="sr-only">{" "}{tr("opensInANewTab")}</span>
          </a>{" "}
          <span className="text-xs text-muted-foreground">
            {s.issuer}, {s.date}
          </span>{" "}
          <SourceStatus status={s.status} />
          {s.note && <span className="block text-xs text-muted-foreground">{s.note}</span>}
        </li>
      ))}
    </ul>
  );
}

// ----------------------------------------------------------------- career-center settings

type RuleDraft = Record<string, { minHours: string; maxHours: string; minCredits: string; maxCredits: string; hoursPerCredit: string }>;
const str = (n?: number | null) => (n == null ? "" : String(n));
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

export function PackSettingsPanel({ api, schoolId }: { api: Api; schoolId?: string | null }) {
  const tr = useCareerT("internshipPack");
  const settings = useLoad(() => api<PackSettings>(`${BASE}/settings`), [api, schoolId]);
  const s = settings.data;
  const baseKey = s?.selected?.key;
  const base = useLoad(() => (baseKey ? api<PackDefinition>(`${BASE}/catalog/${baseKey}`) : Promise.resolve(null)), [api, baseKey]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [choice, setChoice] = useState("");

  const save = async (body: unknown, success: string) => {
    setErr(null);
    setMsg(null);
    try {
      settings.setData(await api<PackSettings>(`${BASE}/settings`, { method: "PUT", json: body }));
      setMsg(success);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (settings.loading && !s) return <Loading />;
  if (!s) return <ErrorBanner error={settings.error} onRetry={settings.reload} />;
  const eff = s.effective;

  return (
    <div className="space-y-6">
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      <Card title={tr("countryPack")}>
        <p className="mb-3 text-sm text-muted-foreground">
          {tr("aCountryPackAddsA")}
        </p>
        {s.selected && eff ? (
          <p className="text-sm">
            {tr.rich("selectedTitleVersionVersionReviewed", { strong: (chunks) => <strong>{chunks}</strong>, title: eff.title, version: eff.version, reviewedOn: eff.reviewedOn })}
            {s.selected.newVersionAvailable && tr("aNewerVersionOfThis")}
          </p>
        ) : (
          <p className="text-sm">{tr("noPackSelectedInternshipsUse")}</p>
        )}
        {s.canEdit && (
          <form
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              save({ packKey: choice || s.selected?.key }, tr("packSelectionSaved"));
            }}
          >
            <Field label={tr("pack")} hint={tr("changingToAnotherPackResets")}>
              {(p) => (
                <select {...p} value={choice || s.selected?.key || ""} onChange={(e) => setChoice(e.target.value)} required>
                  <option value="">{tr("chooseAPack")}</option>
                  {s.catalog.map((c) => (
                    <option key={c.key} value={c.key}>
                      {tr("titleCountryNameVVersion", { title: c.title, countryName: c.countryName, version: c.version })}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Button type="submit">{tr("saveSelection")}</Button>
            {s.selected && (
              <Button type="button" variant="ghost" onClick={() => window.confirm(tr("removeTheCountryPackOverrides")) && save({ clearPack: true }, tr("packRemoved"))}>
                {tr("removePack")}
              </Button>
            )}
          </form>
        )}
      </Card>

      {eff && (
        <>
          <Card title={tr("hourRulesAndPrograms")}>
            <p className="mb-3 text-sm text-muted-foreground">{eff.summary}</p>
            <RulesTable eff={eff} />
            <ProgramLinks s={s} eff={eff} api={api} onChanged={settings.reload} save={save} setErr={setErr} setMsg={setMsg} />
          </Card>
          {s.canEdit && base.data && <OverridesForm eff={eff} base={base.data} overrides={s.overrides} onSave={(o) => save({ overrides: o }, tr("overridesSaved"))} />}
          {!s.canEdit && <DocumentsSummary eff={eff} />}
          <ExportsCard eff={eff} api={api} setErr={setErr} />
          <Card title={tr("sourcesAndNotes")}>
            <ul className="mb-3 list-disc space-y-1 ps-5 text-sm">
              {eff.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            <SourceList sources={eff.sources} />
          </Card>
        </>
      )}
    </div>
  );
}

function RulesTable({ eff }: { eff: PackDefinition }) {
  const tr = useCareerT("internshipPack");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-start text-sm [&_th]:text-start">
        <caption className="sr-only">{tr("hourRules")}</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="py-2 pe-3">{tr("rule")}</th>
            <th scope="col" className="pe-3">{tr("hours")}</th>
            <th scope="col" className="pe-3">{tr("credits")}</th>
            <th scope="col" className="pe-3">{tr("when")}</th>
            <th scope="col">{tr("status")}</th>
          </tr>
        </thead>
        <tbody>
          {eff.hourRules.map((r) => (
            <tr key={r.key} className="border-b border-border/60 align-top">
              <td className="py-2 pe-3">
                <span className="font-medium">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.programmeType}</span>
                {r.note && (
                  <details className="text-xs">
                    <summary className="cursor-pointer">{tr("ruleText")}</summary>
                    <p className="mt-1">{r.note}</p>
                    <SourceLinks ids={r.sources} sources={eff.sources} />
                  </details>
                )}
              </td>
              <td className="pe-3">{hoursText(r, tr)}</td>
              <td className="pe-3">
                {creditsText(r, tr)}
                {r.hoursPerCredit ? <span className="block text-xs text-muted-foreground">{tr("hoursPerCreditHoursPerCredit", { hoursPerCredit: r.hoursPerCredit })}</span> : null}
              </td>
              <td className="pe-3">{r.timing}</td>
              <td>
                <SourceStatus status={r.status} />
                {r.overridden && (
                  <span className="mt-1 block">
                    <Badge tone="info">{tr("changedByYourSchool")}</Badge>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgramLinks({
  s,
  eff,
  api,
  onChanged,
  save,
  setErr,
  setMsg,
}: {
  s: PackSettings;
  eff: PackDefinition;
  api: Api;
  onChanged: () => void;
  save: (body: unknown, success: string) => Promise<void>;
  setErr: (e: string | null) => void;
  setMsg: (m: string | null) => void;
}) {
  const tr = useCareerT("internshipPack");
  const [rule, setRule] = useState(eff.hourRules[0]?.key ?? "");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-6 space-y-4">
      <h3 className="text-sm font-semibold">{tr("yourPrograms")}</h3>
      {s.programs.length === 0 ? (
        <EmptyState title={tr("noInternshipProgramsYet")}>{tr("createOneFromAnHour")}</EmptyState>
      ) : (
        <ul className="space-y-2 text-sm">
          {s.programs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-end justify-between gap-2 rounded-md border border-border p-3">
              <span>
                <span className="font-medium">
                  {p.code} {p.title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {tr("requiredHoursHoursCreditHoursCredits", { requiredHours: p.requiredHours, creditHours: p.creditHours })}{p.active ? "" : tr("closed")}
                </span>
                {p.belowMinimum && <span className="block text-xs font-medium">{tr("requiredHoursAreBelowThis")}</span>}
              </span>
              {s.canEdit ? (
                <Field label={tr("hourRuleForCode", { code: p.code })}>
                  {(f) => (
                    <select {...f} value={p.ruleKey ?? ""} onChange={(e) => save({ programRules: { [p.id]: e.target.value || null } }, tr("ruleSavedForCode", { code: p.code }))}>
                      <option value="">{tr("notLinked")}</option>
                      {eff.hourRules.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              ) : (
                <span className="text-xs">{eff.hourRules.find((r) => r.key === p.ruleKey)?.label ?? tr("notLinked")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {s.canEdit && (
        <form
          className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-4 sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            setMsg(null);
            try {
              await api(`${BASE}/programs`, { json: { ruleKey: rule, code, title: title || undefined } });
              setMsg(tr("programCodeCreatedWithThe", { code }));
              setCode("");
              setTitle("");
              onChanged();
            } catch (ex) {
              setErr((ex as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={tr("hourRule")}>
            {(f) => (
              <select {...f} value={rule} onChange={(e) => setRule(e.target.value)} required>
                {eff.hourRules.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={tr("newCourseCode")}>{(f) => <input {...f} value={code} onChange={(e) => setCode(e.target.value)} required />}</Field>
          <Field label={tr("titleOptional")}>{(f) => <input {...f} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
          <Button type="submit" busy={busy}>
            {tr("createProgramFromRule")}
          </Button>
        </form>
      )}
    </div>
  );
}

function DocumentsSummary({ eff }: { eff: PackDefinition }) {
  const tr = useCareerT("internshipPack");
  return (
    <Card title={tr("documents")}>
      <ul className="space-y-2 text-sm">
        {eff.documents.map((d) => (
          <li key={d.key}>
            <span className="font-medium">{d.name}</span> · {d.required ? tr("required") : tr("optional")} · {issuerText(d.issuer, tr)} · {stageText(d.stage, tr)} <SourceStatus status={d.status} />
            {d.note && <span className="block text-xs text-muted-foreground">{d.note}</span>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function OverridesForm({ eff, base, overrides, onSave }: { eff: PackDefinition; base: PackDefinition; overrides: Overrides; onSave: (o: Overrides) => Promise<void> }) {
  const tr = useCareerT("internshipPack");
  const [rules, setRules] = useState<RuleDraft>(() =>
    Object.fromEntries(eff.hourRules.map((r) => [r.key, { minHours: str(r.minHours), maxHours: str(r.maxHours), minCredits: str(r.minCredits), maxCredits: str(r.maxCredits), hoursPerCredit: str(r.hoursPerCredit) }])),
  );
  const [docs, setDocs] = useState(() => Object.fromEntries(eff.documents.map((d) => [d.key, { required: d.required, name: d.name }])));
  const [templates, setTemplates] = useState(() => Object.fromEntries(eff.templates.map((t) => [t.key, t.text])));
  const [frequency, setFrequency] = useState(eff.logbook.frequency);
  const [stipend, setStipend] = useState(eff.flags.stipendTracked);
  const [insurance, setInsurance] = useState(eff.flags.insuranceRequired);
  const [sw, setSw] = useState(String(eff.supervisorWeight));
  const [rubric, setRubric] = useState(eff.facultyEvaluation.criteria.map((c) => `${c.text} | ${c.weight}`).join("\n"));
  const [signatory, setSignatory] = useState(overrides.certificateSignatory ?? "");
  const [signatoryTitle, setSignatoryTitle] = useState(overrides.certificateSignatoryTitle ?? "");
  const [busy, setBusy] = useState(false);

  const build = (): Overrides => {
    const hourRules: NonNullable<Overrides["hourRules"]> = {};
    for (const r of base.hourRules) {
      const d = rules[r.key];
      const o: Record<string, number | null> = {};
      const fields = ["minHours", "maxHours", "minCredits", "maxCredits", "hoursPerCredit"] as const;
      for (const f of fields) {
        const value = numOrNull(d[f]);
        if (value !== (r[f] ?? null) && value !== null) o[f] = value;
      }
      if (Object.keys(o).length) hourRules[r.key] = o;
    }
    const documents: NonNullable<Overrides["documents"]> = {};
    for (const d of base.documents) {
      const x = docs[d.key];
      if (x.required !== d.required || x.name.trim() !== d.name) documents[d.key] = { required: x.required, name: x.name.trim() !== d.name ? x.name.trim() : null };
    }
    const tpl: Record<string, string> = {};
    for (const t of base.templates) if ((templates[t.key] ?? "").trim() && templates[t.key].trim() !== t.text.trim()) tpl[t.key] = templates[t.key];
    const baseRubric = base.facultyEvaluation.criteria.map((c) => `${c.text} | ${c.weight}`).join("\n");
    const facultyRubric =
      rubric.trim() === baseRubric.trim()
        ? null
        : rubric
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => {
              const i = l.lastIndexOf("|");
              return i < 0 ? { text: l, weight: 0 } : { text: l.slice(0, i).trim(), weight: Number(l.slice(i + 1)) };
            });
    const swn = Number(sw);
    return {
      hourRules,
      documents,
      templates: tpl,
      logbookFrequency: frequency !== base.logbook.frequency ? frequency : null,
      stipendTracked: stipend !== base.flags.stipendTracked ? stipend : null,
      insuranceRequired: insurance !== base.flags.insuranceRequired ? insurance : null,
      supervisorWeight: swn !== base.supervisorWeight ? swn : null,
      facultyWeight: swn !== base.supervisorWeight ? 100 - swn : null,
      facultyRubric,
      certificateSignatory: signatory || null,
      certificateSignatoryTitle: signatoryTitle || null,
    };
  };

  return (
    <Card title={tr("yourSchoolsSettings")}>
      <form
        className="space-y-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave(build());
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset>
          <legend className="text-sm font-semibold">{tr("hoursAndCredits")}</legend>
          <p className="text-xs text-muted-foreground">{tr("valuesStartFromThePack")}</p>
          <div className="mt-2 space-y-3">
            {base.hourRules.map((r) => (
              <details key={r.key} className="rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">{r.label}</summary>
                <div className="mt-2 grid gap-3 sm:grid-cols-5">
                  {(
                    [
                      ["minHours", tr("fieldMinHours")],
                      ["maxHours", tr("fieldMaxHours")],
                      ["minCredits", tr("fieldMinCredits")],
                      ["maxCredits", tr("fieldMaxCredits")],
                      ["hoursPerCredit", tr("fieldHoursPerCredit")],
                    ] as const
                  ).map(([k, label]) => (
                    <Field key={k} label={label} hint={tr("packR", { r: str(r[k]) || "—" })}>
                      {(p) => <input {...p} type="number" min={0} step="0.5" value={rules[r.key][k]} onChange={(e) => setRules((x) => ({ ...x, [r.key]: { ...x[r.key], [k]: e.target.value } }))} />}
                    </Field>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">{tr("documents")}</legend>
          <ul className="mt-2 space-y-3">
            {base.documents.map((d) => (
              <li key={d.key} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label={tr("nameForName", { name: d.name })} hint={`${issuerText(d.issuer, tr)}, ${stageText(d.stage, tr)}.${d.note ? ` ${d.note}` : ""}`}>
                  {(p) => <input {...p} value={docs[d.key].name} onChange={(e) => setDocs((x) => ({ ...x, [d.key]: { ...x[d.key], name: e.target.value } }))} />}
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={docs[d.key].required} onChange={(e) => setDocs((x) => ({ ...x, [d.key]: { ...x[d.key], required: e.target.checked } }))} />
                  {tr("required2")}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">{tr("logbookStipendAndInsurance")}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3 sm:items-end">
            <Field label={tr("logbookEntries")}>
              {(p) => (
                <select {...p} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  {base.logbook.allowedFrequencies.map((f) => (
                    <option key={f} value={f}>
                      {f === "Daily" ? tr("dailyDiarySignedOffWeekly2") : tr("weeklyEntries2")}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={stipend} onChange={(e) => setStipend(e.target.checked)} />{" "}{tr("recordStipends")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={insurance} onChange={(e) => setInsurance(e.target.checked)} />{" "}{tr("requireInsuranceConfirmation")}
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">{tr("evaluation")}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label={tr("supervisorWeight")} hint={tr("facultyWeightIsTheRest", { value: 100 - (Number(sw) || 0), supervisorWeight: base.supervisorWeight, facultyWeight: base.facultyWeight })}>
              {(p) => <input {...p} type="number" min={0} max={100} value={sw} onChange={(e) => setSw(e.target.value)} />}
            </Field>
            <Field label={tr("facultyRubric")} hint={tr("oneCriterionPerLineAs")}>
              {(p) => <textarea {...p} rows={6} value={rubric} onChange={(e) => setRubric(e.target.value)} />}
            </Field>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{tr("theSupervisorFormIsSet")}</p>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">{tr("templatesAndCertificate")}</legend>
          {base.templates.map((t) => (
            <div key={t.key} className="mt-2">
              <Field label={t.title} hint={t.note}>
                {(p) => <textarea {...p} rows={8} value={templates[t.key] ?? ""} onChange={(e) => setTemplates((x) => ({ ...x, [t.key]: e.target.value }))} />}
              </Field>
            </div>
          ))}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label={tr("certificateSignatory")}>{(p) => <input {...p} value={signatory} onChange={(e) => setSignatory(e.target.value)} placeholder={tr("authorisedSignatory")} />}</Field>
            <Field label={tr("signatoryTitle")}>{(p) => <input {...p} value={signatoryTitle} onChange={(e) => setSignatoryTitle(e.target.value)} />}</Field>
          </div>
        </fieldset>

        <Button type="submit" busy={busy}>
          {tr("saveSettings")}
        </Button>
      </form>
    </Card>
  );
}

function ExportsCard({ eff, api, setErr }: { eff: PackDefinition; api: Api; setErr: (e: string | null) => void }) {
  const tr = useCareerT("internshipPack");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = (kind: string) => `kind=${kind}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;
  return (
    <Card title={tr("reports")}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label={tr("internshipsEndingOnOrAfter")}>{(p) => <input {...p} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
        <Field label={tr("internshipsStartingOnOrBefore")}>{(p) => <input {...p} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
      </div>
      <ul className="space-y-3 text-sm">
        {eff.exports.map((x) => (
          <li key={x.key} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{x.title}</span>
              <Button variant="secondary" onClick={() => downloadWith(api, `${BASE}/export.csv?${qs(x.key)}`, `internships-${x.key}.csv`, tr("downloadFailed")).catch((e) => setErr(e.message))}>
                {tr.rich("downloadCSVTitle", { span: (chunks) => <span className="sr-only">{chunks}</span>, title: x.title })}
              </Button>
            </div>
            <p className="mt-1 text-muted-foreground">{x.description}</p>
            <p className="mt-1">
              <SourceStatus status={x.status} />{" "}
              {x.status === "Unconfirmed" && <span className="text-xs">{tr("theRegulatorHasNotPublished")}</span>}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
