"use client";

import React, { useRef, useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  hint?: string | null;
}

interface Presets {
  notice: string;
  sources: string[];
  kinds: string[];
  fields: Record<string, FieldDef[]>;
}

interface Issue {
  line: number;
  field?: string | null;
  message: string;
  severity: "error" | "warning";
}

interface DryRun {
  total: number;
  valid: number;
  errors: number;
  warnings: number;
  toCreate: number;
  newRecords: number;
  matchedExisting: number;
  matchedToStudents: number;
  waitingForSignIn: number;
  alreadyImported: number;
  issues: Issue[];
  issuesTruncated: boolean;
  matches: { line: number; email: string; name: string; studentNumber?: string | null; role: string; linked: boolean; outcome: string }[];
}

interface CommitResult {
  created: number;
  matched: number;
  waitingForSignIn: number;
  failed: number;
  alreadyImported: number;
  skippedWithErrors: number;
  issues: Issue[];
  label: string;
}

interface Detection {
  source: string;
  entityKind: string;
  score: number;
  matched: number;
  total: number;
}

interface Batch {
  id: string;
  source: string;
  entityKind: string;
  fileName: string;
  rowCount: number;
  status: string;
  createdAt: string;
  committedAt?: string | null;
  undoneAt?: string | null;
  label?: string | null;
  headers?: string[] | null;
  mapping?: Record<string, string> | null;
  detection?: Detection[] | null;
  dryRun?: Partial<DryRun> | null;
  result?: Partial<CommitResult> | null;
  presetNotice: string;
}

interface BatchView {
  batch: Batch;
  sample?: string[][];
}

const KIND_LABELS: Record<string, string> = {
  Students: "Students",
  Appointments: "Appointment history and notes",
  Experiences: "Completed internships and experiences",
  Mentoring: "Past mentoring relationships",
};
const STATUS_TONE: Record<string, "good" | "warn" | "bad" | "info" | "neutral"> = {
  Uploaded: "neutral",
  Validated: "info",
  Committing: "warn",
  Committed: "good",
  Undone: "neutral",
  Failed: "bad",
};

export default function ImportsPage() {
  const api = useApi();
  const { me, schoolId } = useCareerShell();
  const isAdmin = me?.memberships.some((m) => m.instituteId === schoolId && m.role === "CareerAdmin") ?? false;

  const presets = useLoad(() => api<Presets>("/api/career/imports/presets"), [api, schoolId]);
  const history = useLoad(() => api<{ batch: Batch; records: Record<string, number> }[]>("/api/career/imports"), [api, schoolId]);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<BatchView | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dryRun, setDryRun] = useState<DryRun | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const [kind, setKind] = useState("");

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

  const open = (v: BatchView) => {
    setView(v);
    setMapping(v.batch.mapping ?? {});
    setDryRun(v.batch.status === "Validated" && v.batch.dryRun && "total" in v.batch.dryRun ? (v.batch.dryRun as DryRun) : null);
    setResult(v.batch.result && "created" in v.batch.result ? (v.batch.result as CommitResult) : null);
  };

  const upload = (e: React.FormEvent) => {
    e.preventDefault();
    void run("upload", async () => {
      if (!file) throw new Error("Choose a CSV export first.");
      const fd = new FormData();
      fd.append("file", file);
      if (source) fd.append("source", source);
      if (kind) fd.append("entityKind", kind);
      const v = await api<BatchView>("/api/career/imports/upload", { method: "POST", body: fd });
      open(v);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMsg(`Uploaded ${v.batch.fileName}: ${v.batch.rowCount} rows, read as ${v.batch.source} ${KIND_LABELS[v.batch.entityKind]?.toLowerCase() ?? v.batch.entityKind}. Check the column mapping below.`);
      history.reload();
    });
  };

  const changeType = (next: { source?: string; entityKind?: string }) =>
    run("type", async () => {
      if (!view) return;
      const v = await api<BatchView>(`/api/career/imports/${view.batch.id}/mapping`, { method: "PUT", json: next });
      open({ ...v, sample: view.sample });
    });

  const runDry = () =>
    run("dry", async () => {
      if (!view) return;
      await api(`/api/career/imports/${view.batch.id}/mapping`, { method: "PUT", json: { mapping } });
      const d = await api<DryRun>(`/api/career/imports/${view.batch.id}/dry-run`, { method: "POST" });
      setDryRun(d);
      setView({ ...view, batch: { ...view.batch, status: "Validated", mapping } });
      history.reload();
    });

  const commit = () => {
    if (!view || !dryRun) return;
    if (!window.confirm(`Import ${dryRun.toCreate} records from ${view.batch.fileName}? Rows with errors are skipped. You can undo the whole import later.`)) return;
    void run("commit", async () => {
      const r = await api<CommitResult>(`/api/career/imports/${view.batch.id}/commit`, { method: "POST", json: { batchSize: 200 } });
      setResult(r);
      setDryRun(null);
      setView({ ...view, batch: { ...view.batch, status: "Committed" } });
      setMsg(`Import finished: ${r.created} created, ${r.matched} matched, ${r.waitingForSignIn} waiting for sign-in, ${r.skippedWithErrors} skipped.`);
      history.reload();
    });
  };

  const undo = (b: Batch) => {
    if (!window.confirm(`Undo the import of ${b.fileName}? Everything it created is removed. Records that matched existing people are left as they are.`)) return;
    void run(`undo-${b.id}`, async () => {
      const r = await api<{ removed: Record<string, number>; pendingCancelled: number }>(`/api/career/imports/${b.id}/undo`, { method: "POST" });
      const total = Object.values(r.removed).reduce((a, n) => a + n, 0);
      setMsg(`Import undone: ${total} records removed${r.pendingCancelled ? `, ${r.pendingCancelled} waiting records cancelled` : ""}.`);
      if (view?.batch.id === b.id) setView({ ...view, batch: { ...view.batch, status: "Undone" } });
      history.reload();
    });
  };

  const openBatch = (b: Batch) => run(`open-${b.id}`, async () => open(await api<BatchView>(`/api/career/imports/${b.id}`)));

  const downloadReport = (b: Batch) =>
    run(`report-${b.id}`, async () => {
      const res = await api<Response>(`/api/career/imports/${b.id}/report.csv`, { raw: true });
      if (!res.ok) throw new Error("The report couldn't be downloaded.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `import-report-${b.fileName.replace(/\.[^.]+$/, "")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

  const applyPending = () =>
    run("pending", async () => {
      const r = await api<{ created: number }>("/api/career/imports/apply-pending", { method: "POST" });
      setMsg(r.created ? `${r.created} waiting records were created for people who have signed in.` : "Nothing new: the people those records belong to haven't signed in yet.");
      history.reload();
    });

  if (me && !isAdmin) {
    return (
      <div>
        <PageHeader title="Imports" />
        <EmptyState title="Only career admins can import data.">Ask a career admin at your school to run imports.</EmptyState>
      </div>
    );
  }

  const fields = view && presets.data ? presets.data.fields[view.batch.entityKind] ?? [] : [];
  const editable = view && (view.batch.status === "Uploaded" || view.batch.status === "Validated");

  return (
    <div>
      <PageHeader
        title="Imports"
        description="Bring students and past career-center records over from Handshake, Symplicity CSM or 12twenty exports. Job postings and applications are not imported: they stay with your job platform."
      />
      <ErrorBanner error={err ?? presets.error ?? history.error} />
      <SuccessBanner message={msg} />

      <Card title="1. Upload an export" className="mb-6">
        <form onSubmit={upload} className="grid gap-4 md:grid-cols-4 md:items-end">
          <div className="md:col-span-2">
            <Field label="CSV file" hint="Up to 5 MB. Save spreadsheets as CSV first.">
              {(p) => <input {...p} ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
            </Field>
          </div>
          <Field label="Exported from">
            {(p) => (
              <select {...p} value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">Detect from the columns</option>
                {presets.data?.sources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="What the file holds">
            {(p) => (
              <select {...p} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">Detect from the columns</option>
                {presets.data?.kinds.map((k) => (
                  <option key={k} value={k}>{KIND_LABELS[k] ?? k}</option>
                ))}
              </select>
            )}
          </Field>
          <div className="md:col-span-4">
            <Button type="submit" busy={busy === "upload"} disabled={!file}>Upload and read columns</Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Import students first: appointments, internships and mentoring rows are matched to students by email (or student id).
          History for students who haven&apos;t signed in yet is created when they first sign in.
        </p>
      </Card>

      {view && (
        <Card title={`2. Check the column mapping: ${view.batch.fileName}`} className="mb-6" actions={<Badge tone={STATUS_TONE[view.batch.status] ?? "neutral"}>{view.batch.status}</Badge>}>
          <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {presets.data?.notice ?? view.batch.presetNotice}
          </p>
          {view.batch.detection && view.batch.detection.length > 0 && (
            <p className="mb-4 text-sm text-muted-foreground">
              Best match for these columns: {view.batch.detection[0].source} {KIND_LABELS[view.batch.detection[0].entityKind]?.toLowerCase()} ({view.batch.detection[0].matched} of {view.batch.detection[0].total} typical columns found).
            </p>
          )}
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <Field label="Exported from">
              {(p) => (
                <select {...p} value={view.batch.source} disabled={!editable || busy === "type"} onChange={(e) => void changeType({ source: e.target.value })}>
                  {presets.data?.sources.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="What the file holds" hint="Changing this suggests a new mapping.">
              {(p) => (
                <select {...p} value={view.batch.entityKind} disabled={!editable || busy === "type"} onChange={(e) => void changeType({ entityKind: e.target.value })}>
                  {presets.data?.kinds.map((k) => (
                    <option key={k} value={k}>{KIND_LABELS[k] ?? k}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Column mapping</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-4">Field</th>
                  <th scope="col" className="py-2">Column in your file</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.key} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-4">
                      <label htmlFor={`map-${f.key}`} className="font-medium">
                        {f.label}
                        {f.required && <span className="ml-1 text-xs text-red-600">(required)</span>}
                      </label>
                      {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                    </td>
                    <td className="py-2">
                      <select
                        id={`map-${f.key}`}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        value={mapping[f.key] ?? ""}
                        disabled={!editable}
                        onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                      >
                        <option value="">(not in this file)</option>
                        {view.batch.headers?.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {view.sample && view.sample.length > 0 && view.batch.headers && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">First rows of the file</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="text-xs">
                  <thead>
                    <tr>{view.batch.headers.map((h) => <th key={h} scope="col" className="border-b border-border px-2 py-1 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {view.sample.map((row, i) => (
                      <tr key={i}>{view.batch.headers!.map((h, j) => <td key={h} className="border-b border-border/50 px-2 py-1">{row[j] ?? ""}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {editable && (
            <div className="mt-4">
              <Button onClick={() => void runDry()} busy={busy === "dry"}>Save mapping and run a dry run</Button>
              <span className="ml-3 text-xs text-muted-foreground">A dry run checks every row and saves nothing.</span>
            </div>
          )}
        </Card>
      )}

      {view && dryRun && (
        <Card title="3. Dry run results" className="mb-6">
          <div role="status" aria-live="polite">
            <dl className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Stat label="Rows" value={dryRun.total} />
              <Stat label="Will be imported" value={dryRun.toCreate} />
              <Stat label="Rows with errors (skipped)" value={dryRun.errors} />
              <Stat label="Already imported before" value={dryRun.alreadyImported} />
              {view.batch.entityKind === "Students" ? (
                <>
                  <Stat label="New students" value={dryRun.newRecords} />
                  <Stat label="Match existing people" value={dryRun.matchedExisting} />
                </>
              ) : (
                <Stat label="Matched to students" value={dryRun.matchedToStudents} />
              )}
              <Stat label="Waiting for sign-in" value={dryRun.waitingForSignIn} />
              <Stat label="Rows with warnings" value={dryRun.warnings} />
            </dl>
          </div>
          <IssueTable issues={dryRun.issues} truncated={dryRun.issuesTruncated} />
          {dryRun.matches.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">Matches to people already at your school (first 25)</summary>
              <ul className="mt-2 space-y-1 text-sm">
                {dryRun.matches.map((m) => (
                  <li key={`${m.line}-${m.email}`}>
                    Line {m.line}: {m.name} ({m.email}{m.studentNumber ? `, id ${m.studentNumber}` : ""}) {m.linked ? "has signed in" : "hasn't signed in yet"}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={commit} busy={busy === "commit"} disabled={dryRun.toCreate === 0}>Import {dryRun.toCreate} records</Button>
            <Button variant="secondary" onClick={() => void downloadReport(view.batch)} busy={busy === `report-${view.batch.id}`}>Download dry-run report</Button>
          </div>
        </Card>
      )}

      {view && result && (
        <Card title="4. Import report" className="mb-6">
          <div role="status" aria-live="polite">
            <p className="mb-3 text-sm">Records are marked &ldquo;{result.label}&rdquo; where they appear.</p>
            <dl className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Stat label="Created" value={result.created} />
              <Stat label="Matched existing" value={result.matched} />
              <Stat label="Waiting for sign-in" value={result.waitingForSignIn} />
              <Stat label="Already imported" value={result.alreadyImported} />
              <Stat label="Skipped (errors)" value={result.skippedWithErrors} />
              <Stat label="Failed to save" value={result.failed} />
            </dl>
          </div>
          <IssueTable issues={result.issues ?? []} truncated={false} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void downloadReport(view.batch)} busy={busy === `report-${view.batch.id}`}>Download report</Button>
            {view.batch.status === "Committed" && <Button variant="danger" onClick={() => undo(view.batch)} busy={busy === `undo-${view.batch.id}`}>Undo this import</Button>}
          </div>
        </Card>
      )}

      <Card title="Import history" actions={<Button variant="secondary" onClick={() => void applyPending()} busy={busy === "pending"}>Create waiting records now</Button>}>
        {history.loading && !history.data ? (
          <Loading />
        ) : !history.data || history.data.length === 0 ? (
          <EmptyState title="No imports yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Past imports</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-3">File</th>
                  <th scope="col" className="py-2 pr-3">Source</th>
                  <th scope="col" className="py-2 pr-3">Records</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2 pr-3">Result</th>
                  <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {history.data.map(({ batch: b, records }) => (
                  <tr key={b.id} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{b.fileName}</div>
                      <div className="text-xs text-muted-foreground">{b.rowCount} rows, uploaded {formatDate(b.createdAt, true)}</div>
                    </td>
                    <td className="py-2 pr-3">{b.source}</td>
                    <td className="py-2 pr-3">{KIND_LABELS[b.entityKind] ?? b.entityKind}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={STATUS_TONE[b.status] ?? "neutral"}>{b.status}</Badge>
                      {b.undoneAt && <div className="text-xs text-muted-foreground">Undone {formatDate(b.undoneAt, true)}</div>}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {Object.keys(records).length === 0 ? "—" : Object.entries(records).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(", ")}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button variant="ghost" onClick={() => void openBatch(b)} busy={busy === `open-${b.id}`}>Open</Button>
                        <Button variant="ghost" onClick={() => void downloadReport(b)} busy={busy === `report-${b.id}`}>Report</Button>
                        {(b.status === "Committed" || b.status === "Failed") && (
                          <Button variant="ghost" onClick={() => undo(b)} busy={busy === `undo-${b.id}`}>Undo</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-md border border-border p-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value ?? 0}</dd>
    </div>
  );
}

function IssueTable({ issues, truncated }: { issues: Issue[]; truncated: boolean }) {
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">No problems found.</p>;
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-sm">
        <caption className="mb-1 text-left text-sm font-medium">Problems by row{truncated ? " (first 500)" : ""}</caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="py-1 pr-3">Line</th>
            <th scope="col" className="py-1 pr-3">Type</th>
            <th scope="col" className="py-1 pr-3">Field</th>
            <th scope="col" className="py-1">Problem</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i, n) => (
            <tr key={n} className="border-b border-border/50 align-top">
              <td className="py-1 pr-3">{i.line}</td>
              <td className="py-1 pr-3"><Badge tone={i.severity === "error" ? "bad" : "warn"}>{i.severity === "error" ? "Skipped" : "Warning"}</Badge></td>
              <td className="py-1 pr-3 text-xs">{i.field ?? ""}</td>
              <td className="py-1">{i.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
