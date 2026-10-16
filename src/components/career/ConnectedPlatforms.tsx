"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";

// The job and placement platforms a school already uses. Only the school's records of where students went come in;
// job postings and applications stay on the platform (the portal link below opens it).

interface SettingDef {
  key: string;
  label: string;
  secret: boolean;
  hint?: string | null;
}

interface Platform {
  provider: string;
  displayName: string;
  source: string;
  markets: string;
  holds: string;
  fileExport: string;
  apiStatus: string;
  apiWouldNeed: string[];
  implemented: boolean;
  testOnly: boolean;
  notice: string;
  settings: SettingDef[];
  connection: {
    id: string;
    portalUrl?: string | null;
    active: boolean;
    lastPullAt?: string | null;
    lastPullStatus?: string | null;
    settings: Record<string, string>;
    secretsSet: string[];
  } | null;
}

export interface PulledBatch {
  batch: { id: string; fileName: string; rowCount: number; source: string; entityKind: string };
  sample?: string[][];
}

export function ConnectedPlatforms({ onPulled }: { onPulled: (v: PulledBatch) => void }) {
  const t = useCareerT("connectedPlatforms");
  const api = useApi();
  const list = useLoad(() => api<{ note: string; platforms: Platform[] }>("/api/career/imports/connectors"), [api]);
  const [editing, setEditing] = useState<string | null>(null);
  const [portal, setPortal] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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

  const edit = (p: Platform) => {
    setEditing(p.provider);
    setPortal(p.connection?.portalUrl ?? "");
    const v: Record<string, string> = {};
    for (const s of p.settings) if (!s.secret) v[s.key] = p.connection?.settings[s.key] ?? "";
    setValues(v);
  };

  const save = (p: Platform) =>
    run(`save-${p.provider}`, async () => {
      const settings: Record<string, string> = {};
      const secrets: Record<string, string> = {};
      for (const s of p.settings) {
        if (s.secret) {
          if (values[s.key]) secrets[s.key] = values[s.key];
        } else settings[s.key] = values[s.key] ?? "";
      }
      await api(`/api/career/imports/connectors/${p.provider}`, {
        method: "PUT",
        json: { portalUrl: portal, ...(p.settings.length ? { settings } : {}), ...(p.implemented && Object.keys(secrets).length ? { secrets } : {}) },
      });
      setMsg(t("displayNameSaved", { displayName: p.displayName }));
      setEditing(null);
      list.reload();
    });

  const remove = (p: Platform) => {
    if (!window.confirm(t("removeTheDisplayNameConnectionStored", { displayName: p.displayName }))) return;
    void run(`remove-${p.provider}`, async () => {
      await api(`/api/career/imports/connectors/${p.provider}`, { method: "DELETE" });
      setMsg(t("displayNameConnectionRemoved", { displayName: p.displayName }));
      setEditing(null);
      list.reload();
    });
  };

  const pull = (p: Platform) =>
    run(`pull-${p.provider}`, async () => {
      const v = await api<PulledBatch>(`/api/career/imports/connectors/${p.provider}/pull`, { method: "POST" });
      setMsg(t("rowCountRecordsPulledFromDisplayName", { rowCount: v.batch.rowCount, displayName: p.displayName }));
      list.reload();
      onPulled(v);
    });

  return (
    <Card title={t("connectedPlatforms")} className="mb-6">
      <p className="mb-3 text-sm text-muted-foreground">
        {list.data?.note ?? t("jobPostingsAndApplicationsStay")}
      </p>
      <ErrorBanner error={err ?? list.error} />
      <SuccessBanner message={msg} />
      {list.loading && !list.data ? (
        <Loading />
      ) : !list.data || list.data.platforms.length === 0 ? (
        <EmptyState title={t("noPlatformsAvailable")} />
      ) : (
        <ul className="divide-y divide-border">
          {list.data.platforms.map((p) => {
            const headingId = `platform-${p.provider}`;
            return (
              <li key={p.provider} className="py-3" aria-labelledby={headingId}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 id={headingId} className="font-medium">{p.displayName}</h3>
                    <p className="text-xs text-muted-foreground">{p.markets}. {p.holds}</p>
                    <p className="mt-1 text-xs">
                      <Badge tone="good">{t("fileImport")}</Badge>{" "}
                      {p.implemented ? <Badge tone="info">{t("automaticPullAvailable")}</Badge> : <Badge tone="neutral">{t("automaticPullNotBuiltYet")}</Badge>}
                    </p>
                    {p.connection?.portalUrl && (
                      <p className="mt-1 text-sm">
                        <a href={p.connection.portalUrl} target="_blank" rel="noopener noreferrer" className="underline">
                          {t.rich("openDisplayNameOpensInA", { displayName: p.displayName, span: (chunks) => <span className="sr-only">{chunks}</span> })}
                        </a>
                      </p>
                    )}
                    {p.connection?.lastPullAt && (
                      <p className="text-xs text-muted-foreground">{t("lastPullLastPullAtLastPullStatus", { lastPullAt: formatDate(p.connection.lastPullAt, true), lastPullStatus: p.connection.lastPullStatus })}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="secondary" onClick={() => (editing === p.provider ? setEditing(null) : edit(p))} aria-expanded={editing === p.provider} aria-controls={`${headingId}-form`}>
                      {editing === p.provider ? t("close") : p.connection ? t("edit") : t("setUp")}
                      <span className="sr-only"> {p.displayName}</span>
                    </Button>
                    {p.implemented && p.connection && (
                      <Button onClick={() => void pull(p)} busy={busy === `pull-${p.provider}`}>
                        {t.rich("pullRecordsFromDisplayName", { span: (chunks) => <span className="sr-only">{chunks}</span>, displayName: p.displayName })}
                      </Button>
                    )}
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium">{t("whatAnAutomaticConnectionWould")}</summary>
                  <p className="mt-1 text-xs text-muted-foreground">{p.apiStatus} {p.notice}</p>
                  <ul className="mt-1 list-disc ps-5 text-xs text-muted-foreground">
                    {p.apiWouldNeed.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                </details>
                {editing === p.provider && (
                  <form
                    id={`${headingId}-form`}
                    className="mt-3 grid gap-3 rounded-md border border-border p-3 md:grid-cols-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(p);
                    }}
                  >
                    <Field label={t("displayNameAddress", { displayName: p.displayName })} hint={t("yourSchoolsHttpsAddressOn")}>
                      {(f) => <input {...f} type="url" inputMode="url" value={portal} onChange={(e) => setPortal(e.target.value)} placeholder={t("https")} />}
                    </Field>
                    {p.settings.map((s) =>
                      s.secret ? (
                        <Field key={s.key} label={s.label} hint={p.connection?.secretsSet.includes(s.key) ? t("savedLeaveEmptyToKeep") : s.hint ?? undefined}>
                          {(f) => <input {...f} type="password" autoComplete="off" value={values[s.key] ?? ""} onChange={(e) => setValues({ ...values, [s.key]: e.target.value })} />}
                        </Field>
                      ) : (
                        <Field key={s.key} label={s.label} hint={s.hint ?? undefined}>
                          {(f) => <textarea {...f} rows={3} value={values[s.key] ?? ""} onChange={(e) => setValues({ ...values, [s.key]: e.target.value })} />}
                        </Field>
                      ),
                    )}
                    <div className="flex flex-wrap gap-2 md:col-span-2">
                      <Button type="submit" busy={busy === `save-${p.provider}`}>{t.rich("saveDisplayName", { span: (chunks) => <span className="sr-only">{chunks}</span>, displayName: p.displayName })}</Button>
                      {p.connection && (
                        <Button type="button" variant="danger" onClick={() => remove(p)} busy={busy === `remove-${p.provider}`}>
                          {t.rich("removeConnectionToDisplayName", { span: (chunks) => <span className="sr-only">{chunks}</span>, displayName: p.displayName })}
                        </Button>
                      )}
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
