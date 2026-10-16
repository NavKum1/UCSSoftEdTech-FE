"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, SuccessBanner, useLoad, useCareerT, useCareerFormat } from "@/components/career/ui";
import {
  type Appointment,
  type ApptType,
  type Slot,
  type SlotResponse,
  IntakeFields,
  SlotPicker,
  addDays,
  inZone,
  statusTone,
  todayIn,
  useFetch,
  useModeLabels,
  useStatusLabel,
} from "./shared";

export interface StaffCounselor {
  userId: string;
  name: string;
  email: string;
  role: string;
  isMe: boolean;
  bookable: boolean;
  typeIds: string[];
  title?: string | null;
  meetingUrl?: string | null;
  location?: string | null;
  weeklyBlocks: number;
}

export function useCounselors() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  return useLoad(() => api<StaffCounselor[]>("/api/career/appointments/counselors"), [api, schoolId]);
}

export function useStaffTypes() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  return useLoad(() => api<{ timeZone: string; types: ApptType[] }>("/api/career/appointments/types"), [api, schoolId]);
}

/** Day view of booked appointments: mine, one counselor's, or everyone's (grouped by counselor). */
export function StaffSchedule({ onOpen }: { onOpen: (id: string) => void }) {
  const tr = useCareerT("staffSchedule");
  const fmt = useCareerFormat();
  const statusLabel = useStatusLabel();
  const MODE_LABELS = useModeLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const types = useStaffTypes();
  const tz = types.data?.timeZone ?? "UTC";
  const counselors = useCounselors();
  const [day, setDay] = useState<string | null>(null);
  const [days, setDays] = useState(1);
  const [who, setWho] = useState("me");
  const [showCancelled, setShowCancelled] = useState(false);
  const [booking, setBooking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const date = day ?? todayIn(tz);
  const query = who === "me" ? "" : who === "all" ? "&all=true" : `&counselorId=${who}`;
  const schedule = useLoad(
    () => (types.data ? api<{ timeZone: string; items: Appointment[] }>(`/api/career/appointments/schedule?from=${date}&to=${addDays(date, days - 1)}${query}&includeCancelled=${showCancelled}`) : Promise.resolve(null)),
    [api, schoolId, date, days, query, showCancelled, types.data],
  );

  const items = schedule.data?.items ?? [];
  const groups = who === "all" ? Object.entries(items.reduce<Record<string, Appointment[]>>((acc, a) => ({ ...acc, [a.counselor.name]: [...(acc[a.counselor.name] ?? []), a] }), {})) : [["", items] as [string, Appointment[]]];
  const dayLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString(fmt.locale, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-4">
      <SuccessBanner message={message} />
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-end gap-1">
            <Button type="button" variant="secondary" aria-label={tr("previousDay")} onClick={() => setDay(addDays(date, -days))}>
              <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            </Button>
            <Field label={tr("date")}>{(p) => <input {...p} type="date" value={date} onChange={(e) => e.target.value && setDay(e.target.value)} />}</Field>
            <Button type="button" variant="secondary" aria-label={tr("nextDay")} onClick={() => setDay(addDays(date, days))}>
              <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            </Button>
          </div>
          <Field label={tr("show")}>
            {(p) => (
              <select {...p} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                <option value={1}>{tr("oneDay")}</option>
                <option value={7}>{tr("sevenDays")}</option>
              </select>
            )}
          </Field>
          <Field label={tr("counselor")}>
            {(p) => (
              <select {...p} value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="me">{tr("mySchedule")}</option>
                <option value="all">{tr("allCounselors")}</option>
                {(counselors.data ?? [])
                  .filter((c) => !c.isMe)
                  .map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.name}
                    </option>
                  ))}
              </select>
            )}
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />{" "}{tr("includeCancelled")}
          </label>
          <Button type="button" className="ms-auto" onClick={() => setBooking((b) => !b)} aria-expanded={booking}>
            {tr("bookForAStudent")}
          </Button>
        </div>
      </Card>

      {booking && types.data && (
        <BookOnBehalf
          types={types.data.types.filter((t) => t.active)}
          timeZone={tz}
          counselors={counselors.data ?? []}
          onDone={(a) => {
            setBooking(false);
            setMessage(tr("bookedTypeNameForNameWith", { typeName: a.typeName, name: a.student?.name ?? tr("theStudent"), name2: a.counselor.name }));
            schedule.reload();
          }}
        />
      )}

      <section aria-labelledby="day-h" aria-live="polite">
        {/* The label uses the browser's locale, which can differ from the server render; it re-renders once the school's time zone loads */}
        <h2 id="day-h" className="mb-3 text-lg font-semibold" suppressHydrationWarning>
          {days === 1 ? dayLabel : tr("dayLabel6Days", { dayLabel })} <span className="text-sm font-normal text-muted-foreground">({tz})</span>
        </h2>
        <ErrorBanner error={schedule.error || types.error} onRetry={schedule.reload} />
        {schedule.loading || types.loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState title={tr("noAppointments")}>{tr("nothingBookedForThisWeek", { days })}</EmptyState>
        ) : (
          <div className="space-y-4">
            {groups.map(([name, list]) => (
              <div key={name || "mine"}>
                {name && <h3 className="mb-2 font-medium">{name}</h3>}
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                  {list.map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => onOpen(a.id)} className="flex w-full flex-wrap items-center gap-3 p-3 text-start hover:bg-muted focus-visible:outline-2">
                        <span className="w-40 shrink-0 text-sm font-medium">
                          {days > 1 && inZone(a.startUtc, tz, { weekday: "short", month: "short", day: "numeric" }) + " "}
                          {inZone(a.startUtc, tz, { hour: "numeric", minute: "2-digit" })}–{inZone(a.endUtc, tz, { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{a.student?.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {a.typeName} · {MODE_LABELS[a.mode] ?? a.mode}
                          </span>
                        </span>
                        {a.bookedOnBehalf && <Badge tone="neutral">{tr("bookedByStaff")}</Badge>}
                        <Badge tone={statusTone(a)}>{statusLabel(a)}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface MemberHit {
  userId?: string | null;
  email: string;
  name: string;
  role: string;
  studentNumber?: string | null;
}

function BookOnBehalf({ types, timeZone, counselors, onDone }: { types: ApptType[]; timeZone: string; counselors: StaffCounselor[]; onDone: (a: Appointment) => void }) {
  const tr = useCareerT("staffSchedule");
  const MODE_LABELS = useModeLabels();
  const api = useApi();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [student, setStudent] = useState<MemberHit | null>(null);
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const type = types.find((t) => t.id === typeId);
  const offering = counselors.filter((c) => c.bookable && c.typeIds.includes(typeId));
  const [counselorId, setCounselorId] = useState("");
  const [mode, setMode] = useState(type?.modes[0] ?? "");
  const today = todayIn(timeZone);
  const [from, setFrom] = useState(today);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const slotParams = new URLSearchParams({ typeId, from, to: addDays(from, 13) });
  if (counselorId) slotParams.set("counselorId", counselorId);
  if (student?.userId) slotParams.set("studentUserId", student.userId);
  const slotQuery = useFetch<SlotResponse>(typeId && student ? `/api/career/appointments/slots?${slotParams}` : null);
  const slots = slotQuery.data;
  const loading = slotQuery.loading;

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api<{ items: MemberHit[] }>(`/api/career/admin/members?q=${encodeURIComponent(q)}&pageSize=10`);
      const students = res.items.filter((m) => m.role === "Student" || m.role === "Alumni");
      setHits(students);
      if (students.length === 0) setError(tr("noStudentsMatchThatSearch"));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const book = async () => {
    if (!student || !slot) return;
    setBusy(true);
    setError(null);
    try {
      const a = await api<Appointment>("/api/career/appointments/book", {
        method: "POST",
        json: { studentUserId: student.userId, typeId, counselorUserId: counselorId || null, startUtc: slot.startUtc, mode, answers },
      });
      onDone(a);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const names = Object.fromEntries(counselors.map((c) => [c.userId, c.name]));
  return (
    <Card title={tr("bookForAStudent")}>
      <p className="mb-3 text-sm text-muted-foreground">{tr("staffBookingsSkipTheMinimum")}</p>
      <ErrorBanner error={error || slotQuery.error} />
      {!student ? (
        <div className="space-y-3">
          <form onSubmit={search} className="flex flex-wrap items-end gap-2">
            <div className="min-w-60 flex-1">
              <Field label={tr("findAStudentNameOr")}>{(p) => <input {...p} required minLength={2} value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
            </div>
            <Button type="submit" variant="secondary">
              {tr("search")}
            </Button>
          </form>
          {hits.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {hits.map((h) => (
                <li key={h.email} className="flex items-center justify-between gap-2 p-2 text-sm">
                  <span>
                    {h.name} <span className="text-muted-foreground">({h.email})</span>
                  </span>
                  {h.userId ? (
                    <Button type="button" variant="secondary" onClick={() => setStudent(h)}>
                      {tr("choose")}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{tr("hasntSignedInYet")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm">
            {tr.rich("studentNameEmail", { strong: (chunks) => <strong>{chunks}</strong>, name: student.name, email: student.email })}{" "}
            <button type="button" className="underline" onClick={() => setStudent(null)}>
              {tr("change")}
            </button>
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={tr("appointmentType")}>
              {(p) => (
                <select
                  {...p}
                  value={typeId}
                  onChange={(e) => {
                    const t = types.find((x) => x.id === e.target.value);
                    setTypeId(e.target.value);
                    setMode(t?.modes[0] ?? "");
                    setSlot(null);
                    setAnswers({});
                  }}
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {tr("nameDurationMinutesMin", { name: t.name, durationMinutes: t.durationMinutes })}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={tr("counselor")}>
              {(p) => (
                <select
                  {...p}
                  value={counselorId}
                  onChange={(e) => {
                    setCounselorId(e.target.value);
                    setSlot(null);
                  }}
                >
                  <option value="">{tr("anyAvailable")}</option>
                  {offering.map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={tr("meeting")}>
              {(p) => (
                <select {...p} value={mode} onChange={(e) => setMode(e.target.value)}>
                  {(type?.modes ?? []).map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABELS[m] ?? m}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <SlotPicker data={slots} loading={loading} from={from} minFrom={today} onFrom={setFrom} value={slot} onChange={setSlot} counselorNames={names} />
          {slot && type && <IntakeFields questions={type.intakeQuestions} answers={answers} onChange={setAnswers} />}
          <Button type="button" disabled={!slot} busy={busy} onClick={book}>
            {tr("bookAppointment")}
          </Button>
        </div>
      )}
    </Card>
  );
}
