"use client";

/**
 * Coaching on a practice interview (19 Nov 2026, docs/interview_coaching_job_library_plan.md): the result, the four scoring
 * points, and coaching on each answer with a stronger version in the person's own words. "Try this question again" opens a
 * short voice call with only that question; its coaching shows under the first answer. Practice only: nobody else sees it.
 * Stage 3 (21 Nov 2026): Workplace practice's Talk it through conversations are coached here too, moment by moment, and
 * "How you spoke" (Speaking practice's feedback, when it's turned on) shows for interviews and conversations.
 */

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Mic, PhoneOff, Plus } from "lucide-react";
import AnswerCoaching, { type AnswerCoachingData } from "@/components/interview/AnswerCoaching";
import { Badge, Button, PageHeader, buttonClass } from "@/components/career/ui";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { usePracticeCall } from "@/lib/usePracticeCall";

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
    /** "drill": one question at a time (stage 2); "situation": a Talk it through conversation (stage 3) */
    mode?: string;
    style?: string;
    /** Talk it through: the Workplace practice track, the situation's code ("own" for the person's own), who the AI played, and the situation */
    track?: string | null;
    scenario?: string | null;
    otherPerson?: string | null;
    situation?: string | null;
  };
  coaching: Coaching | null;
  /** How you spoke (Speaking practice's feedback); null when it's off */
  speaking?: Speaking | null;
  /** Why it's off: "consent" (not turned on yet) or "region" (not offered where the person is) */
  speakingOff?: string | null;
}

interface Speaking {
  yourWords: number;
  otherWords: number;
  yourShare: number;
  answers: number;
  averageAnswerWords: number;
  longestAnswerWords: number;
  fillers: { total: number; per100Words: number; top: { word: string; count: number }[] };
  tips: string[];
  note: string;
}

// The other person's manner in a conversation (the interview styles). en() where shown.
const MANNERS: Record<string, string> = { supportive: "Calm", standard: "Typical", demanding: "Difficult" };

/** How you spoke: filler words, the person's share of the talking and how long their answers were */
function HowYouSpoke({ sp, situation }: { sp: Speaking; situation: boolean }) {
  const en = useEn();
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm" aria-labelledby="spoke-h">
      <h2 id="spoke-h" className="text-lg font-semibold text-foreground">{en("How you spoke")}</h2>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <dt className="text-xs text-muted-foreground">{en("Filler words")}</dt>
          <dd className="text-2xl font-semibold tabular-nums text-foreground">{sp.fillers.total}</dd>
        </div>
        <div className="rounded-lg border border-border p-3">
          <dt className="text-xs text-muted-foreground">{en("Your share of the talking")}</dt>
          <dd className="text-2xl font-semibold tabular-nums text-foreground">{sp.yourShare}%</dd>
        </div>
        <div className="rounded-lg border border-border p-3">
          <dt className="text-xs text-muted-foreground">{situation ? en("Words in a reply, on average") : en("Words in an answer, on average")}</dt>
          <dd className="text-2xl font-semibold tabular-nums text-foreground">{sp.averageAnswerWords}</dd>
        </div>
      </dl>
      {sp.fillers.top.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{en("Most often:")}</span>
          {sp.fillers.top.slice(0, 4).map((f) => (
            <span key={f.word} className="rounded-full border border-border px-2 py-0.5 text-foreground">
              “{f.word}” × {f.count}
            </span>
          ))}
        </p>
      )}
      <ul className="space-y-1.5 text-sm text-foreground">
        {sp.tips.map((t, i) => (
          <li key={i} className="flex gap-2"><span aria-hidden="true" className="text-[var(--brand)]">•</span><span>{t}</span></li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{sp.note}</p>
    </section>
  );
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
  const [savedStories, setSavedStories] = useState<number[]>([]);
  const call = usePracticeCall(apiFetch);
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

  // Ends the try on the server (which settles its minutes), then coaches it; the coaching shows under the first answer
  const endTry = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setTryState((s) => (s ? { ...s, phase: "ending" } : s));
    try {
      const ended = await call.end();
      if (ended) {
        setTryState((s) => (s ? { ...s, phase: "coaching" } : s));
        const res = await apiFetch(`/api/interview/practice/${ended.id}/coach`, { method: "POST", body: "{}" }, { quiet: true });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setTryError(body?.error ?? en("We couldn't coach this try just now."));
        }
        await load();
      }
    } finally {
      endingRef.current = false;
      setTryState(null);
    }
  };

  const startTry = async (question: number) => {
    setTryError(null);
    setTryState({ question, phase: "connecting" });
    const started = await call.start(`/api/interview/practice/${id}/retry`, { question }, () => void endTry());
    if ("error" in started) {
      setTryError(started.error);
      setTryState(null);
      return;
    }
    setTryState({ question, phase: "live" });
  };

  // Stage 2: an answer saved as one of the person's stories, starting from the stronger version; they finish it on the progress page
  const saveStory = async (a: AnswerCoachingData) => {
    const res = await apiFetch("/api/interview/practice/stories", {
      method: "POST",
      body: JSON.stringify({ title: a.questionText.slice(0, 200), situation: "", action: a.stronger ?? a.answer, result: "", learned: "", sessionId: id, question: a.question }),
    }, { quiet: true });
    if (res.ok) setSavedStories((x) => [...x, a.question]);
  };

  if (access) return <AccessNotice problem={access} feature="Interview practice" />;
  if (notFound)
    return (
      <div className="space-y-4">
        <PageHeader title={en("Interview coaching")} />
        <p className="text-sm text-muted-foreground">{en("That interview couldn't be found. It may have been deleted.")}</p>
        <Link href="/interview/practice" className={buttonClass("secondary")}>{en("Back to interview practice")}</Link>
      </div>
    );

  const s = view?.session;
  // A stored record missing parts reads as empty ones
  const raw = view?.coaching ?? null;
  const c: Coaching | null = raw ? { ...raw, answers: (raw.answers ?? []).map((a) => ({ ...a, tries: a.tries ?? [], worked: a.worked ?? [], missing: a.missing ?? [] })), dimensions: raw.dimensions ?? [], strengths: raw.strengths ?? [], improvements: raw.improvements ?? [], notReached: raw.notReached ?? [], status: raw.status ?? "not-enough", overallScore: raw.overallScore ?? 0 } : null;
  // A conversation (stage 3) is "handled well", not "interview-ready"
  const result = c ? (s?.mode === "situation" && c.status === "interview-ready" ? { label: "Handled well", tone: "good" as const } : RESULTS[c.status]) : null;
  const answered = (c?.answers ?? []).filter((a) => a.question >= 0);
  const others = (c?.answers ?? []).filter((a) => a.question < 0);
  const busyTry = tryState !== null;
  const drill = s?.mode === "drill";
  const situation = s?.mode === "situation";
  const own = situation && s?.scenario === "own";
  const title = !s ? en("Interview coaching")
    : own ? en("Your own conversation with {who}", { who: s.otherPerson ?? "" })
    : situation ? en("Talk it through: {title}", { title: s.jobTitle })
    : drill ? en("One question at a time: {title}", { title: s.jobTitle }) : en("Coaching: {title}", { title: s.jobTitle });
  const nextQuestion = drill ? c?.notReached[0] : undefined;
  // The question in the "next" card isn't listed again under "Questions still to answer"
  const nextShown = c != null && !coaching && drill && nextQuestion !== undefined && s != null && !tryState;
  const stillToAnswer = (c?.notReached ?? []).filter((n) => !(nextShown && n === nextQuestion));

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={s ? [s.careerName, situation ? en("{manner} other person", { manner: en(MANNERS[s.style ?? "standard"] ?? "Typical") }) : s.roundName ? en(s.roundName) : null, new Date(s.createdAt).toLocaleDateString()].filter(Boolean).join(" · ") : undefined}
        actions={
          situation ? (
            <Link href={`/practice/workplace${s?.track ? `?track=${encodeURIComponent(s.track)}` : ""}`} className={buttonClass("secondary")}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              {en("Back to Workplace practice")}
            </Link>
          ) : (
            <Link href="/interview/practice" className={buttonClass("secondary")}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              {en("New interview")}
            </Link>
          )
        }
      />

      {Number.isFinite(used) && used > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          {Number.isFinite(back) && back > 0
            ? (situation ? en("This conversation used {used} of your voice minutes. The other {back} went back to your balance.", { used, back }) : en("This interview used {used} of your voice minutes. The other {back} went back to your balance.", { used, back }))
            : (situation ? en("This conversation used {used} of your voice minutes.", { used }) : en("This interview used {used} of your voice minutes.", { used }))}
        </p>
      )}

      {(coaching || (!c && !coachError && !notFound)) && (
        <div className="flex flex-col items-center justify-center space-y-4 rounded-xl border border-border bg-card p-12 text-center shadow-sm" aria-busy="true">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary motion-reduce:animate-none" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">{situation ? en("Coaching each of your replies") : en("Coaching each of your answers")}</h2>
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

      {c && !coaching && drill && nextQuestion !== undefined && s && !tryState && (
        <section className="space-y-3 rounded-xl border border-[var(--brand)] bg-card p-6 shadow-sm" aria-labelledby="next-h">
          <p className="text-xs font-medium text-muted-foreground">{en("Question {n} of {total}", { n: nextQuestion + 1, total: s.plan.questions.length })}</p>
          <h2 id="next-h" className="text-lg font-semibold text-foreground">{s.plan.questions[nextQuestion]?.text}</h2>
          <p className="text-sm text-muted-foreground">{en("Answer aloud in a short call. Your coaching shows here straight after.")}</p>
          <Button onClick={() => void startTry(nextQuestion)}>
            <Mic aria-hidden="true" className="h-4 w-4" />
            {answered.length === 0 ? en("Answer the first question") : en("Next question")}
          </Button>
        </section>
      )}

      {situation && s?.situation && (
        <section className="space-y-1 rounded-xl border border-border bg-muted/30 p-4" aria-labelledby="situation-h">
          <h2 id="situation-h" className="text-sm font-semibold text-foreground">{en("The situation")}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{s.situation}</p>
          {s.otherPerson && <p className="text-xs text-muted-foreground">{en("You talked with: {who} (played by the AI)", { who: s.otherPerson })}</p>}
        </section>
      )}

      {c && !coaching && (
        <>
          {!(drill && answered.length === 0) && (
          <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm" aria-labelledby="result-h">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                {result && <Badge tone={result.tone}>{en(result.label)}</Badge>}
                <h2 id="result-h" className="pt-1 text-xl font-semibold text-foreground">{en("Your result")}</h2>
                {c.reason && <p className="text-sm text-muted-foreground">{c.reason}</p>}
                {s?.plan.fallback && !situation && <p className="text-xs text-muted-foreground">{en("This time the questions were the general ones for this kind of interview.")}</p>}
              </div>
              {c.status !== "not-enough" && (
                <p className="text-end">
                  <span className="block text-4xl font-semibold tabular-nums text-foreground">{Math.round(c.overallScore)}<span className="text-xl text-muted-foreground">/100</span></span>
                  <span className="text-xs text-muted-foreground">{situation ? en("Overall, for the moments you replied to") : en("Overall, for the questions you answered")}</span>
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
          )}

          {view?.speaking && <HowYouSpoke sp={view.speaking} situation={situation} />}
          {!view?.speaking && view?.speakingOff === "consent" && answered.length > 0 && (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              {en("Want to see how you spoke: your filler words, your share of the talking and how long your answers were?")}{" "}
              <Link href="/prep/delivery" className="font-medium text-[var(--brand)] underline-offset-2 hover:underline">{en("Turn on speaking feedback in Speaking practice")}</Link>
            </p>
          )}

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
                  {tryState.phase === "connecting" ? en("Connecting…") : tryState.phase === "live" ? (situation ? en("Reply aloud. End the try when you've finished.") : en("Answer aloud. End the try when you've finished.")) : tryState.phase === "ending" ? en("Ending the try…") : en("Coaching your try…")}
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
              <h2 id="answers-h" className="text-lg font-semibold text-foreground">{situation ? en("Moment by moment") : en("Answer by answer")}</h2>
              {answered.map((a, i) => (
                <AnswerCoaching key={a.question} a={a} index={i} maxTries={MAX_TRIES} triesUsed={drill ? Math.max(0, (s?.triesUsed?.[String(a.question)] ?? 1) - 1) : s?.triesUsed?.[String(a.question)] ?? a.tries.length}
                  wording={situation ? "situation" : "interview"}
                  onSaveStory={situation ? undefined : () => void saveStory(a)} storySaved={savedStories.includes(a.question)} onTry={busyTry ? undefined : () => void startTry(a.question)} trying={tryState?.question === a.question} />
              ))}
            </section>
          )}

          {stillToAnswer.length > 0 && s && (
            <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm" aria-labelledby="notreached-h">
              <div>
                <h2 id="notreached-h" className="text-base font-semibold text-foreground">{drill ? en("Questions still to answer") : situation ? en("Moments not reached") : en("Not reached")}</h2>
                <p className="text-xs text-muted-foreground">{drill ? en("Answer them in any order. Each one is coached straight after.") : situation ? en("The conversation ended before these moments, so they don't count against your result.") : en("We didn't hear answers to these questions, so they don't count against your result.")}</p>
              </div>
              <ul className="divide-y divide-border">
                {stillToAnswer.map((n) => (
                  <li key={n} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 text-sm text-foreground">{s.plan.questions[n]?.text}</span>
                    <Button variant="ghost" onClick={() => void startTry(n)} disabled={busyTry}>
                      <Mic aria-hidden="true" className="h-4 w-4" />
                      {drill ? en("Answer") : en("Try it")}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {others.length > 0 && (
            <section className="space-y-3" aria-labelledby="others-h">
              <h2 id="others-h" className="text-base font-semibold text-foreground">{situation ? en("Other replies") : en("Other answers")}</h2>
              {others.map((a, i) => <AnswerCoaching key={`o${i}`} a={a} index={answered.length + i} maxTries={0} wording={situation ? "situation" : "interview"} />)}
            </section>
          )}

          <p className="text-xs text-muted-foreground">{en("Practice only. Nobody else sees this, and it never affects a real application.")}</p>
        </>
      )}
    </div>
  );
}
