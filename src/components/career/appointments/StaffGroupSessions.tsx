"use client";

/**
 * H14: career-center group sessions. Session types (career admins), sessions and weekly series, the roster with attendance,
 * the waitlist, session notes, per-student notes (C3 rules) and follow-up tasks.
 */

import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, ScrollArea, SuccessBanner, formatDate, useCareerFormat, useCareerT, useLoad } from "@/components/career/ui";
import { MODE_LABELS_KEYS, addDays, inZone, todayIn, useModeLabels, whenText } from "./shared";
import { useCounselors } from "./StaffSchedule";
import {
  DEGREE_LEVEL_KEYS,
  GROUP_KIND_KEYS,
  type GroupEligibility,
  type GroupSession,
  type GroupType,
  EligibilitySummary,
  MeetingSourceNote,
  Prose,
  SeatsBadge,
  SeriesNote,
  hostNames,
  useDegreeLevelLabels,
  useGroupKindLabels,
} from "./groupShared";

interface TypesResponse {
  timeZone: string;
  kinds: string[];
  types: GroupType[];
}

interface Cohort {
  id: string;
  name: string;
  programName?: string | null;
}

function useGroupTypes() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  return useLoad(() => api<TypesResponse>("/api/career/appointments/group/types"), [api, schoolId]);
}

function useCohorts() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  return useLoad(() => api<Cohort[]>("/api/career/appointments/group/cohorts"), [api, schoolId]);
}

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** Eligibility editor: majors and class years as comma-separated lists, degree levels and cohorts as checkboxes. */
function EligibilityFields({ value, onChange, cohorts, idPrefix }: { value: GroupEligibility; onChange: (e: GroupEligibility) => void; cohorts: Cohort[]; idPrefix: string }) {
  const t = useCareerT("staffGroupSessions");
  const DEGREES = useDegreeLevelLabels();
  const [majors, setMajors] = useState((value.majors ?? []).join(", "));
  const [years, setYears] = useState((value.classYears ?? []).join(", "));
  const toggle = (list: string[] | undefined, item: string, on: boolean) => (on ? [...new Set([...(list ?? []), item])] : (list ?? []).filter((x) => x !== item));
  return (
    <fieldset className="space-y-3 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium">{t("whoCanRegister")}</legend>
      <p className="text-xs text-muted-foreground">{t("whoCanRegisterHelp")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("majors")} hint={t("majorsHint")}>
          {(p) => (
            <input
              {...p}
              value={majors}
              onChange={(e) => {
                setMajors(e.target.value);
                onChange({ ...value, majors: splitList(e.target.value) });
              }}
            />
          )}
        </Field>
        <Field label={t("classYears")} hint={t("classYearsHint")}>
          {(p) => (
            <input
              {...p}
              inputMode="numeric"
              value={years}
              onChange={(e) => {
                setYears(e.target.value);
                onChange({ ...value, classYears: splitList(e.target.value).map(Number).filter((n) => Number.isInteger(n)) });
              }}
            />
          )}
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t("degreeLevels")}</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {DEGREE_LEVEL_KEYS.map((d) => (
            <label key={d} htmlFor={`${idPrefix}-deg-${d}`} className="flex items-center gap-1">
              <input id={`${idPrefix}-deg-${d}`} type="checkbox" checked={(value.degreeLevels ?? []).includes(d)} onChange={(e) => onChange({ ...value, degreeLevels: toggle(value.degreeLevels, d, e.target.checked) })} />
              {DEGREES[d]}
            </label>
          ))}
        </div>
      </fieldset>
      {cohorts.length > 0 && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium">{t("cohorts")}</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            {cohorts.map((c) => (
              <label key={c.id} htmlFor={`${idPrefix}-co-${c.id}`} className="flex items-center gap-1">
                <input id={`${idPrefix}-co-${c.id}`} type="checkbox" checked={(value.cohortIds ?? []).includes(c.id)} onChange={(e) => onChange({ ...value, cohortIds: toggle(value.cohortIds, c.id, e.target.checked) })} />
                <bdi>{c.name}</bdi>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </fieldset>
  );
}

// ------------------------------------------------------------------ list

export function StaffGroupSessions({ isAdmin, onOpen }: { isAdmin: boolean; onOpen: (id: string) => void }) {
  const t = useCareerT("staffGroupSessions");
  const fmt = useCareerFormat();
  const MODE_LABELS = useModeLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const types = useGroupTypes();
  const tz = types.data?.timeZone ?? "UTC";
  const [from, setFrom] = useState<string | null>(null);
  const [scope, setScope] = useState<"mine" | "all">("all");
  const [showCancelled, setShowCancelled] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const start = from ?? todayIn(tz);
  const sessions = useLoad(
    () =>
      types.data
        ? api<{ timeZone: string; sessions: GroupSession[] }>(`/api/career/appointments/group/sessions?from=${start}&to=${addDays(start, 59)}&mine=${scope === "mine"}&includeCancelled=${showCancelled}`)
        : Promise.resolve(null),
    [api, schoolId, start, scope, showCancelled, types.data],
  );
  const activeTypes = (types.data?.types ?? []).filter((x) => x.active);

  return (
    <div className="space-y-4">
      <SuccessBanner message={message} />
      {warnings.length > 0 && (
        <div role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">{t("calendarWarnings")}</p>
          <ul className="list-disc ps-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("from")}>{(p) => <input {...p} type="date" value={start} onChange={(e) => e.target.value && setFrom(e.target.value)} />}</Field>
          <Field label={t("show")}>
            {(p) => (
              <select {...p} value={scope} onChange={(e) => setScope(e.target.value as "mine" | "all")}>
                <option value="all">{t("allSessions")}</option>
                <option value="mine">{t("sessionsIHost")}</option>
              </select>
            )}
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />{" "}{t("includeCancelled")}
          </label>
          <Button type="button" className="ms-auto" onClick={() => setCreating((c) => !c)} aria-expanded={creating} disabled={activeTypes.length === 0}>
            {t("newSession")}
          </Button>
        </div>
        {types.data && activeTypes.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{isAdmin ? t("addATypeFirst") : t("askAdminForType")}</p>}
      </Card>

      {creating && types.data && (
        <CreateSession
          types={activeTypes}
          timeZone={tz}
          onDone={(created, w) => {
            setCreating(false);
            setWarnings(w);
            setMessage(created.length === 1 ? t("sessionCreated", { title: created[0].title }) : t("seriesCreated", { title: created[0].title, count: created.length }));
            sessions.reload();
          }}
        />
      )}

      <section aria-labelledby="group-list-h" aria-live="polite">
        {/* The date uses the browser's locale, which can differ from the server render (as in StaffSchedule) */}
        <h2 id="group-list-h" className="mb-3 text-lg font-semibold" suppressHydrationWarning>
          {t("sessionsFrom", { from: new Date(`${start}T12:00:00Z`).toLocaleDateString(fmt.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) })}{" "}
          <span className="text-sm font-normal text-muted-foreground">({tz})</span>
        </h2>
        <ErrorBanner error={sessions.error || types.error} onRetry={sessions.reload} />
        {sessions.loading || types.loading ? (
          <Loading />
        ) : !sessions.data?.sessions.length ? (
          <EmptyState title={t("noSessions")}>{t("noSessionsHint")}</EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {sessions.data.sessions.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onOpen(s.id)} className="flex w-full flex-wrap items-center gap-3 p-3 text-start hover:bg-muted focus-visible:outline-2">
                  <span className="w-44 shrink-0 text-sm font-medium">
                    {inZone(s.startUtc, s.timeZone, { weekday: "short", day: "numeric", month: "short" })}{" "}
                    {inZone(s.startUtc, s.timeZone, { hour: "numeric", minute: "2-digit" })}–{inZone(s.endUtc, s.timeZone, { hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {hostNames(s, fmt.locale)} · {MODE_LABELS[s.mode] ?? s.mode} · {t("registeredOfCapacity", { registered: s.registered, capacity: s.capacity })}
                      {s.waitlisted > 0 ? ` · ${t("onWaitlist", { count: s.waitlisted })}` : ""}
                    </span>
                    <SeriesNote s={s} />
                  </span>
                  <SeatsBadge s={s} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <GroupTypesPanel isAdmin={isAdmin} types={types.data?.types ?? []} onSaved={types.reload} />
    </div>
  );
}

// ------------------------------------------------------------------ create

function CreateSession({ types, timeZone, onDone }: { types: GroupType[]; timeZone: string; onDone: (sessions: GroupSession[], warnings: string[]) => void }) {
  const t = useCareerT("staffGroupSessions");
  const MODE_LABELS = useModeLabels();
  const api = useApi();
  const counselors = useCounselors();
  const cohorts = useCohorts();
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const type = types.find((x) => x.id === typeId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIn(timeZone, 7));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState<number>(type?.durationMinutes ?? 60);
  const [capacity, setCapacity] = useState<number>(type?.capacity ?? 20);
  const [mode, setMode] = useState(type?.mode ?? "InPerson");
  const [location, setLocation] = useState(type?.location ?? "");
  const [hosts, setHosts] = useState<string[]>([]);
  const [eligibility, setEligibility] = useState<GroupEligibility>(type?.eligibility ?? {});
  const [repeat, setRepeat] = useState(false);
  const [occurrences, setOccurrences] = useState(6);
  const [intervalWeeks, setIntervalWeeks] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const me = counselors.data?.find((c) => c.isMe);
  const chosenHosts = hosts.length ? hosts : me ? [me.userId] : [];

  const chooseType = (id: string) => {
    const x = types.find((y) => y.id === id);
    setTypeId(id);
    if (x) {
      setDuration(x.durationMinutes);
      setCapacity(x.capacity);
      setMode(x.mode);
      setLocation(x.location ?? "");
      setEligibility(x.eligibility ?? {});
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ sessions: GroupSession[]; warnings: string[] }>("/api/career/appointments/group/sessions", {
        method: "POST",
        json: {
          typeId, title: title || null, description: description || null, startLocal: `${date}T${time}`, durationMinutes: duration, capacity, mode,
          location: mode === "InPerson" ? location : null, hostUserIds: chosenHosts, eligibility,
          recurrence: repeat ? { frequency: "Weekly", intervalWeeks, occurrences } : null,
        },
      });
      onDone(res.sessions, res.warnings);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t("newSession")}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner error={error || counselors.error || cohorts.error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("sessionType")}>
            {(p) => (
              <select {...p} value={typeId} onChange={(e) => chooseType(e.target.value)}>
                {types.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("title")} hint={t("titleHint")}>
            {(p) => <input {...p} maxLength={200} value={title} placeholder={type?.name} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
        </div>
        <Field label={t("description")}>{(p) => <textarea {...p} rows={2} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label={t("date")} hint={t("schoolTime", { tz: timeZone })}>
            {(p) => <input {...p} type="date" required value={date} min={todayIn(timeZone)} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label={t("startTime")}>{(p) => <input {...p} type="time" required value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          <Field label={t("lengthMinutes")}>{(p) => <input {...p} type="number" min={15} max={480} step={5} required value={duration} onChange={(e) => setDuration(Number(e.target.value))} />}</Field>
          <Field label={t("capacity")}>{(p) => <input {...p} type="number" min={1} max={1000} required value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />}</Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("meeting")}>
            {(p) => (
              <select {...p} value={mode} onChange={(e) => setMode(e.target.value)}>
                {MODE_LABELS_KEYS.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {mode === "InPerson" ? (
            <Field label={t("location")}>{(p) => <input {...p} maxLength={300} value={location} onChange={(e) => setLocation(e.target.value)} />}</Field>
          ) : mode === "Video" ? (
            <p className="self-end text-xs text-muted-foreground">{t("videoLinkHelp")}</p>
          ) : null}
        </div>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">{t("hosts")}</legend>
          <p className="text-xs text-muted-foreground">{t("hostsHelp")}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {(counselors.data ?? [])
              .filter((c) => c.role === "Counselor" || c.role === "CareerAdmin")
              .map((c) => (
                <label key={c.userId} htmlFor={`host-${c.userId}`} className="flex items-center gap-1">
                  <input
                    id={`host-${c.userId}`}
                    type="checkbox"
                    checked={chosenHosts.includes(c.userId)}
                    onChange={(e) => setHosts(e.target.checked ? [...chosenHosts.filter((x) => x !== c.userId), c.userId] : chosenHosts.filter((x) => x !== c.userId))}
                  />
                  <bdi>{c.name}</bdi>
                  {chosenHosts[0] === c.userId && <Badge tone="info">{t("lead")}</Badge>}
                </label>
              ))}
          </div>
        </fieldset>
        <EligibilityFields key={typeId} value={eligibility} onChange={setEligibility} cohorts={cohorts.data ?? []} idPrefix="new" />
        <fieldset className="space-y-2">
          <legend className="sr-only">{t("repeat")}</legend>
          <label htmlFor="grp-repeat" className="flex items-center gap-2 text-sm">
            <input id="grp-repeat" type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            {t("repeatWeekly")}
          </label>
          {repeat && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("everyNWeeks")}>{(p) => <input {...p} type="number" min={1} max={4} value={intervalWeeks} onChange={(e) => setIntervalWeeks(Number(e.target.value))} />}</Field>
              <Field label={t("numberOfSessions")} hint={t("numberOfSessionsHint")}>
                {(p) => <input {...p} type="number" min={2} max={26} value={occurrences} onChange={(e) => setOccurrences(Number(e.target.value))} />}
              </Field>
            </div>
          )}
        </fieldset>
        <Button type="submit" busy={busy}>
          {repeat ? t("createSeries", { count: occurrences }) : t("createSession")}
        </Button>
      </form>
    </Card>
  );
}

// ------------------------------------------------------------------ types

function GroupTypesPanel({ isAdmin, types, onSaved }: { isAdmin: boolean; types: GroupType[]; onSaved: () => void }) {
  const t = useCareerT("staffGroupSessions");
  const KINDS = useGroupKindLabels();
  const MODE_LABELS = useModeLabels();
  const [editing, setEditing] = useState<GroupType | "new" | null>(null);
  return (
    <Card title={t("sessionTypes")} actions={isAdmin ? <Button type="button" variant="secondary" onClick={() => setEditing("new")}>{t("addType")}</Button> : undefined}>
      {!isAdmin && <p className="mb-2 text-xs text-muted-foreground">{t("onlyAdminsEditTypes")}</p>}
      {types.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noTypesYet")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {types.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{x.name}</span>{" "}
                <span className="text-muted-foreground">
                  {t("typeSummary", { kind: KINDS[x.kind] ?? x.kind, minutes: x.durationMinutes, capacity: x.capacity, mode: MODE_LABELS[x.mode] ?? x.mode })}
                </span>
              </span>
              {!x.active && <Badge>{t("inactive")}</Badge>}
              {isAdmin && (
                <Button type="button" variant="ghost" onClick={() => setEditing(x)} aria-label={t("editTypeName", { name: x.name })}>
                  {t("edit")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <TypeForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          onDone={() => {
            setEditing(null);
            onSaved();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </Card>
  );
}

function TypeForm({ initial, onDone, onCancel }: { initial: GroupType | null; onDone: () => void; onCancel: () => void }) {
  const t = useCareerT("staffGroupSessions");
  const KINDS = useGroupKindLabels();
  const MODE_LABELS = useModeLabels();
  const api = useApi();
  const cohorts = useCohorts();
  const [f, setF] = useState<Omit<GroupType, "id">>(
    initial ?? { name: "", description: "", kind: "Workshop", durationMinutes: 60, capacity: 20, mode: "InPerson", location: "", allowStudents: true, allowAlumni: true, eligibility: {}, minLeadMinutes: 60, maxLeadDays: 90, cancelCutoffMinutes: 120, promotionCutoffMinutes: 120, active: true, sortOrder: 0 },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(initial ? `/api/career/appointments/group/types/${initial.id}` : "/api/career/appointments/group/types", { method: initial ? "PUT" : "POST", json: f });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="mt-4 space-y-3 rounded-lg border border-border p-3">
      <h3 className="font-semibold">{initial ? t("editType") : t("newType")}</h3>
      <ErrorBanner error={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("name")}>{(p) => <input {...p} required maxLength={120} value={f.name} onChange={(e) => set("name", e.target.value)} />}</Field>
        <Field label={t("kind")}>
          {(p) => (
            <select {...p} value={f.kind} onChange={(e) => set("kind", e.target.value)}>
              {GROUP_KIND_KEYS.map((k) => (
                <option key={k} value={k}>
                  {KINDS[k]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label={t("description")}>{(p) => <textarea {...p} rows={2} maxLength={4000} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} />}</Field>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label={t("lengthMinutes")}>{(p) => <input {...p} type="number" min={15} max={480} value={f.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))} />}</Field>
        <Field label={t("capacity")}>{(p) => <input {...p} type="number" min={1} max={1000} value={f.capacity} onChange={(e) => set("capacity", Number(e.target.value))} />}</Field>
        <Field label={t("meeting")}>
          {(p) => (
            <select {...p} value={f.mode} onChange={(e) => set("mode", e.target.value)}>
              {MODE_LABELS_KEYS.map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m]}
                </option>
              ))}
            </select>
          )}
        </Field>
        {f.mode === "InPerson" && <Field label={t("location")}>{(p) => <input {...p} maxLength={300} value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} />}</Field>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("registrationClosesMinutes")} hint={t("sameAsAppointments")}>
          {(p) => <input {...p} type="number" min={0} max={43200} value={f.minLeadMinutes} onChange={(e) => set("minLeadMinutes", Number(e.target.value))} />}
        </Field>
        <Field label={t("registrationOpensDays")}>{(p) => <input {...p} type="number" min={1} max={365} value={f.maxLeadDays} onChange={(e) => set("maxLeadDays", Number(e.target.value))} />}</Field>
        <Field label={t("cancelCutoffMinutes")}>{(p) => <input {...p} type="number" min={0} max={10080} value={f.cancelCutoffMinutes} onChange={(e) => set("cancelCutoffMinutes", Number(e.target.value))} />}</Field>
        <Field label={t("promotionCutoffMinutes")} hint={t("promotionCutoffHint")}>
          {(p) => <input {...p} type="number" min={0} max={10080} value={f.promotionCutoffMinutes} onChange={(e) => set("promotionCutoffMinutes", Number(e.target.value))} />}
        </Field>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label htmlFor="gt-students" className="flex items-center gap-1">
          <input id="gt-students" type="checkbox" checked={f.allowStudents} onChange={(e) => set("allowStudents", e.target.checked)} />
          {t("openToStudents")}
        </label>
        <label htmlFor="gt-alumni" className="flex items-center gap-1">
          <input id="gt-alumni" type="checkbox" checked={f.allowAlumni} onChange={(e) => set("allowAlumni", e.target.checked)} />
          {t("openToAlumni")}
        </label>
        <label htmlFor="gt-active" className="flex items-center gap-1">
          <input id="gt-active" type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
          {t("active")}
        </label>
      </div>
      <EligibilityFields value={f.eligibility} onChange={(e) => set("eligibility", e)} cohorts={cohorts.data ?? []} idPrefix="type" />
      <div className="flex gap-2">
        <Button type="submit" busy={busy}>
          {t("save")}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ detail

interface RosterRow {
  id: string;
  status: string;
  queueNumber: number;
  waitlistPosition?: number | null;
  attendance?: string | null;
  student: { userId: string; name: string; email?: string | null; studentNumber?: string | null };
  registeredAt?: string | null;
  waitlistedAt?: string | null;
  promotedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  addedByStaff: boolean;
  addedBy?: { userId: string; name: string } | null;
  eligibilityOverridden?: boolean;
  overCapacity?: boolean;
  overCapacityReason?: string | null;
  /** Why the last promotion passed this waitlisted student over ("TimeConflict" or "NotEligible") */
  promotionSkippedReason?: string | null;
  promotionSkippedAt?: string | null;
}

interface NoteRow {
  id: string;
  visibility: string;
  body: string;
  createdAt: string;
  author: string;
  canEdit: boolean;
  studentUserId?: string;
}

interface DetailResponse {
  session: GroupSession;
  canManage: boolean;
  registered: RosterRow[];
  waitlist: RosterRow[];
  cancelled: RosterRow[];
  sessionNotes: NoteRow[];
  studentNotes: NoteRow[];
  tasks: { id: string; studentUserId: string; title: string; dueDate?: string | null; status: string; assigneeType: string; studentName?: string | null }[];
}

export function GroupSessionDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useCareerT("staffGroupSessions");
  const fmt = useCareerFormat();
  const MODE_LABELS = useModeLabels();
  const KINDS = useGroupKindLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const detail = useLoad(() => api<DetailResponse>(`/api/career/appointments/group/sessions/${id}`), [api, schoolId, id]);
  const cohorts = useCohorts();
  const [panel, setPanel] = useState<"none" | "edit" | "cancel" | "add">("none");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [now] = useState(() => Date.now());

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (detail.loading && !detail.data) return <Loading />;
  if (!detail.data) return <ErrorBanner error={detail.error} onRetry={detail.reload} />;
  const d = detail.data;
  const s = d.session;
  const cohortNames = Object.fromEntries((cohorts.data ?? []).map((c) => [c.id, c.name]));
  const started = Date.parse(s.startUtc) <= now + 15 * 60000;
  const attendanceOf = (r: RosterRow) => marks[r.id] ?? r.attendance ?? "";
  const toggle = (p: typeof panel) => setPanel((cur) => (cur === p ? "none" : p));

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" onClick={onBack}>
        <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden /> {t("backToSessions")}
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1 className="text-2xl font-semibold">{s.title}</h1>
        <SeatsBadge s={s} />
      </div>
      <SuccessBanner message={message} />
      <ErrorBanner error={error} />
      <Card>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">{t("when")}</dt>
            <dd>{whenText(s, s.timeZone)}</dd>
            <dd>
              <SeriesNote s={s} />
            </dd>
          </div>
          <div>
            <dt className="font-medium">{t("typeAndHosts")}</dt>
            <dd>
              {KINDS[s.kind] ?? s.kind} · {s.typeName}
            </dd>
            <dd>{hostNames(s, fmt.locale)}</dd>
          </div>
          <div>
            <dt className="font-medium">{t("meeting")}</dt>
            <dd>
              {MODE_LABELS[s.mode] ?? s.mode}
              {s.mode === "InPerson" && s.location ? ` · ${s.location}` : ""}
            </dd>
            {s.mode === "Video" && s.meetingUrl && (
              <dd>
                <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer" className="break-all underline" dir="ltr">
                  {s.meetingUrl}
                </a>
              </dd>
            )}
            <dd>
              <MeetingSourceNote x={s} />
            </dd>
          </div>
          <div>
            <dt className="font-medium">{t("registration")}</dt>
            <dd>{t("registeredOfCapacity", { registered: s.registered, capacity: s.capacity })}</dd>
            <dd className="text-xs text-muted-foreground">
              {t("windowText", { opens: formatDate(s.registrationOpensUtc, true), closes: formatDate(s.registrationClosesUtc, true), cancel: formatDate(s.cancelCutoffUtc, true) })}
            </dd>
            <dd className="text-xs text-muted-foreground">
              {s.waitlistOpen ? t("waitlistMovesUntil", { date: formatDate(s.waitlistClosesUtc, true) }) : t("waitlistClosedOn", { date: formatDate(s.waitlistClosesUtc, true) })}
            </dd>
            <dd>
              <EligibilitySummary e={s.eligibility} cohortNames={cohortNames} />
            </dd>
          </div>
        </dl>
        {s.description && (
          <div className="mt-3">
            <Prose>{s.description}</Prose>
          </div>
        )}
        {s.status === "Cancelled" && <p className="mt-2 text-sm text-muted-foreground">{t("sessionCancelledReason", { reason: s.cancelReason ?? "—" })}</p>}
        {d.canManage && s.status === "Scheduled" && (
          <div className="mt-4 flex flex-wrap gap-2">
            {!started && (
              <Button type="button" variant="secondary" aria-expanded={panel === "edit"} onClick={() => toggle("edit")}>
                {t("editSession")}
              </Button>
            )}
            <Button type="button" variant="secondary" aria-expanded={panel === "add"} onClick={() => toggle("add")}>
              {t("addStudent")}
            </Button>
            <Button type="button" variant="secondary" aria-expanded={panel === "cancel"} onClick={() => toggle("cancel")}>
              {t("cancelSession")}
            </Button>
          </div>
        )}
        {!d.canManage && <p className="mt-3 text-xs text-muted-foreground">{t("readOnlyNotHost")}</p>}
        {panel === "edit" && (
          <EditSession
            s={s}
            cohorts={cohorts.data ?? []}
            onDone={(text) => {
              setPanel("none");
              setMessage(text);
              detail.reload();
            }}
          />
        )}
        {panel === "cancel" && (
          <CancelSession
            s={s}
            onDone={(text) => {
              setPanel("none");
              setMessage(text);
              detail.reload();
            }}
          />
        )}
        {panel === "add" && (
          <AddStudent
            sessionId={s.id}
            onDone={(text) => {
              setPanel("none");
              setMessage(text);
              detail.reload();
            }}
          />
        )}
      </Card>

      <Card title={t("rosterCount", { count: d.registered.length })}>
        {d.registered.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("nobodyRegistered")}</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("attendance", async () => {
                await api(`/api/career/appointments/group/sessions/${s.id}/attendance`, {
                  method: "POST",
                  json: { marks: d.registered.map((r) => ({ registrationId: r.id, attendance: attendanceOf(r) || null })) },
                });
                setMarks({});
                setMessage(t("attendanceSaved"));
                detail.reload();
              });
            }}
          >
            <ScrollArea label={t("roster")}>
              <table className="w-full text-sm [&_th]:text-start">
                <caption className="sr-only">{t("roster")}</caption>
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pe-3">{t("student")}</th>
                    <th scope="col" className="py-2 pe-3">{t("registeredOn")}</th>
                    <th scope="col" className="py-2 pe-3">{t("attendance")}</th>
                    {d.canManage && <th scope="col" className="py-2">{t("actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {d.registered.map((r) => (
                    <RosterLine
                      key={r.id}
                      r={r}
                      canManage={d.canManage}
                      started={started}
                      attendance={attendanceOf(r)}
                      onAttendance={(v) => setMarks((m) => ({ ...m, [r.id]: v }))}
                      notes={d.studentNotes.filter((n) => n.studentUserId === r.student.userId)}
                      onChanged={(text) => {
                        setMessage(text);
                        detail.reload();
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </ScrollArea>
            {d.canManage && (
              <div className="mt-3 flex items-center gap-3">
                <Button type="submit" busy={busy === "attendance"} disabled={!started}>
                  {t("saveAttendance")}
                </Button>
                {!started && <span className="text-xs text-muted-foreground">{t("attendanceOnceStarted")}</span>}
              </div>
            )}
          </form>
        )}
      </Card>

      <Card title={t("waitlistCount", { count: d.waitlist.length })}>
        {d.waitlist.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("waitlistEmpty")}</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {d.waitlist.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <Badge tone="warn">{t("positionN", { position: r.waitlistPosition ?? 0 })}</Badge>
                <bdi className="font-medium">{r.student.name}</bdi>
                <span className="text-muted-foreground">{r.student.email}</span>
                <span className="text-xs text-muted-foreground">{t("joinedOn", { date: formatDate(r.waitlistedAt, true) })}</span>
                {r.promotionSkippedReason && (
                  <span className="flex flex-wrap items-center gap-1">
                    <Badge tone="bad">{r.promotionSkippedReason === "TimeConflict" ? t("skippedTimeConflict") : t("skippedNotEligible")}</Badge>
                    <span className="text-xs text-muted-foreground">{t("skippedOn", { date: formatDate(r.promotionSkippedAt, true) })}</span>
                  </span>
                )}
                {d.canManage && <RemoveButton r={r} onDone={(text) => { setMessage(text); detail.reload(); }} />}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{t("waitlistHelp")}</p>
      </Card>

      <SessionNotes
        sessionId={s.id}
        notes={d.sessionNotes}
        canManage={d.canManage}
        onChanged={(text) => {
          setMessage(text);
          detail.reload();
        }}
      />

      {d.tasks.length > 0 && (
        <Card title={t("followUpTasks")}>
          <ul className="space-y-1 text-sm">
            {d.tasks.map((x) => (
              <li key={x.id}>
                <bdi className="font-medium">{x.studentName}</bdi>: {x.title} {x.dueDate && <span className="text-muted-foreground">{t("due", { date: formatDate(x.dueDate) })}</span>}{" "}
                <Badge tone={x.status === "Done" ? "good" : "neutral"}>{x.status === "Done" ? t("done") : x.assigneeType === "Student" ? t("studentTask") : t("counselorTask")}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {d.cancelled.length > 0 && (
        <details className="rounded-xl border border-border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">{t("cancelledRegistrations", { count: d.cancelled.length })}</summary>
          <ul className="mt-2 space-y-1">
            {d.cancelled.map((r) => (
              <li key={r.id}>
                <bdi>{r.student.name}</bdi> · {formatDate(r.cancelledAt, true)}
                {r.cancelReason ? ` · ${r.cancelReason}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function RosterLine({ r, canManage, started, attendance, onAttendance, notes, onChanged }: {
  r: RosterRow; canManage: boolean; started: boolean; attendance: string; onAttendance: (v: string) => void; notes: NoteRow[]; onChanged: (text: string) => void;
}) {
  const t = useCareerT("staffGroupSessions");
  const [open, setOpen] = useState<"none" | "note" | "task">("none");
  return (
    <>
      <tr className="border-b border-border align-top">
        <td className="py-2 pe-3">
          <bdi className="font-medium">{r.student.name}</bdi>
          <span className="block text-xs text-muted-foreground">
            {r.student.email}
            {r.student.studentNumber ? ` · ${r.student.studentNumber}` : ""}
          </span>
          {r.promotedAt && <span className="block text-xs text-muted-foreground">{t("promotedFromWaitlist")}</span>}
          {r.overCapacity && (
            <span className="mt-1 block">
              <Badge tone="warn">{t("overCapacityBy", { name: r.addedBy?.name ?? "—", reason: r.overCapacityReason ?? "—" })}</Badge>
            </span>
          )}
          {r.eligibilityOverridden && <span className="block text-xs text-muted-foreground">{t("eligibilityOverridden")}</span>}
          {notes.length > 0 && (
            <ul className="mt-1 space-y-1">
              {notes.map((n) => (
                <li key={n.id} className="rounded bg-muted p-1 text-xs">
                  <Badge tone={n.visibility === "Shared" ? "info" : "neutral"}>{n.visibility === "Shared" ? t("sharedWithStudent") : t("private")}</Badge> <span className="whitespace-pre-wrap">{n.body}</span>
                  <span className="block text-muted-foreground">
                    {n.author} · {formatDate(n.createdAt, true)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </td>
        <td className="py-2 pe-3 text-xs">{formatDate(r.registeredAt, true)}</td>
        <td className="py-2 pe-3">
          {canManage ? (
            <select
              aria-label={t("attendanceFor", { name: r.student.name })}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              value={attendance}
              disabled={!started}
              onChange={(e) => onAttendance(e.target.value)}
            >
              <option value="">{t("notRecorded")}</option>
              <option value="Present">{t("present")}</option>
              <option value="NoShow">{t("noShow")}</option>
            </select>
          ) : (
            <span>{attendance === "Present" ? t("present") : attendance === "NoShow" ? t("noShow") : t("notRecorded")}</span>
          )}
        </td>
        {canManage && (
          <td className="py-2">
            <div className="flex flex-wrap gap-1">
              <Button type="button" variant="ghost" aria-expanded={open === "note"} onClick={() => setOpen((o) => (o === "note" ? "none" : "note"))} aria-label={t("addNoteFor", { name: r.student.name })}>
                {t("note")}
              </Button>
              <Button type="button" variant="ghost" aria-expanded={open === "task"} onClick={() => setOpen((o) => (o === "task" ? "none" : "task"))} aria-label={t("addTaskFor", { name: r.student.name })}>
                {t("task")}
              </Button>
              <RemoveButton r={r} onDone={onChanged} />
            </div>
          </td>
        )}
      </tr>
      {open !== "none" && (
        <tr className="border-b border-border">
          <td colSpan={4} className="py-2">
            {open === "note" ? (
              <StudentNoteForm regId={r.id} name={r.student.name} onDone={(text) => { setOpen("none"); onChanged(text); }} />
            ) : (
              <TaskForm regId={r.id} name={r.student.name} onDone={(text) => { setOpen("none"); onChanged(text); }} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function RemoveButton({ r, onDone }: { r: RosterRow; onDone: (text: string) => void }) {
  const t = useCareerT("staffGroupSessions");
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        busy={busy}
        aria-label={t("removeName", { name: r.student.name })}
        onClick={async () => {
          if (!window.confirm(t("removeConfirm", { name: r.student.name }))) return;
          setBusy(true);
          setError(null);
          try {
            await api(`/api/career/appointments/group/registrations/${r.id}/remove`, { method: "POST", json: {} });
            onDone(t("removedName", { name: r.student.name }));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("remove")}
      </Button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </>
  );
}

function StudentNoteForm({ regId, name, onDone }: { regId: string; name: string; onDone: (text: string) => void }) {
  const t = useCareerT("staffGroupSessions");
  const api = useApi();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("Private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api(`/api/career/appointments/group/registrations/${regId}/notes`, { method: "POST", json: { body, visibility } });
          onDone(t("noteSaved"));
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ErrorBanner error={error} />
      <Field label={t("noteAboutName", { name })}>{(p) => <textarea {...p} rows={2} required maxLength={10000} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="sr-only">{t("visibility")}</legend>
        <label htmlFor={`v-p-${regId}`} className="flex items-center gap-1">
          <input id={`v-p-${regId}`} type="radio" name={`v-${regId}`} checked={visibility === "Private"} onChange={() => setVisibility("Private")} />
          {t("privateHelp")}
        </label>
        <label htmlFor={`v-s-${regId}`} className="flex items-center gap-1">
          <input id={`v-s-${regId}`} type="radio" name={`v-${regId}`} checked={visibility === "Shared"} onChange={() => setVisibility("Shared")} />
          {t("sharedHelp")}
        </label>
      </fieldset>
      <Button type="submit" busy={busy}>
        {t("saveNote")}
      </Button>
    </form>
  );
}

function TaskForm({ regId, name, onDone }: { regId: string; name: string; onDone: (text: string) => void }) {
  const t = useCareerT("staffGroupSessions");
  const api = useApi();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("Student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-2 sm:grid-cols-4 sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api(`/api/career/appointments/group/registrations/${regId}/tasks`, { method: "POST", json: { title, dueDate: due || null, assignee } });
          onDone(t("taskAdded"));
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="sm:col-span-4">
        <ErrorBanner error={error} />
      </div>
      <Field label={t("taskFor", { name })}>{(p) => <input {...p} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
      <Field label={t("dueDate")}>{(p) => <input {...p} type="date" value={due} onChange={(e) => setDue(e.target.value)} />}</Field>
      <Field label={t("assignee")}>
        {(p) => (
          <select {...p} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="Student">{t("studentTask")}</option>
            <option value="Counselor">{t("counselorTask")}</option>
          </select>
        )}
      </Field>
      <Button type="submit" busy={busy}>
        {t("addTask")}
      </Button>
    </form>
  );
}

function SessionNotes({ sessionId, notes, canManage, onChanged }: { sessionId: string; notes: NoteRow[]; canManage: boolean; onChanged: (text: string) => void }) {
  const t = useCareerT("staffGroupSessions");
  const api = useApi();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("Staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card title={t("sessionNotes")}>
      <ErrorBanner error={error} />
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noSessionNotes")}</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md bg-muted p-2 text-sm">
              <Badge tone={n.visibility === "Attendees" ? "info" : "neutral"}>{n.visibility === "Attendees" ? t("sharedWithAttendees") : t("staffOnly")}</Badge>
              <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
              <p className="text-xs text-muted-foreground">
                {n.author} · {formatDate(n.createdAt, true)}
              </p>
              {n.canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    if (!window.confirm(t("deleteNoteConfirm"))) return;
                    setError(null);
                    try {
                      await api(`/api/career/appointments/group/session-notes/${n.id}`, { method: "DELETE" });
                      onChanged(t("noteDeleted"));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {t("delete")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api(`/api/career/appointments/group/sessions/${sessionId}/notes`, { method: "POST", json: { body, visibility } });
              setBody("");
              onChanged(t("noteSaved"));
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={t("addSessionNote")}>{(p) => <textarea {...p} rows={2} required maxLength={10000} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="sr-only">{t("visibility")}</legend>
            <label htmlFor="sn-staff" className="flex items-center gap-1">
              <input id="sn-staff" type="radio" name="sn-vis" checked={visibility === "Staff"} onChange={() => setVisibility("Staff")} />
              {t("staffOnlyHelp")}
            </label>
            <label htmlFor="sn-att" className="flex items-center gap-1">
              <input id="sn-att" type="radio" name="sn-vis" checked={visibility === "Attendees"} onChange={() => setVisibility("Attendees")} />
              {t("attendeesHelp")}
            </label>
          </fieldset>
          <Button type="submit" busy={busy}>
            {t("saveNote")}
          </Button>
        </form>
      )}
    </Card>
  );
}

function EditSession({ s, cohorts, onDone }: { s: GroupSession; cohorts: Cohort[]; onDone: (text: string) => void }) {
  const t = useCareerT("staffGroupSessions");
  const MODE_LABELS = useModeLabels();
  const api = useApi();
  const counselors = useCounselors();
  const inSeries = !!s.seriesId;
  const [scope, setScope] = useState<"one" | "series">("one");
  const [title, setTitle] = useState(s.title);
  const [description, setDescription] = useState(s.description ?? "");
  const [date, setDate] = useState(s.localStart.slice(0, 10));
  const [time, setTime] = useState(s.localStart.slice(11, 16));
  const [duration, setDuration] = useState(Math.round((Date.parse(s.endUtc) - Date.parse(s.startUtc)) / 60000));
  const [capacity, setCapacity] = useState(s.capacity);
  const [mode, setMode] = useState(s.mode);
  const [location, setLocation] = useState(s.location ?? "");
  const [hosts, setHosts] = useState<string[]>(s.hosts.map((h) => h.userId));
  const [eligibility, setEligibility] = useState<GroupEligibility>(s.eligibility ?? {});
  const [promotionCutoff, setPromotionCutoff] = useState(s.promotionCutoffMinutes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeChanged = `${date}T${time}` !== s.localStart;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { title, description, durationMinutes: duration, capacity, mode, location: mode === "InPerson" ? location : null, hostUserIds: hosts, eligibility, promotionCutoffMinutes: promotionCutoff };
      if (scope === "one" && timeChanged) body.startLocal = `${date}T${time}`;
      if (scope === "series" && time !== s.localStart.slice(11, 16)) body.startTime = time;
      const res = await api<{ sessions: GroupSession[] }>(`/api/career/appointments/group/sessions/${s.id}?scope=${scope}`, { method: "PUT", json: body });
      onDone(res.sessions.length > 1 ? t("seriesUpdated", { count: res.sessions.length }) : t("sessionUpdated"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-border p-3">
      <ErrorBanner error={error} />
      {inSeries && (
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 font-medium">{t("applyTo")}</legend>
          <label htmlFor="scope-one" className="flex items-center gap-1">
            <input id="scope-one" type="radio" name="edit-scope" checked={scope === "one"} onChange={() => setScope("one")} />
            {t("thisSessionOnly")}
          </label>
          <label htmlFor="scope-series" className="flex items-center gap-1">
            <input id="scope-series" type="radio" name="edit-scope" checked={scope === "series"} onChange={() => setScope("series")} />
            {t("allUpcomingInSeries")}
          </label>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("title")}>{(p) => <input {...p} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label={t("capacity")}>{(p) => <input {...p} type="number" min={1} max={1000} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />}</Field>
      </div>
      <Field label={t("description")}>{(p) => <textarea {...p} rows={2} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
      <div className="grid gap-3 sm:grid-cols-3">
        {scope === "one" && <Field label={t("date")}>{(p) => <input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>}
        <Field label={t("startTime")} hint={scope === "series" ? t("seriesTimeHint") : undefined}>
          {(p) => <input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
        </Field>
        <Field label={t("lengthMinutes")}>{(p) => <input {...p} type="number" min={15} max={480} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />}</Field>
      </div>
      <Field label={t("promotionCutoffMinutes")} hint={t("promotionCutoffHint")}>
        {(p) => <input {...p} type="number" min={0} max={10080} value={promotionCutoff} onChange={(e) => setPromotionCutoff(Number(e.target.value))} />}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("meeting")}>
          {(p) => (
            <select {...p} value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODE_LABELS_KEYS.map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m]}
                </option>
              ))}
            </select>
          )}
        </Field>
        {mode === "InPerson" && <Field label={t("location")}>{(p) => <input {...p} maxLength={300} value={location} onChange={(e) => setLocation(e.target.value)} />}</Field>}
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">{t("hosts")}</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {(counselors.data ?? [])
            .filter((c) => c.role === "Counselor" || c.role === "CareerAdmin")
            .map((c) => (
              <label key={c.userId} htmlFor={`eh-${c.userId}`} className="flex items-center gap-1">
                <input id={`eh-${c.userId}`} type="checkbox" checked={hosts.includes(c.userId)} onChange={(e) => setHosts(e.target.checked ? [...hosts, c.userId] : hosts.filter((x) => x !== c.userId))} />
                <bdi>{c.name}</bdi>
                {hosts[0] === c.userId && <Badge tone="info">{t("lead")}</Badge>}
              </label>
            ))}
        </div>
      </fieldset>
      <EligibilityFields value={eligibility} onChange={setEligibility} cohorts={cohorts} idPrefix="edit" />
      <p className="text-xs text-muted-foreground">{t("editNotifies")}</p>
      <Button type="submit" busy={busy}>
        {t("saveChanges")}
      </Button>
    </form>
  );
}

function CancelSession({ s, onDone }: { s: GroupSession; onDone: (text: string) => void }) {
  const t = useCareerT("staffGroupSessions");
  const api = useApi();
  const [scope, setScope] = useState<"one" | "series">("one");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-4 space-y-3 rounded-lg border border-border p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await api<{ sessions: GroupSession[] }>(`/api/career/appointments/group/sessions/${s.id}/cancel?scope=${scope}`, { method: "POST", json: { reason } });
          onDone(t("sessionsCancelled", { count: res.sessions.length }));
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ErrorBanner error={error} />
      {s.seriesId && (
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 font-medium">{t("cancelWhich")}</legend>
          <label htmlFor="cscope-one" className="flex items-center gap-1">
            <input id="cscope-one" type="radio" name="cancel-scope" checked={scope === "one"} onChange={() => setScope("one")} />
            {t("thisSessionOnly")}
          </label>
          <label htmlFor="cscope-series" className="flex items-center gap-1">
            <input id="cscope-series" type="radio" name="cancel-scope" checked={scope === "series"} onChange={() => setScope("series")} />
            {t("allUpcomingInSeries")}
          </label>
        </fieldset>
      )}
      <Field label={t("reasonForStudents")} hint={t("cancelNotifies")}>{(p) => <textarea {...p} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      <Button type="submit" variant="danger" busy={busy}>
        {t("cancelSession")}
      </Button>
    </form>
  );
}

function AddStudent({ sessionId, onDone }: { sessionId: string; onDone: (text: string) => void }) {
  const t = useCareerT("staffGroupSessions");
  const api = useApi();
  const [email, setEmail] = useState("");
  const [override, setOverride] = useState(false);
  const [overCapacity, setOverCapacity] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-4 space-y-3 rounded-lg border border-border p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await api<{ status: string; waitlistPosition?: number | null; overCapacity?: boolean }>(`/api/career/appointments/group/sessions/${sessionId}/registrations`, {
            method: "POST",
            json: { studentEmail: email, overrideEligibility: override, overCapacity, overCapacityReason: overCapacity ? reason : null },
          });
          onDone(r.overCapacity ? t("studentRegisteredOverCapacity") : r.status === "Registered" ? t("studentRegistered") : t("studentWaitlisted", { position: r.waitlistPosition ?? 0 }));
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ErrorBanner error={error} />
      <Field label={t("studentEmail")} hint={t("addStudentHint")}>
        {(p) => <input {...p} type="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <label htmlFor={`ovr-${sessionId}`} className="flex items-start gap-2 text-sm">
        <input id={`ovr-${sessionId}`} type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
        {t("overrideEligibility")}
      </label>
      <label htmlFor={`over-${sessionId}`} className="flex items-start gap-2 text-sm">
        <input id={`over-${sessionId}`} type="checkbox" checked={overCapacity} onChange={(e) => setOverCapacity(e.target.checked)} />
        {t("addOverCapacity")}
      </label>
      {overCapacity && (
        <Field label={t("overCapacityReason")} hint={t("overCapacityReasonHint")}>
          {(p) => <textarea {...p} rows={2} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      )}
      <Button type="submit" busy={busy}>
        {t("addStudent")}
      </Button>
    </form>
  );
}
