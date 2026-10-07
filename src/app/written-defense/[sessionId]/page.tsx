"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AlertCircle, ArrowLeft, Bot, CheckCircle2, Loader2, PenLine, Send, User } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { WrittenDefenseState, errorMessage } from "@/lib/candidateExperience";

const MAX_ANSWER = 4000;

export default function WrittenDefensePage() {
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
      setActionError("Network error while sending your answer. Your text is still here; try again.");
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
      setActionError("Network error while finishing. Try again.");
    } finally {
      setBusy(null);
    }
  };

  if (isLoaded && !isSignedIn) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Sign in to continue your written defense.</p>
        <Link href="/login" className="inline-block px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">Sign in</Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">
        <Link href="/my/results" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> My results
        </Link>
        <div className="glass-panel rounded-2xl p-8 border border-border text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {loadError}
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="p-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your written defense...
      </div>
    );
  }

  const backHref = state.submissionId ? `/my/results/${state.submissionId}` : "/my/results";
  const allAnswered = state.answered >= state.maxQuestions;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-5">
        <Link href={backHref} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to your report
        </Link>

        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <PenLine className="w-6 h-6 text-indigo-700 dark:text-indigo-400" />
            Written defense
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{state.sprintTitle ?? "Your submission"}</p>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-border text-xs text-muted-foreground space-y-1">
          <p>
            The interviewer asks up to {state.maxQuestions} questions about your own code, one at a time. Answer in your own words;
            spelling and grammar are not judged. You can finish after any answer.
          </p>
          <p>Your answers are scored the same way as a voice defense and shown to the reviewer as questions and answers.</p>
          {state.simulated && (
            <p className="text-amber-700 dark:text-amber-400">Development stub: questions are generated without an AI model.</p>
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
                  t.role === "candidate" ? "bg-indigo-500/10 border border-indigo-500/30 text-foreground" : "glass-panel border border-border text-foreground"
                }`}
              >
                <span className="sr-only">{t.role === "candidate" ? "You: " : "Interviewer: "}</span>
                {t.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {state.finished ? (
          <section className="glass-panel rounded-2xl p-5 border border-emerald-500/30 space-y-2">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Defense submitted
            </h2>
            {state.result ? (
              <div className="text-sm text-foreground space-y-1">
                <p>Technical score: <span className="font-semibold">{Math.round(state.result.technicalScore)}/100</span></p>
                <p>Communication: <span className="font-semibold">{Math.round(state.result.communicationScore)}/100</span></p>
                {state.result.missingSkills.length > 0 && <p>Skills to work on: {state.result.missingSkills.join(", ")}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your answers were saved but could not be scored automatically. A person will review them.
              </p>
            )}
            <Link href={backHref} className="inline-block text-xs text-indigo-700 dark:text-indigo-400 underline">
              See your full report and feedback
            </Link>
          </section>
        ) : (
          <div className="space-y-3">
            {state.awaitingAnswer && (
              <form onSubmit={sendAnswer} className="glass-panel rounded-2xl p-4 border border-border space-y-2">
                <label htmlFor="answer" className="text-xs font-semibold text-foreground">
                  Your answer (question {state.answered + 1} of up to {state.maxQuestions})
                </label>
                <textarea
                  id="answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  maxLength={MAX_ANSWER}
                  rows={6}
                  className="w-full rounded-xl bg-card border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground"
                  placeholder="Explain your reasoning, refer to specific functions or lines..."
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">{answer.trim().length}/{MAX_ANSWER} characters</span>
                  <button
                    type="submit"
                    disabled={busy !== null || answer.trim().length === 0}
                    className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    {busy === "answer" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send answer
                  </button>
                </div>
              </form>
            )}
            {allAnswered && <p className="text-sm text-foreground">You have answered every question. Finish to get your result.</p>}
            {state.canFinish && (
              <button
                onClick={finish}
                disabled={busy !== null}
                className={`py-2 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                  allAnswered ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-card hover:bg-muted border border-border text-foreground"
                }`}
              >
                {busy === "finish" && <Loader2 className="w-4 h-4 animate-spin" />}
                Finish and get my result
              </button>
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
