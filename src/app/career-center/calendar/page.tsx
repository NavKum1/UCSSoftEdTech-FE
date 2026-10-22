"use client";

import React, { useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, ErrorBanner, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";

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
  // H14: generateMeetingLinks gives video appointments and group sessions their own Teams / Google Meet link
  // H15: addStudentsToMeetingInvite adds the student (one-to-one) or every registered student (group session) to the host's event
  school: { readBusyEnabled: boolean; writeEventsEnabled: boolean; includeStudentNames: boolean; generateMeetingLinks?: boolean; addStudentsToMeetingInvite?: boolean };
  isAdmin: boolean;
}

const PROVIDER_LABELS = { Microsoft: "Microsoft 365 / Outlook", Google: "Google Calendar" } as const;

export default function CalendarPage() {
  const t = useCareerT("careerCenterCalendar");
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
      Promise.resolve().then(() => setErr(t("theCalendarWasntConnectedProviderError", { providerError })));
      return;
    }
    Promise.resolve()
      .then(() => setCompleting(true))
      .then(() => api<Connection>("/api/career/calendar/callback", { method: "POST", json: { code, state } }))
      .then((c) => {
        setMsg(t("providerConnectedValue", { provider: PROVIDER_LABELS[c.provider], value: c.accountEmail ? ` (${c.accountEmail})` : "" }));
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
    if (!window.confirm(t("disconnectYourCalendarBusyTime"))) return;
    void run("disconnect", async () => {
      await api("/api/career/calendar/connection", { method: "DELETE" });
      setMsg(t("calendarDisconnected"));
      status.reload();
    });
  };

  const syncNow = () =>
    run("sync", async () => {
      const r = await api<{ created: number; updated: number; deleted: number; failed: number }>("/api/career/calendar/sync-now", { method: "POST" });
      setMsg(t("calendarUpdatedCreatedAddedUpdated", { created: r.created, updated: r.updated, deleted: r.deleted, value: r.failed ? t("failedFailed", { failed: r.failed }) : "" }));
      status.reload();
    });

  const checkBusy = () =>
    run("busy", async () => {
      const r = await api<{ busy: { startUtc: string; endUtc: string }[] }>("/api/career/calendar/busy");
      setMsg(t("connectionWorksCountBusyPeriods", { count: r.busy.length }));
      status.reload();
    });

  const saveSchool = (change: Partial<Status["school"]>) =>
    run("school", async () => {
      await api("/api/career/calendar/settings", { method: "PUT", json: change });
      setMsg(t("calendarSettingsSaved"));
      status.reload();
    });

  const s = status.data;
  const c = s?.connection;

  return (
    <div>
      <PageHeader
        title={t("calendarSync")}
        description={t("connectYourWorkCalendarSo")}
      />
      <ErrorBanner error={err ?? status.error} />
      <SuccessBanner message={msg} />
      {(status.loading && !s) || completing ? <Loading label={completing ? t("finishingTheConnection") : undefined} /> : null}

      {s && (
        <Card title={t("yourCalendar")} className="mb-6">
          {c ? (
            <div className="space-y-3 text-sm" role="status" aria-live="polite">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{PROVIDER_LABELS[c.provider]}</span>
                {c.accountEmail && <span className="text-muted-foreground">{c.accountEmail}</span>}
                <Badge tone={c.status === "Connected" ? "good" : "bad"}>{c.status === "Connected" ? t("connected") : t("needsReconnecting")}</Badge>
              </p>
              {c.lastError && <p className="text-red-700 dark:text-red-400">{c.lastError}</p>}
              <dl className="grid gap-2 md:grid-cols-2">
                <div><dt className="inline text-muted-foreground">{t("connected2")}{" "}</dt><dd className="inline">{formatDate(c.connectedAt, true)}</dd></div>
                <div><dt className="inline text-muted-foreground">{t("busyTimeLastRead")}{" "}</dt><dd className="inline">{formatDate(c.lastBusyReadAt, true)}</dd></div>
                <div><dt className="inline text-muted-foreground">{t("appointmentsLastWritten")}{" "}</dt><dd className="inline">{formatDate(c.lastEventSyncAt, true)}</dd></div>
                <div><dt className="inline text-muted-foreground">{t("appointmentsInYourCalendar")}{" "}</dt><dd className="inline">{s.eventsInCalendar}</dd></div>
              </dl>
              <div className="flex flex-wrap gap-2">
                {c.status !== "Connected" && (
                  <Button onClick={() => void connect(c.provider)} busy={busy === `connect-${c.provider}`}>{t("reconnect")}</Button>
                )}
                <Button variant="secondary" onClick={() => void checkBusy()} busy={busy === "busy"} disabled={c.status !== "Connected"}>{t("checkConnection")}</Button>
                {s.school.writeEventsEnabled && (
                  <Button variant="secondary" onClick={() => void syncNow()} busy={busy === "sync"} disabled={c.status !== "Connected"}>{t("updateCalendarNow")}</Button>
                )}
                <Button variant="danger" onClick={disconnect} busy={busy === "disconnect"}>{t("disconnect")}</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p>{t("noCalendarConnectedYoullBe")}</p>
              <div className="flex flex-wrap gap-2">
                {s.providers.map((p) => (
                  <Button key={p.provider} onClick={() => void connect(p.provider)} busy={busy === `connect-${p.provider}`} disabled={!p.available}>
                    {t("connectProvider", { provider: PROVIDER_LABELS[p.provider] })}
                  </Button>
                ))}
              </div>
              {s.providers.some((p) => !p.available) && (
                <p className="text-xs text-muted-foreground">{t("providersThatAreGreyedOut")}</p>
              )}
            </div>
          )}
          <ul className="mt-4 list-disc space-y-1 ps-5 text-xs text-muted-foreground">
            <li>{s.school.readBusyEnabled ? t("busyTimeInYourCalendar") : t("yourCareerCenterHasTurned")}</li>
            <li>
              {s.school.writeEventsEnabled
                ? t("bookedAppointmentsAreAddedTo", { value: s.school.includeStudentNames ? t("titlesIncludeTheStudentsName") : t("titlesShowTheAppointmentType") })
                : t("yourCareerCenterHasntTurned")}
            </li>
            {s.school.writeEventsEnabled && s.school.generateMeetingLinks && (
              <li>{t("meetingLinksForVideo", { provider: s.connection?.provider === "Google" ? "Google Meet" : "Microsoft Teams" })}</li>
            )}
            {s.school.writeEventsEnabled && s.school.addStudentsToMeetingInvite && <li>{t("studentsAreAddedToInvites")}</li>}
          </ul>
        </Card>
      )}

      {s?.isAdmin && (
        <Card title={t("schoolCalendarSettings")}>
          <fieldset className="space-y-3 text-sm" disabled={busy === "school"}>
            <legend className="sr-only">{t("calendarOptionsForAllCounselors")}</legend>
            <label className="flex items-start gap-2" htmlFor="cal-read">
              <input id="cal-read" type="checkbox" checked={s.school.readBusyEnabled} onChange={(e) => void saveSchool({ readBusyEnabled: e.target.checked })} />
              <span>{t("useConnectedCalendarsBusyTime")}</span>
            </label>
            <label className="flex items-start gap-2" htmlFor="cal-write">
              <input id="cal-write" type="checkbox" checked={s.school.writeEventsEnabled} onChange={(e) => void saveSchool({ writeEventsEnabled: e.target.checked })} />
              <span>{t("addBookedAppointmentsToCounselors")}</span>
            </label>
            <label className="flex items-start gap-2" htmlFor="cal-names">
              <input id="cal-names" type="checkbox" disabled={!s.school.writeEventsEnabled} checked={s.school.includeStudentNames} onChange={(e) => void saveSchool({ includeStudentNames: e.target.checked })} />
              <span>
                {t.rich("includeTheStudentsNameIn", { span: (chunks) => <span className="block text-xs text-muted-foreground">{chunks}</span> })}
              </span>
            </label>
            <label className="flex items-start gap-2" htmlFor="cal-meetings">
              <input id="cal-meetings" type="checkbox" disabled={!s.school.writeEventsEnabled} checked={!!s.school.generateMeetingLinks} onChange={(e) => void saveSchool({ generateMeetingLinks: e.target.checked })} />
              <span>
                {t.rich("generateMeetingLinks", { span: (chunks) => <span className="block text-xs text-muted-foreground">{chunks}</span> })}
              </span>
            </label>
            <label className="flex items-start gap-2" htmlFor="cal-invites">
              <input
                id="cal-invites"
                type="checkbox"
                disabled={!s.school.writeEventsEnabled}
                checked={s.school.addStudentsToMeetingInvite !== false}
                onChange={(e) => void saveSchool({ addStudentsToMeetingInvite: e.target.checked })}
              />
              <span>
                {t.rich("addStudentsToMeetingInvite", { span: (chunks) => <span className="block text-xs text-muted-foreground">{chunks}</span> })}
              </span>
            </label>
          </fieldset>
        </Card>
      )}
    </div>
  );
}
