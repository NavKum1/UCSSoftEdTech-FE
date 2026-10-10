"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import { STATUS_LABELS, StatusBadge, downloadWith, type ExperienceSummary, type Program, type Question } from "@/components/career/experiences/shared";

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

const TABS = ["Dashboard", "Review queue", "Programs"] as const;

export default function CareerCenterExperiencesPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Dashboard");
  return (
    <div>
      <PageHeader title="Internships for credit" description="Credit programs, registrations awaiting review, learning agreements, evaluations and CPT tracking." />
      <div role="tablist" aria-label="Sections" className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-md border px-3 py-1.5 text-sm ${tab === t ? "border-[var(--brand,#4f46e5)] font-semibold" : "border-border"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tab}>
        {tab === "Dashboard" && <DashboardTab />}
        {tab === "Review queue" && <QueueTab />}
        {tab === "Programs" && <ProgramsTab />}
      </div>
    </div>
  );
}

function DashboardTab() {
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
        <Button variant="secondary" onClick={() => downloadWith(api, "/api/career/experiences/staff/export.csv", `experiences-${new Date().toISOString().slice(0, 10)}.csv`).catch((e) => setErr(e.message))}>
          Export CSV
        </Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Waiting for faculty" value={x.awaitingFaculty} />
        <Stat label="Waiting for career center" value={x.awaitingCareerCenter} />
        <Stat label="Agreements not fully signed" value={x.missingAgreements.length} />
        <Stat label="Overdue evaluations" value={x.overdueEvaluations.length} />
        <Stat label="CPT pending" value={x.cptPending.length} />
      </ul>
      <Card title="By status">
        <ul className="flex flex-wrap gap-3 text-sm">
          {Object.entries(x.byStatus).map(([s, n]) => (
            <li key={s}>
              {STATUS_LABELS[s] ?? s}: <strong>{n}</strong>
            </li>
          ))}
          <li>Hour entries awaiting supervisors: <strong>{x.pendingHourApprovals}</strong></li>
        </ul>
      </Card>
      <ListCard title="Agreements waiting for signatures" empty="Every approved agreement is signed." rows={x.missingAgreements.map((m) => ({ id: m.id, text: `${m.studentName} · ${m.employerName}`, note: m.startsInDays < 0 ? `Started ${-m.startsInDays} days ago` : `Starts in ${m.startsInDays} days` }))} />
      <ListCard title="Overdue evaluations" empty="No overdue evaluations." rows={x.overdueEvaluations.map((m) => ({ id: m.id, text: `${m.studentName} · ${m.employerName}`, note: `${m.kind} was due ${formatDate(m.dueDate)}` }))} />
      <ListCard title="CPT pending (F-1)" empty="No CPT records pending." rows={x.cptPending.map((m) => ({ id: m.id, text: `${m.studentName} · ${m.employerName}`, note: `${m.cptStatus ?? "CPT not recorded"} · starts ${formatDate(m.startDate)}` }))} />
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
        <Field label="Status">
          {(p) => (
            <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Search student, organization or role">{(p) => <input {...p} value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <ErrorBanner error={list.error} onRetry={list.reload} />
      {list.loading ? (
        <Loading />
      ) : !list.data?.length ? (
        <EmptyState title="Nothing here" />
      ) : (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Experiences</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2">Student</th>
              <th scope="col">Organization and role</th>
              <th scope="col">Dates</th>
              <th scope="col">Status</th>
              <th scope="col">Checks</th>
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
                  {formatDate(x.startDate)} to {formatDate(x.endDate)}
                </td>
                <td>
                  <StatusBadge status={x.status} />
                </td>
                <td className="space-x-1">
                  {x.status === "Submitted" && <Badge tone={x.facultyApproved ? "good" : "warn"}>{x.facultyApproved ? "Faculty approved" : "Awaiting faculty"}</Badge>}
                  {x.isF1 && <Badge tone={x.cptStatus === "Authorized" ? "good" : "warn"}>F-1 CPT: {x.cptStatus ?? "not recorded"}</Badge>}
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
      {isAdmin && !editing && <Button onClick={() => setEditing("new")}>Add a program</Button>}
      {editing && (
        <ProgramEditor
          program={editing === "new" ? null : editing}
          faculty={faculty.data ?? []}
          onCancel={() => setEditing(null)}
          onSave={async (body) => {
            const saved = editing === "new"
              ? await api<Program>("/api/career/experiences/staff/programs", { json: body })
              : await api<Program>(`/api/career/experiences/staff/programs/${editing.id}`, { method: "PUT", json: body });
            setMsg(`Saved ${saved.code}.`);
            setEditing(null);
            programs.reload();
          }}
        />
      )}
      {programs.loading ? (
        <Loading />
      ) : !programs.data?.length ? (
        <EmptyState title="No programs yet">A career admin adds credit programs such as “CS 4950 Internship for credit”.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {programs.data.map((p) => (
            <li key={p.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {p.code} {p.title} {!p.active && <Badge>Inactive</Badge>}
                </span>
                {isAdmin && (
                  <Button variant="secondary" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {p.creditHours} credits · {p.requiredHours} hours · {p.midtermForm.length} midterm and {p.finalForm.length} final questions · {p.reflectionPrompts.length} reflection prompts
                {p.requireCpt ? " · CPT required for F-1" : ""}
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
    <Card title={program ? `Edit ${program.code}` : "New program"}>
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
          <Field label="Course code">{(p) => <input {...p} value={code} onChange={(e) => setCode(e.target.value)} required />}</Field>
          <Field label="Title">{(p) => <input {...p} value={title} onChange={(e) => setTitle(e.target.value)} required />}</Field>
          <Field label="Credit hours">{(p) => <input {...p} type="number" min={0} max={30} step="0.5" value={credits} onChange={(e) => setCredits(e.target.value)} />}</Field>
          <Field label="Required work hours">{(p) => <input {...p} type="number" min={0} max={5000} value={hours} onChange={(e) => setHours(e.target.value)} />}</Field>
        </div>
        <Field label="Description">{(p) => <textarea {...p} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Required documents" hint="One per line, e.g. Offer letter.">{(p) => <textarea {...p} rows={3} value={docs} onChange={(e) => setDocs(e.target.value)} />}</Field>
          <Field label="Reflection prompts" hint="One per line.">{(p) => <textarea {...p} rows={3} value={prompts} onChange={(e) => setPrompts(e.target.value)} />}</Field>
          <Field label="Midterm evaluation questions" hint='One per line; rated on the scale. Start a line with "text:" for a written answer.'>
            {(p) => <textarea {...p} rows={4} value={mid} onChange={(e) => setMid(e.target.value)} />}
          </Field>
          <Field label="Final evaluation questions" hint='One per line; start with "text:" for a written answer.'>{(p) => <textarea {...p} rows={4} value={fin} onChange={(e) => setFin(e.target.value)} />}</Field>
        </div>
        <Field label="Rating scale (1 to …)">{(p) => <input {...p} type="number" min={3} max={10} value={scale} onChange={(e) => setScale(e.target.value)} />}</Field>
        <fieldset>
          <legend className="text-sm font-medium">Faculty approvers</legend>
          <p className="text-xs text-muted-foreground">Leave all unchecked to let any faculty member at your school approve and grade.</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {faculty.map((f) => (
              <li key={f.userId}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={approvers.includes(f.userId)} onChange={(e) => setApprovers((a) => (e.target.checked ? [...a, f.userId] : a.filter((x) => x !== f.userId)))} />
                  {f.name || f.email} <span className="text-xs text-muted-foreground">({f.role === "CareerAdmin" ? "career admin" : "faculty"})</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <Field label="Additional agreement terms">{(p) => <textarea {...p} rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />}</Field>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={requireCpt} onChange={(e) => setRequireCpt(e.target.checked)} /> Require CPT dates for F-1 students before approval
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Open for registration
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" busy={busy}>
            Save program
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
