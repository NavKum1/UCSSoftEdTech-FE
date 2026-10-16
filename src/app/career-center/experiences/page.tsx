"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT, useCareerLabels } from "@/components/career/ui";
import { StatusBadge, downloadWith, useExperienceStatusLabels, type ExperienceSummary, type Program, type Question } from "@/components/career/experiences/shared";
import { PackSettingsPanel } from "@/components/career/experiences/InternshipPack";

interface Dashboard {
  byStatus: Record<string, number>;
  total: number;
  awaitingFaculty: number;
  awaitingCareerCenter: number;
  pendingHourApprovals: number;
  missingAgreements: { id: string; studentName: string; employerName: string; startDate: string; approvedAt?: string | null; startsInDays: number }[];
  overdueEvaluations: { id: string; studentName: string; employerName: string; kind: string; dueDate: string }[];
  cptPending: { id: string; studentName: string; employerName: string; status: string; cptStatus?: string | null; cptStartDate?: string | null; startDate: string }[];
}

const TABS = ["Dashboard", "Review queue", "Programs", "Country pack"] as const;

export default function CareerCenterExperiencesPage() {
  const tr = useCareerT("careerCenterExperiences");
  const TAB_LABELS = useCareerLabels("careerCenterExperiences.tabs", TABS);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Dashboard");
  // Deep link to the country-pack settings: /career-center/experiences#country-pack
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the hash is only readable after mount
    if (window.location.hash === "#country-pack") setTab("Country pack");
  }, []);
  return (
    <div>
      <PageHeader title={tr("internshipsForCredit")} description={tr("creditProgramsRegistrationsAwaitingRevie")} />
      <div role="tablist" aria-label={tr("sections")} className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-md border px-3 py-1.5 text-sm ${tab === t ? "border-[var(--brand,#4f46e5)] font-semibold" : "border-border"}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={TAB_LABELS[tab]}>
        {tab === "Dashboard" && <DashboardTab />}
        {tab === "Review queue" && <QueueTab />}
        {tab === "Programs" && <ProgramsTab />}
        {tab === "Country pack" && <CountryPackTab />}
      </div>
    </div>
  );
}

function CountryPackTab() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  return <PackSettingsPanel api={api} schoolId={schoolId} />;
}

function DashboardTab() {
  const tr = useCareerT("careerCenterExperiences");
  const STATUS_LABELS = useExperienceStatusLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const d = useLoad(() => api<Dashboard>("/api/career/experiences/staff/dashboard"), [api, schoolId]);
  const [err, setErr] = useState<string | null>(null);
  if (d.loading && !d.data) return <Loading />;
  if (!d.data) return <ErrorBanner error={d.error} onRetry={d.reload} />;
  const x = d.data;
  return (
    <div className="space-y-6">
      <ErrorBanner error={err} />
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => downloadWith(api, "/api/career/experiences/staff/export.csv", `experiences-${new Date().toISOString().slice(0, 10)}.csv`, tr("downloadFailed")).catch((e) => setErr(e.message))}>
          {tr("exportCSV")}
        </Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label={tr("waitingForFaculty")} value={x.awaitingFaculty} />
        <Stat label={tr("waitingForCareerCenter")} value={x.awaitingCareerCenter} />
        <Stat label={tr("agreementsNotFullySigned")} value={x.missingAgreements.length} />
        <Stat label={tr("overdueEvaluations")} value={x.overdueEvaluations.length} />
        <Stat label={tr("cPTPending")} value={x.cptPending.length} />
      </ul>
      <Card title={tr("byStatus")}>
        <ul className="flex flex-wrap gap-3 text-sm">
          {Object.entries(x.byStatus).map(([s, n]) => (
            <li key={s}>
              {STATUS_LABELS[s] ?? s}: <strong>{n}</strong>
            </li>
          ))}
          <li>{tr.rich("hourEntriesAwaitingSupervisorsPendingHou", { strong: (chunks) => <strong>{chunks}</strong>, pendingHourApprovals: x.pendingHourApprovals })}</li>
        </ul>
      </Card>
      <ListCard title={tr("agreementsWaitingForSignatures")} empty={tr("everyApprovedAgreementIsSigned")} rows={x.missingAgreements.map((m) => ({ id: m.id, text: `${m.studentName} · ${m.employerName}`, note: m.startsInDays < 0 ? tr("startedDaysAgo", { days: -m.startsInDays }) : tr("startsInDays", { days: m.startsInDays }) }))} />
      <ListCard title={tr("overdueEvaluations")} empty={tr("noOverdueEvaluations")} rows={x.overdueEvaluations.map((m) => ({ id: m.id, text: `${m.studentName} · ${m.employerName}`, note: tr("kindWasDue", { kind: m.kind, dueDate: formatDate(m.dueDate) }) }))} />
      <ListCard title={tr("cPTPendingF1")} empty={tr("noCptRecordsPending")} rows={x.cptPending.map((m) => ({ id: m.id, text: `${m.studentName} · ${m.employerName}`, note: tr("cptStatusStarts", { cptStatus: m.cptStatus ?? tr("cptNotRecorded"), startDate: formatDate(m.startDate) }) }))} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <li className="rounded-xl border border-border p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </li>
  );
}

function ListCard({ title, empty, rows }: { title: string; empty: string; rows: { id: string; text: string; note: string }[] }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {rows.map((r, i) => (
            <li key={`${r.id}-${i}`} className="flex flex-wrap justify-between gap-2 py-2">
              <Link href={`/career-center/experiences/${r.id}`} className="underline">
                {r.text}
              </Link>
              <span className="text-muted-foreground">{r.note}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function QueueTab() {
  const tr = useCareerT("careerCenterExperiences");
  const STATUS_LABELS = useExperienceStatusLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const [status, setStatus] = useState("Submitted");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const list = useLoad(
    () => api<ExperienceSummary[]>(`/api/career/experiences/staff/experiences?status=${encodeURIComponent(status)}&q=${encodeURIComponent(query)}`),
    [api, schoolId, status, query],
  );
  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 sm:grid-cols-3 sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q);
        }}
      >
        <Field label={tr("status")}>
          {(p) => (
            <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{tr("all")}</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={tr("searchStudentOrganizationOrRole")}>{(p) => <input {...p} value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
        <Button type="submit" variant="secondary">
          {tr("search")}
        </Button>
      </form>
      <ErrorBanner error={list.error} onRetry={list.reload} />
      {list.loading ? (
        <Loading />
      ) : !list.data?.length ? (
        <EmptyState title={tr("nothingHere")} />
      ) : (
        <table className="w-full text-start text-sm [&_th]:text-start">
          <caption className="sr-only">{tr("experiences")}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2">{tr("student")}</th>
              <th scope="col">{tr("organizationAndRole")}</th>
              <th scope="col">{tr("dates")}</th>
              <th scope="col">{tr("status")}</th>
              <th scope="col">{tr("checks")}</th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((x) => (
              <tr key={x.id} className="border-b border-border/60 align-top">
                <td className="py-2">
                  <Link href={`/career-center/experiences/${x.id}`} className="underline">
                    {x.studentName}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{x.program?.code}</span>
                </td>
                <td>
                  {x.employerName}
                  <span className="block text-xs">{x.roleTitle}</span>
                </td>
                <td>
                  {tr("startDateToEndDate", { startDate: formatDate(x.startDate), endDate: formatDate(x.endDate) })}
                </td>
                <td>
                  <StatusBadge status={x.status} />
                </td>
                <td className="space-x-1">
                  {x.status === "Submitted" && <Badge tone={x.facultyApproved ? "good" : "warn"}>{x.facultyApproved ? tr("facultyApproved") : tr("awaitingFaculty")}</Badge>}
                  {x.isF1 && <Badge tone={x.cptStatus === "Authorized" ? "good" : "warn"}>{tr("f1CPTCptStatus", { cptStatus: x.cptStatus ?? tr("notRecorded") })}</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface FacultyChoice {
  userId: string;
  name: string;
  email: string;
  role: string;
}

function ProgramsTab() {
  const tr = useCareerT("careerCenterExperiences");
  const api = useApi();
  const { schoolId, me } = useCareerShell();
  const programs = useLoad(() => api<Program[]>("/api/career/experiences/staff/programs"), [api, schoolId]);
  const faculty = useLoad(() => api<FacultyChoice[]>("/api/career/experiences/staff/faculty"), [api, schoolId]);
  const [editing, setEditing] = useState<Program | "new" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const isAdmin = (me?.memberships ?? []).some((m) => m.role === "CareerAdmin" && (!schoolId || m.instituteId === schoolId));

  return (
    <div className="space-y-4">
      <SuccessBanner message={msg} />
      <ErrorBanner error={programs.error} onRetry={programs.reload} />
      {isAdmin && !editing && <Button onClick={() => setEditing("new")}>{tr("addAProgram")}</Button>}
      {editing && (
        <ProgramEditor
          program={editing === "new" ? null : editing}
          faculty={faculty.data ?? []}
          onCancel={() => setEditing(null)}
          onSave={async (body) => {
            const saved = editing === "new"
              ? await api<Program>("/api/career/experiences/staff/programs", { json: body })
              : await api<Program>(`/api/career/experiences/staff/programs/${editing.id}`, { method: "PUT", json: body });
            setMsg(tr("savedCode", { code: saved.code }));
            setEditing(null);
            programs.reload();
          }}
        />
      )}
      {programs.loading ? (
        <Loading />
      ) : !programs.data?.length ? (
        <EmptyState title={tr("noProgramsYet")}>{tr("aCareerAdminAddsCredit")}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {programs.data.map((p) => (
            <li key={p.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {p.code} {p.title} {!p.active && <Badge>{tr("inactive")}</Badge>}
                </span>
                {isAdmin && (
                  <Button variant="secondary" onClick={() => setEditing(p)}>
                    {tr("edit")}
                  </Button>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {tr("creditHoursCreditsRequiredHoursHoursCoun", { creditHours: p.creditHours, requiredHours: p.requiredHours, count: p.midtermForm.length, count2: p.finalForm.length, count3: p.reflectionPrompts.length })}
                {p.requireCpt ? tr("cPTRequiredForF1") : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const formText = (qs: Question[]) => qs.map((q) => `${q.type === "text" ? "text: " : ""}${q.text}`).join("\n");
const parseForm = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.toLowerCase().startsWith("text:") ? { text: l.slice(5).trim(), type: "text" } : { text: l, type: "rating" }));
const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function ProgramEditor({ program, faculty, onSave, onCancel }: { program: Program | null; faculty: FacultyChoice[]; onSave: (body: unknown) => Promise<void>; onCancel: () => void }) {
  const tr = useCareerT("careerCenterExperiences");
  const [code, setCode] = useState(program?.code ?? "");
  const [title, setTitle] = useState(program?.title ?? "");
  const [description, setDescription] = useState(program?.description ?? "");
  const [credits, setCredits] = useState(String(program?.creditHours ?? 3));
  const [hours, setHours] = useState(String(program?.requiredHours ?? 120));
  const [docs, setDocs] = useState((program?.requiredDocuments ?? []).join("\n"));
  const [mid, setMid] = useState(formText(program?.midtermForm ?? []));
  const [fin, setFin] = useState(formText(program?.finalForm ?? []));
  const [scale, setScale] = useState(String(program?.ratingScaleMax ?? 5));
  const [prompts, setPrompts] = useState((program?.reflectionPrompts ?? []).join("\n"));
  const [approvers, setApprovers] = useState<string[]>(program?.facultyApprovers ?? []);
  const [requireCpt, setRequireCpt] = useState(program?.requireCpt ?? true);
  const [terms, setTerms] = useState(program?.agreementTerms ?? "");
  const [active, setActive] = useState(program?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <Card title={program ? tr("editCode", { code: program.code }) : tr("newProgram")}>
      <ErrorBanner error={err} />
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await onSave({
              code, title, description, creditHours: Number(credits), requiredHours: Number(hours), requiredDocuments: lines(docs),
              midtermForm: parseForm(mid), finalForm: parseForm(fin), ratingScaleMax: Number(scale), reflectionPrompts: lines(prompts),
              facultyApprovers: approvers, requireCpt, agreementTerms: terms, active,
            });
          } catch (ex) {
            setErr((ex as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label={tr("courseCode")}>{(p) => <input {...p} value={code} onChange={(e) => setCode(e.target.value)} required />}</Field>
          <Field label={tr("title")}>{(p) => <input {...p} value={title} onChange={(e) => setTitle(e.target.value)} required />}</Field>
          <Field label={tr("creditHours")}>{(p) => <input {...p} type="number" min={0} max={30} step="0.5" value={credits} onChange={(e) => setCredits(e.target.value)} />}</Field>
          <Field label={tr("requiredWorkHours")}>{(p) => <input {...p} type="number" min={0} max={5000} value={hours} onChange={(e) => setHours(e.target.value)} />}</Field>
        </div>
        <Field label={tr("description")}>{(p) => <textarea {...p} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("requiredDocuments")} hint={tr("onePerLineEG")}>{(p) => <textarea {...p} rows={3} value={docs} onChange={(e) => setDocs(e.target.value)} />}</Field>
          <Field label={tr("reflectionPrompts")} hint={tr("onePerLine")}>{(p) => <textarea {...p} rows={3} value={prompts} onChange={(e) => setPrompts(e.target.value)} />}</Field>
          <Field label={tr("midtermEvaluationQuestions")} hint={tr("onePerLineRatedOn")}>
            {(p) => <textarea {...p} rows={4} value={mid} onChange={(e) => setMid(e.target.value)} />}
          </Field>
          <Field label={tr("finalEvaluationQuestions")} hint={tr("onePerLineStartWith")}>{(p) => <textarea {...p} rows={4} value={fin} onChange={(e) => setFin(e.target.value)} />}</Field>
        </div>
        <Field label={tr("ratingScale1To")}>{(p) => <input {...p} type="number" min={3} max={10} value={scale} onChange={(e) => setScale(e.target.value)} />}</Field>
        <fieldset>
          <legend className="text-sm font-medium">{tr("facultyApprovers")}</legend>
          <p className="text-xs text-muted-foreground">{tr("leaveAllUncheckedToLet")}</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {faculty.map((f) => (
              <li key={f.userId}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={approvers.includes(f.userId)} onChange={(e) => setApprovers((a) => (e.target.checked ? [...a, f.userId] : a.filter((x) => x !== f.userId)))} />
                  {f.name || f.email} <span className="text-xs text-muted-foreground">({f.role === "CareerAdmin" ? tr("careerAdmin") : tr("faculty")})</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <Field label={tr("additionalAgreementTerms")}>{(p) => <textarea {...p} rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />}</Field>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={requireCpt} onChange={(e) => setRequireCpt(e.target.checked)} />{" "}{tr("requireCPTDatesForF")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{" "}{tr("openForRegistration")}
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" busy={busy}>
            {tr("saveProgram")}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {tr("cancel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
