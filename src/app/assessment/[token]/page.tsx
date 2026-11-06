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
  Terminal,
  Play,
  AlertTriangle,
  Check,
  Copy,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { getApiBaseUrl } from "@/lib/apiClient";
import { useAppAuth } from "@/lib/appAuth";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, ErrorBanner, Loading, StatTile } from "@/components/career/ui";

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

// Staff who may author assessment links: when one of them opens a candidate link it's a preview, not the candidate
const STAFF_ROLES = ["recruiter", "instituteadmin", "superadmin", "counselor", "faculty", "admin"];

export default function CandidateAssessmentBundlePage() {
  const en = useEn();
  // Code review (6 Nov 2026): a recruiter checking the link before sending it must not show up as "opened by the candidate"
  const { isLoaded: authLoaded, roles } = useAppAuth();
  const preview = roles.some((r) => STAFF_ROLES.includes(r.toLowerCase()));
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
      const res = await bundleFetch(token, preview ? "?preview=true" : "");
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
    // Waits for the sign-in state, so a staff preview is known before the first request
    if (!authLoaded) return;
    // Loaded outside the effect body (state is only set once the response is in)
    void Promise.resolve().then(fetchBundle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per token
  }, [token, authLoaded]);

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
      <div className="min-h-[60vh] flex items-center justify-center text-foreground">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center shadow-sm" data-assessment-problem={linkProblem}>
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-500" aria-hidden="true" />
          <h1 className="text-xl font-semibold mb-2">{text.title}</h1>
          <p className="text-sm text-muted-foreground">{text.body}</p>
        </div>
      </div>
    );
  }

  if (loading || !bundle) {
    return (
      <div className="min-h-[60vh] text-foreground flex items-center justify-center">
        <Loading label={en("Loading your assessment...")} />
      </div>
    );
  }

  const stages = [
    { num: 1, title: en("Written exam"), icon: FileText, desc: "Multiple-choice questions" },
    { num: 2, title: en("Coding task"), icon: Code2, desc: "Write and test your code" },
    { num: 3, title: en("Voice defense"), icon: Mic, desc: "Explain your code out loud" },
    { num: 4, title: en("Results"), icon: Award, desc: "Scores and credential" },
  ];

  return (
    <div className="text-foreground flex flex-col">
      {preview && (
        <p role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {en("Preview: you're signed in as staff, so this visit isn't counted as the candidate opening the link. Don't start the assessment here: your answers would count as the candidate's.")}
        </p>
      )}
      {/* Assessment header */}
      <header className="rounded-xl border border-border bg-card px-5 py-4 sticky top-0 z-30 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 shrink-0 rounded-lg border border-border bg-muted flex items-center justify-center font-semibold text-foreground text-sm" aria-hidden="true">
              {bundle.companyName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{en("{companyName} hiring assessment", { companyName: bundle.companyName })}</span>
                <Badge tone="good">{en("Verified assessment")}</Badge>
              </div>
              <h1 className="text-base sm:text-lg font-semibold text-foreground">
                {bundle.targetRole}
              </h1>
              {bundle.expiresAt && bundle.currentStage < 4 && (
                <p className="text-xs text-muted-foreground">
                  {en("This link works until {number}.", { number: new Date(bundle.expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) })}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {draftSavedAt && (
              <Badge tone="good">{en("Draft saved ({draftSavedAt})", { draftSavedAt })}</Badge>
            )}
            <span>{en("Candidate: ")}<strong className="font-medium text-foreground">{bundle.candidateName}</strong></span>
            <span aria-hidden="true">•</span>
            <span className="px-2 py-1 rounded-md bg-muted font-mono text-foreground">
              {bundle.token}
            </span>
          </div>
        </div>
      </header>

      {/* Progress steps */}
      <section className="py-4">
        <ol className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stages.map((st) => {
            const isPast = activeStage > st.num;
            const isCurrent = activeStage === st.num;

            return (
              <li
                key={st.num}
                aria-current={isCurrent ? "step" : undefined}
                className={`p-3 rounded-xl border bg-card transition-colors flex items-center gap-3 ${
                  isCurrent ? "border-indigo-500 ring-1 ring-indigo-500 shadow-sm text-foreground" : isPast ? "border-border text-foreground" : "border-border text-muted-foreground"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 ${
                    isPast ? "bg-emerald-600 text-white" : isCurrent ? "text-[var(--brand-foreground,#fff)]" : "bg-muted text-muted-foreground"
                  }`}
                  style={isCurrent ? { background: "var(--brand, #0e7490)" } : undefined}
                >
                  {isPast ? <Check className="w-4 h-4" /> : st.num}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate leading-tight">{en(st.title)}</div>
                  <div className="text-xs text-muted-foreground truncate">{en(st.desc)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Current stage */}
      <div className="flex-1 w-full space-y-6">
        <ErrorBanner error={stageError} />
        {/* ==================================================== */}
        {/* STAGE 1: TIMED WRITTEN EXAM                          */}
        {/* ==================================================== */}
        {activeStage === 1 && (
          <div className="p-5 md:p-6 rounded-xl border border-border bg-card shadow-sm space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {en("Stage 1 of 3: Written exam")}
                </p>
                <h2 className="text-xl font-semibold text-foreground mt-0.5">
                  {bundle.examTitle}
                </h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 font-mono text-sm font-semibold tabular-nums">
                <Clock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <span>
                  {Math.floor(examTimeLeft / 60)}:{(examTimeLeft % 60).toString().padStart(2, "0")}
                </span>
              </div>
            </div>

            {examQuestions.length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{en("Question {value} of {length}", { value: examCurrentQIndex + 1, length: examQuestions.length })}</span>
                  <Badge>{examQuestions[examCurrentQIndex].topic}</Badge>
                </div>

                <h3 className="text-base sm:text-lg font-semibold text-foreground leading-relaxed">
                  {examQuestions[examCurrentQIndex].questionText}
                </h3>

                {examQuestions[examCurrentQIndex].codeSnippet && (
                  <pre className="p-4 rounded-lg bg-neutral-950 text-neutral-100 font-mono text-xs overflow-x-auto border border-neutral-800">
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
                        className={`w-full text-start p-4 rounded-lg border text-sm transition-colors flex items-center justify-between ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 text-foreground font-medium ring-1 ring-indigo-500 dark:bg-indigo-950/30"
                            : "border-border bg-card text-foreground hover:bg-muted"
                        }`}
                      >
                        <span>{opt}</span>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <Button
                    variant="secondary"
                    disabled={examCurrentQIndex === 0}
                    onClick={() => setExamCurrentQIndex((prev) => Math.max(0, prev - 1))}
                  >
                    {en("Previous")}
                  </Button>

                  {examCurrentQIndex < examQuestions.length - 1 ? (
                    <Button onClick={() => setExamCurrentQIndex((prev) => prev + 1)}>
                      {en("Next question")}
                    </Button>
                  ) : (
                    <Button onClick={handleSubmitStage1} disabled={submittingStage}>
                      <span>{submittingStage ? en("Grading...") : en("Submit and continue to the coding task")}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Loading label={en("Loading exam questions...")} />
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* STAGE 2: CODING TASK                                 */}
        {/* ==================================================== */}
        {activeStage === 2 && (
          <div className="p-5 md:p-6 rounded-xl border border-border bg-card shadow-sm space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {en("Stage 2 of 3: Coding task")}
                </p>
                <h2 className="text-xl font-semibold text-foreground mt-0.5">
                  {bundle.sprintTitle}
                </h2>
              </div>
              <Badge>{bundle.requiredLanguage}</Badge>
            </div>

            <div className="p-4 rounded-lg bg-muted/40 border border-border text-sm leading-relaxed space-y-1.5">
              <h3 className="font-semibold text-foreground">{en("Problem statement")}</h3>
              <p className="text-muted-foreground">{bundle.problemStatement}</p>
            </div>

            {/* Code editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>solution.{bundle.requiredLanguage === "typescript" ? "ts" : "py"}</span>
                </span>
                <Button variant="secondary" onClick={handleRunTests} busy={runningTests}>
                  {!runningTests && <Play className="w-4 h-4" aria-hidden="true" />}
                  <span>{runningTests ? en("Running tests...") : en("Run tests")}</span>
                </Button>
              </div>

              <textarea
                rows={12}
                value={candidateCode}
                onChange={(e) => {
                  setCandidateCode(e.target.value);
                  saveDraft(e.target.value, examAnswers);
                }}
                className="w-full p-4 rounded-lg bg-neutral-950 text-neutral-100 font-mono text-xs border border-neutral-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
              />
            </div>

            {/* Output from the test run */}
            {executionConsole && (
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-xs font-mono space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                  <span className="flex items-center gap-1.5 text-neutral-400 text-xs">
                    <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{en("Output ({version})", { version: executionConsole.version })}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${executionConsole.success ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/50" : "bg-rose-950/60 text-rose-400 border border-rose-800/50"}`}>
                    {en("{durationMs}ms • {value}", { durationMs: executionConsole.durationMs, value: executionConsole.success ? en("Exit code 0") : en("Failed") })}
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

            {/* Test results */}
            {testResults && (
              <div className="p-4 rounded-lg border border-border space-y-2.5 animate-in fade-in duration-150">
                <h3 className="text-sm font-semibold text-foreground">{en("Test results")}</h3>
                <div className="space-y-2">
                  {testResults.map((tr, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-card border border-border text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        {tr.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-label="passed" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" aria-label="failed" />
                        )}
                        <span className="text-foreground">{tr.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{tr.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {en("Your last test run sets the sprint score.")}
                {typeof bundle.codeRunsRemaining === "number" && ` ${bundle.codeRunsRemaining} test runs left.`}
              </span>
              <Button onClick={handleSubmitStage2} disabled={submittingStage}>
                <span>{submittingStage ? en("Submitting...") : en("Submit and continue to the voice defense")}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STAGE 3: VOICE DEFENSE                               */}
        {/* ==================================================== */}
        {activeStage === 3 && (
          <div className="p-5 md:p-6 rounded-xl border border-border bg-card shadow-sm space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {en("Stage 3 of 3: Voice defense")}
                </p>
                <h2 className="text-xl font-semibold text-foreground mt-0.5">
                  {en("Explain your code")}
                </h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 font-mono text-sm font-semibold tabular-nums">
                <Mic className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <span>{Math.floor(defenseSeconds / 60)}:{(defenseSeconds % 60).toString().padStart(2, "0")}</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{en("Topic to discuss")}</h3>
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {en("“")}{bundle.defenseTopic}{en("”")}
              </p>
              <p className="text-sm text-muted-foreground">
                {en("An AI interviewer asks about the code you wrote in stage 2. Speak naturally, explain your trade-offs and how your code handles failures.")}
              </p>
            </div>

            {/* Microphone */}
            <div className="p-6 rounded-lg border border-border text-center space-y-3">
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-foreground" aria-live="polite">
                <span className={`h-2.5 w-2.5 rounded-full ${defenseActive ? "bg-red-600" : "bg-muted-foreground/40"}`} aria-hidden="true" />
                {defenseActive ? en("Microphone on") : en("Microphone off")}
              </p>
              <div className="flex items-center justify-center">
                <Button variant={defenseActive ? "secondary" : "primary"} onClick={() => setDefenseActive(!defenseActive)}>
                  <Mic className="w-4 h-4" aria-hidden="true" />
                  <span>{defenseActive ? en("Pause microphone") : en("Start speaking")}</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {defenseActive
                  ? en("Listening. What you say appears below as text.")
                  : en("Turn on your microphone and explain your approach out loud.")}
              </p>
            </div>

            {/* What the browser heard */}
            {spokenTranscript && (
              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-1 animate-in fade-in">
                <h3 className="text-sm font-semibold text-foreground">{en("What we heard")}</h3>
                <p className="text-sm text-foreground italic">{en("“")}{spokenTranscript}{en("”")}</p>
              </div>
            )}

            {/* Written notes */}
            <div className="space-y-2">
              <label htmlFor="defense-notes" className="text-sm font-medium text-foreground flex flex-wrap items-center justify-between gap-2">
                <span>{en("Written notes (optional)")}</span>
                <span className="text-xs text-muted-foreground font-normal">{en("Anything you want to add in writing to what you said")}</span>
              </label>
              <textarea
                id="defense-notes"
                value={candidateDefenseNotes}
                onChange={(e) => setCandidateDefenseNotes(e.target.value)}
                placeholder={en("Explain your approach, the trade-offs you made and the edge cases you handled...")}
                className="w-full h-24 p-3 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
              <span className="text-xs text-muted-foreground">{en("Graded on how well you explain your solution, trade-offs and edge cases. Accent, grammar and language never count.")}</span>
              <Button onClick={handleSubmitStage3} disabled={submittingStage}>
                <span>{submittingStage ? en("Finalizing...") : en("Finish the assessment")}</span>
              </Button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STAGE 4: COMPLETION (only real results are shown)   */}
        {/* ==================================================== */}
        {activeStage === 4 && (
          <div className="p-5 md:p-6 rounded-xl border border-border bg-card shadow-sm space-y-6">
            <div className="text-center space-y-2 pt-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 aria-hidden="true" className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground tracking-tight">{en("Assessment complete")}</h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                {en("Thank you{value}. Your answers are saved. {value2}", { value: bundle.candidateName ? `, ${bundle.candidateName.split(" ")[0]}` : "", value2: bundle.companyName ? `${bundle.companyName} reviews every assessment before any decision and will contact you.` : en("The hiring team reviews every assessment before any decision.") })}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: en("Stage 1: Written exam"), score: bundle.stage1Score },
                { label: en("Stage 2: Coding task"), score: bundle.stage2Score },
                { label: en("Stage 3: Defense"), score: bundle.stage3Score },
              ].map((st) => (
                <StatTile
                  key={st.label}
                  label={st.label}
                  value={st.score == null ? <span className="text-base font-medium text-muted-foreground">{en("Being reviewed")}</span> : `${Math.round(st.score * 10) / 10}%`}
                />
              ))}
            </div>

            <div className="p-5 rounded-lg border border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-sm text-muted-foreground block">{en("Overall score")}</span>
                {bundle.compositeScore == null ? (
                  <p className="mt-1 text-sm text-muted-foreground">{en("Calculated once every stage has been scored.")}</p>
                ) : (
                  <div className="text-3xl font-semibold text-foreground mt-0.5 tabular-nums">{bundle.compositeScore}%</div>
                )}
              </div>
              {bundle.certificateNumber && (
                <div className="sm:text-end">
                  <span className="text-xs text-muted-foreground block">{en("You earned a verifiable credential")}</span>
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
              <div className="p-3.5 rounded-lg border border-border space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground flex items-center gap-1">
                    <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{en("Credential seal (SHA-256)")}</span>
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(bundle.verificationSignatureSha256!);
                      setCopiedSignature(true);
                      setTimeout(() => setCopiedSignature(false), 2000);
                    }}
                    className="text-indigo-700 dark:text-indigo-300 hover:underline font-medium flex items-center gap-1"
                  >
                    {copiedSignature ? <Check aria-hidden="true" className="w-3 h-3 text-emerald-500" /> : <Copy aria-hidden="true" className="w-3 h-3" />}
                    <span>{copiedSignature ? en("Copied") : en("Copy")}</span>
                  </button>
                </div>
                <p className="font-mono text-xs text-muted-foreground break-all leading-tight">{bundle.verificationSignatureSha256}</p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {en("Keep this page's link private: it opens your assessment. To show your result to others, share the credential link instead.")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
