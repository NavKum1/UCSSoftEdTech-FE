"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import {
  CheckboxGroup,
  MEETING_LABELS,
  MentorshipPanel,
  StatusBadge,
  splitList,
  topicLabel,
  type MentoringOptions,
  type RelationshipSummary,
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
  const api = useApi();
  const [tab, setTab] = useState<Tab>("find");
  const options = useLoad(() => api<MentoringOptions>("/api/career/mentoring/options"), [api]);
  const mine = useLoad(() => api<RelationshipSummary[]>("/api/career/mentoring/student/relationships"), [api]);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Mentoring"
        description="Connect with alumni and professionals your career center has approved. Mentors volunteer their time, so be clear about what you'd like help with."
      />
      <ErrorBanner error={options.error ?? mine.error} />
      <div role="tablist" aria-label="Mentoring sections" className="mb-6 flex gap-2 border-b border-border">
        {(
          [
            ["find", "Find a mentor"],
            ["mine", `My mentorships${mine.data ? ` (${mine.data.length})` : ""}`],
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
            <EmptyState title="No mentorships yet">Find a mentor and send a request to get started.</EmptyState>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <ul className="space-y-2" aria-label="Your mentorships">
                {mine.data!.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(r.id)}
                      aria-current={openId === r.id ? "true" : undefined}
                      className={`w-full rounded-lg border p-3 text-left text-sm focus-visible:outline-2 ${openId === r.id ? "border-[var(--brand,#4f46e5)]" : "border-border"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{r.mentorName}</span>
                        <StatusBadge status={r.status} />
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Requested {formatDate(r.requestedAt)} · {r.sessions} session{r.sessions === 1 ? "" : "s"}
                        {r.checkInDue ? " · check-in due" : ""}
                      </span>
                    </button>
                    {(r.status === "Requested" || r.status === "PendingStaff") && (
                      <WithdrawButton id={r.id} onDone={mine.reload} />
                    )}
                  </li>
                ))}
              </ul>
              <div>{openId ? <MentorshipPanel key={openId} id={openId} options={options.data} onChanged={mine.reload} /> : <p className="text-sm text-muted-foreground">Choose a mentorship to see details.</p>}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WithdrawButton({ id, onDone }: { id: string; onDone: () => void }) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-1">
      <Button
        variant="ghost"
        busy={busy}
        onClick={async () => {
          if (!window.confirm("Withdraw this request?")) return;
          setBusy(true);
          try {
            await api(`/api/career/mentoring/student/relationships/${id}/withdraw`, { method: "POST" });
            onDone();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Withdraw request
      </Button>
      {err && <p role="alert" className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

function FindMentor({ options, onRequested }: { options: MentoringOptions | null; onRequested: (relationshipId: string) => void }) {
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
        title="Suggested for you"
        actions={
          <Button variant="secondary" onClick={() => setEditPrefs(!editPrefs)} aria-expanded={editPrefs}>
            {editPrefs ? "Close preferences" : "Edit what I'm looking for"}
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
          <p className="mb-3 text-sm">Tip: add your major on your career record so we can suggest mentors who studied it.</p>
        )}
        {suggestions.loading && !suggestions.data ? (
          <Loading />
        ) : (suggestions.data?.items ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No suggestions yet. Tell us what you&apos;re looking for, or browse all mentors below.</p>
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

      <Card title="Browse mentors">
        <form
          className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(filters);
          }}
          role="search"
          aria-label="Search mentors"
        >
          <Field label="Search">{(p) => <input {...p} type="search" placeholder="Name, employer, role…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />}</Field>
          <Field label="Industry">
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
          <Field label="Can help with">
            {(p) => (
              <select {...p} value={filters.topic} onChange={(e) => setFilters({ ...filters, topic: e.target.value })}>
                <option value="">Any topic</option>
                {(options?.topics ?? []).map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Major">{(p) => <input {...p} value={filters.major} onChange={(e) => setFilters({ ...filters, major: e.target.value })} />}</Field>
          <Field label="Field of work">{(p) => <input {...p} value={filters.function} onChange={(e) => setFilters({ ...filters, function: e.target.value })} />}</Field>
          <Field label="Meeting format">
            {(p) => (
              <select {...p} value={filters.meeting} onChange={(e) => setFilters({ ...filters, meeting: e.target.value })}>
                <option value="">Any</option>
                {(options?.meetingFormats ?? []).map((f) => (
                  <option key={f} value={f}>
                    {MEETING_LABELS[f] ?? f}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Mentor type">
            {(p) => (
              <select {...p} value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value })}>
                <option value="">Alumni and professionals</option>
                <option value="Alumni">Alumni</option>
                <option value="Professional">Professionals</option>
              </select>
            )}
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={filters.hasCapacity} onChange={(e) => setFilters({ ...filters, hasCapacity: e.target.checked })} />
              Only mentors with open spots
            </label>
            <Button type="submit">Search</Button>
          </div>
        </form>
        <ErrorBanner error={results.error} />
        <p role="status" aria-live="polite" className="mb-3 text-sm text-muted-foreground">
          {results.data ? `${results.data.total} mentor${results.data.total === 1 ? "" : "s"} found` : ""}
        </p>
        {results.loading && !results.data ? (
          <Loading />
        ) : (results.data?.items ?? []).length === 0 ? (
          <EmptyState title="No mentors match">Try fewer filters.</EmptyState>
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
  return (
    <li className="rounded-lg border border-border p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{m.name}</h3>
          <p className="text-muted-foreground">{[m.jobTitle, m.employer].filter(Boolean).join(" at ")}</p>
        </div>
        <Badge tone="info">{m.kind === "Alumni" ? `Alum${m.graduationYear ? ` '${String(m.graduationYear).slice(-2)}` : ""}` : "Professional"}</Badge>
      </div>
      <p className="mt-2">{m.headline}</p>
      <dl className="mt-2 space-y-1 text-xs">
        {m.industry && (
          <div>
            <dt className="inline font-medium">Industry: </dt>
            <dd className="inline">{m.industry}</dd>
          </div>
        )}
        {m.majors.length > 0 && (
          <div>
            <dt className="inline font-medium">Majors: </dt>
            <dd className="inline">{m.majors.join(", ")}</dd>
          </div>
        )}
        <div>
          <dt className="inline font-medium">Helps with: </dt>
          <dd className="inline">{m.topics.map((t) => topicLabel(options, t)).join(", ")}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Meets by: </dt>
          <dd className="inline">{m.meetingPreferences.map((f) => MEETING_LABELS[f] ?? f).join(", ")}</dd>
        </div>
        {m.availabilityNotes && (
          <div>
            <dt className="inline font-medium">Availability: </dt>
            <dd className="inline">{m.availabilityNotes}</dd>
          </div>
        )}
        <div>
          <dt className="inline font-medium">Open spots: </dt>
          <dd className="inline">
            {m.spotsLeft} of {m.capacity}
          </dd>
        </div>
      </dl>
      {m.bio && <p className="mt-2 text-xs text-muted-foreground">{m.bio}</p>}
      {m.match && m.match.score > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-medium">Why this mentor? (match score {m.match.score})</summary>
          <ul className="mt-1 list-disc pl-5">
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
            Ask for mentoring<span className="sr-only"> from {m.name}</span>
          </Button>
        ) : (
          <Badge>No open spots</Badge>
        )}
      </div>
    </li>
  );
}

function PreferencesForm({ initial, options, onSaved }: { initial: Preferences; options: MentoringOptions; onSaved: (p: Preferences) => void }) {
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
          setErr((e2 as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ErrorBanner error={err} />
      <p className="text-sm">
        Your majors from your career record: <strong>{initial.majors.length ? initial.majors.join(", ") : "none yet"}</strong>
      </p>
      <CheckboxGroup legend="Topics I want help with" options={options.topics.map((t) => ({ value: t.key, label: t.label }))} value={topics} onChange={setTopics} />
      <Field label="Industries I'm interested in" hint={`Separate with commas, e.g. ${options.industries.slice(0, 3).join(", ")}`}>
        {(p) => <input {...p} value={industries} onChange={(e) => setIndustries(e.target.value)} />}
      </Field>
      <Field label="Fields of work I'm interested in" hint={`Separate with commas, e.g. ${options.functions.slice(0, 3).join(", ")}`}>
        {(p) => <input {...p} value={functions} onChange={(e) => setFunctions(e.target.value)} />}
      </Field>
      <Button type="submit" busy={busy}>
        Save preferences
      </Button>
    </form>
  );
}

function RequestForm({ mentor, options, onCancel, onDone }: { mentor: MentorCard; options: MentoringOptions | null; onCancel: () => void; onDone: (id: string) => void }) {
  const api = useApi();
  const [message, setMessage] = useState("");
  const [goals, setGoals] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return (
    <Card title={`Ask ${mentor.name} for mentoring`}>
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
            setOk("Request sent.");
            onDone(res.relationship.id);
          } catch (e2) {
            setErr((e2 as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Message to the mentor" hint="Introduce yourself and say why you chose them (at least 20 characters).">
          {(p) => <textarea {...p} rows={5} required minLength={20} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />}
        </Field>
        <Field label="Your goals (one per line, up to 5)">{(p) => <textarea {...p} rows={3} required value={goals} onChange={(e) => setGoals(e.target.value)} />}</Field>
        <div className="rounded-md border border-border p-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            <span>
              I agree that my school may share my contact details (name, email and phone) with {mentor.name} if we both accept this mentorship. This sharing is
              recorded on my Privacy page{options?.requireStaffApproval ? ", and the career center confirms each match first" : ""}. I can withdraw the request before it is
              accepted.
            </span>
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" busy={busy} disabled={!consent}>
            Send request
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
