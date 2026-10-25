"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import {
  CheckboxGroup,
  MentorshipPanel,
  StatusBadge,
  splitList,
  topicLabel,
  type MentoringOptions,
  type RelationshipSummary,
  useMeetingLabels,
} from "@/components/career/mentoring/MentorshipPanel";

interface MentorCard {
  id: string;
  name: string;
  kind: string;
  headline: string;
  employer?: string | null;
  jobTitle?: string | null;
  industry?: string | null;
  functions: string[];
  majors: string[];
  topics: string[];
  meetingPreferences: string[];
  capacity: number;
  spotsLeft: number;
  availabilityNotes?: string | null;
  bio?: string | null;
  graduationYear?: number | null;
  match: { score: number; reasons: string[] } | null;
  myStatus?: string | null;
}

interface Preferences {
  industries: string[];
  functions: string[];
  topics: string[];
  majors: string[];
}

type Tab = "find" | "mine";

export default function StudentMentoringPage() {
  const tr = useCareerT("studentMentoring");
  const api = useApi();
  const [tab, setTab] = useState<Tab>("find");
  const options = useLoad(() => api<MentoringOptions>("/api/career/mentoring/options"), [api]);
  const mine = useLoad(() => api<RelationshipSummary[]>("/api/career/mentoring/student/relationships"), [api]);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title={tr("mentoring")}
        description={tr("connectWithAlumniAndProfessionals")}
      />
      <ErrorBanner error={options.error ?? mine.error} />
      <div role="tablist" aria-label={tr("mentoringSections")} className="mb-6 flex gap-2 border-b border-border">
        {(
          [
            ["find", tr("tabFind")],
            ["mine", mine.data ? tr("tabMineCount", { count: mine.data.length }) : tr("tabMine")],
          ] as [Tab, string][]
        ).map(([key, label]) => (
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

      {tab === "find" && (
        <div role="tabpanel" id="panel-find" aria-labelledby="tab-find">
          <FindMentor
            options={options.data}
            onRequested={(id) => {
              mine.reload();
              setOpenId(id);
              setTab("mine");
            }}
          />
        </div>
      )}
      {tab === "mine" && (
        <div role="tabpanel" id="panel-mine" aria-labelledby="tab-mine">
          {mine.loading && !mine.data ? (
            <Loading />
          ) : (mine.data ?? []).length === 0 ? (
            <EmptyState title={tr("noMentorshipsYet")}>{tr("findAMentorAndSend")}</EmptyState>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <ul className="space-y-2" aria-label={tr("yourMentorships")}>
                {mine.data!.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(r.id)}
                      aria-current={openId === r.id ? "true" : undefined}
                      className={`w-full rounded-lg border p-3 text-start text-sm focus-visible:outline-2 ${openId === r.id ? "border-[var(--brand,#4f46e5)]" : "border-border"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{r.mentorName}</span>
                        <StatusBadge status={r.status} />
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {tr("requestedRequestedAtSessionsSessions", { sessions: r.sessions, requestedAt: formatDate(r.requestedAt) })}
                        {r.checkInDue ? tr("checkInDue") : ""}
                      </span>
                    </button>
                    {(r.status === "Requested" || r.status === "PendingStaff") && (
                      <WithdrawButton id={r.id} onDone={mine.reload} />
                    )}
                  </li>
                ))}
              </ul>
              <div>{openId ? <MentorshipPanel key={openId} id={openId} options={options.data} onChanged={mine.reload} /> : <p className="text-sm text-muted-foreground">{tr("chooseAMentorshipToSee")}</p>}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WithdrawButton({ id, onDone }: { id: string; onDone: () => void }) {
  const tr = useCareerT("studentMentoring");
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-1">
      <Button
        variant="ghost"
        busy={busy}
        onClick={async () => {
          if (!window.confirm(tr("withdrawThisRequest"))) return;
          setBusy(true);
          try {
            await api(`/api/career/mentoring/student/relationships/${id}/withdraw`, { method: "POST" });
            onDone();
          } catch (e) {
            setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {tr("withdrawRequest")}
      </Button>
      {err && <p role="alert" className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

function FindMentor({ options, onRequested }: { options: MentoringOptions | null; onRequested: (relationshipId: string) => void }) {
  const tr = useCareerT("studentMentoring");
  const MEETING_LABELS = useMeetingLabels();
  const api = useApi();
  const [filters, setFilters] = useState({ q: "", industry: "", topic: "", major: "", function: "", meeting: "", kind: "", hasCapacity: true });
  const [applied, setApplied] = useState(filters);
  const query = new URLSearchParams(
    Object.entries(applied)
      .filter(([, v]) => v !== "" && v !== false)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  const results = useLoad(() => api<{ total: number; items: MentorCard[] }>(`/api/career/mentoring/student/mentors?${query}`), [api, query]);
  const suggestions = useLoad(() => api<{ explanation: string; items: MentorCard[] }>("/api/career/mentoring/student/suggestions"), [api]);
  const prefs = useLoad(() => api<Preferences>("/api/career/mentoring/student/preferences"), [api]);
  const [requesting, setRequesting] = useState<MentorCard | null>(null);
  const [editPrefs, setEditPrefs] = useState(false);

  return (
    <div className="space-y-6">
      <Card
        title={tr("suggestedForYou")}
        actions={
          <Button variant="secondary" onClick={() => setEditPrefs(!editPrefs)} aria-expanded={editPrefs}>
            {editPrefs ? tr("closePreferences") : tr("editWhatImLookingFor")}
          </Button>
        }
      >
        {editPrefs && prefs.data && options && (
          <PreferencesForm
            initial={prefs.data}
            options={options}
            onSaved={(p) => {
              prefs.setData(p);
              setEditPrefs(false);
              suggestions.reload();
              results.reload();
            }}
          />
        )}
        <p className="mb-3 text-xs text-muted-foreground">{suggestions.data?.explanation ?? options?.scoring}</p>
        {prefs.data && prefs.data.majors.length === 0 && (
          <p className="mb-3 text-sm">{tr("tipAddYourMajorOn")}</p>
        )}
        {suggestions.loading && !suggestions.data ? (
          <Loading />
        ) : (suggestions.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr("noSuggestionsYetTellUs")}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {suggestions.data!.items.map((m) => (
              <MentorItem key={m.id} m={m} options={options} onRequest={() => setRequesting(m)} />
            ))}
          </ul>
        )}
      </Card>

      {requesting && (
        <RequestForm
          mentor={requesting}
          options={options}
          onCancel={() => setRequesting(null)}
          onDone={(id) => {
            setRequesting(null);
            results.reload();
            suggestions.reload();
            onRequested(id);
          }}
        />
      )}

      <Card title={tr("browseMentors")}>
        <form
          className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(filters);
          }}
          role="search"
          aria-label={tr("searchMentors")}
        >
          <Field label={tr("search")}>{(p) => <input {...p} type="search" placeholder={tr("nameEmployerRole")} value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />}</Field>
          <Field label={tr("industry")}>
            {(p) => (
              <>
                <input {...p} list="mentoring-industries" value={filters.industry} onChange={(e) => setFilters({ ...filters, industry: e.target.value })} />
                <datalist id="mentoring-industries">
                  {(options?.industries ?? []).map((i) => (
                    <option key={i} value={i} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label={tr("canHelpWith")}>
            {(p) => (
              <select {...p} value={filters.topic} onChange={(e) => setFilters({ ...filters, topic: e.target.value })}>
                <option value="">{tr("anyTopic")}</option>
                {(options?.topics ?? []).map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={tr("major")}>{(p) => <input {...p} value={filters.major} onChange={(e) => setFilters({ ...filters, major: e.target.value })} />}</Field>
          <Field label={tr("fieldOfWork")}>{(p) => <input {...p} value={filters.function} onChange={(e) => setFilters({ ...filters, function: e.target.value })} />}</Field>
          <Field label={tr("meetingFormat")}>
            {(p) => (
              <select {...p} value={filters.meeting} onChange={(e) => setFilters({ ...filters, meeting: e.target.value })}>
                <option value="">{tr("any")}</option>
                {(options?.meetingFormats ?? []).map((f) => (
                  <option key={f} value={f}>
                    {MEETING_LABELS[f] ?? f}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={tr("mentorType")}>
            {(p) => (
              <select {...p} value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value })}>
                <option value="">{tr("alumniAndProfessionals")}</option>
                <option value="Alumni">{tr("alumni")}</option>
                <option value="Professional">{tr("professionals")}</option>
              </select>
            )}
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={filters.hasCapacity} onChange={(e) => setFilters({ ...filters, hasCapacity: e.target.checked })} />
              {tr("onlyMentorsWithOpenSpots")}
            </label>
            <Button type="submit">{tr("search")}</Button>
          </div>
        </form>
        <ErrorBanner error={results.error} />
        <p role="status" aria-live="polite" className="mb-3 text-sm text-muted-foreground">
          {results.data ? tr("totalMentorsFound", { total: results.data.total }) : ""}
        </p>
        {results.loading && !results.data ? (
          <Loading />
        ) : (results.data?.items ?? []).length === 0 ? (
          <EmptyState title={tr("noMentorsMatch")}>{tr("tryFewerFilters")}</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {results.data!.items.map((m) => (
              <MentorItem key={m.id} m={m} options={options} onRequest={() => setRequesting(m)} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MentorItem({ m, options, onRequest }: { m: MentorCard; options: MentoringOptions | null; onRequest: () => void }) {
  const tr = useCareerT("studentMentoring");
  const MEETING_LABELS = useMeetingLabels();
  return (
    <li className="rounded-lg border border-border p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{m.name}</h3>
          <p className="text-muted-foreground">{[m.jobTitle, m.employer].filter(Boolean).join(" at ")}</p>
        </div>
        <Badge tone="info">{m.kind === "Alumni" ? tr("alumValue", { value: m.graduationYear ? ` '${String(m.graduationYear).slice(-2)}` : "" }) : tr("professional")}</Badge>
      </div>
      <p className="mt-2">{m.headline}</p>
      <dl className="mt-2 space-y-1 text-xs">
        {m.industry && (
          <div>
            <dt className="inline font-medium">{tr("industry2")}{" "}</dt>
            <dd className="inline">{m.industry}</dd>
          </div>
        )}
        {m.majors.length > 0 && (
          <div>
            <dt className="inline font-medium">{tr("majors")}{" "}</dt>
            <dd className="inline">{m.majors.join(", ")}</dd>
          </div>
        )}
        <div>
          <dt className="inline font-medium">{tr("helpsWith")}{" "}</dt>
          <dd className="inline">{m.topics.map((t) => topicLabel(options, t)).join(", ")}</dd>
        </div>
        <div>
          <dt className="inline font-medium">{tr("meetsBy")}{" "}</dt>
          <dd className="inline">{m.meetingPreferences.map((f) => MEETING_LABELS[f] ?? f).join(", ")}</dd>
        </div>
        {m.availabilityNotes && (
          <div>
            <dt className="inline font-medium">{tr("availability")}{" "}</dt>
            <dd className="inline">{m.availabilityNotes}</dd>
          </div>
        )}
        <div>
          <dt className="inline font-medium">{tr("openSpots")}{" "}</dt>
          <dd className="inline">
            {tr("spotsLeftOfCapacity", { spotsLeft: m.spotsLeft, capacity: m.capacity })}
          </dd>
        </div>
      </dl>
      {m.bio && <p className="mt-2 text-xs text-muted-foreground">{m.bio}</p>}
      {m.match && m.match.score > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-medium">{tr("whyThisMentorMatchScore", { score: m.match.score })}</summary>
          <ul className="mt-1 list-disc ps-5">
            {m.match.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-3">
        {m.myStatus ? (
          <StatusBadge status={m.myStatus} />
        ) : m.spotsLeft > 0 ? (
          <Button onClick={onRequest}>
            {tr.rich("askForMentoringFromName", { span: (chunks) => <span className="sr-only">{chunks}</span>, name: m.name })}
          </Button>
        ) : (
          <Badge>{tr("noOpenSpots")}</Badge>
        )}
      </div>
    </li>
  );
}

function PreferencesForm({ initial, options, onSaved }: { initial: Preferences; options: MentoringOptions; onSaved: (p: Preferences) => void }) {
  const tr = useCareerT("studentMentoring");
  const api = useApi();
  const [topics, setTopics] = useState(initial.topics);
  const [industries, setIndustries] = useState(initial.industries.join(", "));
  const [functions, setFunctions] = useState(initial.functions.join(", "));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="mb-4 space-y-3 rounded-lg border border-border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          onSaved(await api<Preferences>("/api/career/mentoring/student/preferences", { method: "PUT", json: { topics, industries: splitList(industries), functions: splitList(functions) } }));
        } catch (e2) {
          setErr(e2 instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e2 as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ErrorBanner error={err} />
      <p className="text-sm">
        {tr("yourMajorsFromYourCareer")}{" "}<strong>{initial.majors.length ? initial.majors.join(", ") : tr("noneYet")}</strong>
      </p>
      <CheckboxGroup legend={tr("topicsIWantHelpWith")} options={options.topics.map((t) => ({ value: t.key, label: t.label }))} value={topics} onChange={setTopics} />
      <Field label={tr("industriesImInterestedIn")} hint={tr("separateWithCommasEG", { industries: options.industries.slice(0, 3).join(", ") })}>
        {(p) => <input {...p} value={industries} onChange={(e) => setIndustries(e.target.value)} />}
      </Field>
      <Field label={tr("fieldsOfWorkImInterested")} hint={tr("separateWithCommasEG2", { functions: options.functions.slice(0, 3).join(", ") })}>
        {(p) => <input {...p} value={functions} onChange={(e) => setFunctions(e.target.value)} />}
      </Field>
      <Button type="submit" busy={busy}>
        {tr("savePreferences")}
      </Button>
    </form>
  );
}

function RequestForm({ mentor, options, onCancel, onDone }: { mentor: MentorCard; options: MentoringOptions | null; onCancel: () => void; onDone: (id: string) => void }) {
  const tr = useCareerT("studentMentoring");
  const api = useApi();
  const [message, setMessage] = useState("");
  const [goals, setGoals] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return (
    <Card title={tr("askNameForMentoring", { name: mentor.name })}>
      <ErrorBanner error={err} />
      <SuccessBanner message={ok} />
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            const res = await api<{ relationship: { id: string } }>("/api/career/mentoring/student/requests", {
              json: { mentorId: mentor.id, message, goals: goals.split("\n").map((g) => g.trim()).filter(Boolean), consentToShareContact: consent },
            });
            setOk(tr("requestSent"));
            onDone(res.relationship.id);
          } catch (e2) {
            setErr(e2 instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e2 as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={tr("messageToTheMentor")} hint={tr("introduceYourselfAndSayWhy")}>
          {(p) => <textarea {...p} rows={5} required minLength={20} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />}
        </Field>
        <Field label={tr("yourGoalsOnePerLine")}>{(p) => <textarea {...p} rows={3} required value={goals} onChange={(e) => setGoals(e.target.value)} />}</Field>
        <div className="rounded-md border border-border p-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            <span>
              {tr("iAgreeThatMySchool", { name: mentor.name })}{options?.requireStaffApproval ? tr("andTheCareerCenterConfirms") : ""}{tr("iCanWithdrawTheRequest")}
            </span>
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" busy={busy} disabled={!consent}>
            {tr("sendRequest")}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {tr("cancel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
