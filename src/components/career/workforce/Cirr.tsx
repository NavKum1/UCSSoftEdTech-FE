"use client";

/**
 * G16 bootcamp and online-program cohorts with CIRR-style outcomes: enrollment, on-time graduation, outcome categories
 * with CIRR's documentation rules, placement within 90/180/360 days, base-salary median and employer challenges (D7).
 */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, ScrollArea, SuccessBanner, useCareerFormat, useCareerT, useLoad } from "@/components/career/ui";
import { ReportTableView, type ReportTable } from "@/components/career/reports/ReportTableView";
import { VerifyNotice } from "@/components/career/international/WorkRights";
import { FactList, SourceList, checkboxClass, setLocationHash, useDateOnly, useDownload, useIsCareerAdmin, useLocationHash, type Fact, type Source } from "./shared";

export interface CirrDefinitions {
  reviewedOn: string;
  verifyFormat: string;
  label: string;
  rules: Fact[];
  sources: Source[];
  categories: { code: string; label: string }[];
  documentationSources: string[];
  intents: string[];
  windows: number[];
}

interface Cohort {
  id: string;
  name: string;
  programName: string;
  kind: string;
  startDate: string;
  publishedLengthDays?: number | null;
  onTimeBy?: string | null;
  members: number;
}

interface Member {
  id: string;
  studentUserId: string;
  studentName?: string | null;
  studentEmail?: string | null;
  enrollmentStatus: string;
  graduationDate?: string | null;
  intent?: string | null;
  authorizedStudyCountry?: boolean | null;
  authorizedSearchCountry?: boolean | null;
  hiredBySchool: boolean;
  outcomeCategory?: string | null;
  effectiveCategory?: string | null;
  offerOrStartDate?: string | null;
  paid?: boolean | null;
  inField?: boolean | null;
  baseSalary?: number | null;
  employerName?: string | null;
  jobTitle?: string | null;
  socCode?: string | null;
  documentationSource?: string | null;
  documentationNote?: string | null;
  contactAttempts: number;
  contactMethods: number;
}

interface CohortDetailDto {
  cohort: Cohort;
  members: Member[];
  challenges: { challengeId: string; title: string; employer?: string | null; status: string; closesAt: string; cohortParticipants: number }[];
}

interface Report {
  label: string;
  filters: { cohortId: string | null; year: number | null; cohorts: { id: string; name: string; startDate: string }[] };
  totals: { enrolled: number; graduates: number; onTime: number; counted: number; intentMissing: number; notCounted: number };
  tables: ReportTable[];
  notes: string[];
}

const ENROLLMENT = ["Enrolled", "Withdrew", "Graduated", "NotCounted"];
const yesNo = (v: boolean | null | undefined) => (v === true ? "yes" : v === false ? "no" : "");

/** Member outcome editor (CIRR documentation rules are enforced by the API; messages explain what is missing). */
function MemberEditor({ cohortId, m, defs, onSaved, onCancel }: { cohortId: string; m: Member; defs: CirrDefinitions; onSaved: () => void; onCancel: () => void }) {
  const api = useApi();
  const t = useCareerT("cirr");
  const [f, setF] = useState({
    enrollmentStatus: m.enrollmentStatus, graduationDate: m.graduationDate ?? "", intent: m.intent ?? "", authorizedStudyCountry: yesNo(m.authorizedStudyCountry), authorizedSearchCountry: yesNo(m.authorizedSearchCountry),
    hiredBySchool: m.hiredBySchool, outcomeCategory: m.outcomeCategory ?? "", offerOrStartDate: m.offerOrStartDate ?? "", paid: m.paid ?? false, inField: yesNo(m.inField),
    baseSalary: m.baseSalary?.toString() ?? "", employerName: m.employerName ?? "", jobTitle: m.jobTitle ?? "", socCode: m.socCode ?? "", documentationSource: m.documentationSource ?? "",
    documentationNote: m.documentationNote ?? "", contactAttempts: String(m.contactAttempts), contactMethods: String(m.contactMethods),
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const bool = (v: string) => (v === "yes" ? true : v === "no" ? false : null);
  const grad = f.enrollmentStatus === "Graduated";
  const job = ["1A", "1B", "1C", "2A"].includes(f.outcomeCategory);
  const tri = (label: string, value: string, onChange: (v: string) => void) => (
    <Field label={label}>
      {(props) => (
        <select {...props} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t("unknown")}</option>
          <option value="yes">{t("yes")}</option>
          <option value="no">{t("no")}</option>
        </select>
      )}
    </Field>
  );
  return (
    <form
      className="space-y-3 rounded-lg border border-border p-3"
      aria-label={t("editMember", { name: m.studentName ?? m.studentEmail ?? "" })}
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        setBusy(true);
        try {
          await api(`/api/career/workforce/cohorts/${cohortId}/members/${m.id}`, {
            method: "PUT",
            json: {
              enrollmentStatus: f.enrollmentStatus, graduationDate: grad ? f.graduationDate || null : null, intent: f.intent || null,
              authorizedStudyCountry: bool(f.authorizedStudyCountry), authorizedSearchCountry: bool(f.authorizedSearchCountry), hiredBySchool: f.hiredBySchool,
              outcomeCategory: grad ? f.outcomeCategory || null : null, offerOrStartDate: f.offerOrStartDate || null, paid: job ? f.paid : null, inField: bool(f.inField),
              baseSalary: job && f.baseSalary !== "" ? Number(f.baseSalary) : null, employerName: f.employerName || null, jobTitle: f.jobTitle || null, socCode: f.socCode || null,
              documentationSource: f.documentationSource || null, documentationNote: f.documentationNote || null, contactAttempts: Number(f.contactAttempts) || 0, contactMethods: Number(f.contactMethods) || 0,
            },
          });
          onSaved();
        } catch (ex) {
          setErr((ex as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h4 className="font-semibold">{t("editMember", { name: m.studentName ?? m.studentEmail ?? "" })}</h4>
      <div aria-live="polite"><ErrorBanner error={err} /></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("enrollmentStatus")}>
          {(props) => (
            <select {...props} value={f.enrollmentStatus} onChange={(e) => set({ enrollmentStatus: e.target.value })}>
              {ENROLLMENT.map((s) => <option key={s} value={s}>{t(`enrollment.${s}`)}</option>)}
            </select>
          )}
        </Field>
        {grad && <Field label={t("graduationDate")}>{(props) => <input {...props} type="date" required value={f.graduationDate} onChange={(e) => set({ graduationDate: e.target.value })} />}</Field>}
        <Field label={t("intent")} hint={t("intentHint")}>
          {(props) => (
            <select {...props} value={f.intent} onChange={(e) => set({ intent: e.target.value })}>
              <option value="">{t("notRecorded")}</option>
              {defs.intents.map((i) => <option key={i} value={i}>{t(`intents.${i}`)}</option>)}
            </select>
          )}
        </Field>
        {tri(t("authorizedStudy"), f.authorizedStudyCountry, (v) => set({ authorizedStudyCountry: v }))}
        {tri(t("authorizedSearch"), f.authorizedSearchCountry, (v) => set({ authorizedSearchCountry: v }))}
      </div>
      <div className="flex items-center gap-2">
        <input id={`hired-${m.id}`} type="checkbox" className={checkboxClass} checked={f.hiredBySchool} onChange={(e) => set({ hiredBySchool: e.target.checked })} />
        <label htmlFor={`hired-${m.id}`} className="text-sm">{t("hiredBySchool")}</label>
      </div>
      {grad && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{t("outcomeLegend")}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("outcome")} hint={t("outcomeHint")}>
              {(props) => (
                <select {...props} value={f.outcomeCategory} onChange={(e) => set({ outcomeCategory: e.target.value })}>
                  <option value="">{t("outcomeAuto")}</option>
                  {defs.categories.map((c) => <option key={c.code} value={c.code}>{t("categoryOption", { code: c.code, label: t(`categories.c${c.code}`) })}</option>)}
                </select>
              )}
            </Field>
            {(job || f.outcomeCategory === "1D") && (
              <Field label={t("offerOrStartDate")} hint={t("offerOrStartHint")}>{(props) => <input {...props} type="date" value={f.offerOrStartDate} onChange={(e) => set({ offerOrStartDate: e.target.value })} />}</Field>
            )}
            {job && (
              <>
                <Field label={t("baseSalary")} hint={t("baseSalaryHint")}>{(props) => <input {...props} type="number" min={0} step="1" value={f.baseSalary} onChange={(e) => set({ baseSalary: e.target.value })} />}</Field>
                <Field label={t("employerName")}>{(props) => <input {...props} value={f.employerName} onChange={(e) => set({ employerName: e.target.value })} />}</Field>
                <Field label={t("jobTitle")}>{(props) => <input {...props} value={f.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} />}</Field>
                <Field label={t("socCode")} hint={t("socCodeHint")}>{(props) => <input {...props} dir="ltr" value={f.socCode} onChange={(e) => set({ socCode: e.target.value })} />}</Field>
                {tri(t("inField"), f.inField, (v) => set({ inField: v }))}
              </>
            )}
            <Field label={t("documentationSource")}>
              {(props) => (
                <select {...props} value={f.documentationSource} onChange={(e) => set({ documentationSource: e.target.value })}>
                  <option value="">{t("noDocumentation")}</option>
                  {defs.documentationSources.map((d) => <option key={d} value={d}>{t(`docSources.${d}`)}</option>)}
                </select>
              )}
            </Field>
            <Field label={t("documentationNote")}>{(props) => <input {...props} value={f.documentationNote} onChange={(e) => set({ documentationNote: e.target.value })} />}</Field>
            <Field label={t("contactAttempts")}>{(props) => <input {...props} type="number" min={0} value={f.contactAttempts} onChange={(e) => set({ contactAttempts: e.target.value })} />}</Field>
            <Field label={t("contactMethods")}>{(props) => <input {...props} type="number" min={0} value={f.contactMethods} onChange={(e) => set({ contactMethods: e.target.value })} />}</Field>
          </div>
          {job && (
            <div className="flex items-center gap-2">
              <input id={`paid-${m.id}`} type="checkbox" className={checkboxClass} checked={f.paid} onChange={(e) => set({ paid: e.target.checked })} />
              <label htmlFor={`paid-${m.id}`} className="text-sm">{t("paid")}</label>
            </div>
          )}
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={busy}>{t("saveMember")}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t("cancel")}</Button>
      </div>
    </form>
  );
}

function CohortDetail({ id, defs, onChanged }: { id: string; defs: CirrDefinitions; onChanged: () => void }) {
  const api = useApi();
  const t = useCareerT("cirr");
  const fmt = useCareerFormat();
  const dateOnly = useDateOnly();
  const detail = useLoad(() => api<CohortDetailDto>(`/api/career/workforce/cohorts/${id}`), [api, id]);
  const options = useLoad(() => api<{ id: string; title: string; status: string; linked: boolean }[]>(`/api/career/workforce/cohorts/${id}/challenge-options`), [api, id]);
  const [emails, setEmails] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [challenge, setChallenge] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, success: string | ((r: unknown) => string)) => {
    setErr(null);
    setMsg(null);
    try {
      const r = await fn();
      setMsg(typeof success === "function" ? success(r) : success);
      detail.reload();
      options.reload();
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (detail.loading && !detail.data) return <Loading />;
  if (!detail.data) return <ErrorBanner error={detail.error} onRetry={detail.reload} />;
  const { cohort, members, challenges } = detail.data;

  return (
    <Card title={t("cohortTitle", { name: cohort.name, program: cohort.programName })}>
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      <p className="mb-4 text-sm">
        {cohort.kind === "FixedLength"
          ? t("cohortFixed", { start: dateOnly(cohort.startDate), days: cohort.publishedLengthDays ?? 0, onTimeBy: dateOnly(cohort.onTimeBy) })
          : t("cohortSelfPaced", { start: dateOnly(cohort.startDate) })}
      </p>
      <div className="space-y-6">
        <section aria-labelledby="ch-members">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 id="ch-members" className="font-semibold">{t("membersTitle", { count: members.length })}</h3>
            <Button variant="secondary" onClick={() => run(() => api<{ applied: number; suggestions: unknown[] }>(`/api/career/workforce/cohorts/${id}/prefill-outcomes`, { method: "POST" }), (r) => t("prefillResult", { applied: (r as { applied: number }).applied, suggestions: (r as { suggestions: unknown[] }).suggestions.length }))}>
              {t("prefill")}
            </Button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">{t("prefillHint")}</p>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noMembers")}</p>
          ) : (
            <ScrollArea>
              <table className="w-full text-sm [&_th]:text-start">
                <caption className="sr-only">{t("membersCaption")}</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1 pe-3">{t("nameCol")}</th>
                    <th className="py-1 pe-3">{t("enrollmentStatus")}</th>
                    <th className="py-1 pe-3">{t("graduationDate")}</th>
                    <th className="py-1 pe-3">{t("outcome")}</th>
                    <th className="py-1 pe-3">{t("baseSalary")}</th>
                    <th className="py-1">{t("actionsCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-border align-top">
                      <td className="py-1 pe-3"><bdi>{m.studentName ?? m.studentEmail}</bdi></td>
                      <td className="py-1 pe-3">{t(`enrollment.${m.enrollmentStatus}`)}</td>
                      <td className="py-1 pe-3">{dateOnly(m.graduationDate)}</td>
                      <td className="py-1 pe-3">
                        {m.effectiveCategory ? (
                          <span className="inline-flex flex-wrap items-center gap-1">
                            {t("categoryOption", { code: m.effectiveCategory, label: t(`categories.c${m.effectiveCategory}`) })}
                            {!m.outcomeCategory && <Badge tone="neutral">{t("automatic")}</Badge>}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-1 pe-3">{m.baseSalary ? fmt.currency(m.baseSalary, "USD") : "—"}</td>
                      <td className="py-1">
                        <div className="flex flex-wrap gap-1">
                          <Button variant="secondary" onClick={() => setEditing(editing === m.id ? null : m.id)} aria-label={t("editMember", { name: m.studentName ?? m.studentEmail ?? "" })}>{t("edit")}</Button>
                          <Button variant="ghost" onClick={() => run(() => api(`/api/career/workforce/cohorts/${id}/members/${m.id}`, { method: "DELETE" }), t("removed"))} aria-label={t("removeMember", { name: m.studentName ?? m.studentEmail ?? "" })}>{t("remove")}</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
          {members.filter((m) => m.id === editing).map((m) => (
            <div key={`ed-${m.id}`} className="mt-3">
              <MemberEditor cohortId={id} m={m} defs={defs} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setMsg(t("memberSaved")); detail.reload(); onChanged(); }} />
            </div>
          ))}
          <form
            className="mt-3 grid gap-3 sm:grid-cols-3 sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await api<{ added: number; skipped: unknown[] }>(`/api/career/workforce/cohorts/${id}/members`, { json: { emails: emails.split(/[\s,;]+/).filter(Boolean) } });
                setEmails("");
                return r;
              }, (r) => t("membersAdded", { added: (r as { added: number }).added, skipped: (r as { skipped: unknown[] }).skipped.length }));
            }}
          >
            <div className="sm:col-span-2">
              <Field label={t("addMembers")} hint={t("addMembersHint")}>{(props) => <textarea {...props} rows={2} dir="ltr" required value={emails} onChange={(e) => setEmails(e.target.value)} />}</Field>
            </div>
            <Button type="submit">{t("addMembersButton")}</Button>
          </form>
        </section>

        <section aria-labelledby="ch-challenges">
          <h3 id="ch-challenges" className="mb-1 font-semibold">{t("challengesTitle")}</h3>
          <p className="mb-2 text-xs text-muted-foreground">{t("challengesHint")}</p>
          {challenges.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noChallenges")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {challenges.map((c) => (
                <li key={c.challengeId} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.title}</span>
                  {c.employer && <span className="text-muted-foreground">{c.employer}</span>}
                  <span>{t("participants", { count: c.cohortParticipants })}</span>
                  <Button variant="ghost" onClick={() => run(() => api(`/api/career/workforce/cohorts/${id}/challenges/${c.challengeId}`, { method: "DELETE" }), t("unlinked"))} aria-label={t("unlinkFor", { title: c.title })}>{t("unlink")}</Button>
                </li>
              ))}
            </ul>
          )}
          {(options.data ?? []).some((o) => !o.linked) && (
            <form
              className="mt-3 flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (challenge) void run(() => api(`/api/career/workforce/cohorts/${id}/challenges`, { json: { challengeId: challenge } }), t("linked"));
              }}
            >
              <div className="min-w-64">
                <Field label={t("linkChallenge")}>
                  {(props) => (
                    <select {...props} value={challenge} onChange={(e) => setChallenge(e.target.value)}>
                      <option value="">{t("chooseChallenge")}</option>
                      {(options.data ?? []).filter((o) => !o.linked).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                    </select>
                  )}
                </Field>
              </div>
              <Button type="submit" disabled={!challenge}>{t("link")}</Button>
            </form>
          )}
        </section>
      </div>
    </Card>
  );
}

export function CirrPanel({ defs }: { defs: CirrDefinitions }) {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const t = useCareerT("cirr");
  const dateOnly = useDateOnly();
  const isAdmin = useIsCareerAdmin();
  const { busy, error: dlError, download } = useDownload();
  const cohorts = useLoad(() => api<Cohort[]>("/api/career/workforce/cohorts"), [api, schoolId]);
  // Deep link: #<cohort id>
  const hash = useLocationHash();
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const selected = picked === undefined ? hash || null : picked;
  const setSelected = (id: string | null) => {
    setPicked(id);
    setLocationHash(id);
  };
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", programName: "", kind: "FixedLength", startDate: "", publishedLengthDays: "", notes: "" });
  const [filter, setFilter] = useState({ cohortId: "", year: "" });
  const [applied, setApplied] = useState(filter);
  const q = new URLSearchParams({ ...(applied.cohortId ? { cohortId: applied.cohortId } : {}), ...(applied.year ? { year: applied.year } : {}) }).toString();
  const report = useLoad(() => api<Report>(`/api/career/workforce/cirr/report?${q}`), [api, schoolId, q]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const years = Array.from({ length: 6 }, (_, i) => new Date().getUTCFullYear() - i);

  const exportFile = async (format: "csv" | "xlsx", detail: boolean) => {
    setMsg(null);
    if (await download(`${format}-${detail}`, `/api/career/workforce/cirr/report/export?${q}&format=${format}${detail ? "&detail=true" : ""}`, `cirr-style.${format}`)) setMsg(t("downloadStarted"));
  };

  return (
    <div className="space-y-6">
      <VerifyNotice text={defs.verifyFormat} />
      <div aria-live="polite">
        <ErrorBanner error={err ?? dlError} />
        <SuccessBanner message={msg} />
      </div>

      <Card title={t("cohortsTitle")} actions={!creating ? <Button onClick={() => setCreating(true)}>{t("newCohort")}</Button> : undefined}>
        {creating && (
          <form
            className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              setErr(null);
              try {
                const c = await api<Cohort>("/api/career/workforce/cohorts", {
                  json: { name: form.name, programName: form.programName, kind: form.kind, startDate: form.startDate || null, publishedLengthDays: form.publishedLengthDays === "" ? null : Number(form.publishedLengthDays), notes: form.notes || null },
                });
                setCreating(false);
                setSelected(c.id);
                setMsg(t("cohortCreated"));
                cohorts.reload();
              } catch (ex) {
                setErr((ex as Error).message);
              }
            }}
          >
            <Field label={t("cohortName")}>{(props) => <input {...props} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label={t("programName")}>{(props) => <input {...props} required value={form.programName} onChange={(e) => setForm({ ...form, programName: e.target.value })} />}</Field>
            <Field label={t("kind")}>
              {(props) => (
                <select {...props} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  <option value="FixedLength">{t("kinds.FixedLength")}</option>
                  <option value="SelfPaced">{t("kinds.SelfPaced")}</option>
                </select>
              )}
            </Field>
            <Field label={t("startDate")} hint={t("startDateHint")}>{(props) => <input {...props} type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />}</Field>
            {form.kind === "FixedLength" && (
              <Field label={t("publishedLength")} hint={t("publishedLengthHint")}>{(props) => <input {...props} type="number" min={7} required value={form.publishedLengthDays} onChange={(e) => setForm({ ...form, publishedLengthDays: e.target.value })} />}</Field>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit">{t("createCohort")}</Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>{t("cancel")}</Button>
            </div>
          </form>
        )}
        {cohorts.loading && !cohorts.data ? (
          <Loading />
        ) : !cohorts.data?.length ? (
          <EmptyState title={t("noCohorts")}>{t("noCohortsHint")}</EmptyState>
        ) : (
          <ul className="space-y-2">
            {cohorts.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                <span>
                  <span className="font-medium">{c.name}</span> <span className="text-sm text-muted-foreground">{t("cohortLine", { program: c.programName, start: dateOnly(c.startDate), members: c.members })}</span>
                </span>
                <Button variant={selected === c.id ? "primary" : "secondary"} aria-pressed={selected === c.id} onClick={() => setSelected(selected === c.id ? null : c.id)}>
                  {t("manage")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selected && <CohortDetail id={selected} defs={defs} onChanged={() => { cohorts.reload(); report.reload(); }} />}

      <Card title={t("reportTitle", { label: defs.label })}>
        <form
          className="mb-4 grid gap-3 sm:grid-cols-3 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(filter);
          }}
        >
          <Field label={t("cohortFilter")}>
            {(props) => (
              <select {...props} value={filter.cohortId} onChange={(e) => setFilter({ ...filter, cohortId: e.target.value })}>
                <option value="">{t("allCohorts")}</option>
                {(cohorts.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </Field>
          <Field label={t("yearFilter")}>
            {(props) => (
              <select {...props} value={filter.year} onChange={(e) => setFilter({ ...filter, year: e.target.value })}>
                <option value="">{t("allYears")}</option>
                {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>
            )}
          </Field>
          <Button type="submit">{t("apply")}</Button>
        </form>
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="secondary" busy={busy === "csv-false"} onClick={() => exportFile("csv", false)}>{t("exportCsv")}</Button>
          <Button variant="secondary" busy={busy === "xlsx-false"} onClick={() => exportFile("xlsx", false)}>{t("exportXlsx")}</Button>
          {isAdmin && <Button variant="secondary" busy={busy === "xlsx-true"} onClick={() => exportFile("xlsx", true)} title={t("exportDetailHint")}>{t("exportDetail")}</Button>}
        </div>
        <ErrorBanner error={report.error} onRetry={report.reload} />
        {report.loading && !report.data ? (
          <Loading />
        ) : (
          report.data && (
            <div className="space-y-4" aria-live="polite">
              <p className="text-sm" role="status">
                {t("totals", { enrolled: report.data.totals.enrolled, graduates: report.data.totals.graduates, onTime: report.data.totals.onTime, counted: report.data.totals.counted })}
                {report.data.totals.intentMissing > 0 && ` ${t("intentMissing", { count: report.data.totals.intentMissing })}`}
              </p>
              {report.data.tables.map((tb) => <ReportTableView key={tb.key} table={tb} />)}
              <ul className="list-disc space-y-1 ps-5 text-xs text-muted-foreground">
                {report.data.notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </div>
          )
        )}
      </Card>

      <Card title={t("rulesTitle")}>
        <FactList facts={defs.rules} />
        <h3 className="mt-4 text-sm font-semibold">{t("sourcesTitle")}</h3>
        <SourceList sources={defs.sources} />
        <p className="mt-2 text-xs text-muted-foreground">{t("reviewedOn", { date: dateOnly(defs.reviewedOn) })}</p>
      </Card>
    </div>
  );
}
