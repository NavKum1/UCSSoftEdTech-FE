"use client";

/**
 * G15 registered apprenticeships (staff): related technical instruction and on-the-job learning hours, the wage
 * schedule and wage progression, and sponsor sign-off through signed links (same link security as internship supervisors).
 */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, ScrollArea, SuccessBanner, useCareerFormat, useCareerT, useLoad } from "@/components/career/ui";
import { setLocationHash, useDateOnly, useLocationHash } from "./shared";

export interface WageStep {
  step: number;
  afterOjlHours?: number | null;
  afterMonths?: number | null;
  rate: number;
}

export interface ApprenticeshipDto {
  id: string;
  studentName: string;
  experienceId?: string | null;
  occupation: string;
  occupationCode?: string | null;
  registrationNumber?: string | null;
  registrationAgency?: string | null;
  sponsorName: string;
  sponsorContactName: string;
  sponsorContactEmail?: string | null;
  approach: string;
  startDate: string;
  expectedEndDate?: string | null;
  ojlHoursRequired: number;
  rtiHoursRequired: number;
  journeyworkerWage?: number | null;
  wageSchedule: WageStep[];
  status: string;
  completedAt?: string | null;
  sponsorConsent: boolean;
  progress: {
    ojlHours: number;
    ojlFromExperience: number;
    ojlStaffEntered: number;
    rtiHours: number;
    rtiPending: number;
    ojlPercent?: number | null;
    rtiPercent?: number | null;
    currentRate?: number | null;
    currentStep?: number | null;
    percentOfJourneyworker?: number | null;
    monthsElapsed: number;
    stepsDue: WageStep[];
  };
  warnings: string[];
  hours: { id: string; kind: string; date: string; hours: number; description?: string | null; source: string; status: string; decisionNote?: string | null }[];
  wages: { id: string; effectiveDate: string; hourlyRate: number; step?: number | null; note?: string | null; source: string }[];
  signoffs: { id: string; kind: string; statement: string; proposedRate?: number | null; proposedStep?: number | null; status: string; signerName?: string | null; signedAt?: string | null; issuedAt: string; expiresAt: string; revoked: boolean; sponsorNote?: string | null }[];
}

interface Row {
  id: string;
  studentName: string;
  occupation: string;
  sponsorName: string;
  status: string;
  startDate: string;
  pendingSignoffs: number;
  pendingHours: number;
}

const STATUSES = ["Active", "Suspended", "Completed", "Cancelled"];
const KINDS = ["ProgressReview", "YearCompleted", "WageIncrease", "Completion"];

const statusTone = (s: string) => (s === "Active" ? "good" : s === "Completed" ? "info" : s === "Cancelled" ? "bad" : "warn") as "good" | "info" | "bad" | "warn";

/** Progress against a requirement, as text and a native progress bar (value is never shown by color alone). */
export function HoursProgress({ label, value, required, pending }: { label: string; value: number; required: number; pending?: number }) {
  const t = useCareerT("apprenticeships");
  const fmt = useCareerFormat();
  return (
    <div>
      <p className="text-sm">
        <span className="font-medium">{label}: </span>
        {required > 0 ? t("hoursOf", { hours: fmt.number(value), required: fmt.number(required) }) : t("hoursOnly", { hours: fmt.number(value) })}
        {pending ? ` · ${t("hoursPending", { hours: fmt.number(pending) })}` : ""}
      </p>
      {required > 0 && <progress className="mt-1 h-2 w-full" max={required} value={Math.min(value, required)} aria-label={label} />}
    </div>
  );
}

type Form = {
  email: string; experienceId: string; occupation: string; occupationCode: string; registrationNumber: string; registrationAgency: string;
  sponsorName: string; sponsorContactName: string; sponsorContactEmail: string; approach: string; startDate: string; expectedEndDate: string;
  ojlHoursRequired: string; rtiHoursRequired: string; journeyworkerWage: string; wageSchedule: { step: string; afterOjlHours: string; afterMonths: string; rate: string }[]; status: string;
};

const emptyForm: Form = {
  email: "", experienceId: "", occupation: "", occupationCode: "", registrationNumber: "", registrationAgency: "", sponsorName: "", sponsorContactName: "", sponsorContactEmail: "",
  approach: "TimeBased", startDate: "", expectedEndDate: "", ojlHoursRequired: "2000", rtiHoursRequired: "144", journeyworkerWage: "", wageSchedule: [{ step: "1", afterOjlHours: "0", afterMonths: "", rate: "" }], status: "Active",
};

const fromDto = (a: ApprenticeshipDto): Form => ({
  email: "", experienceId: a.experienceId ?? "", occupation: a.occupation, occupationCode: a.occupationCode ?? "", registrationNumber: a.registrationNumber ?? "", registrationAgency: a.registrationAgency ?? "",
  sponsorName: a.sponsorName, sponsorContactName: a.sponsorContactName, sponsorContactEmail: a.sponsorContactEmail ?? "", approach: a.approach, startDate: a.startDate, expectedEndDate: a.expectedEndDate ?? "",
  ojlHoursRequired: String(a.ojlHoursRequired), rtiHoursRequired: String(a.rtiHoursRequired), journeyworkerWage: a.journeyworkerWage?.toString() ?? "",
  wageSchedule: a.wageSchedule.map((s) => ({ step: String(s.step), afterOjlHours: s.afterOjlHours?.toString() ?? "", afterMonths: s.afterMonths?.toString() ?? "", rate: String(s.rate) })),
  status: a.status,
});

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const toPayload = (f: Form, creating: boolean) => ({
  email: creating ? f.email : undefined, experienceId: creating && f.experienceId ? f.experienceId : undefined, occupation: f.occupation, occupationCode: f.occupationCode || null,
  registrationNumber: f.registrationNumber || null, registrationAgency: f.registrationAgency || null, sponsorName: f.sponsorName || null, sponsorContactName: f.sponsorContactName || null,
  sponsorContactEmail: f.sponsorContactEmail || null, approach: f.approach, startDate: f.startDate || null, expectedEndDate: f.expectedEndDate || null,
  ojlHoursRequired: num(f.ojlHoursRequired), rtiHoursRequired: num(f.rtiHoursRequired), journeyworkerWage: num(f.journeyworkerWage),
  wageSchedule: f.wageSchedule.filter((s) => s.rate.trim() !== "").map((s) => ({ step: Number(s.step), afterOjlHours: num(s.afterOjlHours), afterMonths: num(s.afterMonths), rate: Number(s.rate) })),
  status: creating ? undefined : f.status,
});

function ApprenticeshipForm({ initial, creating, onSubmit, onCancel }: { initial: Form; creating: boolean; onSubmit: (f: Form) => Promise<void>; onCancel?: () => void }) {
  const api = useApi();
  const t = useCareerT("apprenticeships");
  const [f, setF] = useState(initial);
  const [experiences, setExperiences] = useState<{ id: string; roleTitle: string; employerName: string; status: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Form>) => setF({ ...f, ...p });
  const setStep = (i: number, p: Partial<Form["wageSchedule"][number]>) => set({ wageSchedule: f.wageSchedule.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(f);
        } finally {
          setBusy(false);
        }
      }}
    >
      {creating && (
        <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
          <Field label={t("studentEmail")}>{(props) => <input {...props} type="email" required dir="ltr" value={f.email} onChange={(e) => set({ email: e.target.value })} />}</Field>
          <Button
            type="button"
            variant="secondary"
            disabled={!f.email.trim()}
            onClick={async () => setExperiences(await api<{ id: string; roleTitle: string; employerName: string; status: string }[]>(`/api/career/experiences/staff/experiences?q=${encodeURIComponent(f.email.trim())}`).catch(() => []))}
          >
            {t("findExperiences")}
          </Button>
          {experiences && (
            <Field label={t("linkExperience")} hint={t("linkExperienceHint")}>
              {(props) => (
                <select {...props} value={f.experienceId} onChange={(e) => set({ experienceId: e.target.value })}>
                  <option value="">{t("noExperience")}</option>
                  {experiences.map((x) => (
                    <option key={x.id} value={x.id}>{t("experienceOption", { role: x.roleTitle, employer: x.employerName, status: x.status })}</option>
                  ))}
                </select>
              )}
            </Field>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("occupation")}>{(props) => <input {...props} required value={f.occupation} onChange={(e) => set({ occupation: e.target.value })} />}</Field>
        <Field label={t("occupationCode")} hint={t("occupationCodeHint")}>{(props) => <input {...props} dir="ltr" value={f.occupationCode} onChange={(e) => set({ occupationCode: e.target.value })} />}</Field>
        <Field label={t("registrationNumber")}>{(props) => <input {...props} dir="ltr" value={f.registrationNumber} onChange={(e) => set({ registrationNumber: e.target.value })} />}</Field>
        <Field label={t("registrationAgency")} hint={t("registrationAgencyHint")}>{(props) => <input {...props} value={f.registrationAgency} onChange={(e) => set({ registrationAgency: e.target.value })} />}</Field>
        <Field label={t("sponsorName")} hint={creating ? t("sponsorFromExperience") : undefined}>{(props) => <input {...props} value={f.sponsorName} onChange={(e) => set({ sponsorName: e.target.value })} />}</Field>
        <Field label={t("sponsorContactName")}>{(props) => <input {...props} value={f.sponsorContactName} onChange={(e) => set({ sponsorContactName: e.target.value })} />}</Field>
        <Field label={t("sponsorContactEmail")}>{(props) => <input {...props} type="email" dir="ltr" value={f.sponsorContactEmail} onChange={(e) => set({ sponsorContactEmail: e.target.value })} />}</Field>
        <Field label={t("approach")}>
          {(props) => (
            <select {...props} value={f.approach} onChange={(e) => set({ approach: e.target.value })}>
              {["TimeBased", "CompetencyBased", "Hybrid"].map((a) => (
                <option key={a} value={a}>{t(`approaches.${a}`)}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("startDate")}>{(props) => <input {...props} type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />}</Field>
        <Field label={t("expectedEndDate")}>{(props) => <input {...props} type="date" value={f.expectedEndDate} onChange={(e) => set({ expectedEndDate: e.target.value })} />}</Field>
        <Field label={t("ojlRequired")}>{(props) => <input {...props} type="number" min={0} value={f.ojlHoursRequired} onChange={(e) => set({ ojlHoursRequired: e.target.value })} />}</Field>
        <Field label={t("rtiRequired")}>{(props) => <input {...props} type="number" min={0} value={f.rtiHoursRequired} onChange={(e) => set({ rtiHoursRequired: e.target.value })} />}</Field>
        <Field label={t("journeyworkerWage")}>{(props) => <input {...props} type="number" min={0} step="0.01" value={f.journeyworkerWage} onChange={(e) => set({ journeyworkerWage: e.target.value })} />}</Field>
        {!creating && (
          <Field label={t("status")} hint={t("statusHint")}>
            {(props) => (
              <select {...props} value={f.status} onChange={(e) => set({ status: e.target.value })}>
                {STATUSES.filter((s) => s !== "Completed" || f.status === "Completed").map((s) => (
                  <option key={s} value={s}>{t(`statuses.${s}`)}</option>
                ))}
              </select>
            )}
          </Field>
        )}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("wageSchedule")}</legend>
        <p className="text-xs text-muted-foreground">{t("wageScheduleHint")}</p>
        {f.wageSchedule.map((s, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-5 sm:items-end">
            <Field label={t("stepNumber", { n: i + 1 })}>{(props) => <input {...props} type="number" min={1} value={s.step} onChange={(e) => setStep(i, { step: e.target.value })} />}</Field>
            <Field label={t("afterOjlHours")}>{(props) => <input {...props} type="number" min={0} value={s.afterOjlHours} onChange={(e) => setStep(i, { afterOjlHours: e.target.value })} />}</Field>
            <Field label={t("afterMonths")}>{(props) => <input {...props} type="number" min={0} value={s.afterMonths} onChange={(e) => setStep(i, { afterMonths: e.target.value })} />}</Field>
            <Field label={t("hourlyRate")}>{(props) => <input {...props} type="number" min={0} step="0.01" value={s.rate} onChange={(e) => setStep(i, { rate: e.target.value })} />}</Field>
            <Button type="button" variant="ghost" onClick={() => set({ wageSchedule: f.wageSchedule.filter((_, j) => j !== i) })} aria-label={t("removeStep", { n: i + 1 })}>
              {t("remove")}
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => set({ wageSchedule: [...f.wageSchedule, { step: String(f.wageSchedule.length + 1), afterOjlHours: "", afterMonths: "", rate: "" }] })}>
          {t("addStep")}
        </Button>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={busy}>{creating ? t("create") : t("save")}</Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>{t("cancel")}</Button>}
      </div>
    </form>
  );
}

function Detail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const api = useApi();
  const t = useCareerT("apprenticeships");
  const fmt = useCareerFormat();
  const dateOnly = useDateOnly();
  const detail = useLoad(() => api<ApprenticeshipDto>(`/api/career/workforce/apprenticeships/${id}`), [api, id]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [hours, setHours] = useState({ kind: "RTI", date: "", hours: "", description: "" });
  const [wage, setWage] = useState({ effectiveDate: "", hourlyRate: "", step: "" });
  const [req, setReq] = useState({ kind: "ProgressReview", proposedRate: "", proposedStep: "", effectiveDate: "", year: "", note: "" });
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(success);
      detail.reload();
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (detail.loading && !detail.data) return <Loading />;
  if (!detail.data) return <ErrorBanner error={detail.error} onRetry={detail.reload} />;
  const a = detail.data;
  const p = a.progress;
  const open = a.status === "Active" || a.status === "Suspended";
  const money = (v?: number | null) => (v === null || v === undefined ? "—" : fmt.currency(v, "USD"));

  return (
    <Card title={t("detailTitle", { name: a.studentName, occupation: a.occupation })} actions={<Button variant="ghost" onClick={onClose}>{t("close")}</Button>}>
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      <div className="space-y-6">
        <section aria-labelledby="ap-progress" className="space-y-3">
          <h3 id="ap-progress" className="font-semibold">{t("progressTitle")}</h3>
          <p className="text-sm">
            <Badge tone={statusTone(a.status)}>{t(`statuses.${a.status}`)}</Badge>{" "}
            {t("sponsorLine", { sponsor: a.sponsorName, contact: a.sponsorContactName })}
            {a.registrationNumber ? ` · ${t("registrationLine", { number: a.registrationNumber })}` : ""}
          </p>
          <HoursProgress label={t("ojlLabel")} value={p.ojlHours} required={a.ojlHoursRequired} />
          {a.experienceId && <p className="text-xs text-muted-foreground">{t("ojlSplit", { fromExperience: fmt.number(p.ojlFromExperience), staff: fmt.number(p.ojlStaffEntered) })}</p>}
          <HoursProgress label={t("rtiLabel")} value={p.rtiHours} required={a.rtiHoursRequired} pending={p.rtiPending} />
          <p className="text-sm">
            {t("currentWage", { rate: money(p.currentRate), step: p.currentStep ?? "—" })}
            {p.percentOfJourneyworker != null ? ` · ${t("percentOfJourneyworker", { percent: p.percentOfJourneyworker })}` : ""}
          </p>
          {p.stepsDue.length > 0 && (
            <p className="text-sm" role="status">
              <Badge tone="warn">{t("stepDue")}</Badge> {t("stepsDueLine", { steps: p.stepsDue.map((s) => t("stepRate", { step: s.step, rate: money(s.rate) })).join(", ") })}
            </p>
          )}
          {!a.sponsorConsent && <p className="text-sm text-muted-foreground">{t("noConsent")}</p>}
          {a.warnings.length > 0 && (
            <ul className="list-disc space-y-1 ps-5 text-sm text-amber-800 dark:text-amber-300">
              {a.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </section>

        <section aria-labelledby="ap-hours">
          <h3 id="ap-hours" className="mb-2 font-semibold">{t("hoursTitle")}</h3>
          {a.hours.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noHours")}</p>
          ) : (
            <ScrollArea>
              <table className="w-full text-sm [&_th]:text-start">
                <caption className="sr-only">{t("hoursTitle")}</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1 pe-3">{t("kindCol")}</th>
                    <th className="py-1 pe-3">{t("dateCol")}</th>
                    <th className="py-1 pe-3">{t("hoursCol")}</th>
                    <th className="py-1 pe-3">{t("descriptionCol")}</th>
                    <th className="py-1 pe-3">{t("statusCol")}</th>
                    <th className="py-1">{t("actionsCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {a.hours.map((h) => (
                    <tr key={h.id} className="border-b border-border align-top">
                      <td className="py-1 pe-3">{t(`kinds.${h.kind}`)}</td>
                      <td className="py-1 pe-3">{dateOnly(h.date)}</td>
                      <td className="py-1 pe-3">{fmt.number(h.hours)}</td>
                      <td className="py-1 pe-3">{h.description ?? "—"}{h.decisionNote ? ` (${h.decisionNote})` : ""}</td>
                      <td className="py-1 pe-3">{t(`hourStatus.${h.status}`)}</td>
                      <td className="py-1">
                        {h.status === "Pending" && rejecting !== h.id && (
                          <div className="flex flex-wrap gap-1">
                            <Button variant="secondary" onClick={() => run(() => api(`/api/career/workforce/apprenticeships/${a.id}/hours/${h.id}/decision`, { json: { approve: true } }), t("approved"))}>
                              {t("approve")}
                            </Button>
                            <Button variant="ghost" onClick={() => setRejecting(h.id)}>{t("reject")}</Button>
                          </div>
                        )}
                        {rejecting === h.id && (
                          <form
                            className="flex flex-wrap items-end gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void run(async () => {
                                await api(`/api/career/workforce/apprenticeships/${a.id}/hours/${h.id}/decision`, { json: { approve: false, note } });
                                setRejecting(null);
                                setNote("");
                              }, t("rejected"));
                            }}
                          >
                            <Field label={t("rejectNote")}>{(props) => <input {...props} required value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
                            <Button type="submit" variant="danger">{t("reject")}</Button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
          {open && (
            <form
              className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => api(`/api/career/workforce/apprenticeships/${a.id}/hours`, { json: { kind: hours.kind, date: hours.date || null, hours: num(hours.hours), description: hours.description || null } }), t("hoursAdded"));
              }}
            >
              <Field label={t("kindCol")}>
                {(props) => (
                  <select {...props} value={hours.kind} onChange={(e) => setHours({ ...hours, kind: e.target.value })}>
                    <option value="RTI">{t("kinds.RTI")}</option>
                    <option value="OJL">{t("kinds.OJL")}</option>
                  </select>
                )}
              </Field>
              <Field label={t("dateCol")}>{(props) => <input {...props} type="date" required value={hours.date} onChange={(e) => setHours({ ...hours, date: e.target.value })} />}</Field>
              <Field label={t("hoursCol")}>{(props) => <input {...props} type="number" min={0} step="0.25" required value={hours.hours} onChange={(e) => setHours({ ...hours, hours: e.target.value })} />}</Field>
              <Field label={t("descriptionCol")}>{(props) => <input {...props} value={hours.description} onChange={(e) => setHours({ ...hours, description: e.target.value })} />}</Field>
              <Button type="submit">{t("addHours")}</Button>
            </form>
          )}
        </section>

        <section aria-labelledby="ap-wages">
          <h3 id="ap-wages" className="mb-2 font-semibold">{t("wagesTitle")}</h3>
          {a.wages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noWages")}</p>
          ) : (
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {a.wages.map((w) => (
                <li key={w.id}>
                  {t("wageLine", { date: dateOnly(w.effectiveDate), rate: money(w.hourlyRate), step: w.step ?? "—" })} <Badge tone={w.source === "SponsorSignoff" ? "good" : "neutral"}>{t(`wageSources.${w.source}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
          {open && (
            <form
              className="mt-3 grid gap-3 sm:grid-cols-4 sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => api(`/api/career/workforce/apprenticeships/${a.id}/wages`, { json: { effectiveDate: wage.effectiveDate || null, hourlyRate: num(wage.hourlyRate), step: num(wage.step) } }), t("wageRecorded"));
              }}
            >
              <Field label={t("effectiveDate")}>{(props) => <input {...props} type="date" value={wage.effectiveDate} onChange={(e) => setWage({ ...wage, effectiveDate: e.target.value })} />}</Field>
              <Field label={t("hourlyRate")}>{(props) => <input {...props} type="number" min={0} step="0.01" required value={wage.hourlyRate} onChange={(e) => setWage({ ...wage, hourlyRate: e.target.value })} />}</Field>
              <Field label={t("step")}>{(props) => <input {...props} type="number" min={1} value={wage.step} onChange={(e) => setWage({ ...wage, step: e.target.value })} />}</Field>
              <Button type="submit">{t("recordWage")}</Button>
            </form>
          )}
        </section>

        <section aria-labelledby="ap-signoffs">
          <h3 id="ap-signoffs" className="mb-2 font-semibold">{t("signoffsTitle")}</h3>
          <p className="mb-2 text-xs text-muted-foreground">{t("signoffsHint")}</p>
          {a.signoffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noSignoffs")}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {a.signoffs.map((s) => (
                <li key={s.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t(`signoffKinds.${s.kind}`)}</span>
                    <Badge tone={s.revoked ? "neutral" : s.status === "Approved" ? "good" : s.status === "Declined" ? "bad" : "warn"}>
                      {s.revoked ? t("withdrawn") : t(`signoffStatus.${s.status}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {s.signedAt ? t("signedBy", { name: s.signerName ?? "", date: fmt.dateTime(s.signedAt) }) : t("requestedOn", { date: fmt.dateTime(s.issuedAt) })}
                    </span>
                    {s.status === "Pending" && !s.revoked && (
                      <Button variant="ghost" onClick={() => run(() => api(`/api/career/workforce/apprenticeships/${a.id}/signoffs/${s.id}/revoke`, { method: "POST" }), t("withdrawnMsg"))}>
                        {t("withdraw")}
                      </Button>
                    )}
                  </div>
                  {s.sponsorNote && <p className="mt-1">{t("sponsorNote", { note: s.sponsorNote })}</p>}
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs underline">{t("showStatement")}</summary>
                    <p className="mt-1 whitespace-pre-line text-xs">{s.statement}</p>
                  </details>
                </li>
              ))}
            </ul>
          )}
          {open && (
            <form
              className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  () => api(`/api/career/workforce/apprenticeships/${a.id}/signoffs`, {
                    json: { kind: req.kind, proposedRate: num(req.proposedRate), proposedStep: num(req.proposedStep), effectiveDate: req.effectiveDate || null, year: num(req.year), note: req.note || null },
                  }),
                  t("requestSent"),
                );
              }}
            >
              <Field label={t("signoffKind")}>
                {(props) => (
                  <select {...props} value={req.kind} onChange={(e) => setReq({ ...req, kind: e.target.value })}>
                    {KINDS.map((k) => <option key={k} value={k}>{t(`signoffKinds.${k}`)}</option>)}
                  </select>
                )}
              </Field>
              {req.kind === "WageIncrease" && (
                <>
                  <Field label={t("hourlyRate")}>{(props) => <input {...props} type="number" min={0} step="0.01" required value={req.proposedRate} onChange={(e) => setReq({ ...req, proposedRate: e.target.value })} />}</Field>
                  <Field label={t("step")}>{(props) => <input {...props} type="number" min={1} value={req.proposedStep} onChange={(e) => setReq({ ...req, proposedStep: e.target.value })} />}</Field>
                  <Field label={t("effectiveDate")}>{(props) => <input {...props} type="date" value={req.effectiveDate} onChange={(e) => setReq({ ...req, effectiveDate: e.target.value })} />}</Field>
                </>
              )}
              {req.kind === "YearCompleted" && (
                <Field label={t("year")}>{(props) => <input {...props} type="number" min={1} max={10} value={req.year} onChange={(e) => setReq({ ...req, year: e.target.value })} />}</Field>
              )}
              <Field label={t("noteToSponsor")}>{(props) => <input {...props} value={req.note} onChange={(e) => setReq({ ...req, note: e.target.value })} />}</Field>
              <Button type="submit" disabled={!a.sponsorConsent}>{t("requestSignoff")}</Button>
            </form>
          )}
        </section>

        <section aria-labelledby="ap-edit">
          <h3 id="ap-edit" className="mb-2 font-semibold">{t("editTitle")}</h3>
          <ApprenticeshipForm
            key={a.id + a.status}
            initial={fromDto(a)}
            creating={false}
            onSubmit={(f) => run(() => api(`/api/career/workforce/apprenticeships/${a.id}`, { method: "PUT", json: toPayload(f, false) }), t("saved"))}
          />
        </section>
      </div>
    </Card>
  );
}

export function ApprenticeshipsStaff() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const t = useCareerT("apprenticeships");
  const dateOnly = useDateOnly();
  const [status, setStatus] = useState("");
  const list = useLoad(() => api<Row[]>(`/api/career/workforce/apprenticeships${status ? `?status=${status}` : ""}`), [api, schoolId, status]);
  const [creating, setCreating] = useState(false);
  // Deep link: #<apprenticeship id>
  const hash = useLocationHash();
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const selected = picked === undefined ? hash || null : picked;
  const setSelected = (id: string | null) => {
    setPicked(id);
    setLocationHash(id);
  };
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Field label={t("statusFilter")}>
            {(props) => (
              <select {...props} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{t("allStatuses")}</option>
                {STATUSES.map((s) => <option key={s} value={s}>{t(`statuses.${s}`)}</option>)}
              </select>
            )}
          </Field>
        </div>
        {!creating && <Button onClick={() => setCreating(true)}>{t("add")}</Button>}
      </div>
      {creating && (
        <Card title={t("addTitle")}>
          <ApprenticeshipForm
            initial={emptyForm}
            creating
            onCancel={() => setCreating(false)}
            onSubmit={async (f) => {
              setErr(null);
              setMsg(null);
              try {
                const a = await api<ApprenticeshipDto>("/api/career/workforce/apprenticeships", { json: toPayload(f, true) });
                setCreating(false);
                setSelected(a.id);
                setMsg(t("created"));
                list.reload();
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          />
        </Card>
      )}
      {selected && <Detail id={selected} onClose={() => setSelected(null)} onChanged={list.reload} />}
      <ErrorBanner error={list.error} onRetry={list.reload} />
      {list.loading && !list.data ? (
        <Loading />
      ) : !list.data?.length ? (
        <EmptyState title={t("none")}>{t("noneHint")}</EmptyState>
      ) : (
        <ScrollArea>
          <table className="w-full text-sm [&_th]:text-start">
            <caption className="sr-only">{t("caption")}</caption>
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pe-3">{t("apprenticeCol")}</th>
                <th className="py-2 pe-3">{t("occupation")}</th>
                <th className="py-2 pe-3">{t("sponsorName")}</th>
                <th className="py-2 pe-3">{t("startDate")}</th>
                <th className="py-2 pe-3">{t("statusCol")}</th>
                <th className="py-2 pe-3">{t("waitingCol")}</th>
                <th className="py-2">{t("actionsCol")}</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((r) => (
                <tr key={r.id} className="border-b border-border">
                  <td className="py-2 pe-3"><bdi>{r.studentName}</bdi></td>
                  <td className="py-2 pe-3">{r.occupation}</td>
                  <td className="py-2 pe-3">{r.sponsorName}</td>
                  <td className="py-2 pe-3">{dateOnly(r.startDate)}</td>
                  <td className="py-2 pe-3"><Badge tone={statusTone(r.status)}>{t(`statuses.${r.status}`)}</Badge></td>
                  <td className="py-2 pe-3">{t("waiting", { signoffs: r.pendingSignoffs, hours: r.pendingHours })}</td>
                  <td className="py-2">
                    <Button variant="secondary" onClick={() => setSelected(r.id)} aria-label={t("openFor", { name: r.studentName })}>{t("open")}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </div>
  );
}
