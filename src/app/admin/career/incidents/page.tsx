"use client";

/** Platform operator: breach incidents (docs/compliance/breach_runbook.md). Records, affected schools and notice drafts. Nothing is sent. */
import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, ScrollArea } from "@/components/career/ui";
import { downloadBlob } from "@/components/career/privacy/StudentPrivacyRights";

interface Incident { id: string; title: string; description: string; severity: string; status: string; discoveredAt: string; allSchools: boolean; instituteIds: string[]; notified: Record<string, string> }
interface Affected { schools: { instituteId: string; name: string; country: string; law: string; regulatorDeadline: string; dpaNoticeHours: number; schoolNoticeDueBy: string; notifiedAt?: string | null; students: number; minors: number }[]; totals: { schools: number; students: number; minors: number } }
interface Drafts { note: string; drafts: { instituteId: string; school: string; toSchool: string; regulatorChecklist: string; toStudents: string }[] }

const STATUSES = ["Open", "Contained", "Notifying", "Closed"];

function IncidentPanel({ inc, onChanged }: { inc: Incident; onChanged: () => void }) {
  const api = useApi();
  const affected = useLoad(() => api<Affected>(`/api/career/platform/privacy/incidents/${inc.id}/affected`), [api, inc.id]);
  const [drafts, setDrafts] = useState<Drafts | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const act = async (fn: () => Promise<void>) => {
    setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message); }
  };
  return (
    <div className="space-y-4 text-sm">
      <ErrorBanner error={err ?? affected.error} />
      <p>{inc.description}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Status">
          {(p) => (
            <select {...p} value={inc.status} onChange={(e) => act(async () => { await api(`/api/career/platform/privacy/incidents/${inc.id}`, { method: "PUT", json: { status: e.target.value } }); onChanged(); })}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
        </Field>
        <Button variant="secondary" onClick={() => act(async () => downloadBlob(await api<Response>(`/api/career/platform/privacy/incidents/${inc.id}/affected.csv`, { raw: true }), "affected.csv"))}>Download affected people (CSV)</Button>
        <Button variant="secondary" onClick={() => act(async () => setDrafts(await api<Drafts>(`/api/career/platform/privacy/incidents/${inc.id}/drafts`)))}>Draft notices</Button>
      </div>
      {!affected.data ? <Loading /> : (
        <ScrollArea>
          <table className="w-full text-sm">
            <caption className="text-start">{affected.data.totals.schools} schools, {affected.data.totals.students} students ({affected.data.totals.minors} minors)</caption>
            <thead><tr className="border-b border-border [&_th]:text-start"><th scope="col" className="py-2 pe-3">School</th><th scope="col" className="py-2 pe-3">Law</th><th scope="col" className="py-2 pe-3">Tell the school by</th><th scope="col" className="py-2 pe-3">People</th><th scope="col" className="py-2">Notified</th></tr></thead>
            <tbody>
              {affected.data.schools.map((s) => (
                <tr key={s.instituteId} className="border-b border-border last:border-0 align-top">
                  <td className="py-2 pe-3">{s.name} ({s.country})</td>
                  <td className="py-2 pe-3">{s.law}<div className="text-xs text-muted-foreground">Regulator: {s.regulatorDeadline}</div></td>
                  <td className="py-2 pe-3">{formatDate(s.schoolNoticeDueBy, true)} ({s.dpaNoticeHours} h)</td>
                  <td className="py-2 pe-3">{s.students} ({s.minors} minors)</td>
                  <td className="py-2">
                    {s.notifiedAt ? <Badge tone="good">{formatDate(s.notifiedAt, true)}</Badge> : (
                      <Button variant="secondary" onClick={() => act(async () => { await api(`/api/career/platform/privacy/incidents/${inc.id}/notified`, { method: "POST", json: { instituteId: s.instituteId } }); affected.reload(); })} aria-label={`Mark ${s.name} as notified`}>
                        Mark notified
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
      {drafts && (
        <div className="space-y-4">
          <p role="status" className="font-medium">{drafts.note}</p>
          {drafts.drafts.map((d) => (
            <details key={d.instituteId} className="rounded-md border border-border p-3">
              <summary className="cursor-pointer font-medium">{d.school}</summary>
              {([["To the school", d.toSchool], ["Regulator checklist", d.regulatorChecklist], ["To students and guardians", d.toStudents]] as const).map(([label, text]) => (
                <Field key={label} label={label}>{(p) => <textarea {...p} readOnly rows={8} value={text} />}</Field>
              ))}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IncidentsPage() {
  const api = useApi();
  const list = useLoad(() => api<Incident[]>("/api/career/platform/privacy/incidents"), [api]);
  const [form, setForm] = useState({ title: "", description: "", severity: "Medium", instituteIds: "", allSchools: false, dataCategories: "", containment: "" });
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      const split = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
      const r = await api<Incident>("/api/career/platform/privacy/incidents", {
        method: "POST",
        json: { ...form, instituteIds: split(form.instituteIds), dataCategories: form.dataCategories.split(",").map((x) => x.trim()).filter(Boolean) },
      });
      setMsg("Incident recorded.");
      setOpen(r.id);
      list.reload();
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader title="Privacy incidents" description="Record a personal-data breach, see who is affected and draft the notices. Nothing is sent from here: follow the breach runbook." />
      <ErrorBanner error={err ?? list.error} />
      <SuccessBanner message={msg} />
      <Card title="Record an incident" className="mb-6">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <Field label="Title">{(p) => <input {...p} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />}</Field>
          <Field label="Severity">{(p) => <select {...p} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>{["Low", "Medium", "High", "Critical"].map((s) => <option key={s}>{s}</option>)}</select>}</Field>
          <Field label="What happened">{(p) => <textarea {...p} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />}</Field>
          <Field label="Containment so far">{(p) => <textarea {...p} rows={3} value={form.containment} onChange={(e) => setForm({ ...form, containment: e.target.value })} />}</Field>
          <Field label="Data involved" hint="Comma-separated, e.g. Name, Email, Resume">{(p) => <input {...p} value={form.dataCategories} onChange={(e) => setForm({ ...form, dataCategories: e.target.value })} />}</Field>
          <Field label="Affected school ids" hint="Separated by commas or spaces. Leave empty and tick all schools for a platform-wide incident.">{(p) => <input {...p} value={form.instituteIds} onChange={(e) => setForm({ ...form, instituteIds: e.target.value })} disabled={form.allSchools} />}</Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allSchools} onChange={(e) => setForm({ ...form, allSchools: e.target.checked })} /> All schools</label>
          <div><Button type="submit" busy={busy}>Record incident</Button></div>
        </form>
      </Card>
      <Card title="Incidents">
        {!list.data ? <Loading /> : list.data.length === 0 ? <EmptyState title="No incidents recorded" /> : (
          <ul className="divide-y divide-border">
            {list.data.map((i) => (
              <li key={i.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium">{i.title}</h2>
                  <Badge tone={i.status === "Closed" ? "good" : "warn"}>{String(i.status ?? "").replace(/([a-z])([A-Z])/g, (_m, a: string, b: string) => `${a} ${b.toLowerCase()}`)}</Badge>
                  <Badge tone={i.severity === "Critical" || i.severity === "High" ? "bad" : "neutral"}>{i.severity}</Badge>
                  <span className="text-xs text-muted-foreground">Discovered {formatDate(i.discoveredAt, true)}</span>
                  <Button variant="secondary" className="ms-auto" onClick={() => setOpen(open === i.id ? null : i.id)} aria-expanded={open === i.id}>{open === i.id ? "Close" : "Open"}</Button>
                </div>
                {open === i.id && <div className="mt-3"><IncidentPanel inc={i} onChanged={list.reload} /></div>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
