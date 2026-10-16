"use client";

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import { API_BASE_URL } from "@/lib/apiClient";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, SuccessBanner, useLoad, ScrollArea, useCareerT } from "@/components/career/ui";
import { type ApptType, type IntakeQuestion, todayIn, useDownload, useModeLabels, useDayNames } from "./shared";
import { useCounselors, useStaffTypes } from "./StaffSchedule";

// ---------------- Availability and booking profile ----------------

interface Profile {
  userId: string;
  name: string;
  title?: string | null;
  bio?: string | null;
  meetingUrl?: string | null;
  location?: string | null;
  phone?: string | null;
  bookable: boolean;
  typeIds: string[];
  calendarFeedPath?: string | null;
}

interface Availability {
  timeZone: string;
  weekly: { id: string; dayOfWeek: number; startTime: string; endTime: string }[];
  exceptions: { id: string; date: string; startTime?: string | null; endTime?: string | null; kind: string; note?: string | null }[];
}

export function AvailabilityPanel({ isAdmin }: { isAdmin: boolean }) {
  const tr = useCareerT("staffSettings");
  const api = useApi();
  const { me } = useCareerShell();
  const counselors = useCounselors();
  const [who, setWho] = useState<string | null>(null);
  const userId = who ?? me?.userId ?? null;
  const isMe = !who || who === me?.userId;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Card>
          <Field label={tr("counselor")} hint={tr("careerAdminsCanManageAnyones")}>
            {(p) => (
              <select {...p} value={userId ?? ""} onChange={(e) => setWho(e.target.value)}>
                {(counselors.data ?? []).map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.name}
                    {c.isMe ? tr("me") : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </Card>
      )}
      {userId && <ProfileCard key={`p-${userId}`} userId={userId} isMe={isMe} api={api} onSaved={counselors.reload} />}
      {userId && <WeeklyHours key={`w-${userId}`} userId={userId} />}
    </div>
  );
}

function ProfileCard({ userId, isMe, api, onSaved }: { userId: string; isMe: boolean; api: ReturnType<typeof useApi>; onSaved: () => void }) {
  const types = useStaffTypes();
  const counselors = useCounselors();
  const mine = useLoad(() => (isMe ? api<Profile>("/api/career/appointments/counselors/me") : Promise.resolve(null)), [api, isMe]);
  const c = counselors.data?.find((x) => x.userId === userId);
  const initial: Profile | null = isMe
    ? mine.data
    : c
      ? { userId, name: c.name, title: c.title, meetingUrl: c.meetingUrl, location: c.location, bookable: c.bookable, typeIds: c.typeIds }
      : null;
  if (!initial) return mine.error || counselors.error ? <ErrorBanner error={mine.error || counselors.error} /> : <Loading />;
  return <ProfileForm initial={initial} userId={userId} isMe={isMe} api={api} onSaved={onSaved} types={types.data?.types ?? []} />;
}

function ProfileForm({ initial, userId, isMe, api, onSaved, types }: { initial: Profile; userId: string; isMe: boolean; api: ReturnType<typeof useApi>; onSaved: () => void; types: ApptType[] }) {
  const tr = useCareerT("staffSettings");
  const [form, setForm] = useState<Profile>(initial);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await api<Profile>(`/api/career/appointments/counselors/${userId}`, {
        method: "PUT",
        json: { name: form.name, title: form.title ?? "", bio: form.bio ?? "", meetingUrl: form.meetingUrl ?? "", location: form.location ?? "", phone: form.phone ?? "", typeIds: form.typeIds, bookable: form.bookable },
      });
      setForm({ ...form, ...saved, calendarFeedPath: saved.calendarFeedPath ?? form.calendarFeedPath });
      setMessage(tr("bookingProfileSaved"));
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rotate = async () => {
    if (!window.confirm(tr("makeANewCalendarLink"))) return;
    try {
      const saved = await api<Profile>("/api/career/appointments/counselors/me/calendar-token/rotate", { method: "POST" });
      setForm((f) => ({ ...f, calendarFeedPath: saved.calendarFeedPath }));
      setMessage(tr("newCalendarLinkCreated"));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const feed = form.calendarFeedPath ? API_BASE_URL.replace(/\/$/, "") + form.calendarFeedPath : null;
  return (
    <Card title={isMe ? tr("myBookingProfile") : tr("bookingProfileName", { name: form.name })}>
      <ErrorBanner error={error} />
      <SuccessBanner message={message} />
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("nameStudentsSee")}>{(p) => <input {...p} required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
          <Field label={tr("title")}>{(p) => <input {...p} maxLength={120} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
          <Field label={tr("videoMeetingLink")} hint={tr("yourPersonalRoomAnyProvider")}>
            {(p) => <input {...p} type="url" placeholder={tr("https")} value={form.meetingUrl ?? ""} onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })} />}
          </Field>
          <Field label={tr("inPersonLocation")}>{(p) => <input {...p} maxLength={300} value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />}</Field>
        </div>
        {isMe && <Field label={tr("shortBioOptional")}>{(p) => <textarea {...p} rows={2} maxLength={1000} value={form.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} />}</Field>}
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{tr("appointmentTypesOffered")}</legend>
          {!types.length ? (
            <p className="text-sm text-muted-foreground">{tr("noAppointmentTypesYetA")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {types.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.typeIds.includes(t.id)}
                    onChange={(e) => setForm({ ...form, typeIds: e.target.checked ? [...form.typeIds, t.id] : form.typeIds.filter((x) => x !== t.id) })}
                  />
                  {tr("nameDurationMinutesMin", { name: t.name, durationMinutes: t.durationMinutes })}{!t.active && <Badge tone="warn">{tr("inactive2")}</Badge>}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.bookable} onChange={(e) => setForm({ ...form, bookable: e.target.checked })} />{" "}{tr("studentsCanBookMe")}
        </label>
        <Button type="submit" busy={busy}>
          {tr("saveProfile")}
        </Button>
      </form>
      {isMe && feed && (
        <div className="mt-6 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">{tr("privateCalendarFeed")}</h3>
          <p className="mb-2 text-xs text-muted-foreground">{tr("subscribeFromOutlookGoogleOr")}</p>
          <Field label={tr("calendarLink")}>{(p) => <input {...p} readOnly value={feed} onFocus={(e) => e.currentTarget.select()} />}</Field>
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void navigator.clipboard?.writeText(feed).then(() => setMessage(tr("calendarLinkCopied")))}>
              {tr("copyLink")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void rotate()}>
              {tr("newLink")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function WeeklyHours({ userId }: { userId: string }) {
  const tr = useCareerT("staffSettings");
  const api = useApi();
  const av = useLoad(() => api<Availability>(`/api/career/appointments/counselors/${userId}/availability`), [api, userId]);
  const [ex, setEx] = useState({ date: "", allDay: true, startTime: "09:00", endTime: "12:00", kind: "Blocked", note: "" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<Availability>, done: string) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      av.setData(await fn());
      setMessage(done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (av.loading) return <Loading />;
  if (av.error) return <ErrorBanner error={av.error} onRetry={av.reload} />;
  const tz = av.data!.timeZone;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={tr("weeklyHours")}>
        <p className="mb-3 text-xs text-muted-foreground">{tr("timesAreInTheSchools", { tz })}</p>
        <ErrorBanner error={error} />
        <SuccessBanner message={message} />
        <WeeklyForm
          key={JSON.stringify(av.data!.weekly)}
          initial={av.data!.weekly.map((w) => ({ dayOfWeek: w.dayOfWeek, startTime: w.startTime, endTime: w.endTime }))}
          busy={busy === "weekly"}
          onSave={(rows) => run("weekly", () => api<Availability>(`/api/career/appointments/counselors/${userId}/availability`, { method: "PUT", json: { weekly: rows } }), tr("weeklyHoursSaved"))}
        />
      </Card>
      <Card title={tr("timeOffAndExtraHours")}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              "ex",
              () =>
                api<Availability>(`/api/career/appointments/counselors/${userId}/exceptions`, {
                  method: "POST",
                  json: { date: ex.date, kind: ex.kind, note: ex.note, startTime: ex.allDay && ex.kind === "Blocked" ? null : ex.startTime, endTime: ex.allDay && ex.kind === "Blocked" ? null : ex.endTime },
                }),
              ex.kind === "Blocked" ? tr("timeOffAdded") : tr("extraHoursAdded"),
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tr("date")}>{(p) => <input {...p} type="date" required min={todayIn(tz)} value={ex.date} onChange={(e) => setEx({ ...ex, date: e.target.value })} />}</Field>
            <Field label={tr("kind")}>
              {(p) => (
                <select {...p} value={ex.kind} onChange={(e) => setEx({ ...ex, kind: e.target.value })}>
                  <option value="Blocked">{tr("timeOffNotBookable")}</option>
                  <option value="Extra">{tr("extraHours2")}</option>
                </select>
              )}
            </Field>
          </div>
          {ex.kind === "Blocked" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ex.allDay} onChange={(e) => setEx({ ...ex, allDay: e.target.checked })} />{" "}{tr("wholeDay")}
            </label>
          )}
          {(!ex.allDay || ex.kind === "Extra") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={tr("from")}>{(p) => <input {...p} type="time" required value={ex.startTime} onChange={(e) => setEx({ ...ex, startTime: e.target.value })} />}</Field>
              <Field label={tr("to")}>{(p) => <input {...p} type="time" required value={ex.endTime} onChange={(e) => setEx({ ...ex, endTime: e.target.value })} />}</Field>
            </div>
          )}
          <Field label={tr("noteOptional")}>{(p) => <input {...p} maxLength={200} value={ex.note} onChange={(e) => setEx({ ...ex, note: e.target.value })} />}</Field>
          <Button type="submit" busy={busy === "ex"}>
            {tr("add")}
          </Button>
        </form>
        <ul className="mt-4 space-y-2">
          {av.data!.exceptions.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <span>
                <Badge tone={x.kind === "Blocked" ? "warn" : "good"}>{x.kind === "Blocked" ? tr("timeOff") : tr("extra")}</Badge> {x.date} {x.startTime ? `${x.startTime}–${x.endTime}` : tr("allDay")}
                {x.note ? ` · ${x.note}` : ""}
              </span>
              <Button
                type="button"
                variant="ghost"
                aria-label={tr("removeValueOnDate", { value: x.kind === "Blocked" ? tr("timeOff2") : tr("extraHours"), date: x.date })}
                busy={busy === x.id}
                onClick={() => void run(x.id, () => api<Availability>(`/api/career/appointments/counselors/${userId}/exceptions/${x.id}`, { method: "DELETE" }), tr("removed"))}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}


type WeeklyRow = { dayOfWeek: number; startTime: string; endTime: string };

function WeeklyForm({ initial, busy, onSave }: { initial: WeeklyRow[]; busy: boolean; onSave: (rows: WeeklyRow[]) => Promise<void> }) {
  const tr = useCareerT("staffSettings");
  const DAY_NAMES = useDayNames();
  const [rows, setRows] = useState<WeeklyRow[]>(initial);
  return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave(rows);
          }}
          className="space-y-2"
        >
          {rows.length === 0 && <p className="text-sm text-muted-foreground">{tr("noWeeklyHoursStudentsCant")}</p>}
          {rows
            .map((r, i) => ({ r, i }))
            .sort((a, b) => a.r.dayOfWeek - b.r.dayOfWeek || a.r.startTime.localeCompare(b.r.startTime))
            .map(({ r, i }) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <Field label={tr("day")}>
                  {(p) => (
                    <select {...p} value={r.dayOfWeek} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, dayOfWeek: Number(e.target.value) } : x)))}>
                      {DAY_NAMES.map((d, n) => (
                        <option key={d} value={n}>
                          {d}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label={tr("from")}>{(p) => <input {...p} type="time" required value={r.startTime} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x)))} />}</Field>
                <Field label={tr("to")}>{(p) => <input {...p} type="time" required value={r.endTime} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, endTime: e.target.value } : x)))} />}</Field>
                <Button type="button" variant="ghost" aria-label={tr("removeDayOfWeekStartTimeEndTime", { dayOfWeek: DAY_NAMES[r.dayOfWeek], startTime: r.startTime, endTime: r.endTime })} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setRows([...rows, { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }])}>
              <Plus className="h-4 w-4" aria-hidden />{" "}{tr("addHours")}
            </Button>
            <Button type="submit" busy={busy}>
              {tr("saveWeeklyHours")}
            </Button>
          </div>
        </form>
  );
}

// ---------------- Appointment types (admin) ----------------

const blankType = (): Omit<ApptType, "id"> => ({
  name: "",
  description: "",
  durationMinutes: 30,
  modes: ["InPerson", "Video"],
  allowStudents: true,
  allowAlumni: true,
  minLeadMinutes: 120,
  maxLeadDays: 30,
  bufferMinutes: 0,
  cancelCutoffMinutes: 120,
  intakeQuestions: [],
  active: true,
  sortOrder: 0,
});

export function TypesPanel({ isAdmin }: { isAdmin: boolean }) {
  const tr = useCareerT("staffSettings");
  const MODE_LABELS = useModeLabels();
  const api = useApi();
  const types = useStaffTypes();
  const [editing, setEditing] = useState<(Omit<ApptType, "id"> & { id?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await api(editing.id ? `/api/career/appointments/types/${editing.id}` : "/api/career/appointments/types", { method: editing.id ? "PUT" : "POST", json: editing });
      setMessage(tr("nameSaved", { name: editing.name }));
      setEditing(null);
      types.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setQ = (i: number, q: Partial<IntakeQuestion>) => editing && setEditing({ ...editing, intakeQuestions: editing.intakeQuestions.map((x, j) => (j === i ? { ...x, ...q } : x)) });

  return (
    <div className="space-y-4">
      <SuccessBanner message={message} />
      {!isAdmin && <p className="text-sm text-muted-foreground">{tr("onlyCareerAdminsCanChange")}</p>}
      {types.loading ? (
        <Loading />
      ) : !types.data?.types.length ? (
        <EmptyState title={tr("noAppointmentTypesYet")}>{isAdmin ? tr("createTheKindsOfAppointments") : ""}</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {types.data.types.map((t) => (
            <li key={t.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{t.name}</h2>
                <Badge tone={t.active ? "good" : "neutral"}>{t.active ? tr("active") : tr("inactive")}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {tr("durationMinutesMinValueBoolean", { durationMinutes: t.durationMinutes, value: t.modes.map((m) => MODE_LABELS[m] ?? m).join(", "), Boolean: [t.allowStudents && "students", t.allowAlumni && "alumni"].filter(Boolean).join(" & ") })}
              </p>
              <p className="text-xs text-muted-foreground">
                {tr("noticeMinLeadMinutesMinUpTo", { minLeadMinutes: t.minLeadMinutes, maxLeadDays: t.maxLeadDays, bufferMinutes: t.bufferMinutes, cancelCutoffMinutes: t.cancelCutoffMinutes, count: t.intakeQuestions.length })}
              </p>
              {isAdmin && (
                <Button type="button" variant="secondary" className="mt-2" onClick={() => setEditing({ ...t, description: t.description ?? "" })}>
                  {tr("edit")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isAdmin && !editing && (
        <Button type="button" onClick={() => setEditing(blankType())}>
          <Plus className="h-4 w-4" aria-hidden />{" "}{tr("newAppointmentType")}
        </Button>
      )}
      {isAdmin && editing && (
        <Card title={editing.id ? tr("editName", { name: editing.name }) : tr("newAppointmentType")}>
          <ErrorBanner error={error} />
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={tr("name")}>{(p) => <input {...p} required maxLength={120} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />}</Field>
              <Field label={tr("lengthMinutes")}>{(p) => <input {...p} type="number" min={5} max={240} required value={editing.durationMinutes} onChange={(e) => setEditing({ ...editing, durationMinutes: Number(e.target.value) })} />}</Field>
            </div>
            <Field label={tr("description")}>{(p) => <textarea {...p} rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="mb-1 text-sm font-medium">{tr("meetingOptions")}</legend>
                {Object.entries(MODE_LABELS).map(([k, label]) => (
                  <label key={k} className="me-4 inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editing.modes.includes(k)} onChange={(e) => setEditing({ ...editing, modes: e.target.checked ? [...editing.modes, k] : editing.modes.filter((m) => m !== k) })} />
                    {label}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend className="mb-1 text-sm font-medium">{tr("whoCanBook")}</legend>
                <label className="me-4 inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.allowStudents} onChange={(e) => setEditing({ ...editing, allowStudents: e.target.checked })} />{" "}{tr("students")}
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.allowAlumni} onChange={(e) => setEditing({ ...editing, allowAlumni: e.target.checked })} />{" "}{tr("alumni")}
                </label>
              </fieldset>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label={tr("minimumNoticeMinutes")}>{(p) => <input {...p} type="number" min={0} max={43200} value={editing.minLeadMinutes} onChange={(e) => setEditing({ ...editing, minLeadMinutes: Number(e.target.value) })} />}</Field>
              <Field label={tr("bookUpToDaysAhead")}>{(p) => <input {...p} type="number" min={1} max={365} value={editing.maxLeadDays} onChange={(e) => setEditing({ ...editing, maxLeadDays: Number(e.target.value) })} />}</Field>
              <Field label={tr("bufferMinutes")}>{(p) => <input {...p} type="number" min={0} max={120} value={editing.bufferMinutes} onChange={(e) => setEditing({ ...editing, bufferMinutes: Number(e.target.value) })} />}</Field>
              <Field label={tr("cancelCutoffMinutes")}>{(p) => <input {...p} type="number" min={0} max={10080} value={editing.cancelCutoffMinutes} onChange={(e) => setEditing({ ...editing, cancelCutoffMinutes: Number(e.target.value) })} />}</Field>
            </div>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">{tr("intakeQuestionsUpTo10")}</legend>
              {editing.intakeQuestions.map((q, i) => (
                <div key={i} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-6 sm:items-end">
                  <div className="sm:col-span-3">
                    <Field label={tr("questionValue", { value: i + 1 })}>{(p) => <input {...p} required maxLength={200} value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} />}</Field>
                  </div>
                  <Field label={tr("answerType")}>
                    {(p) => (
                      <select {...p} value={q.kind} onChange={(e) => setQ(i, { kind: e.target.value as IntakeQuestion["kind"] })}>
                        <option value="textarea">{tr("paragraph")}</option>
                        <option value="text">{tr("shortText")}</option>
                        <option value="choice">{tr("choice")}</option>
                      </select>
                    )}
                  </Field>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} />{" "}{tr("required")}
                  </label>
                  <Button type="button" variant="ghost" aria-label={tr("removeQuestionValue", { value: i + 1 })} onClick={() => setEditing({ ...editing, intakeQuestions: editing.intakeQuestions.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                  {q.kind === "choice" && (
                    <div className="sm:col-span-6">
                      <Field label={tr("optionsOnePerLine")}>{(p) => <textarea {...p} rows={3} value={(q.options ?? []).join("\n")} onChange={(e) => setQ(i, { options: e.target.value.split("\n") })} />}</Field>
                    </div>
                  )}
                </div>
              ))}
              {editing.intakeQuestions.length < 10 && (
                <Button type="button" variant="secondary" onClick={() => setEditing({ ...editing, intakeQuestions: [...editing.intakeQuestions, { id: "", label: "", required: false, kind: "textarea", options: [] }] })}>
                  <Plus className="h-4 w-4" aria-hidden />{" "}{tr("addQuestion")}
                </Button>
              )}
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />{" "}{tr("activeStudentsCanBookIt")}
            </label>
            <div className="flex gap-2">
              <Button type="submit" busy={busy}>
                {tr("saveType")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                {tr("cancel")}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

// ---------------- Reports ----------------

interface ReportLine {
  key: string;
  total: number;
  attended: number;
  noShow: number;
  lateCancelled: number;
  cancelled: number;
  booked: number;
  noShowRate: number | null;
}

interface Report {
  from: string;
  to: string;
  timeZone: string;
  overall: ReportLine;
  byType: ReportLine[];
  byCounselor: ReportLine[];
  byWeek: ReportLine[];
  bookedOnBehalf: number;
  dropIn: { checkIns: number; seen: number; noShow: number; left: number; kioskCheckIns: number; averageWaitMinutes: number | null; medianWaitMinutes: number | null; longestWaitMinutes: number | null };
}

export function ReportsPanel() {
  const tr = useCareerT("staffSettings");
  const api = useApi();
  const download = useDownload();
  const { schoolId } = useCareerShell();
  const tz = useStaffTypes().data?.timeZone ?? "UTC";
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const from = range?.from ?? todayIn(tz, -90);
  const to = range?.to ?? todayIn(tz);
  const report = useLoad(() => api<Report>(`/api/career/appointments/reports?from=${from}&to=${to}`), [api, schoolId, from, to]);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={tr("from")}>{(p) => <input {...p} type="date" value={from} onChange={(e) => e.target.value && setRange({ from: e.target.value, to })} />}</Field>
          <Field label={tr("to")}>{(p) => <input {...p} type="date" value={to} onChange={(e) => e.target.value && setRange({ from, to: e.target.value })} />}</Field>
          <Button type="button" variant="secondary" onClick={() => download(`/api/career/appointments/reports.csv?from=${from}&to=${to}`, `appointments-${from}-to-${to}.csv`).catch((e: Error) => setError(e.message))}>
            {tr("downloadCSV")}
          </Button>
        </div>
      </Card>
      <ErrorBanner error={error || report.error} onRetry={report.reload} />
      {report.loading ? (
        <Loading />
      ) : (
        report.data && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label={tr("summary")}>
              <Stat label={tr("appointments")} value={report.data.overall.total} />
              <Stat label={tr("attended")} value={report.data.overall.attended} />
              <Stat label={tr("noShowRate")} value={report.data.overall.noShowRate == null ? "—" : `${report.data.overall.noShowRate}%`} hint={tr("noShowNoShowsLateCancelledLate", { noShow: report.data.overall.noShow, lateCancelled: report.data.overall.lateCancelled })} />
              <Stat label={tr("dropInAverageWait")} value={report.data.dropIn.averageWaitMinutes == null ? "—" : tr("minutesShort", { minutes: report.data.dropIn.averageWaitMinutes })} hint={tr("checkInsCheckInsMedianMedianWaitMinutes", { checkIns: report.data.dropIn.checkIns, medianWaitMinutes: report.data.dropIn.medianWaitMinutes ?? "—" })} />
            </div>
            <ReportTable title={tr("byAppointmentType")} rows={report.data.byType} />
            <ReportTable title={tr("byCounselor")} rows={report.data.byCounselor} />
            <ReportTable title={tr("byWeekWeekStarting")} rows={report.data.byWeek} />
            <Card title={tr("dropIn")}>
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                {[
                  [tr("dropInCheckIns"), report.data.dropIn.checkIns],
                  [tr("dropInFromTheKiosk"), report.data.dropIn.kioskCheckIns],
                  [tr("dropInSeen"), report.data.dropIn.seen],
                  [tr("dropInNoShows"), report.data.dropIn.noShow],
                  [tr("dropInLeftTheLine"), report.data.dropIn.left],
                  [tr("dropInLongestWait"), report.data.dropIn.longestWaitMinutes == null ? "—" : tr("minutesShort", { minutes: report.data.dropIn.longestWaitMinutes })],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <p className="text-xs text-muted-foreground">
              {tr("fromToToTimeZoneNo", { from: report.data.from, to: report.data.to, timeZone: report.data.timeZone, bookedOnBehalf: report.data.bookedOnBehalf })}
            </p>
          </>
        )
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ReportTable({ title, rows }: { title: string; rows: ReportLine[] }) {
  const tr = useCareerT("staffSettings");
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr("noAppointmentsInThisRange")}</p>
      ) : (
        <ScrollArea>
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-border text-start [&_th]:text-start">
                {[tr("colGroup"), tr("colAppointments"), tr("colAttended"), tr("colNoShows"), tr("colLateCancellations"), tr("colCancelled"), tr("colStillBooked"), tr("colNoShowRate")].map((h) => (
                  <th key={h} scope="col" className="p-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border">
                  <th scope="row" className="p-2 text-start font-normal">
                    {r.key}
                  </th>
                  <td className="p-2">{r.total}</td>
                  <td className="p-2">{r.attended}</td>
                  <td className="p-2">{r.noShow}</td>
                  <td className="p-2">{r.lateCancelled}</td>
                  <td className="p-2">{r.cancelled}</td>
                  <td className="p-2">{r.booked}</td>
                  <td className="p-2">{r.noShowRate == null ? "—" : `${r.noShowRate}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </Card>
  );
}
