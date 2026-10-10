"use client";

/**
 * Public page for an internship site supervisor (no account). The secure link in the URL does one job:
 * confirm and sign the learning agreement, approve weekly hours, or complete an evaluation.
 * Brand-aware header from /api/career/brand for the student's school.
 */

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiClient";
import { Badge, Button, Card, ErrorBanner, Field, Loading, SuccessBanner, formatDate } from "@/components/career/ui";
import type { Question } from "@/components/career/experiences/shared";

interface Brand {
  displayName: string;
  logoUrl?: string | null;
  primaryColor: string;
  supportEmail?: string | null;
  privacyUrl?: string | null;
  showPoweredBy: boolean;
}

interface SupervisorView {
  purpose: "Agreement" | "Hours" | "MidtermEvaluation" | "FinalEvaluation";
  expiresAt: string;
  school: { displayName: string; slug: string };
  experience: {
    studentName: string;
    employerName: string;
    roleTitle: string;
    startDate: string;
    endDate: string;
    hoursPerWeek: number;
    paid: boolean;
    location?: string | null;
    remote: boolean;
    supervisorName: string;
    supervisorTitle?: string | null;
    status: string;
    learningObjectives: string[];
    program: { code: string; title: string; creditHours: number; requiredHours: number };
    supervisorConfirmedAt?: string | null;
  };
  agreement: { version: number; text: string; sha256: string; signatures: { role: string; name: string; signedAt: string }[]; supervisorSigned: boolean; canSign: boolean } | null;
  hours: { id: string; weekStart: string; hours: number; description?: string | null; status: string; decisionNote?: string | null }[] | null;
  evaluation: { kind: string; questions: Question[]; ratingScaleMax: number; submitted: boolean; canSubmit: boolean } | null;
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : `Something went wrong (${res.status}).`;
    throw new Error(message);
  }
  return data as T;
}

export default function SupervisorPage() {
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<SupervisorView | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const path = `/api/career/experiences/supervisor/${encodeURIComponent(token)}`;

  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    call<SupervisorView>(path)
      .then((v) => {
        if (cancelled) return;
        setView(v);
        call<Brand>(`/api/career/brand?school=${encodeURIComponent(v.school.slug)}`).then((b) => !cancelled && setBrand(b)).catch(() => {});
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setView(null);
        call<Brand>(`/api/career/brand?host=${encodeURIComponent(window.location.hostname)}`).then((b) => !cancelled && setBrand(b)).catch(() => {});
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const act = async (fn: () => Promise<unknown>, success: string, finished = false) => {
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(success);
      // Single-use links stop working once their job is done, so show the confirmation instead of reloading
      if (finished) setView(null);
      else setTick((t) => t + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const color = brand?.primaryColor ?? "#4f46e5";
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ ["--brand" as string]: color } as React.CSSProperties}>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.displayName} className="h-8 w-auto" />
          ) : (
            <span className="font-semibold" style={{ color }}>
              {brand?.displayName ?? ""}
            </span>
          )}
          {view && <span className="text-sm text-muted-foreground">for {view.school.displayName}</span>}
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">{view ? titleFor(view) : "Internship supervisor"}</h1>
        <div aria-live="polite">
          <ErrorBanner error={error} />
          <SuccessBanner message={msg} />
        </div>
        {loading && !view ? <Loading /> : view ? <Body view={view} path={path} act={act} /> : null}
        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          <p>This secure link is only for the site supervisor named on the agreement. Please don&apos;t forward it.{view ? ` It expires on ${formatDate(view.expiresAt)}.` : ""}</p>
          <p className="mt-1">
            The student&apos;s information is shared with you under their consent for supervising this experience only.
            {brand?.supportEmail ? ` Questions: ${brand.supportEmail}.` : ""}
            {brand?.privacyUrl && (
              <>
                {" "}
                <a href={brand.privacyUrl} className="underline">
                  Privacy
                </a>
              </>
            )}
          </p>
        </footer>
      </main>
    </div>
  );
}

function titleFor(v: SupervisorView) {
  switch (v.purpose) {
    case "Agreement":
      return `Learning agreement for ${v.experience.studentName}`;
    case "Hours":
      return `Hours for ${v.experience.studentName}`;
    case "MidtermEvaluation":
      return `Midterm evaluation for ${v.experience.studentName}`;
    default:
      return `Final evaluation for ${v.experience.studentName}`;
  }
}

function Body({ view, path, act }: { view: SupervisorView; path: string; act: (fn: () => Promise<unknown>, success: string, finished?: boolean) => Promise<void> }) {
  const x = view.experience;
  return (
    <>
      <Card title="Internship">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Student</dt>
            <dd>{x.studentName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Role</dt>
            <dd>
              {x.roleTitle}, {x.employerName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Dates</dt>
            <dd>
              {formatDate(x.startDate)} to {formatDate(x.endDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Hours per week</dt>
            <dd>
              {x.hoursPerWeek} · {x.paid ? "Paid" : "Unpaid"} · {x.remote ? "Remote" : x.location}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Academic program</dt>
            <dd>
              {x.program.code} {x.program.title} ({x.program.requiredHours} hours)
            </dd>
          </div>
        </dl>
      </Card>
      {view.purpose === "Agreement" && view.agreement && <AgreementSection view={view} path={path} act={act} />}
      {view.purpose === "Hours" && <HoursSection view={view} path={path} act={act} />}
      {view.evaluation && <EvaluationSection view={view} path={path} act={act} />}
    </>
  );
}

function AgreementSection({ view, path, act }: { view: SupervisorView; path: string; act: (fn: () => Promise<unknown>, success: string, finished?: boolean) => Promise<void> }) {
  const a = view.agreement!;
  const [typed, setTyped] = useState("");
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState("");
  const [showCorrections, setShowCorrections] = useState(false);
  return (
    <Card title={`Learning agreement (version ${a.version})`}>
      <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs" tabIndex={0} aria-label="Agreement text">
        {a.text}
      </pre>
      <p className="mt-2 break-all text-xs text-muted-foreground">Document fingerprint (SHA-256): {a.sha256}</p>
      <p className="mt-3 text-sm">
        Signed so far: {a.signatures.length ? a.signatures.map((s) => `${s.role.toLowerCase()} (${s.name})`).join(", ") : "nobody yet"}.
      </p>
      {a.supervisorSigned ? (
        <p className="mt-3 text-sm font-medium">You signed this version. Thank you!</p>
      ) : a.canSign ? (
        <>
          {!view.experience.supervisorConfirmedAt && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => act(() => call(`${path}/confirm`, {}), "Thanks for confirming the details.")}>
                The details are correct
              </Button>
              <Button variant="ghost" onClick={() => setShowCorrections(true)}>
                Something needs correcting
              </Button>
            </div>
          )}
          {showCorrections && (
            <form
              className="mt-4 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                act(() => call(`${path}/confirm`, { note }), "Sent. The student and the career center will update the agreement and send you a new link.");
                setShowCorrections(false);
              }}
            >
              <Field label="What needs correcting?">{(p) => <textarea {...p} rows={3} value={note} onChange={(e) => setNote(e.target.value)} required />}</Field>
              <Button type="submit" variant="secondary">
                Send corrections
              </Button>
            </form>
          )}
          <form
            className="mt-6 space-y-3 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => call(`${path}/sign`, { typedName: typed, sha256: a.sha256, consent }), "You signed the learning agreement. Thank you! You can close this page.", true);
            }}
          >
            <Field label="Type your full name to sign">{(p) => <input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="name" required />}</Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
              <span>I have read this version of the agreement, agree to it as the site supervisor, and agree to sign electronically.</span>
            </label>
            <Button type="submit" disabled={!consent || typed.trim().length < 2}>
              Sign agreement
            </Button>
          </form>
        </>
      ) : (
        <p className="mt-3 text-sm">This agreement isn&apos;t open for signing right now.</p>
      )}
    </Card>
  );
}

function HoursSection({ view, path, act }: { view: SupervisorView; path: string; act: (fn: () => Promise<unknown>, success: string, finished?: boolean) => Promise<void> }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const hours = view.hours ?? [];
  return (
    <Card title="Weekly hours">
      {hours.length === 0 ? (
        <p className="text-sm">No hours logged yet.</p>
      ) : (
        <ul className="space-y-4">
          {hours.map((h) => (
            <li key={h.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  Week of {formatDate(h.weekStart)}: {h.hours} hours
                </span>
                <Badge tone={h.status === "Approved" ? "good" : h.status === "Rejected" ? "bad" : "warn"}>{h.status === "Rejected" ? "Returned" : h.status}</Badge>
              </div>
              {h.description && <p className="mt-1">{h.description}</p>}
              {h.decisionNote && <p className="mt-1 text-muted-foreground">Note: {h.decisionNote}</p>}
              {h.status === "Pending" && (
                <div className="mt-3 space-y-2">
                  <Field label="Note to the student (needed to return the week)">
                    {(p) => <input {...p} value={notes[h.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [h.id]: e.target.value }))} />}
                  </Field>
                  <div className="flex gap-2">
                    <Button onClick={() => act(() => call(`${path}/hours/${h.id}`, { approve: true, note: notes[h.id] }), "Hours approved.")}>Approve</Button>
                    <Button variant="secondary" disabled={!notes[h.id]?.trim()} onClick={() => act(() => call(`${path}/hours/${h.id}`, { approve: false, note: notes[h.id] }), "Returned to the student.")}>
                      Return for correction
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function EvaluationSection({ view, path, act }: { view: SupervisorView; path: string; act: (fn: () => Promise<unknown>, success: string, finished?: boolean) => Promise<void> }) {
  const ev = view.evaluation!;
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [comments, setComments] = useState("");
  const [name, setName] = useState(view.experience.supervisorName);
  if (ev.submitted) return <Card title={`${ev.kind} evaluation`}><p className="text-sm">This evaluation was submitted. Thank you!</p></Card>;
  if (!ev.canSubmit) return <Card title={`${ev.kind} evaluation`}><p className="text-sm">This evaluation isn&apos;t open yet.</p></Card>;
  const scale = Array.from({ length: ev.ratingScaleMax }, (_, i) => i + 1);
  return (
    <Card title={`${ev.kind} evaluation`}>
      <p className="mb-4 text-sm text-muted-foreground">
        Rate from 1 (needs significant improvement) to {ev.ratingScaleMax} (excellent). Your evaluation becomes part of the student&apos;s education record; the student and their school can read it.
      </p>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => call(`${path}/evaluation`, { answers, comments, evaluatorName: name }), "Evaluation submitted. Thank you! You can close this page.", true);
        }}
      >
        {ev.questions.map((q) =>
          q.type === "rating" ? (
            <fieldset key={q.key}>
              <legend className="text-sm font-medium">{q.text}</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {scale.map((n) => (
                  <label key={n} className="flex items-center gap-1 text-sm">
                    <input type="radio" name={q.key} value={n} checked={answers[q.key] === n} onChange={() => setAnswers((a) => ({ ...a, [q.key]: n }))} required />
                    {n}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <Field key={q.key} label={q.text}>
              {(p) => <textarea {...p} rows={3} value={(answers[q.key] as string) ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))} />}
            </Field>
          ),
        )}
        <Field label="Other comments">{(p) => <textarea {...p} rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />}</Field>
        <Field label="Your name">{(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} required />}</Field>
        <Button type="submit">Submit evaluation</Button>
      </form>
    </Card>
  );
}
