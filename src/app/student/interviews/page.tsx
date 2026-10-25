"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad, useCareerT } from "@/components/career/ui";
import { TabPanel, Tabs, inZone, whenText } from "@/components/career/appointments/shared";
import { type OcrSchedule, StatusBadge, useSignupLabels, useDaysText, useEligibilityText } from "@/components/career/interviews/shared";

type Tab = "mine" | "find";

interface Mine {
  timeZone: string;
  items: {
    scheduleId: string;
    employerName: string;
    positionTitle: string;
    externalJobUrl?: string | null;
    scheduleStatus: string;
    candidateStatus: string;
    booking?: { id: string; status: string; source: string; startUtc: string; endUtc: string; room?: string | null; virtualUrl?: string | null; attendance?: string | null; cancelBy: string; canCancel: boolean } | null;
  }[];
}

interface Resume {
  id: string;
  fileName: string;
  sizeBytes: number;
}

export default function StudentInterviewsPage() {
  const tr = useCareerT("studentInterviews");
  const [tab, setTab] = useState<Tab>("mine");
  const [message, setMessage] = useState<string | null>(null);
  const api = useApi();
  const { schoolId } = useCareerShell();
  const status = useLoad(() => api<{ noShows: number; limit: number; blocked: boolean }>("/api/career/ocr/student/status"), [api, schoolId]);
  return (
    <div>
      <PageHeader title={tr("onCampusInterviews")} description={tr("signUpForInterviewsEmployers")} />
      <SuccessBanner message={message} />
      {status.data?.blocked && (
        <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {tr("youMissedNoShowsInterviewsThe", { noShows: status.data.noShows, limit: status.data.limit })}
        </div>
      )}
      <Tabs<Tab>
        label={tr("interviewSections")}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setMessage(null);
        }}
        tabs={[
          { key: "mine", label: tr("myInterviews") },
          { key: "find", label: tr("findInterviews") },
        ]}
      />
      <TabPanel id={tab}>
        {tab === "mine" && <MyInterviews onMessage={setMessage} />}
        {tab === "find" && (
          <FindInterviews
            onDone={(m) => {
              setMessage(m);
              setTab("mine");
            }}
          />
        )}
      </TabPanel>
    </div>
  );
}

function MyInterviews({ onMessage }: { onMessage: (m: string) => void }) {
  const tr = useCareerT("studentInterviews");
  const api = useApi();
  const { schoolId } = useCareerShell();
  const mine = useLoad(() => api<Mine>("/api/career/ocr/student/mine"), [api, schoolId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const withdraw = async (scheduleId: string, label: string) => {
    if (!window.confirm(tr("cancelLabelYourConsentTo", { label }))) return;
    setBusy(scheduleId);
    setErr(null);
    try {
      await api(`/api/career/ocr/student/schedules/${scheduleId}/withdraw`, { method: "POST" });
      onMessage(tr("cancelled"));
      mine.reload();
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (mine.loading) return <Loading />;
  if (mine.error) return <ErrorBanner error={mine.error} onRetry={mine.reload} />;
  const items = mine.data?.items ?? [];
  const tz = mine.data?.timeZone ?? "UTC";
  if (items.length === 0) return <EmptyState title={tr("noInterviewsYet")}>{tr("lookUnderFindInterviewsFor")}</EmptyState>;
  return (
    <div className="space-y-3">
      <ErrorBanner error={err} />
      {items.map((i) => (
        <Card key={i.scheduleId} title={`${i.employerName}: ${i.positionTitle}`} actions={<StatusBadge status={i.booking?.status === "Booked" ? "Booked" : i.candidateStatus} />}>
          {i.booking && i.booking.status === "Booked" ? (
            <div className="space-y-1 text-sm">
              <p>
                <strong>{whenText(i.booking, tz)}</strong>
                {i.booking.source === "Promoted" && <span className="ms-2"><Badge tone="info">{tr("movedUpFromAlternates")}</Badge></span>}
              </p>
              {i.booking.room && <p>{tr("roomRoom", { room: i.booking.room })}</p>}
              {i.booking.virtualUrl && (
                <p>
                  {tr.rich("videoLinkVirtualUrl", { link: (chunks) => <a className="underline" href={i.booking!.virtualUrl!} target="_blank" rel="noreferrer">{chunks}</a>, virtualUrl: i.booking.virtualUrl })}
                </p>
              )}
              {i.booking.attendance && <p>{tr("attendance")}{" "}<StatusBadge status={i.booking.attendance} /></p>}
              <p className="text-muted-foreground">
                {i.booking.canCancel ? tr("youCanCancelUntilCancelBy", { cancelBy: inZone(i.booking.cancelBy, tz, { dateStyle: "medium", timeStyle: "short" }) }) : tr("theCancellationDeadlineHasPassed")}
              </p>
            </div>
          ) : i.candidateStatus === "Waitlisted" ? (
            <p className="text-sm">{tr("youreOnTheAlternateList")}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{tr("noActiveInterview")}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {i.externalJobUrl && (
              <a className="text-sm underline" href={i.externalJobUrl} target="_blank" rel="noreferrer">
                {tr("viewTheJobPosting")}
              </a>
            )}
            {(i.booking?.canCancel || i.candidateStatus === "Waitlisted") && (
              <Button variant="secondary" busy={busy === i.scheduleId} onClick={() => withdraw(i.scheduleId, i.candidateStatus === "Waitlisted" ? tr("yourPlaceOnTheAlternate") : tr("thisInterview"))}>
                {i.candidateStatus === "Waitlisted" ? tr("leaveAlternateList") : tr("cancelInterview")}
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

type Listed = Omit<OcrSchedule, "extra"> & { extra: { invited: boolean; tier?: string | null; candidateStatus?: string | null; canBook: boolean; freeSlots: number; signupOpen: boolean } };

function FindInterviews({ onDone }: { onDone: (m: string) => void }) {
  const tr = useCareerT("studentInterviews");
  const eligibilityText = useEligibilityText();
  const daysText = useDaysText();
  const SIGNUP_LABELS = useSignupLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const list = useLoad(() => api<{ timeZone: string; schedules: Listed[] }>("/api/career/ocr/student/schedules"), [api, schoolId]);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const decline = async (id: string) => {
    setErr(null);
    try {
      await api(`/api/career/ocr/student/schedules/${id}/decline`, { method: "POST" });
      list.reload();
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    }
  };

  if (list.loading) return <Loading />;
  if (list.error) return <ErrorBanner error={list.error} onRetry={list.reload} />;
  const schedules = list.data?.schedules ?? [];
  if (schedules.length === 0)
    return (
      <EmptyState title={tr("noInterviewSchedulesForYou")}>
        {tr.rich("schedulesAppearHereWhenYou", { link: (chunks) => <Link className="underline" href="/student/record">{chunks}</Link> })}
      </EmptyState>
    );
  return (
    <div className="space-y-3">
      <ErrorBanner error={err} />
      {schedules.map((s) => (
        <Card
          key={s.id}
          title={`${s.employerName}: ${s.positionTitle}`}
          actions={s.extra.invited ? <Badge tone="info">{s.extra.tier === "Alternate" ? tr("invitedAsAlternate") : tr("invited")}</Badge> : undefined}
        >
          <dl className="grid gap-1 text-sm sm:grid-cols-2">
            <div><dt className="inline font-medium">{tr("dates")}{" "}</dt><dd className="inline">{daysText(s.days)}</dd></div>
            <div><dt className="inline font-medium">{tr("format")}{" "}</dt><dd className="inline">{s.virtual ? tr("virtual") : tr("onCampus")}{" "}{tr("slotMinutesMin", { slotMinutes: s.slotMinutes })}</dd></div>
            <div><dt className="inline font-medium">{tr("signUp2")}{" "}</dt><dd className="inline">{SIGNUP_LABELS[s.signupType] ?? s.signupType}</dd></div>
            <div><dt className="inline font-medium">{tr("openTo")}{" "}</dt><dd className="inline">{eligibilityText(s)}</dd></div>
            <div><dt className="inline font-medium">{tr("openSlots")}{" "}</dt><dd className="inline">{s.extra.freeSlots}</dd></div>
            {s.signupClosesAt && <div><dt className="inline font-medium">{tr("signUpCloses")}{" "}</dt><dd className="inline">{inZone(s.signupClosesAt, list.data!.timeZone, { dateStyle: "medium", timeStyle: "short" })}</dd></div>}
          </dl>
          {s.description && <p className="mt-2 text-sm">{s.description}</p>}
          {s.externalJobUrl && (
            <p className="mt-2 text-sm">
              <a className="underline" href={s.externalJobUrl} target="_blank" rel="noreferrer">{tr("viewTheJobPosting")}</a>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {s.extra.candidateStatus === "Registered" || s.extra.candidateStatus === "Waitlisted" ? (
              <p className="text-sm">{tr("youreSignedUpSeeMy")}</p>
            ) : !s.extra.signupOpen ? (
              <p className="text-sm text-muted-foreground">{tr("signUpIsntOpen")}</p>
            ) : (
              <>
                <Button onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
                  {s.extra.canBook ? tr("signUp") : tr("joinAlternateList")}
                </Button>
                {s.extra.candidateStatus === "Invited" && (
                  <Button variant="secondary" onClick={() => decline(s.id)}>{tr("declineInvitation")}</Button>
                )}
              </>
            )}
          </div>
          {open === s.id && <SignupForm schedule={s} timeZone={list.data!.timeZone} onDone={onDone} />}
        </Card>
      ))}
    </div>
  );
}

function SignupForm({ schedule, timeZone, onDone }: { schedule: Listed; timeZone: string; onDone: (m: string) => void }) {
  const tr = useCareerT("studentInterviews");
  const api = useApi();
  const detail = useLoad(() => api<Omit<OcrSchedule, "extra"> & { extra: { slots: { id: string; date: string; startUtc: string; endUtc: string }[]; hasConsent: boolean; canBook: boolean } }>(`/api/career/ocr/student/schedules/${schedule.id}`), [api, schedule.id]);
  const resumes = useLoad(() => api<Resume[]>("/api/career/ocr/student/resumes"), [api]);
  const [slotId, setSlotId] = useState<string>("");
  const [resumeId, setResumeId] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [attest, setAttest] = useState(false);
  const [alternates, setAlternates] = useState(!schedule.extra.canBook);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api<Resume>("/api/career/ocr/student/resumes", { method: "POST", body: fd });
      resumes.reload();
      setResumeId(r.id);
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ candidateStatus: string; bookingId?: string }>(`/api/career/ocr/student/schedules/${schedule.id}/signup`, {
        json: { slotId: slotId || null, resumeFileId: resumeId || null, consent, workAuthAttested: attest, joinAlternates: alternates },
      });
      onDone(r.bookingId ? tr("youreBookedWithEmployerName", { employerName: String(schedule.employerName) }) : tr("youreOnTheAlternateList2", { employerName: String(schedule.employerName) }));
    } catch (e2) {
      setErr(e2 instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e2 as Error).message);
      detail.reload();
    } finally {
      setBusy(false);
    }
  };

  if (detail.loading) return <Loading />;
  if (detail.error) return <ErrorBanner error={detail.error} />;
  const d = detail.data!;
  const needsConsent = !d.extra.hasConsent;
  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-border p-4" aria-label={tr("signUpForPositionTitle", { positionTitle: schedule.positionTitle })}>
      <ErrorBanner error={err} />
      {d.extra.canBook && (
        <Field label={tr("interviewTime")} hint={tr("timesAreInTheSchools", { timeZone })}>
          {(p) => (
            <select {...p} value={slotId} onChange={(e) => setSlotId(e.target.value)}>
              <option value="">{d.extra.slots.length ? tr("chooseATime") : tr("noOpenTimes")}</option>
              {d.extra.slots.map((s) => (
                <option key={s.id} value={s.id}>{whenText(s, timeZone)}</option>
              ))}
            </select>
          )}
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={alternates} disabled={!d.extra.canBook} onChange={(e) => setAlternates(e.target.checked)} />
        {d.extra.canBook ? tr("ifMyTimeIsTaken") : tr("joinTheAlternateListYoull")}
      </label>
      {needsConsent && (
        <>
          <Field label={tr("resumeToShare")} hint={tr("pDFWordOrTextUp")}>
            {(p) => (
              <select {...p} value={resumeId} onChange={(e) => setResumeId(e.target.value)} required>
                <option value="">{tr("chooseAResume")}</option>
                {(resumes.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>{r.fileName}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label={tr("orUploadAResume")}>
            {(p) => <input {...p} type="file" accept=".pdf,.docx,.txt" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />}
          </Field>
          {schedule.workAuthRequirement !== "None" && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={attest} onChange={(e) => setAttest(e.target.checked)} required />
              <span>{schedule.workAuthStatement}</span>
            </label>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            <span>
              {tr.rich("iAgreeToShareMy", { employerName: schedule.employerName, link: (chunks) => <Link className="underline" href="/student/privacy">{chunks}</Link> })}
            </span>
          </label>
        </>
      )}
      <Button type="submit" busy={busy} disabled={d.extra.canBook && !slotId && !alternates}>
        {slotId ? tr("bookThisTime") : tr("joinAlternateList")}
      </Button>
    </form>
  );
}
