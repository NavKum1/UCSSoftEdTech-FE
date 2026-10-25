"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad, ScrollArea, useCareerT, useCareerFormat } from "@/components/career/ui";
import { TabPanel, Tabs, inZone, todayIn } from "@/components/career/appointments/shared";
import { type OcrSchedule, StatusBadge, openHtml, useSignupLabels, useInterviewWorkAuthLabels, useDaysText, useEligibilityText } from "@/components/career/interviews/shared";

type Tab = "requests" | "rooms" | "day" | "noshows" | "settings";

interface Room {
  id: string;
  name: string;
  building?: string | null;
  capacity: number;
  notes?: string | null;
  active: boolean;
  blocks: { id: string; startUtc: string; endUtc: string; note?: string | null }[];
}

const SCHEDULE_STATUSES = ["Requested", "Approved", "Published", "Declined", "Withdrawn", "Cancelled"];

export default function CareerCenterInterviewsPage() {
  const tr = useCareerT("careerCenterInterviews");
  const [tab, setTab] = useState<Tab>("requests");
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <PageHeader
        title={tr("onCampusInterviews")}
        description={tr("reviewEmployerInterviewRequestsAssign")}
        actions={<Link className="text-sm underline" href="/career-center/interviews/reports">{tr("reports")}</Link>}
      />
      <SuccessBanner message={message} />
      <Tabs<Tab>
        label={tr("interviewSections")}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setMessage(null);
        }}
        tabs={[
          { key: "requests", label: tr("schedules") },
          { key: "rooms", label: tr("rooms") },
          { key: "day", label: tr("interviewDay") },
          { key: "noshows", label: tr("noShows") },
          { key: "settings", label: tr("settings") },
        ]}
      />
      <TabPanel id={tab}>
        {tab === "requests" && <Requests onMessage={setMessage} />}
        {tab === "rooms" && <Rooms onMessage={setMessage} />}
        {tab === "day" && <Day />}
        {tab === "noshows" && <NoShows onMessage={setMessage} />}
        {tab === "settings" && <Settings onMessage={setMessage} />}
      </TabPanel>
    </div>
  );
}

function Requests({ onMessage }: { onMessage: (m: string) => void }) {
  const tr = useCareerT("careerCenterInterviews");
  const eligibilityText = useEligibilityText();
  const daysText = useDaysText();
  const WORK_AUTH_LABELS = useInterviewWorkAuthLabels();
  const SIGNUP_LABELS = useSignupLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const [status, setStatus] = useState("");
  const list = useLoad(() => api<OcrSchedule[]>(`/api/career/ocr/staff/schedules${status ? `?status=${status}` : ""}`), [api, schoolId, status]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div className="max-w-xs">
        <Field label={tr("show")}>
          {(p) => (
            <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{tr("allSchedules")}</option>
              {SCHEDULE_STATUSES.map((s) => <option key={s} value={s}>{tr(`scheduleStatus.${s}`)}</option>)}
            </select>
          )}
        </Field>
      </div>
      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorBanner error={list.error} onRetry={list.reload} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState title={tr("noInterviewSchedules")}>{tr("employerRequestsAppearHere")}</EmptyState>
      ) : (
        (list.data ?? []).map((s) => (
          <Card key={s.id} title={`${s.employerName}: ${s.positionTitle}`} actions={<StatusBadge status={s.status} />}>
            <p className="text-sm">{daysText(s.days)} · {s.virtual ? tr("virtual") : tr("tracksRoomSPerDay", { tracks: s.tracks })}{" "}{tr("slotMinutesMinSlots", { slotMinutes: s.slotMinutes })}</p>
            <p className="text-sm text-muted-foreground">
              {tr("signupTypeSWorkAuthorizationWorkAuthRequ", { signupType: SIGNUP_LABELS[s.signupType], s: eligibilityText(s), workAuthRequirement: WORK_AUTH_LABELS[s.workAuthRequirement] })}
            </p>
            {s.extra && (
              <p className="text-sm text-muted-foreground">
                {tr("rooms")}{" "}{s.extra.roomsAssigned}/{s.extra.roomsNeeded}{" "}{tr("booked")}{" "}{s.extra.booked}/{s.extra.slots}
              </p>
            )}
            <Button className="mt-2" variant="secondary" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
              {open === s.id ? tr("close") : tr("manage")}
            </Button>
            {open === s.id && (
              <Manage
                id={s.id}
                onChanged={(m) => {
                  onMessage(m);
                  list.reload();
                }}
              />
            )}
          </Card>
        ))
      )}
    </div>
  );
}

interface Detail extends OcrSchedule {
  extra: {
    timeZone: string;
    assignments: { date: string; track: number; roomId: string }[];
    slots: { id: string; date: string; track: number; startUtc: string; endUtc: string; room: string; interviewer?: string | null; booking?: { id: string; student: string; source: string; attendance?: string | null } | null }[];
    candidates: { id: string; name: string; email: string; source: string; tier: string; status: string }[];
  };
}

function Manage({ id, onChanged }: { id: string; onChanged: (m: string) => void }) {
  const tr = useCareerT("careerCenterInterviews");
  const api = useApi();
  const d = useLoad(() => api<Detail>(`/api/career/ocr/staff/schedules/${id}`), [api, id]);
  const rooms = useLoad(() => api<Room[]>("/api/career/ocr/staff/rooms"), [api]);
  const [note, setNote] = useState("");
  const [cutoff, setCutoff] = useState<number | "">("");
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      onChanged(msg);
      d.reload();
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (d.loading) return <Loading />;
  if (d.error) return <ErrorBanner error={d.error} />;
  const s = d.data!;
  const current = (date: string, track: number) => assign[`${date}|${track}`] ?? s.extra.assignments.find((a) => a.date === date && a.track === track)?.roomId ?? "";
  const tz = s.extra.timeZone;

  return (
    <div className="mt-4 space-y-4">
      <ErrorBanner error={err} />
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div><dt className="inline font-medium">{tr("job")}{" "}</dt><dd className="inline">{s.externalJobUrl ? <a className="underline" href={s.externalJobUrl} target="_blank" rel="noreferrer">{s.externalJobId || s.externalJobUrl}</a> : s.externalJobId ?? "—"}</dd></div>
        <div><dt className="inline font-medium">{tr("interviewers")}{" "}</dt><dd className="inline">{s.interviewers.map((i) => i.name).join(", ")}</dd></div>
        {s.description && <div className="sm:col-span-2"><dt className="inline font-medium">{tr("notes")}{" "}</dt><dd className="inline">{s.description}</dd></div>}
      </dl>

      {s.status === "Requested" && (
        <section className="space-y-2" aria-label={tr("decision")}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={tr("noteToTheEmployerOptional")}>{(p) => <input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
            <Field label={tr("studentCancellationCutoffHours")} hint={tr("defaultCancelCutoffHours", { cancelCutoffHours: s.cancelCutoffHours })}>
              {(p) => <input {...p} type="number" min={0} max={336} value={cutoff} onChange={(e) => setCutoff(e.target.value === "" ? "" : Number(e.target.value))} />}
            </Field>
          </div>
          <div className="flex gap-2">
            <Button busy={busy === "a"} onClick={() => run("a", () => api(`/api/career/ocr/staff/schedules/${id}/decision`, { json: { status: "Approved", note, cancelCutoffHours: cutoff === "" ? null : cutoff } }), tr("approved"))}>{tr("approve")}</Button>
            <Button variant="secondary" busy={busy === "d"} onClick={() => run("d", () => api(`/api/career/ocr/staff/schedules/${id}/decision`, { json: { status: "Declined", note } }), tr("declined"))}>{tr("decline")}</Button>
          </div>
        </section>
      )}

      {!s.virtual && (s.status === "Approved" || s.status === "Published") && (
        <section aria-label={tr("roomAssignments")} className="space-y-2">
          <h3 className="font-semibold">{tr("rooms")}</h3>
          {rooms.loading ? (
            <Loading />
          ) : (rooms.data ?? []).length === 0 ? (
            <p className="text-sm">{tr("addRoomsOnTheRooms")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {s.days.flatMap((day) =>
                Array.from({ length: s.tracks }, (_, t) => (
                  <Field key={`${day.date}|${t}`} label={tr("dateTrackValue", { date: day.date, value: t + 1 })}>
                    {(p) => (
                      <select {...p} value={current(day.date, t)} onChange={(e) => setAssign({ ...assign, [`${day.date}|${t}`]: e.target.value })}>
                        <option value="">{tr("chooseARoom")}</option>
                        {(rooms.data ?? []).filter((r) => r.active).map((r) => <option key={r.id} value={r.id}>{r.name}{r.building ? `, ${r.building}` : ""}{" "}{tr("seatsCapacity", { capacity: r.capacity })}</option>)}
                      </select>
                    )}
                  </Field>
                )),
              )}
            </div>
          )}
          <Button
            variant="secondary"
            busy={busy === "r"}
            onClick={() =>
              run("r", () => api(`/api/career/ocr/staff/schedules/${id}/rooms`, {
                method: "PUT",
                json: { assignments: s.days.flatMap((day) => Array.from({ length: s.tracks }, (_, t) => ({ date: day.date, track: t, roomId: current(day.date, t) }))).filter((a) => a.roomId) },
              }), tr("roomsSaved"))
            }
          >
            {tr("saveRooms")}
          </Button>
        </section>
      )}

      {s.status === "Approved" && (
        <Button busy={busy === "p"} onClick={() => run("p", () => api(`/api/career/ocr/staff/schedules/${id}/publish`, { method: "POST" }), tr("publishedStudentsCanSignUp"))}>{tr("publish")}</Button>
      )}

      {s.extra.slots.length > 0 && (
        <section aria-label={tr("slots")}>
          <h3 className="mb-2 font-semibold">{tr("slots")}</h3>
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">{tr("interviewSlots")}</caption>
              <thead><tr className="text-start [&_th]:text-start"><th scope="col">{tr("time")}</th><th scope="col">{tr("room")}</th><th scope="col">{tr("interviewer")}</th><th scope="col">{tr("student")}</th><th scope="col"><span className="sr-only">{tr("actions")}</span></th></tr></thead>
              <tbody>
                {s.extra.slots.map((x) => (
                  <tr key={x.id} className="border-t border-border">
                    <td>{inZone(x.startUtc, tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                    <td>{x.room || (s.virtual ? tr("virtual") : "—")}</td>
                    <td>{x.interviewer}</td>
                    <td>{x.booking ? <>{x.booking.student}{x.booking.source === "Promoted" && <> <Badge tone="info">{tr("alternate")}</Badge></>}</> : <span className="text-muted-foreground">{tr("open")}</span>}</td>
                    <td>
                      {x.booking && (
                        <Button variant="secondary" busy={busy === x.id} onClick={() => window.confirm(tr("cancelThisStudentsInterviewThe")) && run(x.id, () => api(`/api/career/ocr/staff/bookings/${x.booking!.id}/cancel`, { json: { note: "Cancelled by the career center." } }), tr("cancelled"))}>
                          {tr("cancel")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </section>
      )}

      {s.extra.candidates.some((c) => c.status === "Waitlisted") && (
        <p className="text-sm">{tr("alternatesInOrderValue", { value: s.extra.candidates.filter((c) => c.status === "Waitlisted").map((c) => c.name).join(", ") })}</p>
      )}

      {!["Declined", "Withdrawn", "Cancelled"].includes(s.status) && (
        <Button variant="secondary" busy={busy === "c"} onClick={() => window.confirm(tr("cancelTheWholeScheduleBooked")) && run("c", () => api(`/api/career/ocr/staff/schedules/${id}/cancel`, { json: { note } }), tr("scheduleCancelled"))}>
          {tr("cancelSchedule")}
        </Button>
      )}
    </div>
  );
}

function Rooms({ onMessage }: { onMessage: (m: string) => void }) {
  const tr = useCareerT("careerCenterInterviews");
  const fmt = useCareerFormat();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const rooms = useLoad(() => api<Room[]>("/api/career/ocr/staff/rooms"), [api, schoolId]);
  const [form, setForm] = useState({ name: "", building: "", capacity: 4 });
  const [block, setBlock] = useState<{ roomId: string; start: string; end: string; note: string }>({ roomId: "", start: "", end: "", note: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async (fn: () => Promise<unknown>, m: string) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onMessage(m);
      rooms.reload();
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner error={err} />
      <Card title={tr("addARoom")}>
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            go(() => api("/api/career/ocr/staff/rooms", { json: form }), tr("roomAdded")).then(() => setForm({ name: "", building: "", capacity: 4 }));
          }}
        >
          <Field label={tr("name")}>{(p) => <input {...p} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
          <Field label={tr("building")}>{(p) => <input {...p} value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />}</Field>
          <Field label={tr("seats")}>{(p) => <input {...p} type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />}</Field>
          <div className="pt-6"><Button type="submit" busy={busy}>{tr("addRoom")}</Button></div>
        </form>
      </Card>
      {rooms.loading ? (
        <Loading />
      ) : (rooms.data ?? []).length === 0 ? (
        <EmptyState title={tr("noRoomsYet")} />
      ) : (
        <Card title={tr("rooms")}>
          <ul className="space-y-2 text-sm">
            {(rooms.data ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <span>
                  <strong>{r.name}</strong>{r.building ? `, ${r.building}` : ""}{" "}{tr("seatsCapacity2", { capacity: r.capacity })}{" "}{!r.active && <Badge>{tr("inactive")}</Badge>}
                  {r.blocks.map((b) => (
                    <span key={b.id} className="ms-2">
                      <Badge tone="warn">{tr("unavailableValueValue2", { value: new Date(b.startUtc).toLocaleString(fmt.locale), value2: new Date(b.endUtc).toLocaleString(fmt.locale) })}{b.note ? `: ${b.note}` : ""}</Badge>{" "}
                      <button type="button" className="underline" onClick={() => go(() => api(`/api/career/ocr/staff/rooms/${r.id}/blocks/${b.id}`, { method: "DELETE" }), tr("roomAvailableAgain"))}>{tr("remove")}</button>
                    </span>
                  ))}
                </span>
                <Button variant="secondary" onClick={() => go(() => api(`/api/career/ocr/staff/rooms/${r.id}`, { method: "PUT", json: { ...r, active: !r.active } }), r.active ? tr("roomDeactivated") : tr("roomActivated"))}>
                  {r.active ? tr("deactivate") : tr("activate")}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title={tr("markARoomUnavailable")}>
        <form
          className="grid gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            go(() => api(`/api/career/ocr/staff/rooms/${block.roomId}/blocks`, { json: { startUtc: new Date(block.start).toISOString(), endUtc: new Date(block.end).toISOString(), note: block.note } }), tr("roomBlocked"));
          }}
        >
          <Field label={tr("room")}>
            {(p) => (
              <select {...p} required value={block.roomId} onChange={(e) => setBlock({ ...block, roomId: e.target.value })}>
                <option value="">{tr("choose")}</option>
                {(rooms.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
          </Field>
          <Field label={tr("from")}>{(p) => <input {...p} type="datetime-local" required value={block.start} onChange={(e) => setBlock({ ...block, start: e.target.value })} />}</Field>
          <Field label={tr("to")}>{(p) => <input {...p} type="datetime-local" required value={block.end} onChange={(e) => setBlock({ ...block, end: e.target.value })} />}</Field>
          <Field label={tr("reason")}>{(p) => <input {...p} value={block.note} onChange={(e) => setBlock({ ...block, note: e.target.value })} />}</Field>
          <div className="pt-6"><Button type="submit" busy={busy}>{tr("block")}</Button></div>
        </form>
      </Card>
    </div>
  );
}

interface DayView {
  date: string;
  timeZone: string;
  rooms: {
    roomId?: string | null;
    room: string;
    slots: { slotId: string; startUtc: string; endUtc: string; employer: string; position: string; interviewer?: string | null; booking?: { id: string; student?: string | null; email?: string | null; checkedInAt?: string | null; attendance?: string | null } | null }[];
  }[];
}

function Day() {
  const tr = useCareerT("careerCenterInterviews");
  const api = useApi();
  const { me, schoolId } = useCareerShell();
  const tz = (me as unknown as { timeZone?: string } | null)?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [date, setDate] = useState(todayIn(tz));
  const day = useLoad(() => api<DayView>(`/api/career/ocr/staff/day?date=${date}`), [api, schoolId, date]);
  const [err, setErr] = useState<string | null>(null);

  const act = async (path: string, body?: unknown) => {
    setErr(null);
    try {
      await api(path, body ? { json: body } : { method: "POST" });
      day.reload();
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    }
  };

  const print = async () => {
    setErr(null);
    try {
      await openHtml(await api<Response>(`/api/career/ocr/staff/day/print?date=${date}`, { raw: true }), (status) => tr("couldntLoadAgenda", { status }));
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tr("date")}>{(p) => <input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Button variant="secondary" onClick={print}>{tr("printableAgendas")}</Button>
      </div>
      <ErrorBanner error={err} />
      <div aria-live="polite">
        {day.loading ? (
          <Loading />
        ) : day.error ? (
          <ErrorBanner error={day.error} onRetry={day.reload} />
        ) : (day.data?.rooms ?? []).length === 0 ? (
          <EmptyState title={tr("noInterviewsOnThisDay")} />
        ) : (
          day.data!.rooms.map((r) => (
            <Card key={r.room} title={r.room}>
              <ul className="space-y-2 text-sm">
                {r.slots.map((x) => (
                  <li key={x.slotId} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                    <span>
                      <strong>{inZone(x.startUtc, day.data!.timeZone, { hour: "numeric", minute: "2-digit" })}</strong> · {x.employer} ({x.position}){x.interviewer ? ` · ${x.interviewer}` : ""} ·{" "}
                      {x.booking ? `${x.booking.student ?? tr("student")} ${x.booking.email ? `<${x.booking.email}>` : ""}` : <span className="text-muted-foreground">{tr("open2")}</span>}
                    </span>
                    {x.booking && (
                      <span className="flex items-center gap-2">
                        {x.booking.attendance && <StatusBadge status={x.booking.attendance} />}
                        {!x.booking.checkedInAt && <Button variant="secondary" onClick={() => act(`/api/career/ocr/staff/bookings/${x.booking!.id}/checkin`)}>{tr("checkIn")}</Button>}
                        {x.booking.attendance !== "NoShow" && <Button variant="secondary" onClick={() => act(`/api/career/ocr/staff/bookings/${x.booking!.id}/attendance`, { attendance: "NoShow" })}>{tr("noShow")}</Button>}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function NoShows({ onMessage }: { onMessage: (m: string) => void }) {
  const tr = useCareerT("careerCenterInterviews");
  const api = useApi();
  const { schoolId } = useCareerShell();
  const list = useLoad(() => api<{ noShowLimit: number; students: { studentUserId: string; name?: string; email?: string; noShows: number; blocked: boolean }[] }>("/api/career/ocr/staff/no-shows"), [api, schoolId]);
  const [err, setErr] = useState<string | null>(null);
  if (list.loading) return <Loading />;
  if (list.error) return <ErrorBanner error={list.error} onRetry={list.reload} />;
  return (
    <div className="space-y-3">
      <p className="text-sm">{tr("studentsWithNoShowLimitUnclearedNo", { noShowLimit: list.data!.noShowLimit || "∞" })}{list.data!.noShowLimit ? "" : tr("thePolicyIsOff")}.</p>
      <ErrorBanner error={err} />
      {list.data!.students.length === 0 ? (
        <EmptyState title={tr("noUnclearedNoShows")} />
      ) : (
        <ul className="space-y-2">
          {list.data!.students.map((s) => (
            <li key={s.studentUserId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-sm">
              <span>{tr("nameEmailNoShowsNoShow", { name: s.name, email: s.email, noShows: s.noShows })}{" "}{s.blocked && <Badge tone="bad">{tr("signUpsPaused")}</Badge>}</span>
              <Button
                variant="secondary"
                onClick={async () => {
                  setErr(null);
                  try {
                    await api(`/api/career/ocr/staff/students/${s.studentUserId}/clear-no-shows`, { method: "POST" });
                    onMessage(tr("clearedForName", { name: String(s.name) }));
                    list.reload();
                  } catch (e) {
                    setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
                  }
                }}
              >
                {tr("clear")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Settings({ onMessage }: { onMessage: (m: string) => void }) {
  const tr = useCareerT("careerCenterInterviews");
  const api = useApi();
  const { schoolId } = useCareerShell();
  const s = useLoad(() => api<{ noShowLimit: number; defaultCancelCutoffHours: number }>("/api/career/ocr/staff/settings"), [api, schoolId]);
  const [v, setV] = useState<{ noShowLimit: number; defaultCancelCutoffHours: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (s.loading) return <Loading />;
  const cur = v ?? s.data!;
  return (
    <Card title={tr("interviewPolicies")}>
      <ErrorBanner error={err ?? s.error} />
      <form
        className="grid max-w-xl gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            await api("/api/career/ocr/staff/settings", { method: "PUT", json: cur });
            onMessage(tr("settingsSaved"));
          } catch (e2) {
            setErr((e2 as Error).message);
          }
        }}
      >
        <Field label={tr("noShowsBeforeSignUps")} hint={tr("n0TurnsThePolicyOff")}>
          {(p) => <input {...p} type="number" min={0} max={10} value={cur.noShowLimit} onChange={(e) => setV({ ...cur, noShowLimit: Number(e.target.value) })} />}
        </Field>
        <Field label={tr("defaultCancellationCutoffHours")}>
          {(p) => <input {...p} type="number" min={0} max={336} value={cur.defaultCancelCutoffHours} onChange={(e) => setV({ ...cur, defaultCancelCutoffHours: Number(e.target.value) })} />}
        </Field>
        <div><Button type="submit">{tr("save")}</Button></div>
      </form>
    </Card>
  );
}
