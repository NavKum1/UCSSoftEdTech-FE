"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import {
  CheckboxGroup,
  MentorshipPanel,
  StatusBadge,
  splitList,
  type MentoringOptions,
  type RelationshipSummary,
  useMeetingLabels,
} from "@/components/career/mentoring/MentorshipPanel";

interface MentorProfile {
  id: string;
  name: string;
  kind: string;
  status: string;
  headline: string;
  employer?: string | null;
  jobTitle?: string | null;
  industry?: string | null;
  functions: string[];
  majors: string[];
  topics: string[];
  meetingPreferences: string[];
  capacity: number;
  activeMentees: number;
  availabilityNotes?: string | null;
  bio?: string | null;
  graduationYear?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  decisionNote?: string | null;
}

interface AlumniHome {
  isAlumni: boolean;
  school: string | null;
  profile: MentorProfile | null;
}

export default function AlumniMentoringPage() {
  const tr = useCareerT("alumniMentoring");
  const api = useApi();
  const options = useLoad(() => api<MentoringOptions>("/api/career/mentoring/options"), [api]);
  const home = useLoad(() => api<AlumniHome>("/api/career/mentoring/alumni/home"), [api]);
  const profile = home.data?.profile ?? null;
  const listed = profile && ["Approved", "Paused", "Pending", "Draft", "Rejected"].includes(profile.status);
  const rels = useLoad(
    () => (profile ? api<RelationshipSummary[]>("/api/career/mentoring/mentor/relationships") : Promise.resolve([] as RelationshipSummary[])),
    [api, profile?.id],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const act = async (key: string, path: string, body: unknown, success: string) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await api(path, { json: body ?? {} });
      setMsg(success);
      home.reload();
      rels.reload();
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (home.loading && !home.data) return <Loading />;
  if (!home.data) return <ErrorBanner error={home.error} onRetry={home.reload} />;

  const requests = (rels.data ?? []).filter((r) => r.status === "Requested");
  const mentees = (rels.data ?? []).filter((r) => r.status !== "Requested");

  return (
    <div className="space-y-6">
      <PageHeader title={tr("mentoring")} description={tr("volunteerAsAMentorFor")} />
      <ErrorBanner error={err ?? options.error ?? rels.error} />
      <SuccessBanner message={msg} />

      {profile && (
        <Card title={tr("yourStatus")} actions={<StatusBadge status={profile.status} />}>
          <div className="space-y-2 text-sm">
            {profile.status === "Pending" && <p>{tr("theCareerCenterIsReviewing")}</p>}
            {profile.status === "Rejected" && (
              <p>
                {tr("theCareerCenterAskedFor")}{profile.decisionNote ? `: ${profile.decisionNote}` : "."}{" "}{tr("updateYourProfileAndSubmit")}
              </p>
            )}
            {profile.status === "Approved" && <p>{tr("studentsAtYourSchoolCan", { activeMentees: profile.activeMentees, capacity: profile.capacity })}</p>}
            {profile.status === "Paused" && <p>{tr("yourePausedStudentsCantSend")}</p>}
            {profile.status === "Suspended" && <p>{tr("yourProfileWasSuspendedBy")}</p>}
            <div className="flex flex-wrap gap-2">
              {["Draft", "Rejected", "Invited"].includes(profile.status) && (
                <Button busy={busy === "submit"} onClick={() => act("submit", "/api/career/mentoring/mentor/profile/submit", {}, tr("submittedForApproval"))}>
                  {tr("submitForApproval")}
                </Button>
              )}
              {profile.status === "Approved" && (
                <Button variant="secondary" busy={busy === "pause"} onClick={() => act("pause", "/api/career/mentoring/mentor/profile/pause", {}, tr("newRequestsPaused"))}>
                  {tr("pauseNewRequests")}
                </Button>
              )}
              {profile.status === "Paused" && (
                <Button busy={busy === "resume"} onClick={() => act("resume", "/api/career/mentoring/mentor/profile/resume", {}, tr("youreTakingRequestsAgain"))}>
                  {tr("resumeNewRequests")}
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {profile?.status !== "Suspended" && options.data && (
        <ProfileForm
          key={profile?.id ?? "new"}
          initial={profile}
          options={options.data}
          onSaved={(text) => {
            setMsg(text);
            home.reload();
          }}
        />
      )}

      {listed && (
        <>
          <Card title={tr("requestsCount", { count: requests.length })}>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tr("noRequestsWaiting")}</p>
            ) : (
              <ul className="space-y-4">
                {requests.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">{r.studentName}</h3>
                      <span className="text-xs text-muted-foreground">{tr("sentRequestedAt", { requestedAt: formatDate(r.requestedAt) })}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap">{r.message}</p>
                    <h4 className="mt-2 font-medium">{tr("goals")}</h4>
                    <ul className="list-disc ps-5">
                      {r.goals.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                    {r.matchReasons.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{tr("inCommonMatchReasons", { matchReasons: r.matchReasons.join("; ") })}</p>}
                    <div className="mt-3">
                      <Field label={tr("noteToTheStudentOptional")}>
                        {(p) => <input {...p} maxLength={1000} value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />}
                      </Field>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button busy={busy === `a-${r.id}`} onClick={() => act(`a-${r.id}`, `/api/career/mentoring/mentor/relationships/${r.id}/accept`, { note: notes[r.id] }, tr("youAcceptedStudentName", { studentName: r.studentName }))}>
                        {tr.rich("acceptStudentName", { span: (chunks) => <span className="sr-only">{chunks}</span>, studentName: r.studentName })}
                      </Button>
                      <Button
                        variant="secondary"
                        busy={busy === `d-${r.id}`}
                        onClick={() => act(`d-${r.id}`, `/api/career/mentoring/mentor/relationships/${r.id}/decline`, { note: notes[r.id] }, tr("youDeclinedStudentNameSRequest", { studentName: r.studentName }))}
                      >
                        {tr.rich("declineStudentName", { span: (chunks) => <span className="sr-only">{chunks}</span>, studentName: r.studentName })}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={tr("yourMentees")}>
            {mentees.length === 0 ? (
              <EmptyState title={tr("noMenteesYet")}>{tr("whenYouAcceptARequest")}</EmptyState>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <ul className="space-y-2" aria-label={tr("yourMentees")}>
                  {mentees.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(r.id)}
                        aria-current={openId === r.id ? "true" : undefined}
                        className={`w-full rounded-lg border p-3 text-start text-sm focus-visible:outline-2 ${openId === r.id ? "border-[var(--brand,#4f46e5)]" : "border-border"}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-medium">{r.studentName}</span>
                          <StatusBadge status={r.status} />
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {tr("sessionsSessions", { sessions: r.sessions })}
                          {r.checkInDue ? tr("checkInDue") : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div>{openId ? <MentorshipPanel key={openId} id={openId} options={options.data} onChanged={rels.reload} /> : <p className="text-sm text-muted-foreground">{tr("chooseAMenteeToSee")}</p>}</div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function ProfileForm({ initial, options, onSaved }: { initial: MentorProfile | null; options: MentoringOptions; onSaved: (msg: string) => void }) {
  const tr = useCareerT("alumniMentoring");
  const MEETING_LABELS = useMeetingLabels();
  const api = useApi();
  const [f, setF] = useState({
    name: initial?.name ?? "",
    headline: initial?.headline ?? "",
    employer: initial?.employer ?? "",
    jobTitle: initial?.jobTitle ?? "",
    industry: initial?.industry ?? "",
    functions: (initial?.functions ?? []).join(", "),
    majors: (initial?.majors ?? []).join(", "),
    topics: initial?.topics ?? [],
    meetingPreferences: initial?.meetingPreferences ?? [],
    capacity: String(initial?.capacity ?? 2),
    availabilityNotes: initial?.availabilityNotes ?? "",
    bio: initial?.bio ?? "",
    graduationYear: initial?.graduationYear ? String(initial.graduationYear) : "",
    contactEmail: initial?.contactEmail ?? "",
    contactPhone: initial?.contactPhone ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Card title={initial ? tr("yourMentorProfile") : tr("setUpYourMentorProfile")}>
      <ErrorBanner error={err} />
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await api("/api/career/mentoring/mentor/profile", {
              method: "PUT",
              json: {
                ...f,
                functions: splitList(f.functions),
                majors: splitList(f.majors),
                capacity: Number(f.capacity),
                graduationYear: f.graduationYear ? Number(f.graduationYear) : null,
              },
            });
            onSaved(initial && initial.status !== "Invited" ? tr("profileSaved") : tr("profileSavedSubmitItFor"));
          } catch (e2) {
            setErr((e2 as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={tr("nameShownToStudents")}>{(p) => <input {...p} maxLength={120} value={f.name} onChange={set("name")} />}</Field>
        <Field label={tr("headline")} hint={tr("oneLineOnHowYou")}>
          {(p) => <input {...p} required maxLength={160} value={f.headline} onChange={set("headline")} />}
        </Field>
        <Field label={tr("employer")}>{(p) => <input {...p} maxLength={120} value={f.employer} onChange={set("employer")} />}</Field>
        <Field label={tr("jobTitle")}>{(p) => <input {...p} maxLength={120} value={f.jobTitle} onChange={set("jobTitle")} />}</Field>
        <Field label={tr("industry")}>
          {(p) => (
            <>
              <input {...p} list="mentor-industries" maxLength={80} value={f.industry} onChange={set("industry")} />
              <datalist id="mentor-industries">
                {options.industries.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label={tr("fieldsOfWork")} hint={tr("separateWithCommasEG")}>
          {(p) => <input {...p} value={f.functions} onChange={set("functions")} />}
        </Field>
        <Field label={tr("majorsYouCanHelpWith")} hint={tr("separateWithCommas")}>
          {(p) => <input {...p} value={f.majors} onChange={set("majors")} />}
        </Field>
        <Field label={tr("graduationYearAlumni")}>{(p) => <input {...p} type="number" min={1940} max={2100} value={f.graduationYear} onChange={set("graduationYear")} />}</Field>
        <div className="md:col-span-2">
          <CheckboxGroup legend={tr("topicsYouCanHelpWith")} options={options.topics.map((t) => ({ value: t.key, label: t.label }))} value={f.topics} onChange={(v) => setF({ ...f, topics: v })} />
        </div>
        <div className="md:col-span-2">
          <CheckboxGroup
            legend={tr("howYouCanMeet")}
            options={options.meetingFormats.map((m) => ({ value: m, label: MEETING_LABELS[m] ?? m }))}
            value={f.meetingPreferences}
            onChange={(v) => setF({ ...f, meetingPreferences: v })}
          />
        </div>
        <Field label={tr("maximumActiveMentees")} hint={tr("n1To10StudentsCant")}>
          {(p) => <input {...p} type="number" min={1} max={10} required value={f.capacity} onChange={set("capacity")} />}
        </Field>
        <Field label={tr("availabilityNotes")}>{(p) => <input {...p} maxLength={500} placeholder={tr("eGWeekdayEveningsCentral")} value={f.availabilityNotes} onChange={set("availabilityNotes")} />}</Field>
        <div className="md:col-span-2">
          <Field label={tr("aboutYou")}>{(p) => <textarea {...p} rows={4} maxLength={2000} value={f.bio} onChange={set("bio")} />}</Field>
        </div>
        <Field label={tr("contactEmailForMentees")} hint={tr("sharedOnlyWithStudentsWhose")}>
          {(p) => <input {...p} type="email" maxLength={200} value={f.contactEmail} onChange={set("contactEmail")} />}
        </Field>
        <Field label={tr("contactPhoneOptional")}>{(p) => <input {...p} type="tel" maxLength={40} value={f.contactPhone} onChange={set("contactPhone")} />}</Field>
        <div className="flex items-center gap-3 md:col-span-2">
          <Button type="submit" busy={busy}>
            {tr("saveProfile")}
          </Button>
          {initial?.status === "Approved" && <Badge tone="info">{tr("changesShowToStudentsRight")}</Badge>}
        </div>
      </form>
    </Card>
  );
}
