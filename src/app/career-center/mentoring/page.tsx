"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, ScrollArea, useCareerT, useCareerLabels } from "@/components/career/ui";
import { StatusBadge, topicLabel, type MentoringOptions, type RelationshipSummary, useMeetingLabels, useReportReasonLabels, useMentoringStatusLabels } from "@/components/career/mentoring/MentorshipPanel";

interface StaffMentor {
  profile: {
    id: string;
    name: string;
    email: string;
    kind: string;
    status: string;
    headline: string;
    employer?: string | null;
    jobTitle?: string | null;
    industry?: string | null;
    majors: string[];
    topics: string[];
    meetingPreferences: string[];
    capacity: number;
    activeMentees: number;
    bio?: string | null;
    availabilityNotes?: string | null;
    decisionNote?: string | null;
    submittedAt?: string | null;
  };
  matchingPaused: boolean;
}

interface StaffRelationship {
  summary: RelationshipSummary;
  studentRating?: number | null;
  mentorRating?: number | null;
}

interface StaffRelationshipDetail {
  relationship: RelationshipSummary;
  staffNote?: string | null;
  sessions: { id: string; occurredOn: string; durationMinutes: number; format: string; sharedSummary?: string | null; loggedBy: string }[];
  feedback: { fromRole: string; rating: number; comment?: string | null; createdAt: string }[];
  reports: { id: string; reportedRole: string; reason: string; status: string; createdAt: string }[];
}

interface Report {
  id: string;
  reason: string;
  details: string;
  blocked: boolean;
  status: string;
  reportedRole: string;
  reporter?: string | null;
  reported?: string | null;
  reportedMatchingPaused: boolean;
  relationshipStatus?: string | null;
  createdAt: string;
  resolutionNote?: string | null;
}

interface Stats {
  mentorsByStatus: Record<string, number>;
  relationshipsByStatus: Record<string, number>;
  sessionsLast90Days: number;
  hoursLast90Days: number;
  averageRatingFromStudents: number | null;
  averageRatingFromMentors: number | null;
  openReports: number;
  checkInDue: number;
  studentsMentored: number;
  alumni: number;
}

type Tab = "overview" | "mentors" | "mentorships" | "reports" | "alumni" | "settings";
const TABS: Tab[] = ["overview", "mentors", "mentorships", "reports", "alumni", "settings"];

export default function CareerCenterMentoringPage() {
  const tr = useCareerT("careerCenterMentoring");
  const TAB_LABELS = useCareerLabels("careerCenterMentoring.tabs", TABS);
  const api = useApi();
  const [tab, setTab] = useState<Tab>("overview");
  const options = useLoad(() => api<MentoringOptions>("/api/career/mentoring/options"), [api]);

  return (
    <div>
      <PageHeader title={tr("mentoringNetwork")} description={tr("approveVolunteerMentorsFollowMentorships")} />
      <div role="tablist" aria-label={tr("mentoringAdministration")} className="mb-6 flex flex-wrap gap-2 border-b border-border">
        {TABS.map((key) => [key, TAB_LABELS[key]] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 ${tab === key ? "border-[var(--brand,#4f46e5)]" : "border-transparent text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "overview" && <Overview />}
        {tab === "mentors" && <Mentors options={options.data} />}
        {tab === "mentorships" && <Mentorships />}
        {tab === "reports" && <Reports />}
        {tab === "alumni" && <Alumni />}
        {tab === "settings" && <Settings />}
      </div>
    </div>
  );
}

function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, success: string | ((r: unknown) => string)) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      const r = await fn();
      setMsg(typeof success === "function" ? success(r) : success);
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { busy, err, msg, run };
}

function Overview() {
  const tr = useCareerT("careerCenterMentoring");
  const api = useApi();
  const stats = useLoad(() => api<Stats>("/api/career/mentoring/staff/stats"), [api]);
  const { busy, err, msg, run } = useAction();

  const download = async (path: string, name: string) => {
    await run(
      name,
      async () => {
        const res = await api<Response>(path, { raw: true });
        if (!res.ok) throw new Error(tr("exportFailedStatus", { status: res.status }));
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      },
      tr("downloadStarted"),
    );
  };

  if (stats.loading && !stats.data) return <Loading />;
  const s = stats.data;
  const tiles: [string, string | number][] = s
    ? [
        [tr("tileListedMentors"), s.mentorsByStatus.Approved ?? 0],
        [tr("tileMentorsWaiting"), s.mentorsByStatus.Pending ?? 0],
        [tr("tileActiveMentorships"), s.relationshipsByStatus.Active ?? 0],
        [tr("tileRequestsWaiting"), (s.relationshipsByStatus.Requested ?? 0) + (s.relationshipsByStatus.PendingStaff ?? 0)],
        [tr("tileCompletedMentorships"), s.relationshipsByStatus.Completed ?? 0],
        [tr("tileStudentsMentored"), s.studentsMentored],
        [tr("tileSessions90"), s.sessionsLast90Days],
        [tr("tileHours90"), s.hoursLast90Days],
        [tr("tileRatingStudents"), s.averageRatingFromStudents ?? "—"],
        [tr("tileRatingMentors"), s.averageRatingFromMentors ?? "—"],
        [tr("tileOpenReports"), s.openReports],
        [tr("tileCheckInsDue"), s.checkInDue],
        [tr("tileAlumni"), s.alumni],
      ]
    : [];

  return (
    <div className="space-y-6">
      <ErrorBanner error={err ?? stats.error} />
      <SuccessBanner message={msg} />
      <Card title={tr("activity")}>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title={tr("checkInReminders")}>
        <p className="mb-3 text-sm">{tr("sendAReminderToBoth")}</p>
        <Button busy={busy === "checkins"} onClick={() => run("checkins", () => api<{ sent: number }>("/api/career/mentoring/staff/check-ins/send", { method: "POST" }).then((r) => { stats.reload(); return r; }), (r) => tr("remindersSentToSentMentorships", { sent: (r as { sent: number }).sent }))}>
          {tr("sendCheckInReminders")}
        </Button>
      </Card>
      <Card title={tr("export")}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" busy={busy === "mentorships.csv"} onClick={() => download("/api/career/mentoring/staff/export/relationships.csv", "mentorships.csv")}>
            {tr("downloadMentorshipsCSV")}
          </Button>
          <Button variant="secondary" busy={busy === "mentors.csv"} onClick={() => download("/api/career/mentoring/staff/export/mentors.csv", "mentors.csv")}>
            {tr("downloadMentorsCSV")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{tr("exportsNeverIncludePrivateSession")}</p>
      </Card>
    </div>
  );
}

function Mentors({ options }: { options: MentoringOptions | null }) {
  const tr = useCareerT("careerCenterMentoring");
  const STATUS_LABELS = useMentoringStatusLabels();
  const MEETING_LABELS = useMeetingLabels();
  const api = useApi();
  const [status, setStatus] = useState("Pending");
  const list = useLoad(() => api<StaffMentor[]>(`/api/career/mentoring/staff/mentors${status ? `?status=${status}` : ""}`), [api, status]);
  const { busy, err, msg, run } = useAction();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [invite, setInvite] = useState({ email: "", name: "", employer: "" });

  const decide = (id: string, action: string, name: string) =>
    run(`${action}-${id}`, () => api(`/api/career/mentoring/staff/mentors/${id}/decision`, { json: { action, note: notes[id] } }).then(() => list.reload()), tr("nameActionDone", { name, action }));

  return (
    <div className="space-y-6">
      <ErrorBanner error={err ?? list.error} />
      <SuccessBanner message={msg} />
      <Card title={tr("inviteAProfessionalMentor")}>
        <p className="mb-3 text-sm text-muted-foreground">
          {tr("alumniCanSetUpA")}
        </p>
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run("invite", () => api("/api/career/mentoring/staff/mentors/invite", { json: invite }), tr("invitedName", { name: invite.name }));
            if (ok) {
              setInvite({ email: "", name: "", employer: "" });
              list.reload();
            }
          }}
        >
          <Field label={tr("name")}>{(p) => <input {...p} required value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />}</Field>
          <Field label={tr("email")}>{(p) => <input {...p} type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />}</Field>
          <Field label={tr("employerOptional")}>{(p) => <input {...p} value={invite.employer} onChange={(e) => setInvite({ ...invite, employer: e.target.value })} />}</Field>
          <div className="flex items-end">
            <Button type="submit" busy={busy === "invite"}>
              {tr("invite")}
            </Button>
          </div>
        </form>
      </Card>

      <Card
        title={tr("mentors")}
        actions={
          <Field label={tr("show")}>
            {(p) => (
              <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{tr("all")}</option>
                {["Pending", "Approved", "Paused", "Draft", "Invited", "Rejected", "Suspended"].map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s] ?? s}
                  </option>
                ))}
              </select>
            )}
          </Field>
        }
      >
        {list.loading && !list.data ? (
          <Loading />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState title={tr("noMentorsHere")} />
        ) : (
          <ul className="space-y-4">
            {list.data!.map(({ profile: p, matchingPaused }) => (
              <li key={p.id} className="rounded-lg border border-border p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">{p.name}</h3>
                    <p className="text-muted-foreground">
                      {p.email} · {p.kind}
                      {p.submittedAt ? tr("submittedSubmittedAt", { submittedAt: formatDate(p.submittedAt) }) : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge status={p.status} />
                    {matchingPaused && <Badge tone="bad">{tr("newMatchesPausedReport")}</Badge>}
                  </div>
                </div>
                <p className="mt-2">{p.headline || <em>{tr("noHeadlineYet")}</em>}</p>
                <p className="text-xs text-muted-foreground">
                  {[p.jobTitle, p.employer, p.industry].filter(Boolean).join(" · ")}
                  {p.majors.length ? tr("majorsMajors", { majors: p.majors.join(", ") }) : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tr("topicsValueMeetsByValue2", { value: p.topics.map((t) => topicLabel(options, t)).join(", ") || "—", value2: p.meetingPreferences.map((m) => MEETING_LABELS[m] ?? m).join(", ") || "—", activeMentees: p.activeMentees, capacity: p.capacity })}
                </p>
                {p.bio && <p className="mt-1 text-xs">{p.bio}</p>}
                {p.decisionNote && <p className="mt-1 text-xs">{tr("lastNoteDecisionNote", { decisionNote: p.decisionNote })}</p>}
                {p.status !== "Invited" && p.status !== "Draft" && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <Field label={tr("noteToTheMentor")} hint={tr("requiredToRequestChangesOr")}>
                      {(fp) => <input {...fp} value={notes[p.id] ?? ""} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} />}
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      {["Pending", "Rejected", "Suspended"].includes(p.status) && (
                        <Button busy={busy === `approve-${p.id}`} onClick={() => decide(p.id, "approve", p.name)}>
                          {tr.rich("approveName", { span: (chunks) => <span className="sr-only">{chunks}</span>, name: p.name })}
                        </Button>
                      )}
                      {p.status === "Pending" && (
                        <Button variant="secondary" busy={busy === `reject-${p.id}`} onClick={() => decide(p.id, "reject", p.name)}>
                          {tr.rich("requestChangesFromName", { span: (chunks) => <span className="sr-only">{chunks}</span>, name: p.name })}
                        </Button>
                      )}
                      {p.status !== "Suspended" && (
                        <Button variant="danger" busy={busy === `suspend-${p.id}`} onClick={() => window.confirm(tr("suspendName", { name: p.name })) && decide(p.id, "suspend", p.name)}>
                          {tr.rich("suspendName2", { span: (chunks) => <span className="sr-only">{chunks}</span>, name: p.name })}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Mentorships() {
  const tr = useCareerT("careerCenterMentoring");
  const STATUS_LABELS = useMentoringStatusLabels();
  const api = useApi();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(applied ? { q: applied } : {}) }).toString();
  const list = useLoad(() => api<StaffRelationship[]>(`/api/career/mentoring/staff/relationships?${qs}`), [api, qs]);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card title={tr("mentorships")}>
        <form
          role="search"
          aria-label={tr("filterMentorships")}
          className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(q);
          }}
        >
          <Field label={tr("status")}>
            {(p) => (
              <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{tr("all")}</option>
                <option value="CheckInDue">{tr("checkInDue")}</option>
                {["PendingStaff", "Requested", "Active", "Completed", "Ended", "Declined", "Withdrawn"].map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={tr("studentOrMentorName")}>{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
          <Button type="submit">{tr("filter")}</Button>
        </form>
        <ErrorBanner error={list.error} />
        <p role="status" aria-live="polite" className="sr-only">
          {list.data ? tr("countMentorships", { count: list.data.length }) : ""}
        </p>
        {list.loading && !list.data ? (
          <Loading />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState title={tr("noMentorshipsMatch")} />
        ) : (
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">{tr("mentorships")}</caption>
              <thead>
                <tr className="border-b border-border text-start [&_th]:text-start">
                  <th scope="col" className="py-2 pe-3 font-medium">{tr("student")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{tr("mentor")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{tr("status")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{tr("sessions")}</th>
                  <th scope="col" className="py-2 font-medium"><span className="sr-only">{tr("open")}</span></th>
                </tr>
              </thead>
              <tbody>
                {list.data!.map(({ summary: r }) => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="py-2 pe-3">{r.studentName}</td>
                    <td className="py-2 pe-3">{r.mentorName}</td>
                    <td className="py-2 pe-3">
                      <StatusBadge status={r.status} /> {r.checkInDue && <Badge tone="warn">{tr("checkInDue")}</Badge>}
                    </td>
                    <td className="py-2 pe-3">{r.sessions}</td>
                    <td className="py-2">
                      <Button variant="ghost" onClick={() => setOpenId(r.id)} aria-current={openId === r.id ? "true" : undefined}>
                        {tr.rich("viewMentorshipOfStudentNameWith", { span: (chunks) => <span className="sr-only">{chunks}</span>, studentName: r.studentName, mentorName: r.mentorName })}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Card>
      <div>{openId ? <StaffRelationshipView key={openId} id={openId} onChanged={list.reload} /> : <p className="text-sm text-muted-foreground">{tr("chooseAMentorshipToSee")}</p>}</div>
    </div>
  );
}

function StaffRelationshipView({ id, onChanged }: { id: string; onChanged: () => void }) {
  const tr = useCareerT("careerCenterMentoring");
  const MEETING_LABELS = useMeetingLabels();
  const api = useApi();
  const d = useLoad(() => api<StaffRelationshipDetail>(`/api/career/mentoring/staff/relationships/${id}`), [api, id]);
  const { busy, err, msg, run } = useAction();
  const [note, setNote] = useState("");
  if (d.loading && !d.data) return <Loading />;
  if (!d.data) return <ErrorBanner error={d.error} />;
  const r = d.data.relationship;
  const decide = (approve: boolean) =>
    run(
      approve ? "approve" : "decline",
      () =>
        api(`/api/career/mentoring/staff/relationships/${id}/decision`, { json: { approve, note } }).then(() => {
          d.reload();
          onChanged();
        }),
      approve ? tr("matchApprovedContactDetailsExchanged") : tr("matchDeclined"),
    );

  return (
    <Card title={tr("studentNameWithMentorName", { studentName: r.studentName, mentorName: r.mentorName })} actions={<StatusBadge status={r.status} />}>
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">{tr("requested")}</dt>
          <dd>{formatDate(r.requestedAt)}</dd>
        </div>
        <div>
          <dt className="font-medium">{tr("started")}</dt>
          <dd>{formatDate(r.startedAt)}</dd>
        </div>
        <div>
          <dt className="font-medium">{tr("contactExchanged")}</dt>
          <dd>{r.contactShared ? tr("yesLoggedDisclosure") : tr("no")}</dd>
        </div>
        <div>
          <dt className="font-medium">{tr("timeTogether")}</dt>
          <dd>
            {tr("sessionsSessions", { sessions: r.sessions })}{" "}{Math.round((r.totalMinutes / 60) * 10) / 10}{" "}{tr("hours")}
          </dd>
        </div>
      </dl>
      <h3 className="mt-4 text-sm font-semibold">{tr("goals")}</h3>
      <ul className="list-disc ps-5 text-sm">
        {r.goals.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
      {r.status === "PendingStaff" && (
        <div className="mt-4 space-y-2 rounded-md border border-border p-3">
          <h3 className="text-sm font-semibold">{tr("thisMatchNeedsYourApproval")}</h3>
          <p className="text-sm">{r.message}</p>
          <Field label={tr("noteOptional")}>{(p) => <input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          <div className="flex gap-2">
            <Button busy={busy === "approve"} onClick={() => decide(true)}>
              {tr("approveMatch")}
            </Button>
            <Button variant="secondary" busy={busy === "decline"} onClick={() => decide(false)}>
              {tr("declineMatch")}
            </Button>
          </div>
        </div>
      )}
      <h3 className="mt-4 text-sm font-semibold">{tr("sessions")}</h3>
      <p className="text-xs text-muted-foreground">{tr("privateNotesAreNotShown")}</p>
      {d.data.sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr("noneLogged")}</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {d.data.sessions.map((s) => (
            <li key={s.id} className="py-2">
              {tr("occurredOnDurationMinutesMinFormatLogged", { occurredOn: formatDate(s.occurredOn), durationMinutes: s.durationMinutes, format: MEETING_LABELS[s.format] ?? s.format, loggedBy: s.loggedBy.toLowerCase() })}
              {s.sharedSummary && <p className="text-muted-foreground">{tr("summarySharedSummary", { sharedSummary: s.sharedSummary })}</p>}
            </li>
          ))}
        </ul>
      )}
      {d.data.feedback.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold">{tr("feedback")}</h3>
          <ul className="text-sm">
            {d.data.feedback.map((f) => (
              <li key={f.fromRole}>
                {f.fromRole}: {f.rating}/5{f.comment ? ` – “${f.comment}”` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
      {d.data.reports.length > 0 && (
        <p className="mt-4 text-sm">
          <Badge tone="bad">{tr("countReportS", { count: d.data.reports.length })}</Badge>{" "}{tr("seeTheReportsTab")}
        </p>
      )}
    </Card>
  );
}

function Reports() {
  const tr = useCareerT("careerCenterMentoring");
  const STATUS_LABELS = useMentoringStatusLabels();
  const REPORT_REASON_LABELS = useReportReasonLabels();
  const api = useApi();
  const [status, setStatus] = useState("Open");
  const reports = useLoad(() => api<Report[]>(`/api/career/mentoring/staff/reports${status ? `?status=${status}` : ""}`), [api, status]);
  const holds = useLoad(() => api<{ id: string; name?: string | null; reason: string; createdAt: string }[]>("/api/career/mentoring/staff/suspensions"), [api]);
  const { busy, err, msg, run } = useAction();
  const [form, setForm] = useState<Record<string, { note: string; remove: boolean }>>({});

  const resolve = (x: Report, outcome: "Dismiss" | "Uphold") => {
    const f = form[x.id] ?? { note: "", remove: false };
    return run(
      `${outcome}-${x.id}`,
      () =>
        api(`/api/career/mentoring/staff/reports/${x.id}/resolve`, { json: { outcome, note: f.note, removeFromNetwork: f.remove } }).then(() => {
          reports.reload();
          holds.reload();
        }),
      outcome === "Dismiss" ? tr("reportDismissedTheMatchingHold") : tr("reportUpheld"),
    );
  };

  return (
    <div className="space-y-6">
      <ErrorBanner error={err ?? reports.error ?? holds.error} />
      <SuccessBanner message={msg} />
      <Card
        title={tr("reports")}
        actions={
          <Field label={tr("show")}>
            {(p) => (
              <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Open">{tr("open")}</option>
                <option value="Upheld">{tr("upheld")}</option>
                <option value="Dismissed">{tr("dismissed")}</option>
                <option value="">{tr("all")}</option>
              </select>
            )}
          </Field>
        }
      >
        {reports.loading && !reports.data ? (
          <Loading />
        ) : (reports.data ?? []).length === 0 ? (
          <EmptyState title={tr("noReports")} />
        ) : (
          <ul className="space-y-4">
            {reports.data!.map((x) => (
              <li key={x.id} className="rounded-lg border border-border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {REPORT_REASON_LABELS[x.reason] ?? x.reason}: {x.reported ?? tr("unknown")} ({x.reportedRole.toLowerCase()})
                  </h3>
                  <StatusBadge status={x.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr("reportedByReporterOnCreatedAt", { reporter: x.reporter ?? tr("unknown2"), createdAt: formatDate(x.createdAt, true) })}
                  {x.blocked ? tr("reporterBlockedThem") : ""}
                  {x.relationshipStatus ? tr("mentorshipValue", { value: STATUS_LABELS[x.relationshipStatus]?.toLowerCase() ?? x.relationshipStatus }) : ""}
                  {x.reportedMatchingPaused ? tr("newMatchesPaused") : ""}
                </p>
                <p className="mt-2 whitespace-pre-wrap">{x.details}</p>
                {x.resolutionNote && <p className="mt-2 text-xs">{tr("resolutionResolutionNote", { resolutionNote: x.resolutionNote })}</p>}
                {x.status === "Open" && (
                  <div className="mt-3 space-y-2">
                    <Field label={tr("resolutionNote")}>
                      {(p) => <textarea {...p} rows={2} value={form[x.id]?.note ?? ""} onChange={(e) => setForm({ ...form, [x.id]: { note: e.target.value, remove: form[x.id]?.remove ?? false } })} />}
                    </Field>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={form[x.id]?.remove ?? false} onChange={(e) => setForm({ ...form, [x.id]: { note: form[x.id]?.note ?? "", remove: e.target.checked } })} />
                      {tr("ifUpheldRemoveThemFrom")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" busy={busy === `Dismiss-${x.id}`} onClick={() => resolve(x, "Dismiss")}>
                        {tr("dismissAndLiftHold")}
                      </Button>
                      <Button variant="danger" busy={busy === `Uphold-${x.id}`} onClick={() => resolve(x, "Uphold")}>
                        {tr("uphold")}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={tr("peopleWithNewMatchesPaused")}>
        {(holds.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr("nobodyIsPaused")}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {holds.data!.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {tr("nameReasonSinceCreatedAt", { name: h.name ?? tr("unknown"), reason: h.reason, createdAt: formatDate(h.createdAt) })}
                </span>
                <Button
                  variant="secondary"
                  busy={busy === `lift-${h.id}`}
                  onClick={() => run(`lift-${h.id}`, () => api(`/api/career/mentoring/staff/suspensions/${h.id}/lift`, { method: "POST" }).then(() => holds.reload()), tr("holdLifted"))}
                >
                  {tr.rich("liftHoldForName", { span: (chunks) => <span className="sr-only">{chunks}</span>, name: h.name })}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

interface GraduateResult {
  dryRun: boolean;
  converted: { id: string; name: string; email: string; graduationDate?: string | null }[];
  skipped: { id: string; name: string; email: string; reason: string }[];
}

function Alumni() {
  const tr = useCareerT("careerCenterMentoring");
  const api = useApi();
  const alumni = useLoad(() => api<{ id: string; name: string; email: string; status: string; source: string; mentorStatus?: string | null }[]>("/api/career/mentoring/staff/alumni"), [api]);
  const { busy, err, msg, run } = useAction();
  const [cutoff, setCutoff] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<GraduateResult | null>(null);

  const go = (dryRun: boolean) =>
    run(
      dryRun ? "preview" : "graduate",
      async () => {
        const r = await api<GraduateResult>("/api/career/mentoring/staff/graduate", { json: { graduatedOnOrBefore: cutoff, dryRun } });
        setPreview(dryRun ? r : null);
        if (!dryRun) alumni.reload();
        return r;
      },
      (r) => {
        const g = r as GraduateResult;
        return g.dryRun ? tr("countStudentsWouldBecomeAlumni", { count: g.converted.length }) : tr("countStudentsAreNowAlumni", { count: g.converted.length });
      },
    );

  return (
    <div className="space-y-6">
      <ErrorBanner error={err ?? alumni.error} />
      <SuccessBanner message={msg} />
      <Card title={tr("graduateACohort")}>
        <p className="mb-3 text-sm">
          {tr("turnsStudentsWhoseSchoolRecorded")}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={tr("graduatedOnOrBefore")}>{(p) => <input {...p} type="date" value={cutoff} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setCutoff(e.target.value)} />}</Field>
          <Button variant="secondary" busy={busy === "preview"} onClick={() => go(true)}>
            {tr("preview")}
          </Button>
          {preview && preview.converted.length > 0 && (
            <Button busy={busy === "graduate"} onClick={() => window.confirm(tr("convertCountStudentSTo", { count: preview.converted.length })) && go(false)}>
              {tr("convertCountToAlumni", { count: preview.converted.length })}
            </Button>
          )}
        </div>
        {preview && (
          <div className="mt-4 text-sm">
            {preview.converted.length === 0 ? (
              <p>{tr("noStudentsMatch")}</p>
            ) : (
              <ul className="list-disc ps-5">
                {preview.converted.map((c) => (
                  <li key={c.id}>
                    {c.name} ({c.email}){c.graduationDate ? tr("graduatedGraduationDate", { graduationDate: formatDate(c.graduationDate) }) : ""}
                  </li>
                ))}
              </ul>
            )}
            {preview.skipped.length > 0 && <p className="mt-2 text-muted-foreground">{tr("skippedValue", { value: preview.skipped.map((s) => `${s.name} (${s.reason})`).join("; ") })}</p>}
          </div>
        )}
      </Card>
      <Card title={tr("alumniCount", { count: alumni.data?.length ?? 0 })}>
        {alumni.loading && !alumni.data ? (
          <Loading />
        ) : (alumni.data ?? []).length === 0 ? (
          <EmptyState title={tr("noAlumniYet")} />
        ) : (
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">{tr("alumni")}</caption>
              <thead>
                <tr className="border-b border-border text-start [&_th]:text-start">
                  <th scope="col" className="py-2 pe-3 font-medium">{tr("name")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{tr("email")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{tr("account")}</th>
                  <th scope="col" className="py-2 font-medium">{tr("mentorProfile")}</th>
                </tr>
              </thead>
              <tbody>
                {alumni.data!.map((a) => (
                  <tr key={a.id} className="border-b border-border">
                    <td className="py-2 pe-3">{a.name}</td>
                    <td className="py-2 pe-3">{a.email}</td>
                    <td className="py-2 pe-3">{a.status === "Invited" ? tr("notSignedInYet") : a.status}</td>
                    <td className="py-2">{a.mentorStatus ? <StatusBadge status={a.mentorStatus} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}

function Settings() {
  const tr = useCareerT("careerCenterMentoring");
  const api = useApi();
  const s = useLoad(() => api<{ requireStaffApproval: boolean; checkInDays: number; maxOpenRequestsPerStudent: number }>("/api/career/mentoring/staff/settings"), [api]);
  const { busy, err, msg, run } = useAction();
  const [draft, setDraft] = useState<{ requireStaffApproval: boolean; checkInDays: string; maxOpenRequestsPerStudent: string } | null>(null);
  if (s.loading && !s.data) return <Loading />;
  if (!s.data) return <ErrorBanner error={s.error} />;
  const v = draft ?? { requireStaffApproval: s.data.requireStaffApproval, checkInDays: String(s.data.checkInDays), maxOpenRequestsPerStudent: String(s.data.maxOpenRequestsPerStudent) };
  return (
    <Card title={tr("settings")}>
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <form
        className="max-w-lg space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            "save",
            () =>
              api("/api/career/mentoring/staff/settings", {
                method: "PUT",
                json: { requireStaffApproval: v.requireStaffApproval, checkInDays: Number(v.checkInDays), maxOpenRequestsPerStudent: Number(v.maxOpenRequestsPerStudent) },
              }).then(() => {
                setDraft(null);
                s.reload();
              }),
            tr("settingsSaved"),
          );
        }}
      >
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={v.requireStaffApproval} onChange={(e) => setDraft({ ...v, requireStaffApproval: e.target.checked })} />
          <span>{tr("careerCenterApprovesEachMatch")}</span>
        </label>
        <Field label={tr("checkInReminderAfterDays")}>
          {(p) => <input {...p} type="number" min={3} max={120} value={v.checkInDays} onChange={(e) => setDraft({ ...v, checkInDays: e.target.value })} />}
        </Field>
        <Field label={tr("requestsAStudentCanHave")}>
          {(p) => <input {...p} type="number" min={1} max={10} value={v.maxOpenRequestsPerStudent} onChange={(e) => setDraft({ ...v, maxOpenRequestsPerStudent: e.target.value })} />}
        </Field>
        <p className="text-xs text-muted-foreground">{tr("onlyCareerAdminsCanChange")}</p>
        <Button type="submit" busy={busy === "save"}>
          {tr("saveSettings")}
        </Button>
      </form>
    </Card>
  );
}
