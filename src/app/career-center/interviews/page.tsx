"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad } from "@/components/career/ui";
import { TabPanel, Tabs, inZone, todayIn } from "@/components/career/appointments/shared";
import { type OcrSchedule, SIGNUP_LABELS, StatusBadge, WORK_AUTH_LABELS, daysText, eligibilityText, openHtml } from "@/components/career/interviews/shared";

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

export default function CareerCenterInterviewsPage() {
  const [tab, setTab] = useState<Tab>("requests");
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <PageHeader
        title="On-campus interviews"
        description="Review employer interview requests, assign rooms, publish schedules and run interview days."
        actions={<Link className="text-sm underline" href="/career-center/interviews/reports">Reports</Link>}
      />
      <SuccessBanner message={message} />
      <Tabs<Tab>
        label="Interview sections"
        value={tab}
        onChange={(t) => {
          setTab(t);
          setMessage(null);
        }}
        tabs={[
          { key: "requests", label: "Schedules" },
          { key: "rooms", label: "Rooms" },
          { key: "day", label: "Interview day" },
          { key: "noshows", label: "No-shows" },
          { key: "settings", label: "Settings" },
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
  const api = useApi();
  const { schoolId } = useCareerShell();
  const [status, setStatus] = useState("");
  const list = useLoad(() => api<OcrSchedule[]>(`/api/career/ocr/staff/schedules${status ? `?status=${status}` : ""}`), [api, schoolId, status]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div className="max-w-xs">
        <Field label="Show">
          {(p) => (
            <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All schedules</option>
              {["Requested", "Approved", "Published", "Declined", "Withdrawn", "Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </Field>
      </div>
      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorBanner error={list.error} onRetry={list.reload} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState title="No interview schedules">Employer requests appear here.</EmptyState>
      ) : (
        (list.data ?? []).map((s) => (
          <Card key={s.id} title={`${s.employerName}: ${s.positionTitle}`} actions={<StatusBadge status={s.status} />}>
            <p className="text-sm">{daysText(s.days)} · {s.virtual ? "Virtual" : `${s.tracks} room(s) per day`} · {s.slotMinutes} min slots</p>
            <p className="text-sm text-muted-foreground">
              {SIGNUP_LABELS[s.signupType]} · {eligibilityText(s)} · Work authorization: {WORK_AUTH_LABELS[s.workAuthRequirement]}
            </p>
            {s.extra && (
              <p className="text-sm text-muted-foreground">
                Rooms {s.extra.roomsAssigned}/{s.extra.roomsNeeded} · Booked {s.extra.booked}/{s.extra.slots}
              </p>
            )}
            <Button className="mt-2" variant="secondary" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
              {open === s.id ? "Close" : "Manage"}
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
      setErr((e as Error).message);
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
        <div><dt className="inline font-medium">Job: </dt><dd className="inline">{s.externalJobUrl ? <a className="underline" href={s.externalJobUrl} target="_blank" rel="noreferrer">{s.externalJobId || s.externalJobUrl}</a> : s.externalJobId ?? "—"}</dd></div>
        <div><dt className="inline font-medium">Interviewers: </dt><dd className="inline">{s.interviewers.map((i) => i.name).join(", ")}</dd></div>
        {s.description && <div className="sm:col-span-2"><dt className="inline font-medium">Notes: </dt><dd className="inline">{s.description}</dd></div>}
      </dl>

      {s.status === "Requested" && (
        <section className="space-y-2" aria-label="Decision">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Note to the employer (optional)">{(p) => <input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
            <Field label="Student cancellation cutoff (hours)" hint={`Default ${s.cancelCutoffHours}`}>
              {(p) => <input {...p} type="number" min={0} max={336} value={cutoff} onChange={(e) => setCutoff(e.target.value === "" ? "" : Number(e.target.value))} />}
            </Field>
          </div>
          <div className="flex gap-2">
            <Button busy={busy === "a"} onClick={() => run("a", () => api(`/api/career/ocr/staff/schedules/${id}/decision`, { json: { status: "Approved", note, cancelCutoffHours: cutoff === "" ? null : cutoff } }), "Approved.")}>Approve</Button>
            <Button variant="secondary" busy={busy === "d"} onClick={() => run("d", () => api(`/api/career/ocr/staff/schedules/${id}/decision`, { json: { status: "Declined", note } }), "Declined.")}>Decline</Button>
          </div>
        </section>
      )}

      {!s.virtual && (s.status === "Approved" || s.status === "Published") && (
        <section aria-label="Room assignments" className="space-y-2">
          <h3 className="font-semibold">Rooms</h3>
          {rooms.loading ? (
            <Loading />
          ) : (rooms.data ?? []).length === 0 ? (
            <p className="text-sm">Add rooms on the Rooms tab first.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {s.days.flatMap((day) =>
                Array.from({ length: s.tracks }, (_, t) => (
                  <Field key={`${day.date}|${t}`} label={`${day.date} · track ${t + 1}`}>
                    {(p) => (
                      <select {...p} value={current(day.date, t)} onChange={(e) => setAssign({ ...assign, [`${day.date}|${t}`]: e.target.value })}>
                        <option value="">Choose a room</option>
                        {(rooms.data ?? []).filter((r) => r.active).map((r) => <option key={r.id} value={r.id}>{r.name}{r.building ? `, ${r.building}` : ""} (seats {r.capacity})</option>)}
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
              }), "Rooms saved.")
            }
          >
            Save rooms
          </Button>
        </section>
      )}

      {s.status === "Approved" && (
        <Button busy={busy === "p"} onClick={() => run("p", () => api(`/api/career/ocr/staff/schedules/${id}/publish`, { method: "POST" }), "Published. Students can sign up now.")}>Publish</Button>
      )}

      {s.extra.slots.length > 0 && (
        <section aria-label="Slots">
          <h3 className="mb-2 font-semibold">Slots</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Interview slots</caption>
              <thead><tr className="text-left"><th scope="col">Time</th><th scope="col">Room</th><th scope="col">Interviewer</th><th scope="col">Student</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {s.extra.slots.map((x) => (
                  <tr key={x.id} className="border-t border-border">
                    <td>{inZone(x.startUtc, tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                    <td>{x.room || (s.virtual ? "Virtual" : "—")}</td>
                    <td>{x.interviewer}</td>
                    <td>{x.booking ? <>{x.booking.student}{x.booking.source === "Promoted" && <> <Badge tone="info">alternate</Badge></>}</> : <span className="text-muted-foreground">Open</span>}</td>
                    <td>
                      {x.booking && (
                        <Button variant="secondary" busy={busy === x.id} onClick={() => window.confirm("Cancel this student's interview? The next alternate is booked automatically.") && run(x.id, () => api(`/api/career/ocr/staff/bookings/${x.booking!.id}/cancel`, { json: { note: "Cancelled by the career center." } }), "Cancelled.")}>
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {s.extra.candidates.some((c) => c.status === "Waitlisted") && (
        <p className="text-sm">Alternates in order: {s.extra.candidates.filter((c) => c.status === "Waitlisted").map((c) => c.name).join(", ")}</p>
      )}

      {!["Declined", "Withdrawn", "Cancelled"].includes(s.status) && (
        <Button variant="secondary" busy={busy === "c"} onClick={() => window.confirm("Cancel the whole schedule? Booked students and the employer are notified.") && run("c", () => api(`/api/career/ocr/staff/schedules/${id}/cancel`, { json: { note } }), "Schedule cancelled.")}>
          Cancel schedule
        </Button>
      )}
    </div>
  );
}

function Rooms({ onMessage }: { onMessage: (m: string) => void }) {
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
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner error={err} />
      <Card title="Add a room">
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            go(() => api("/api/career/ocr/staff/rooms", { json: form }), "Room added.").then(() => setForm({ name: "", building: "", capacity: 4 }));
          }}
        >
          <Field label="Name">{(p) => <input {...p} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
          <Field label="Building">{(p) => <input {...p} value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />}</Field>
          <Field label="Seats">{(p) => <input {...p} type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />}</Field>
          <div className="pt-6"><Button type="submit" busy={busy}>Add room</Button></div>
        </form>
      </Card>
      {rooms.loading ? (
        <Loading />
      ) : (rooms.data ?? []).length === 0 ? (
        <EmptyState title="No rooms yet" />
      ) : (
        <Card title="Rooms">
          <ul className="space-y-2 text-sm">
            {(rooms.data ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <span>
                  <strong>{r.name}</strong>{r.building ? `, ${r.building}` : ""} · seats {r.capacity} {!r.active && <Badge>Inactive</Badge>}
                  {r.blocks.map((b) => (
                    <span key={b.id} className="ml-2">
                      <Badge tone="warn">Unavailable {new Date(b.startUtc).toLocaleString()} – {new Date(b.endUtc).toLocaleString()}{b.note ? `: ${b.note}` : ""}</Badge>{" "}
                      <button type="button" className="underline" onClick={() => go(() => api(`/api/career/ocr/staff/rooms/${r.id}/blocks/${b.id}`, { method: "DELETE" }), "Room available again.")}>remove</button>
                    </span>
                  ))}
                </span>
                <Button variant="secondary" onClick={() => go(() => api(`/api/career/ocr/staff/rooms/${r.id}`, { method: "PUT", json: { ...r, active: !r.active } }), r.active ? "Room deactivated." : "Room activated.")}>
                  {r.active ? "Deactivate" : "Activate"}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Mark a room unavailable">
        <form
          className="grid gap-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            go(() => api(`/api/career/ocr/staff/rooms/${block.roomId}/blocks`, { json: { startUtc: new Date(block.start).toISOString(), endUtc: new Date(block.end).toISOString(), note: block.note } }), "Room blocked.");
          }}
        >
          <Field label="Room">
            {(p) => (
              <select {...p} required value={block.roomId} onChange={(e) => setBlock({ ...block, roomId: e.target.value })}>
                <option value="">Choose</option>
                {(rooms.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="From">{(p) => <input {...p} type="datetime-local" required value={block.start} onChange={(e) => setBlock({ ...block, start: e.target.value })} />}</Field>
          <Field label="To">{(p) => <input {...p} type="datetime-local" required value={block.end} onChange={(e) => setBlock({ ...block, end: e.target.value })} />}</Field>
          <Field label="Reason">{(p) => <input {...p} value={block.note} onChange={(e) => setBlock({ ...block, note: e.target.value })} />}</Field>
          <div className="pt-6"><Button type="submit" busy={busy}>Block</Button></div>
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
      setErr((e as Error).message);
    }
  };

  const print = async () => {
    setErr(null);
    try {
      await openHtml(await api<Response>(`/api/career/ocr/staff/day/print?date=${date}`, { raw: true }));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Date">{(p) => <input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Button variant="secondary" onClick={print}>Printable agendas</Button>
      </div>
      <ErrorBanner error={err} />
      <div aria-live="polite">
        {day.loading ? (
          <Loading />
        ) : day.error ? (
          <ErrorBanner error={day.error} onRetry={day.reload} />
        ) : (day.data?.rooms ?? []).length === 0 ? (
          <EmptyState title="No interviews on this day" />
        ) : (
          day.data!.rooms.map((r) => (
            <Card key={r.room} title={r.room}>
              <ul className="space-y-2 text-sm">
                {r.slots.map((x) => (
                  <li key={x.slotId} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                    <span>
                      <strong>{inZone(x.startUtc, day.data!.timeZone, { hour: "numeric", minute: "2-digit" })}</strong> · {x.employer} ({x.position}){x.interviewer ? ` · ${x.interviewer}` : ""} ·{" "}
                      {x.booking ? `${x.booking.student ?? "Student"} ${x.booking.email ? `<${x.booking.email}>` : ""}` : <span className="text-muted-foreground">open</span>}
                    </span>
                    {x.booking && (
                      <span className="flex items-center gap-2">
                        {x.booking.attendance && <StatusBadge status={x.booking.attendance} />}
                        {!x.booking.checkedInAt && <Button variant="secondary" onClick={() => act(`/api/career/ocr/staff/bookings/${x.booking!.id}/checkin`)}>Check in</Button>}
                        {x.booking.attendance !== "NoShow" && <Button variant="secondary" onClick={() => act(`/api/career/ocr/staff/bookings/${x.booking!.id}/attendance`, { attendance: "NoShow" })}>No-show</Button>}
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
  const api = useApi();
  const { schoolId } = useCareerShell();
  const list = useLoad(() => api<{ noShowLimit: number; students: { studentUserId: string; name?: string; email?: string; noShows: number; blocked: boolean }[] }>("/api/career/ocr/staff/no-shows"), [api, schoolId]);
  const [err, setErr] = useState<string | null>(null);
  if (list.loading) return <Loading />;
  if (list.error) return <ErrorBanner error={list.error} onRetry={list.reload} />;
  return (
    <div className="space-y-3">
      <p className="text-sm">Students with {list.data!.noShowLimit || "∞"} uncleared no-shows can&apos;t sign up for interviews until you clear them{list.data!.noShowLimit ? "" : " (the policy is off)"}.</p>
      <ErrorBanner error={err} />
      {list.data!.students.length === 0 ? (
        <EmptyState title="No uncleared no-shows" />
      ) : (
        <ul className="space-y-2">
          {list.data!.students.map((s) => (
            <li key={s.studentUserId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-sm">
              <span>{s.name} &lt;{s.email}&gt; · {s.noShows} no-show(s) {s.blocked && <Badge tone="bad">Sign-ups paused</Badge>}</span>
              <Button
                variant="secondary"
                onClick={async () => {
                  setErr(null);
                  try {
                    await api(`/api/career/ocr/staff/students/${s.studentUserId}/clear-no-shows`, { method: "POST" });
                    onMessage(`Cleared for ${s.name}.`);
                    list.reload();
                  } catch (e) {
                    setErr((e as Error).message);
                  }
                }}
              >
                Clear
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Settings({ onMessage }: { onMessage: (m: string) => void }) {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const s = useLoad(() => api<{ noShowLimit: number; defaultCancelCutoffHours: number }>("/api/career/ocr/staff/settings"), [api, schoolId]);
  const [v, setV] = useState<{ noShowLimit: number; defaultCancelCutoffHours: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (s.loading) return <Loading />;
  const cur = v ?? s.data!;
  return (
    <Card title="Interview policies">
      <ErrorBanner error={err ?? s.error} />
      <form
        className="grid max-w-xl gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            await api("/api/career/ocr/staff/settings", { method: "PUT", json: cur });
            onMessage("Settings saved.");
          } catch (e2) {
            setErr((e2 as Error).message);
          }
        }}
      >
        <Field label="No-shows before sign-ups pause" hint="0 turns the policy off.">
          {(p) => <input {...p} type="number" min={0} max={10} value={cur.noShowLimit} onChange={(e) => setV({ ...cur, noShowLimit: Number(e.target.value) })} />}
        </Field>
        <Field label="Default cancellation cutoff (hours)">
          {(p) => <input {...p} type="number" min={0} max={336} value={cur.defaultCancelCutoffHours} onChange={(e) => setV({ ...cur, defaultCancelCutoffHours: Number(e.target.value) })} />}
        </Field>
        <div><Button type="submit">Save</Button></div>
      </form>
    </Card>
  );
}
