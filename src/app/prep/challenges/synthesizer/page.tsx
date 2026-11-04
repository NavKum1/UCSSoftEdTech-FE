"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, Card, PageHeader, buttonClass } from "@/components/career/ui";

interface SynthesizedChallenge {
  id: string;
  baseChallengeSlug: string;
  title: string;
  mutatedStoryNarrative: string;
  language: string;
  starterCode: string;
  synthesizedTestHarness: string;
  targetedWeakness: string;
  difficultyRating: string;
  antiCheatEntropyHash: string;
  generatedAt: string;
}

interface EvaluationResult {
  evaluationId: string;
  challengeId: string;
  testsPassed: number;
  totalTests: number;
  executionStatus: string;
  performanceMs: number;
  weaknessExploited: boolean;
  remediationHint: string;
  selfHealingGuidance: string;
  evaluatedAt: string;
}

export default function ChallengeSynthesizerPage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [baseSlug, setBaseSlug] = useState<string>("distributed-lru");
  const [language, setLanguage] = useState<string>("csharp");
  const [weakness, setWeakness] = useState<string>("ConcurrentRaceCondition");
  const [difficulty, setDifficulty] = useState<string>("Hard");

  const [activeChallenge, setActiveChallenge] = useState<SynthesizedChallenge | null>(null);
  const [candidateCode, setCandidateCode] = useState<string>("");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSynthesize = async () => {
    setLoading(true);
    setMessage(null);
    setEvaluation(null);
    try {
      const res = await apiFetch(`/api/challenges/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseChallengeSlug: baseSlug,
          language,
          targetedWeakness: weakness,
          difficultyRating: difficulty,
        }),
      });

      const data = await res.json();
      if (data.success && data.challenge) {
        setActiveChallenge(data.challenge);
        setCandidateCode(data.challenge.starterCode);
        setMessage(en("Generated a new challenge: {title}.", { title: data.challenge.title }));
      }
    } catch (e) {
      console.error("Error synthesizing challenge:", e);
      setMessage(en("We couldn't create the challenge. Please try again in a moment."));
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!activeChallenge) return;
    setEvaluating(true);
    try {
      const res = await apiFetch(`/api/challenges/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: activeChallenge.id,
          candidateCode,
        }),
      });

      const data = await res.json();
      if (data.success && data.evaluation) {
        setEvaluation(data.evaluation);
      }
    } catch (e) {
      console.error("Error evaluating submission:", e);
    } finally {
      setEvaluating(false);
    }
  };

  // Auto-synthesize on initial load
  const handleSynthesizeRef = useLatestRef(handleSynthesize);
  useEffect(() => {
    if (!ready) return;
    handleSynthesizeRef.current();
  }, [ready, handleSynthesizeRef]);

  if (access) return <AccessNotice problem={access} feature="The challenge synthesizer" />;

  const selectClass =
    "rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:border-indigo-500";
  const passed = evaluation?.executionStatus === "Passed";

  return (
    <div className="text-foreground">
      <PageHeader
        title={en("Generated coding challenges")}
        description={en("Generate a new variant of a coding challenge that targets a common weakness, write your solution, and run it against the generated tests.")}
        actions={
          <>
            <Link href="/prep/career" className={buttonClass("secondary")}>
              {en("Career path")}
            </Link>
            <Link href="/practice/failover" className={buttonClass("secondary")}>
              {en("Failover practice")}
            </Link>
          </>
        }
      />

      {message && (
        <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm text-foreground shadow-sm">
          <span>{message}</span>
          <Button variant="ghost" onClick={() => setMessage(null)}>
            {en("Dismiss")}
          </Button>
        </div>
      )}

      {/* Challenge settings */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="synth-base" className="mb-1 block text-sm font-medium text-foreground">{en("Challenge")}</label>
              <select id="synth-base" value={baseSlug} onChange={(e) => setBaseSlug(e.target.value)} className={selectClass}>
                <option value="distributed-lru">{en("Distributed LRU cache")}</option>
                <option value="rate-limiter">{en("Sliding-window rate limiter")}</option>
                <option value="stream-top-k">{en("Top-K stream ranker")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="synth-language" className="mb-1 block text-sm font-medium text-foreground">{en("Language")}</label>
              <select id="synth-language" value={language} onChange={(e) => setLanguage(e.target.value)} className={selectClass}>
                <option value="csharp">{en("C# (.NET 10)")}</option>
                <option value="typescript">{en("TypeScript (Node.js)")}</option>
                <option value="go">{en("Go")}</option>
                <option value="python">{en("Python 3.12")}</option>
                <option value="rust">{en("Rust")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="synth-weakness" className="mb-1 block text-sm font-medium text-foreground">{en("Weakness to target")}</label>
              <select id="synth-weakness" value={weakness} onChange={(e) => setWeakness(e.target.value)} className={selectClass}>
                <option value="ConcurrentRaceCondition">{en("Race condition")}</option>
                <option value="OffByOneBoundary">{en("Off-by-one boundary")}</option>
                <option value="MemoryLeakUnderChurn">{en("Memory leak under churn")}</option>
                <option value="FloatingPointPrecision">{en("Floating-point drift")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="synth-difficulty" className="mb-1 block text-sm font-medium text-foreground">{en("Difficulty")}</label>
              <select id="synth-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={selectClass}>
                <option value="Medium">{en("Medium")}</option>
                <option value="Hard">{en("Hard")}</option>
                <option value="Staff_Principal">{en("Expert")}</option>
              </select>
            </div>
          </div>

          <Button onClick={handleSynthesize} busy={loading}>
            {loading ? en("Generating…") : en("Generate a challenge")}
          </Button>
        </div>
      </Card>

      {activeChallenge && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <span className="text-sm text-muted-foreground">
                  {en("Difficulty: {difficultyRating}", { difficultyRating: activeChallenge.difficultyRating })}
                </span>
                <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {activeChallenge.antiCheatEntropyHash.slice(0, 16)}
                </span>
              </div>

              <h2 className="mt-3 text-lg font-semibold text-foreground">{activeChallenge.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{activeChallenge.mutatedStoryNarrative}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge>{en("Targets: {targetedWeakness}", { targetedWeakness: activeChallenge.targetedWeakness })}</Badge>
                <Badge>{en("Language: {value}", { value: activeChallenge.language })}</Badge>
              </div>
            </Card>

            <Card title={en("Generated tests")}>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-3 font-mono text-xs text-foreground">
                {activeChallenge.synthesizedTestHarness}
              </pre>
            </Card>
          </div>

          <div className="space-y-6">
            <section className="flex h-[520px] flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-3">
                <h2 className="text-base font-semibold">{en("Your solution ({language})", { language: activeChallenge.language })}</h2>
                <Button onClick={handleEvaluate} busy={evaluating}>
                  {evaluating ? en("Running tests…") : en("Run tests")}
                </Button>
              </div>

              <textarea
                value={candidateCode}
                onChange={(e) => setCandidateCode(e.target.value)}
                aria-label={en("Your solution")}
                className="w-full flex-1 resize-none rounded-lg border border-border bg-background p-4 font-mono text-xs text-foreground focus:outline-none focus:border-indigo-500"
                spellCheck={false}
              />
            </section>

            {evaluation && (
              <div
                role="status"
                className={`rounded-xl border p-5 shadow-sm ${
                  passed
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                    : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <span className={`text-sm font-semibold ${passed ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}>
                    {passed ? en("All tests passed") : en("Some tests failed")}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {en("{testsPassed} / {totalTests} passed ({performanceMs} ms)", { testsPassed: evaluation.testsPassed, totalTests: evaluation.totalTests, performanceMs: evaluation.performanceMs })}
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    <strong className="font-medium text-foreground">{en("What happened:")}</strong> {evaluation.remediationHint}
                  </p>
                  {evaluation.selfHealingGuidance && (
                    <p className="rounded-lg border border-border bg-card p-3 text-foreground">
                      <strong className="font-medium">{en("How to fix it:")}</strong> {evaluation.selfHealingGuidance}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
