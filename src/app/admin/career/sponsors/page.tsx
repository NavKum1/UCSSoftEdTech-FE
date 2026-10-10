"use client";

/**
 * Platform operator console for the D3 sponsorship-history dataset: import public DOL OFLC LCA disclosure files (CSV),
 * watch imports, remove a fiscal year, and manage partner API keys (proposal: not active until partner agreement).
 */

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";

interface ImportRow {
  id: string;
  fileName: string;
  sizeBytes: number;
  status: "Queued" | "Running" | "Completed" | "Failed";
  fallbackFiscalYear?: number | null;
  columnsUsed: Record<string, string>;
  rowsRead: number;
  rowsImported: number;
  rowsSkipped: number;
  skipReasons: Record<string, number>;
  fiscalYears: number[];
  error?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

interface Meta {
  lastUpdated: string | null;
  fiscalYears: number[];
  employers: number;
  disclaimer: string;
  source: string;
}

interface ColumnInfo {
  fields: { field: string; required: boolean; aliases: string[] }[];
  note: string;
}

interface PartnerKey {
  id: string;
  partnerName: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt?: string | null;
  useCount: number;
  revokedAt?: string | null;
  active: boolean;
}

const BASE = "/api/career/international/admin";

function statusTone(s: ImportRow["status"]) {
  return s === "Completed" ? "good" : s === "Failed" ? "bad" : "info";
}

export default function AdminSponsorDataPage() {
  const api = useApi();
  const meta = useLoad(() => api<Meta>(`${BASE}/sponsor-meta`), [api]);
  const imports = useLoad(() => api<ImportRow[]>(`${BASE}/sponsor-imports`), [api]);
  const columns = useLoad(() => api<ColumnInfo>(`${BASE}/sponsor-columns`), [api]);
  const keys = useLoad(() => api<{ notice: string; items: PartnerKey[] }>(`${BASE}/partner-keys`), [api]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [fallbackYear, setFallbackYear] = useState("");
  const [mapping, setMapping] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [deleteYear, setDeleteYear] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const reloadImports = imports.reload;
  const reloadMeta = meta.reload;
  const active = imports.data?.some((i) => i.status === "Queued" || i.status === "Running") ?? false;
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => {
      reloadImports();
      reloadMeta();
    }, 3000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const wrap = async (key: string, fn: () => Promise<void>) => {
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

  const upload = (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErr("Choose a CSV file.");
      return;
    }
    if (mapping.trim()) {
      try {
        JSON.parse(mapping);
      } catch {
        setErr('Column mapping must be JSON, for example {"EmployerName": "Company"}.');
        return;
      }
    }
    void wrap("upload", async () => {
      const fd = new FormData();
      fd.append("file", file);
      if (fallbackYear.trim()) fd.append("fallbackFiscalYear", fallbackYear.trim());
      if (mapping.trim()) fd.append("mapping", mapping.trim());
      await api(`${BASE}/sponsor-imports`, { method: "POST", body: fd });
      if (fileRef.current) fileRef.current.value = "";
      setMsg("File uploaded. The import runs in the background; this list refreshes until it finishes.");
      imports.reload();
    });
  };

  const removeYear = (e: React.FormEvent) => {
    e.preventDefault();
    const fy = Number(deleteYear);
    if (!Number.isInteger(fy)) return;
    if (!window.confirm(`Delete all sponsorship data for fiscal year ${fy}? Students will no longer see it.`)) return;
    void wrap("delete", async () => {
      const res = await api<{ casesDeleted: number }>(`${BASE}/sponsor-data/${fy}`, { method: "DELETE" });
      setMsg(`Deleted ${res.casesDeleted.toLocaleString()} cases for FY${fy}.`);
      setDeleteYear("");
      meta.reload();
    });
  };

  const createKey = (e: React.FormEvent) => {
    e.preventDefault();
    void wrap("key", async () => {
      const res = await api<{ apiKey: string }>(`${BASE}/partner-keys`, { json: { partnerName } });
      setNewKey(res.apiKey);
      setPartnerName("");
      keys.reload();
    });
  };

  const revoke = (k: PartnerKey) => {
    if (!window.confirm(`Revoke the key for ${k.partnerName}? Calls with it stop working immediately.`)) return;
    void wrap(k.id, async () => {
      await api(`${BASE}/partner-keys/${k.id}/revoke`, { method: "POST" });
      setMsg("Key revoked.");
      keys.reload();
    });
  };

  const relink = () =>
    wrap("relink", async () => {
      const res = await api<{ changed: number }>(`${BASE}/employer-links/auto`, { method: "POST" });
      setMsg(`Automatic employer matching updated ${res.changed} link${res.changed === 1 ? "" : "s"}.`);
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sponsorship history data"
        description="Public U.S. Department of Labor (OFLC) Labor Condition Application disclosure data, shared by every school. Students and career staff look employers up by name; it is never a job search."
        actions={
          <Link href="/admin/career" className="text-sm underline">
            Back to career suite admin
          </Link>
        }
      />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />

      <Card title="Dataset">
        {meta.loading && !meta.data ? (
          <Loading />
        ) : meta.data ? (
          <>
            <dl className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted-foreground">Employers</dt>
              <dd>{meta.data.employers.toLocaleString()}</dd>
              <dt className="text-muted-foreground">Fiscal years</dt>
              <dd>{meta.data.fiscalYears.length ? meta.data.fiscalYears.join(", ") : "none yet"}</dd>
              <dt className="text-muted-foreground">Last import</dt>
              <dd>{meta.data.lastUpdated ? formatDate(meta.data.lastUpdated, true) : "—"}</dd>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Shown to users with every lookup: {meta.data.disclaimer}</p>
            {meta.data.fiscalYears.length > 0 && (
              <form onSubmit={removeYear} className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
                <div className="w-48">
                  <Field label="Remove a fiscal year">
                    {(p) => (
                      <select {...p} value={deleteYear} onChange={(e) => setDeleteYear(e.target.value)}>
                        <option value="">Choose…</option>
                        {meta.data!.fiscalYears.map((y) => (
                          <option key={y} value={y}>
                            FY{y}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>
                <Button type="submit" variant="danger" disabled={!deleteYear} busy={busy === "delete"}>
                  Delete
                </Button>
                <Button type="button" variant="secondary" busy={busy === "relink"} onClick={() => void relink()}>
                  Re-run employer matching
                </Button>
              </form>
            )}
          </>
        ) : (
          <ErrorBanner error={meta.error} onRetry={meta.reload} />
        )}
      </Card>

      <Card title="Import an LCA disclosure file">
        <p className="mb-3 text-sm text-muted-foreground">
          Download the LCA disclosure file (quarterly or yearly) from the Department of Labor&apos;s OFLC performance data page, save it as CSV, and upload it here.
          Files up to 1 GB are read in batches. Cases are matched by case number, so uploading a later cumulative file for the same year updates it without double counting.
        </p>
        <form onSubmit={upload} className="grid gap-3 sm:grid-cols-2">
          <Field label="CSV file" hint=".csv, .tsv or .txt; Excel files must be saved as CSV first.">
            {(p) => <input {...p} ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" />}
          </Field>
          <Field label="Fallback fiscal year (optional)" hint="Used for rows without a decision or received date.">
            {(p) => <input {...p} type="number" min={2000} max={2100} value={fallbackYear} onChange={(e) => setFallbackYear(e.target.value)} />}
          </Field>
          <div className="sm:col-span-2">
            <Field label="Column mapping (optional JSON)" hint='Only needed when a column has an unusual name, e.g. {"EmployerName": "Company", "CaseStatus": "Outcome"}.'>
              {(p) => <textarea {...p} rows={2} value={mapping} onChange={(e) => setMapping(e.target.value)} className={`${p.className} font-mono`} />}
            </Field>
          </div>
          <div>
            <Button type="submit" busy={busy === "upload"}>
              Upload and import
            </Button>
          </div>
        </form>
        {columns.data && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium">Recognized column names</summary>
            <p className="mt-2 text-xs text-muted-foreground">{columns.data.note}</p>
            <ul className="mt-2 space-y-1">
              {columns.data.fields.map((f) => (
                <li key={f.field}>
                  <span className="font-mono">{f.field}</span>
                  {f.required && <Badge tone="warn">required</Badge>}: <span className="text-muted-foreground">{f.aliases.join(", ")}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <Card title="Imports">
        {imports.loading && !imports.data ? (
          <Loading />
        ) : !imports.data || imports.data.length === 0 ? (
          <EmptyState title="No imports yet" />
        ) : (
          <div className="overflow-x-auto" aria-live="polite">
            <table className="w-full text-sm">
              <caption className="sr-only">Sponsorship data imports</caption>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3">File</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2 pr-3">Rows</th>
                  <th scope="col" className="py-2 pr-3">Fiscal years</th>
                  <th scope="col" className="py-2 pr-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {imports.data.map((i) => (
                  <tr key={i.id} className="border-t border-border align-top">
                    <td className="py-2 pr-3">
                      {i.fileName}
                      <span className="block text-xs text-muted-foreground">
                        {(i.sizeBytes / 1e6).toFixed(1)} MB · {formatDate(i.createdAt, true)}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-xs">
                      {i.rowsRead.toLocaleString()} read
                      <span className="block">{i.rowsSkipped.toLocaleString()} skipped</span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{i.fiscalYears.length ? i.fiscalYears.join(", ") : "—"}</td>
                    <td className="py-2 pr-3 text-xs">
                      {i.error && <p className="text-red-700 dark:text-red-400">{i.error}</p>}
                      {Object.entries(i.skipReasons).map(([reason, n]) => (
                        <span key={reason} className="block">
                          {n.toLocaleString()} skipped: {reason}
                        </span>
                      ))}
                      {Object.keys(i.columnsUsed).length > 0 && (
                        <details>
                          <summary className="cursor-pointer">Columns used</summary>
                          <ul>
                            {Object.entries(i.columnsUsed).map(([f, c]) => (
                              <li key={f}>
                                {f} ← {c}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Partner data API">
        <div role="note" className="mb-4 rounded-md border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Proposal: not active until partner agreement.</p>
          <p className="mt-1">
            A partner could show this sponsorship history inside its own job search by calling <code>GET /api/career/international/partner/sponsors?q=</code> and{" "}
            <code>/partner/sponsors/{"{normalizedKey}"}</code> with an <code>X-Partner-Key</code> header. Issue a key only after the agreement is signed. The API returns public DOL data only, never student data.
          </p>
        </div>
        {newKey && (
          <div role="status" className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <p className="font-semibold">Copy this key now. Only its hash is stored, so it can&apos;t be shown again.</p>
            <code className="mt-2 block break-all font-mono">{newKey}</code>
            <Button variant="secondary" className="mt-2" onClick={() => setNewKey(null)}>
              I&apos;ve stored it
            </Button>
          </div>
        )}
        <form onSubmit={createKey} className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Field label="Partner name">{(p) => <input {...p} value={partnerName} onChange={(e) => setPartnerName(e.target.value)} maxLength={100} required />}</Field>
          </div>
          <Button type="submit" busy={busy === "key"}>
            Create key
          </Button>
        </form>
        <ErrorBanner error={keys.error} onRetry={keys.reload} />
        {keys.data && keys.data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Partner API keys</caption>
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3">Partner</th>
                  <th scope="col" className="py-2 pr-3">Key starts with</th>
                  <th scope="col" className="py-2 pr-3">Used</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {keys.data.items.map((k) => (
                  <tr key={k.id} className="border-t border-border">
                    <td className="py-2 pr-3">{k.partnerName}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{k.keyPrefix}…</td>
                    <td className="py-2 pr-3 text-xs">
                      {k.useCount.toLocaleString()} calls{k.lastUsedAt ? `, last ${formatDate(k.lastUsedAt, true)}` : ""}
                    </td>
                    <td className="py-2 pr-3">{k.active ? <Badge tone="good">Active</Badge> : <Badge tone="neutral">Revoked {formatDate(k.revokedAt)}</Badge>}</td>
                    <td className="py-2 text-right">
                      {k.active && (
                        <Button variant="danger" busy={busy === k.id} onClick={() => revoke(k)}>
                          Revoke
                        </Button>
                      )}
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
