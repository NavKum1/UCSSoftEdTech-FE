"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import { MEETING_LABELS, REPORT_REASON_LABELS, STATUS_LABELS, StatusBadge, topicLabel, type MentoringOptions, type RelationshipSummary } from "@/components/career/mentoring/MentorshipPanel";

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
const TABS: [Tab, string][] = [
  ["overview", "Overview"],
  ["mentors", "Mentors"],
  ["mentorships", "Mentorships"],
  ["reports", "Reports"],
  ["alumni", "Alumni"],
  ["settings", "Settings"],
];

export default function CareerCenterMentoringPage() {
  const api = useApi();
  const [tab, setTab] = useState<Tab>("overview");
  const options = useLoad(() => api<MentoringOptions>("/api/career/mentoring/options"), [api]);

  return (
    <div>
      <PageHeader title="Mentoring network" description="Approve volunteer mentors, follow mentorships and handle safety reports. Private session notes stay between each pair." />
      <div role="tablist" aria-label="Mentoring administration" className="mb-6 flex flex-wrap gap-2 border-b border-border">
        {TABS.map(([key, label]) => (
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
  const api = useApi();
  const stats = useLoad(() => api<Stats>("/api/career/mentoring/staff/stats"), [api]);
  const { busy, err, msg, run } = useAction();

  const download = async (path: string, name: string) => {
    await run(
      name,
      async () => {
        const res = await api<Response>(path, { raw: true });
        if (!res.ok) throw new Error(`Export failed (${res.status})`);
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      },
      "Download started.",
    );
  };

  if (stats.loading && !stats.data) return <Loading />;
  const s = stats.data;
  const tiles: [string, string | number][] = s
    ? [
        ["Listed mentors", s.mentorsByStatus.Approved ?? 0],
        ["Mentors waiting for approval", s.mentorsByStatus.Pending ?? 0],
        ["Active mentorships", s.relationshipsByStatus.Active ?? 0],
        ["Requests waiting", (s.relationshipsByStatus.Requested ?? 0) + (s.relationshipsByStatus.PendingStaff ?? 0)],
        ["Completed mentorships", s.relationshipsByStatus.Completed ?? 0],
        ["Students mentored", s.studentsMentored],
        ["Sessions (last 90 days)", s.sessionsLast90Days],
        ["Hours (last 90 days)", s.hoursLast90Days],
        ["Average rating from students", s.averageRatingFromStudents ?? "—"],
        ["Average rating from mentors", s.averageRatingFromMentors ?? "—"],
        ["Open reports", s.openReports],
        ["Check-ins due", s.checkInDue],
        ["Alumni", s.alumni],
      ]
    : [];

  return (
    <div className="space-y-6">
      <ErrorBanner error={err ?? stats.error} />
      <SuccessBanner message={msg} />
      <Card title="Activity">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Check-in reminders">
        <p className="mb-3 text-sm">Send a reminder to both sides of every active mentorship with no session logged recently. Pairs reminded in the same period are skipped.</p>
        <Button busy={busy === "checkins"} onClick={() => run("checkins", () => api<{ sent: number }>("/api/career/mentoring/staff/check-ins/send", { method: "POST" }).then((r) => { stats.reload(); return r; }), (r) => `Reminders sent to ${(r as { sent: number }).sent} mentorship(s).`)}>
          Send check-in reminders
        </Button>
      </Card>
      <Card title="Export">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" busy={busy === "mentorships.csv"} onClick={() => download("/api/career/mentoring/staff/export/relationships.csv", "mentorships.csv")}>
            Download mentorships (CSV)
          </Button>
          <Button variant="secondary" busy={busy === "mentors.csv"} onClick={() => download("/api/career/mentoring/staff/export/mentors.csv", "mentors.csv")}>
            Download mentors (CSV)
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Exports never include private session notes.</p>
      </Card>
    </div>
  );
}

function Mentors({ options }: { options: MentoringOptions | null }) {
  const api = useApi();
  const [status, setStatus] = useState("Pending");
  const list = useLoad(() => api<StaffMentor[]>(`/api/career/mentoring/staff/mentors${status ? `?status=${status}` : ""}`), [api, status]);
  const { busy, err, msg, run } = useAction();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [invite, setInvite] = useState({ email: "", name: "", employer: "" });

  const decide = (id: string, action: string, name: string) =>
    run(`${action}-${id}`, () => api(`/api/career/mentoring/staff/mentors/${id}/decision`, { json: { action, note: notes[id] } }).then(() => list.reload()), `${name}: ${action} done.`);

  return (
    <div className="space-y-6">
      <ErrorBanner error={err ?? list.error} />
      <SuccessBanner message={msg} />
      <Card title="Invite a professional mentor">
        <p className="mb-3 text-sm text-muted-foreground">
          Alumni can set up a profile themselves. To add someone who isn&apos;t an alum, invite them here; they sign in with this email, complete a profile and you approve it. Share the sign-in link with them yourself.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run("invite", () => api("/api/career/mentoring/staff/mentors/invite", { json: invite }), `Invited ${invite.name}.`);
            if (ok) {
              setInvite({ email: "", name: "", employer: "" });
              list.reload();
            }
          }}
        >
          <Field label="Name">{(p) => <input {...p} required value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />}</Field>
          <Field label="Email">{(p) => <input {...p} type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />}</Field>
          <Field label="Employer (optional)">{(p) => <input {...p} value={invite.employer} onChange={(e) => setInvite({ ...invite, employer: e.target.value })} />}</Field>
          <div className="flex items-end">
            <Button type="submit" busy={busy === "invite"}>
              Invite
            </Button>
          </div>
        </form>
      </Card>

      <Card
        title="Mentors"
        actions={
          <Field label="Show">
            {(p) => (
              <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
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
          <EmptyState title="No mentors here" />
        ) : (
          <ul className="space-y-4">
            {list.data!.map(({ profile: p, matchingPaused }) => (
              <li key={p.id} className="rounded-lg border border-border p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">{p.name}</h3>
                    <p className="text-muted-foreground">
                      {p.email} · {p.kind}
                      {p.submittedAt ? ` · submitted ${formatDate(p.submittedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge status={p.status} />
                    {matchingPaused && <Badge tone="bad">New matches paused (report)</Badge>}
                  </div>
                </div>
                <p className="mt-2">{p.headline || <em>No headline yet</em>}</p>
                <p className="text-xs text-muted-foreground">
                  {[p.jobTitle, p.employer, p.industry].filter(Boolean).join(" · ")}
                  {p.majors.length ? ` · Majors: ${p.majors.join(", ")}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Topics: {p.topics.map((t) => topicLabel(options, t)).join(", ") || "—"} · Meets by: {p.meetingPreferences.map((m) => MEETING_LABELS[m] ?? m).join(", ") || "—"} · Mentees{" "}
                  {p.activeMentees}/{p.capacity}
                </p>
                {p.bio && <p className="mt-1 text-xs">{p.bio}</p>}
                {p.decisionNote && <p className="mt-1 text-xs">Last note: {p.decisionNote}</p>}
                {p.status !== "Invited" && p.status !== "Draft" && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <Field label="Note to the mentor" hint="Required to request changes or suspend.">
                      {(fp) => <input {...fp} value={notes[p.id] ?? ""} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} />}
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      {["Pending", "Rejected", "Suspended"].includes(p.status) && (
                        <Button busy={busy === `approve-${p.id}`} onClick={() => decide(p.id, "approve", p.name)}>
                          Approve<span className="sr-only"> {p.name}</span>
                        </Button>
                      )}
                      {p.status === "Pending" && (
                        <Button variant="secondary" busy={busy === `reject-${p.id}`} onClick={() => decide(p.id, "reject", p.name)}>
                          Request changes<span className="sr-only"> from {p.name}</span>
                        </Button>
                      )}
                      {p.status !== "Suspended" && (
                        <Button variant="danger" busy={busy === `suspend-${p.id}`} onClick={() => window.confirm(`Suspend ${p.name}?`) && decide(p.id, "suspend", p.name)}>
                          Suspend<span className="sr-only"> {p.name}</span>
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
  const api = useApi();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(applied ? { q: applied } : {}) }).toString();
  const list = useLoad(() => api<StaffRelationship[]>(`/api/career/mentoring/staff/relationships?${qs}`), [api, qs]);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card title="Mentorships">
        <form
          role="search"
          aria-label="Filter mentorships"
          className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(q);
          }}
        >
          <Field label="Status">
            {(p) => (
              <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="CheckInDue">Check-in due</option>
                {["PendingStaff", "Requested", "Active", "Completed", "Ended", "Declined", "Withdrawn"].map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Student or mentor name">{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
          <Button type="submit">Filter</Button>
        </form>
        <ErrorBanner error={list.error} />
        <p role="status" aria-live="polite" className="sr-only">
          {list.data ? `${list.data.length} mentorships` : ""}
        </p>
        {list.loading && !list.data ? (
          <Loading />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState title="No mentorships match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Mentorships</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-3 font-medium">Student</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Mentor</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Sessions</th>
                  <th scope="col" className="py-2 font-medium"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {list.data!.map(({ summary: r }) => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="py-2 pr-3">{r.studentName}</td>
                    <td className="py-2 pr-3">{r.mentorName}</td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={r.status} /> {r.checkInDue && <Badge tone="warn">Check-in due</Badge>}
                    </td>
                    <td className="py-2 pr-3">{r.sessions}</td>
                    <td className="py-2">
                      <Button variant="ghost" onClick={() => setOpenId(r.id)} aria-current={openId === r.id ? "true" : undefined}>
                        View<span className="sr-only"> mentorship of {r.studentName} with {r.mentorName}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div>{openId ? <StaffRelationshipView key={openId} id={openId} onChanged={list.reload} /> : <p className="text-sm text-muted-foreground">Choose a mentorship to see details.</p>}</div>
    </div>
  );
}

function StaffRelationshipView({ id, onChanged }: { id: string; onChanged: () => void }) {
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
      approve ? "Match approved; contact details exchanged." : "Match declined.",
    );

  return (
    <Card title={`${r.studentName} with ${r.mentorName}`} actions={<StatusBadge status={r.status} />}>
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Requested</dt>
          <dd>{formatDate(r.requestedAt)}</dd>
        </div>
        <div>
          <dt className="font-medium">Started</dt>
          <dd>{formatDate(r.startedAt)}</dd>
        </div>
        <div>
          <dt className="font-medium">Contact exchanged</dt>
          <dd>{r.contactShared ? "Yes (logged disclosure)" : "No"}</dd>
        </div>
        <div>
          <dt className="font-medium">Time together</dt>
          <dd>
            {r.sessions} sessions, {Math.round((r.totalMinutes / 60) * 10) / 10} hours
          </dd>
        </div>
      </dl>
      <h3 className="mt-4 text-sm font-semibold">Goals</h3>
      <ul className="list-disc pl-5 text-sm">
        {r.goals.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
      {r.status === "PendingStaff" && (
        <div className="mt-4 space-y-2 rounded-md border border-border p-3">
          <h3 className="text-sm font-semibold">This match needs your approval</h3>
          <p className="text-sm">{r.message}</p>
          <Field label="Note (optional)">{(p) => <input {...p} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          <div className="flex gap-2">
            <Button busy={busy === "approve"} onClick={() => decide(true)}>
              Approve match
            </Button>
            <Button variant="secondary" busy={busy === "decline"} onClick={() => decide(false)}>
              Decline match
            </Button>
          </div>
        </div>
      )}
      <h3 className="mt-4 text-sm font-semibold">Sessions</h3>
      <p className="text-xs text-muted-foreground">Private notes are not shown to staff.</p>
      {d.data.sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">None logged.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {d.data.sessions.map((s) => (
            <li key={s.id} className="py-2">
              {formatDate(s.occurredOn)} · {s.durationMinutes} min · {MEETING_LABELS[s.format] ?? s.format} · logged by {s.loggedBy.toLowerCase()}
              {s.sharedSummary && <p className="text-muted-foreground">Summary: {s.sharedSummary}</p>}
            </li>
          ))}
        </ul>
      )}
      {d.data.feedback.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold">Feedback</h3>
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
          <Badge tone="bad">{d.data.reports.length} report(s)</Badge> See the Reports tab.
        </p>
      )}
    </Card>
  );
}

function Reports() {
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
      outcome === "Dismiss" ? "Report dismissed; the matching hold from it was lifted." : "Report upheld.",
    );
  };

  return (
    <div className="space-y-6">
      <ErrorBanner error={err ?? reports.error ?? holds.error} />
      <SuccessBanner message={msg} />
      <Card
        title="Reports"
        actions={
          <Field label="Show">
            {(p) => (
              <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Open">Open</option>
                <option value="Upheld">Upheld</option>
                <option value="Dismissed">Dismissed</option>
                <option value="">All</option>
              </select>
            )}
          </Field>
        }
      >
        {reports.loading && !reports.data ? (
          <Loading />
        ) : (reports.data ?? []).length === 0 ? (
          <EmptyState title="No reports" />
        ) : (
          <ul className="space-y-4">
            {reports.data!.map((x) => (
              <li key={x.id} className="rounded-lg border border-border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {REPORT_REASON_LABELS[x.reason] ?? x.reason}: {x.reported ?? "Unknown"} ({x.reportedRole.toLowerCase()})
                  </h3>
                  <StatusBadge status={x.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Reported by {x.reporter ?? "unknown"} on {formatDate(x.createdAt, true)}
                  {x.blocked ? " · reporter blocked them" : ""}
                  {x.relationshipStatus ? ` · mentorship ${STATUS_LABELS[x.relationshipStatus]?.toLowerCase() ?? x.relationshipStatus}` : ""}
                  {x.reportedMatchingPaused ? " · new matches paused" : ""}
                </p>
                <p className="mt-2 whitespace-pre-wrap">{x.details}</p>
                {x.resolutionNote && <p className="mt-2 text-xs">Resolution: {x.resolutionNote}</p>}
                {x.status === "Open" && (
                  <div className="mt-3 space-y-2">
                    <Field label="Resolution note">
                      {(p) => <textarea {...p} rows={2} value={form[x.id]?.note ?? ""} onChange={(e) => setForm({ ...form, [x.id]: { note: e.target.value, remove: form[x.id]?.remove ?? false } })} />}
                    </Field>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={form[x.id]?.remove ?? false} onChange={(e) => setForm({ ...form, [x.id]: { note: form[x.id]?.note ?? "", remove: e.target.checked } })} />
                      If upheld, remove them from the network and end their open mentorships
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" busy={busy === `Dismiss-${x.id}`} onClick={() => resolve(x, "Dismiss")}>
                        Dismiss and lift hold
                      </Button>
                      <Button variant="danger" busy={busy === `Uphold-${x.id}`} onClick={() => resolve(x, "Uphold")}>
                        Uphold
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="People with new matches paused">
        {(holds.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody is paused.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {holds.data!.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {h.name ?? "Unknown"} – {h.reason} (since {formatDate(h.createdAt)})
                </span>
                <Button
                  variant="secondary"
                  busy={busy === `lift-${h.id}`}
                  onClick={() => run(`lift-${h.id}`, () => api(`/api/career/mentoring/staff/suspensions/${h.id}/lift`, { method: "POST" }).then(() => holds.reload()), "Hold lifted.")}
                >
                  Lift hold<span className="sr-only"> for {h.name}</span>
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
        return g.dryRun ? `${g.converted.length} student(s) would become alumni.` : `${g.converted.length} student(s) are now alumni.`;
      },
    );

  return (
    <div className="space-y-6">
      <ErrorBanner error={err ?? alumni.error} />
      <SuccessBanner message={msg} />
      <Card title="Graduate a cohort">
        <p className="mb-3 text-sm">
          Turns students whose school-recorded graduation date (from your roster import) is on or before the date below into alumni. They keep access to career services and can volunteer as mentors.
          Nothing changes until you confirm. To add alumni who aren&apos;t on the roster, invite them with the Alumni role on the People page.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Graduated on or before">{(p) => <input {...p} type="date" value={cutoff} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setCutoff(e.target.value)} />}</Field>
          <Button variant="secondary" busy={busy === "preview"} onClick={() => go(true)}>
            Preview
          </Button>
          {preview && preview.converted.length > 0 && (
            <Button busy={busy === "graduate"} onClick={() => window.confirm(`Convert ${preview.converted.length} student(s) to alumni?`) && go(false)}>
              Convert {preview.converted.length} to alumni
            </Button>
          )}
        </div>
        {preview && (
          <div className="mt-4 text-sm">
            {preview.converted.length === 0 ? (
              <p>No students match.</p>
            ) : (
              <ul className="list-disc pl-5">
                {preview.converted.map((c) => (
                  <li key={c.id}>
                    {c.name} ({c.email}){c.graduationDate ? ` – graduated ${formatDate(c.graduationDate)}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {preview.skipped.length > 0 && <p className="mt-2 text-muted-foreground">Skipped: {preview.skipped.map((s) => `${s.name} (${s.reason})`).join("; ")}</p>}
          </div>
        )}
      </Card>
      <Card title={`Alumni (${alumni.data?.length ?? 0})`}>
        {alumni.loading && !alumni.data ? (
          <Loading />
        ) : (alumni.data ?? []).length === 0 ? (
          <EmptyState title="No alumni yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Alumni</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-3 font-medium">Name</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Email</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Account</th>
                  <th scope="col" className="py-2 font-medium">Mentor profile</th>
                </tr>
              </thead>
              <tbody>
                {alumni.data!.map((a) => (
                  <tr key={a.id} className="border-b border-border">
                    <td className="py-2 pr-3">{a.name}</td>
                    <td className="py-2 pr-3">{a.email}</td>
                    <td className="py-2 pr-3">{a.status === "Invited" ? "Not signed in yet" : a.status}</td>
                    <td className="py-2">{a.mentorStatus ? <StatusBadge status={a.mentorStatus} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Settings() {
  const api = useApi();
  const s = useLoad(() => api<{ requireStaffApproval: boolean; checkInDays: number; maxOpenRequestsPerStudent: number }>("/api/career/mentoring/staff/settings"), [api]);
  const { busy, err, msg, run } = useAction();
  const [draft, setDraft] = useState<{ requireStaffApproval: boolean; checkInDays: string; maxOpenRequestsPerStudent: string } | null>(null);
  if (s.loading && !s.data) return <Loading />;
  if (!s.data) return <ErrorBanner error={s.error} />;
  const v = draft ?? { requireStaffApproval: s.data.requireStaffApproval, checkInDays: String(s.data.checkInDays), maxOpenRequestsPerStudent: String(s.data.maxOpenRequestsPerStudent) };
  return (
    <Card title="Settings">
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
            "Settings saved.",
          );
        }}
      >
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={v.requireStaffApproval} onChange={(e) => setDraft({ ...v, requireStaffApproval: e.target.checked })} />
          <span>Career center approves each match after the mentor accepts (contact details are exchanged only after approval)</span>
        </label>
        <Field label="Check-in reminder after (days without a session)">
          {(p) => <input {...p} type="number" min={3} max={120} value={v.checkInDays} onChange={(e) => setDraft({ ...v, checkInDays: e.target.value })} />}
        </Field>
        <Field label="Requests a student can have waiting at once">
          {(p) => <input {...p} type="number" min={1} max={10} value={v.maxOpenRequestsPerStudent} onChange={(e) => setDraft({ ...v, maxOpenRequestsPerStudent: e.target.value })} />}
        </Field>
        <p className="text-xs text-muted-foreground">Only career admins can change settings.</p>
        <Button type="submit" busy={busy === "save"}>
          Save settings
        </Button>
      </form>
    </Card>
  );
}
