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
  recommendedSprintSlug?: string;
  recommendedCandidateTrack?: string;
  actionPlan: string[];
  recommendedLanguages: string[];
}

const DEFAULT_COUNSELLING_QUESTIONS: CounsellingQuestion[] = [
  {
    id: 1,
    title: "What engineering or business problem excites you the most?",
    subtitle: "Choose the problem space you find naturally engaging and rewarding to solve.",
    options: [
      { text: "Designing ultra low-latency database queries & distributed caching systems", description: "Deep focus on locks, memory bounds, and concurrency.", targetTrack: "Distributed Backend & Systems", weight: 15 },
      { text: "Automating zero-downtime deployment pipelines & multi-cloud resilience", description: "Focus on Kubernetes, CI/CD, and infrastructure-as-code.", targetTrack: "Cloud, DevOps & SRE", weight: 15 },
      { text: "Uncovering security flaws, auditing authorization, & penetration defense", description: "Zero-trust mindset, cryptographic safeguards, and incident containment.", targetTrack: "Cybersecurity & Zero-Trust", weight: 15 },
      { text: "Building delightful, high-performance web applications & micro-animations", description: "Focus on UI responsiveness, UX design systems, and client state.", targetTrack: "Modern Frontend & Web Architecture", weight: 15 },
      { text: "Scaling vector databases, embedding pipelines, & real-time numerical processing", description: "Large-scale data infrastructure, RAG models, and tensor processing.", targetTrack: "Data Engineering & AI/MLOps", weight: 15 },
      { text: "Defining product roadmaps, analyzing user telemetry, & prioritizing features", description: "Cross-functional leadership, customer empathy, and metric growth.", targetTrack: "Product Management & Strategy", weight: 15 }
    ]
  },
  {
    id: 2,
    title: "How do you prefer spending a productive coding afternoon?",
    subtitle: "Reflects your ideal day-to-day focus and state of flow.",
    options: [
      { text: "Deep in code, debugging concurrency locks and optimizing algorithmic performance", description: "Independent deep technical focus.", targetTrack: "Distributed Backend & Systems", weight: 10 },
      { text: "Managing cloud environments, observability dashboards, and incident automation", description: "Dynamic infrastructure health and platform automation.", targetTrack: "Cloud, DevOps & SRE", weight: 10 },
      { text: "Analyzing threat vectors, code-reviewing CVE vulnerabilities, and red-teaming", description: "Adversarial thinking and defensive architecture.", targetTrack: "Cybersecurity & Zero-Trust", weight: 10 },
      { text: "Crafting interactive UI components and polishing visual detail in browsers", description: "Visual, creative, and technical blend.", targetTrack: "Modern Frontend & Web Architecture", weight: 10 },
      { text: "Training models, optimizing pipeline throughput, and tuning feature vectors", description: "Scientific exploration paired with high-performance compute.", targetTrack: "Data Engineering & AI/MLOps", weight: 10 },
      { text: "Collaborating across engineers, designers, and customers to solve pain points", description: "Strategic synthesis, communication, and roadmap decisions.", targetTrack: "Product Management & Strategy", weight: 10 }
    ]
  },
  {
    id: 3,
    title: "Which type of intellectual puzzle brings you the greatest satisfaction?",
    subtitle: "Understanding your intrinsic intellectual motivation.",
    options: [
      { text: "Love statistical modeling, linear algebra, vector embeddings, & tensor math", description: "Strong appetite for machine learning and heavy numerical processing.", targetTrack: "Data Engineering & AI/MLOps", weight: 15 },
      { text: "Prefer applied systems engineering (APIs, transactions, database indexes, thread pools)", description: "Pragmatic application development over theoretical math.", targetTrack: "Distributed Backend & Systems", weight: 10 },
      { text: "Prefer user-centric design, animations, CSS layouts, and DOM event flow", description: "Front-of-the-glass engineering with aesthetic polish.", targetTrack: "Modern Frontend & Web Architecture", weight: 10 },
      { text: "Prefer infrastructure reliability, Linux kernel networking, and container runtimes", description: "Platform reliability, traffic steering, and OS systems.", targetTrack: "Cloud, DevOps & SRE", weight: 10 }
    ]
  },
  {
    id: 4,
    title: "When a SEV-1 production outage strikes at 2 AM, what is your first instinct?",
    subtitle: "Reveals your natural crisis response and systems intuition.",
    options: [
      { text: "Inspect distributed RPC traces, thread dumps, and database connection pools", description: "Pinpointing concurrency deadlocks and memory boundaries.", targetTrack: "Distributed Backend & Systems", weight: 15 },
      { text: "Roll back the canary release, inspect Kubernetes ingress pods, and drain unhealthy nodes", description: "Restoring traffic flow and container health first.", targetTrack: "Cloud, DevOps & SRE", weight: 15 },
      { text: "Verify breach indicators, audit edge reverse proxies, and check for rogue API tokens", description: "Containing security exposure and exfiltration risks.", targetTrack: "Cybersecurity & Zero-Trust", weight: 15 },
      { text: "Triage user-facing blast radius, draft external status communications, and coordinate recovery", description: "Managing stakeholder transparency and impact mitigation.", targetTrack: "Product Management & Strategy", weight: 15 }
    ]
  },
  {
    id: 5,
    title: "Which architectural trade-off do you find most natural to champion?",
    subtitle: "Engineering is the art of trade-offs. Select the one you defend most passionately.",
    options: [
      { text: "Strict linearizability over availability (Rejecting writes rather than risking dirty reads)", description: "Data consistency is non-negotiable.", targetTrack: "Distributed Backend & Systems", weight: 12 },
      { text: "Active-active multi-region redundancy despite higher cloud infrastructure costs", description: "Zero-downtime survivability is paramount.", targetTrack: "Cloud, DevOps & SRE", weight: 12 },
      { text: "Strict zero-trust mutual TLS and signed tokens on every internal service hop", description: "Security must never be sacrificed for convenience.", targetTrack: "Cybersecurity & Zero-Trust", weight: 12 },
      { text: "60 FPS rendering and sub-100ms First Contentful Paint on low-end devices", description: "User experience and accessibility define software quality.", targetTrack: "Modern Frontend & Web Architecture", weight: 12 },
      { text: "Shipping an intuitive MVP fast with telemetry over building speculative perfection", description: "Market validation and user feedback trump theoretical purity.", targetTrack: "Product Management & Strategy", weight: 12 }
    ]
  },
  {
    id: 6,
    title: "What is your ultimate 5-year Career North Star?",
    subtitle: "The highest-leverage role where you envision creating transformative impact.",
    options: [
      { text: "Principal Distributed Systems Architect engineering million-RPS infrastructure", description: "Technical authority on scalable, fault-tolerant backends.", targetTrack: "Distributed Backend & Systems", weight: 15 },
      { text: "VP of Infrastructure / SRE driving 99.999% global platform resilience", description: "Leading enterprise DevOps, cloud governance, and site reliability.", targetTrack: "Cloud, DevOps & SRE", weight: 15 },
      { text: "Chief Information Security Officer (CISO) defending against advanced zero-day exploits", description: "Top authority on enterprise defense, threat modeling, and cryptography.", targetTrack: "Cybersecurity & Zero-Trust", weight: 15 },
      { text: "Staff Design Technologist / Frontend Architect defining next-gen web UX", description: "Setting industry benchmarks for fluid, accessible web interactions.", targetTrack: "Modern Frontend & Web Architecture", weight: 15 },
      { text: "Chief Product Officer (CPO) driving high-velocity product innovation & market scale", description: "Guiding multi-million-dollar product bets and user growth.", targetTrack: "Product Management & Strategy", weight: 15 }
    ]
  }
];

export default function CareerCounsellingQuizPage() {
  const [questions, setQuestions] = useState<CounsellingQuestion[]>(DEFAULT_COUNSELLING_QUESTIONS);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [result, setResult] = useState<EvaluationResponse | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    // Check for cached evaluation in localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("counselling_latest_evaluation");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.primaryTrack) {
            setResult(parsed);
          }
        } catch {}
      }
    }
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/quiz/counselling/questions`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setQuestions(data);
        } else {
          setQuestions(DEFAULT_COUNSELLING_QUESTIONS);
        }
      } else {
        setQuestions(DEFAULT_COUNSELLING_QUESTIONS);
      }
    } catch (err) {
      console.warn("Failed to fetch counselling questions, using verified defaults:", err);
      setQuestions(DEFAULT_COUNSELLING_QUESTIONS);
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
        if (typeof window !== "undefined") {
          localStorage.setItem("counselling_latest_evaluation", JSON.stringify(data));
        }
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
    if (typeof window !== "undefined") {
      localStorage.removeItem("counselling_latest_evaluation");
    }
  };

  if (loading && questions.length === 0) {
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
                href={`/sprint/${result.recommendedSprintSlug || "distributed-database"}?track=${result.recommendedCandidateTrack || "Backend"}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-95 transition-opacity shrink-0"
              >
                <span>Launch Practical Kata ({result.recommendedCandidateTrack || "Backend"})</span>
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
  const q = questions[currentStep] || questions[0] || DEFAULT_COUNSELLING_QUESTIONS[0];
  const progressPercent = questions.length > 0 ? Math.round(((currentStep + 1) / questions.length) * 100) : 0;
  const isAnswered = q ? selectedAnswers[q.id] !== undefined : false;

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
