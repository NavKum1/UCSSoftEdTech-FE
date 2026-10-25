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
import { Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import {
  ArtifactList,
  DEFENSE_API,
  DefenseResult,
  Transcript,
  VerificationBadge,
  type DefenseArtifact,
  type DefenseState,
  useArtifactKinds,
} from "@/components/career/experiences/InternshipDefense";

const EMPTY: DefenseArtifact = { kind: "description", title: "", url: "", description: "" };
const VOICE_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "";

export default function DefendInternshipPage() {
  const t = useCareerT("studentExperiencesDetailDefend");
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
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
      return null;
    }
  };

  if (state.loading && !s) return <Loading />;
  if (!s) return <ErrorBanner error={state.error} onRetry={state.reload} />;
  const d = s.defense;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("defendYourInternship")}
        description={
          <>
            {t.rich("roleTitleAtEmployerNameVerification", { link: (chunks) => <Link href={`/student/experiences/${id}`} className="underline">{chunks}</Link>, roleTitle: s.experience.roleTitle, employerName: s.experience.employerName })}{" "}<VerificationBadge status={s.verification.status} />
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

      {!d && s.eligibility.canStart && <StartForm s={s} onStart={(body) => run(() => api(`${DEFENSE_API}/mine/${id}/start`, { json: body }), t("yourDefenseHasStarted"))} />}

      {d && d.status === "InProgress" && d.mode === "Written" && (
        <WrittenDefense
          d={d}
          onAnswer={(answer) => run(() => api(`${DEFENSE_API}/mine/${id}/answer`, { json: { answer } }))}
          onFinish={() => run(() => api(`${DEFENSE_API}/mine/${id}/finish`, { method: "POST" }), t("thanksSupervisorNameHasBeenAsked", { supervisorName: s.experience.supervisorName }))}
        />
      )}

      {d && d.status === "InProgress" && d.mode === "Voice" && (
        <VoiceDefense
          resume={() => api<DefenseState>(`${DEFENSE_API}/mine/${id}/start`, { json: {} })}
          complete={(callId) => run(() => api(`${DEFENSE_API}/mine/${id}/voice/complete`, { json: { callId } }), t("thanksSupervisorNameHasBeenAsked", { supervisorName: s.experience.supervisorName }))}
          setErr={setErr}
        />
      )}

      {d && d.status !== "InProgress" && (
        <>
          <Card title={t("whereItStands")}>
            <p className="text-sm">
              {t("verification")}{" "}<VerificationBadge status={s.verification.status} />
            </p>
            {d.status === "AwaitingSupervisor" && <p className="mt-2 text-sm">{t("weEmailedNameASecure", { name: d.supervisor.name })}</p>}
            {d.supervisor.answer && (
              <p className="mt-2 text-sm">
                {t.rich("answeredByNameAnsweredAnswerOnAnsweredAt", { answeredByName: d.supervisor.answeredByName ?? d.supervisor.name, strong: (chunks) => <strong>{chunks}</strong>, answer: d.supervisor.answer, answeredAt: formatDate(d.supervisor.answeredAt) })}
                {d.supervisor.comment && <span className="mt-1 block whitespace-pre-wrap">“{d.supervisor.comment}”</span>}
              </p>
            )}
            {d.overrideInfo?.status && (
              <p className="mt-2 text-sm">
                {t("yourSchoolReviewedThisAnd")}{" "}<VerificationBadge status={d.overrideInfo.status} />. {d.overrideInfo.note}
              </p>
            )}
            {s.credential && (
              <p className="mt-2 text-sm">
                {t("credentialStatus", { status: s.credential.status })}{" "}
                {s.credential.status === "Valid" && (
                  <>
                    <Link href={s.credential.verifyPath} className="underline">
                      {t("publicVerificationPage")}
                    </Link>{" "}
                    ·{" "}
                    <Link href="/credentials" className="underline">
                      {t("yourCredentialWallet")}
                    </Link>
                  </>
                )}
              </p>
            )}
          </Card>
          {d.result && (
            <Card title={t("yourDefenseResult")}>
              <DefenseResult result={d.result} />
            </Card>
          )}
          <Card title={t("workYouDescribed")}>
            <ArtifactList artifacts={d.artifacts} />
          </Card>
          {d.turns.length > 0 && (
            <Card title={t("transcript")}>
              <Transcript turns={d.turns} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StartForm({ s, onStart }: { s: DefenseState; onStart: (body: unknown) => Promise<unknown> }) {
  const t = useCareerT("studentExperiencesDetailDefend");
  const ARTIFACT_KINDS = useArtifactKinds();
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
      <Card title={t("n1DescribeTheWorkYou")}>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("addOneToThreeThings", { employerName: s.experience.employerName })}
        </p>
        <div className="space-y-6">
          {artifacts.map((a, i) => (
            <fieldset key={i} className="space-y-3 rounded-md border border-border p-4">
              <legend className="px-1 text-sm font-medium">{t("work")}{" "}{i + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("type")}>
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
                <Field label={t("shortTitle")}>{(p) => <input {...p} value={a.title} maxLength={150} onChange={(e) => update(i, { title: e.target.value })} required />}</Field>
              </div>
              <Field label={a.kind === "repo" || a.kind === "demo" ? t("link") : t("linkOptional")} hint={t("startsWithHttps")}>
                {(p) => <input {...p} type="url" value={a.url ?? ""} maxLength={500} onChange={(e) => update(i, { url: e.target.value })} required={a.kind === "repo" || a.kind === "demo"} />}
              </Field>
              <Field label={t("whatYouDid")} hint={t("atLeastACoupleOf")}>
                {(p) => <textarea {...p} rows={4} value={a.description} minLength={30} maxLength={2000} onChange={(e) => update(i, { description: e.target.value })} required />}
              </Field>
              {artifacts.length > 1 && (
                <Button type="button" variant="ghost" onClick={() => setArtifacts((list) => list.filter((_, j) => j !== i))}>
                  {t("removeWork")}{" "}{i + 1}
                </Button>
              )}
            </fieldset>
          ))}
        </div>
        {artifacts.length < 3 && (
          <Button type="button" variant="secondary" className="mt-4" onClick={() => setArtifacts((list) => [...list, { ...EMPTY }])}>
            {t("addAnotherPieceOfWork")}
          </Button>
        )}
      </Card>

      <Card title={t("n2ChooseHowToDefend")}>
        <fieldset className="space-y-2 text-sm">
          <legend className="sr-only">{t("defenseFormat")}</legend>
          <label className="flex items-start gap-2">
            <input type="radio" name="mode" className="mt-1" checked={mode === "written"} onChange={() => setMode("written")} disabled={!s.options.writtenAvailable} />
            <span>
              {t.rich("writtenAnswerUpToFive", { strong: (chunks) => <strong>{chunks}</strong> })}
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="mode" className="mt-1" checked={mode === "voice"} onChange={() => setMode("voice")} disabled={!voiceReady} />
            <span>
              {t.rich("voiceAShortSpokenConversation", { strong: (chunks) => <strong>{chunks}</strong> })}
              {!voiceReady && <span className="block text-xs text-muted-foreground">{t("notAvailableAtYourSchool")}</span>}
            </span>
          </label>
        </fieldset>
        <p className="mt-3 text-xs text-muted-foreground">{t("theInterviewerAsksWhatYou")}</p>
      </Card>

      <Card title={t("n3Consent")}>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
          <span>{s.options.consentText}</span>
        </label>
      </Card>

      <Button type="submit" busy={busy} disabled={!consent}>
        {t("startTheDefense")}
      </Button>
    </form>
  );
}

function WrittenDefense({ d, onAnswer, onFinish }: { d: NonNullable<DefenseState["defense"]>; onAnswer: (a: string) => Promise<unknown>; onFinish: () => Promise<unknown> }) {
  const t = useCareerT("studentExperiencesDetailDefend");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card title={t("questionValueOfUpTo", { value: Math.min(d.answered + 1, d.maxQuestions), maxQuestions: d.maxQuestions })}>
      {d.simulated && <p className="mb-3 text-xs text-muted-foreground">{t("developmentModeQuestionsAreGenerated")}</p>}
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
          <Field label={t("yourAnswer")} hint={t("upTo4000Characters")}>
            {(p) => <textarea {...p} rows={6} value={answer} maxLength={4000} onChange={(e) => setAnswer(e.target.value)} required />}
          </Field>
          <Button type="submit" busy={busy} disabled={!answer.trim()}>
            {t("sendAnswer")}
          </Button>
        </form>
      )}
      {d.canFinish && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-sm">{d.awaitingAnswer ? t("youCanFinishNowOr") : t("thatWasTheLastQuestion")}</p>
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
            {t("finishAndSendToMy")}
          </Button>
        </div>
      )}
    </Card>
  );
}

function VoiceDefense({ resume, complete, setErr }: { resume: () => Promise<DefenseState>; complete: (callId: string) => Promise<unknown>; setErr: (e: string | null) => void }) {
  const t = useCareerT("studentExperiencesDetailDefend");
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
      if (!st.voice) throw new Error(t("voiceIsntAvailableRightNow"));
      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(VOICE_KEY);
      vapiRef.current = vapi;
      vapi.on("call-start", () => setPhase("live"));
      vapi.on("call-end", () => {
        void finish();
      });
      vapi.on("error", () => setErr(t("theVoiceConnectionHadA")));
      const call = await vapi.start(st.voice.assistant as Parameters<VapiClient["start"]>[0]);
      callRef.current = call?.id ?? null;
      if (!callRef.current) throw new Error(t("theCallDidntStartCheck"));
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
      setPhase("idle");
    }
  };

  return (
    <Card title={t("voiceDefense")}>
      <p className="mb-3 text-sm">{t("youllTalkWithAnInterviewer")}</p>
      <p role="status" className="mb-3 text-sm font-medium">
        {phase === "idle" ? t("ready") : phase === "connecting" ? t("connecting") : phase === "live" ? t("callInProgress") : t("processingYourCall")}
      </p>
      {phase === "idle" && <Button onClick={start}>{t("startTheCall")}</Button>}
      {phase === "live" && (
        <Button variant="secondary" onClick={() => vapiRef.current?.stop()}>
          {t("endTheCall")}
        </Button>
      )}
    </Card>
  );
}
