"use client";

import React, { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import {
  type Appointment,
  type ApptType,
  type Note,
  type Slot,
  type SlotResponse,
  type Task,
  IntakeFields,
  useFetch,
  MODE_LABELS,
  MeetingInfo,
  SlotPicker,
  TabPanel,
  Tabs,
  addDays,
  statusLabel,
  statusTone,
  todayIn,
  useDownload,
  whenText,
} from "@/components/career/appointments/shared";

type Tab = "book" | "mine" | "dropin" | "notes";

export default function StudentAppointmentsPage() {
  const [tab, setTab] = useState<Tab>("mine");
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <PageHeader title="Appointments" description="Book time with a career counselor, join a drop-in queue, and keep track of what you agreed to do next." />
      <SuccessBanner message={message} />
      <Tabs<Tab>
        label="Appointment sections"
        value={tab}
        onChange={(t) => {
          setTab(t);
          setMessage(null);
        }}
        tabs={[
          { key: "mine", label: "My appointments" },
          { key: "book", label: "Book" },
          { key: "dropin", label: "Drop-in" },
          { key: "notes", label: "Notes & tasks" },
        ]}
      />
      <TabPanel id={tab}>
        {tab === "book" && (
          <BookFlow
            onBooked={(a) => {
              setMessage(`Booked: ${a.typeName} with ${a.counselor.name}, ${whenText(a, a.timeZone)}. We've sent you a confirmation.`);
              setTab("mine");
            }}
          />
        )}
        {tab === "mine" && <MyAppointments onBook={() => setTab("book")} />}
        {tab === "dropin" && <DropIn />}
        {tab === "notes" && <NotesAndTasks />}
      </TabPanel>
    </div>
  );
}

function BookFlow({ onBooked }: { onBooked: (a: Appointment) => void }) {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const types = useLoad(() => api<{ timeZone: string; types: ApptType[] }>("/api/career/appointments/student/types"), [api, schoolId]);
  const [typeId, setTypeId] = useState<string | null>(null);
  const type = types.data?.types.find((t) => t.id === typeId) ?? null;
  const tz = types.data?.timeZone ?? "UTC";
  const counselors = useLoad(
    () => (typeId ? api<{ userId: string; name: string; title?: string | null; bio?: string | null }[]>(`/api/career/appointments/student/counselors?typeId=${typeId}`) : Promise.resolve([])),
    [api, typeId],
  );
  const [counselorId, setCounselorId] = useState("");
  const [mode, setMode] = useState("");
  const today = todayIn(tz);
  const [from, setFrom] = useState(today);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const slots = useFetch<SlotResponse>(typeId ? `/api/career/appointments/student/slots?typeId=${typeId}&from=${from}&to=${addDays(from, 13)}${counselorId ? `&counselorId=${counselorId}` : ""}` : null, refresh);
  const names = Object.fromEntries((counselors.data ?? []).map((c) => [c.userId, c.name]));

  const chooseType = (id: string) => {
    setTypeId(id);
    setCounselorId("");
    setSlot(null);
    setAnswers({});
    setFrom(today);
    const t = types.data?.types.find((x) => x.id === id);
    setMode(t?.modes[0] ?? "");
  };

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type || !slot) return;
    setBusy(true);
    setError(null);
    try {
      const a = await api<Appointment>("/api/career/appointments/student/book", {
        method: "POST",
        json: { typeId: type.id, counselorUserId: counselorId || null, startUtc: slot.startUtc, mode, answers },
      });
      onBooked(a);
    } catch (err) {
      setError((err as Error).message);
      setSlot(null);
      setRefresh((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  if (types.loading) return <Loading />;
  if (types.error) return <ErrorBanner error={types.error} onRetry={types.reload} />;
  if (!types.data?.types.length) return <EmptyState title="No appointments are open for booking right now">Check back later or contact your career center.</EmptyState>;

  return (
    <form onSubmit={book} className="space-y-4">
      <Card title="1. What do you need help with?">
        <fieldset>
          <legend className="sr-only">Appointment type</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {types.data.types.map((t) => (
              <label key={t.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 focus-within:ring-2 ${typeId === t.id ? "border-[var(--brand,#4f46e5)] ring-1 ring-[var(--brand,#4f46e5)]" : "border-border"}`}>
                <input type="radio" name="type" value={t.id} checked={typeId === t.id} onChange={() => chooseType(t.id)} className="mt-1" />
                <span>
                  <span className="block font-medium">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t.durationMinutes} min · {t.modes.map((m) => MODE_LABELS[m] ?? m).join(", ")}
                  </span>
                  {t.description && <span className="mt-1 block text-sm text-muted-foreground">{t.description}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      {type && (
        <Card title="2. Choose a time">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Field label="Counselor">
              {(p) => (
                <select
                  {...p}
                  value={counselorId}
                  onChange={(e) => {
                    setCounselorId(e.target.value);
                    setSlot(null);
                  }}
                >
                  <option value="">Any available counselor</option>
                  {(counselors.data ?? []).map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.name}
                      {c.title ? ` – ${c.title}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="How would you like to meet?">
              {(p) => (
                <select {...p} value={mode} onChange={(e) => setMode(e.target.value)}>
                  {type.modes.map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABELS[m] ?? m}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <ErrorBanner error={slots.error} />
          <SlotPicker data={slots.data} loading={slots.loading} from={from} minFrom={today} onFrom={(f) => { setFrom(f); setSlot(null); }} value={slot} onChange={setSlot} counselorNames={names} />
          <p className="mt-3 text-xs text-muted-foreground">
            Book at least {type.minLeadMinutes >= 60 ? `${Math.round(type.minLeadMinutes / 60)} hours` : `${type.minLeadMinutes} minutes`} ahead, up to {type.maxLeadDays} days out. You can cancel or reschedule online until{" "}
            {type.cancelCutoffMinutes >= 60 ? `${Math.round(type.cancelCutoffMinutes / 60)} hours` : `${type.cancelCutoffMinutes} minutes`} before the start.
          </p>
        </Card>
      )}

      {type && slot && (
        <Card title="3. Tell us a bit more and confirm">
          <p className="mb-3 text-sm" role="status">
            <strong>{type.name}</strong>, {whenText(slot, tz)}
            {slot.counselorUserIds.length === 1 && names[slot.counselorUserIds[0]] ? ` with ${names[slot.counselorUserIds[0]]}` : counselorId ? "" : " with the first available counselor"}, {MODE_LABELS[mode] ?? mode}.
          </p>
          <IntakeFields questions={type.intakeQuestions} answers={answers} onChange={setAnswers} />
          <ErrorBanner error={error} />
          <div className="mt-4 flex gap-2">
            <Button type="submit" busy={busy}>
              Book appointment
            </Button>
            <Button type="button" variant="secondary" onClick={() => setSlot(null)}>
              Choose another time
            </Button>
          </div>
        </Card>
      )}
    </form>
  );
}

function MyAppointments({ onBook }: { onBook: () => void }) {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const list = useLoad(() => api<{ timeZone: string; upcoming: Appointment[]; past: Appointment[] }>("/api/career/appointments/student"), [api, schoolId]);
  const [message, setMessage] = useState<string | null>(null);

  if (list.loading) return <Loading />;
  if (list.error) return <ErrorBanner error={list.error} onRetry={list.reload} />;
  const data = list.data!;
  return (
    <div className="space-y-6">
      <SuccessBanner message={message} />
      <section aria-labelledby="upcoming-h">
        <h2 id="upcoming-h" className="mb-3 text-lg font-semibold">
          Upcoming
        </h2>
        {data.upcoming.length === 0 ? (
          <EmptyState title="No upcoming appointments">
            <Button type="button" onClick={onBook}>
              Book an appointment
            </Button>
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {data.upcoming.map((a) => (
              <li key={a.id}>
                <AppointmentCard
                  a={a}
                  onChanged={(text) => {
                    setMessage(text);
                    list.reload();
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="past-h">
        <h2 id="past-h" className="mb-3 text-lg font-semibold">
          Past and cancelled
        </h2>
        {data.past.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.past.map((a) => (
              <li key={a.id}>
                <AppointmentCard a={a} onChanged={() => list.reload()} past />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AppointmentCard({ a, onChanged, past }: { a: Appointment; onChanged: (message: string) => void; past?: boolean }) {
  const api = useApi();
  const download = useDownload();
  const [panel, setPanel] = useState<"none" | "cancel" | "reschedule" | "details">("none");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(todayIn(a.timeZone));
  const [slot, setSlot] = useState<Slot | null>(null);
  const [detail, setDetail] = useState<{ notes: Note[]; tasks: Task[] } | null>(null);

  const resched = useFetch<SlotResponse>(
    panel === "reschedule" ? `/api/career/appointments/student/slots?typeId=${a.typeId}&counselorId=${a.counselor.userId}&from=${from}&to=${addDays(from, 13)}&excludeAppointmentId=${a.id}` : null,
  );

  useEffect(() => {
    if (panel !== "details" || detail) return;
    api<{ notes: Note[]; tasks: Task[] }>(`/api/career/appointments/student/${a.id}`)
      .then(setDetail)
      .catch((e: Error) => setError(e.message));
  }, [api, panel, detail, a.id]);

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

  return (
    <article className="rounded-xl border border-border bg-card p-4" aria-label={`${a.typeName}, ${whenText(a, a.timeZone)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{a.typeName}</h3>
          <p className="text-sm">{whenText(a, a.timeZone)}</p>
          <p className="text-sm text-muted-foreground">
            With {a.counselor.name} · {MODE_LABELS[a.mode] ?? a.mode}
          </p>
          {!past && (
            <div className="mt-1">
              <MeetingInfo a={a} />
            </div>
          )}
          {a.cancelReason && <p className="mt-1 text-xs text-muted-foreground">Cancellation reason: {a.cancelReason}</p>}
        </div>
        <Badge tone={statusTone(a)}>{statusLabel(a)}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {a.status !== "Cancelled" && (
          <Button type="button" variant="secondary" onClick={() => run(() => download(`/api/career/appointments/student/${a.id}/ics`, "appointment.ics"))}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> Add to calendar
          </Button>
        )}
        {!past && a.canChange && (
          <>
            <Button type="button" variant="secondary" aria-expanded={panel === "reschedule"} onClick={() => toggle("reschedule")}>
              Reschedule
            </Button>
            <Button type="button" variant="secondary" aria-expanded={panel === "cancel"} onClick={() => toggle("cancel")}>
              Cancel
            </Button>
          </>
        )}
        <Button type="button" variant="ghost" aria-expanded={panel === "details"} onClick={() => toggle("details")}>
          Notes & tasks
        </Button>
      </div>
      {!past && !a.canChange && a.status === "Booked" && (
        <p className="mt-2 text-xs text-muted-foreground">It&apos;s too close to the start to change this online. Please contact the career center.</p>
      )}
      <ErrorBanner error={error} />

      {panel === "cancel" && (
        <form
          className="mt-3 space-y-3 rounded-lg border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api(`/api/career/appointments/student/${a.id}/cancel`, { method: "POST", json: { reason } });
              onChanged(`Your ${a.typeName} appointment was cancelled.`);
            });
          }}
        >
          <Field label="Why are you cancelling?" hint="Your counselor will see this.">
            {(p) => <textarea {...p} rows={2} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
          <Button type="submit" variant="danger" busy={busy}>
            Cancel appointment
          </Button>
        </form>
      )}

      {panel === "reschedule" && (
        <div className="mt-3 space-y-3 rounded-lg border border-border p-3">
          <ErrorBanner error={resched.error} />
          <SlotPicker data={resched.data} loading={resched.loading} from={from} minFrom={todayIn(a.timeZone)} onFrom={setFrom} value={slot} onChange={setSlot} />
          <Button
            type="button"
            disabled={!slot}
            busy={busy}
            onClick={() =>
              run(async () => {
                const moved = await api<Appointment>(`/api/career/appointments/student/${a.id}/reschedule`, { method: "POST", json: { startUtc: slot!.startUtc, counselorUserId: a.counselor.userId } });
                onChanged(`Moved to ${whenText(moved, moved.timeZone)}.`);
              })
            }
          >
            Move appointment
          </Button>
        </div>
      )}

      {panel === "details" && (
        <div className="mt-3 space-y-3 rounded-lg border border-border p-3">
          {!detail ? (
            <Loading />
          ) : (
            <>
              <div>
                <h4 className="text-sm font-semibold">Notes from your counselor</h4>
                {detail.notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No shared notes yet.</p>
                ) : (
                  <ul className="mt-1 space-y-2">
                    {detail.notes.map((n) => (
                      <li key={n.id} className="whitespace-pre-wrap rounded-md bg-muted p-2 text-sm">
                        {n.body}
                        <span className="mt-1 block text-xs text-muted-foreground">{formatDate(n.createdAt, true)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold">Follow-up tasks</h4>
                {detail.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {detail.tasks.map((t) => (
                      <li key={t.id}>
                        {t.title} {t.dueDate && <span className="text-muted-foreground">· due {formatDate(t.dueDate)}</span>} <Badge tone={t.status === "Done" ? "good" : "neutral"}>{t.status === "Done" ? "Done" : t.assigneeType === "Student" ? "To do (you)" : "Counselor"}</Badge>
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

interface DropInSession {
  id: string;
  name: string;
  location?: string | null;
  waiting?: number | null;
  estimatedWaitMinutes: number;
  myEntry?: { id: string; queueNumber: number; status: string; topic?: string | null; ahead: number; estimatedWaitMinutes: number; checkedInAt: string } | null;
}

function DropIn() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const list = useLoad(() => api<DropInSession[]>("/api/career/appointments/student/dropin"), [api, schoolId]);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { reload } = list;

  useEffect(() => {
    const t = setInterval(() => reload(), 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorBanner error={list.error} onRetry={reload} />;
  if (!list.data?.length) return <EmptyState title="No drop-in hours right now">When the career center opens drop-in advising, you can join the line here or at the front desk.</EmptyState>;

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} />
      {list.data.map((s) => (
        <Card key={s.id} title={s.name}>
          {s.location && <p className="mb-2 text-sm text-muted-foreground">{s.location}</p>}
          {s.myEntry ? (
            <div role="status" aria-live="polite" className="space-y-2">
              {s.myEntry.status === "Called" ? (
                <p className="text-lg font-semibold">It&apos;s your turn — a counselor is ready for you.</p>
              ) : (
                <>
                  <p className="text-lg font-semibold">You&apos;re number {s.myEntry.queueNumber}</p>
                  <p className="text-sm">
                    {s.myEntry.ahead === 0 ? "You're next." : `${s.myEntry.ahead} ${s.myEntry.ahead === 1 ? "person" : "people"} ahead of you`} · about {s.myEntry.estimatedWaitMinutes} min wait
                  </p>
                </>
              )}
              {s.myEntry.status === "Waiting" && (
                <Button type="button" variant="secondary" busy={busy === s.myEntry.id} onClick={() => act(s.myEntry!.id, () => api(`/api/career/appointments/student/dropin/entries/${s.myEntry!.id}/leave`, { method: "POST" }))}>
                  Leave the line
                </Button>
              )}
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void act(s.id, () => api(`/api/career/appointments/student/dropin/${s.id}/check-in`, { method: "POST", json: { topic } }));
              }}
            >
              <p className="text-sm">
                {s.waiting ?? 0} waiting · about {s.estimatedWaitMinutes} min
              </p>
              <Field label="What would you like to talk about? (optional)">{(p) => <input {...p} maxLength={300} value={topic} onChange={(e) => setTopic(e.target.value)} />}</Field>
              <Button type="submit" busy={busy === s.id}>
                Join the line
              </Button>
            </form>
          )}
        </Card>
      ))}
    </div>
  );
}

function NotesAndTasks() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const notes = useLoad(() => api<Note[]>("/api/career/appointments/student/notes"), [api, schoolId]);
  const tasks = useLoad(() => api<Task[]>("/api/career/appointments/student/tasks"), [api, schoolId]);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (t: Task) => {
    setError(null);
    try {
      const saved = await api<{ id: string; status: string; completedAt?: string | null }>(`/api/career/appointments/student/tasks/${t.id}`, { method: "POST", json: { done: t.status !== "Done" } });
      tasks.setData((d) => (d ? d.map((x) => (x.id === t.id ? { ...x, status: saved.status, completedAt: saved.completedAt } : x)) : d));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Follow-up tasks">
        <ErrorBanner error={error || tasks.error} />
        {tasks.loading ? (
          <Loading />
        ) : !tasks.data?.length ? (
          <p className="text-sm text-muted-foreground">No tasks yet. Your counselor may add some after a meeting.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.data.map((t) => (
              <li key={t.id} className="flex items-start gap-2 text-sm">
                {t.mine ? (
                  <input id={`task-${t.id}`} type="checkbox" className="mt-1" checked={t.status === "Done"} onChange={() => void toggle(t)} />
                ) : (
                  <span className="mt-1 inline-block h-3 w-3" aria-hidden />
                )}
                <label htmlFor={t.mine ? `task-${t.id}` : undefined} className={t.status === "Done" ? "text-muted-foreground line-through" : ""}>
                  {t.title}
                  {t.dueDate && <span className="text-muted-foreground"> · due {formatDate(t.dueDate)}</span>}
                  {!t.mine && <span className="text-muted-foreground"> · your counselor will do this</span>}
                  {t.status === "Done" && <span className="sr-only"> (done)</span>}
                  {t.details && <span className="block text-xs text-muted-foreground">{t.details}</span>}
                </label>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Notes shared with you">
        <ErrorBanner error={notes.error} />
        {notes.loading ? (
          <Loading />
        ) : !notes.data?.length ? (
          <p className="text-sm text-muted-foreground">Counselors can share notes from your meetings here.</p>
        ) : (
          <ul className="space-y-3">
            {notes.data.map((n) => (
              <li key={n.id} className="rounded-md bg-muted p-3 text-sm">
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.author} · {formatDate(n.createdAt, true)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
