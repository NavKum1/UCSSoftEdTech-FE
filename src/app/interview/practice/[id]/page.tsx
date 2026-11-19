"use client";

/**
 * Coaching on a practice interview (19 Nov 2026, docs/interview_coaching_job_library_plan.md): the result, the four scoring
 * points, and coaching on each answer with a stronger version in the person's own words. "Try this question again" opens a
 * short voice call with only that question; its coaching shows under the first answer. Practice only: nobody else sees it.
 */

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AlertTriangle, Mic, PhoneOff, Plus } from "lucide-react";
import AnswerCoaching, { type AnswerCoachingData } from "@/components/interview/AnswerCoaching";
import { Badge, Button, PageHeader, buttonClass } from "@/components/career/ui";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { openRealtimeCall, type RealtimeCall } from "@/lib/realtimeCall";

interface Coaching {
  answers: AnswerCoachingData[];
  overallScore: number;
  status: string;
  dimensions: { key: string; label: string; good: string; score: number }[];
  strengths: string[];
  improvements: string[];
  notReached: number[];
  reason?: string | null;
}

interface SessionView {
  session: {
    id: string;
    careerName?: string | null;
    jobTitle: string;
    roundName?: string | null;
    createdAt: string;
    plan: { fallback: boolean; questions: { text: string; focus: string }[] };
    /** Tries each question has used, counted by the server (the rule it checks) */
    triesUsed?: Record<string, number>;
  };
  coaching: Coaching | null;
}

// The plain results. en() where shown.
const RESULTS: Record<string, { label: string; tone: "good" | "warn" | "bad" }> = {
  strong: { label: "Strong", tone: "good" },
  "interview-ready": { label: "Interview-ready", tone: "good" },
  "getting-there": { label: "Getting there", tone: "warn" },
  "keep-practicing": { label: "Keep practicing", tone: "bad" },
  "not-enough": { label: "Not enough to coach", tone: "bad" },
};
const MAX_TRIES = 3;

export default function PracticeCoachingPage() {
  return (
    <Suspense fallback={null}>
      <PracticeCoaching />
    </Suspense>
  );
}

function PracticeCoaching() {
  const en = useEn();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params?.id ?? "";
  const { apiFetch, access, ready } = useLegacyApi();
  const [view, setView] = useState<SessionView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [coachError, setCoachError] = useState<{ message: string; retry: boolean } | null>(null);
  const [coaching, setCoaching] = useState(false);
  const [tryState, setTryState] = useState<{ question: number; phase: "connecting" | "live" | "ending" | "coaching" } | null>(null);
  const [tryError, setTryError] = useState<string | null>(null);
  const callRef = useRef<RealtimeCall | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const tryIdRef = useRef<string | null>(null);
  const endingRef = useRef(false);

  const used = Number(search.get("used") ?? NaN);
  const back = Number(search.get("back") ?? NaN);

  const load = async () => {
    const res = await apiFetch(`/api/interview/practice/${id}`, {}, { quiet: true });
    if (res.status === 404) {
      setNotFound(true);
      return null;
    }
    if (!res.ok) return null;
    const body = (await res.json()) as SessionView;
    setView(body);
    return body;
  };

  const coach = async () => {
    setCoachError(null);
    setCoaching(true);
    try {
      const res = await apiFetch(`/api/interview/practice/${id}/coach`, { method: "POST", body: "{}" }, { quiet: true });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setCoachError({ message: body?.error ?? en("We couldn't make your coaching just now. Please try again in a moment."), retry: res.status === 502 || res.status >= 500 });
        return;
      }
      await load();
    } catch {
      setCoachError({ message: en("We couldn't reach Edulexa. Check your internet connection and try again."), retry: true });
    } finally {
      setCoaching(false);
    }
  };

  const startRef = useLatestRef(async () => {
    const v = await load();
    if (v && !v.coaching) await coach();
  });
  useEffect(() => {
    if (ready && id) void startRef.current();
  }, [ready, id, startRef]);

  const stopAudio = () => {
    callRef.current?.close();
    callRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
  };

  // Ends the try on the server (which settles its minutes), then coaches it; the coaching shows under the first answer
  const endTry = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    stopAudio();
    const tryId = tryIdRef.current;
    setTryState((s) => (s ? { ...s, phase: "ending" } : s));
    try {
      if (tryId) {
        await apiFetch(`/api/interview/practice/${tryId}/end`, { method: "POST", body: "{}" }, { quiet: true });
        setTryState((s) => (s ? { ...s, phase: "coaching" } : s));
        const res = await apiFetch(`/api/interview/practice/${tryId}/coach`, { method: "POST", body: "{}" }, { quiet: true });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setTryError(body?.error ?? en("We couldn't coach this try just now."));
        }
        await load();
      }
    } finally {
      tryIdRef.current = null;
      endingRef.current = false;
      setTryState(null);
    }
  };

  const startTry = async (question: number) => {
    setTryError(null);
    setTryState({ question, phase: "connecting" });
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setTryError(en("We couldn't use your microphone. Allow microphone access in your browser, then try again."));
      setTryState(null);
      return;
    }
    micRef.current = mic;
    const audio = document.createElement("audio");
    audio.autoplay = true;
    try {
      callRef.current = await openRealtimeCall({
        mic,
        audio,
        exchange: async (sdpOffer) => {
          const res = await apiFetch(`/api/interview/practice/${id}/retry`, { method: "POST", body: JSON.stringify({ question, sdpOffer }) });
          const body = (await res.json().catch(() => null)) as { practiceId?: string; sdpAnswer?: string; error?: string } | null;
          if (!res.ok || !body?.practiceId || !body.sdpAnswer) throw new Error(body?.error || en("We couldn't start the try. Please try again."));
          tryIdRef.current = body.practiceId;
          return body.sdpAnswer;
        },
        onEnded: () => void endTry(),
      });
      setTryState({ question, phase: "live" });
    } catch (err) {
      stopAudio();
      if (tryIdRef.current) void apiFetch(`/api/interview/practice/${tryIdRef.current}/end`, { method: "POST", body: "{}" }, { quiet: true });
      tryIdRef.current = null;
      setTryError(err instanceof TypeError ? en("We couldn't reach Edulexa. Check your internet connection and try again.") : (err as Error).message);
      setTryState(null);
    }
  };

  // Leaving the page during a try ends it on the server, so it's settled now and its unused minutes go back
  const leaveRef = useLatestRef(() => {
    const tryId = tryIdRef.current;
    if (!tryId || endingRef.current) return;
    callRef.current?.close();
    micRef.current?.getTracks().forEach((t) => t.stop());
    void apiFetch(`/api/interview/practice/${tryId}/end`, { method: "POST", body: "{}", keepalive: true }, { quiet: true });
    tryIdRef.current = null;
  });
  useEffect(() => {
    const leave = () => leaveRef.current();
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [leaveRef]);

  if (access) return <AccessNotice problem={access} feature="Interview practice" />;
  if (notFound)
    return (
      <div className="space-y-4">
        <PageHeader title={en("Interview coaching")} />
        <p className="text-sm text-muted-foreground">{en("That interview couldn't be found. It may have been deleted.")}</p>
        <Link href="/interview/practice" className={buttonClass("primary")}>{en("Back to interview practice")}</Link>
      </div>
    );

  const s = view?.session;
  const c = view?.coaching ?? null;
  const result = c ? RESULTS[c.status] : null;
  const answered = (c?.answers ?? []).filter((a) => a.question >= 0);
  const others = (c?.answers ?? []).filter((a) => a.question < 0);
  const busyTry = tryState !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={s ? en("Coaching: {title}", { title: s.jobTitle }) : en("Interview coaching")}
        description={s ? [s.careerName, s.roundName ? en(s.roundName) : null, new Date(s.createdAt).toLocaleDateString()].filter(Boolean).join(" · ") : undefined}
        actions={
          <Link href="/interview/practice" className={buttonClass("secondary")}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            {en("New interview")}
          </Link>
        }
      />

      {Number.isFinite(used) && used > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          {Number.isFinite(back) && back > 0
            ? en("This interview used {used} of your voice minutes. The other {back} went back to your balance.", { used, back })
            : en("This interview used {used} of your voice minutes.", { used })}
        </p>
      )}

      {(coaching || (!c && !coachError && !notFound)) && (
        <div className="flex flex-col items-center justify-center space-y-4 rounded-xl border border-border bg-card p-12 text-center shadow-sm" aria-busy="true">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary motion-reduce:animate-none" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">{en("Coaching each of your answers")}</h2>
            <p className="text-sm text-muted-foreground">{en("This takes a few seconds.")}</p>
          </div>
        </div>
      )}

      {coachError && !coaching && (
        <div role="alert" className="flex flex-col items-center space-y-3 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <AlertTriangle aria-hidden="true" className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          <p className="max-w-lg text-sm text-foreground">{coachError.message}</p>
          {coachError.retry && <Button onClick={() => void coach()}>{en("Try again")}</Button>}
        </div>
      )}

      {c && !coaching && (
        <>
          <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm" aria-labelledby="result-h">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                {result && <Badge tone={result.tone}>{en(result.label)}</Badge>}
                <h2 id="result-h" className="pt-1 text-xl font-semibold text-foreground">{en("Your result")}</h2>
                {c.reason && <p className="text-sm text-muted-foreground">{c.reason}</p>}
                {s?.plan.fallback && <p className="text-xs text-muted-foreground">{en("This time the questions were the general ones for this kind of interview.")}</p>}
              </div>
              {c.status !== "not-enough" && (
                <p className="text-end">
                  <span className="block text-4xl font-semibold tabular-nums text-foreground">{Math.round(c.overallScore)}<span className="text-xl text-muted-foreground">/100</span></span>
                  <span className="text-xs text-muted-foreground">{en("Overall, for the questions you answered")}</span>
                </p>
              )}
            </div>
            {c.status !== "not-enough" && (
              <ul className="grid gap-3 sm:grid-cols-2">
                {c.dimensions.map((d) => (
                  <li key={d.key} className="space-y-1.5 rounded-lg border border-border p-3">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-medium text-foreground">{d.label}</span>
                      <span className="tabular-nums text-muted-foreground">{Math.round(d.score)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div className={`h-1.5 rounded-full ${d.score >= 70 ? "bg-[var(--brand)]" : d.score >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, Math.max(4, d.score))}%` }} />
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{d.good}</p>
                  </li>
                ))}
              </ul>
            )}
            {(c.strengths.length > 0 || c.improvements.length > 0) && (
              <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                {c.strengths.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">{en("What you did well")}</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">{c.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </div>
                )}
                {c.improvements.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">{en("What to work on")}</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">{c.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </section>

          {tryError && (
            <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{tryError}</p>
          )}

          {tryState && (
            <div role="status" className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--brand)] bg-card p-4 shadow-md">
              <span className="relative flex h-3 w-3" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--brand)]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {tryState.phase === "connecting" ? en("Connecting…") : tryState.phase === "live" ? en("Answer aloud. End the try when you've finished.") : tryState.phase === "ending" ? en("Ending the try…") : en("Coaching your try…")}
                </p>
                <p className="truncate text-xs text-muted-foreground">{s?.plan.questions[tryState.question]?.text}</p>
              </div>
              {tryState.phase === "live" && (
                <Button variant="secondary" onClick={() => void endTry()}>
                  <PhoneOff aria-hidden="true" className="h-4 w-4" />
                  {en("End try")}
                </Button>
              )}
            </div>
          )}

          {answered.length > 0 && (
            <section className="space-y-4" aria-labelledby="answers-h">
              <h2 id="answers-h" className="text-lg font-semibold text-foreground">{en("Answer by answer")}</h2>
              {answered.map((a, i) => (
                <AnswerCoaching key={a.question} a={a} index={i} maxTries={MAX_TRIES} triesUsed={s?.triesUsed?.[String(a.question)] ?? a.tries.length} onTry={busyTry ? undefined : () => void startTry(a.question)} trying={tryState?.question === a.question} />
              ))}
            </section>
          )}

          {c.notReached.length > 0 && s && (
            <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm" aria-labelledby="notreached-h">
              <div>
                <h2 id="notreached-h" className="text-base font-semibold text-foreground">{en("Not reached")}</h2>
                <p className="text-xs text-muted-foreground">{en("We didn't hear answers to these questions, so they don't count against your result.")}</p>
              </div>
              <ul className="divide-y divide-border">
                {c.notReached.map((n) => (
                  <li key={n} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 text-sm text-foreground">{s.plan.questions[n]?.text}</span>
                    <Button variant="ghost" onClick={() => void startTry(n)} disabled={busyTry}>
                      <Mic aria-hidden="true" className="h-4 w-4" />
                      {en("Try it")}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {others.length > 0 && (
            <section className="space-y-3" aria-labelledby="others-h">
              <h2 id="others-h" className="text-base font-semibold text-foreground">{en("Other answers")}</h2>
              {others.map((a, i) => <AnswerCoaching key={`o${i}`} a={a} index={answered.length + i} maxTries={0} />)}
            </section>
          )}

          <p className="text-xs text-muted-foreground">{en("Practice only. Nobody else sees this, and it never affects a real application.")}</p>
        </>
      )}
    </div>
  );
}
