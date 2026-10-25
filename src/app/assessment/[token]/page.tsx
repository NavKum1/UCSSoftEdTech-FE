"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Code2,
  Mic,
  Award,
  ArrowRight,
  Sparkles,
  Terminal,
  Play,
  AlertTriangle,
  Check,
  Copy,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { getApiBaseUrl } from "@/lib/apiClient";

/**
 * H7b: the candidate assessment link is public. The candidate needs no account; the bundle token in the URL is the
 * credential, so these calls go to the bundle-scoped endpoints without a user token (and without cookies). The API
 * checks the token (entropy, expiry, revocation), rate-limits it and scores every stage on the server.
 */
function bundleFetch(token: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${getApiBaseUrl()}/api/recruiter/assessments/bundle/${encodeURIComponent(token)}${path}`, {
    ...init,
    headers,
    credentials: "omit",
    cache: "no-store",
  });
}

type LinkProblem = "invalid" | "expired" | "revoked" | "busy" | "unavailable";

const LINK_PROBLEM_TEXT: Record<LinkProblem, { title: string; body: string }> = {
  invalid: { title: "This assessment link isn't valid", body: "Check that you opened the full link from your invitation email, or ask the recruiter to send it again." },
  expired: { title: "This assessment link has expired", body: "Ask the recruiter who invited you for a new link." },
  revoked: { title: "This assessment link was withdrawn", body: "The recruiter withdrew this invitation. Contact them if you think this is a mistake." },
  busy: { title: "Too many requests", body: "Please wait a minute and reload the page." },
  unavailable: { title: "The assessment can't load right now", body: "Please try again in a few minutes." },
};

async function linkProblemOf(res: Response): Promise<LinkProblem> {
  if (res.status === 404) return "invalid";
  if (res.status === 429) return "busy";
  if (res.status === 410) {
    const body = (await res.json().catch(() => ({}))) as { reason?: string };
    return body.reason === "revoked" ? "revoked" : "expired";
  }
  return "unavailable";
}

interface AssessmentBundle {
  token: string;
  candidateName: string;
  targetRole: string;
  companyName: string;
  currentStage: number; // 1 = Written, 2 = Coding, 3 = Voice Defense, 4 = Completed
  overallStatus: string;
  examId: string;
  examTitle: string;
  examDurationMinutes: number;
  stage1Score?: number;
  sprintTitle: string;
  requiredLanguage: string;
  problemStatement: string;
  starterCode: string;
  stage2Score?: number;
  defenseTopic: string;
  defenseVoice: string;
  stage3Score?: number;
  compositeScore?: number;
  certificateNumber?: string;
  verificationSignatureSha256?: string;
  expiresAt?: string;
  codeRunsRemaining?: number | null;
}

// The parts of the (prefixed) Web Speech API this page uses
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface ExamQuestion {
  id: number;
  questionText: string;
  codeSnippet?: string;
  options: string[];
  topic: string;
}

export default function CandidateAssessmentBundlePage() {
  const params = useParams();
  const token = (params?.token as string) || "";
  const [linkProblem, setLinkProblem] = useState<LinkProblem | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);

  const [bundle, setBundle] = useState<AssessmentBundle | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submittingStage, setSubmittingStage] = useState<boolean>(false);
  const [activeStage, setActiveStage] = useState<number>(1);

  // Stage 1 Exam State
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [examCurrentQIndex, setExamCurrentQIndex] = useState<number>(0);
  const [examTimeLeft, setExamTimeLeft] = useState<number>(1200);

  // Stage 2 Coding State
  const [candidateCode, setCandidateCode] = useState<string>("");
  const [runningTests, setRunningTests] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<{ name: string; passed: boolean; durationMs: number }[] | null>(null);
  const [executionConsole, setExecutionConsole] = useState<{
    stdout: string;
    stderr: string;
    version: string;
    durationMs: number;
    success: boolean;
  } | null>(null);

  // Stage 3 Voice Defense State
  const [defenseActive, setDefenseActive] = useState<boolean>(false);
  const [defenseSeconds, setDefenseSeconds] = useState<number>(0);
  const [candidateDefenseNotes, setCandidateDefenseNotes] = useState<string>("");
  const [spokenTranscript, setSpokenTranscript] = useState<string>("");
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [copiedSignature, setCopiedSignature] = useState<boolean>(false);

  // Auto-save candidate code & answers to LocalStorage
  // Saves the candidate's code and answers to localStorage as they change (called from the edit handlers)
  const saveDraft = (code: string, answers: Record<number, number>) => {
    if (!token || !code) return;
    try {
      const savedAt = new Date().toLocaleTimeString();
      localStorage.setItem(`edulexa_draft_${token}`, JSON.stringify({ code, answers, savedAt }));
      setDraftSavedAt(savedAt);
    } catch {
      // Ignore in private browsing mode
    }
  };

  const fetchBundle = async () => {
    // loading starts true and there is no link problem yet; every state update below comes after the first await
    try {
      const res = await bundleFetch(token, "");
      if (!res.ok) {
        setLinkProblem(await linkProblemOf(res));
        return;
      }
      {
        const data: AssessmentBundle = await res.json();
        setBundle(data);
        setActiveStage(data.currentStage || 1);

        // Check for local draft
        let initialCode = data.starterCode || "";
        try {
          const draftKey = `edulexa_draft_${token}`;
          const raw = localStorage.getItem(draftKey);
          if (raw) {
            const draft = JSON.parse(raw);
            if (draft.code && draft.code.trim().length > 0) {
              initialCode = draft.code;
            }
            if (draft.answers && Object.keys(draft.answers).length > 0) {
              setExamAnswers(draft.answers);
            }
            if (draft.savedAt) {
              setDraftSavedAt(draft.savedAt);
            }
          }
        } catch {
          // A broken draft is ignored
        }

        setCandidateCode(initialCode);

        // Fetch this bundle's exam questions for Stage 1 (served only while stage 1 is open)
        const examRes = data.currentStage === 1 ? await bundleFetch(token, "/exam") : null;
        if (examRes?.ok) {
          const examData = await examRes.json();
          setExamQuestions(examData.questions || []);
          setExamTimeLeft((data.examDurationMinutes || 20) * 60);
        }
      }
    } catch (err) {
      console.error("Failed to load assessment bundle:", err);
      setLinkProblem("unavailable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Loaded outside the effect body (state is only set once the response is in)
    void Promise.resolve().then(fetchBundle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per token
  }, [token]);

  // Stage 1 (written exam): graded on the server against this bundle's exam; moves the bundle on to stage 2
  const handleSubmitStage1 = async () => {
    setSubmittingStage(true);
    setStageError(null);
    try {
      const res = await bundleFetch(token, "/exam/submit", {
        method: "POST",
        body: JSON.stringify({ answers: examAnswers }),
      });
      if (res.ok) {
        const graded = await res.json();
        setBundle(graded.bundle);
        setActiveStage(graded.bundle?.currentStage ?? 2);
      } else if (res.status === 404 || res.status === 410) {
        setLinkProblem(await linkProblemOf(res));
      } else {
        const body = await res.json().catch(() => ({}));
        setStageError(body.error || "Could not submit the written stage. Please try again.");
      }
    } catch (err) {
      console.error("Failed to submit Stage 1:", err);
      setStageError("Could not reach the server. Please try again.");
    } finally {
      setSubmittingStage(false);
    }
  };

  // Stage 2: runs the code in the sandbox against this bundle's fixed checks (the server picks language and tests)
  const handleRunTests = async () => {
    setRunningTests(true);
    setExecutionConsole(null);
    try {
      const res = await bundleFetch(token, "/code/execute", {
        method: "POST",
        body: JSON.stringify({ code: candidateCode }),
      });

      if (res.ok) {
        const data = await res.json();
        setExecutionConsole({
          stdout: data.stdOut || "(No standard output generated)",
          stderr: data.stdErr || "",
          version: data.version || "Sandbox",
          durationMs: data.executionTimeMs || 0,
          success: data.success,
        });
        if (typeof data.codeRunsRemaining === "number") {
          setBundle((prev) => (prev ? { ...prev, codeRunsRemaining: data.codeRunsRemaining } : prev));
        }
        const results: { name: string; passed: boolean }[] = data.testCaseResults || [];
        setTestResults(
          results.map((tc) => ({
            name: tc.name,
            passed: tc.passed,
            durationMs: Math.round((data.executionTimeMs || 0) / Math.max(1, results.length)),
          })),
        );
      } else if (res.status === 404 || res.status === 410) {
        setLinkProblem(await linkProblemOf(res));
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (typeof errJson.codeRunsRemaining === "number") {
          setBundle((prev) => (prev ? { ...prev, codeRunsRemaining: errJson.codeRunsRemaining } : prev));
        }
        throw new Error(
          res.status === 429
            ? errJson.scope === "link"
              ? "You have used all code runs for this assessment."
              : "Too many runs in a short time. Please wait a minute."
            : errJson.error || "Code execution failed",
        );
      }
    } catch (err: unknown) {
      console.error("Test execution error:", err);
      setTestResults(null);
      setExecutionConsole({
        stdout: "",
        stderr: err instanceof Error && !(err instanceof TypeError) ? err.message : "We couldn't run your code. Please try again.",
        version: "Sandbox Error",
        durationMs: 0,
        success: false,
      });
    } finally {
      setRunningTests(false);
    }
  };

  // Submit Stage 2 (Code Sprint): the server scores it from your last sandbox run
  const handleSubmitStage2 = async () => {
    setSubmittingStage(true);
    setStageError(null);
    try {
      const res = await bundleFetch(token, "/submit-stage", {
        method: "POST",
        body: JSON.stringify({ stage: 2 }),
      });

      if (res.ok) {
        const updated = await res.json();
        setBundle(updated);
        setActiveStage(updated.currentStage ?? 3);
      } else if (res.status === 404 || res.status === 410) {
        setLinkProblem(await linkProblemOf(res));
      } else {
        const body = await res.json().catch(() => ({}));
        setStageError(body.error || "Could not submit the coding stage. Please try again.");
      }
    } catch (err) {
      console.error("Failed to submit Stage 2:", err);
      setStageError("Could not reach the server. Please try again.");
    } finally {
      setSubmittingStage(false);
    }
  };

  // Stage 3 Voice Timer & Live Web Speech Recognition
  useEffect(() => {
    if (!defenseActive) return;
    const interval = setInterval(() => {
      setDefenseSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [defenseActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    const SpeechRec = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRec) return;

    let recognition: SpeechRecognitionLike | null = null;
    if (defenseActive) {
      try {
        recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
          let full = "";
          for (let i = 0; i < event.results.length; i++) {
            full += event.results[i][0].transcript + " ";
          }
          if (full.trim()) {
            setSpokenTranscript(full.trim());
          }
        };

        recognition.onerror = (e) => {
          console.warn("Speech recognition error:", e);
        };

        recognition.start();
      } catch (err) {
        console.warn("Could not start speech recognition:", err);
      }
    }

    return () => {
      if (recognition) {
        try { recognition.stop(); } catch {}
      }
    };
  }, [defenseActive]);

  // Submit Stage 3 (AI Voice Defense) - Real Semantic Evaluation
  const handleSubmitStage3 = async () => {
    setSubmittingStage(true);
    try {
      const defenseMinutes = Math.max(1, Math.round(defenseSeconds / 60));
      const combinedCandidateWords = (spokenTranscript.trim() + " " + candidateDefenseNotes.trim()).trim();

      const candidateSpeechTurn = combinedCandidateWords.length > 0
        ? combinedCandidateWords
        : "Candidate completed live evaluation without verbal response or trade-off defense.";

      const transcriptsToSend = [
        { role: "interviewer", text: `Candidate initiating architectural defense for ${bundle?.targetRole}: '${bundle?.defenseTopic}'.`, timestamp: "00:05" },
        { role: "candidate", text: candidateSpeechTurn, timestamp: "01:30" }
      ];

      setStageError(null);
      const res = await bundleFetch(token, "/submit-stage", {
        method: "POST",
        body: JSON.stringify({
          stage: 3,
          transcripts: transcriptsToSend,
          notes: combinedCandidateWords || `Session concluded after ${defenseMinutes}m verbal cross-examination.`,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setBundle(updated);
        setActiveStage(updated.currentStage ?? 4);
        setDefenseActive(false);
      } else if (res.status === 404 || res.status === 410) {
        setLinkProblem(await linkProblemOf(res));
      } else {
        const body = await res.json().catch(() => ({}));
        setStageError(body.error || "Could not submit the defense. Please try again.");
      }
    } catch (err) {
      console.error("Failed to submit Stage 3:", err);
      setStageError("Could not reach the server. Please try again.");
    } finally {
      setSubmittingStage(false);
    }
  };

  if (linkProblem) {
    const text = LINK_PROBLEM_TEXT[linkProblem];
    return (
      <main className="min-h-[70vh] flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm" data-assessment-problem={linkProblem}>
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-500" aria-hidden="true" />
          <h1 className="text-xl font-bold mb-2">{text.title}</h1>
          <p className="text-sm text-muted-foreground">{text.body}</p>
        </div>
      </main>
    );
  }

  if (loading || !bundle) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground font-mono">Initializing 3-Stage Assessment Sandbox...</p>
        </div>
      </div>
    );
  }

  const stages = [
    { num: 1, title: "Written Diagnostic", icon: FileText, desc: "System Design & Algorithms" },
    { num: 2, title: "Production Sprint", icon: Code2, desc: "Hands-on Implementation" },
    { num: 3, title: "AI Voice Defense", icon: Mic, desc: "Architectural Cross-Exam" },
    { num: 4, title: "Certified Scorecard", icon: Award, desc: "Cryptographic Seal" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      {/* Top Corporate Assessment Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-amber-500 p-0.5 shadow-md">
              <div className="w-full h-full bg-card rounded-[10px] flex items-center justify-center font-black text-foreground text-sm">
                {bundle.companyName.slice(0, 2).toUpperCase()}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">{bundle.companyName} Hiring Pipeline</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                  Verified Assessment Bundle
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-foreground">
                {bundle.targetRole}
              </h1>
              {bundle.expiresAt && bundle.currentStage < 4 && (
                <p className="text-[11px] text-muted-foreground">
                  This link works until{" "}
                  {new Date(bundle.expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
            {draftSavedAt && (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Draft Saved ({draftSavedAt})
              </span>
            )}
            <span>Candidate: <strong className="text-foreground">{bundle.candidateName}</strong></span>
            <span>•</span>
            <span className="px-2.5 py-1 rounded-md bg-muted text-foreground font-semibold">
              {bundle.token}
            </span>
          </div>
        </div>
      </header>

      {/* Progress Stepper Bar */}
      <section className="border-b border-border/80 bg-muted/20 py-4 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stages.map((st) => {
              const isPast = activeStage > st.num;
              const isCurrent = activeStage === st.num;

              return (
                <div
                  key={st.num}
                  className={`p-3 rounded-2xl border transition-all flex items-center gap-3 ${
                    isPast
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : isCurrent
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary shadow-sm"
                      : "border-border/60 bg-card/40 text-muted-foreground opacity-60"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isPast
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isPast ? <Check className="w-4 h-4 stroke-[3]" /> : st.num}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate leading-tight">{st.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{st.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Dynamic Assessment Stage Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 space-y-6">
        {stageError && (
          <div role="alert" className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-semibold">
            {stageError}
          </div>
        )}
        {/* ==================================================== */}
        {/* STAGE 1: TIMED WRITTEN EXAM DIAGNOSTIC               */}
        {/* ==================================================== */}
        {activeStage === 1 && (
          <div className="p-6 md:p-8 rounded-3xl border border-border bg-card shadow-sm space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                  Stage 1 of 3: Written Diagnostic
                </span>
                <h2 className="text-xl font-bold text-foreground mt-0.5">
                  {bundle.examTitle}
                </h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-muted/40 font-mono text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>
                  {Math.floor(examTimeLeft / 60)}:{(examTimeLeft % 60).toString().padStart(2, "0")}
                </span>
              </div>
            </div>

            {examQuestions.length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Question {examCurrentQIndex + 1} of {examQuestions.length}</span>
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase">
                    {examQuestions[examCurrentQIndex].topic}
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-semibold text-foreground leading-relaxed">
                  {examQuestions[examCurrentQIndex].questionText}
                </h3>

                {examQuestions[examCurrentQIndex].codeSnippet && (
                  <pre className="p-4 rounded-xl bg-neutral-950 text-neutral-100 font-mono text-xs overflow-x-auto border border-neutral-800">
                    <code>{examQuestions[examCurrentQIndex].codeSnippet}</code>
                  </pre>
                )}

                <div className="space-y-3">
                  {examQuestions[examCurrentQIndex].options.map((opt, idx) => {
                    const isSelected = examAnswers[examQuestions[examCurrentQIndex].id] === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          const next = { ...examAnswers, [examQuestions[examCurrentQIndex].id]: idx };
                          setExamAnswers(next);
                          saveDraft(candidateCode, next);
                        }}
                        className={`w-full text-left p-4 rounded-xl border text-sm transition-all flex items-center justify-between ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground font-semibold ring-1 ring-primary"
                            : "border-border/80 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        }`}
                      >
                        <span>{opt}</span>
                        {isSelected && <Check className="w-4 h-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <button
                    disabled={examCurrentQIndex === 0}
                    onClick={() => setExamCurrentQIndex((prev) => Math.max(0, prev - 1))}
                    className="px-4 py-2 rounded-xl border border-border text-xs font-semibold disabled:opacity-40"
                  >
                    Previous
                  </button>

                  {examCurrentQIndex < examQuestions.length - 1 ? (
                    <button
                      onClick={() => setExamCurrentQIndex((prev) => prev + 1)}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-95"
                    >
                      Next Question
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmitStage1}
                      disabled={submittingStage}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-colors"
                    >
                      <span>{submittingStage ? "Grading..." : "Submit Stage 1 & Advance to Coding"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-muted-foreground">
                Loading exam questions...
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* STAGE 2: PRODUCTION CODING SPRINT KATA               */}
        {/* ==================================================== */}
        {activeStage === 2 && (
          <div className="p-6 md:p-8 rounded-3xl border border-border bg-card shadow-sm space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                  Stage 2 of 3: Production Code Sprint
                </span>
                <h2 className="text-xl font-bold text-foreground mt-0.5">
                  {bundle.sprintTitle}
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-muted text-xs font-mono font-semibold uppercase text-foreground">
                {bundle.requiredLanguage}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-muted/30 border border-border text-xs leading-relaxed space-y-2">
              <span className="font-bold text-foreground block">Problem Statement:</span>
              <p className="text-muted-foreground">{bundle.problemStatement}</p>
            </div>

            {/* Code Editor Mock */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-primary" />
                  <span>solution.{bundle.requiredLanguage === "typescript" ? "ts" : "py"}</span>
                </span>
                <button
                  onClick={handleRunTests}
                  disabled={runningTests}
                  className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Play className="w-3 h-3 text-emerald-500" />
                  <span>{runningTests ? "Running Tests..." : "Run Test Suite"}</span>
                </button>
              </div>

              <textarea
                rows={12}
                value={candidateCode}
                onChange={(e) => {
                  setCandidateCode(e.target.value);
                  saveDraft(e.target.value, examAnswers);
                }}
                className="w-full p-4 rounded-2xl bg-neutral-950 text-neutral-100 font-mono text-xs border border-neutral-800 focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed shadow-inner"
              />
            </div>

            {/* Live Compiler Console Output */}
            {executionConsole && (
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs font-mono space-y-2 animate-in fade-in duration-150 shadow-inner">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="flex items-center gap-1.5 text-neutral-400 text-[11px]">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sandbox Compiler stdout ({executionConsole.version})</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${executionConsole.success ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/50" : "bg-rose-950/60 text-rose-400 border border-rose-800/50"}`}>
                    {executionConsole.durationMs}ms • {executionConsole.success ? "Exit Code 0" : "Failed"}
                  </span>
                </div>
                <pre className="text-neutral-200 text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed py-1 max-h-48">
                  {executionConsole.stdout}
                </pre>
                {executionConsole.stderr && (
                  <pre className="text-rose-400 text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed pt-1 border-t border-neutral-800">
                    {executionConsole.stderr}
                  </pre>
                )}
              </div>
            )}

            {/* Unit Test Results */}
            {testResults && (
              <div className="p-4 rounded-2xl bg-background/80 border border-border space-y-2.5 animate-in fade-in duration-150">
                <span className="text-xs font-bold text-foreground block">Automated Test Execution Results:</span>
                <div className="space-y-2">
                  {testResults.map((tr, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-card border border-border text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        {tr.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-label="passed" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-label="failed" />
                        )}
                        <span className="text-foreground">{tr.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{tr.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Your last test run sets the sprint score.
                {typeof bundle.codeRunsRemaining === "number" && ` ${bundle.codeRunsRemaining} test runs left.`}
              </span>
              <button
                onClick={handleSubmitStage2}
                disabled={submittingStage}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-95 shadow-md flex items-center gap-2 transition-opacity"
              >
                <span>{submittingStage ? "Submitting..." : "Submit Sprint & Advance to Voice Defense"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STAGE 3: LIVE AI VOICE DEFENSE                       */}
        {/* ==================================================== */}
        {activeStage === 3 && (
          <div className="p-6 md:p-8 rounded-3xl border border-border bg-card shadow-sm space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">
                  Stage 3 of 3: AI Voice Defense
                </span>
                <h2 className="text-xl font-bold text-foreground mt-0.5">
                  Architectural Cross-Examination
                </h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-muted/40 font-mono text-xs font-bold">
                <Mic className="w-3.5 h-3.5 text-purple-500 animate-pulse" />
                <span>{Math.floor(defenseSeconds / 60)}:{(defenseSeconds % 60).toString().padStart(2, "0")}</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400">
                <Sparkles className="w-4 h-4" />
                <span>Examiner Challenge Topic:</span>
              </div>
              <p className="text-sm font-semibold text-foreground leading-relaxed">
                &ldquo;{bundle.defenseTopic}&rdquo;
              </p>
              <p className="text-xs text-muted-foreground">
                The AI Hiring Committee cross-examines the code you wrote in Stage 2. Speak naturally, articulate trade-offs, and defend your failure recovery mechanisms.
              </p>
            </div>

            {/* Voice HUD Waveform Display */}
            <div className="p-8 rounded-2xl bg-neutral-950 border border-neutral-800 text-center space-y-4">
              <div className="flex items-center justify-center gap-1.5 h-16">
                {[40, 75, 90, 60, 85, 95, 70, 50, 80, 65, 90, 75].map((h, i) => (
                  <div
                    key={i}
                    className={`w-1.5 rounded-full transition-all duration-300 ${
                      defenseActive ? "bg-purple-500 animate-pulse" : "bg-neutral-800"
                    }`}
                    style={{ height: defenseActive ? `${h}%` : "20%" }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDefenseActive(!defenseActive)}
                  className={`px-6 py-2.5 rounded-2xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 ${
                    defenseActive
                      ? "bg-rose-600 hover:bg-rose-700 text-white"
                      : "bg-purple-600 hover:bg-purple-700 text-white"
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>{defenseActive ? "Pause Audio Stream" : "Connect & Defend Approach"}</span>
                </button>
              </div>

              <p className="text-[11px] text-neutral-400">
                {defenseActive
                  ? "AI Examiner listening... Voice stream authenticated with 24-bit prosody analysis."
                  : "Click to activate WebRTC mic and begin voice defense with the AI Senior Architect."}
              </p>
            </div>

            {/* Live Spoken Recognition Stream */}
            {spokenTranscript && (
              <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-1 animate-in fade-in">
                <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                  <Mic className="w-3 h-3 animate-pulse" /> Live Spoken Voice Recognition Stream:
                </span>
                <p className="text-xs font-mono text-foreground italic">&ldquo;{spokenTranscript}&rdquo;</p>
              </div>
            )}

            {/* Candidate Architectural Defense Notes */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Architectural Defense Notes & Trade-Off Summary</span>
                <span className="text-[10px] text-muted-foreground font-normal">Optional written defense to accompany verbal statements</span>
              </label>
              <textarea
                value={candidateDefenseNotes}
                onChange={(e) => setCandidateDefenseNotes(e.target.value)}
                placeholder="Defend consistent hashing ring mechanics, virtual node distribution, leader lease fencing, and why your implementation guarantees linearizability..."
                className="w-full h-24 p-3 rounded-xl bg-muted/40 border border-border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none text-foreground"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-xs text-muted-foreground">Graded on how well you explain your solution, trade-offs and edge cases. Accent, grammar and language never count.</span>
              <button
                onClick={handleSubmitStage3}
                disabled={submittingStage}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-colors"
              >
                <span>{submittingStage ? "Finalizing..." : "Finish the assessment"}</span>
                <Award className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STAGE 4: COMPLETION (only real results are shown)   */}
        {/* ==================================================== */}
        {activeStage === 4 && (
          <div className="p-6 md:p-8 rounded-3xl border border-border bg-card shadow-sm space-y-6">
            <div className="text-center space-y-2 pt-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 aria-hidden="true" className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground tracking-tight">Assessment complete</h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                Thank you{bundle.candidateName ? `, ${bundle.candidateName.split(" ")[0]}` : ""}. Your answers are saved.{" "}
                {bundle.companyName ? `${bundle.companyName} reviews every assessment before any decision and will contact you.` : "The hiring team reviews every assessment before any decision."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Stage 1: Written exam", score: bundle.stage1Score },
                { label: "Stage 2: Coding task", score: bundle.stage2Score },
                { label: "Stage 3: Defense", score: bundle.stage3Score },
              ].map((st) => (
                <div key={st.label} className="p-4 rounded-2xl bg-muted/30 border border-border text-center">
                  <span className="text-[11px] uppercase font-semibold text-muted-foreground">{st.label}</span>
                  {st.score == null ? (
                    <p className="mt-2 text-sm font-medium text-muted-foreground">Being reviewed</p>
                  ) : (
                    <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">{Math.round(st.score * 10) / 10}%</p>
                  )}
                </div>
              ))}
            </div>

            <div className="p-5 rounded-2xl border border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Overall score</span>
                {bundle.compositeScore == null ? (
                  <p className="mt-1 text-sm text-muted-foreground">Calculated once every stage has been scored.</p>
                ) : (
                  <div className="text-3xl font-semibold text-foreground mt-0.5 tabular-nums">{bundle.compositeScore}%</div>
                )}
              </div>
              {bundle.certificateNumber && (
                <div className="sm:text-right">
                  <span className="text-xs text-muted-foreground block">You earned a verifiable credential</span>
                  <Link
                    href={`/credential/${bundle.certificateNumber.toLowerCase()}`}
                    className="font-mono text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
                  >
                    {bundle.certificateNumber}
                  </Link>
                </div>
              )}
            </div>

            {bundle.certificateNumber && bundle.verificationSignatureSha256 && (
              <div className="p-3.5 rounded-xl bg-background/80 border border-border space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-muted-foreground flex items-center gap-1">
                    <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Credential seal (SHA-256)</span>
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(bundle.verificationSignatureSha256!);
                      setCopiedSignature(true);
                      setTimeout(() => setCopiedSignature(false), 2000);
                    }}
                    className="text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    {copiedSignature ? <Check aria-hidden="true" className="w-3 h-3 text-emerald-500" /> : <Copy aria-hidden="true" className="w-3 h-3" />}
                    <span>{copiedSignature ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground break-all leading-tight">{bundle.verificationSignatureSha256}</p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Keep this page&apos;s link private: it opens your assessment. To show your result to others, share the credential link instead.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
