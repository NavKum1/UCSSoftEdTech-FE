"use client";

/** H14: students and alumni browse group sessions they can join, register or join the waitlist, cancel, and see their own. */

import React, { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, EmptyState, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useCareerFormat, useCareerT, useLoad } from "@/components/career/ui";
import { MeetingInfo, useDownload, useModeLabels, whenText } from "./shared";
import { type GroupSession, EligibilitySummary, Prose, RegistrationBadge, SeatsBadge, SeriesNote, hostNames, useGroupKindLabels } from "./groupShared";

interface ListResponse {
  timeZone: string;
  sessions: GroupSession[];
}

interface MineResponse {
  timeZone: string;
  upcoming: GroupSession[];
  past: GroupSession[];
}

interface Detail {
  session: GroupSession;
  sessionNotes: { id: string; body: string; createdAt: string }[];
  notes: { id: string; body: string; createdAt: string }[];
  tasks: { id: string; title: string; details?: string | null; dueDate?: string | null; status: string; assigneeType: string }[];
}

export function StudentGroupSessions() {
  const t = useCareerT("groupSessions");
  const api = useApi();
  const { schoolId } = useCareerShell();
  const mine = useLoad(() => api<MineResponse>("/api/career/appointments/student/group-sessions/registrations"), [api, schoolId]);
  const list = useLoad(() => api<ListResponse>("/api/career/appointments/student/group-sessions"), [api, schoolId]);
  const [message, setMessage] = useState<string | null>(null);
  const changed = (text: string) => {
    setMessage(text);
    mine.reload();
    list.reload();
  };
  const browse = (list.data?.sessions ?? []).filter((s) => !s.myRegistration || s.myRegistration.status === "Cancelled");

  return (
    <div className="space-y-6">
      <SuccessBanner message={message} />
      <section aria-labelledby="group-mine-h">
        <h2 id="group-mine-h" className="mb-3 text-lg font-semibold">
          {t("mySessions")}
        </h2>
        <ErrorBanner error={mine.error} onRetry={mine.reload} />
        {mine.loading && !mine.data ? (
          <Loading />
        ) : !mine.data?.upcoming.length ? (
          <p className="text-sm text-muted-foreground">{t("noUpcomingRegistrations")}</p>
        ) : (
          <ul className="space-y-3">
            {mine.data.upcoming.map((s) => (
              <li key={s.id}>
                <MySessionCard s={s} onChanged={changed} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="group-browse-h">
        <h2 id="group-browse-h" className="mb-1 text-lg font-semibold">
          {t("upcomingSessions")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("upcomingSessionsHelp")}</p>
        <ErrorBanner error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? (
          <Loading />
        ) : browse.length === 0 ? (
          <EmptyState title={t("noSessionsOpen")}>{t("noSessionsOpenHint")}</EmptyState>
        ) : (
          <ul className="space-y-3">
            {browse.map((s) => (
              <li key={s.id}>
                <BrowseCard s={s} onChanged={changed} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {!!mine.data?.past.length && (
        <section aria-labelledby="group-past-h">
          <h2 id="group-past-h" className="mb-3 text-lg font-semibold">
            {t("pastAndCancelled")}
          </h2>
          <ul className="space-y-3">
            {mine.data.past.map((s) => (
              <li key={s.id}>
                <MySessionCard s={s} onChanged={changed} past />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SessionHeader({ s }: { s: GroupSession }) {
  const t = useCareerT("groupSessions");
  const fmt = useCareerFormat();
  const MODE_LABELS = useModeLabels();
  const KINDS = useGroupKindLabels();
  return (
    <div>
      <h3 className="font-semibold">{s.title}</h3>
      <p className="text-sm">{whenText(s, s.timeZone)}</p>
      <p className="text-sm text-muted-foreground">
        {t("kindWithHosts", { kind: KINDS[s.kind] ?? s.kind, hosts: hostNames(s, fmt.locale) })} · {MODE_LABELS[s.mode] ?? s.mode}
        {s.mode === "InPerson" && s.location ? ` · ${s.location}` : ""}
      </p>
      <SeriesNote s={s} />
    </div>
  );
}

function BrowseCard({ s, onChanged }: { s: GroupSession; onChanged: (message: string) => void }) {
  const t = useCareerT("groupSessions");
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The moment the card was shown: "opens later" vs "closed" doesn't flip while the student reads it
  const [now] = useState(() => Date.now());
  const opensLater = Date.parse(s.registrationOpensUtc) > now;
  const full = s.seatsLeft === 0;

  const register = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ status: string; waitlistPosition?: number | null }>(`/api/career/appointments/student/group-sessions/${s.id}/register`, { method: "POST" });
      onChanged(r.status === "Registered" ? t("registeredFor", { title: s.title }) : t("waitlistedFor", { title: s.title, position: r.waitlistPosition ?? 0 }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-xl border border-border bg-card p-4" aria-label={`${s.title}, ${whenText(s, s.timeZone)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <SessionHeader s={s} />
        <SeatsBadge s={s} />
      </div>
      {s.description && (
        <div className="mt-2">
          <Prose>{s.description}</Prose>
        </div>
      )}
      <div className="mt-2">
        <EligibilitySummary e={s.eligibility} />
      </div>
      <ErrorBanner error={error} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {s.registrationOpen ? (
          <Button type="button" busy={busy} onClick={() => void register()}>
            {full ? t("joinWaitlist") : t("register")}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            {opensLater ? t("registrationOpensOn", { date: formatDate(s.registrationOpensUtc, true) }) : t("registrationClosed")}
          </p>
        )}
        {s.registrationOpen && (
          <span className="text-xs text-muted-foreground">
            {t("registrationClosesAt", { date: formatDate(s.registrationClosesUtc, true) })} {t("cancelUntil", { date: formatDate(s.cancelCutoffUtc, true) })}
          </span>
        )}
      </div>
    </article>
  );
}

function MySessionCard({ s, onChanged, past }: { s: GroupSession; onChanged: (message: string) => void; past?: boolean }) {
  const t = useCareerT("groupSessions");
  const api = useApi();
  const download = useDownload();
  const reg = s.myRegistration!;
  const [panel, setPanel] = useState<"none" | "cancel" | "details">("none");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    if (panel !== "details" || detail) return;
    api<Detail>(`/api/career/appointments/student/group-sessions/${s.id}`)
      .then(setDetail)
      .catch((e: Error) => setError(e.message));
  }, [api, panel, detail, s.id]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (p: typeof panel) => setPanel((cur) => (cur === p ? "none" : p));
  const waitlisted = reg.status === "Waitlisted";
  const cancelled = s.status === "Cancelled" || reg.status === "Cancelled";

  return (
    <article className="rounded-xl border border-border bg-card p-4" aria-label={`${s.title}, ${whenText(s, s.timeZone)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <SessionHeader s={s} />
        {s.status === "Cancelled" ? <Badge tone="warn">{t("sessionCancelled")}</Badge> : <RegistrationBadge r={reg} />}
      </div>
      {!past && reg.status === "Registered" && s.status !== "Cancelled" && (
        <div className="mt-1">
          <MeetingInfo a={s} />
        </div>
      )}
      {waitlisted && <p className="mt-1 text-sm text-muted-foreground">{t("waitlistHelp")}</p>}
      {s.status === "Cancelled" && s.cancelReason && <p className="mt-1 text-xs text-muted-foreground">{t("cancelReason", { reason: s.cancelReason })}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!waitlisted && reg.status !== "Cancelled" && !cancelled && (
          <Button type="button" variant="secondary" onClick={() => run(() => download(`/api/career/appointments/student/group-sessions/registrations/${reg.id}/ics`, "session.ics"))}>
            <CalendarPlus className="h-4 w-4" aria-hidden />{" "}{t("addToCalendar")}
          </Button>
        )}
        {!past && reg.canCancel && (
          <Button type="button" variant="secondary" aria-expanded={panel === "cancel"} onClick={() => toggle("cancel")}>
            {waitlisted ? t("leaveWaitlist") : t("cancelRegistration")}
          </Button>
        )}
        <Button type="button" variant="ghost" aria-expanded={panel === "details"} onClick={() => toggle("details")}>
          {t("notesTasks")}
        </Button>
      </div>
      {!past && !reg.canCancel && reg.status === "Registered" && s.status === "Scheduled" && <p className="mt-2 text-xs text-muted-foreground">{t("tooCloseToCancel")}</p>}
      <ErrorBanner error={error} />

      {panel === "cancel" && (
        <form
          className="mt-3 space-y-3 rounded-lg border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api(`/api/career/appointments/student/group-sessions/registrations/${reg.id}/cancel`, { method: "POST", json: { reason } });
              onChanged(waitlisted ? t("leftWaitlist", { title: s.title }) : t("cancelledFor", { title: s.title }));
            });
          }}
        >
          <Field label={t("reasonOptional")} hint={t("reasonHint")}>
            {(p) => <textarea {...p} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
          <Button type="submit" variant="danger" busy={busy}>
            {waitlisted ? t("leaveWaitlist") : t("cancelRegistration")}
          </Button>
        </form>
      )}

      {panel === "details" && (
        <div className="mt-3 space-y-3 rounded-lg border border-border p-3">
          {!detail ? (
            <Loading />
          ) : (
            <>
              <div>
                <h4 className="text-sm font-semibold">{t("notesFromHosts")}</h4>
                {detail.sessionNotes.length + detail.notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noNotesYet")}</p>
                ) : (
                  <ul className="mt-1 space-y-2">
                    {[...detail.sessionNotes, ...detail.notes].map((n) => (
                      <li key={n.id} className="whitespace-pre-wrap rounded-md bg-muted p-2 text-sm">
                        {n.body}
                        <span className="mt-1 block text-xs text-muted-foreground">{formatDate(n.createdAt, true)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold">{t("followUpTasks")}</h4>
                {detail.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noTasks")}</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {detail.tasks.map((x) => (
                      <li key={x.id}>
                        {x.title} {x.dueDate && <span className="text-muted-foreground">{t("due", { date: formatDate(x.dueDate) })}</span>}{" "}
                        <Badge tone={x.status === "Done" ? "good" : "neutral"}>{x.status === "Done" ? t("done") : x.assigneeType === "Student" ? t("toDoYou") : t("counselor")}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}
