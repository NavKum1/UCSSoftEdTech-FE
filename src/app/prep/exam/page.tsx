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
  BookOpen,
  Check,
  BrainCircuit,
  GraduationCap,
  Wand2,
  Upload,
  X,
  FileCode,
  History,
  TrendingUp,
  Copy,
  ExternalLink,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";

function LinkedInIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8m1.39 9.74v-8.37H5.07v8.37h2.78z"/>
    </svg>
  );
}

interface ExamCatalogItem {
  id: string;
  title: string;
  stream: string;
  description: string;
  durationMinutes: number;
  difficulty: string;
  totalQuestions: number;
  passingPercentage: number;
  /** Credential exams hide the answer key and have an attempt limit and a cooldown; practice exams issue no credential. */
  issuesCredential?: boolean;
  revealAnswerKey?: boolean;
  /** 0 = unlimited */
  maxAttempts?: number;
  attemptsUsed?: number;
  /** null when unlimited */
  attemptsRemaining?: number | null;
  /** Set while the cooldown after the last attempt runs */
  nextAttemptAt?: string | null;
  hasOpenAttempt?: boolean;
}

interface ExamAttempt {
  attemptId: string;
  userId: string;
  examId: string;
  examTitle: string;
  stream: string;
  percentage: number;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
  percentileRank: number;
  durationMinutes: number;
  certificateNumber?: string;
  verificationSignatureSha256?: string;
  verificationUrl?: string;
  submittedAt: string;
  /** Submitted or Expired (time ran out before the submission) */
  status?: string;
  /** The server says whether this attempt may still be certified (passing, graded here, credential exam, not claimed). */
  canClaimCredential?: boolean;
}

interface ExamQuestion {
  id: number;
  questionText: string;
  codeSnippet?: string;
  options: string[];
  topic: string;
}

/** A started attempt (POST /api/quiz/exams/{id}/start): its own question order and option order, never the answer key. */
interface ActiveExamDetail {
  attemptId: string;
  attemptNumber?: number;
  resumed?: boolean;
  expiresAt?: string;
  secondsLeft?: number;
  id: string;
  title: string;
  stream: string;
  description: string;
  durationMinutes: number;
  difficulty: string;
  passingPercentage: number;
  issuesCredential?: boolean;
  revealAnswerKey?: boolean;
  maxAttempts?: number;
  attemptsRemaining?: number | null;
  questions: ExamQuestion[];
}

/** Why the server refused to start or grade an attempt (attempt limit, cooldown, time ran out). */
interface AttemptNotice {
  message: string;
  nextAttemptAt?: string | null;
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

/** Older API builds sent question results in PascalCase; the explanations list accepts either. */
interface PascalCaseQuestionResult {
  QuestionId?: number;
  QuestionText?: string;
  SelectedOptionText?: string;
  CorrectOptionText?: string;
  IsCorrect?: boolean;
  Explanation?: string;
  Topic?: string;
}

/** The credential returned when a passed exam is claimed (fields the credential modal shows). */
interface ClaimedExamCredential {
  badgeTitle?: string;
  candidateName?: string;
  percentage: number;
  certificateNumber: string;
  issuedAt: string;
  verificationSignatureSha256: string;
  publicUrlSlug: string;
}

interface ExamEvaluationResult {
  /** The stored attempt the server graded; a credential is claimed for it (the server recomputes the score). */
  attemptId: string;
  examId: string;
  examTitle: string;
  totalQuestions: number;
  correctAnswers: number;
  percentage: number;
  passingPercentage: number;
  passed: boolean;
  percentileRank: number;
  submittedAt: string;
  /** Credential exams return no correct answers or explanations: questionResults is then empty. */
  answerKeyHidden?: boolean;
  issuesCredential?: boolean;
  canClaimCredential?: boolean;
  maxAttempts?: number;
  attemptsRemaining?: number | null;
  nextAttemptAt?: string | null;
  questionResults: QuestionResult[];
}

/** Attempts left and the cooldown, in words, for the catalogue card and the result screen. */
function attemptsText(maxAttempts?: number, attemptsRemaining?: number | null): string | null {
  if (!maxAttempts || attemptsRemaining === null || attemptsRemaining === undefined) return null;
  if (attemptsRemaining === 0) return `No attempts left (${maxAttempts} used)`;
  return `${attemptsRemaining} of ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"} left`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** True while the cooldown after the last attempt still runs. */
function inCooldown(nextAttemptAt?: string | null): boolean {
  return !!nextAttemptAt && new Date(nextAttemptAt).getTime() > Date.now();
}

export default function WrittenExamPrepPage() {
  const { apiFetch, ready, access } = useLegacyApi();
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
  // Attempt limit / cooldown / expired attempt message from the server (shown on the catalogue and the result screen)
  const [attemptNotice, setAttemptNotice] = useState<AttemptNotice | null>(null);

  // Tab & History state
  const [activeTab, setActiveTab] = useState<"catalog" | "history">("catalog");
  const [examHistory, setExamHistory] = useState<ExamAttempt[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyStats, setHistoryStats] = useState<{
    totalAttempts: number;
    passedCount: number;
    passRatePercentage: number;
    averageScore: number;
    highestScore: number;
  }>({ totalAttempts: 0, passedCount: 0, passRatePercentage: 0, averageScore: 0, highestScore: 0 });

  // Credential Modal State
  const [claimedCredential, setClaimedCredential] = useState<ClaimedExamCredential | null>(null);
  // The attempt the credential above was issued for, and why the last claim was refused (shown under the claim button)
  const [claimedAttemptId, setClaimedAttemptId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [showCredentialModal, setShowCredentialModal] = useState<boolean>(false);
  const [claiming, setClaiming] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedSignature, setCopiedSignature] = useState<boolean>(false);
  const [candidateName, setCandidateName] = useState<string>("Alex Chen");

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


  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/quiz/exams`);
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

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await apiFetch(`/api/quiz/exams/history`);
      if (res.ok) {
        const data = await res.json();
        setExamHistory(data.attempts || []);
        setHistoryStats({
          totalAttempts: data.totalAttempts || 0,
          passedCount: data.passedCount || 0,
          passRatePercentage: data.passRatePercentage || 0,
          averageScore: data.averageScore || 0,
          highestScore: data.highestScore || 0,
        });
      }
    } catch (err) {
      console.error("Failed to load exam history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchCatalogRef = useLatestRef(fetchCatalog);
  const fetchHistoryRef = useLatestRef(fetchHistory);
  useEffect(() => {
    if (!ready) return;
    fetchCatalogRef.current();
    fetchHistoryRef.current();
  }, [ready, fetchCatalogRef, fetchHistoryRef]);

  // The server starts the attempt (or resumes the open one): it checks the attempt limit and the cooldown and sends this
  // attempt's own question and option order. Draft answers are kept per attempt, because the order differs per attempt.
  const startExam = async (examId: string) => {
    setExamLoading(true);
    setEvaluation(null);
    setAttemptNotice(null);
    setCurrentQuestionIndex(0);
    try {
      const res = await apiFetch(`/api/quiz/exams/${examId}/start`, { method: "POST" });
      if (res.ok) {
        const data: ActiveExamDetail = await res.json();
        setActiveExam(data);

        // Restore draft answers of this attempt if available
        if (typeof window !== "undefined") {
          const saved = localStorage.getItem(`exam_draft_answers_${data.attemptId}`);
          if (saved) {
            try {
              setAnswers(JSON.parse(saved));
            } catch {
              setAnswers({});
            }
          } else {
            setAnswers({});
          }
        } else {
          setAnswers({});
        }

        // at least 1 s, so a resumed attempt whose time is up is submitted by the countdown at once
        setTimeLeftSeconds(Math.max(1, data.secondsLeft ?? data.durationMinutes * 60));
      } else {
        const err = await res.json().catch(() => null);
        setActiveExam(null);
        setAttemptNotice({
          message: err?.error || "This exam could not be started. Try again later.",
          nextAttemptAt: err?.nextAttemptAt ?? null,
        });
        fetchCatalog();
      }
    } catch (err) {
      console.error("Failed to start the exam:", err);
      setAttemptNotice({ message: "This exam could not be started. Check your connection and try again." });
    } finally {
      setExamLoading(false);
    }
  };

  const handleSelectOption = (questionId: number, optionIndex: number) => {
    setAnswers((prev) => {
      const next = {
        ...prev,
        [questionId]: optionIndex,
      };
      if (typeof window !== "undefined" && activeExam) {
        localStorage.setItem(`exam_draft_answers_${activeExam.attemptId}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleSubmitExam = async () => {
    if (!activeExam || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/quiz/exams/${activeExam.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: activeExam.attemptId, answers, candidateName }),
      });

      if (res.ok) {
        const resultData: ExamEvaluationResult = await res.json();
        setEvaluation(resultData);
        if (typeof window !== "undefined") {
          localStorage.removeItem(`exam_draft_answers_${activeExam.attemptId}`);
        }
        fetchHistory();
        fetchCatalog();
      } else {
        // e.g. the time for this attempt ran out (it still counts as an attempt)
        const err = await res.json().catch(() => null);
        if (typeof window !== "undefined") {
          localStorage.removeItem(`exam_draft_answers_${activeExam.attemptId}`);
        }
        setActiveExam(null);
        setAttemptNotice({
          message: err?.error || "Your answers could not be graded. Try again later.",
          nextAttemptAt: err?.nextAttemptAt ?? null,
        });
        fetchHistory();
        fetchCatalog();
      }
    } catch (err) {
      console.error("Failed to evaluate exam:", err);
    } finally {
      setSubmitting(false);
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

  // The server issues the credential for the stored, server-graded attempt; no score is sent from here.
  const handleClaimCredential = async (examId: string, attemptId: string) => {
    if (claimedCredential && claimedAttemptId === attemptId) {
      setShowCredentialModal(true);
      return;
    }
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await apiFetch(`/api/quiz/exams/${examId}/claim-credential`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          candidateName: candidateName || "Alex Chen",
        }),
      });

      if (res.ok) {
        const cred = await res.json();
        setClaimedCredential(cred);
        setClaimedAttemptId(attemptId);
        setShowCredentialModal(true);
        fetchHistory();
      } else {
        const err = await res.json().catch(() => null);
        setClaimError(err?.error || "The credential could not be issued for this attempt.");
        fetchHistory();
      }
    } catch (err) {
      console.error("Failed to claim verified credential:", err);
      setClaimError("The credential could not be issued. Try again.");
    } finally {
      setClaiming(false);
    }
  };

  // Attempt limit / cooldown / expired attempt banner
  const noticeBanner = attemptNotice && (
    <div role="status" className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-foreground flex items-start gap-2.5">
      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="font-semibold">{attemptNotice.message}</p>
        {attemptNotice.nextAttemptAt && (
          <p className="text-muted-foreground">Next attempt available from {formatDateTime(attemptNotice.nextAttemptAt)}.</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setAttemptNotice(null)}
        aria-label="Dismiss message"
        className="ml-auto rounded-lg p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  const handleSynthesizeExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSynthesizing(true);
    try {
      const res = await apiFetch(`/api/quiz/exams/generate`, {
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
      } catch (parseErr) {
        setUploadError("Invalid JSON: " + (parseErr as Error).message);
        setIsUploading(false);
        return;
      }

      const res = await apiFetch(`/api/quiz/exams/upload`, {
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
    } catch (err) {
      setUploadError("Upload failed: " + (err as Error).message);
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
  if (access) return <AccessNotice problem={access} feature="Written exam prep" />;

  if (evaluation) {
    const isCredentialExam = evaluation.issuesCredential ?? true;
    const retakeBlocked = evaluation.attemptsRemaining === 0 || inCooldown(evaluation.nextAttemptAt);
    const evaluationAttempts = attemptsText(evaluation.maxAttempts, evaluation.attemptsRemaining);
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
                    {evaluation.passed ? (isCredentialExam ? "PASSED (Certified)" : "PASSED") : "NEEDS PRACTICE"}
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
                  {!isCredentialExam ? "Practice" : evaluation.passed ? "Yes" : "In Progress"}
                </p>
              </div>
            </div>

            {/* Verified Credential & Skill Passport Issuance Banner */}
            {evaluation.passed && !isCredentialExam ? (
              <div role="status" className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
                <span>You passed this practice exam. Practice exams don&apos;t issue a credential.</span>
              </div>
            ) : evaluation.passed ? (
              <div className="p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-primary/5 to-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                        Official Certification Earned
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                        {evaluation.percentage}% Passed
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground mt-0.5">
                      Cryptographic Verified Credential &amp; Skill Passport Badge
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Mint your SHA-256 tamper-evident certificate, sync to your active Gold Skill Passport, and share directly on LinkedIn.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleClaimCredential(evaluation.examId, evaluation.attemptId)}
                    disabled={claiming}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Award className="w-4 h-4" />
                    <span>{claiming ? "Minting Certificate..." : claimedCredential && claimedAttemptId === evaluation.attemptId ? "View Claimed Credential" : "Claim Verified Credential"}</span>
                  </button>
                  {claimError && <span role="alert" className="text-xs text-red-500">{claimError}</span>}
                  <Link
                    href="/passport"
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card/60 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>View Passport</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-border bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
                <span>
                  Passing score is {evaluation.passingPercentage}%.{" "}
                  {!isCredentialExam
                    ? "Retake the practice exam when you are ready."
                    : retakeBlocked
                      ? "You can't retake this exam right now (see below)."
                      : "Retake the exam to unlock your official verified credential badge."}
                </span>
                {!retakeBlocked && (
                  <button
                    onClick={() => startExam(evaluation.examId)}
                    className="font-semibold text-primary hover:underline ml-2"
                  >
                    Retry Now
                  </button>
                )}
              </div>
            )}

            {/* Attempts left and the cooldown */}
            {(evaluationAttempts || inCooldown(evaluation.nextAttemptAt)) && (
              <div role="status" className="p-3 rounded-xl border border-border bg-muted/20 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                <Clock className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                {evaluationAttempts && <span className="font-semibold text-foreground">{evaluationAttempts}</span>}
                {inCooldown(evaluation.nextAttemptAt) && evaluation.attemptsRemaining !== 0 && (
                  <span>Next attempt available from {formatDateTime(evaluation.nextAttemptAt as string)}.</span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => startExam(evaluation.examId)}
                disabled={retakeBlocked}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* Credential exams: no answer key */}
          {evaluation.answerKeyHidden && (
            <div role="note" className="p-5 rounded-2xl border border-border bg-card shadow-sm text-xs text-muted-foreground flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-foreground">Answers are not shown for this exam</h2>
                <p>
                  {isCredentialExam
                    ? "This exam issues a credential, so the correct answers and explanations stay private. You see your score and whether you passed."
                    : "The exam owner has chosen not to show the correct answers for this exam. You see your score and whether you passed."}
                </p>
              </div>
            </div>
          )}

          {/* Deep Question Explanations */}
          {!evaluation.answerKeyHidden && evaluation.questionResults.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Detailed Technical Explanations & Rationale
            </h2>

            <div className="space-y-4">
              {evaluation.questionResults.map((qr, index) => {
                const pascal = qr as QuestionResult & PascalCaseQuestionResult;
                const isCorrect = qr.isCorrect ?? pascal.IsCorrect ?? false;
                const topic = qr.topic ?? pascal.Topic ?? "Core Concept";
                const qText = qr.questionText ?? pascal.QuestionText ?? `Question ${index + 1}`;
                const explanation = qr.explanation ?? pascal.Explanation ?? "";
                const selectedText = qr.selectedOptionText ?? pascal.SelectedOptionText;
                const correctText = qr.correctOptionText ?? pascal.CorrectOptionText;
                const qId = qr.questionId ?? pascal.QuestionId ?? index;

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
          )}
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
        <header className="sticky top-16 z-20 border-b border-border bg-card/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground line-clamp-1">
              {activeExam.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{activeExam.stream}</span>
              <span>•</span>
              <span>Question {currentQuestionIndex + 1} of {activeExam.questions.length}</span>
              {activeExam.attemptNumber && activeExam.maxAttempts ? (
                <>
                  <span>•</span>
                  <span>Attempt {activeExam.attemptNumber} of {activeExam.maxAttempts}</span>
                </>
              ) : null}
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

        {/* Navigation Tabs: Exam Catalog vs My History & Credentials */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-muted/40 border border-border w-fit">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "catalog"
                ? "bg-card text-foreground shadow-sm border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            <span>Available Exams ({catalog.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("history");
              fetchHistory();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "history"
                ? "bg-card text-foreground shadow-sm border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-3.5 h-3.5 text-primary" />
            <span>My Attempt History &amp; Credentials ({examHistory.length})</span>
          </button>
        </div>

        {noticeBanner}

        {activeTab === "catalog" ? (
          <>
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
                {filteredCatalog.map((exam, i) => {
                  const attemptsLine = attemptsText(exam.maxAttempts, exam.attemptsRemaining);
                  const cooling = inCooldown(exam.nextAttemptAt) && !exam.hasOpenAttempt;
                  const exhausted = exam.attemptsRemaining === 0 && !exam.hasOpenAttempt;
                  return (
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

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          exam.issuesCredential
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {exam.issuesCredential ? (
                          <>
                            <Award className="w-3 h-3" aria-hidden="true" />
                            Credential exam: answers not shown
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3 h-3" aria-hidden="true" />
                            {exam.revealAnswerKey === false ? "Practice exam" : "Practice exam: answers shown after you submit"}
                          </>
                        )}
                      </span>
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

                      {(attemptsLine || cooling) && (
                        <div className="text-[11px] text-muted-foreground space-y-0.5">
                          {attemptsLine && <p className="font-semibold text-foreground">{attemptsLine}</p>}
                          {cooling && !exhausted && <p>Next attempt available from {formatDateTime(exam.nextAttemptAt as string)}.</p>}
                        </div>
                      )}

                      <button
                        onClick={() => startExam(exam.id)}
                        disabled={cooling || exhausted}
                        className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 group-hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>
                          {exam.hasOpenAttempt
                            ? "Resume Exam"
                            : exhausted
                              ? "No Attempts Left"
                              : cooling
                                ? "Available Later"
                                : exam.issuesCredential
                                  ? "Start Exam"
                                  : "Start Practice Exam"}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* ==================================================== */
          /* HISTORY & VERIFIED CREDENTIALS VIEW                 */
          /* ==================================================== */
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl border border-border bg-card/60 shadow-sm">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>Total Attempts</span>
                </span>
                <p className="text-2xl font-black text-foreground mt-1">
                  {historyStats.totalAttempts}
                </p>
                <span className="text-[10px] text-muted-foreground">Comprehensive diagnostics</span>
              </div>

              <div className="p-4 rounded-2xl border border-border bg-card/60 shadow-sm">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Pass Rate</span>
                </span>
                <p className="text-2xl font-black text-emerald-500 mt-1">
                  {historyStats.passRatePercentage}%
                </p>
                <span className="text-[10px] text-muted-foreground">{historyStats.passedCount} exams certified</span>
              </div>

              <div className="p-4 rounded-2xl border border-border bg-card/60 shadow-sm">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Average Score</span>
                </span>
                <p className="text-2xl font-black text-indigo-500 mt-1">
                  {historyStats.averageScore}%
                </p>
                <span className="text-[10px] text-muted-foreground">Across all tracks</span>
              </div>

              <div className="p-4 rounded-2xl border border-border bg-card/60 shadow-sm">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>Highest Mastery</span>
                </span>
                <p className="text-2xl font-black text-amber-500 mt-1">
                  {historyStats.highestScore}%
                </p>
                <span className="text-[10px] text-muted-foreground">Top percentile ranking</span>
              </div>
            </div>

            {/* Past Attempts Table / Cards */}
            {historyLoading ? (
              <div className="p-12 text-center text-muted-foreground text-xs">
                Loading exam attempt records...
              </div>
            ) : examHistory.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-border rounded-2xl space-y-3">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
                <h4 className="text-sm font-bold text-foreground">No Exam Attempts Recorded Yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Take any written diagnostic exam from the catalog to record your scorecards, analyze question breakdowns, and claim verifiable credentials.
                </p>
                <button
                  onClick={() => setActiveTab("catalog")}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-95"
                >
                  Browse Exam Catalog
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {examHistory.map((att) => (
                  <div
                    key={att.attemptId}
                    className="p-5 rounded-2xl border border-border/80 bg-card/70 hover:bg-card transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase">
                          {att.stream}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(att.submittedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                        </span>
                        {att.certificateNumber && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{att.certificateNumber}</span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm sm:text-base font-bold text-foreground">
                        {att.examTitle}
                      </h4>

                      {att.status === "Expired" ? (
                        <div className="text-xs text-muted-foreground">
                          Time ran out before this attempt was submitted, so it was not graded. It counts as an attempt.
                        </div>
                      ) : (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Score: <strong className={att.passed ? "text-emerald-500" : "text-rose-500"}>{att.percentage}%</strong></span>
                        <span>•</span>
                        <span>Questions: {att.correctAnswers}/{att.totalQuestions}</span>
                        <span>•</span>
                        <span>Est. Percentile: Top {100 - att.percentileRank}%</span>
                      </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {att.certificateNumber && att.verificationUrl ? (
                        <Link
                          href={att.verificationUrl}
                          className="px-3.5 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>View Credential</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (att.canClaimCredential ?? att.passed) ? (
                        <button
                          onClick={() => handleClaimCredential(att.examId, att.attemptId)}
                          disabled={claiming}
                          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Claim Credential</span>
                        </button>
                      ) : null}

                      <button
                        onClick={() => startExam(att.examId)}
                        className="px-3.5 py-2 rounded-xl border border-border bg-card/60 hover:bg-card text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-primary" />
                        <span>Retake Exam</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

      {/* ---------------------------------------------------- */}
      {/* 3. VERIFIED CREDENTIAL & SKILL PASSPORT MODAL        */}
      {/* ---------------------------------------------------- */}
      {showCredentialModal && claimedCredential && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-amber-500/40 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowCredentialModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Certificate Header Badge */}
            <div className="text-center space-y-2 pt-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500/20 via-amber-400/30 to-amber-500/10 border-2 border-amber-500/50 flex items-center justify-center text-amber-500 shadow-lg">
                <Award className="w-9 h-9" />
              </div>
              <span className="text-[11px] font-bold text-amber-500 uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 inline-block">
                Official Verifiable Credential
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                {claimedCredential.badgeTitle || "Certified Build & Defend Specialist"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Issued by <strong className="text-foreground">Build &amp; Defend Accreditation Board</strong> in partnership with Global Tech Guilds.
              </p>
            </div>

            {/* Certificate Parchment Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-500/5 to-transparent border border-amber-500/30 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">Candidate Name</span>
                  <p className="font-bold text-foreground text-sm mt-0.5">{claimedCredential.candidateName || candidateName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">Verified Score</span>
                  <p className="font-bold text-emerald-500 text-sm mt-0.5">{claimedCredential.percentage}% (Gold Mastery)</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">Certificate Number</span>
                  <p className="font-mono font-bold text-foreground text-xs mt-0.5">{claimedCredential.certificateNumber}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-semibold">Issue Date</span>
                  <p className="font-medium text-foreground text-xs mt-0.5">
                    {new Date(claimedCredential.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>

              {/* SHA-256 Cryptographic Seal */}
              <div className="p-3 rounded-xl bg-background/80 border border-border space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                    <span>Cryptographic SHA-256 Seal</span>
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(claimedCredential.verificationSignatureSha256);
                      setCopiedSignature(true);
                      setTimeout(() => setCopiedSignature(false), 2000);
                    }}
                    className="text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    {copiedSignature ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSignature ? "Copied Seal" : "Copy Hash"}</span>
                  </button>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground break-all leading-tight">
                  {claimedCredential.verificationSignatureSha256}
                </p>
              </div>

              {/* Skill Passport Sync Status */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Synchronized to Dynamic Skill Passport. Anti-decay timer frozen for 30 days.</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2.5 pt-1">
              {/* 1-Click LinkedIn Add to Profile */}
              <a
                href={`https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
                  claimedCredential.badgeTitle || "Certified Specialist"
                )}&organizationName=${encodeURIComponent(
                  "Build & Defend Accreditation Board"
                )}&issueYear=${new Date(claimedCredential.issuedAt).getFullYear()}&issueMonth=${
                  new Date(claimedCredential.issuedAt).getMonth() + 1
                }&certUrl=${encodeURIComponent(
                  typeof window !== "undefined"
                    ? `${window.location.origin}/credential/${claimedCredential.publicUrlSlug}`
                    : `http://localhost:3000/credential/${claimedCredential.publicUrlSlug}`
                )}&certId=${encodeURIComponent(claimedCredential.certificateNumber)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <LinkedInIcon className="w-4 h-4" />
                <span>1-Click Add Certificate to LinkedIn Profile</span>
              </a>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    const url = typeof window !== "undefined"
                      ? `${window.location.origin}/credential/${claimedCredential.publicUrlSlug}`
                      : `http://localhost:3000/credential/${claimedCredential.publicUrlSlug}`;
                    navigator.clipboard.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="py-2.5 px-3 rounded-xl border border-border bg-card hover:bg-muted/40 text-xs font-semibold text-foreground flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                  <span>{copiedLink ? "Link Copied!" : "Copy Public Link"}</span>
                </button>

                <Link
                  href="/passport"
                  className="py-2.5 px-3 rounded-xl border border-border bg-card hover:bg-muted/40 text-xs font-semibold text-foreground flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>Open Skill Passport</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
