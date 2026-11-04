"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { AlertCircle, ArrowLeft, Bot, CheckCircle2, Send, User } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { WrittenDefenseState, errorMessage } from "@/lib/candidateExperience";
import SignInRequired from "@/components/SignInRequired";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, buttonClass, ErrorBanner, Loading, PageHeader } from "@/components/career/ui";

const MAX_ANSWER = 4000;

export default function WrittenDefensePage() {
  const en = useEn();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ?? "";
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [state, setState] = useState<WrittenDefenseState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<"answer" | "finish" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId) return;
    let active = true;
    authenticatedFetch(`/api/written-defense/${sessionId}`, {}, getToken)
      .then(async (res) => {
        if (res.status === 404) throw new Error("This written defense was not found in your account.");
        if (!res.ok) throw new Error(await errorMessage(res, "Could not load the written defense"));
        return (await res.json()) as WrittenDefenseState;
      })
      .then((data) => {
        if (!active) return;
        setState(data);
        setLoadError(null);
      })
      .catch((e) => active && setLoadError(e instanceof Error ? e.message : "Could not load the written defense."));
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, sessionId, getToken, reloadKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state?.turns.length]);

  const sendAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = answer.trim();
    if (!text || text.length > MAX_ANSWER) return;
    setBusy("answer");
    setActionError(null);
    try {
      const res = await authenticatedFetch(
        `/api/written-defense/${sessionId}/answer`,
        { method: "POST", body: JSON.stringify({ answer: text }) },
        getToken
      );
      if (!res.ok) {
        setActionError(await errorMessage(res, "Could not send your answer"));
        if (res.status === 409) setReloadKey((k) => k + 1);
        return;
      }
      setState((await res.json()) as WrittenDefenseState);
      setAnswer("");
    } catch {
      setActionError("We couldn't reach the server while sending your answer. Your text is still here; try again.");
    } finally {
      setBusy(null);
    }
  };

  const finish = async () => {
    setBusy("finish");
    setActionError(null);
    try {
      const res = await authenticatedFetch(`/api/written-defense/${sessionId}/finish`, { method: "POST" }, getToken);
      if (!res.ok) {
        setActionError(await errorMessage(res, "Could not finish the defense"));
        return;
      }
      setReloadKey((k) => k + 1);
    } catch {
      setActionError("We couldn't reach the server while finishing. Please check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  if (isLoaded && !isSignedIn) {
    return (
      <SignInRequired title={en("Your written defense")} message="Sign in to continue your written defense." />
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link href="/my/results" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />{en(" My results")}
        </Link>
        <ErrorBanner error={loadError} />
      </div>
    );
  }

  if (!state) {
    return <Loading label={en("Loading your written defense...")} />;
  }

  const backHref = state.submissionId ? `/my/results/${state.submissionId}` : "/my/results";
  const allAnswered = state.answered >= state.maxQuestions;

  return (
    <div className="text-foreground">
      <div className="space-y-5">
        <Link href={backHref} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />{en(" Back to your report")}
        </Link>

        <PageHeader title={en("Written defense")} description={state.sprintTitle ?? "Your submission"} />

        <div className="space-y-1 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          <p>
            {en("The interviewer asks up to {maxQuestions} questions about your own code, one at a time. Answer in your own words; spelling and grammar are not judged. You can finish after any answer.", { maxQuestions: state.maxQuestions })}
          </p>
          <p>{en("Your answers are scored the same way as a voice defense and shown to the reviewer as questions and answers.")}</p>
          {state.simulated && (
            <p className="text-amber-700 dark:text-amber-400">{en("Development stub: questions are generated without an AI model.")}</p>
          )}
        </div>

        <div className="space-y-3" aria-live="polite">
          {state.turns.map((t, i) => (
            <div key={i} className={`flex gap-3 ${t.role === "candidate" ? "flex-row-reverse" : ""}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  t.role === "candidate" ? "bg-indigo-600 text-white" : "bg-muted text-foreground border border-border"
                }`}
                aria-hidden
              >
                {t.role === "candidate" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`rounded-2xl px-4 py-3 text-sm max-w-[85%] whitespace-pre-wrap ${
                  t.role === "candidate" ? "bg-muted text-foreground" : "border border-border bg-card text-foreground shadow-sm"
                }`}
              >
                <span className="sr-only">{t.role === "candidate" ? en("You: ") : en("Interviewer: ")}</span>
                {t.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {state.finished ? (
          <section className="space-y-2 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />{en(" Defense submitted")}
            </h2>
            {state.result ? (
              <div className="text-sm text-foreground space-y-1">
                <p>{en("Technical score: ")}<span className="font-semibold">{Math.round(state.result.technicalScore)}/100</span></p>
                {state.result.missingSkills.length > 0 && <p>{en("Skills to work on: {value}", { value: state.result.missingSkills.join(", ") })}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {en("Your answers were saved but could not be scored automatically. A person will review them.")}
              </p>
            )}
            <Link href={backHref} className={`${buttonClass("secondary")} mt-2`}>
              {en("See your full report and feedback")}
            </Link>
          </section>
        ) : (
          <div className="space-y-3">
            {state.awaitingAnswer && (
              <form onSubmit={sendAnswer} className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm">
                <label htmlFor="answer" className="text-sm font-medium text-foreground">
                  {en("Your answer (question {value} of up to {maxQuestions})", { value: state.answered + 1, maxQuestions: state.maxQuestions })}</label>
                <textarea
                  id="answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  maxLength={MAX_ANSWER}
                  rows={6}
                  className="w-full rounded-xl bg-card border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground"
                  placeholder={en("Explain your reasoning, refer to specific functions or lines...")}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{answer.trim().length}/{MAX_ANSWER} characters</span>
                  <Button type="submit" busy={busy === "answer"} disabled={busy !== null || answer.trim().length === 0}>
                    {busy !== "answer" && <Send className="h-4 w-4" aria-hidden />}
                    {en("Send answer")}
                  </Button>
                </div>
              </form>
            )}
            {allAnswered && <p className="text-sm text-foreground">{en("You have answered every question. Finish to get your result.")}</p>}
            {state.canFinish && (
              <Button variant={allAnswered ? "primary" : "secondary"} onClick={finish} busy={busy === "finish"} disabled={busy !== null}>
                {en("Finish and get my result")}
              </Button>
            )}
          </div>
        )}

        {actionError && (
          <p className="text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {actionError}</p>
        )}
      </div>
    </div>
  );
}
