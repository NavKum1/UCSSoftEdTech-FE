"use client";

import React, { useState, useEffect } from "react";
import {
  Compass,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Target,
  Layers,
  ChevronRight,
  TrendingUp,
  Award,
  Zap,
  BookOpen,
  Code2,
} from "lucide-react";
import Link from "next/link";

interface CounsellingOption {
  text: string;
  description: string;
  targetTrack: string;
  weight: number;
}

interface CounsellingQuestion {
  id: number;
  title: string;
  subtitle: string;
  options: CounsellingOption[];
}

interface EvaluationResponse {
  evaluatedAt: string;
  primaryTrack: string;
  secondaryTrack: string;
  matchConfidence: string;
  scores: Record<string, number>;
  overview: string;
  recommendedFirstSprint: string;
  actionPlan: string[];
  recommendedLanguages: string[];
}

export default function CareerCounsellingQuizPage() {
  const [questions, setQuestions] = useState<CounsellingQuestion[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [result, setResult] = useState<EvaluationResponse | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/quiz/counselling/questions`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data);
      }
    } catch (err) {
      console.error("Failed to fetch counselling questions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (questionId: number, optionIdx: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }));
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      submitEvaluation();
    }
  };

  const submitEvaluation = async () => {
    setEvaluating(true);
    try {
      const payload = {
        answers: Object.entries(selectedAnswers).map(([qId, optIdx]) => ({
          questionId: parseInt(qId, 10),
          selectedOptionIndex: optIdx,
        })),
      };

      const res = await fetch(`${apiBase}/api/quiz/counselling/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (err) {
      console.error("Failed to evaluate counselling:", err);
    } finally {
      setEvaluating(false);
    }
  };

  const resetQuiz = () => {
    setSelectedAnswers({});
    setCurrentStep(0);
    setResult(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 font-sans">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // ----------------------------------------------------
  // RESULT VIEW
  // ----------------------------------------------------
  if (result) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-10 font-sans">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Card */}
          <div className="p-6 md:p-8 rounded-2xl border border-border bg-card shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Career Diagnostic Assessment</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  Your Career Alignment Roadmap
                </h1>
                <p className="text-xs text-muted-foreground">
                  Match Confidence: <span className="font-semibold text-emerald-500">{result.matchConfidence}</span>
                </p>
              </div>

              <button
                onClick={resetQuiz}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card/60 text-xs font-semibold text-foreground hover:bg-card transition-colors shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retake Diagnostic
              </button>
            </div>

            {/* Primary & Secondary Track Highlight */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl border border-primary/40 bg-primary/5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                  <Award className="w-4 h-4" />
                  <span>Primary Recommended Track</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  {result.primaryTrack}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {result.overview}
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-border bg-muted/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Layers className="w-4 h-4" />
                  <span>Secondary Growth Track</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  {result.secondaryTrack}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Complementary discipline for high-velocity career promotion and multi-disciplinary leadership.
                </p>
              </div>
            </div>

            {/* Action Plan */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Immediate 90-Day Competency Action Plan
              </h3>
              <div className="space-y-2">
                {result.actionPlan.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3.5 rounded-xl border border-border/70 bg-card/40 text-xs text-foreground"
                  >
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Languages */}
            <div className="pt-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Recommended Languages & Frameworks:
              </span>
              <div className="flex flex-wrap gap-2 mt-2">
                {result.recommendedLanguages.map((lang) => (
                  <span
                    key={lang}
                    className="px-3 py-1 rounded-lg border border-border bg-muted/50 text-xs font-mono font-medium text-foreground"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>

            {/* Starter Sprint Banner */}
            <div className="p-5 rounded-2xl border border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase text-primary tracking-wider">
                  Recommended Practical Kata
                </span>
                <p className="text-sm font-bold text-foreground">
                  {result.recommendedFirstSprint}
                </p>
              </div>
              <Link
                href="/sprint/distributed-database"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-95 transition-opacity shrink-0"
              >
                <span>Launch This Sprint</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // QUESTION STEPS
  // ----------------------------------------------------
  const q = questions[currentStep];
  const progressPercent = Math.round(((currentStep + 1) / questions.length) * 100);
  const isAnswered = selectedAnswers[q.id] !== undefined;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">
              Career Counselling Diagnostic
            </h1>
            <p className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {questions.length}
            </p>
          </div>
        </div>

        <Link
          href="/prep/exam"
          className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Exit to Written Exams →
        </Link>
      </header>

      {/* Progress Bar */}
      <div className="w-full bg-muted h-1">
        <div
          className="bg-primary h-1 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Questionnaire */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-10 flex flex-col justify-center">
        <div className="p-6 md:p-8 rounded-2xl border border-border bg-card shadow-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              {q.title}
            </h2>
            <p className="text-xs text-muted-foreground">{q.subtitle}</p>
          </div>

          <div className="space-y-3">
            {q.options.map((opt, idx) => {
              const isSelected = selectedAnswers[q.id] === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(q.id, idx)}
                  className={`w-full text-left p-4 rounded-xl border text-xs transition-all flex items-start justify-between gap-3 ${
                    isSelected
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary shadow-sm"
                      : "border-border/80 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground text-sm">
                      {opt.text}
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={!isAnswered || evaluating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              <span>
                {currentStep < questions.length - 1
                  ? "Next Question"
                  : evaluating
                  ? "Computing Fit..."
                  : "Generate Career Diagnosis"}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
