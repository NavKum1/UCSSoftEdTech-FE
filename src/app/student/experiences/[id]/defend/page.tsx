"use client";

/**
 * D2: the student defends the work they did during their internship. They describe one to three pieces of work, answer an
 * interviewer's questions about them (written, or voice where the school has it set up), and the site supervisor confirms.
 */

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type VapiClient from "@vapi-ai/web";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import {
  ARTIFACT_KINDS,
  ArtifactList,
  DEFENSE_API,
  DefenseResult,
  Transcript,
  VerificationBadge,
  type DefenseArtifact,
  type DefenseState,
} from "@/components/career/experiences/InternshipDefense";

const EMPTY: DefenseArtifact = { kind: "description", title: "", url: "", description: "" };
const VOICE_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "";

export default function DefendInternshipPage() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const state = useLoad(() => api<DefenseState>(`${DEFENSE_API}/mine/${id}`), [api, id, schoolId]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const s = state.data;
  const run = async (fn: () => Promise<DefenseState>, success?: string) => {
    setErr(null);
    setMsg(null);
    try {
      const next = await fn();
      state.setData(next);
      if (success) setMsg(success);
      return next;
    } catch (e) {
      setErr((e as Error).message);
      return null;
    }
  };

  if (state.loading && !s) return <Loading />;
  if (!s) return <ErrorBanner error={state.error} onRetry={state.reload} />;
  const d = s.defense;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Defend your internship"
        description={
          <>
            <Link href={`/student/experiences/${id}`} className="underline">
              {s.experience.roleTitle} at {s.experience.employerName}
            </Link>{" "}
            · Verification: <VerificationBadge status={s.verification.status} />
          </>
        }
      />
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>

      {!d && !s.eligibility.canStart && (
        <Card>
          <p className="text-sm">{s.eligibility.reason}</p>
        </Card>
      )}

      {!d && s.eligibility.canStart && <StartForm s={s} onStart={(body) => run(() => api(`${DEFENSE_API}/mine/${id}/start`, { json: body }), "Your defense has started.")} />}

      {d && d.status === "InProgress" && d.mode === "Written" && (
        <WrittenDefense
          d={d}
          onAnswer={(answer) => run(() => api(`${DEFENSE_API}/mine/${id}/answer`, { json: { answer } }))}
          onFinish={() => run(() => api(`${DEFENSE_API}/mine/${id}/finish`, { method: "POST" }), `Thanks! ${s.experience.supervisorName} has been asked to confirm your work.`)}
        />
      )}

      {d && d.status === "InProgress" && d.mode === "Voice" && (
        <VoiceDefense
          resume={() => api<DefenseState>(`${DEFENSE_API}/mine/${id}/start`, { json: {} })}
          complete={(callId) => run(() => api(`${DEFENSE_API}/mine/${id}/voice/complete`, { json: { callId } }), `Thanks! ${s.experience.supervisorName} has been asked to confirm your work.`)}
          setErr={setErr}
        />
      )}

      {d && d.status !== "InProgress" && (
        <>
          <Card title="Where it stands">
            <p className="text-sm">
              Verification: <VerificationBadge status={s.verification.status} />
            </p>
            {d.status === "AwaitingSupervisor" && <p className="mt-2 text-sm">We emailed {d.supervisor.name} a secure link to confirm your work. You&apos;ll get a notification when they answer.</p>}
            {d.supervisor.answer && (
              <p className="mt-2 text-sm">
                {d.supervisor.answeredByName ?? d.supervisor.name} answered <strong>{d.supervisor.answer}</strong> on {formatDate(d.supervisor.answeredAt)}.
                {d.supervisor.comment && <span className="mt-1 block whitespace-pre-wrap">“{d.supervisor.comment}”</span>}
              </p>
            )}
            {d.overrideInfo?.status && (
              <p className="mt-2 text-sm">
                Your school reviewed this and set it to <VerificationBadge status={d.overrideInfo.status} />. {d.overrideInfo.note}
              </p>
            )}
            {s.credential && (
              <p className="mt-2 text-sm">
                Credential: {s.credential.status}.{" "}
                {s.credential.status === "Valid" && (
                  <>
                    <Link href={s.credential.verifyPath} className="underline">
                      Public verification page
                    </Link>{" "}
                    ·{" "}
                    <Link href="/credentials" className="underline">
                      Your credential wallet
                    </Link>
                  </>
                )}
              </p>
            )}
          </Card>
          {d.result && (
            <Card title="Your defense result">
              <DefenseResult result={d.result} />
            </Card>
          )}
          <Card title="Work you described">
            <ArtifactList artifacts={d.artifacts} />
          </Card>
          {d.turns.length > 0 && (
            <Card title="Transcript">
              <Transcript turns={d.turns} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StartForm({ s, onStart }: { s: DefenseState; onStart: (body: unknown) => Promise<unknown> }) {
  const [artifacts, setArtifacts] = useState<DefenseArtifact[]>([{ ...EMPTY }]);
  const [mode, setMode] = useState<"written" | "voice">("written");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const voiceReady = s.options.voiceAvailable && VOICE_KEY.length > 0;
  const update = (i: number, patch: Partial<DefenseArtifact>) => setArtifacts((list) => list.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onStart({ artifacts: artifacts.map((a) => ({ ...a, url: a.url?.trim() || null })), mode, consent });
        } finally {
          setBusy(false);
        }
      }}
    >
      <Card title="1. Describe the work you did">
        <p className="mb-4 text-sm text-muted-foreground">
          Add one to three things you built or wrote at {s.experience.employerName}. Don&apos;t paste confidential material: describe it in your own words.
        </p>
        <div className="space-y-6">
          {artifacts.map((a, i) => (
            <fieldset key={i} className="space-y-3 rounded-md border border-border p-4">
              <legend className="px-1 text-sm font-medium">Work {i + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Type">
                  {(p) => (
                    <select {...p} value={a.kind} onChange={(e) => update(i, { kind: e.target.value })}>
                      {ARTIFACT_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Short title">{(p) => <input {...p} value={a.title} maxLength={150} onChange={(e) => update(i, { title: e.target.value })} required />}</Field>
              </div>
              <Field label={a.kind === "repo" || a.kind === "demo" ? "Link" : "Link (optional)"} hint="Starts with https://">
                {(p) => <input {...p} type="url" value={a.url ?? ""} maxLength={500} onChange={(e) => update(i, { url: e.target.value })} required={a.kind === "repo" || a.kind === "demo"} />}
              </Field>
              <Field label="What you did" hint="At least a couple of sentences: what it is, what part was yours, and what happened.">
                {(p) => <textarea {...p} rows={4} value={a.description} minLength={30} maxLength={2000} onChange={(e) => update(i, { description: e.target.value })} required />}
              </Field>
              {artifacts.length > 1 && (
                <Button type="button" variant="ghost" onClick={() => setArtifacts((list) => list.filter((_, j) => j !== i))}>
                  Remove work {i + 1}
                </Button>
              )}
            </fieldset>
          ))}
        </div>
        {artifacts.length < 3 && (
          <Button type="button" variant="secondary" className="mt-4" onClick={() => setArtifacts((list) => [...list, { ...EMPTY }])}>
            Add another piece of work
          </Button>
        )}
      </Card>

      <Card title="2. Choose how to defend it">
        <fieldset className="space-y-2 text-sm">
          <legend className="sr-only">Defense format</legend>
          <label className="flex items-start gap-2">
            <input type="radio" name="mode" className="mt-1" checked={mode === "written"} onChange={() => setMode("written")} disabled={!s.options.writtenAvailable} />
            <span>
              <strong>Written.</strong> Answer up to five questions in your own words, at your own pace.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="mode" className="mt-1" checked={mode === "voice"} onChange={() => setMode("voice")} disabled={!voiceReady} />
            <span>
              <strong>Voice.</strong> A short spoken conversation (up to 15 minutes) in your browser.
              {!voiceReady && <span className="block text-xs text-muted-foreground">Not available at your school right now.</span>}
            </span>
          </label>
        </fieldset>
        <p className="mt-3 text-xs text-muted-foreground">The interviewer asks what you personally did, how it works, the decisions you made and what came of it. Grammar, accent and language don&apos;t count.</p>
      </Card>

      <Card title="3. Consent">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
          <span>{s.options.consentText}</span>
        </label>
      </Card>

      <Button type="submit" busy={busy} disabled={!consent}>
        Start the defense
      </Button>
    </form>
  );
}

function WrittenDefense({ d, onAnswer, onFinish }: { d: NonNullable<DefenseState["defense"]>; onAnswer: (a: string) => Promise<unknown>; onFinish: () => Promise<unknown> }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card title={`Question ${Math.min(d.answered + 1, d.maxQuestions)} of up to ${d.maxQuestions}`}>
      {d.simulated && <p className="mb-3 text-xs text-muted-foreground">Development mode: questions are generated without an AI model.</p>}
      <Transcript turns={d.turns} />
      {d.awaitingAnswer && (
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const ok = await onAnswer(answer);
              if (ok) setAnswer("");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Your answer" hint="Up to 4,000 characters. Be specific about what you did.">
            {(p) => <textarea {...p} rows={6} value={answer} maxLength={4000} onChange={(e) => setAnswer(e.target.value)} required />}
          </Field>
          <Button type="submit" busy={busy} disabled={!answer.trim()}>
            Send answer
          </Button>
        </form>
      )}
      {d.canFinish && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-sm">{d.awaitingAnswer ? "You can finish now or keep answering." : "That was the last question."}</p>
          <Button
            variant={d.awaitingAnswer ? "secondary" : "primary"}
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onFinish();
              } finally {
                setBusy(false);
              }
            }}
          >
            Finish and send to my supervisor
          </Button>
        </div>
      )}
    </Card>
  );
}

function VoiceDefense({ resume, complete, setErr }: { resume: () => Promise<DefenseState>; complete: (callId: string) => Promise<unknown>; setErr: (e: string | null) => void }) {
  const [phase, setPhase] = useState<"idle" | "connecting" | "live" | "processing">("idle");
  const vapiRef = useRef<VapiClient | null>(null);
  const callRef = useRef<string | null>(null);

  const finish = async () => {
    if (!callRef.current) return;
    setPhase("processing");
    // The transcript may take a few seconds to be ready on the voice provider
    for (let i = 0; i < 6; i++) {
      const ok = await complete(callRef.current);
      if (ok) return;
      await new Promise((r) => setTimeout(r, 3000));
    }
    setPhase("idle");
  };

  const start = async () => {
    setErr(null);
    setPhase("connecting");
    try {
      const st = await resume();
      if (!st.voice) throw new Error("Voice isn't available right now.");
      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(VOICE_KEY);
      vapiRef.current = vapi;
      vapi.on("call-start", () => setPhase("live"));
      vapi.on("call-end", () => {
        void finish();
      });
      vapi.on("error", () => setErr("The voice connection had a problem. You can start the call again."));
      const call = await vapi.start(st.voice.assistant as Parameters<VapiClient["start"]>[0]);
      callRef.current = call?.id ?? null;
      if (!callRef.current) throw new Error("The call didn't start. Check your microphone permission and try again.");
    } catch (e) {
      setErr((e as Error).message);
      setPhase("idle");
    }
  };

  return (
    <Card title="Voice defense">
      <p className="mb-3 text-sm">You&apos;ll talk with an interviewer about the work you described for up to 15 minutes. Use a quiet place and allow microphone access.</p>
      <p role="status" className="mb-3 text-sm font-medium">
        {phase === "idle" ? "Ready." : phase === "connecting" ? "Connecting…" : phase === "live" ? "Call in progress." : "Processing your call…"}
      </p>
      {phase === "idle" && <Button onClick={start}>Start the call</Button>}
      {phase === "live" && (
        <Button variant="secondary" onClick={() => vapiRef.current?.stop()}>
          End the call
        </Button>
      )}
    </Card>
  );
}
