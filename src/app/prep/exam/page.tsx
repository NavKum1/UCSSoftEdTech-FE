"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Check,
  Wand2,
  Upload,
  X,
  FileCode,
  TrendingUp,
  Copy,
  ExternalLink,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import {
  Badge,
  brandFill,
  Button,
  buttonClass,
  EmptyState,
  ErrorBanner,
  Loading,
  Modal,
  PageHeader,
  StatTile,
  SuccessBanner,
  Tabs,
} from "@/components/career/ui";

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
  percentileRank: number | null;
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
  percentileRank: number | null;
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
  return (
    <Suspense fallback={null}>
      <WrittenExamPrep />
    </Suspense>
  );
}

function WrittenExamPrep() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  // Build & Defend Stage 2: an exam taken for a class assessment (the viva follows on the assessment page)
  const search = useSearchParams();
  const classAssignment = /^[0-9a-f-]{36}$/i.test(search.get("assessment") ?? "") ? search.get("assessment") : null;
  const classExam = classAssignment ? search.get("exam") : null;
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

  // Modals state
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  // AI Exam Form state
  const [aiTopic, setAiTopic] = useState<string>("");
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
  const [aiError, setAiError] = useState<string | null>(null);
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
      setAttemptNotice({ message: en("This exam could not be started. Check your connection and try again.") });
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
        body: JSON.stringify({ attemptId: activeExam.attemptId, answers }),
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
    <div role="status" className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2.5">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="font-medium">{attemptNotice.message}</p>
        {attemptNotice.nextAttemptAt && (
          <p className="text-muted-foreground">{en("Next attempt available from {date}.", { date: formatDateTime(attemptNotice.nextAttemptAt) })}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setAttemptNotice(null)}
        aria-label={en("Dismiss message")}
        className="ms-auto rounded-lg p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  const handleSynthesizeExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiError(null);
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
      } else {
        // P6: the server refuses rather than inventing an exam; show why
        const body = await res.json().catch(() => null);
        setAiError(body?.error || en("We couldn't generate this exam just now. Please try again, or upload your own questions."));
      }
    } catch {
      setAiError(en("We couldn't reach Edulexa. Check your internet connection and try again."));
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
          throw new Error("The questions must be a list.");
        }
      } catch (parseErr) {
        void parseErr;
        setUploadError("We couldn't read the questions. Please check the format and try again.");
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
        setUploadError(err.error || "We couldn't upload the questions. Please try again.");
      }
    } catch (err) {
      void err;
      setUploadError("We couldn't upload the questions. Please check your connection and try again.");
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
      <div className="text-foreground">
        <div className="space-y-6">
          {classAssignment && (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">{en("Your exam is in. Go back to your assessment to hand it in and do the viva.")}</p>
              <Link href={`/student/assessments/${classAssignment}`} className={buttonClass("primary")}>
                {en("Back to your assessment")}
              </Link>
            </div>
          )}
          {/* Result summary */}
          <div className="p-5 md:p-6 rounded-xl border border-border bg-card shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{en("Exam results")}</p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {evaluation.examTitle}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {en("Submitted at {date}", { date: new Date(evaluation.submittedAt).toLocaleTimeString() })}
                </p>
              </div>

              <div
                className={`px-5 py-3 rounded-xl border flex items-center gap-3 shrink-0 ${
                  evaluation.passed
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300"
                    : "bg-red-50 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300"
                }`}
              >
                {evaluation.passed ? (
                  <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
                ) : (
                  <XCircle className="w-7 h-7" aria-hidden="true" />
                )}
                <div>
                  <div className="text-sm font-medium">
                    {evaluation.passed ? (isCredentialExam ? en("Passed (certified)") : en("Passed")) : en("Needs practice")}
                  </div>
                  <div className="text-2xl font-semibold tabular-nums">{evaluation.percentage}%</div>
                </div>
              </div>
            </div>

            {/* Figures */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile label={en("Correct")} value={`${evaluation.correctAnswers} / ${evaluation.totalQuestions}`} />
              <StatTile label={en("Passing score")} value={`${evaluation.passingPercentage}%`} />
              <StatTile
                label={en("Percentile")}
                value={
                  evaluation.percentileRank == null ? (
                    <span className="text-sm font-normal text-muted-foreground">{en("Shown once 20 people have taken this exam")}</span>
                  ) : (
                    en("Better than {percentileRank}%", { percentileRank: evaluation.percentileRank })
                  )
                }
              />
              <StatTile
                label={en("Skill verified")}
                value={!isCredentialExam ? en("Practice") : evaluation.passed ? en("Yes") : en("Not yet")}
              />
            </div>

            {/* Credential */}
            {evaluation.passed && !isCredentialExam ? (
              <SuccessBanner message={en("You passed this practice exam. Practice exams don't issue a credential.")} />
            ) : evaluation.passed ? (
              <div className="p-4 sm:p-5 rounded-lg border border-border bg-muted/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Award className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{en("You earned a verified credential")}</h3>
                      <Badge tone="good">{en("{percentage}% passed", { percentage: evaluation.percentage })}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {en("Claim a tamper-evident certificate that anyone can check with its link, add it to your skill passport and share it on LinkedIn.")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button onClick={() => handleClaimCredential(evaluation.examId, evaluation.attemptId)} busy={claiming}>
                    {claiming ? en("Issuing certificate...") : claimedCredential && claimedAttemptId === evaluation.attemptId ? en("View claimed credential") : en("Claim verified credential")}
                  </Button>
                  <Link href="/passport" className={`${buttonClass("secondary")} hidden sm:inline-flex`}>
                    <span>{en("View passport")}</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                  {claimError && <span role="alert" className="w-full text-xs text-red-600 dark:text-red-400">{claimError}</span>}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                <span>
                  {en("Passing score is {passingPercentage}%. {value}", { passingPercentage: evaluation.passingPercentage, value: !isCredentialExam
                    ? en("Retake the practice exam when you are ready.")
                    : retakeBlocked
                      ? en("You can't retake this exam right now (see below).")
                      : en("Retake the exam to earn your verified credential.") })}
                </span>
              </div>
            )}

            {/* Attempts left and the cooldown */}
            {(evaluationAttempts || inCooldown(evaluation.nextAttemptAt)) && (
              <div role="status" className="p-3 rounded-lg border border-border text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                {evaluationAttempts && <span className="font-medium text-foreground">{evaluationAttempts}</span>}
                {inCooldown(evaluation.nextAttemptAt) && evaluation.attemptsRemaining !== 0 && (
                  <span>{en("Next attempt available from {date}.", { date: formatDateTime(evaluation.nextAttemptAt as string) })}</span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button variant={evaluation.passed ? "secondary" : "primary"} onClick={() => startExam(evaluation.examId)} disabled={retakeBlocked}>
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                {en("Retake exam")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setActiveExam(null);
                  setEvaluation(null);
                }}
              >
                {en("Back to exams")}
              </Button>
              <Link href="/prep/counselling" className={`${buttonClass("ghost")} ms-auto`}>
                {en("Take the career quiz")}
              </Link>
            </div>
          </div>

          {/* Credential exams: no answer key */}
          {evaluation.answerKeyHidden && (
            <div role="note" className="p-5 rounded-xl border border-border bg-card shadow-sm text-sm text-muted-foreground flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">{en("Answers are not shown for this exam")}</h2>
                <p>
                  {isCredentialExam
                    ? en("This exam issues a credential, so the correct answers and explanations stay private. You see your score and whether you passed.")
                    : en("The exam owner has chosen not to show the correct answers for this exam. You see your score and whether you passed.")}
                </p>
              </div>
            </div>
          )}

          {/* Question explanations */}
          {!evaluation.answerKeyHidden && evaluation.questionResults.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              {en("Answers and explanations")}
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
                  <div key={qId} className="p-5 rounded-xl border border-border bg-card shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">
                          {index + 1}
                        </span>
                        <Badge>{topic}</Badge>
                      </div>
                      <Badge tone={isCorrect ? "good" : "bad"}>
                        {isCorrect ? en("Correct") : en("Incorrect")}
                      </Badge>
                    </div>

                    <p className="text-sm font-semibold text-foreground mb-3 leading-relaxed">
                      {qText}
                    </p>

                    {/* Selected & correct options */}
                    {(selectedText || correctText) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-sm">
                        <div
                          className={`p-2.5 rounded-lg border ${
                            isCorrect
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                          }`}
                        >
                          <span className="block text-xs opacity-80">
                            {en("Your answer")}
                          </span>
                          <span className="font-medium mt-0.5 block">{selectedText || "None"}</span>
                        </div>

                        {!isCorrect && correctText && (
                          <div className="p-2.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <span className="block text-xs opacity-80">
                              {en("Correct answer")}
                            </span>
                            <span className="font-medium mt-0.5 block">{correctText}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-3.5 rounded-lg bg-muted/40 border border-border text-sm space-y-1">
                      <div className="font-medium text-foreground">{en("Explanation")}</div>
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
      <div className="flex flex-col text-foreground">
        {/* Exam bar */}
        <header className="sticky top-16 z-20 rounded-xl border border-border bg-card px-5 py-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground line-clamp-1">
              {activeExam.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{activeExam.stream}</span>
              <span aria-hidden="true">•</span>
              <span>{en("Question {value} of {length}", { value: currentQuestionIndex + 1, length: activeExam.questions.length })}</span>
              {activeExam.attemptNumber && activeExam.maxAttempts ? (
                <>
                  <span aria-hidden="true">•</span>
                  <span>{en("Attempt {attemptNumber} of {maxAttempts}", { attemptNumber: activeExam.attemptNumber, maxAttempts: activeExam.maxAttempts })}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Countdown */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-mono font-semibold tabular-nums ${
                timeLeftSeconds < 180
                  ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400"
                  : "bg-muted/50 border-border text-foreground"
              }`}
            >
              <Clock className="w-4 h-4" aria-hidden="true" />
              <span>{formatTimer(timeLeftSeconds)}</span>
            </div>

            <Button variant="secondary" onClick={handleSubmitExam} disabled={submitting}>
              {submitting ? en("Grading...") : en("Submit exam")}
            </Button>
          </div>
        </header>

        {/* Progress */}
        <div className="mt-3 w-full bg-muted h-1 rounded-full overflow-hidden">
          <div
            className="h-1 transition-all duration-300"
            style={{ width: `${progressPercent}%`, background: "var(--brand, #0e7490)" }}
          />
        </div>

        {/* Question */}
        <div className="flex-1 w-full pt-6 space-y-6">
          <div className="p-5 md:p-6 rounded-xl border border-border bg-card shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <Badge>{currentQ.topic}</Badge>
              <span className="text-xs text-muted-foreground">
                {en("Answered {answeredCount} of {length}", { answeredCount, length: activeExam.questions.length })}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-semibold text-foreground leading-relaxed">
              {currentQ.questionText}
            </h2>

            {/* Optional code snippet */}
            {currentQ.codeSnippet && (
              <pre className="p-4 rounded-lg bg-neutral-950 text-neutral-100 font-mono text-xs overflow-x-auto border border-neutral-800">
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
                    className={`w-full text-start p-4 rounded-lg border text-sm transition-colors flex items-center justify-between ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50 text-foreground font-medium ring-1 ring-indigo-500 dark:bg-indigo-950/30"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    <span>{option}</span>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ms-3 ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-border"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
              >
                {en("Previous question")}
              </Button>

              <div className="flex flex-wrap items-center gap-1.5">
                {activeExam.questions.map((q, idx) => {
                  const isAns = answers[q.id] !== undefined;
                  const isCur = idx === currentQuestionIndex;
                  return (
                    <button
                      key={`${q.id}-${idx}`}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                        isCur
                          ? "bg-indigo-600 text-white"
                          : isAns
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {currentQuestionIndex < activeExam.questions.length - 1 ? (
                <Button
                  type="button"
                  onClick={() =>
                    setCurrentQuestionIndex((prev) =>
                      Math.min(activeExam.questions.length - 1, prev + 1)
                    )
                  }
                >
                  {en("Next question")}
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmitExam} disabled={submitting}>
                  {en("Submit final exam")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW 3: EXAM CATALOG & PRACTICE DASHBOARD
  // ----------------------------------------------------
  return (
    <div className="text-foreground">
      <div className="space-y-6">
        {classAssignment && classExam && (
          <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">{en("This exam is part of your class assessment. When you finish it, go back to the assessment for the viva.")}</p>
            <Button onClick={() => void startExam(classExam)} busy={examLoading}>
              {en("Start the exam")}
            </Button>
          </div>
        )}
        <PageHeader
          title={en("Written exams")}
          description={en("Timed multiple-choice exams with automatic grading. Pass a credential exam to earn a credential anyone can check.")}
          actions={
            <>
              <Link href="/prep/counselling" className={buttonClass("secondary")}>
                {en("Career quiz")}
              </Link>
              <Link href="/interview/practice" className={buttonClass("secondary")}>
                {en("Interview practice")}
              </Link>
            </>
          }
        />

        {/* Tabs: exams and my attempts */}
        <Tabs
          label={en("Written exams")}
          value={activeTab}
          onChange={(id) => {
            setActiveTab(id);
            if (id === "history") fetchHistory();
          }}
          items={[
            { id: "catalog", label: en("Available exams"), count: catalog.length },
            { id: "history", label: en("My attempts and credentials"), count: examHistory.length },
          ]}
        />

        {noticeBanner}

        {activeTab === "catalog" ? (
          <>
            {/* Filters and actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Stream filter */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label={en("Filter by stream")}>
                {streams.map((stream) => (
                  <button
                    key={stream}
                    onClick={() => setSelectedStream(stream)}
                    aria-pressed={selectedStream === stream}
                    className={`px-3 py-1.5 rounded-full border text-sm whitespace-nowrap transition-colors ${
                      selectedStream === stream
                        ? "border-indigo-500 bg-indigo-50 text-indigo-800 font-medium dark:bg-indigo-950/40 dark:text-indigo-200"
                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {en(stream)}
                  </button>
                ))}
              </div>

              {/* Create and import */}
              <div className="flex items-center gap-2 shrink-0">
                <Button type="button" onClick={() => setShowAiModal(true)}>
                  <Wand2 className="w-4 h-4" aria-hidden="true" />
                  <span>{en("Generate an exam with AI")}</span>
                </Button>

                <Button type="button" variant="secondary" onClick={() => setShowUploadModal(true)}>
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span>{en("Import questions")}</span>
                </Button>
              </div>
            </div>

            {/* Exam cards */}
            {loading || examLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-64 rounded-xl border border-border bg-muted/40 animate-pulse motion-reduce:animate-none"
                  />
                ))}
              </div>
            ) : filteredCatalog.length === 0 ? (
              <EmptyState title={en("No exams yet")}>
                {en("Generate an exam with AI or import your own questions to get started.")}
              </EmptyState>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCatalog.map((exam, i) => {
                  const attemptsLine = attemptsText(exam.maxAttempts, exam.attemptsRemaining);
                  const cooling = inCooldown(exam.nextAttemptAt) && !exam.hasOpenAttempt;
                  const exhausted = exam.attemptsRemaining === 0 && !exam.hasOpenAttempt;
                  return (
                  <div
                    key={`${exam.id}-${i}`}
                    className="flex flex-col justify-between p-5 rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge>{exam.stream}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {exam.difficulty}
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-foreground">
                        {exam.title}
                      </h3>

                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {exam.description}
                      </p>

                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {exam.issuesCredential ? (
                          <>
                            <Award className="w-3.5 h-3.5" aria-hidden="true" />
                            {en("Credential exam: answers not shown")}
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                            {exam.revealAnswerKey === false ? en("Practice exam") : en("Practice exam: answers shown after you submit")}
                          </>
                        )}
                      </p>
                    </div>

                    <div className="pt-5 space-y-4">
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-3 border-t border-border">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{exam.durationMinutes} mins</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{en("{totalQuestions} questions", { totalQuestions: exam.totalQuestions })}</span>
                        </div>
                      </div>

                      {(attemptsLine || cooling) && (
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {attemptsLine && <p className="font-medium text-foreground">{attemptsLine}</p>}
                          {cooling && !exhausted && <p>{en("Next attempt available from {date}.", { date: formatDateTime(exam.nextAttemptAt as string) })}</p>}
                        </div>
                      )}

                      <Button variant="secondary" className="w-full" onClick={() => startExam(exam.id)} disabled={cooling || exhausted}>
                        <span>
                          {exam.hasOpenAttempt
                            ? en("Resume exam")
                            : exhausted
                              ? en("No attempts left")
                              : cooling
                                ? en("Available later")
                                : exam.issuesCredential
                                  ? en("Start exam")
                                  : en("Start practice exam")}
                        </span>
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* ==================================================== */
          /* MY ATTEMPTS AND CREDENTIALS                         */
          /* ==================================================== */
          <div className="space-y-6">
            {/* Figures */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatTile label={en("Total attempts")} icon={<FileText />} value={historyStats.totalAttempts} />
              <StatTile
                label={en("Pass rate")}
                icon={<CheckCircle2 />}
                value={`${historyStats.passRatePercentage}%`}
                hint={en("{passedCount} exams passed", { passedCount: historyStats.passedCount })}
              />
              <StatTile label={en("Average score")} icon={<TrendingUp />} value={`${historyStats.averageScore}%`} hint={en("Across all exams")} />
              <StatTile label={en("Highest score")} icon={<Award />} value={`${historyStats.highestScore}%`} />
            </div>

            {/* Past attempts */}
            {historyLoading ? (
              <Loading label={en("Loading your attempts...")} />
            ) : examHistory.length === 0 ? (
              <EmptyState title={en("No exam attempts yet")}>
                <p className="max-w-sm mx-auto">
                  {en("Take any exam from the list to see your scores here and claim verifiable credentials.")}
                </p>
                <Button className="mt-4" onClick={() => setActiveTab("catalog")}>
                  {en("Browse exams")}
                </Button>
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {examHistory.map((att) => (
                  <div
                    key={att.attemptId}
                    className="p-5 rounded-xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{att.stream}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" aria-hidden="true" />
                          <span>{new Date(att.submittedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                        </span>
                        {att.certificateNumber && (
                          <Badge tone="good">
                            <ShieldCheck className="w-3 h-3 me-1" aria-hidden="true" />
                            <span className="font-mono">{att.certificateNumber}</span>
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-base font-semibold text-foreground">
                        {att.examTitle}
                      </h3>

                      {att.status === "Expired" ? (
                        <div className="text-xs text-muted-foreground">
                          {en("Time ran out before this attempt was submitted, so it was not graded. It counts as an attempt.")}
                        </div>
                      ) : (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{en("Score: ")}<strong className={att.passed ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>{att.percentage}%</strong></span>
                        <span aria-hidden="true">•</span>
                        <span>{en("Questions: {correctAnswers}/{totalQuestions}", { correctAnswers: att.correctAnswers, totalQuestions: att.totalQuestions })}</span>
                        {att.percentileRank != null && (
                          <>
                            <span aria-hidden="true">•</span>
                            <span>{en("Better than {percentileRank}% of test takers", { percentileRank: att.percentileRank })}</span>
                          </>
                        )}
                      </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {att.certificateNumber && att.verificationUrl ? (
                        <Link href={att.verificationUrl} className={buttonClass("secondary")}>
                          <Award className="w-4 h-4" aria-hidden="true" />
                          <span>{en("View credential")}</span>
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      ) : (att.canClaimCredential ?? att.passed) ? (
                        <Button onClick={() => handleClaimCredential(att.examId, att.attemptId)} disabled={claiming}>
                          <Award className="w-4 h-4" aria-hidden="true" />
                          <span>{en("Claim credential")}</span>
                        </Button>
                      ) : null}

                      <Button variant="secondary" onClick={() => startExam(att.examId)}>
                        <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        <span>{en("Retake exam")}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. GENERATE AN EXAM WITH AI                          */}
      {/* ---------------------------------------------------- */}
      {showAiModal && (
        <Modal labelledBy="ai-exam-title" onClose={() => setShowAiModal(false)}>
          <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 id="ai-exam-title" className="text-lg font-semibold text-foreground">
                  {en("Generate an exam with AI")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {en("Multiple-choice questions with explanations, on any topic you choose.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                aria-label={en("Close")}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSynthesizeExam} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="ai-exam-topic" className="text-sm font-medium text-foreground">
                  {en("Topic")}
                </label>
                <input
                  id="ai-exam-topic"
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder={en("For example: SQL indexes")}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                      className="px-2.5 py-1 rounded-full border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      {en(preset)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="ai-exam-stream" className="text-sm font-medium text-foreground">
                    {en("Stream")}
                  </label>
                  <select
                    id="ai-exam-stream"
                    value={aiStream}
                    onChange={(e) => setAiStream(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground shadow-sm cursor-pointer"
                  >
                    <option value="Software Engineering">{en("Software Engineering")}</option>
                    <option value="Cloud and DevOps">{en("Cloud and DevOps")}</option>
                    <option value="Aptitude & Logic">{en("Aptitude & Logic")}</option>
                    <option value="Product Management">{en("Product Management")}</option>
                    <option value="Cybersecurity">{en("Cybersecurity")}</option>
                    <option value="Finance & Banking">{en("Finance & Banking")}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="ai-exam-difficulty" className="text-sm font-medium text-foreground">
                    {en("Difficulty")}
                  </label>
                  <select
                    id="ai-exam-difficulty"
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground shadow-sm cursor-pointer"
                  >
                    <option value="Beginner">{en("Beginner")}</option>
                    <option value="Intermediate">{en("Intermediate")}</option>
                    <option value="Advanced">{en("Advanced")}</option>
                    <option value="Staff">{en("Staff")}</option>
                  </select>
                </div>
              </div>

              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium text-foreground">
                  {en("Number of questions")}
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setAiCount(num)}
                      aria-pressed={aiCount === num}
                      className={`py-2 rounded-lg border text-sm transition-colors ${
                        aiCount === num
                          ? "border-indigo-500 bg-indigo-50 text-indigo-800 font-medium dark:bg-indigo-950/40 dark:text-indigo-200"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {en("{num} questions", { num })}
                    </button>
                  ))}
                </div>
              </fieldset>

              <ErrorBanner error={aiError} />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="secondary" onClick={() => setShowAiModal(false)}>
                  {en("Cancel")}
                </Button>
                <Button type="submit" busy={isSynthesizing} disabled={!aiTopic.trim()}>
                  <span>{isSynthesizing ? en("Generating exam...") : en("Generate and start")}</span>
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. IMPORT QUESTIONS                                  */}
      {/* ---------------------------------------------------- */}
      {showUploadModal && (
        <Modal labelledBy="import-exam-title" onClose={() => setShowUploadModal(false)}>
          <div className="relative w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 id="import-exam-title" className="text-lg font-semibold text-foreground">
                  {en("Import questions")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {en("Add your school's or your own questions in the format shown in the example.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                aria-label={en("Close")}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ErrorBanner error={uploadError} />

            <form onSubmit={handleUploadExam} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="import-exam-name" className="text-sm font-medium text-foreground">
                    {en("Exam title")}
                  </label>
                  <input
                    id="import-exam-name"
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder={en("For example: Concurrency midterm")}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="import-exam-stream" className="text-sm font-medium text-foreground">
                    {en("Stream")}
                  </label>
                  <input
                    id="import-exam-stream"
                    type="text"
                    value={uploadStream}
                    onChange={(e) => setUploadStream(e.target.value)}
                    placeholder={en("e.g. Software Engineering")}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="import-exam-duration" className="text-sm font-medium text-foreground">
                    {en("Duration (minutes)")}
                  </label>
                  <input
                    id="import-exam-duration"
                    type="number"
                    value={uploadDuration}
                    onChange={(e) => setUploadDuration(parseInt(e.target.value, 10) || 20)}
                    min={5}
                    max={120}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground shadow-sm"
                  />
                </div>

                <div className="flex items-end">
                  <Button type="button" variant="secondary" className="w-full" onClick={loadSampleJson}>
                    <FileCode className="w-4 h-4" aria-hidden="true" />
                    <span>{en("Load an example")}</span>
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="import-exam-json" className="text-sm font-medium text-foreground flex flex-wrap items-center justify-between gap-1">
                  <span>{en("Questions (in the example's format)")}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {en("Each question needs questionText, options, correctOptionIndex (0 is the first option) and explanation")}
                  </span>
                </label>
                <textarea
                  id="import-exam-json"
                  rows={8}
                  value={uploadJson}
                  onChange={(e) => setUploadJson(e.target.value)}
                  placeholder={en(`[\n  {\n    "questionText": "Question description",\n    "options": ["Option A", "Option B", "Option C", "Option D"],\n    "correctOptionIndex": 0,\n    "explanation": "Rationale...",\n    "topic": "Topic"\n  }\n]`)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card font-mono text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="secondary" onClick={() => setShowUploadModal(false)}>
                  {en("Cancel")}
                </Button>
                <Button type="submit" busy={isUploading} disabled={!uploadTitle.trim() || !uploadJson.trim()}>
                  <span>{isUploading ? en("Checking and publishing...") : en("Publish questions")}</span>
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. VERIFIED CREDENTIAL                               */}
      {/* ---------------------------------------------------- */}
      {showCredentialModal && claimedCredential && (
        <Modal labelledBy="credential-title" onClose={() => setShowCredentialModal(false)}>
          <div className="bg-card border border-border rounded-xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowCredentialModal(false)}
              aria-label={en("Close")}
              className="absolute top-4 end-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Credential header */}
            <div className="text-center space-y-2 pt-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center justify-center">
                <Award className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="text-sm text-muted-foreground">{en("Verifiable credential")}</p>
              <h2 id="credential-title" className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
                {claimedCredential.badgeTitle || "Verified credential"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {en("Issued by ")}<strong className="font-medium text-foreground">{en("Edulexa")}</strong>{en(". Anyone can check it at its verification link.")}
              </p>
            </div>

            {/* Credential details */}
            <div className="p-5 rounded-lg border border-border space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">{en("Name")}</dt>
                  <dd className="font-medium text-foreground mt-0.5">{claimedCredential.candidateName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{en("Score")}</dt>
                  <dd className="font-medium text-foreground mt-0.5">{claimedCredential.percentage}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{en("Certificate number")}</dt>
                  <dd className="font-mono font-medium text-foreground text-xs mt-0.5">{claimedCredential.certificateNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{en("Issue date")}</dt>
                  <dd className="font-medium text-foreground mt-0.5">
                    {new Date(claimedCredential.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </dd>
                </div>
              </dl>

              {/* SHA-256 seal */}
              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    <span>{en("Tamper-proof seal")}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(claimedCredential.verificationSignatureSha256);
                      setCopiedSignature(true);
                      setTimeout(() => setCopiedSignature(false), 2000);
                    }}
                    className="text-indigo-700 dark:text-indigo-300 hover:underline font-medium flex items-center gap-1"
                  >
                    {copiedSignature ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSignature ? en("Copied") : en("Copy")}</span>
                  </button>
                </div>
                <p className="font-mono text-xs text-muted-foreground break-all leading-tight">
                  {claimedCredential.verificationSignatureSha256}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {/* Add to LinkedIn */}
              <a
                href={`https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
                  claimedCredential.badgeTitle || "Certified Specialist"
                )}&organizationName=${encodeURIComponent(
                  "Edulexa"
                )}&issueYear=${new Date(claimedCredential.issuedAt).getFullYear()}&issueMonth=${
                  new Date(claimedCredential.issuedAt).getMonth() + 1
                }&certUrl=${encodeURIComponent(
                  typeof window !== "undefined"
                    ? `${window.location.origin}/credential/${claimedCredential.publicUrlSlug}`
                    : `http://localhost:3000/credential/${claimedCredential.publicUrlSlug}`
                )}&certId=${encodeURIComponent(claimedCredential.certificateNumber)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${buttonClass("primary")} w-full`}
                style={brandFill}
              >
                <LinkedInIcon className="w-4 h-4" />
                <span>{en("Add to your LinkedIn profile")}</span>
              </a>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const url = typeof window !== "undefined"
                      ? `${window.location.origin}/credential/${claimedCredential.publicUrlSlug}`
                      : `http://localhost:3000/credential/${claimedCredential.publicUrlSlug}`;
                    navigator.clipboard.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? en("Link copied") : en("Copy public link")}</span>
                </Button>

                <Link href="/passport" className={buttonClass("secondary")}>
                  <span>{en("Open skill passport")}</span>
                </Link>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
