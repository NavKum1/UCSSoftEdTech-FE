"use client";

import React, { useRef, useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";

interface SisSettings {
  baseUrl?: string | null;
  tokenUrl?: string | null;
  clientId?: string | null;
  hasClientSecret: boolean;
  scope?: string | null;
  orgSourcedId?: string | null;
  importDemographics: boolean;
  nightlyEnabled: boolean;
  nightlyDeactivateMissing: boolean;
  lastSyncAt?: string | null;
  lastStatus?: string | null;
}

interface SettingsResponse {
  settings: SisSettings;
  partnerSchool: boolean;
  csvPresets: string[];
  csvFields: { key: string; label: string; required: boolean; hint?: string | null }[];
  presetNotice: string;
}

interface Run {
  id: string;
  kind: string;
  trigger: string;
  fullSync: boolean;
  deactivateMissing: boolean;
  dryRun: boolean;
  status: string;
  message?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  counts: Record<string, number>;
  issues: { line: number; field?: string | null; message: string; severity: string }[];
}

interface CsvPreview {
  preset: string;
  mapping: Record<string, string>;
  headers: string[];
  rowCount: number;
}

const KIND_LABELS: Record<string, string> = { OneRosterCsv: "OneRoster CSV", GenericCsv: "SIS CSV", OneRosterRest: "OneRoster API" };

interface SyncOptions {
  fullSync: boolean;
  deactivateMissing: boolean;
  dryRun: boolean;
}

function OptionsFields({ value, onChange, idPrefix }: { value: SyncOptions; onChange: (v: SyncOptions) => void; idPrefix: string }) {
  return (
    <fieldset className="space-y-2 text-sm">
      <legend className="mb-1 font-medium">Sync options</legend>
      <label className="flex items-start gap-2" htmlFor={`${idPrefix}-dry`}>
        <input id={`${idPrefix}-dry`} type="checkbox" checked={value.dryRun} onChange={(e) => onChange({ ...value, dryRun: e.target.checked })} />
        <span>Dry run (report what would change; save nothing)</span>
      </label>
      <label className="flex items-start gap-2" htmlFor={`${idPrefix}-full`}>
        <input id={`${idPrefix}-full`} type="checkbox" checked={value.fullSync} onChange={(e) => onChange({ ...value, fullSync: e.target.checked, deactivateMissing: e.target.checked && value.deactivateMissing })} />
        <span>This is a full roster (every current student is listed)</span>
      </label>
      <label className="flex items-start gap-2" htmlFor={`${idPrefix}-deact`}>
        <input id={`${idPrefix}-deact`} type="checkbox" disabled={!value.fullSync} checked={value.deactivateMissing} onChange={(e) => onChange({ ...value, deactivateMissing: e.target.checked })} />
        <span>
          Suspend students missing from this full roster
          <span className="block text-xs text-muted-foreground">Off by default. Suspended students can&apos;t sign in to the career suite until they appear in a later sync.</span>
        </span>
      </label>
    </fieldset>
  );
}

export default function SisSettingsPage() {
  const api = useApi();
  const { me, schoolId } = useCareerShell();
  const isAdmin = me?.memberships.some((m) => m.instituteId === schoolId && m.role === "CareerAdmin") ?? false;
  const settings = useLoad(() => api<SettingsResponse>("/api/career/sis/settings"), [api, schoolId]);
  const runs = useLoad(() => api<Run[]>("/api/career/sis/runs"), [api, schoolId]);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<SisSettings> & { clientSecret?: string }>({});
  const [lastRun, setLastRun] = useState<Run | null>(null);

  const [orOpts, setOrOpts] = useState<SyncOptions>({ fullSync: false, deactivateMissing: false, dryRun: true });
  const [csvOpts, setCsvOpts] = useState<SyncOptions>({ fullSync: false, deactivateMissing: false, dryRun: true });
  const [restOpts, setRestOpts] = useState<SyncOptions>({ fullSync: true, deactivateMissing: false, dryRun: false });
  const orRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [orFiles, setOrFiles] = useState<FileList | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);

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

  const s = settings.data?.settings;
  const form = { ...s, ...draft } as SisSettings & { clientSecret?: string };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void run("save", async () => {
      await api("/api/career/sis/settings", {
        method: "PUT",
        json: {
          baseUrl: form.baseUrl ?? "",
          tokenUrl: form.tokenUrl ?? "",
          clientId: form.clientId ?? "",
          clientSecret: draft.clientSecret || null,
          scope: form.scope ?? "",
          orgSourcedId: form.orgSourcedId ?? "",
          importDemographics: form.importDemographics,
          nightlyEnabled: form.nightlyEnabled,
          nightlyDeactivateMissing: form.nightlyDeactivateMissing,
        },
      });
      setDraft({});
      setMsg("SIS settings saved.");
      settings.reload();
    });
  };

  const finished = (r: Run) => {
    setLastRun(r);
    setMsg(r.status === "Failed" ? null : r.dryRun ? "Dry run finished: nothing was saved." : "Sync finished.");
    if (r.status === "Failed") setErr(r.message ?? "The sync failed.");
    runs.reload();
    settings.reload();
  };

  const uploadOneRoster = () =>
    run("or", async () => {
      if (!orFiles || orFiles.length === 0) throw new Error("Choose the OneRoster .zip or its CSV files.");
      const fd = new FormData();
      Array.from(orFiles).forEach((f) => fd.append("files", f));
      fd.append("fullSync", String(orOpts.fullSync));
      fd.append("deactivateMissing", String(orOpts.deactivateMissing));
      fd.append("dryRun", String(orOpts.dryRun));
      finished(await api<Run>("/api/career/sis/oneroster/upload", { method: "POST", body: fd }));
      if (!orOpts.dryRun && orRef.current) orRef.current.value = "";
    });

  const previewCsv = (preset?: string) =>
    run("preview", async () => {
      if (!csvFile) throw new Error("Choose a CSV export first.");
      const fd = new FormData();
      fd.append("file", csvFile);
      if (preset) fd.append("preset", preset);
      setPreview(await api<CsvPreview>("/api/career/sis/csv/preview", { method: "POST", body: fd }));
    });

  const syncCsv = () =>
    run("csv", async () => {
      if (!csvFile || !preview) throw new Error("Choose a file and check the mapping first.");
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("mapping", JSON.stringify(preview.mapping));
      fd.append("fullSync", String(csvOpts.fullSync));
      fd.append("deactivateMissing", String(csvOpts.deactivateMissing));
      fd.append("dryRun", String(csvOpts.dryRun));
      finished(await api<Run>("/api/career/sis/csv/sync", { method: "POST", body: fd }));
    });

  const syncNow = () =>
    run("rest", async () => {
      finished(await api<Run>("/api/career/sis/rest/sync-now", { method: "POST", json: restOpts }));
    });

  if (me && !isAdmin) {
    return (
      <div>
        <PageHeader title="Student information system" />
        <EmptyState title="Only career admins can manage roster sync." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Student information system"
        description="Keep your student roster in step with your SIS: OneRoster 1.2 files or API, or a CSV export from Banner, Workday Student or PeopleSoft. Students are matched by SIS id and email; their school record is marked as verified."
      />
      <ErrorBanner error={err ?? settings.error ?? runs.error} />
      <SuccessBanner message={msg} />
      {settings.data?.partnerSchool && (
        <p className="mb-4 rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          Your school reaches the career suite through a partner platform, which usually manages the roster. Use roster sync here only if your partner agreement says so.
        </p>
      )}
      {settings.loading && !settings.data ? <Loading /> : null}

      {lastRun && <RunSummary run={lastRun} />}

      <Card title="Upload a OneRoster bundle" className="mb-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="OneRoster files" hint="A .zip bundle, or orgs.csv, users.csv, enrollments.csv and academicSessions.csv (roles.csv for 1.2). demographics.csv is read only if you allow it below.">
            {(p) => <input {...p} ref={orRef} type="file" multiple accept=".zip,.csv" onChange={(e) => setOrFiles(e.target.files)} />}
          </Field>
          <OptionsFields value={orOpts} onChange={setOrOpts} idPrefix="or" />
        </div>
        <Button className="mt-4" onClick={() => void uploadOneRoster()} busy={busy === "or"}>{orOpts.dryRun ? "Check the bundle" : "Sync roster"}</Button>
      </Card>

      <Card title="Upload a SIS CSV export" className="mb-6">
        <p className="mb-3 text-xs text-muted-foreground">{settings.data?.presetNotice}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="CSV export">
            {(p) => <input {...p} ref={csvRef} type="file" accept=".csv,text/csv" onChange={(e) => { setCsvFile(e.target.files?.[0] ?? null); setPreview(null); }} />}
          </Field>
          <div className="flex items-end">
            <Button variant="secondary" onClick={() => void previewCsv()} busy={busy === "preview"} disabled={!csvFile}>Read columns</Button>
          </div>
        </div>
        {preview && settings.data && (
          <div className="mt-4 space-y-4">
            <Field label="Export layout">
              {(p) => (
                <select {...p} value={preview.preset} onChange={(e) => void previewCsv(e.target.value)}>
                  {settings.data!.csvPresets.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              )}
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              {settings.data.csvFields.map((f) => (
                <Field key={f.key} label={`${f.label}${f.required ? " (required)" : ""}`} hint={f.hint ?? undefined}>
                  {(p) => (
                    <select {...p} value={preview.mapping[f.key] ?? ""} onChange={(e) => setPreview({ ...preview, mapping: { ...preview.mapping, [f.key]: e.target.value } })}>
                      <option value="">(not in this file)</option>
                      {preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  )}
                </Field>
              ))}
            </div>
            <OptionsFields value={csvOpts} onChange={setCsvOpts} idPrefix="csv" />
            <Button onClick={() => void syncCsv()} busy={busy === "csv"}>{csvOpts.dryRun ? `Check ${preview.rowCount} rows` : `Sync ${preview.rowCount} rows`}</Button>
          </div>
        )}
      </Card>

      <Card title="OneRoster API" className="mb-6">
        <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
          <Field label="Base URL" hint="Up to the version, e.g. https://sis.example.edu/ims/oneroster/rostering/v1p2">
            {(p) => <input {...p} type="url" value={form.baseUrl ?? ""} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} />}
          </Field>
          <Field label="Token URL" hint="OAuth 2.0 client-credentials endpoint">
            {(p) => <input {...p} type="url" value={form.tokenUrl ?? ""} onChange={(e) => setDraft({ ...draft, tokenUrl: e.target.value })} />}
          </Field>
          <Field label="Client id">
            {(p) => <input {...p} value={form.clientId ?? ""} autoComplete="off" onChange={(e) => setDraft({ ...draft, clientId: e.target.value })} />}
          </Field>
          <Field label="Client secret" hint={s?.hasClientSecret ? "A secret is saved (stored encrypted). Leave blank to keep it." : "Stored encrypted; never shown again."}>
            {(p) => <input {...p} type="password" autoComplete="new-password" value={draft.clientSecret ?? ""} onChange={(e) => setDraft({ ...draft, clientSecret: e.target.value })} />}
          </Field>
          <Field label="Scope (optional)">
            {(p) => <input {...p} value={form.scope ?? ""} placeholder="roster-core.readonly" onChange={(e) => setDraft({ ...draft, scope: e.target.value })} />}
          </Field>
          <Field label="Only this school org (sourcedId, optional)" hint="Also filters uploaded bundles.">
            {(p) => <input {...p} value={form.orgSourcedId ?? ""} onChange={(e) => setDraft({ ...draft, orgSourcedId: e.target.value })} />}
          </Field>
          <fieldset className="space-y-2 text-sm md:col-span-2">
            <legend className="mb-1 font-medium">Options</legend>
            <label className="flex items-start gap-2" htmlFor="sis-demo">
              <input id="sis-demo" type="checkbox" checked={!!form.importDemographics} onChange={(e) => setDraft({ ...draft, importDemographics: e.target.checked })} />
              <span>Import demographics (sex and race/ethnicity flags only; birth date and birthplace are never stored). Turning this off deletes stored demographics.</span>
            </label>
            <label className="flex items-start gap-2" htmlFor="sis-nightly">
              <input id="sis-nightly" type="checkbox" checked={!!form.nightlyEnabled} onChange={(e) => setDraft({ ...draft, nightlyEnabled: e.target.checked })} />
              <span>Pull the roster from the API every night (also needs the nightly schedule switched on for this server)</span>
            </label>
            <label className="flex items-start gap-2" htmlFor="sis-nightly-deact">
              <input id="sis-nightly-deact" type="checkbox" disabled={!form.nightlyEnabled} checked={!!form.nightlyDeactivateMissing} onChange={(e) => setDraft({ ...draft, nightlyDeactivateMissing: e.target.checked })} />
              <span>Nightly pulls suspend students missing from the SIS</span>
            </label>
          </fieldset>
          <div className="md:col-span-2">
            <Button type="submit" busy={busy === "save"}>Save API settings</Button>
          </div>
        </form>
        <div className="mt-6 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
          <OptionsFields value={restOpts} onChange={setRestOpts} idPrefix="rest" />
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Last sync: {formatDate(s?.lastSyncAt, true)}{s?.lastStatus ? ` (${s.lastStatus})` : ""}
            </p>
            <Button onClick={() => void syncNow()} busy={busy === "rest"} disabled={!s?.baseUrl || !s?.hasClientSecret}>Sync now</Button>
          </div>
        </div>
      </Card>

      <Card title="Sync history">
        {runs.loading && !runs.data ? (
          <Loading />
        ) : !runs.data || runs.data.length === 0 ? (
          <EmptyState title="No syncs yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Roster syncs</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-3">When</th>
                  <th scope="col" className="py-2 pr-3">Source</th>
                  <th scope="col" className="py-2 pr-3">Mode</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2">Changes</th>
                </tr>
              </thead>
              <tbody>
                {runs.data.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3">{formatDate(r.startedAt, true)}<div className="text-xs text-muted-foreground">{r.trigger}</div></td>
                    <td className="py-2 pr-3">{KIND_LABELS[r.kind] ?? r.kind}</td>
                    <td className="py-2 pr-3 text-xs">{r.dryRun ? "Dry run" : r.fullSync ? (r.deactivateMissing ? "Full, suspend missing" : "Full") : "Changes only"}</td>
                    <td className="py-2 pr-3"><Badge tone={r.status === "Succeeded" ? "good" : r.status === "Failed" ? "bad" : "warn"}>{r.status}</Badge></td>
                    <td className="py-2 text-xs">
                      {r.status === "Failed" ? r.message : `${r.counts.created ?? 0} added, ${r.counts.updated ?? 0} updated, ${r.counts.reactivated ?? 0} reactivated, ${r.counts.deactivated ?? 0} suspended, ${r.counts.skipped ?? 0} skipped`}
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

function RunSummary({ run }: { run: Run }) {
  const c = run.counts;
  return (
    <Card title={`Latest result: ${KIND_LABELS[run.kind] ?? run.kind}${run.dryRun ? " (dry run)" : ""}`} className="mb-6">
      <div role="status" aria-live="polite">
        {run.status === "Failed" ? (
          <p className="text-sm">{run.message}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            {[
              ["Students in the feed", c.inFeed],
              ["Added", c.created],
              ["Updated", c.updated],
              ["Unchanged", c.unchanged],
              ["Missing from the feed", c.missing],
              ["Suspended", c.deactivated],
              ["Reactivated", c.reactivated],
              ["Skipped rows", c.skipped],
            ].map(([label, n]) => (
              <div key={label as string} className="rounded-md border border-border p-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold">{(n as number) ?? 0}</dd>
              </div>
            ))}
          </dl>
        )}
        {run.issues.length > 0 && (
          <ul className="mt-3 max-h-60 list-disc space-y-1 overflow-auto pl-5 text-sm">
            {run.issues.map((i, n) => (
              <li key={n}>{i.line ? `Line ${i.line}: ` : ""}{i.message}</li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
