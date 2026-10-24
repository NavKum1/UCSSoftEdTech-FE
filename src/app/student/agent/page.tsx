"use client";

/**
 * The career agent (phase E, 24 Oct 2026): it works only on the campus drives approved at the student's own college.
 * - It is off until the student turns it on, and suggests only drives that match their own filters, with the reasons.
 * - An application goes to an employer only when the student approves it here (with their documents, note and consent),
 *   or under a standing rule they created (documents, note, weekly limit, and the consent they confirmed).
 * - Everything it does is in the activity log. It checks the board when this page opens and every hour.
 * (This page used to show an "autonomous" agent negotiating salaries with invented recruiters.)
 */

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";

interface Settings {
  active: boolean;
  keywords: string[];
  jobTypes: string[];
  locations: string[];
  minCtcAnnual: number | null;
  minStipendMonthly: number | null;
  lastScanAt: string | null;
}
interface DocRef {
  fileId: string;
  kind: string;
}
interface Rule {
  id: string;
  name: string;
  keywords: string[];
  jobTypes: string[];
  locations: string[];
  minCtcAnnual: number | null;
  minStipendMonthly: number | null;
  documents: DocRef[];
  noteTemplate: string;
  maxPerWeek: number;
  consentText: string;
  active: boolean;
  createdAt: string;
}
interface Suggestion {
  id: string;
  driveId: string;
  companyName: string;
  title: string;
  reasons: string[];
  status: string;
  draftNote: string;
  ruleId: string | null;
  applicationId: string | null;
  error: string | null;
  createdAt: string;
  decidedAt: string | null;
}
interface Activity {
  id: string;
  kind: string;
  detail: string;
  at: string;
}
interface Overview {
  available: boolean;
  reason?: string;
  college?: string;
  settings?: Settings;
  jobTypes?: string[];
  rules?: Rule[];
  suggestions?: Suggestion[];
  activity?: Activity[];
  note?: string;
}
interface Doc {
  id: string;
  fileName: string;
}

const JOB_TYPE: Record<string, string> = { FullTime: "Full-time", Internship: "Internship", PartTime: "Part-time", Contract: "Contract" };
const STATUS: Record<string, [string, "neutral" | "good" | "warn" | "bad" | "info"]> = {
  Suggested: ["Waiting for you", "info"],
  Applied: ["Applied (you approved)", "good"],
  AppliedByRule: ["Applied under your rule", "good"],
  Failed: ["Couldn't apply", "bad"],
  Dismissed: ["Dismissed", "neutral"],
  Closed: ["No longer open", "neutral"],
};
const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function SettingsForm({ settings, jobTypes, busy, onSave }: { settings: Settings; jobTypes: string[]; busy: boolean; onSave: (s: Record<string, unknown>) => void }) {
  const [active, setActive] = useState(settings.active);
  const [keywords, setKeywords] = useState(settings.keywords.join(", "));
  const [types, setTypes] = useState<string[]>(settings.jobTypes);
  const [locations, setLocations] = useState(settings.locations.join(", "));
  const [minCtc, setMinCtc] = useState(settings.minCtcAnnual?.toString() ?? "");
  const [minStipend, setMinStipend] = useState(settings.minStipendMonthly?.toString() ?? "");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          active,
          keywords: list(keywords),
          jobTypes: types,
          locations: list(locations),
          minCtcAnnual: minCtc ? Number(minCtc) : null,
          minStipendMonthly: minStipend ? Number(minStipend) : null,
        });
      }}
    >
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> The agent is on
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Keywords" hint="Comma-separated words to look for in the title or description, e.g. backend, data, cloud.">
          {(p) => <input {...p} value={keywords} onChange={(e) => setKeywords(e.target.value)} />}
        </Field>
        <Field label="Locations" hint="Comma-separated. Leave empty for anywhere.">
          {(p) => <input {...p} value={locations} onChange={(e) => setLocations(e.target.value)} />}
        </Field>
        <Field label="Minimum pay for jobs (rupees a year)" hint="Leave empty for no minimum.">
          {(p) => <input {...p} type="number" min="0" value={minCtc} onChange={(e) => setMinCtc(e.target.value)} />}
        </Field>
        <Field label="Minimum stipend for internships (rupees a month)">
          {(p) => <input {...p} type="number" min="0" value={minStipend} onChange={(e) => setMinStipend(e.target.value)} />}
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Kinds of job</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {jobTypes.map((t) => (
            <label key={t} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={types.includes(t)} onChange={(e) => setTypes(e.target.checked ? [...types, t] : types.filter((x) => x !== t))} />
              {JOB_TYPE[t] ?? t}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" busy={busy}>
        Save
      </Button>
    </form>
  );
}

function RuleForm({ college, jobTypes, docs, busy, onCreate }: { college: string; jobTypes: string[]; docs: Doc[]; busy: boolean; onCreate: (r: Record<string, unknown>) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [locations, setLocations] = useState("");
  const [minCtc, setMinCtc] = useState("");
  const [resume, setResume] = useState("");
  const [note, setNote] = useState("Hello {company} team,\n\nI'd like to apply for {title}.\n\nThank you,\n{name}");
  const [maxPerWeek, setMaxPerWeek] = useState("3");
  const [consent, setConsent] = useState(false);
  const consentText = `Apply for me to campus drives at ${college} that match "${name || "this rule"}", at most ${maxPerWeek} a week, with the documents and note in this rule, and share my details and those documents with each employer.`;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await onCreate({
          name,
          keywords: list(keywords),
          jobTypes: types,
          locations: list(locations),
          minCtcAnnual: minCtc ? Number(minCtc) : null,
          documents: resume ? [{ fileId: resume, kind: "Resume" }] : [],
          noteTemplate: note,
          maxPerWeek: Number(maxPerWeek),
          consent,
        });
        if (ok) {
          setName("");
          setKeywords("");
          setConsent(false);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rule name">{(p) => <input {...p} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Keywords" hint="Comma-separated.">
          {(p) => <input {...p} value={keywords} onChange={(e) => setKeywords(e.target.value)} />}
        </Field>
        <Field label="Locations" hint="Comma-separated. Leave empty for anywhere.">
          {(p) => <input {...p} value={locations} onChange={(e) => setLocations(e.target.value)} />}
        </Field>
        <Field label="Minimum pay (rupees a year)" hint="With a minimum, drives that don't state their pay are skipped.">
          {(p) => <input {...p} type="number" min="0" value={minCtc} onChange={(e) => setMinCtc(e.target.value)} />}
        </Field>
        <Field label="Résumé to attach" hint="From your uploaded documents (upload them on the job board).">
          {(p) => (
            <select {...p} value={resume} onChange={(e) => setResume(e.target.value)}>
              <option value="">None</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fileName}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="At most this many applications a week">
          {(p) => (
            <select {...p} value={maxPerWeek} onChange={(e) => setMaxPerWeek(e.target.value)}>
              {[1, 2, 3, 5, 10].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Kinds of job</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {jobTypes.map((t) => (
            <label key={t} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={types.includes(t)} onChange={(e) => setTypes(e.target.checked ? [...types, t] : types.filter((x) => x !== t))} />
              {JOB_TYPE[t] ?? t}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Note to each employer" hint="{company}, {title} and {name} are filled in.">
        {(p) => <textarea {...p} rows={5} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I agree: {consentText}</span>
      </label>
      <Button type="submit" busy={busy} disabled={!consent}>
        Create rule
      </Button>
    </form>
  );
}

function SuggestionCard({ s, docs, busy, onApprove, onDismiss }: {
  s: Suggestion;
  docs: Doc[];
  busy: boolean;
  onApprove: (id: string, body: Record<string, unknown>) => void;
  onDismiss: (id: string) => void;
}) {
  const [note, setNote] = useState(s.draftNote);
  const [resume, setResume] = useState("");
  const [consent, setConsent] = useState(false);
  const [label, tone] = STATUS[s.status] ?? [s.status, "neutral"];
  const waiting = s.status === "Suggested" || s.status === "Failed";
  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{s.title}</p>
          <p className="text-sm text-muted-foreground">{s.companyName}</p>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {s.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {s.error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{s.error}</p>}
      {waiting ? (
        <div className="mt-3 space-y-3">
          <Field label="Your note to the employer" hint="Edit it as you like. It's sent only when you apply.">
            {(p) => <textarea {...p} rows={6} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <Field label="Résumé to attach">
            {(p) => (
              <select {...p} value={resume} onChange={(e) => setResume(e.target.value)}>
                <option value="">None</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fileName}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Share my details{resume ? " and résumé" : ""} with {s.companyName} for this drive.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button busy={busy} disabled={!consent} onClick={() => onApprove(s.id, { note, consent, documents: resume ? [{ fileId: resume, kind: "Resume" }] : [] })}>
              Apply
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => onDismiss(s.id)}>
              Not interested
            </Button>
            <Link className="self-center text-sm underline" href="/student/jobs">
              See it on the job board
            </Link>
          </div>
        </div>
      ) : (
        s.decidedAt && <p className="mt-2 text-xs text-muted-foreground">{formatDate(s.decidedAt, true)}</p>
      )}
    </li>
  );
}

export default function CareerAgentPage() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const overview = useLoad(async () => (await api<{ overview: Overview }>("/api/career/agent/scan", { method: "POST" }).catch(() => null))?.overview ?? api<Overview>("/api/career/agent"), [api, schoolId]);
  const docs = useLoad(() => api<Doc[]>("/api/career/campus/student/documents").catch(() => [] as Doc[]), [api, schoolId]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      await fn();
      setMsg(success);
      overview.reload();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      overview.reload();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const o = overview.data;
  return (
    <div>
      <PageHeader
        title="Career agent"
        description="It watches your college's campus drive board for drives that match what you want. It applies only when you approve, or under a rule you create."
        actions={
          o?.available && o.settings?.active ? (
            <Button variant="secondary" busy={busy} onClick={() => void run(() => api("/api/career/agent/scan", { method: "POST" }), "Checked the drive board.")}>
              Check now
            </Button>
          ) : undefined
        }
      />
      <SuccessBanner message={msg} />
      <ErrorBanner error={err} />
      {overview.loading && !o ? (
        <Loading />
      ) : overview.error ? (
        <ErrorBanner error={overview.error} onRetry={overview.reload} />
      ) : !o?.available ? (
        <EmptyState title="Not available yet">{o?.reason}</EmptyState>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {o.note} {o.settings?.lastScanAt ? `Last checked ${formatDate(o.settings.lastScanAt, true)}.` : ""}
          </p>
          <Card title="What to look for">
            <SettingsForm
              key={JSON.stringify(o.settings)}
              settings={o.settings!}
              jobTypes={o.jobTypes ?? []}
              busy={busy}
              onSave={(s) => void run(() => api("/api/career/agent/settings", { method: "PUT", json: s }), "Saved.")}
            />
          </Card>

          <Card title="Suggestions">
            {(o.suggestions ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {o.settings?.active ? "No drives on your board match yet. You'll be notified when one does." : "Turn the agent on to get suggestions."}
              </p>
            ) : (
              <ul className="space-y-3">
                {o.suggestions!.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    s={s}
                    docs={docs.data ?? []}
                    busy={busy}
                    onApprove={(id, body) => void run(() => api(`/api/career/agent/suggestions/${id}/approve`, { json: body }), "Application sent.")}
                    onDismiss={(id) => void run(() => api(`/api/career/agent/suggestions/${id}/dismiss`, { method: "POST" }), "Dismissed.")}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card title="Standing rules">
            <p className="mb-3 text-sm text-muted-foreground">
              A rule applies for you to drives that match it, with its résumé and note, up to its weekly limit. It skips drives whose criteria you don&apos;t
              clearly meet. You can pause or delete a rule at any time.
            </p>
            {(o.rules ?? []).length > 0 && (
              <ul className="mb-4 space-y-2">
                {o.rules!.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                    <div>
                      <span className="font-medium">{r.name}</span> <Badge tone={r.active ? "good" : "neutral"}>{r.active ? "On" : "Paused"}</Badge>
                      <p className="text-xs text-muted-foreground">
                        {[r.keywords.join(", "), r.jobTypes.map((t) => JOB_TYPE[t] ?? t).join(", "), r.locations.join(" or ")].filter(Boolean).join(" · ")} · at most{" "}
                        {r.maxPerWeek} a week
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void run(() => api(`/api/career/agent/rules/${r.id}/${r.active ? "pause" : "resume"}`, { method: "POST" }), r.active ? "Rule paused." : "Rule on.")}
                      >
                        {r.active ? "Pause" : "Resume"}
                      </Button>
                      <Button variant="ghost" disabled={busy} onClick={() => void run(() => api(`/api/career/agent/rules/${r.id}`, { method: "DELETE" }), "Rule deleted.")}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <RuleForm
              college={o.college ?? "your college"}
              jobTypes={o.jobTypes ?? []}
              docs={docs.data ?? []}
              busy={busy}
              onCreate={(r) => run(() => api("/api/career/agent/rules", { json: r }), "Rule created.")}
            />
          </Card>

          <Card title="Activity">
            {(o.activity ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {o.activity!.map((a) => (
                  <li key={a.id} className="border-t border-border pt-2">
                    <span className="text-xs text-muted-foreground">{formatDate(a.at, true)}</span>
                    <p>{a.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
