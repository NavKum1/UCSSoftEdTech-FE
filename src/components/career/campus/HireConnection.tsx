"use client";

/**
 * H2 employer: the company's link to its Hire account (our ATS). The owner pastes the partner key generated in Hire
 * (Settings → Integrations → Edulexa); it is stored encrypted and never shown again. Jobs sync from Hire, consented
 * applications go to Hire, and stage, offer and hire updates come back. Also shows recent sync calls and webhook events.
 */

import React, { useState } from "react";
import { Badge, Button, Card, ErrorBanner, Field, Loading, ScrollArea, SuccessBanner, formatDate, useCareerLabels, useCareerT, useLoad } from "@/components/career/ui";
import { useRunner } from "@/components/career/placements/useRunner";
import { label } from "@/components/career/placements/shared";

const SYNC_KEYS = ["Pending", "Running", "Done", "Failed", "Skipped", "Deferred"];
const SYNC_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = { Pending: "info", Running: "info", Done: "good", Failed: "bad", Skipped: "neutral", Deferred: "warn" };
export function useHireSyncLabels(): Record<string, string> {
  return useCareerLabels("campusHire.syncStatus", SYNC_KEYS);
}

interface HireView {
  hire: {
    platformEnabled: boolean;
    canEdit: boolean;
    connected: boolean;
    connection?: {
      id: string;
      keyHint?: string | null;
      keyEnvironment?: string | null;
      hireTenantName?: string | null;
      hireTenantId: string;
      scopes: string[];
      missingScopes: string[];
      sharesCompensation: boolean;
      webhookRegistered: boolean;
      autoPushApplications: boolean;
      jobsSyncedAt?: string | null;
      reconciledAt?: string | null;
      lastEventAt?: string | null;
      lastError?: string | null;
    } | null;
  };
  syncs: { id: string; kind: string; status: string; errorCode?: string | null; detail?: string | null; updatedAt: string }[];
  events: { id: string; type: string; result: string; detail?: string | null; receivedAt: string }[];
  counts: { pending: number; failed: number; unmatchedEvents: number };
}

const th = "py-2 pe-3 font-medium";
const td = "py-2 pe-3 align-top";

export function HireConnection({ employerId }: { employerId: string }) {
  const t = useCareerT("campusHire");
  const SYNC = useHireSyncLabels();
  const { api, busy, err, msg, setMsg, run } = useRunner();
  const base = `/api/career/campus/employer/${employerId}/hire`;
  const view = useLoad(() => api<HireView>(base), [api, base]);
  const [key, setKey] = useState("");
  const [autoPush, setAutoPush] = useState(true);

  if (view.loading && !view.data) return <Loading />;
  if (!view.data) return <ErrorBanner error={view.error} onRetry={view.reload} />;
  const { hire, syncs, events, counts } = view.data;
  const c = hire.connection;
  const after = (m: string) => {
    setMsg(m);
    view.reload();
  };

  const connect = (e: React.FormEvent) => {
    e.preventDefault();
    void run("connect", async () => {
      const r = await api<{ warning?: string | null }>(base, { method: "PUT", json: { apiKey: key, autoPushApplications: autoPush } });
      setKey("");
      after(r.warning ?? t("connected"));
    });
  };

  return (
    <Card title={t("title")}>
      <p className="mb-3 text-sm text-muted-foreground">{t("intro")}</p>
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      {!hire.platformEnabled ? (
        <p className="text-sm text-muted-foreground">{t("platformOff")}</p>
      ) : !hire.connected || !c ? (
        hire.canEdit ? (
          <form onSubmit={connect} className="space-y-3">
            <Field label={t("key")} hint={t("keyHint")}>
              {(p) => <input {...p} type="password" autoComplete="off" dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} />}
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={autoPush} onChange={(e) => setAutoPush(e.target.checked)} />
              <span>{t("autoPush")}</span>
            </label>
            <Button type="submit" busy={busy === "connect"} disabled={!key.trim()}>
              {t("connect")}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">{t("ownerOnly")}</p>
        )
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="good">{t("statusConnected")}</Badge>
            <span>
              <bdi>{c.hireTenantName ?? c.hireTenantId}</bdi>
            </span>
            <code dir="ltr" className="text-xs">{c.keyHint}</code>
            {c.keyEnvironment === "test" && <Badge tone="warn">{t("sandbox")}</Badge>}
          </div>
          <dl className="grid gap-2 md:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("webhook")}</dt>
              <dd>{c.webhookRegistered ? t("webhookOn") : t("webhookOff")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("compensation")}</dt>
              <dd>{c.sharesCompensation ? t("compensationOn") : t("compensationOff")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("jobsSynced")}</dt>
              <dd>{c.jobsSyncedAt ? formatDate(c.jobsSyncedAt, true) : t("never")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("lastEvent")}</dt>
              <dd>{c.lastEventAt ? formatDate(c.lastEventAt, true) : t("never")}</dd>
            </div>
          </dl>
          {c.missingScopes.length > 0 && <p className="text-amber-800 dark:text-amber-200">{t("missingScopes", { scopes: c.missingScopes.join(", ") })}</p>}
          {c.lastError && <p className="text-red-700 dark:text-red-300">{t("lastError", { error: c.lastError })}</p>}
          {counts.failed > 0 && <p className="text-red-700 dark:text-red-300">{t("failedCount", { count: counts.failed })}</p>}
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={c.autoPushApplications}
              disabled={!hire.canEdit || busy === "auto"}
              onChange={(e) => void run("auto", async () => { await api(`${base}/settings`, { method: "PUT", json: { autoPushApplications: e.target.checked } }); after(t("saved")); })}
            />
            <span>{t("autoPush")}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" busy={busy === "sync"} onClick={() => run("sync", async () => { const r = await api<{ created: number; updated: number }>(`${base}/jobs/sync`, { method: "POST" }); after(t("synced", { created: r.created, updated: r.updated })); })}>
              {t("syncJobs")}
            </Button>
            <Button variant="secondary" busy={busy === "reconcile"} onClick={() => run("reconcile", async () => { const r = await api<{ applied: number }>(`${base}/reconcile`, { method: "POST" }); after(t("reconciled", { count: r.applied })); })}>
              {t("reconcile")}
            </Button>
            <Button variant="secondary" busy={busy === "process"} disabled={counts.pending === 0} onClick={() => run("process", async () => { const r = await api<{ done: number }>(`${base}/process`, { method: "POST" }); after(t("processed", { count: r.done })); })}>
              {t("sendPending", { count: counts.pending })}
            </Button>
            {hire.canEdit && (
              <Button
                variant="danger"
                busy={busy === "disconnect"}
                onClick={() => {
                  if (window.confirm(t("disconnectConfirm"))) void run("disconnect", async () => { await api(base, { method: "DELETE" }); after(t("disconnected")); });
                }}
              >
                {t("disconnect")}
              </Button>
            )}
          </div>
          {syncs.length > 0 && (
            <ScrollArea label={t("syncsTable")}>
              <table className="w-full text-sm">
                <caption className="sr-only">{t("syncsTable")}</caption>
                <thead>
                  <tr className="border-b border-border [&_th]:text-start">
                    <th scope="col" className={th}>{t("colWhen")}</th>
                    <th scope="col" className={th}>{t("colKind")}</th>
                    <th scope="col" className={th}>{t("colStatus")}</th>
                    <th scope="col" className={th}>{t("colDetail")}</th>
                  </tr>
                </thead>
                <tbody>
                  {syncs.slice(0, 20).map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className={td}>{formatDate(s.updatedAt, true)}</td>
                      <td className={td}>{t.has(`kind.${s.kind}`) ? t(`kind.${s.kind}`) : s.kind}</td>
                      <td className={td}>
                        <Badge tone={SYNC_TONE[s.status] ?? "neutral"}>{label(SYNC, s.status)}</Badge>
                      </td>
                      <td className={td}>
                        <span dir="ltr">{[s.errorCode, s.detail].filter(Boolean).join(" · ")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
          {events.length > 0 && (
            <details>
              <summary className="cursor-pointer">{t("eventsTitle", { count: events.length, unmatched: counts.unmatchedEvents })}</summary>
              <ul className="mt-2 space-y-1 ps-5">
                {events.slice(0, 30).map((e) => (
                  <li key={e.id}>
                    <code dir="ltr" className="text-xs">{e.type}</code> · {e.result} {e.detail ? `· ${e.detail}` : ""} · {formatDate(e.receivedAt, true)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
