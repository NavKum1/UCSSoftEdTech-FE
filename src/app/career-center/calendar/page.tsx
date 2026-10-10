"use client";

import React, { useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, ErrorBanner, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";

interface Connection {
  id: string;
  provider: "Microsoft" | "Google";
  accountEmail?: string | null;
  status: string;
  lastError?: string | null;
  connectedAt: string;
  lastRefreshAt?: string | null;
  lastBusyReadAt?: string | null;
  lastEventSyncAt?: string | null;
}

interface Status {
  providers: { provider: "Microsoft" | "Google"; available: boolean }[];
  connection: Connection | null;
  eventsInCalendar: number;
  school: { readBusyEnabled: boolean; writeEventsEnabled: boolean; includeStudentNames: boolean };
  isAdmin: boolean;
}

const PROVIDER_LABELS = { Microsoft: "Microsoft 365 / Outlook", Google: "Google Calendar" } as const;

export default function CalendarPage() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const status = useLoad(() => api<Status>("/api/career/calendar/status"), [api, schoolId]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const handled = useRef(false);

  // Back from the provider: finish connecting with the code and state in the URL
  useEffect(() => {
    if (handled.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const providerError = params.get("error_description") ?? params.get("error");
    if (!code && !providerError) return;
    handled.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    if (providerError) {
      Promise.resolve().then(() => setErr(`The calendar wasn't connected: ${providerError}`));
      return;
    }
    Promise.resolve()
      .then(() => setCompleting(true))
      .then(() => api<Connection>("/api/career/calendar/callback", { method: "POST", json: { code, state } }))
      .then((c) => {
        setMsg(`${PROVIDER_LABELS[c.provider]} connected${c.accountEmail ? ` (${c.accountEmail})` : ""}.`);
        status.reload();
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setCompleting(false));
    // status.reload is stable enough for a one-time callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

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

  const connect = (provider: "Microsoft" | "Google") =>
    run(`connect-${provider}`, async () => {
      const r = await api<{ authorizeUrl: string }>("/api/career/calendar/connect", { method: "POST", json: { provider, origin: window.location.origin } });
      window.location.assign(r.authorizeUrl);
    });

  const disconnect = () => {
    if (!window.confirm("Disconnect your calendar? Busy time stops blocking your appointment slots. Events already added stay in your calendar.")) return;
    void run("disconnect", async () => {
      await api("/api/career/calendar/connection", { method: "DELETE" });
      setMsg("Calendar disconnected.");
      status.reload();
    });
  };

  const syncNow = () =>
    run("sync", async () => {
      const r = await api<{ created: number; updated: number; deleted: number; failed: number }>("/api/career/calendar/sync-now", { method: "POST" });
      setMsg(`Calendar updated: ${r.created} added, ${r.updated} changed, ${r.deleted} removed${r.failed ? `, ${r.failed} failed` : ""}.`);
      status.reload();
    });

  const checkBusy = () =>
    run("busy", async () => {
      const r = await api<{ busy: { startUtc: string; endUtc: string }[] }>("/api/career/calendar/busy");
      setMsg(`Connection works: ${r.busy.length} busy ${r.busy.length === 1 ? "period" : "periods"} found in the next 7 days.`);
      status.reload();
    });

  const saveSchool = (change: Partial<Status["school"]>) =>
    run("school", async () => {
      await api("/api/career/calendar/settings", { method: "PUT", json: change });
      setMsg("Calendar settings saved.");
      status.reload();
    });

  const s = status.data;
  const c = s?.connection;

  return (
    <div>
      <PageHeader
        title="Calendar sync"
        description="Connect your work calendar so busy time blocks your appointment slots and booked appointments appear in your calendar. Subscription (ICS) feeds are under Appointments."
      />
      <ErrorBanner error={err ?? status.error} />
      <SuccessBanner message={msg} />
      {(status.loading && !s) || completing ? <Loading label={completing ? "Finishing the connection…" : undefined} /> : null}

      {s && (
        <Card title="Your calendar" className="mb-6">
          {c ? (
            <div className="space-y-3 text-sm" role="status" aria-live="polite">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{PROVIDER_LABELS[c.provider]}</span>
                {c.accountEmail && <span className="text-muted-foreground">{c.accountEmail}</span>}
                <Badge tone={c.status === "Connected" ? "good" : "bad"}>{c.status === "Connected" ? "Connected" : "Needs reconnecting"}</Badge>
              </p>
              {c.lastError && <p className="text-red-700 dark:text-red-400">{c.lastError}</p>}
              <dl className="grid gap-2 md:grid-cols-2">
                <div><dt className="inline text-muted-foreground">Connected: </dt><dd className="inline">{formatDate(c.connectedAt, true)}</dd></div>
                <div><dt className="inline text-muted-foreground">Busy time last read: </dt><dd className="inline">{formatDate(c.lastBusyReadAt, true)}</dd></div>
                <div><dt className="inline text-muted-foreground">Appointments last written: </dt><dd className="inline">{formatDate(c.lastEventSyncAt, true)}</dd></div>
                <div><dt className="inline text-muted-foreground">Appointments in your calendar: </dt><dd className="inline">{s.eventsInCalendar}</dd></div>
              </dl>
              <div className="flex flex-wrap gap-2">
                {c.status !== "Connected" && (
                  <Button onClick={() => void connect(c.provider)} busy={busy === `connect-${c.provider}`}>Reconnect</Button>
                )}
                <Button variant="secondary" onClick={() => void checkBusy()} busy={busy === "busy"} disabled={c.status !== "Connected"}>Check connection</Button>
                {s.school.writeEventsEnabled && (
                  <Button variant="secondary" onClick={() => void syncNow()} busy={busy === "sync"} disabled={c.status !== "Connected"}>Update calendar now</Button>
                )}
                <Button variant="danger" onClick={disconnect} busy={busy === "disconnect"}>Disconnect</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p>No calendar connected. You&apos;ll be asked to sign in to your calendar provider and allow access to your calendar.</p>
              <div className="flex flex-wrap gap-2">
                {s.providers.map((p) => (
                  <Button key={p.provider} onClick={() => void connect(p.provider)} busy={busy === `connect-${p.provider}`} disabled={!p.available}>
                    Connect {PROVIDER_LABELS[p.provider]}
                  </Button>
                ))}
              </div>
              {s.providers.some((p) => !p.available) && (
                <p className="text-xs text-muted-foreground">Providers that are greyed out haven&apos;t been set up on this server yet.</p>
              )}
            </div>
          )}
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>{s.school.readBusyEnabled ? "Busy time in your calendar hides those times from students booking with you." : "Your career center has turned off reading busy time."}</li>
            <li>
              {s.school.writeEventsEnabled
                ? `Booked appointments are added to your calendar, and moved or removed when they change${s.school.includeStudentNames ? " (titles include the student's name)" : " (titles show the appointment type only)"}. Edit appointments in the career center, not in your calendar.`
                : "Your career center hasn't turned on adding appointments to calendars."}
            </li>
          </ul>
        </Card>
      )}

      {s?.isAdmin && (
        <Card title="School calendar settings">
          <fieldset className="space-y-3 text-sm" disabled={busy === "school"}>
            <legend className="sr-only">Calendar options for all counselors</legend>
            <label className="flex items-start gap-2" htmlFor="cal-read">
              <input id="cal-read" type="checkbox" checked={s.school.readBusyEnabled} onChange={(e) => void saveSchool({ readBusyEnabled: e.target.checked })} />
              <span>Use connected calendars&apos; busy time to block appointment slots</span>
            </label>
            <label className="flex items-start gap-2" htmlFor="cal-write">
              <input id="cal-write" type="checkbox" checked={s.school.writeEventsEnabled} onChange={(e) => void saveSchool({ writeEventsEnabled: e.target.checked })} />
              <span>Add booked appointments to counselors&apos; connected calendars</span>
            </label>
            <label className="flex items-start gap-2" htmlFor="cal-names">
              <input id="cal-names" type="checkbox" disabled={!s.school.writeEventsEnabled} checked={s.school.includeStudentNames} onChange={(e) => void saveSchool({ includeStudentNames: e.target.checked })} />
              <span>
                Include the student&apos;s name in event titles
                <span className="block text-xs text-muted-foreground">Off by default: calendars are often shared with assistants or visible to colleagues.</span>
              </span>
            </label>
          </fieldset>
        </Card>
      )}
    </div>
  );
}
