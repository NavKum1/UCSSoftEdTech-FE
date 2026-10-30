"use client";

/**
 * Import leads from another system's CSV export (VirtualAdviser, a spreadsheet) for institute admins
 * (API: /api/institute/crm/import, CrmImportService). Choose the file, check what each column is, see what would happen
 * (new leads, people already in the CRM, rows that can't be used, how statuses and owners map), then import. Nothing is
 * sent to the people imported. Past imports are listed and can be undone.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, History, Undo2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { useLatestRef } from "@/lib/legacyApi";
import { crm, StageBadge, type GetToken } from "./api";

interface Preview {
  fileName: string;
  fields: { key: string; label: string }[];
  columns: { index: number; name: string; field: string; samples: string[] }[];
  rows: number;
  create: number;
  duplicates: number;
  alreadyInCrm: number;
  repeatedInFile: number;
  failed: number;
  optOut: number;
  undated: number | null;
  source: string;
  stages: { value: string; stage: string; count: number; known: boolean }[];
  owners: { value: string; member: string | null; count: number }[];
  sample: {
    row: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    course: string | null;
    stage: string;
    received: string | null;
    receivedText: string | null;
    owner: string | null;
    answers: number;
    duplicate: "crm" | "file" | null;
    problem: string | null;
  }[];
  problems: { row: number; message: string }[];
}

interface Batch {
  id: string;
  fileName: string;
  source: string;
  byName: string;
  createdAt: string;
  rows: number;
  created: number;
  noted: number;
  skipped: number;
  failed: number;
  undoneAt: string | null;
  undoneBy: string | null;
  kept: number;
}

const input = "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20";
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function ImportView({ getToken, onImported }: { getToken: GetToken; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("VirtualAdviser");
  const [duplicates, setDuplicates] = useState<"skip" | "note">("note");
  const [dateOrder, setDateOrder] = useState<"mdy" | "dmy">("mdy");
  const [mapping, setMapping] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  // Previews run as options change; only the latest one's answer is shown (an earlier one can come back last)
  const latest = useRef(0);

  const loadBatches = useCallback(async () => {
    setBatches(await crm<Batch[]>(getToken, "/import/batches").catch(() => []));
  }, [getToken]);
  const loadBatchesRef = useLatestRef(loadBatches);
  useEffect(() => {
    loadBatchesRef.current();
  }, [loadBatchesRef]);

  const send = async (path: string, f: File, m: string[] | null) => {
    const body = new FormData();
    body.append("file", f, f.name);
    if (m) body.append("mapping", JSON.stringify(m));
    body.append("duplicates", duplicates);
    body.append("dateOrder", dateOrder);
    body.append("source", source.trim());
    const res = await authenticatedFetch(`/api/institute/crm${path}`, { method: "POST", body }, getToken);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "That didn't work. Please try again.");
    return data;
  };

  const check = async (f: File | null = file, m: string[] | null = mapping) => {
    if (!f) return;
    const mine = ++latest.current;
    setBusy(true);
    setMessage(null);
    try {
      const p = (await send("/import/preview", f, m)) as Preview;
      if (mine !== latest.current) return;
      setPreview(p);
      setMapping(p.columns.map((c) => c.field));
    } catch (e) {
      if (mine !== latest.current) return;
      setPreview(null);
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      if (mine === latest.current) setBusy(false);
    }
  };

  // The date order and what to do with people already in the CRM change the preview
  const checkRef = useLatestRef(check);
  useEffect(() => {
    checkRef.current();
  }, [dateOrder, duplicates, checkRef]);

  const choose = (f: File | null) => {
    setFile(f);
    setMapping(null);
    setPreview(null);
    if (f) check(f, null);
  };

  const setField = (index: number, field: string) => {
    if (!mapping) return;
    const m = mapping.map((x, i) => (i === index ? field : x));
    setMapping(m);
    check(file, m);
  };

  const runImport = async () => {
    if (!file || !preview) return;
    if (!window.confirm(`Import ${plural(preview.create, "new lead")}${duplicates === "note" && preview.duplicates ? ` and add ${plural(preview.duplicates, "note")} to people already in your CRM` : ""}? Nothing is sent to them.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = (await send("/import", file, mapping)) as { created: number; noted: number; skipped: number; failed: number };
      setMessage({
        ok: true,
        text: `Imported ${plural(r.created, "new lead")}` + (r.noted ? `, added ${plural(r.noted, "note")} to people already in your CRM` : "") + (r.skipped ? `, left out ${plural(r.skipped, "row")} for people already in your CRM` : "")
          + (r.failed ? `, and couldn't use ${plural(r.failed, "row")}` : "") + ".",
      });
      setFile(null);
      setPreview(null);
      setMapping(null);
      if (fileInput.current) fileInput.current.value = "";
      loadBatches();
      onImported();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const undo = async (b: Batch) => {
    if (!window.confirm(`Undo the import of ${b.fileName}? This removes the ${plural(b.created, "lead")} it added, except any your team has worked on since, and the notes it added to other leads.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await crm<{ removed: number; kept: number; notesRemoved: number }>(getToken, `/import/batches/${b.id}/undo`, { method: "POST" });
      setMessage({
        ok: true,
        text: `Undone: removed ${plural(r.removed, "lead")}` + (r.notesRemoved ? ` and ${plural(r.notesRemoved, "note")}` : "") + "." + (r.kept ? ` Kept ${plural(r.kept, "lead")} your team has worked on.` : ""),
      });
      loadBatches();
      onImported();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <FileUp aria-hidden="true" className="h-4 w-4 text-cyan-700" /> Import leads
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring your leads over from VirtualAdviser or another system, as a CSV file. You see what will happen before anything is saved, and nothing is sent to the people you import.
        </p>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <label className="block font-medium md:col-span-2">
            CSV file
            <input ref={fileInput} type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => choose(e.target.files?.[0] ?? null)} className={`${input} file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm`} />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">An Excel file? Open it in Excel and choose File → Save As → CSV (UTF-8). Up to 20,000 rows.</span>
          </label>
          <label className="block font-medium">
            Where the leads came from
            <input className={input} value={source} maxLength={40} onChange={(e) => setSource(e.target.value)} onBlur={() => check()} />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">Their source in the CRM (unless the file has a source column) and a tag on each, so you can find them.</span>
          </label>
          <label className="block font-medium">
            Dates like 03/04/2026 mean
            <select className={input} value={dateOrder} onChange={(e) => setDateOrder(e.target.value as "mdy" | "dmy")}>
              <option value="mdy">Month first: 4 March 2026</option>
              <option value="dmy">Day first: 3 April 2026</option>
            </select>
          </label>
          <fieldset className="md:col-span-2">
            <legend className="font-medium">Someone who is already in your CRM (same email or phone number)</legend>
            <div className="mt-1 flex flex-wrap gap-4">
              {(
                [
                  ["note", "Add the row to their lead as a note"],
                  ["skip", "Leave the row out"],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className="flex items-center gap-2">
                  <input type="radio" name="duplicates" value={v} checked={duplicates === v} onChange={() => setDuplicates(v)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {busy && <p className="mt-3 text-sm text-muted-foreground" role="status">Working…</p>}
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-800 dark:text-red-300"}`}>
            {message.text}
          </p>
        )}
      </section>

      {preview && mapping && (
        <>
          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">What each column is</h3>
            <p className="mt-1 text-xs text-muted-foreground">Matched from the column names; change any that are wrong. Columns kept as answers show on the lead with what they shared.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">Column in the file</th>
                    <th className="pb-2 pr-3 font-medium">Examples</th>
                    <th className="pb-2 font-medium">Import as</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.columns.map((c) => (
                    <tr key={c.index} className="border-t border-border align-top">
                      <td className="py-2 pr-3 font-medium">{c.name}</td>
                      <td className="max-w-xs py-2 pr-3 text-xs text-muted-foreground">{c.samples.length ? c.samples.join(" · ") : "(empty)"}</td>
                      <td className="py-2">
                        <select aria-label={`Import ${c.name} as`} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" value={mapping[c.index]} disabled={busy} onChange={(e) => setField(c.index, e.target.value)}>
                          {preview.fields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">What will happen</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
              <Count label="New leads" value={preview.create} />
              <Count label={duplicates === "note" ? "Notes on people already in the CRM" : "Rows left out: already in the CRM"} value={preview.duplicates} hint={preview.repeatedInFile ? `${plural(preview.repeatedInFile, "row")} repeat someone earlier in the file` : undefined} />
              <Count label="Rows that can't be used" value={preview.failed} warn={preview.failed > 0} />
              <Count label="Marked do not contact" value={preview.optOut} hint="They asked not to be contacted" />
            </dl>
            {preview.undated ? (
              <p className="mt-3 flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {plural(preview.undated, "date")} couldn&apos;t be read; those leads will be dated today.
              </p>
            ) : null}

            {(preview.stages.length > 0 || preview.owners.length > 0) && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {preview.stages.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground">Their statuses become</h4>
                    <ul className="mt-1 space-y-1 text-sm">
                      {preview.stages.map((s) => (
                        <li key={s.value} className="flex flex-wrap items-center gap-2">
                          <span>{s.value}</span>
                          <span aria-hidden="true" className="text-muted-foreground">→</span>
                          <StageBadge stage={s.stage} />
                          <span className="text-xs text-muted-foreground">{plural(s.count, "lead")}</span>
                          {!s.known && <span className="text-xs text-amber-800 dark:text-amber-300">not recognised, so New</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {preview.owners.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground">Their owners become</h4>
                    <ul className="mt-1 space-y-1 text-sm">
                      {preview.owners.map((o) => (
                        <li key={o.value} className="flex flex-wrap items-center gap-2">
                          <span>{o.value}</span>
                          <span aria-hidden="true" className="text-muted-foreground">→</span>
                          {o.member ? <span className="font-medium">{o.member}</span> : <span className="text-amber-800 dark:text-amber-300">not on your team, so unassigned</span>}
                          <span className="text-xs text-muted-foreground">{plural(o.count, "lead")}</span>
                        </li>
                      ))}
                    </ul>
                    {preview.owners.some((o) => !o.member) && <p className="mt-1 text-xs text-muted-foreground">Add them to your team in Settings first to keep their leads with them.</p>}
                  </div>
                )}
              </div>
            )}

            <h4 className="mt-5 text-xs font-medium text-muted-foreground">The first rows</h4>
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-1 pr-3 font-medium">Row</th>
                    <th className="pb-1 pr-3 font-medium">Name</th>
                    <th className="pb-1 pr-3 font-medium">Email / phone</th>
                    <th className="pb-1 pr-3 font-medium">Stage</th>
                    <th className="pb-1 pr-3 font-medium">Received</th>
                    <th className="pb-1 font-medium">What happens</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((r) => (
                    <tr key={r.row} className="border-t border-border align-top">
                      <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{r.row}</td>
                      <td className="py-1.5 pr-3">{r.name ?? "—"}</td>
                      <td className="break-all py-1.5 pr-3">{[r.email, r.phone].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="py-1.5 pr-3"><StageBadge stage={r.stage} /></td>
                      <td className="py-1.5 pr-3">{r.received ? new Date(r.received).toLocaleDateString(undefined, { dateStyle: "medium" }) : r.receivedText ? <span className="text-amber-800 dark:text-amber-300">today (“{r.receivedText}” unreadable)</span> : "today"}</td>
                      <td className="py-1.5 text-xs">
                        {r.problem ? <span className="text-red-700 dark:text-red-400">Can&apos;t be used: {r.problem}</span>
                          : r.duplicate ? (duplicates === "note" ? "A note on their existing lead" : "Left out: already in your CRM")
                          : `New lead${r.answers ? `, ${plural(r.answers, "answer")}` : ""}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.problems.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-medium">Rows that can&apos;t be used ({preview.failed.toLocaleString()})</summary>
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {preview.problems.map((p) => (
                    <li key={p.row}>
                      Row {p.row}: {p.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" disabled={busy || preview.create + (duplicates === "note" ? preview.duplicates : 0) === 0} onClick={runImport} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-50">
                {preview.create === 0 && duplicates === "note" && preview.duplicates > 0
                  ? `Add ${plural(preview.duplicates, "note")}`
                  : `Import ${plural(preview.create, "lead")}${duplicates === "note" && preview.duplicates ? ` and ${plural(preview.duplicates, "note")}` : ""}`}
              </button>
              {preview.create + (duplicates === "note" ? preview.duplicates : 0) === 0 ? (
                <span className="text-xs text-muted-foreground">
                  {preview.duplicates > 0 ? "Everyone in this file is already in your CRM. Choose “Add the row to their lead as a note” to add their rows." : "None of the rows can be used."}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">from {preview.fileName} · tagged “{preview.source}” · you can undo it below</span>
              )}
            </div>
          </section>
        </>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <History aria-hidden="true" className="h-4 w-4 text-muted-foreground" /> Past imports
        </h3>
        {batches.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No imports yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {batches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-medium">
                    {b.fileName} <span className="font-normal text-muted-foreground">· {b.source}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {when(b.createdAt)} by {b.byName} · {plural(b.created, "new lead")}
                    {b.noted ? `, ${plural(b.noted, "note")}` : ""}
                    {b.skipped ? `, ${plural(b.skipped, "row")} left out` : ""}
                    {b.failed ? `, ${plural(b.failed, "row")} not usable` : ""}
                  </p>
                  {b.undoneAt && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 aria-hidden="true" className="h-3 w-3" /> Undone {when(b.undoneAt)} by {b.undoneBy}
                      {b.kept ? `; kept ${plural(b.kept, "lead")} your team had worked on` : ""}
                    </p>
                  )}
                </div>
                {!b.undoneAt && (
                  <button type="button" disabled={busy} onClick={() => undo(b)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                    <Undo2 aria-hidden="true" className="h-3.5 w-3.5" /> Undo
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Count({ label, value, hint, warn }: { label: string; value: number; hint?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${warn ? "text-red-700 dark:text-red-400" : ""}`}>{value.toLocaleString()}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
