"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad, useCareerT } from "@/components/career/ui";
import { EmployerPicker, useEmployers } from "@/components/career/EmployerPicker";
import { TabPanel, Tabs, useDownload, whenText } from "@/components/career/appointments/shared";
import { DEGREE_LEVELS, useDegreeLevelLabels, type OcrDay, type OcrSchedule, StatusBadge, useSignupLabels, useInterviewWorkAuthLabels, useInterviewOutcomeLabels, useDaysText, useEligibilityText } from "@/components/career/interviews/shared";

type Tab = "schedules" | "request";

interface Relationship {
  instituteId: string;
  school?: string | null;
  status: string;
}

export default function EmployerInterviewsPage() {
  const tr = useCareerT("employerInterviews");
  const emp = useEmployers();
  const employerId = emp.current?.employer.id;
  const [tab, setTab] = useState<Tab>("schedules");
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <PageHeader
        title={tr("onCampusInterviews")}
        description={tr("requestInterviewDaysAtSchools")}
        actions={emp.accounts.length > 1 ? <EmployerPicker accounts={emp.accounts} current={emp.current} onSelect={emp.select} /> : undefined}
      />
      <SuccessBanner message={message} />
      {emp.loading ? (
        <Loading />
      ) : !employerId ? (
        <EmptyState title={tr("noEmployerProfileYet")}>{tr.rich("createYourCompanyProfileFirst", { link: (chunks) => <Link className="underline" href="/employer/company">{chunks}</Link> })}</EmptyState>
      ) : (
        <>
          <Tabs<Tab>
            label={tr("interviewSections")}
            value={tab}
            onChange={(t) => {
              setTab(t);
              setMessage(null);
            }}
            tabs={[
              { key: "schedules", label: tr("mySchedules") },
              { key: "request", label: tr("requestASchedule") },
            ]}
          />
          <TabPanel id={tab}>
            {tab === "schedules" && <Schedules employerId={employerId} onMessage={setMessage} />}
            {tab === "request" && (
              <RequestForm
                employerId={employerId}
                onDone={() => {
                  setMessage(tr("requestSentTheCareerCenter"));
                  setTab("schedules");
                }}
              />
            )}
          </TabPanel>
        </>
      )}
    </div>
  );
}

function Schedules({ employerId, onMessage }: { employerId: string; onMessage: (m: string) => void }) {
  const tr = useCareerT("employerInterviews");
  const eligibilityText = useEligibilityText();
  const daysText = useDaysText();
  const SIGNUP_LABELS = useSignupLabels();
  const api = useApi();
  const list = useLoad(() => api<OcrSchedule[]>(`/api/career/ocr/employer/${employerId}/schedules`), [api, employerId]);
  const [open, setOpen] = useState<string | null>(null);
  if (list.loading) return <Loading />;
  if (list.error) return <ErrorBanner error={list.error} onRetry={list.reload} />;
  const items = list.data ?? [];
  if (items.length === 0) return <EmptyState title={tr("noInterviewSchedulesYet")}>{tr("useRequestAScheduleTo")}</EmptyState>;
  return (
    <div className="space-y-3">
      {items.map((s) => (
        <Card key={s.id} title={`${s.positionTitle} · ${s.school ?? ""}`} actions={<StatusBadge status={s.status} />}>
          <p className="text-sm">{daysText(s.days)} · {s.virtual ? tr("virtual") : tr("tracksRoomS", { tracks: s.tracks })} · {SIGNUP_LABELS[s.signupType]}</p>
          <p className="text-sm text-muted-foreground">{tr("openToSBooked", { s: eligibilityText(s) })}{" "}{s.extra?.booked ?? 0}{" "}{tr("of")}{" "}{s.extra?.slots ?? 0}{" "}{tr("slots")}</p>
          {s.decisionNote && <p className="text-sm">{tr("careerCenterNoteDecisionNote", { decisionNote: s.decisionNote })}</p>}
          <div className="mt-2">
            <Button variant="secondary" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
              {open === s.id ? tr("hideDetails") : tr("candidatesAndDetails")}
            </Button>
          </div>
          {open === s.id && <ScheduleDetail employerId={employerId} schedule={s} onChanged={() => list.reload()} onMessage={onMessage} />}
        </Card>
      ))}
    </div>
  );
}

interface Candidate {
  id: string;
  source: string;
  tier: string;
  status: string;
  invitedEmail?: string | null;
  packet?: {
    released: boolean;
    reason?: string;
    name?: string;
    email?: string;
    pronouns?: string | null;
    education?: { schoolName: string; degreeLevel: string; majors: string[]; graduationDate?: string | null }[];
    resume?: { id: string; fileName: string } | null;
  } | null;
  booking?: { id: string; startUtc: string; endUtc: string; room?: string | null; interviewer?: string | null; checkedInAt?: string | null; attendance?: string | null; outcome?: string | null; outcomeNote?: string | null } | null;
}

function ScheduleDetail({ employerId, schedule, onChanged, onMessage }: { employerId: string; schedule: OcrSchedule; onChanged: () => void; onMessage: (m: string) => void }) {
  const tr = useCareerT("employerInterviews");
  const OUTCOME_LABELS = useInterviewOutcomeLabels();
  const api = useApi();
  const download = useDownload();
  const base = `/api/career/ocr/employer/${employerId}/schedules/${schedule.id}`;
  const cands = useLoad(() => api<{ timeZone: string; candidates: Candidate[] }>(`${base}/candidates`), [api, base]);
  const [emails, setEmails] = useState("");
  const [tier, setTier] = useState("Primary");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const tz = cands.data?.timeZone ?? "UTC";

  const act = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      if (done) onMessage(done);
      cands.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const preselect = () =>
    act("pre", async () => {
      const r = await api<{ added: number; alreadyListed: number; notMatched: string[] }>(`${base}/preselect`, { json: { text: emails, tier } });
      setEmails("");
      onMessage(tr("addedStudentsInvited", { added: r.added }) + (r.notMatched.length ? tr("notFoundAtThisSchool", { list: r.notMatched.join(", ") }) : ""));
    });

  const booked = (cands.data?.candidates ?? []).filter((c) => c.booking).sort((a, b) => a.booking!.startUtc.localeCompare(b.booking!.startUtc));
  const others = (cands.data?.candidates ?? []).filter((c) => !c.booking);

  return (
    <div className="mt-4 space-y-4">
      <ErrorBanner error={err} />
      {schedule.externalJobUrl && (
        <p className="text-sm">{tr.rich("jobPostingExternalJobId", { link: (chunks) => <a className="underline" href={schedule.externalJobUrl!} target="_blank" rel="noreferrer">{chunks}</a>, externalJobId: schedule.externalJobId || schedule.externalJobUrl })}</p>
      )}
      {schedule.signupType !== "Open" && !["Declined", "Withdrawn", "Cancelled"].includes(schedule.status) && (
        <section aria-labelledby={`pre-${schedule.id}`} className="space-y-2">
          <h3 id={`pre-${schedule.id}`} className="font-semibold">{tr("preSelectList")}</h3>
          <Field label={tr("studentEmails")} hint={tr("pasteEmailsOrTheContents")}>
            {(p) => <textarea {...p} rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} />}
          </Field>
          {schedule.signupType === "Alternates" && (
            <Field label={tr("inviteAs")}>
              {(p) => (
                <select {...p} value={tier} onChange={(e) => setTier(e.target.value)}>
                  <option value="Primary">{tr("primaryCanBookASlot")}</option>
                  <option value="Alternate">{tr("alternateJoinsTheAlternateList")}</option>
                </select>
              )}
            </Field>
          )}
          <Button busy={busy === "pre"} disabled={!emails.trim()} onClick={preselect}>{tr("inviteStudents")}</Button>
        </section>
      )}

      <section aria-labelledby={`cand-${schedule.id}`}>
        <h3 id={`cand-${schedule.id}`} className="mb-2 font-semibold">{tr("interviews")}</h3>
        {cands.loading ? (
          <Loading />
        ) : cands.error ? (
          <ErrorBanner error={cands.error} onRetry={cands.reload} />
        ) : booked.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr("noOneHasBookedYet")}</p>
        ) : (
          <ul className="space-y-3">
            {booked.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{whenText(c.booking!, tz)}</strong>
                  <span className="flex gap-1">
                    {c.booking!.attendance && <StatusBadge status={c.booking!.attendance} />}
                    {c.booking!.outcome && <StatusBadge status={c.booking!.outcome} />}
                  </span>
                </div>
                <p className="text-muted-foreground">{[c.booking!.room, c.booking!.interviewer].filter(Boolean).join(" · ")}</p>
                <Packet c={c} onResume={() => act("r" + c.id, () => download(`${base}/candidates/${c.id}/resume`, c.packet?.resume?.fileName ?? "resume"))} />
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <Button variant="secondary" busy={busy === "in" + c.id} onClick={() => act("in" + c.id, () => api(`/api/career/ocr/employer/${employerId}/bookings/${c.booking!.id}/checkin`, { method: "POST" }), tr("checkedIn"))}>
                    {tr("checkIn")}
                  </Button>
                  <Button variant="secondary" busy={busy === "ns" + c.id} onClick={() => act("ns" + c.id, () => api(`/api/career/ocr/employer/${employerId}/bookings/${c.booking!.id}/attendance`, { json: { attendance: "NoShow" } }), tr("noShowRecorded"))}>
                    {tr("markNoShow")}
                  </Button>
                  <Field label={tr("outcome")}>
                    {(p) => (
                      <select
                        {...p}
                        className={p.className + " w-40"}
                        value={c.booking!.outcome ?? ""}
                        onChange={(e) => e.target.value && act("o" + c.id, () => api(`/api/career/ocr/employer/${employerId}/bookings/${c.booking!.id}/outcome`, { json: { outcome: e.target.value } }), tr("outcomeSaved"))}
                      >
                        <option value="">{tr("notRecorded")}</option>
                        {Object.entries(OUTCOME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    )}
                  </Field>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section aria-labelledby={`oth-${schedule.id}`}>
          <h3 id={`oth-${schedule.id}`} className="mb-2 font-semibold">{tr("invitationsAndAlternates")}</h3>
          <ul className="space-y-2">
            {others.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>{c.packet?.released ? c.packet.name : c.invitedEmail ?? tr("student")}</span>
                  <span className="flex gap-1">{c.tier === "Alternate" && <Badge>{tr("alternateTier")}</Badge>}<StatusBadge status={c.status} /></span>
                </div>
                {c.packet && <Packet c={c} onResume={() => act("r" + c.id, () => download(`${base}/candidates/${c.id}/resume`, c.packet?.resume?.fileName ?? "resume"))} />}
                {c.status === "Invited" && (
                  <Button variant="secondary" className="mt-2" onClick={() => act("x" + c.id, () => api(`${base}/preselect/${c.id}`, { method: "DELETE" }), tr("invitationRemoved"))}>{tr("remove")}</Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!["Declined", "Withdrawn", "Cancelled"].includes(schedule.status) && (
        <Button
          variant="secondary"
          onClick={() => {
            if (window.confirm(tr("withdrawThisScheduleBookedStudents"))) act("w", () => api(`${base}/withdraw`, { method: "POST" }), tr("scheduleWithdrawn")).then(onChanged);
          }}
        >
          {tr("withdrawSchedule")}
        </Button>
      )}
    </div>
  );
}

function Packet({ c, onResume }: { c: Candidate; onResume: () => void }) {
  const tr = useCareerT("employerInterviews");
  if (!c.packet) return <p className="text-muted-foreground">{tr("invitedInvitedEmailDetailsAppearOnce", { invitedEmail: c.invitedEmail })}</p>;
  if (!c.packet.released) return <p className="text-muted-foreground">{tr("detailsWithheldReason", { reason: c.packet.reason })}</p>;
  return (
    <div className="mt-1">
      <p>
        <strong>{c.packet.name}</strong>
        {c.packet.pronouns ? ` (${c.packet.pronouns})` : ""} · <a className="underline" href={`mailto:${c.packet.email}`}>{c.packet.email}</a>
      </p>
      {c.packet.education?.map((e, i) => (
        <p key={i} className="text-muted-foreground">{e.degreeLevel}, {e.majors.join(", ")} · {e.schoolName}{e.graduationDate ? tr("graduatingGraduationDate", { graduationDate: e.graduationDate }) : ""}</p>
      ))}
      {c.packet.resume && <button type="button" className="mt-1 underline" onClick={onResume}>{tr("downloadResumeFileName", { fileName: c.packet.resume.fileName })}</button>}
    </div>
  );
}

function RequestForm({ employerId, onDone }: { employerId: string; onDone: () => void }) {
  const tr = useCareerT("employerInterviews");
  const DEGREES = useDegreeLevelLabels();
  const WORK_AUTH_LABELS = useInterviewWorkAuthLabels();
  const SIGNUP_LABELS = useSignupLabels();
  const api = useApi();
  const rels = useLoad(() => api<Relationship[]>(`/api/career/employer/${employerId}/schools`), [api, employerId]);
  const approved = (rels.data ?? []).filter((r) => r.status === "Approved");
  const [f, setF] = useState({
    instituteId: "", positionTitle: "", description: "", externalJobUrl: "", externalJobId: "", externalJobSource: "",
    virtual: false, virtualUrl: "", tracks: 1, slotMinutes: 30, breakMinutes: 0, signupType: "Open",
    degreeLevels: [] as string[], majors: "", gradFrom: "", gradTo: "", workAuthRequirement: "None",
  });
  const [days, setDays] = useState<OcrDay[]>([{ date: "", start: "09:00", end: "17:00", lunchStart: "12:00", lunchEnd: "13:00" }]);
  const [interviewers, setInterviewers] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/career/ocr/employer/${employerId}/schedules`, {
        json: {
          ...f,
          gradFrom: f.gradFrom || null,
          gradTo: f.gradTo || null,
          majors: f.majors.split(",").map((m) => m.trim()).filter(Boolean),
          days: days.map((d) => ({ ...d, lunchStart: d.lunchStart || null, lunchEnd: d.lunchEnd || null })),
          interviewers: interviewers.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
            const m = l.match(/^(.*?)\s*<([^>]+)>$/);
            return m ? { name: m[1], email: m[2] } : { name: l };
          }),
        },
      });
      onDone();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (rels.loading) return <Loading />;
  if (approved.length === 0)
    return <EmptyState title={tr("noApprovedSchoolsYet")}>{tr.rich("youCanRequestInterviewDays", { link: (chunks) => <Link className="underline" href="/employer/schools">{chunks}</Link> })}</EmptyState>;
  return (
    <form onSubmit={submit} className="space-y-4" aria-label={tr("requestAnInterviewSchedule")}>
      <ErrorBanner error={err} />
      <Card title={tr("position")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("school")}>
            {(p) => (
              <select {...p} required value={f.instituteId} onChange={(e) => set("instituteId", e.target.value)}>
                <option value="">{tr("chooseASchool")}</option>
                {approved.map((r) => <option key={r.instituteId} value={r.instituteId}>{r.school}</option>)}
              </select>
            )}
          </Field>
          <Field label={tr("positionTitle")}>{(p) => <input {...p} required maxLength={200} value={f.positionTitle} onChange={(e) => set("positionTitle", e.target.value)} />}</Field>
          <Field label={tr("jobPostingLink")} hint={tr("whereStudentsCanReadAnd")}>{(p) => <input {...p} type="url" value={f.externalJobUrl} onChange={(e) => set("externalJobUrl", e.target.value)} />}</Field>
          <Field label={tr("jobIDOnThatPlatform")}>{(p) => <input {...p} value={f.externalJobId} onChange={(e) => set("externalJobId", e.target.value)} />}</Field>
        </div>
        <div className="mt-3">
          <Field label={tr("notesForStudents")}>{(p) => <textarea {...p} rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />}</Field>
        </div>
      </Card>
      <Card title={tr("daysAndFormat")}>
        <div className="space-y-2">
          {days.map((d, i) => (
            <fieldset key={i} className="grid gap-2 rounded border border-border p-2 sm:grid-cols-5">
              <legend className="px-1 text-sm font-medium">{tr("day")}{" "}{i + 1}</legend>
              <Field label={tr("date")}>{(p) => <input {...p} type="date" required value={d.date} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />}</Field>
              <Field label={tr("start")}>{(p) => <input {...p} type="time" required value={d.start} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />}</Field>
              <Field label={tr("end")}>{(p) => <input {...p} type="time" required value={d.end} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />}</Field>
              <Field label={tr("lunchFrom")}>{(p) => <input {...p} type="time" value={d.lunchStart ?? ""} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, lunchStart: e.target.value } : x)))} />}</Field>
              <Field label={tr("lunchTo")}>{(p) => <input {...p} type="time" value={d.lunchEnd ?? ""} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, lunchEnd: e.target.value } : x)))} />}</Field>
            </fieldset>
          ))}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setDays([...days, { ...days[days.length - 1], date: "" }])}>{tr("addADay")}</Button>
            {days.length > 1 && <Button type="button" variant="secondary" onClick={() => setDays(days.slice(0, -1))}>{tr("removeLastDay")}</Button>}
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <Field label={tr("interviewLengthMinutes")}>{(p) => <input {...p} type="number" min={10} max={240} value={f.slotMinutes} onChange={(e) => set("slotMinutes", Number(e.target.value))} />}</Field>
          <Field label={tr("breakBetweenInterviewsMinutes")}>{(p) => <input {...p} type="number" min={0} max={120} value={f.breakMinutes} onChange={(e) => set("breakMinutes", Number(e.target.value))} />}</Field>
          <Field label={f.virtual ? tr("parallelInterviewers") : tr("roomsNeeded")}>{(p) => <input {...p} type="number" min={1} max={20} value={f.tracks} onChange={(e) => set("tracks", Number(e.target.value))} />}</Field>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input type="checkbox" checked={f.virtual} onChange={(e) => set("virtual", e.target.checked)} />{" "}{tr("virtualInterviews")}
          </label>
        </div>
        {f.virtual && <div className="mt-3"><Field label={tr("videoMeetingLink")}>{(p) => <input {...p} type="url" required value={f.virtualUrl} onChange={(e) => set("virtualUrl", e.target.value)} />}</Field></div>}
        <div className="mt-3">
          <Field label={tr("interviewers")} hint={tr("onePerLineEG")}>{(p) => <textarea {...p} rows={3} required value={interviewers} onChange={(e) => setInterviewers(e.target.value)} />}</Field>
        </div>
      </Card>
      <Card title={tr("whoCanSignUp")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("signUpType")}>
            {(p) => (
              <select {...p} value={f.signupType} onChange={(e) => set("signupType", e.target.value)}>
                {Object.entries(SIGNUP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            )}
          </Field>
          <Field label={tr("workAuthorization")} hint={tr("studentsConfirmThisThemselvesWhen")}>
            {(p) => (
              <select {...p} value={f.workAuthRequirement} onChange={(e) => set("workAuthRequirement", e.target.value)}>
                {Object.entries(WORK_AUTH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            )}
          </Field>
          <Field label={tr("majors")} hint={tr("commaSeparatedLeaveEmptyFor")}>{(p) => <input {...p} value={f.majors} onChange={(e) => set("majors", e.target.value)} />}</Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={tr("graduatingFrom")}>{(p) => <input {...p} type="date" value={f.gradFrom} onChange={(e) => set("gradFrom", e.target.value)} />}</Field>
            <Field label={tr("graduatingTo")}>{(p) => <input {...p} type="date" value={f.gradTo} onChange={(e) => set("gradTo", e.target.value)} />}</Field>
          </div>
        </div>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium">{tr("degreeLevelsNoneCheckedMeans")}</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {DEGREE_LEVELS.map((l) => (
              <label key={l} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={f.degreeLevels.includes(l)} onChange={(e) => set("degreeLevels", e.target.checked ? [...f.degreeLevels, l] : f.degreeLevels.filter((x) => x !== l))} />
                {DEGREES[l]}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>
      <Button type="submit" busy={busy}>{tr("sendRequest")}</Button>
    </form>
  );
}
