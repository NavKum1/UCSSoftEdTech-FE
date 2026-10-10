"use client";

/**
 * D2 "defend your internship": shared types and panels. The student flow lives at /student/experiences/[id]/defend;
 * DefenseSummaryCard sits on the student's experience page and DefenseReviewPanel on the faculty and career-center pages.
 */

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";

export const DEFENSE_API = "/api/career/internship-defense";

export interface DefenseArtifact {
  kind: string;
  title: string;
  url?: string | null;
  description: string;
}

export interface DefenseEvidence {
  dimension: string;
  quote: string;
  note?: string | null;
}

export interface DefenseState {
  experience: { id: string; status: string; roleTitle: string; employerName: string; supervisorName: string; studentName: string; startDate: string; endDate: string };
  verification: { status: string; label: string };
  eligibility: { canStart: boolean; reason: string | null };
  options: { writtenAvailable: boolean; voiceAvailable: boolean; consentText: string; threshold: number; canOverride: boolean };
  defense: null | {
    id: string;
    mode: "Written" | "Voice";
    status: "InProgress" | "AwaitingSupervisor" | "Decided";
    artifacts: DefenseArtifact[];
    startedAt: string;
    finishedAt?: string | null;
    maxQuestions: number;
    answered: number;
    awaitingAnswer: boolean;
    canFinish: boolean;
    simulated: boolean;
    turns: { role: "interviewer" | "student"; text: string; at: string }[];
    result: null | {
      score: number | null;
      threshold: number;
      rubric: Record<string, number>;
      evidence: { items: DefenseEvidence[]; concerns: string[] };
      summary?: string | null;
      graderSource?: string | null;
      gradedAt: string;
    };
    supervisor: { name: string; email?: string | null; answer?: string | null; comment?: string | null; answeredByName?: string | null; answeredAt?: string | null };
    computedStatus: string;
    overrideInfo: null | { status?: string | null; note?: string | null; byName?: string | null; at?: string | null };
    consent: { consentedAt: string; text: string; active: boolean } | null;
    supervisorLinks?: { issuedAt: string; expiresAt: string; lastUsedAt?: string | null; useCount: number; state: string }[] | null;
  };
  credential: null | { id: string; status: string; issuedAt: string; publicUrlSlug: string; verifyPath: string };
  voice: null | { assistant: unknown; maxDurationSeconds: number };
  devToken?: string | null;
}

export const RUBRIC_LABELS: Record<string, string> = {
  ownership: "Ownership",
  technicalDepth: "Technical depth",
  decisions: "Decisions and trade-offs",
  outcomes: "Outcomes",
};

export const ARTIFACT_KINDS: { value: string; label: string }[] = [
  { value: "repo", label: "Code repository" },
  { value: "document", label: "Document" },
  { value: "demo", label: "Demo or live link" },
  { value: "description", label: "Description only" },
];

const VERIFICATION_TONES: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = {
  Verified: "good",
  PartlyVerified: "warn",
  NotVerified: "bad",
  Pending: "info",
  None: "neutral",
};

export const VERIFICATION_LABELS: Record<string, string> = {
  Verified: "Verified",
  PartlyVerified: "Partly verified",
  NotVerified: "Not verified",
  Pending: "Pending",
  None: "Not started",
};

/** Text label plus color, so meaning never depends on color alone. */
export function VerificationBadge({ status }: { status: string }) {
  return <Badge tone={VERIFICATION_TONES[status] ?? "neutral"}>{VERIFICATION_LABELS[status] ?? status}</Badge>;
}

export function ArtifactList({ artifacts }: { artifacts: DefenseArtifact[] }) {
  return (
    <ol className="space-y-3 text-sm">
      {artifacts.map((a, i) => (
        <li key={i} className="rounded-md border border-border p-3">
          <p className="font-medium">
            {a.title} <span className="text-xs text-muted-foreground">({ARTIFACT_KINDS.find((k) => k.value === a.kind)?.label ?? a.kind})</span>
          </p>
          {a.url && (
            <p className="break-all text-xs">
              <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                {a.url}
              </a>
            </p>
          )}
          <p className="mt-1 whitespace-pre-wrap">{a.description}</p>
        </li>
      ))}
    </ol>
  );
}

export function DefenseResult({ result }: { result: NonNullable<NonNullable<DefenseState["defense"]>["result"]> }) {
  return (
    <div className="space-y-4 text-sm">
      {result.graderSource === "development-heuristic" && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Development mode: this grade comes from a simple heuristic, not an AI model.
        </p>
      )}
      {result.score == null ? (
        <p>This defense couldn&apos;t be graded automatically. Faculty or the career center will review it.</p>
      ) : (
        <p>
          Defense score: <strong>{result.score}</strong> out of 100 (the school looks for {result.threshold} or more, together with the supervisor&apos;s confirmation).
        </p>
      )}
      {Object.keys(result.rubric).length > 0 && (
        <table className="w-full max-w-md text-left">
          <caption className="sr-only">Rubric scores</caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="py-1 font-medium">
                Dimension
              </th>
              <th scope="col" className="py-1 font-medium">
                Score (0–100)
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(result.rubric).map(([k, v]) => (
              <tr key={k} className="border-t border-border">
                <th scope="row" className="py-1 font-normal">
                  {RUBRIC_LABELS[k] ?? k}
                </th>
                <td className="py-1">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {result.summary && <p className="whitespace-pre-wrap">{result.summary}</p>}
      {result.evidence.items.length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold">Evidence from the answers</h3>
          <ul className="space-y-2">
            {result.evidence.items.map((e, i) => (
              <li key={i}>
                <span className="text-xs text-muted-foreground">{RUBRIC_LABELS[e.dimension] ?? e.dimension}</span>
                <blockquote className="border-l-2 border-border pl-2 italic">“{e.quote}”</blockquote>
                {e.note && <span className="text-xs text-muted-foreground">{e.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.evidence.concerns.length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold">For a person to look at</h3>
          <ul className="list-disc pl-5">
            {result.evidence.concerns.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Transcript({ turns }: { turns: NonNullable<DefenseState["defense"]>["turns"] }) {
  return (
    <ol className="space-y-3 text-sm">
      {turns.map((t, i) => (
        <li key={i} className={t.role === "interviewer" ? "" : "pl-4"}>
          <span className="block text-xs font-medium text-muted-foreground">{t.role === "interviewer" ? "Interviewer" : "Student"}</span>
          <span className="whitespace-pre-wrap">{t.text}</span>
        </li>
      ))}
    </ol>
  );
}

function SupervisorAnswer({ s }: { s: NonNullable<DefenseState["defense"]>["supervisor"] }) {
  if (!s.answer) return <p className="text-sm">Waiting for {s.name} to confirm.</p>;
  const label = s.answer === "Yes" ? "Yes, the student did this work" : s.answer === "Partly" ? "Partly" : "No";
  return (
    <p className="text-sm">
      {s.answeredByName ?? s.name} answered <strong>{label}</strong> on {formatDate(s.answeredAt)}.
      {s.comment && <span className="mt-1 block whitespace-pre-wrap">“{s.comment}”</span>}
    </p>
  );
}

/** On the student's experience page: where the defense stands, with a link to the defense page. */
export function DefenseSummaryCard({ experienceId }: { experienceId: string }) {
  const api = useApi();
  const state = useLoad(() => api<DefenseState>(`${DEFENSE_API}/mine/${experienceId}`), [api, experienceId]);
  const s = state.data;
  if (!s) return state.error ? <ErrorBanner error={state.error} onRetry={state.reload} /> : null;
  const d = s.defense;
  return (
    <Card title="Defend this internship">
      <p className="mb-3 text-sm">
        Verification: <VerificationBadge status={s.verification.status} />
      </p>
      {!d && s.eligibility.canStart && (
        <p className="mb-3 text-sm">Describe what you built, answer a few questions about it, and your site supervisor confirms it. A verified internship earns a credential you can share.</p>
      )}
      {!d && !s.eligibility.canStart && s.eligibility.reason && <p className="text-sm">{s.eligibility.reason}</p>}
      {d?.status === "InProgress" && <p className="mb-3 text-sm">Your defense is in progress.</p>}
      {d?.status === "AwaitingSupervisor" && <p className="mb-3 text-sm">Waiting for {d.supervisor.name} to confirm your work.</p>}
      {s.credential && s.credential.status === "Valid" && (
        <p className="mb-3 text-sm">
          Credential issued.{" "}
          <Link href={s.credential.verifyPath} className="underline">
            Public verification page
          </Link>
        </p>
      )}
      {(s.eligibility.canStart || d) && (
        <Link
          href={`/student/experiences/${experienceId}/defend`}
          className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: "var(--brand, #4f46e5)" }}
        >
          {!d ? "Defend this internship" : d.status === "InProgress" ? "Continue your defense" : "See your defense"}
        </Link>
      )}
    </Card>
  );
}

const OVERRIDE_CHOICES = [
  { value: "Verified", label: "Verified" },
  { value: "PartlyVerified", label: "Partly verified" },
  { value: "NotVerified", label: "Not verified" },
  { value: "Pending", label: "Pending (needs more review)" },
];

/** Faculty and career-center view: signals, transcript, supervisor answer, and an audited override. */
export function DefenseReviewPanel({ experienceId, scope }: { experienceId: string; scope: "faculty" | "staff" }) {
  const api = useApi();
  const base = `${DEFENSE_API}/${scope}/${experienceId}`;
  const state = useLoad(() => api<DefenseState>(base), [api, base]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const s = state.data;
  if (state.loading && !s) return <Loading label="Loading the internship defense…" />;
  if (!s) return <ErrorBanner error={state.error} onRetry={state.reload} />;
  const d = s.defense;

  const override = async (clear: boolean) => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      state.setData(await api<DefenseState>(`${base}/override`, { json: clear ? { clear: true, note } : { status, note } }));
      setMsg(clear ? "Override removed; the signals decide again." : "Verification updated. The change is in the audit log.");
      setNote("");
      setStatus("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setErr(null);
    setMsg(null);
    try {
      const r = await api<{ sentTo: string }>(`${base}/supervisor-link`, { method: "POST" });
      setMsg(`A new confirmation link was emailed to ${r.sentTo}.`);
      state.reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <Card title="Internship defense and verification">
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      <p className="mb-4 text-sm">
        Verification: <VerificationBadge status={s.verification.status} />
        {d && d.overrideInfo?.status && (
          <span className="ml-2 text-xs text-muted-foreground">
            (set by {d.overrideInfo.byName} on {formatDate(d.overrideInfo.at)}; the signals say {VERIFICATION_LABELS[d.computedStatus] ?? d.computedStatus})
          </span>
        )}
      </p>
      {!d ? (
        <p className="text-sm">{s.eligibility.reason ?? "The student hasn't started a defense yet."}</p>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">These are signals for people to weigh, not an automatic decision.</p>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Work the student described</h3>
            <ArtifactList artifacts={d.artifacts} />
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Defense ({d.mode.toLowerCase()})</h3>
            {d.result ? <DefenseResult result={d.result} /> : <p className="text-sm">In progress: {d.answered} answer(s) so far.</p>}
            {d.turns.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm underline">Full transcript</summary>
                <div className="mt-2">
                  <Transcript turns={d.turns} />
                </div>
              </details>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Site supervisor</h3>
            <SupervisorAnswer s={d.supervisor} />
            {d.consent && (
              <p className="mt-1 text-xs text-muted-foreground">
                Student consent to share with the supervisor: {d.consent.active ? "active" : "revoked or expired"} (given {formatDate(d.consent.consentedAt)}).
              </p>
            )}
            {d.supervisorLinks && d.supervisorLinks.length > 0 && (
              <ul className="mt-2 text-xs text-muted-foreground">
                {d.supervisorLinks.map((l, i) => (
                  <li key={i}>
                    Link sent {formatDate(l.issuedAt, true)}: {l.state}, opened {l.useCount} time(s)
                  </li>
                ))}
              </ul>
            )}
            {d.status === "AwaitingSupervisor" && (
              <Button variant="secondary" className="mt-2" onClick={resend}>
                Resend confirmation link
              </Button>
            )}
          </section>
          {s.credential && (
            <p className="text-sm">
              Credential: {s.credential.status}, issued {formatDate(s.credential.issuedAt)}.{" "}
              <Link href={s.credential.verifyPath} className="underline">
                Public verification page
              </Link>
            </p>
          )}
          {d.overrideInfo?.note && (
            <p className="text-sm">
              Last decision note ({d.overrideInfo.byName}, {formatDate(d.overrideInfo.at)}): {d.overrideInfo.note}
            </p>
          )}
          <form
            className="space-y-3 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              override(false);
            }}
          >
            <h3 className="text-sm font-semibold">Change the verification</h3>
            <Field label="New status">
              {(p) => (
                <select {...p} value={status} onChange={(e) => setStatus(e.target.value)} required>
                  <option value="">Choose</option>
                  {OVERRIDE_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Note (required, kept in the audit log)" hint="Say what you checked, for example a call with the supervisor.">
              {(p) => <textarea {...p} rows={3} value={note} onChange={(e) => setNote(e.target.value)} required minLength={5} />}
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" busy={busy} disabled={!status || note.trim().length < 5}>
                Save decision
              </Button>
              {d.overrideInfo?.status && (
                <Button type="button" variant="secondary" disabled={busy || note.trim().length < 5} onClick={() => override(true)}>
                  Remove override
                </Button>
              )}
            </div>
          </form>
        </div>
      )}
    </Card>
  );
}
