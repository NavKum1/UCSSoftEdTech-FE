"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";

interface Connection {
  configured: boolean;
  canEdit: boolean;
  manageUrl?: string | null;
  active?: boolean;
  lastSyncAt?: string | null;
  lastWebhookAt?: string | null;
  apiBaseUrl?: string | null;
  apiKeyHint?: string | null;
  hasWebhookSecret?: boolean;
  webhookUrl?: string | null;
}

interface EventItem {
  id: string;
  name: string;
  status?: string | null;
  type?: string | null;
  isCareerFair: boolean;
  startsAt?: string | null;
  venue?: string | null;
  locationType?: string | null;
  publicUrl?: string | null;
  directoryUrl?: string | null;
  manageUrl?: string | null;
}

interface FairDetail {
  booths: { id: string; companyName: string; website?: string | null; tier?: string | null; boothCell?: string | null; status?: string | null; consentedLeadCount: number }[];
  attendance: { status: string; count: number }[];
}

const STATUS_TONE: Record<string, "good" | "warn" | "neutral" | "info"> = { live: "good", draft: "warn", past: "neutral" };

/** Read-only view of the school's events and career fairs in its event system; management happens there. */
export default function CareerCenterFairsPage() {
  const t = useCareerT("careerCenterFairs");
  const api = useApi();
  const conn = useLoad(() => api<Connection>("/api/career/events/attendspot/connection"), [api]);
  const [fairsOnly, setFairsOnly] = useState(true);
  const [includePast, setIncludePast] = useState(false);
  const events = useLoad(
    () => api<{ configured: boolean; events: EventItem[] }>(`/api/career/events/staff?fairsOnly=${fairsOnly}&includePast=${includePast}`),
    [api, fairsOnly, includePast],
  );
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<FairDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ apiBaseUrl: "", manageUrl: "", apiKey: "", webhookSecret: "" });

  if (conn.loading && !conn.data) return <Loading />;
  if (conn.error) return <ErrorBanner error={conn.error} onRetry={conn.reload} />;
  const c = conn.data!;

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

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run("save", async () => {
      const body: Record<string, string> = {};
      if (form.apiBaseUrl.trim()) body.apiBaseUrl = form.apiBaseUrl.trim();
      if (form.manageUrl.trim()) body.manageUrl = form.manageUrl.trim();
      if (form.apiKey.trim()) body.apiKey = form.apiKey.trim();
      if (form.webhookSecret.trim()) body.webhookSecret = form.webhookSecret.trim();
      const next = await api<Connection>("/api/career/events/attendspot/connection", { method: "PUT", json: body });
      conn.setData(next);
      setForm({ apiBaseUrl: "", manageUrl: "", apiKey: "", webhookSecret: "" });
      setMsg(t("connectionSaved"));
      events.reload();
    });
  };

  const toggleActive = () =>
    run("active", async () => {
      conn.setData(await api<Connection>("/api/career/events/attendspot/connection", { method: "PUT", json: { active: !c.active } }));
      events.reload();
    });

  const sync = () =>
    run("sync", async () => {
      const r = await api<{ fairs: number; booths: number; matchedEmployers: number }>("/api/career/events/staff/sync", { method: "POST" });
      setMsg(t("syncedBoothsBoothsFromFairs", { booths: r.booths, fairs: r.fairs, matchedEmployers: r.matchedEmployers }));
      conn.reload();
    });

  const showFair = (id: string) => {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    setDetail(null);
    run("detail", async () => setDetail(await api<FairDetail>(`/api/career/events/staff/${id}/fair`)));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("careerFairs")}
        description={t("yourSchoolsEventsAndCareer")}
        actions={c.configured && c.active ? <Button variant="secondary" busy={busy === "sync"} onClick={sync}>{t("syncBoothsForReports")}</Button> : undefined}
      />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />

      {c.configured && c.active !== false ? (
        <Card
          title={fairsOnly ? t("careerFairs") : t("allEvents")}
          actions={
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={fairsOnly} onChange={(e) => setFairsOnly(e.target.checked)} />{" "}{t("careerFairsOnly")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={includePast} onChange={(e) => setIncludePast(e.target.checked)} />{" "}{t("includePast")}
              </label>
            </div>
          }
        >
          {events.loading && !events.data ? (
            <Loading />
          ) : events.error ? (
            <ErrorBanner error={events.error} onRetry={events.reload} />
          ) : !events.data?.events.length ? (
            <EmptyState title={t("noEventsFound")}>{t("nothingMatchesTheseFiltersYet")}</EmptyState>
          ) : (
            <ul className="divide-y" aria-live="polite">
              {events.data.events.map((ev) => (
                <li key={ev.id} className="py-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{ev.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(ev.startsAt, true)}
                        {ev.venue ? ` · ${ev.venue}` : ev.locationType === "virtual" ? t("online") : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {ev.isCareerFair && <Badge tone="info">{t("careerFair")}</Badge>}
                      {ev.status && <Badge tone={STATUS_TONE[ev.status] ?? "neutral"}>{String(ev.status ?? "").replace(/([a-z])([A-Z])/g, (_m, a: string, b: string) => `${a} ${b.toLowerCase()}`)}</Badge>}
                      {ev.isCareerFair && (
                        <Button variant="secondary" onClick={() => showFair(ev.id)} aria-expanded={open === ev.id}>
                          {open === ev.id ? t("hideBooths") : t("booths")}
                        </Button>
                      )}
                      {ev.manageUrl && (
                        <a className="text-sm underline" href={ev.manageUrl} target="_blank" rel="noopener noreferrer">
                          {t.rich("manageNameOpensInA", { span: (chunks) => <span className="sr-only">{chunks}</span>, name: ev.name })}
                        </a>
                      )}
                    </div>
                  </div>
                  {open === ev.id && (
                    <div className="rounded border p-3 text-sm">
                      {!detail ? (
                        <Loading label={t("loadingBooths")} />
                      ) : (
                        <>
                          <p className="mb-2">
                            {t("attendance")}{" "}
                            {detail.attendance.length
                              ? detail.attendance.map((a) => `${a.count} ${a.status.replace("_", " ")}`).join(", ")
                              : t("noRegistrationsReceivedYet")}
                          </p>
                          {detail.booths.length === 0 ? (
                            <p>{t("noBoothsYet")}</p>
                          ) : (
                            <table className="w-full text-start [&_th]:text-start">
                              <caption className="sr-only">{t("boothsAtName", { name: ev.name })}</caption>
                              <thead>
                                <tr>
                                  <th scope="col">{t("company")}</th>
                                  <th scope="col">{t("tier")}</th>
                                  <th scope="col">{t("booth")}</th>
                                  <th scope="col">{t("status")}</th>
                                  <th scope="col">{t("leadsShared")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.booths.map((b) => (
                                  <tr key={b.id}>
                                    <td>{b.companyName}</td>
                                    <td>{b.tier ?? "—"}</td>
                                    <td>{b.boothCell ?? "—"}</td>
                                    <td>{b.status ?? "—"}</td>
                                    <td>{b.consentedLeadCount}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <EmptyState title={c.configured ? t("eventSystemConnectionIsTurned") : t("noEventSystemConnected")}>
          {c.canEdit ? t("connectYourEventSystemBelow") : t("askACareerCenterAdmin")}
        </EmptyState>
      )}

      {c.canEdit && (
        <Card title={t("eventSystemConnection")}>
          {c.configured && (
            <dl className="mb-4 grid gap-1 text-sm sm:grid-cols-2">
              <dt className="font-medium">{t("aPIURL")}</dt>
              <dd className="break-all">{c.apiBaseUrl}</dd>
              <dt className="font-medium">{t("aPIKey")}</dt>
              <dd>{c.apiKeyHint}</dd>
              <dt className="font-medium">{t("webhookURLPasteIntoYour")}</dt>
              <dd className="break-all">
                <code>{c.webhookUrl}</code>
              </dd>
              <dt className="font-medium">{t("webhookSigningSecret")}</dt>
              <dd>{c.hasWebhookSecret ? t("set") : t("notSet")}</dd>
              <dt className="font-medium">{t("lastSyncLastWebhook")}</dt>
              <dd>
                {formatDate(c.lastSyncAt, true)} / {formatDate(c.lastWebhookAt, true)}
              </dd>
            </dl>
          )}
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Field label={t("aPIURL")} hint={t("theTenantAPIAddressE")}>
              {(p) => <input {...p} type="url" value={form.apiBaseUrl} placeholder={c.apiBaseUrl ?? ""} onChange={(e) => setForm({ ...form, apiBaseUrl: e.target.value })} />}
            </Field>
            <Field label={t("eventAppURL")} hint={t("usedForManageAndBooth")}>
              {(p) => <input {...p} type="url" value={form.manageUrl} placeholder={c.manageUrl ?? ""} onChange={(e) => setForm({ ...form, manageUrl: e.target.value })} />}
            </Field>
            <Field label={t("aPIKey")} hint={c.configured ? t("leaveEmptyToKeepThe") : t("createOneInYourEvent")}>
              {(p) => <input {...p} type="password" autoComplete="off" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />}
            </Field>
            <Field label={t("webhookSigningSecret")} hint={t("copyFromTheWebhookEndpoint")}>
              {(p) => <input {...p} type="password" autoComplete="off" value={form.webhookSecret} onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })} />}
            </Field>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" busy={busy === "save"}>{t("saveConnection")}</Button>
              {c.configured && (
                <Button type="button" variant="secondary" busy={busy === "active"} onClick={toggleActive}>
                  {c.active ? t("turnOff") : t("turnOn")}
                </Button>
              )}
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
