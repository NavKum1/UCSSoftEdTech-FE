"use client";

import React, { useRef, useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, ScrollArea, useCareerT, useCareerLabels } from "@/components/career/ui";
import { ConnectedPlatforms } from "@/components/career/ConnectedPlatforms";

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  hint?: string | null;
}

interface ImportOptions {
  dayFirst: boolean;
  currency?: string | null;
}

interface Presets {
  notice: string;
  sources: string[];
  kinds: string[];
  fields: Record<string, FieldDef[]>;
  sourceNotes?: Record<string, string>;
  defaultOptions?: Record<string, ImportOptions>;
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
  outcomeStatuses?: number;
  alsoExperiential?: number;
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
  origin?: string;
  options?: ImportOptions | null;
}

interface BatchView {
  batch: Batch;
  sample?: string[][];
}

const KIND_LABELS_KEYS = ["Students", "Appointments", "Experiences", "Mentoring", "Placements"];
/** kind labels in the career language (G1) */
function useKindLabels(): Record<string, string> {
  return useCareerLabels("careerCenterImports.kind", KIND_LABELS_KEYS);
}
const SOURCE_LABELS: Record<string, string> = { Symplicity: "Symplicity CSM", Orbis: "Orbis (Outcome)" };
const sourceLabel = (s: string) => SOURCE_LABELS[s] ?? s;
const CURRENCIES = ["USD", "INR", "GBP", "EUR", "AUD", "CAD", "NZD", "AED", "SAR", "QAR", "MYR", "PHP", "SGD", "ZAR", "KES", "NGN", "BRL"];
const STATUS_TONE: Record<string, "good" | "warn" | "bad" | "info" | "neutral"> = {
  Uploaded: "neutral",
  Validated: "info",
  Committing: "warn",
  Committed: "good",
  Undone: "neutral",
  Failed: "bad",
};

export default function ImportsPage() {
  const t = useCareerT("careerCenterImports");
  const KIND_LABELS = useKindLabels();
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
  const [options, setOptions] = useState<ImportOptions>({ dayFirst: false, currency: null });
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
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const open = (v: BatchView) => {
    setView(v);
    setMapping(v.batch.mapping ?? {});
    setOptions({ dayFirst: v.batch.options?.dayFirst ?? false, currency: v.batch.options?.currency ?? null });
    setDryRun(v.batch.status === "Validated" && v.batch.dryRun && "total" in v.batch.dryRun ? (v.batch.dryRun as DryRun) : null);
    setResult(v.batch.result && "created" in v.batch.result ? (v.batch.result as CommitResult) : null);
  };

  const upload = (e: React.FormEvent) => {
    e.preventDefault();
    void run("upload", async () => {
      if (!file) throw new Error(t("chooseACSVOrExcel"));
      const fd = new FormData();
      fd.append("file", file);
      if (source) fd.append("source", source);
      if (kind) fd.append("entityKind", kind);
      const v = await api<BatchView>("/api/career/imports/upload", { method: "POST", body: fd });
      open(v);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setMsg(t("uploadedFileNameRowCountRowsRead", { fileName: v.batch.fileName, rowCount: v.batch.rowCount, source: sourceLabel(v.batch.source), value: KIND_LABELS[v.batch.entityKind]?.toLowerCase() ?? v.batch.entityKind }));
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
      await api(`/api/career/imports/${view.batch.id}/mapping`, { method: "PUT", json: { mapping, options } });
      const d = await api<DryRun>(`/api/career/imports/${view.batch.id}/dry-run`, { method: "POST" });
      setDryRun(d);
      setView({ ...view, batch: { ...view.batch, status: "Validated", mapping, options } });
      history.reload();
    });

  const commit = () => {
    if (!view || !dryRun) return;
    if (!window.confirm(t("importToCreateRecordsFromFileName", { toCreate: dryRun.toCreate, fileName: view.batch.fileName }))) return;
    void run("commit", async () => {
      const r = await api<CommitResult>(`/api/career/imports/${view.batch.id}/commit`, { method: "POST", json: { batchSize: 200 } });
      setResult(r);
      setDryRun(null);
      setView({ ...view, batch: { ...view.batch, status: "Committed" } });
      setMsg(t("importFinishedCreatedCreatedMatched", { created: r.created, matched: r.matched, waitingForSignIn: r.waitingForSignIn, skippedWithErrors: r.skippedWithErrors }));
      history.reload();
    });
  };

  const undo = (b: Batch) => {
    if (!window.confirm(t("undoTheImportOfFileName", { fileName: b.fileName }))) return;
    void run(`undo-${b.id}`, async () => {
      const r = await api<{ removed: Record<string, number>; pendingCancelled: number }>(`/api/career/imports/${b.id}/undo`, { method: "POST" });
      const total = Object.values(r.removed).reduce((a, n) => a + n, 0);
      setMsg(t("importUndoneTotalRecordsRemoved", { total, value: r.pendingCancelled ? t("pendingCancelledWaitingRecordsCancelled", { pendingCancelled: r.pendingCancelled }) : "" }));
      if (view?.batch.id === b.id) setView({ ...view, batch: { ...view.batch, status: "Undone" } });
      history.reload();
    });
  };

  const openBatch = (b: Batch) => run(`open-${b.id}`, async () => open(await api<BatchView>(`/api/career/imports/${b.id}`)));

  const downloadReport = (b: Batch) =>
    run(`report-${b.id}`, async () => {
      const res = await api<Response>(`/api/career/imports/${b.id}/report.csv`, { raw: true });
      if (!res.ok) throw new Error(t("theReportCouldntBeDownloaded"));
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
      setMsg(r.created ? t("createdWaitingRecordsWereCreated", { created: r.created }) : t("nothingNewThePeopleThose"));
      history.reload();
    });

  if (me && !isAdmin) {
    return (
      <div>
        <PageHeader title={t("imports")} />
        <EmptyState title={t("onlyCareerAdminsCanImport")}>{t("askACareerAdminAt")}</EmptyState>
      </div>
    );
  }

  const fields = view && presets.data ? presets.data.fields[view.batch.entityKind] ?? [] : [];
  const editable = view && (view.batch.status === "Uploaded" || view.batch.status === "Validated");

  return (
    <div>
      <PageHeader
        title={t("imports")}
        description={t("bringStudentsPastCareerCenter")}
      />
      <ErrorBanner error={err ?? presets.error ?? history.error} />
      <SuccessBanner message={msg} />

      <Card title={t("n1UploadAnExport")} className="mb-6">
        <form onSubmit={upload} className="grid gap-4 md:grid-cols-4 md:items-end">
          <div className="md:col-span-2">
            <Field label={t("cSVOrExcelFile")} hint={t("upTo5MBCSV")}>
              {(p) => <input {...p} ref={fileRef} type="file" accept=".csv,.txt,.tsv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
            </Field>
          </div>
          <Field label={t("exportedFrom")}>
            {(p) => (
              <select {...p} value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">{t("detectFromTheColumns")}</option>
                {presets.data?.sources.map((s) => (
                  <option key={s} value={s}>{sourceLabel(s)}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("whatTheFileHolds")}>
            {(p) => (
              <select {...p} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">{t("detectFromTheColumns")}</option>
                {presets.data?.kinds.map((k) => (
                  <option key={k} value={k}>{KIND_LABELS[k] ?? k}</option>
                ))}
              </select>
            )}
          </Field>
          <div className="md:col-span-4">
            <Button type="submit" busy={busy === "upload"} disabled={!file}>{t("uploadAndReadColumns")}</Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("importStudentsFirstAppointmentsInternshi")}
          {presets.data?.sourceNotes && source && presets.data.sourceNotes[source] ? <> {sourceLabel(source)}: {presets.data.sourceNotes[source]}</> : null}
        </p>
      </Card>

      {view && (
        <Card title={t("n2CheckTheColumnMapping", { fileName: view.batch.fileName })} className="mb-6" actions={<Badge tone={STATUS_TONE[view.batch.status] ?? "neutral"}>{String(view.batch.status ?? "").replace(/([a-z])([A-Z])/g, (_m, a: string, b: string) => `${a} ${b.toLowerCase()}`)}</Badge>}>
          <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {presets.data?.notice ?? view.batch.presetNotice}
          </p>
          {view.batch.detection && view.batch.detection.length > 0 && (
            <p className="mb-4 text-sm text-muted-foreground">
              {t("bestMatchForTheseColumns", { source: sourceLabel(view.batch.detection[0].source), value: KIND_LABELS[view.batch.detection[0].entityKind]?.toLowerCase(), matched: view.batch.detection[0].matched, total: view.batch.detection[0].total })}
            </p>
          )}
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <Field label={t("exportedFrom")}>
              {(p) => (
                <select {...p} value={view.batch.source} disabled={!editable || busy === "type" || (view.batch.origin ?? "Upload") !== "Upload"} onChange={(e) => void changeType({ source: e.target.value })}>
                  {!presets.data?.sources.includes(view.batch.source) && <option value={view.batch.source}>{sourceLabel(view.batch.source)}</option>}
                  {presets.data?.sources.map((s) => (
                    <option key={s} value={s}>{sourceLabel(s)}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("whatTheFileHolds")} hint={t("changingThisSuggestsANew")}>
              {(p) => (
                <select {...p} value={view.batch.entityKind} disabled={!editable || busy === "type"} onChange={(e) => void changeType({ entityKind: e.target.value })}>
                  {presets.data?.kinds.map((k) => (
                    <option key={k} value={k}>{KIND_LABELS[k] ?? k}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          <fieldset className="mb-4 grid gap-4 rounded-md border border-border p-3 md:grid-cols-2">
            <legend className="px-1 text-sm font-medium">{t("howToReadValues")}</legend>
            <div className="flex items-start gap-2">
              <input
                id="opt-dayfirst"
                type="checkbox"
                className="mt-1"
                checked={options.dayFirst}
                disabled={!editable}
                onChange={(e) => setOptions({ ...options, dayFirst: e.target.checked })}
                aria-describedby="opt-dayfirst-hint"
              />
              <div>
                <label htmlFor="opt-dayfirst" className="text-sm font-medium">{t("datesAreWrittenDayFirst")}</label>
                <p id="opt-dayfirst-hint" className="text-xs text-muted-foreground">{t("on03042025Is")}</p>
              </div>
            </div>
            {view.batch.entityKind === "Placements" && (
              <Field label={t("currencyOfAmountsWithoutOne")} hint={t("salaryBandsAreFilledFor")}>
                {(p) => (
                  <select {...p} value={options.currency ?? ""} disabled={!editable} onChange={(e) => setOptions({ ...options, currency: e.target.value || null })}>
                    <option value="">{t("notStated")}</option>
                    {Array.from(new Set([...(options.currency ? [options.currency] : []), ...CURRENCIES])).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </Field>
            )}
          </fieldset>

          <ScrollArea>
            <table className="w-full text-sm [&_th]:text-start">
              <caption className="sr-only">{t("columnMapping")}</caption>
              <thead>
                <tr className="border-b border-border text-start">
                  <th scope="col" className="py-2 pe-4">{t("field")}</th>
                  <th scope="col" className="py-2">{t("columnInYourFile")}</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.key} className="border-b border-border/60 align-top">
                    <td className="py-2 pe-4">
                      <label htmlFor={`map-${f.key}`} className="font-medium">
                        {f.label}
                        {f.required && <span className="ms-1 text-xs text-red-600">{t("required")}</span>}
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
                        <option value="">{t("notInThisFile")}</option>
                        {view.batch.headers?.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>

          {view.sample && view.sample.length > 0 && view.batch.headers && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">{t("firstRowsOfTheFile")}</summary>
              <ScrollArea className="mt-2 overflow-x-auto">
                <table className="text-xs [&_th]:text-start">
                  <thead>
                    <tr>{view.batch.headers.map((h) => <th key={h} scope="col" className="border-b border-border px-2 py-1 text-start">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {view.sample.map((row, i) => (
                      <tr key={i}>{view.batch.headers!.map((h, j) => <td key={h} className="border-b border-border/50 px-2 py-1">{row[j] ?? ""}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </details>
          )}

          {editable && (
            <div className="mt-4">
              <Button onClick={() => void runDry()} busy={busy === "dry"}>{t("saveMappingAndRunA")}</Button>
              <span className="ms-3 text-xs text-muted-foreground">{t("aDryRunChecksEvery")}</span>
            </div>
          )}
        </Card>
      )}

      {view && dryRun && (
        <Card title={t("n3DryRunResults")} className="mb-6">
          <div role="status" aria-live="polite">
            <dl className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Stat label={t("rows")} value={dryRun.total} />
              <Stat label={t("willBeImported")} value={dryRun.toCreate} />
              <Stat label={t("rowsWithErrorsSkipped")} value={dryRun.errors} />
              <Stat label={t("alreadyImportedBefore")} value={dryRun.alreadyImported} />
              {view.batch.entityKind === "Students" ? (
                <>
                  <Stat label={t("newStudents")} value={dryRun.newRecords} />
                  <Stat label={t("matchExistingPeople")} value={dryRun.matchedExisting} />
                </>
              ) : (
                <Stat label={t("matchedToStudents")} value={dryRun.matchedToStudents} />
              )}
              {view.batch.entityKind === "Placements" && (
                <>
                  <Stat label={t("seekingOrNotSeekingStatuses")} value={dryRun.outcomeStatuses} />
                  <Stat label={t("finishedInternshipsAlsoAddedTo")} value={dryRun.alsoExperiential} />
                </>
              )}
              <Stat label={t("waitingForSignIn")} value={dryRun.waitingForSignIn} />
              <Stat label={t("rowsWithWarnings")} value={dryRun.warnings} />
            </dl>
          </div>
          <IssueTable issues={dryRun.issues} truncated={dryRun.issuesTruncated} />
          {dryRun.matches.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">{t("matchesToPeopleAlreadyAt")}</summary>
              <ul className="mt-2 space-y-1 text-sm">
                {dryRun.matches.map((m) => (
                  <li key={`${m.line}-${m.email}`}>
                    {t("lineLineNameEmail", { line: m.line, name: m.name, email: m.email })}{m.studentNumber ? t("idStudentNumber", { studentNumber: m.studentNumber }) : ""}) {m.linked ? t("hasSignedIn") : t("hasntSignedInYet")}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={commit} busy={busy === "commit"} disabled={dryRun.toCreate === 0}>{t("importToCreateRecords", { toCreate: dryRun.toCreate })}</Button>
            <Button variant="secondary" onClick={() => void downloadReport(view.batch)} busy={busy === `report-${view.batch.id}`}>{t("downloadDryRunReport")}</Button>
          </div>
        </Card>
      )}

      {view && result && (
        <Card title={t("n4ImportReport")} className="mb-6">
          <div role="status" aria-live="polite">
            <p className="mb-3 text-sm">{t("recordsAreMarkedLabelWhere", { label: result.label })}</p>
            <dl className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <Stat label={t("created")} value={result.created} />
              <Stat label={t("matchedExisting")} value={result.matched} />
              <Stat label={t("waitingForSignIn")} value={result.waitingForSignIn} />
              <Stat label={t("alreadyImported")} value={result.alreadyImported} />
              <Stat label={t("skippedErrors")} value={result.skippedWithErrors} />
              <Stat label={t("failedToSave")} value={result.failed} />
            </dl>
          </div>
          <IssueTable issues={result.issues ?? []} truncated={false} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void downloadReport(view.batch)} busy={busy === `report-${view.batch.id}`}>{t("downloadReport")}</Button>
            {view.batch.status === "Committed" && <Button variant="danger" onClick={() => undo(view.batch)} busy={busy === `undo-${view.batch.id}`}>{t("undoThisImport")}</Button>}
          </div>
        </Card>
      )}

      <ConnectedPlatforms
        onPulled={(v) => {
          void openBatch(v.batch as Batch);
          history.reload();
        }}
      />

      <Card title={t("importHistory")} actions={<Button variant="secondary" onClick={() => void applyPending()} busy={busy === "pending"}>{t("createWaitingRecordsNow")}</Button>}>
        {history.loading && !history.data ? (
          <Loading />
        ) : !history.data || history.data.length === 0 ? (
          <EmptyState title={t("noImportsYet")} />
        ) : (
          <ScrollArea>
            <table className="w-full text-sm [&_th]:text-start">
              <caption className="sr-only">{t("pastImports")}</caption>
              <thead>
                <tr className="border-b border-border text-start">
                  <th scope="col" className="py-2 pe-3">{t("file")}</th>
                  <th scope="col" className="py-2 pe-3">{t("source")}</th>
                  <th scope="col" className="py-2 pe-3">{t("records")}</th>
                  <th scope="col" className="py-2 pe-3">{t("status")}</th>
                  <th scope="col" className="py-2 pe-3">{t("result")}</th>
                  <th scope="col" className="py-2"><span className="sr-only">{t("actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {history.data.map(({ batch: b, records }) => (
                  <tr key={b.id} className="border-b border-border/60 align-top">
                    <td className="py-2 pe-3">
                      <div className="font-medium">{b.fileName}</div>
                      <div className="text-xs text-muted-foreground">{t("rowCountRowsUploadedCreatedAt", { rowCount: b.rowCount, createdAt: formatDate(b.createdAt, true) })}</div>
                    </td>
                    <td className="py-2 pe-3">{sourceLabel(b.source)}</td>
                    <td className="py-2 pe-3">{KIND_LABELS[b.entityKind] ?? b.entityKind}</td>
                    <td className="py-2 pe-3">
                      <Badge tone={STATUS_TONE[b.status] ?? "neutral"}>{String(b.status ?? "").replace(/([a-z])([A-Z])/g, (_m, a: string, b: string) => `${a} ${b.toLowerCase()}`)}</Badge>
                      {b.undoneAt && <div className="text-xs text-muted-foreground">{t("undoneUndoneAt", { undoneAt: formatDate(b.undoneAt, true) })}</div>}
                    </td>
                    <td className="py-2 pe-3 text-xs">
                      {Object.keys(records).length === 0 ? "—" : Object.entries(records).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(", ")}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button variant="ghost" onClick={() => void openBatch(b)} busy={busy === `open-${b.id}`}>{t("open")}</Button>
                        <Button variant="ghost" onClick={() => void downloadReport(b)} busy={busy === `report-${b.id}`}>{t("report")}</Button>
                        {(b.status === "Committed" || b.status === "Failed") && (
                          <Button variant="ghost" onClick={() => undo(b)} busy={busy === `undo-${b.id}`}>{t("undo")}</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
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
  const t = useCareerT("careerCenterImports");
  if (issues.length === 0) return <p className="text-sm text-muted-foreground">{t("noProblemsFound")}</p>;
  return (
    <ScrollArea className="max-h-96 overflow-auto">
      <table className="w-full text-sm [&_th]:text-start">
        <caption className="mb-1 text-start text-sm font-medium">{t("problemsByRow")}{truncated ? t("first500") : ""}</caption>
        <thead>
          <tr className="border-b border-border text-start">
            <th scope="col" className="py-1 pe-3">{t("line")}</th>
            <th scope="col" className="py-1 pe-3">{t("type")}</th>
            <th scope="col" className="py-1 pe-3">{t("field")}</th>
            <th scope="col" className="py-1">{t("problem")}</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i, n) => (
            <tr key={n} className="border-b border-border/50 align-top">
              <td className="py-1 pe-3">{i.line}</td>
              <td className="py-1 pe-3"><Badge tone={i.severity === "error" ? "bad" : "warn"}>{i.severity === "error" ? t("skipped") : t("warning")}</Badge></td>
              <td className="py-1 pe-3 text-xs">{i.field ?? ""}</td>
              <td className="py-1">{i.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}
