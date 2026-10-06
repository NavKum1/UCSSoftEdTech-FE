"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  BarChart3,
  BookOpen,
  Filter,
  Check,
  ChevronRight,
  Code2,
  BrainCircuit,
  GraduationCap,
  Wand2,
  Upload,
  Plus,
  X,
  FileCode,
} from "lucide-react";
import Link from "next/link";

interface ExamCatalogItem {
  id: string;
  title: string;
  stream: string;
  description: string;
  durationMinutes: number;
  difficulty: string;
  totalQuestions: number;
  passingPercentage: number;
}

interface ExamQuestion {
  id: number;
  questionText: string;
  codeSnippet?: string;
  options: string[];
  topic: string;
}

interface ActiveExamDetail {
  id: string;
  title: string;
  stream: string;
  description: string;
  durationMinutes: number;
  difficulty: string;
  passingPercentage: number;
  questions: ExamQuestion[];
}

interface QuestionResult {
  questionId: number;
  questionText: string;
  selectedOptionIndex: number;
  correctOptionIndex: number;
  selectedOptionText?: string;
  correctOptionText?: string;
  isCorrect: boolean;
  explanation: string;
  topic: string;
}

interface ExamEvaluationResult {
  examId: string;
  examTitle: string;
  totalQuestions: number;
  correctAnswers: number;
  percentage: number;
  passingPercentage: number;
  passed: boolean;
  percentileRank: number;
  submittedAt: string;
  questionResults: QuestionResult[];
}

export default function WrittenExamPrepPage() {
  const [catalog, setCatalog] = useState<ExamCatalogItem[]>([]);
  const [selectedStream, setSelectedStream] = useState<string>("All");
  const [loading, setLoading] = useState<boolean>(true);

  // Active exam state
  const [activeExam, setActiveExam] = useState<ActiveExamDetail | null>(null);
  const [examLoading, setExamLoading] = useState<boolean>(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<ExamEvaluationResult | null>(null);

  // Modals state
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  // AI Exam Form state
  const [aiTopic, setAiTopic] = useState<string>("Kubernetes Ingress & Helm");
  const [aiStream, setAiStream] = useState<string>("Software Engineering");
  const [aiDifficulty, setAiDifficulty] = useState<string>("Intermediate");
  const [aiCount, setAiCount] = useState<number>(5);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

  // Upload Form state
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadStream, setUploadStream] = useState<string>("Software Engineering");
  const [uploadDesc, setUploadDesc] = useState<string>("");
  const [uploadDuration, setUploadDuration] = useState<number>(20);
  const [uploadJson, setUploadJson] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/quiz/exams`);
      if (res.ok) {
        const data = await res.json();
        setCatalog(data);
      }
    } catch (err) {
      console.error("Failed to load exams catalog:", err);
    } finally {
      setLoading(false);
    }
  };

  const startExam = async (examId: string) => {
    setExamLoading(true);
    setEvaluation(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    try {
      const res = await fetch(`${apiBase}/api/quiz/exams/${examId}`);
      if (res.ok) {
        const data: ActiveExamDetail = await res.json();
        setActiveExam(data);
        setTimeLeftSeconds(data.durationMinutes * 60);
      }
    } catch (err) {
      console.error("Failed to load exam details:", err);
    } finally {
      setExamLoading(false);
    }
  };

  // Countdown timer
  useEffect(() => {
    if (!activeExam || evaluation || timeLeftSeconds <= 0) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeExam, evaluation, timeLeftSeconds]);

  const handleSelectOption = (questionId: number, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const handleSubmitExam = async () => {
    if (!activeExam || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/api/quiz/exams/${activeExam.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (res.ok) {
        const resultData: ExamEvaluationResult = await res.json();
        setEvaluation(resultData);
      }
    } catch (err) {
      console.error("Failed to evaluate exam:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSynthesizeExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSynthesizing(true);
    try {
      const res = await fetch(`${apiBase}/api/quiz/exams/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic,
          stream: aiStream,
          difficulty: aiDifficulty,
          questionCount: aiCount,
        }),
      });

      if (res.ok) {
        const newExam = await res.json();
        setShowAiModal(false);
        await fetchCatalog();
        startExam(newExam.id);
      }
    } catch (err) {
      console.error("AI Exam generation failed:", err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleUploadExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setIsUploading(true);
    try {
      let parsedQuestions = [];
      try {
        parsedQuestions = JSON.parse(uploadJson);
        if (!Array.isArray(parsedQuestions)) {
          throw new Error("JSON must be an array of question objects.");
        }
      } catch (parseErr: any) {
        setUploadError("Invalid JSON: " + parseErr.message);
        setIsUploading(false);
        return;
      }

      const res = await fetch(`${apiBase}/api/quiz/exams/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: uploadTitle || "Custom Exam Paper",
          stream: uploadStream,
          description: uploadDesc,
          durationMinutes: uploadDuration,
          difficulty: "Custom",
          passingPercentage: 70,
          questions: parsedQuestions,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowUploadModal(false);
        await fetchCatalog();
        startExam(data.id);
      } else {
        const err = await res.json();
        setUploadError(err.error || "Failed to upload question bank.");
      }
    } catch (err: any) {
      setUploadError("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const loadSampleJson = () => {
    setUploadTitle("Distributed Concurrency Midterm");
    setUploadStream("Software Engineering");
    setUploadDesc("Department exam covering goroutines, mutexes, and atomics.");
    setUploadJson(
      JSON.stringify(
        [
          {
            questionText: "What is the primary difference between a sync.Mutex and a sync.RWMutex in Go?",
            options: [
              "sync.RWMutex allows concurrent readers while sync.Mutex is mutually exclusive for all",
              "sync.Mutex allows concurrent writers",
              "sync.RWMutex operates entirely without memory barriers",
              "sync.Mutex can only be locked within the main goroutine"
            ],
            correctOptionIndex: 0,
            explanation: "sync.RWMutex permits multiple read locks concurrently provided no write lock is held, which dramatically improves read throughput.",
            topic: "Concurrency"
          },
          {
            questionText: "Which primitive should be used to coordinate multiple concurrent goroutines and wait for all to complete?",
            options: [
              "sync.WaitGroup",
              "time.Sleep(5 * time.Second)",
              "runtime.Gosched()",
              "select {} loop"
            ],
            correctOptionIndex: 0,
            explanation: "sync.WaitGroup provides Add, Done, and Wait methods to coordinate completion of goroutines deterministically.",
            topic: "Concurrency"
          }
        ],
        null,
        2
      )
    );
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const streams = ["All", ...Array.from(new Set(catalog.map((e) => e.stream)))];
  const filteredCatalog =
    selectedStream === "All"
      ? catalog
      : catalog.filter((e) => e.stream === selectedStream);

  // ----------------------------------------------------
  // VIEW 1: EVALUATION REPORT VIEW
  // ----------------------------------------------------
  if (evaluation) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Card */}
          <div className="p-6 md:p-8 rounded-2xl border border-border bg-card shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  <Award className="w-3.5 h-3.5" />
                  <span>Exam Evaluation Complete</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {evaluation.examTitle}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Submitted at {new Date(evaluation.submittedAt).toLocaleTimeString()}
                </p>
              </div>

              <div
                className={`px-5 py-3 rounded-2xl border flex items-center gap-3 shrink-0 ${
                  evaluation.passed
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-500"
                }`}
              >
                {evaluation.passed ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : (
                  <XCircle className="w-8 h-8" />
                )}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider">
                    {evaluation.passed ? "PASSED (Certified)" : "NEEDS PRACTICE"}
                  </div>
                  <div className="text-2xl font-black">{evaluation.percentage}%</div>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                  Correct
                </span>
                <p className="text-xl font-bold text-foreground mt-0.5">
                  {evaluation.correctAnswers} / {evaluation.totalQuestions}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                  Passing Bar
                </span>
                <p className="text-xl font-bold text-foreground mt-0.5">
                  {evaluation.passingPercentage}%
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                  Est. Percentile
                </span>
                <p className="text-xl font-bold text-primary mt-0.5">
                  Top {100 - evaluation.percentileRank}%
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                  Skill Verified
                </span>
                <p className="text-xl font-bold text-foreground mt-0.5">
                  {evaluation.passed ? "Yes" : "In Progress"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => startExam(evaluation.examId)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-95 transition-opacity"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retake Exam
              </button>
              <button
                onClick={() => {
                  setActiveExam(null);
                  setEvaluation(null);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card/60 text-foreground font-semibold text-xs hover:bg-card transition-colors"
              >
                Back to Exam Catalog
              </button>
              <Link
                href="/prep/counselling"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border/80 text-muted-foreground hover:text-foreground text-xs font-semibold ml-auto"
              >
                <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                Take Career Diagnostic Quiz
              </Link>
            </div>
          </div>

          {/* Deep Question Explanations */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Detailed Technical Explanations & Rationale
            </h2>

            <div className="space-y-4">
              {evaluation.questionResults.map((qr, index) => {
                const isCorrect = qr.isCorrect ?? (qr as any).IsCorrect ?? false;
                const topic = qr.topic ?? (qr as any).Topic ?? "Core Concept";
                const qText = qr.questionText ?? (qr as any).QuestionText ?? `Question ${index + 1}`;
                const explanation = qr.explanation ?? (qr as any).Explanation ?? "";
                const selectedText = qr.selectedOptionText ?? (qr as any).SelectedOptionText;
                const correctText = qr.correctOptionText ?? (qr as any).CorrectOptionText;
                const qId = qr.questionId ?? (qr as any).QuestionId ?? index;

                return (
                  <div
                    key={qId}
                    className={`p-5 rounded-2xl border transition-all ${
                      isCorrect
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-rose-500/20 bg-rose-500/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
                          {index + 1}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-muted text-[10px] font-semibold text-muted-foreground uppercase">
                          {topic}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold inline-flex items-center gap-1 ${
                          isCorrect ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        {isCorrect ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" /> Correct
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" /> Incorrect
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-foreground mb-3 leading-relaxed">
                      {qText}
                    </p>

                    {/* Selected & Correct Options Display */}
                    {(selectedText || correctText) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-xs">
                        <div
                          className={`p-2.5 rounded-xl border ${
                            isCorrect
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          <span className="font-bold block text-[10px] uppercase tracking-wider opacity-80">
                            Your Selected Answer:
                          </span>
                          <span className="font-medium mt-0.5 block">{selectedText || "None"}</span>
                        </div>

                        {!isCorrect && correctText && (
                          <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            <span className="font-bold block text-[10px] uppercase tracking-wider opacity-80">
                              Correct Answer:
                            </span>
                            <span className="font-medium mt-0.5 block">{correctText}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-3.5 rounded-xl bg-background/80 border border-border/60 text-xs space-y-1.5">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>Concept Explanation &amp; Rationale:</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {explanation}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW 2: ACTIVE EXAM IN PROGRESS
  // ----------------------------------------------------
  if (activeExam) {
    const currentQ = activeExam.questions[currentQuestionIndex];
    const answeredCount = Object.keys(answers).length;
    const progressPercent = Math.round(
      (answeredCount / activeExam.questions.length) * 100
    );

    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
        {/* Top Sticky Test Bar */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground line-clamp-1">
              {activeExam.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{activeExam.stream}</span>
              <span>•</span>
              <span>Question {currentQuestionIndex + 1} of {activeExam.questions.length}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Countdown Badge */}
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold ${
                timeLeftSeconds < 180
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse"
                  : "bg-muted/50 border-border text-foreground"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(timeLeftSeconds)}</span>
            </div>

            <button
              onClick={handleSubmitExam}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Grading..." : "Submit Exam"}
            </button>
          </div>
        </header>

        {/* Progress Bar */}
        <div className="w-full bg-muted h-1">
          <div
            className="bg-primary h-1 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Question Body */}
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 space-y-6">
          <div className="p-6 md:p-8 rounded-2xl border border-border bg-card shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-primary/10 text-primary uppercase">
                {currentQ.topic}
              </span>
              <span className="text-xs text-muted-foreground">
                Answered {answeredCount} of {activeExam.questions.length}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-semibold text-foreground leading-relaxed">
              {currentQ.questionText}
            </h3>

            {/* Optional Code Snippet */}
            {currentQ.codeSnippet && (
              <pre className="p-4 rounded-xl bg-neutral-950 text-neutral-100 font-mono text-xs overflow-x-auto border border-neutral-800">
                <code>{currentQ.codeSnippet}</code>
              </pre>
            )}

            {/* Options */}
            <div className="space-y-3 pt-2">
              {currentQ.options.map((option, idx) => {
                const isSelected = answers[currentQ.id] === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(currentQ.id, idx)}
                    className={`w-full text-left p-4 rounded-xl border text-sm transition-all flex items-center justify-between ${
                      isSelected
                        ? "border-primary bg-primary/5 text-foreground font-medium ring-1 ring-primary shadow-sm"
                        : "border-border/80 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    <span>{option}</span>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-3 ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Nav buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              >
                Previous Question
              </button>

              <div className="flex items-center gap-1.5">
                {activeExam.questions.map((q, idx) => {
                  const isAns = answers[q.id] !== undefined;
                  const isCur = idx === currentQuestionIndex;
                  return (
                    <button
                      key={`${q.id}-${idx}`}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                        isCur
                          ? "bg-primary text-primary-foreground font-bold shadow"
                          : isAns
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {currentQuestionIndex < activeExam.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCurrentQuestionIndex((prev) =>
                      Math.min(activeExam.questions.length - 1, prev + 1)
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-95 transition-opacity"
                >
                  Next Question
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitExam}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                >
                  Submit Final Exam
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW 3: EXAM CATALOG & PRACTICE DASHBOARD
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Campus & Placement Written Exam Practice</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Written Exams & Concept Practice Sets
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Take timed diagnostic written exams covering systems engineering, quantitative aptitude, algorithmic reasoning, and domain strategy with automated grading.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/prep/counselling"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card/60 hover:bg-card text-foreground text-xs font-semibold transition-colors"
            >
              <BrainCircuit className="w-4 h-4 text-primary" />
              Career Counselling Diagnostic
            </Link>
            <Link
              href="/interview/practice"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-95 transition-opacity"
            >
              <Sparkles className="w-4 h-4" />
              Multi-Stream Voice AI Interview
            </Link>
          </div>
        </div>

        {/* Action Controls & Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {streams.map((stream) => (
              <button
                key={stream}
                onClick={() => setSelectedStream(stream)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedStream === stream
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border/80 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card"
                }`}
              >
                {stream}
              </button>
            ))}
          </div>

          {/* Creation & Import Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold hover:opacity-95 shadow-sm transition-all"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Synthesize AI Exam</span>
            </button>

            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-card/80 text-foreground text-xs font-semibold hover:bg-card transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-primary" />
              <span>Import Question Bank</span>
            </button>
          </div>
        </div>

        {/* Exam Cards Grid */}
        {loading || examLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 rounded-2xl border border-border/60 bg-muted/20 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCatalog.map((exam, i) => (
              <div
                key={`${exam.id}-${i}`}
                className="group relative flex flex-col justify-between p-6 rounded-2xl border border-border/80 bg-card/60 hover:bg-card hover:border-primary/40 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                      {exam.stream}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {exam.difficulty}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {exam.title}
                  </h3>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {exam.description}
                  </p>
                </div>

                <div className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>{exam.durationMinutes} mins</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span>{exam.totalQuestions} Questions</span>
                    </div>
                  </div>

                  <button
                    onClick={() => startExam(exam.id)}
                    className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 group-hover:opacity-95 transition-opacity"
                  >
                    <span>Start Practice Exam</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. SYNTHESIZE AI EXAM MODAL                          */}
      {/* ---------------------------------------------------- */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Synthesize Custom AI Exam
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Generate on-demand multiple choice questions with explanations
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSynthesizeExam} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Exam Topic / Domain Focus
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. Kubernetes Ingress & Helm, Zero-Trust AppSec"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    "PostgreSQL Index Optimization",
                    "Kubernetes Ingress & Helm",
                    "Zero-Trust AppSec",
                    "Discrete Probability & Logic",
                    "Product Metrics & A/B Testing"
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAiTopic(preset)}
                      className="px-2 py-0.5 rounded-md border border-border/70 bg-muted/40 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Stream / Category
                  </label>
                  <select
                    value={aiStream}
                    onChange={(e) => setAiStream(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground cursor-pointer"
                  >
                    <option value="Software Engineering">Software Engineering</option>
                    <option value="Cloud and DevOps">Cloud and DevOps</option>
                    <option value="Aptitude & Logic">Aptitude &amp; Logic</option>
                    <option value="Product Management">Product Management</option>
                    <option value="Cybersecurity">Cybersecurity</option>
                    <option value="Finance & Banking">Finance &amp; Banking</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Difficulty Level
                  </label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground cursor-pointer"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Number of Questions
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setAiCount(num)}
                      className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                        aiCount === num
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      {num} Questions
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSynthesizing || !aiTopic.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold hover:opacity-95 disabled:opacity-50 flex items-center gap-2"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>{isSynthesizing ? "Synthesizing AI Exam..." : "Generate & Launch"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. UPLOAD QUESTION BANK MODAL                        */}
      {/* ---------------------------------------------------- */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Import Custom Question Bank
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Upload your institution or recruiter questions via JSON schema
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadExam} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Exam Title
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Distributed Concurrency Midterm"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Stream / Category
                  </label>
                  <input
                    type="text"
                    value={uploadStream}
                    onChange={(e) => setUploadStream(e.target.value)}
                    placeholder="e.g. Software Engineering"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    value={uploadDuration}
                    onChange={(e) => setUploadDuration(parseInt(e.target.value, 10) || 20)}
                    min={5}
                    max={120}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={loadSampleJson}
                    className="w-full py-2 px-3 rounded-xl border border-border bg-muted/30 text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FileCode className="w-3.5 h-3.5 text-primary" />
                    <span>Load Sample JSON</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Questions JSON Payload</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    Array of objects with questionText, options, correctOptionIndex, explanation
                  </span>
                </label>
                <textarea
                  rows={8}
                  value={uploadJson}
                  onChange={(e) => setUploadJson(e.target.value)}
                  placeholder={`[\n  {\n    "questionText": "Question description",\n    "options": ["Option A", "Option B", "Option C", "Option D"],\n    "correctOptionIndex": 0,\n    "explanation": "Rationale...",\n    "topic": "Topic"\n  }\n]`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-mono text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadTitle.trim() || !uploadJson.trim()}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-95 disabled:opacity-50 flex items-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploading ? "Validating & Publishing..." : "Publish Question Bank"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
