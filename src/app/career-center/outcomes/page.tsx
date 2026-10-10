"use client";

/** D4 verified outcomes for career staff: placements with source and verification, research entries, offer signals, Hire links and reports. */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import { labelOf } from "@/components/career/coreLabels";
import {
  EMPLOYMENT_TYPE_LABELS,
  Placement,
  PlacementForm,
  SALARY_BAND_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  VERIFICATION_LABELS,
  VERIFICATION_TONE,
  emptyPlacementForm,
  placementPayload,
} from "@/components/career/outcomesLabels";

interface PlacementList {
  total: number;
  items: Placement[];
  employmentTypes: string[];
  sources: string[];
  verificationLevels: string[];
  salaryBands: string[];
}

interface StudentOption {
  userId: string;
  name: string;
  email: string;
  status?: string | null;
}

interface OfferSignal {
  bookingId: string;
  studentName?: string | null;
  employerName: string;
  positionTitle: string;
  outcomeAt?: string | null;
  response?: string | null;
}

interface HireEvent {
  eventId: string;
  type: string;
  externalApplicationId?: string | null;
  result: string;
  receivedAt: string;
}

interface ReportTable {
  key: string;
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
  note?: string | null;
}

interface Report {
  minCellSize: number;
  hiddenLabel: string;
  filters: { cohort?: number | null; program?: string | null; cohorts: number[]; programs: string[] };
  tables: ReportTable[];
  predictorsCaveat: string;
  predictorsSuppressed: boolean;
  notes: string[];
}

type Tab = "placements" | "add" | "offers" | "reports" | "hire";
const TABS: [Tab, string][] = [
  ["placements", "Placements"],
  ["add", "Add research entry"],
  ["offers", "Offer signals"],
  ["reports", "Reports"],
  ["hire", "Hire links"],
];

function PlacementFields({ form, setForm, types, bands }: { form: PlacementForm; setForm: (f: PlacementForm) => void; types: string[]; bands: string[] }) {
  return (
    <>
      <Field label="Employer or school">{(p) => <input {...p} required maxLength={200} value={form.employerName} onChange={(e) => setForm({ ...form, employerName: e.target.value })} />}</Field>
      <Field label="Job title or program">{(p) => <input {...p} required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
      <Field label="Type">
        {(p) => (
          <select {...p} value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
            {types.map((t) => <option key={t} value={t}>{labelOf(EMPLOYMENT_TYPE_LABELS, t)}</option>)}
          </select>
        )}
      </Field>
      <Field label="Start date">{(p) => <input {...p} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />}</Field>
      <Field label="Location">{(p) => <input {...p} maxLength={200} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />}</Field>
      <Field label="Salary range (optional)" hint="Yearly, in US dollars.">
        {(p) => (
          <select {...p} value={form.salaryBand} onChange={(e) => setForm({ ...form, salaryBand: e.target.value })}>
            <option value="">Not known</option>
            {bands.map((b) => <option key={b} value={b}>{labelOf(SALARY_BAND_LABELS, b)}</option>)}
          </select>
        )}
      </Field>
    </>
  );
}

function Table({ t }: { t: ReportTable }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="mb-2 text-left font-semibold">{t.title}</caption>
        <thead>
          <tr className="border-b border-border text-left">
            {t.columns.map((c) => <th key={c} scope="col" className="py-2 pr-3 font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {t.rows.length === 0 ? (
            <tr>
              <td colSpan={t.columns.length} className="py-2 text-muted-foreground">Nothing to show.</td>
            </tr>
          ) : (
            t.rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {r.map((c, j) => (j === 0 ? <th key={j} scope="row" className="py-2 pr-3 text-left font-normal">{c ?? "—"}</th> : <td key={j} className="py-2 pr-3">{c ?? "—"}</td>))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {t.note && <p className="mt-2 text-xs text-muted-foreground">{t.note}</p>}
    </div>
  );
}

export default function CareerOutcomesPage() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const [tab, setTab] = useState<Tab>("placements");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [source, setSource] = useState("");
  const list = useLoad(
    () => api<PlacementList>(`/api/career/outcomes/placements?q=${encodeURIComponent(search)}&level=${level}&source=${source}`),
    [api, schoolId, search, level, source],
  );
  const types = list.data?.employmentTypes ?? Object.keys(EMPLOYMENT_TYPE_LABELS);
  const bands = list.data?.salaryBands ?? Object.keys(SALARY_BAND_LABELS);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const download = (path: string, key: string) =>
    run(key, async () => {
      const res = await api<Response>(path, { raw: true });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const name = /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "export.csv";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Download started.");
    });

  const verify = (p: Placement) =>
    run(p.id, async () => {
      const notes = window.prompt("How did you confirm it? (optional, for example: offer letter seen)") ?? "";
      await api(`/api/career/outcomes/placements/${p.id}/verify`, { method: "POST", json: { notes } });
      setMsg(`${p.studentName ?? "The student"}'s placement at ${p.employerName} is confirmed.`);
      list.reload();
    });

  const remove = (p: Placement) => {
    if (!window.confirm(`Delete the placement at ${p.employerName} for ${p.studentName ?? "this student"}?`)) return;
    void run(p.id, async () => {
      await api(`/api/career/outcomes/placements/${p.id}`, { method: "DELETE" });
      setMsg("Placement deleted.");
      list.reload();
    });
  };

  const syncAts = () =>
    run("sync", async () => {
      const r = await api<{ scanned: number; created: number; merged: number }>("/api/career/outcomes/sync/ats", { method: "POST" });
      setMsg(`Checked ${r.scanned} employer-reported hires: ${r.created} new placements, ${r.merged} already known or merged.`);
      list.reload();
    });

  // Research entry
  const [studentQ, setStudentQ] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const students = useLoad(
    () => (tab === "add" || tab === "hire" ? api<StudentOption[]>(`/api/career/outcomes/students?q=${encodeURIComponent(studentSearch)}`) : Promise.resolve(null)),
    [api, schoolId, tab, studentSearch],
  );
  const [studentId, setStudentId] = useState("");
  const [form, setForm] = useState<PlacementForm>(emptyPlacementForm);
  const [status, setStatus] = useState("");

  const addResearch = (e: React.FormEvent) => {
    e.preventDefault();
    void run("add", async () => {
      if (!studentId) throw new Error("Choose a student first.");
      const r = await api<{ merged: boolean }>("/api/career/outcomes/placements", { method: "POST", json: { ...placementPayload(form), studentUserId: studentId } });
      setMsg(r.merged ? "This matched a placement already on record, so the two were merged." : "Placement added as confirmed by staff.");
      setForm(emptyPlacementForm);
      list.reload();
    });
  };

  const saveStatus = () =>
    run("status", async () => {
      if (!studentId) throw new Error("Choose a student first.");
      await api(`/api/career/outcomes/students/${studentId}/status`, { method: "PUT", json: { status: status || null } });
      setMsg(status ? `Status recorded: ${labelOf(STATUS_LABELS, status)}.` : "Status cleared.");
      students.reload();
    });

  const offers = useLoad(() => (tab === "offers" ? api<OfferSignal[]>("/api/career/outcomes/offers") : Promise.resolve(null)), [api, schoolId, tab]);

  // Reports
  const [cohort, setCohort] = useState("");
  const [program, setProgram] = useState("");
  const reportQ = `cohort=${cohort}&program=${encodeURIComponent(program)}`;
  const report = useLoad(() => (tab === "reports" ? api<Report>(`/api/career/outcomes/reports?${reportQ}`) : Promise.resolve(null)), [api, schoolId, tab, reportQ]);

  // Hire application links
  const [link, setLink] = useState({ employerId: "", externalApplicationId: "", title: "" });
  const events = useLoad(() => (tab === "hire" ? api<HireEvent[]>("/api/career/outcomes/hire/events") : Promise.resolve(null)), [api, schoolId, tab]);
  const addLink = (e: React.FormEvent) => {
    e.preventDefault();
    void run("link", async () => {
      if (!studentId) throw new Error("Choose a student first.");
      await api("/api/career/outcomes/hire/links", { method: "POST", json: { studentUserId: studentId, employerId: link.employerId.trim(), externalApplicationId: link.externalApplicationId.trim(), title: link.title.trim() || null } });
      setMsg("Application linked. Hire and offer events for it will now create verified placements.");
      setLink({ employerId: "", externalApplicationId: "", title: "" });
    });
  };

  const studentPicker = (
    <div className="grid gap-3 sm:grid-cols-2">
      <form
        role="search"
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setStudentSearch(studentQ.trim());
        }}
      >
        <Field label="Find a student">{(p) => <input {...p} type="search" value={studentQ} onChange={(e) => setStudentQ(e.target.value)} />}</Field>
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <Field label="Student">
        {(p) => (
          <select {...p} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Choose…</option>
            {(students.data ?? []).map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.name} ({s.email}){s.status ? ` · ${labelOf(STATUS_LABELS, s.status)}` : ""}
              </option>
            ))}
          </select>
        )}
      </Field>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Outcomes"
        description="Where your graduates went, where each fact came from and how well it is verified. Placement records are part of the student's record: they are never shared with employers."
      />
      <div role="tablist" aria-label="Outcomes" className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls="outcomes-panel"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === key ? "font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            style={tab === key ? { borderColor: "var(--brand, #4f46e5)" } : undefined}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />

      <div id="outcomes-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "placements" && (
          <Card
            actions={
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" busy={busy === "sync"} onClick={syncAts}>Import employer-reported hires</Button>
                <Button variant="secondary" busy={busy === "csv"} onClick={() => download("/api/career/outcomes/placements.csv", "csv")}>Export CSV</Button>
              </div>
            }
          >
            <form
              role="search"
              className="mb-4 grid gap-3 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(q.trim());
              }}
            >
              <Field label="Search" hint="Student, employer or title.">{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
              <Field label="Verification">
                {(p) => (
                  <select {...p} value={level} onChange={(e) => setLevel(e.target.value)}>
                    <option value="">Any</option>
                    {Object.keys(VERIFICATION_LABELS).map((v) => <option key={v} value={v}>{VERIFICATION_LABELS[v]}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Source">
                {(p) => (
                  <select {...p} value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="">Any</option>
                    {Object.keys(SOURCE_LABELS).map((v) => <option key={v} value={v}>{SOURCE_LABELS[v]}</option>)}
                  </select>
                )}
              </Field>
              <div className="flex items-end">
                <Button type="submit" variant="secondary">Search</Button>
              </div>
            </form>
            <ErrorBanner error={list.error} onRetry={list.reload} />
            {list.loading && !list.data ? (
              <Loading />
            ) : (list.data?.items ?? []).length === 0 ? (
              <EmptyState title="No placements recorded yet">Import employer-reported hires, add research entries, or ask students to report their next step.</EmptyState>
            ) : (
              <ul className="divide-y divide-border" aria-live="polite">
                {list.data!.items.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {p.studentName ?? "Former member"} <span className="font-normal text-muted-foreground">· {p.studentEmail}</span>
                      </p>
                      <p className="text-sm">
                        {p.title} at {p.employerName} · {labelOf(EMPLOYMENT_TYPE_LABELS, p.employmentType)}
                        {p.startDate && ` · starts ${formatDate(p.startDate)}`}
                        {p.location && ` · ${p.location}`}
                        {p.salaryBand && ` · ${labelOf(SALARY_BAND_LABELS, p.salaryBand)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Reported by: {p.sources.map((s) => labelOf(SOURCE_LABELS, s)).join(", ")}
                        {p.evidenceNotes && ` · ${p.evidenceNotes}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={VERIFICATION_TONE[p.verificationLevel] ?? "neutral"}>{labelOf(VERIFICATION_LABELS, p.verificationLevel)}</Badge>
                      {p.verificationLevel === "SelfReported" && (
                        <Button variant="secondary" busy={busy === p.id} onClick={() => verify(p)} aria-label={`Confirm placement at ${p.employerName} for ${p.studentName ?? "student"}`}>Confirm</Button>
                      )}
                      <Button variant="ghost" disabled={busy === p.id} onClick={() => remove(p)} aria-label={`Delete placement at ${p.employerName} for ${p.studentName ?? "student"}`}>Delete</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {tab === "add" && (
          <div className="space-y-6">
            <Card title="Student">{studentPicker}</Card>
            <Card title="Placement found by the career center">
              <form onSubmit={addResearch} className="grid gap-4 sm:grid-cols-2">
                <PlacementFields form={form} setForm={setForm} types={types} bands={bands} />
                <div className="sm:col-span-2">
                  <Field label="Evidence" hint="Where you found it, for example: LinkedIn profile checked on 3 June, or email from the employer.">
                    {(p) => <textarea {...p} rows={2} maxLength={2000} value={form.evidenceNotes} onChange={(e) => setForm({ ...form, evidenceNotes: e.target.value })} />}
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" busy={busy === "add"}>Add placement</Button>
                </div>
              </form>
            </Card>
            <Card title="Or record that the student is still looking">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Status">
                  {(p) => (
                    <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="">No status (clear)</option>
                      {Object.keys(STATUS_LABELS).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  )}
                </Field>
                <Button variant="secondary" busy={busy === "status"} onClick={saveStatus}>Save status</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">A recorded status counts as a known outcome in the knowledge rate.</p>
            </Card>
          </div>
        )}

        {tab === "offers" && (
          <Card title="Offers recorded in on-campus recruiting">
            <p className="mb-3 text-sm text-muted-foreground">Students confirm on their &quot;My next step&quot; page whether they accepted. Accepted offers become placements.</p>
            <ErrorBanner error={offers.error} onRetry={offers.reload} />
            {offers.loading || !offers.data ? (
              <Loading />
            ) : offers.data.length === 0 ? (
              <EmptyState title="No offers recorded" />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {offers.data.map((o) => (
                  <li key={o.bookingId} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      {o.studentName ?? "Student"} · {o.positionTitle} at {o.employerName}
                      {o.outcomeAt && <span className="text-muted-foreground"> · {formatDate(o.outcomeAt)}</span>}
                    </span>
                    <Badge tone={o.response === "Accepted" ? "good" : o.response === "Declined" ? "neutral" : "warn"}>{o.response ?? "Waiting for the student"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {tab === "reports" && (
          <div className="space-y-6">
            <Card
              actions={<Button variant="secondary" busy={busy === "rcsv"} onClick={() => download(`/api/career/outcomes/reports.csv?${reportQ}`, "rcsv")}>Export CSV</Button>}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Graduation year">
                  {(p) => (
                    <select {...p} value={cohort} onChange={(e) => setCohort(e.target.value)}>
                      <option value="">All years</option>
                      {(report.data?.filters.cohorts ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </Field>
                <Field label="Program">
                  {(p) => (
                    <select {...p} value={program} onChange={(e) => setProgram(e.target.value)}>
                      <option value="">All programs</option>
                      {(report.data?.filters.programs ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </Field>
              </div>
            </Card>
            <ErrorBanner error={report.error} onRetry={report.reload} />
            {report.loading || !report.data ? (
              <Loading />
            ) : (
              <div className="space-y-6" aria-live="polite">
                {report.data.tables.filter((t) => t.key !== "predictors").map((t) => (
                  <Card key={t.key}><Table t={t} /></Card>
                ))}
                <Card title="Which evidence went with placement">
                  <p className="mb-3 rounded-md border border-border bg-muted p-3 text-sm" role="note">
                    <strong>Correlation, not causation; small samples.</strong> {report.data.predictorsCaveat.replace(/^Correlation, not causation; small samples\. /, "")}
                  </p>
                  <Table t={report.data.tables.find((t) => t.key === "predictors")!} />
                </Card>
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {report.data.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === "hire" && (
          <div className="space-y-6">
            <Card title="Link an application sent to an employer's Hire account">
              <p className="mb-3 text-sm text-muted-foreground">
                When an employer uses Hire, it reports offers and hires for applications we sent it. Linking our application id to the student lets those reports become employer-verified placements.
              </p>
              {studentPicker}
              <form onSubmit={addLink} className="mt-4 grid gap-3 sm:grid-cols-3">
                <Field label="Employer id">{(p) => <input {...p} required pattern="[0-9a-fA-F-]{36}" value={link.employerId} onChange={(e) => setLink({ ...link, employerId: e.target.value })} />}</Field>
                <Field label="Our application id" hint="The externalApplicationId sent to Hire.">{(p) => <input {...p} required maxLength={128} value={link.externalApplicationId} onChange={(e) => setLink({ ...link, externalApplicationId: e.target.value })} />}</Field>
                <Field label="Role (optional)">{(p) => <input {...p} maxLength={200} value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} />}</Field>
                <div>
                  <Button type="submit" busy={busy === "link"}>Link application</Button>
                </div>
              </form>
            </Card>
            <Card title="Recent events from Hire">
              <ErrorBanner error={events.error} onRetry={events.reload} />
              {events.loading || !events.data ? (
                <Loading />
              ) : events.data.length === 0 ? (
                <EmptyState title="No events received yet" />
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {events.data.map((e) => (
                    <li key={e.eventId} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>
                        {e.type} · {e.externalApplicationId ?? "—"} <span className="text-muted-foreground">· {formatDate(e.receivedAt, true)}</span>
                      </span>
                      <Badge tone={e.result === "Placed" ? "good" : e.result === "Unmatched" ? "warn" : "neutral"}>{e.result}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
