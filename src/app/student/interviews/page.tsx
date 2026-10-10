"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad } from "@/components/career/ui";
import { TabPanel, Tabs, inZone, whenText } from "@/components/career/appointments/shared";
import { type OcrSchedule, SIGNUP_LABELS, StatusBadge, daysText, eligibilityText } from "@/components/career/interviews/shared";

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
  const [tab, setTab] = useState<Tab>("mine");
  const [message, setMessage] = useState<string | null>(null);
  const api = useApi();
  const { schoolId } = useCareerShell();
  const status = useLoad(() => api<{ noShows: number; limit: number; blocked: boolean }>("/api/career/ocr/student/status"), [api, schoolId]);
  return (
    <div>
      <PageHeader title="On-campus interviews" description="Sign up for interviews employers hold at your school, and keep track of the ones you booked." />
      <SuccessBanner message={message} />
      {status.data?.blocked && (
        <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          You missed {status.data.noShows} interviews (the limit is {status.data.limit}), so new sign-ups are paused. Contact your career center to have this cleared.
        </div>
      )}
      <Tabs<Tab>
        label="Interview sections"
        value={tab}
        onChange={(t) => {
          setTab(t);
          setMessage(null);
        }}
        tabs={[
          { key: "mine", label: "My interviews" },
          { key: "find", label: "Find interviews" },
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
  const api = useApi();
  const { schoolId } = useCareerShell();
  const mine = useLoad(() => api<Mine>("/api/career/ocr/student/mine"), [api, schoolId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const withdraw = async (scheduleId: string, label: string) => {
    if (!window.confirm(`Cancel ${label}? Your consent to share your details with this employer ends too.`)) return;
    setBusy(scheduleId);
    setErr(null);
    try {
      await api(`/api/career/ocr/student/schedules/${scheduleId}/withdraw`, { method: "POST" });
      onMessage("Cancelled.");
      mine.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (mine.loading) return <Loading />;
  if (mine.error) return <ErrorBanner error={mine.error} onRetry={mine.reload} />;
  const items = mine.data?.items ?? [];
  const tz = mine.data?.timeZone ?? "UTC";
  if (items.length === 0) return <EmptyState title="No interviews yet">Look under Find interviews for employers recruiting at your school.</EmptyState>;
  return (
    <div className="space-y-3">
      <ErrorBanner error={err} />
      {items.map((i) => (
        <Card key={i.scheduleId} title={`${i.employerName}: ${i.positionTitle}`} actions={<StatusBadge status={i.booking?.status === "Booked" ? "Booked" : i.candidateStatus} />}>
          {i.booking && i.booking.status === "Booked" ? (
            <div className="space-y-1 text-sm">
              <p>
                <strong>{whenText(i.booking, tz)}</strong>
                {i.booking.source === "Promoted" && <span className="ml-2"><Badge tone="info">Moved up from alternates</Badge></span>}
              </p>
              {i.booking.room && <p>Room: {i.booking.room}</p>}
              {i.booking.virtualUrl && (
                <p>
                  Video link: <a className="underline" href={i.booking.virtualUrl} target="_blank" rel="noreferrer">{i.booking.virtualUrl}</a>
                </p>
              )}
              {i.booking.attendance && <p>Attendance: <StatusBadge status={i.booking.attendance} /></p>}
              <p className="text-muted-foreground">
                {i.booking.canCancel ? `You can cancel until ${inZone(i.booking.cancelBy, tz, { dateStyle: "medium", timeStyle: "short" })}.` : "The cancellation deadline has passed; contact your career center if you can't attend."}
              </p>
            </div>
          ) : i.candidateStatus === "Waitlisted" ? (
            <p className="text-sm">You&apos;re on the alternate list. If a slot opens, we&apos;ll book you into it and let you know.</p>
          ) : (
            <p className="text-sm text-muted-foreground">No active interview.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {i.externalJobUrl && (
              <a className="text-sm underline" href={i.externalJobUrl} target="_blank" rel="noreferrer">
                View the job posting
              </a>
            )}
            {(i.booking?.canCancel || i.candidateStatus === "Waitlisted") && (
              <Button variant="secondary" busy={busy === i.scheduleId} onClick={() => withdraw(i.scheduleId, i.candidateStatus === "Waitlisted" ? "your place on the alternate list" : "this interview")}>
                {i.candidateStatus === "Waitlisted" ? "Leave alternate list" : "Cancel interview"}
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
      setErr((e as Error).message);
    }
  };

  if (list.loading) return <Loading />;
  if (list.error) return <ErrorBanner error={list.error} onRetry={list.reload} />;
  const schedules = list.data?.schedules ?? [];
  if (schedules.length === 0)
    return (
      <EmptyState title="No interview schedules for you right now">
        Schedules appear here when you meet an employer&apos;s requirements or are invited. Keep your program and graduation date up to date in your{" "}
        <Link className="underline" href="/student/record">career record</Link>.
      </EmptyState>
    );
  return (
    <div className="space-y-3">
      <ErrorBanner error={err} />
      {schedules.map((s) => (
        <Card
          key={s.id}
          title={`${s.employerName}: ${s.positionTitle}`}
          actions={s.extra.invited ? <Badge tone="info">{s.extra.tier === "Alternate" ? "Invited as alternate" : "Invited"}</Badge> : undefined}
        >
          <dl className="grid gap-1 text-sm sm:grid-cols-2">
            <div><dt className="inline font-medium">Dates: </dt><dd className="inline">{daysText(s.days)}</dd></div>
            <div><dt className="inline font-medium">Format: </dt><dd className="inline">{s.virtual ? "Virtual" : "On campus"} · {s.slotMinutes} min</dd></div>
            <div><dt className="inline font-medium">Sign-up: </dt><dd className="inline">{SIGNUP_LABELS[s.signupType] ?? s.signupType}</dd></div>
            <div><dt className="inline font-medium">Open to: </dt><dd className="inline">{eligibilityText(s)}</dd></div>
            <div><dt className="inline font-medium">Open slots: </dt><dd className="inline">{s.extra.freeSlots}</dd></div>
            {s.signupClosesAt && <div><dt className="inline font-medium">Sign-up closes: </dt><dd className="inline">{inZone(s.signupClosesAt, list.data!.timeZone, { dateStyle: "medium", timeStyle: "short" })}</dd></div>}
          </dl>
          {s.description && <p className="mt-2 text-sm">{s.description}</p>}
          {s.externalJobUrl && (
            <p className="mt-2 text-sm">
              <a className="underline" href={s.externalJobUrl} target="_blank" rel="noreferrer">View the job posting</a>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {s.extra.candidateStatus === "Registered" || s.extra.candidateStatus === "Waitlisted" ? (
              <p className="text-sm">You&apos;re signed up. See My interviews.</p>
            ) : !s.extra.signupOpen ? (
              <p className="text-sm text-muted-foreground">Sign-up isn&apos;t open.</p>
            ) : (
              <>
                <Button onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
                  {s.extra.canBook ? "Sign up" : "Join alternate list"}
                </Button>
                {s.extra.candidateStatus === "Invited" && (
                  <Button variant="secondary" onClick={() => decline(s.id)}>Decline invitation</Button>
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
      setErr((e as Error).message);
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
      onDone(r.bookingId ? `You're booked with ${schedule.employerName}.` : `You're on the alternate list for ${schedule.employerName}.`);
    } catch (e2) {
      setErr((e2 as Error).message);
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
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-border p-4" aria-label={`Sign up for ${schedule.positionTitle}`}>
      <ErrorBanner error={err} />
      {d.extra.canBook && (
        <Field label="Interview time" hint={`Times are in the school's time zone (${timeZone}).`}>
          {(p) => (
            <select {...p} value={slotId} onChange={(e) => setSlotId(e.target.value)}>
              <option value="">{d.extra.slots.length ? "Choose a time" : "No open times"}</option>
              {d.extra.slots.map((s) => (
                <option key={s.id} value={s.id}>{whenText(s, timeZone)}</option>
              ))}
            </select>
          )}
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={alternates} disabled={!d.extra.canBook} onChange={(e) => setAlternates(e.target.checked)} />
        {d.extra.canBook ? "If my time is taken or none are left, put me on the alternate list" : "Join the alternate list (you'll be booked automatically if a slot opens)"}
      </label>
      {needsConsent && (
        <>
          <Field label="Resume to share" hint="PDF, Word, or text, up to 10 MB.">
            {(p) => (
              <select {...p} value={resumeId} onChange={(e) => setResumeId(e.target.value)} required>
                <option value="">Choose a resume</option>
                {(resumes.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>{r.fileName}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Or upload a resume">
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
              I agree to share my name, email, education and the resume above with {schedule.employerName} for this interview. You can withdraw consent in your{" "}
              <Link className="underline" href="/student/privacy">privacy settings</Link>.
            </span>
          </label>
        </>
      )}
      <Button type="submit" busy={busy} disabled={d.extra.canBook && !slotId && !alternates}>
        {slotId ? "Book this time" : "Join alternate list"}
      </Button>
    </form>
  );
}
