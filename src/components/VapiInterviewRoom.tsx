"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Vapi from "@vapi-ai/web";
import { useAuth } from "@clerk/nextjs";
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Sparkles,
  AlertTriangle,
  Volume2,
  Clock,
  Award,
  BookOpen,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";

export interface DefenseRecommendation {
  courseId: string;
  courseName: string;
  instituteName: string;
  matchedSkills: string[];
  sponsored: boolean;
  referralId?: string;
}

export interface DefenseResult {
  status: "evaluated" | "processing" | "evaluation-unavailable";
  technicalScore?: number;
  communicationScore?: number;
  missingSkills?: string[];
  credentialIssued?: boolean;
  publicUrlSlug?: string;
  credentialUnderReview?: boolean;
  recommendations?: DefenseRecommendation[];
}

export interface VapiInterviewRoomProps {
  userId?: string;
  jobDescription?: string;
  selectedTenantId?: string;
  sprintSubmissionId?: string;
  repoDefenseId?: string;
  personaCode?: string;
  dialectCode?: string;
  onResult?: (r: DefenseResult) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLeadReferralGenerated?: (recs: any[]) => void;
}

type VapiAssistant = Parameters<Vapi["start"]>[0];
type CallStatus = "idle" | "connecting" | "active" | "finishing" | "ended";

interface StartResponse {
  sessionId: string;
  maxDurationSeconds: number;
  remainingMinutes: number;
  assistant: unknown;
  resultsVia?: string;
}

interface ActiveSession {
  id: string;
  resultsVia: string;
  completing: boolean;
  connected: boolean;
}

interface TranscriptLine {
  role: "Candidate" | "AI Interviewer";
  text: string;
}

interface UpgradePrompt {
  message: string;
  usageResetsAt?: string;
}

interface VapiMessage {
  type?: string;
  transcriptType?: string;
  transcript?: string;
  role?: string;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;
const RECOMMENDATION_SCORE_THRESHOLD = 70;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function VapiInterviewRoom({
  jobDescription,
  sprintSubmissionId,
  repoDefenseId,
  personaCode,
  dialectCode,
  onResult,
  onLeadReferralGenerated,
}: VapiInterviewRoomProps) {
  const { getToken } = useAuth();

  const vapiRef = useRef<Vapi | null>(null);
  const sessionRef = useRef<ActiveSession | null>(null);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const mountedRef = useRef(true);
  const finalizeRef = useRef<() => Promise<void>>(async () => {});

  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [micPermission, setMicPermission] = useState<"prompt" | "granted" | "denied">("prompt");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready to begin your defense.");
  const [result, setResult] = useState<DefenseResult | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePrompt | null>(null);
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);
  const [sessionCapSeconds, setSessionCapSeconds] = useState<number | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let vapiInstance: Vapi | null = null;
    try {
      vapiInstance = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "");
    } catch (e) {
      console.warn("Vapi SDK could not be initialised:", e);
      return;
    }
    vapiRef.current = vapiInstance;

    vapiInstance.on("call-start", () => {
      if (sessionRef.current) sessionRef.current.connected = true;
      setCallStatus("active");
      setCallStartedAt(Date.now());
      setStatusMessage("Connected. The interviewer will begin shortly.");
    });

    vapiInstance.on("call-end", () => {
      setVolumeLevel(0);
      setCallStartedAt(null);
      void finalizeRef.current();
    });

    vapiInstance.on("volume-level", (volume: number) => {
      setVolumeLevel(Math.min(100, Math.round(volume * 100)));
    });

    vapiInstance.on("message", (message: VapiMessage) => {
      if (message?.type === "transcript" && message.transcriptType === "final" && message.transcript) {
        const line: TranscriptLine = {
          role: message.role === "user" ? "Candidate" : "AI Interviewer",
          text: message.transcript,
        };
        transcriptRef.current = [...transcriptRef.current, line];
        setTranscripts(transcriptRef.current);
      }
    });

    vapiInstance.on("error", (err: unknown) => {
      console.warn("Vapi SDK error:", err);
    });

    return () => {
      const instance = vapiInstance;
      if (!instance) return;
      instance.removeAllListeners();
      if (sessionRef.current && !sessionRef.current.completing) {
        void instance.stop().catch(() => undefined);
      }
      if (vapiRef.current === instance) vapiRef.current = null;
    };
  }, []);

  // Show the user's balance before they start
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch("/api/billing/usage", {}, getToken);
        if (!res.ok || cancelled) return;
        const usage = await readJson<{ remainingMinutes: number; maxSessionMinutes: number }>(res);
        if (!usage || cancelled) return;
        setRemainingMinutes(usage.remainingMinutes);
        setSessionCapSeconds((prev) => prev ?? usage.maxSessionMinutes * 60);
      } catch {
        // usage is informational only
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  useEffect(() => {
    if (callStatus !== "active" || callStartedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [callStatus, callStartedAt]);

  const applyResult = useCallback(
    (data: DefenseResult) => {
      setResult(data);
      onResult?.(data);
      if (data.recommendations && data.recommendations.length > 0) {
        onLeadReferralGenerated?.(data.recommendations);
      }
      if (data.status === "evaluated") {
        setStatusMessage("Evaluation complete.");
      } else if (data.status === "evaluation-unavailable") {
        setStatusMessage("Your defense was recorded; scoring is delayed — we'll email you.");
      } else {
        setStatusMessage("Your defense was recorded and is still being evaluated. Check back shortly — we'll also email you.");
      }
    },
    [onResult, onLeadReferralGenerated]
  );

  const finalize = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || session.completing) return;
    session.completing = true;

    if (!session.connected) {
      sessionRef.current = null;
      setCallStatus("idle");
      setStatusMessage("The call did not connect. Please try again.");
      return;
    }

    setCallStatus("finishing");
    setIsLoading(true);
    setStatusMessage("Call ended. Retrieving your evaluation...");

    try {
      const body: { transcript?: string } = {};
      if (session.resultsVia.startsWith("client-complete")) {
        body.transcript = transcriptRef.current.map((t) => `${t.role}: ${t.text}`).join("\n");
      }

      const res = await authenticatedFetch(
        `/api/interview/${session.id}/complete`,
        { method: "POST", body: JSON.stringify(body) },
        getToken
      );
      if (!res.ok) throw new Error(`Completion failed (HTTP ${res.status})`);
      let data = await readJson<DefenseResult>(res);
      if (!data) throw new Error("Empty completion response");

      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (data.status === "processing" && Date.now() < deadline && mountedRef.current) {
        await sleep(POLL_INTERVAL_MS);
        try {
          const pollRes = await authenticatedFetch(`/api/interview/${session.id}/result`, {}, getToken);
          if (pollRes.ok) {
            const next = await readJson<DefenseResult>(pollRes);
            if (next) data = next;
          }
        } catch {
          // transient network error; keep polling until the deadline
        }
      }

      if (!mountedRef.current) return;
      applyResult(data);
    } catch (err) {
      console.error("Defense completion error:", err);
      if (mountedRef.current) {
        setStatusMessage("Your defense was recorded, but we couldn't load the result right now. We'll email you when it's ready.");
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setCallStatus("ended");
      }
    }
  }, [applyResult, getToken]);

  useEffect(() => {
    finalizeRef.current = finalize;
  }, [finalize]);

  const requestMicrophoneAccess = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermission("granted");
      return true;
    } catch {
      setMicPermission("denied");
      setStatusMessage("Microphone permission denied. Please enable microphone access in your browser.");
      return false;
    }
  };

  const handleStartInterview = async () => {
    setIsLoading(true);
    setUpgradePrompt(null);
    setResult(null);
    setStatusMessage("Preparing your defense room...");

    if (!(await requestMicrophoneAccess())) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await authenticatedFetch(
        "/api/interview/start",
        {
          method: "POST",
          body: JSON.stringify({ jobDescription, sprintSubmissionId, repoDefenseId, personaCode, dialectCode }),
        },
        getToken
      );

      if (!res.ok) {
        const err = await readJson<{ error?: string; message?: string; requiresUpgrade?: boolean; usageResetsAt?: string; remainingMinutes?: number }>(res);
        if (res.status === 403 && err?.requiresUpgrade) {
          setUpgradePrompt({
            message: err.message || "You have no voice-defense minutes left this period.",
            usageResetsAt: err.usageResetsAt,
          });
          if (typeof err.remainingMinutes === "number") setRemainingMinutes(err.remainingMinutes);
          setStatusMessage("Voice minutes exhausted.");
          return;
        }
        if (res.status === 401) throw new Error("Please sign in to start a defense.");
        throw new Error(err?.error || err?.message || `Server returned ${res.status}`);
      }

      const data = await readJson<StartResponse>(res);
      if (!data?.sessionId || !data.assistant) throw new Error("The server did not return a session.");

      const vapi = vapiRef.current;
      if (!vapi) throw new Error("Voice client is unavailable in this browser.");

      sessionRef.current = { id: data.sessionId, resultsVia: data.resultsVia ?? "vapi-webhook", completing: false, connected: false };
      transcriptRef.current = [];
      setTranscripts([]);
      setRemainingMinutes(data.remainingMinutes);
      setSessionCapSeconds(data.maxDurationSeconds);
      setCallStatus("connecting");
      setStatusMessage("Joining room...");

      const call = await vapi.start(data.assistant as VapiAssistant);
      if (!call?.id) {
        sessionRef.current = null;
        setCallStatus("idle");
        setStatusMessage("Could not connect the voice call. Please check your connection and try again.");
        return;
      }

      const bindRes = await authenticatedFetch(
        `/api/interview/${data.sessionId}/bind-call`,
        { method: "POST", body: JSON.stringify({ vapiCallId: call.id }) },
        getToken
      ).catch(() => null);
      if (!bindRes?.ok) console.warn("bind-call did not succeed; relying on assistant metadata to match the call.");
    } catch (err) {
      sessionRef.current = null;
      setCallStatus("idle");
      setStatusMessage(`Could not start the defense: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    if (vapiRef.current && callStatus === "active") {
      try {
        vapiRef.current.setMuted(next);
      } catch (e) {
        console.warn("Mute failed:", e);
      }
    }
    setIsMuted(next);
  };

  const handleEndCall = async () => {
    setStatusMessage("Ending call...");
    try {
      await vapiRef.current?.stop();
    } catch (e) {
      console.warn("Vapi stop failed:", e);
    }
    // call-end normally triggers finalize; this covers the case where it never fires
    void finalizeRef.current();
  };

  const elapsedSeconds = callStartedAt !== null ? Math.max(0, (now - callStartedAt) / 1000) : 0;
  const inCall = callStatus === "connecting" || callStatus === "active";
  const showRecommendations =
    result?.status === "evaluated" &&
    (result.recommendations?.length ?? 0) > 0 &&
    (result.technicalScore ?? 100) <= RECOMMENDATION_SCORE_THRESHOLD;

  return (
    <div className="glass-panel rounded-2xl p-6 border border-border relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-700 dark:text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">AI Voice Defense</h2>
            <p className="text-xs text-muted-foreground">Graded by the server from the recorded call</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(remainingMinutes !== null || sessionCapSeconds !== null) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border bg-muted text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {remainingMinutes !== null && <span>{remainingMinutes} min left</span>}
              {remainingMinutes !== null && sessionCapSeconds !== null && <span>·</span>}
              {sessionCapSeconds !== null && <span>{Math.floor(sessionCapSeconds / 60)} min max this session</span>}
            </span>
          )}
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
              callStatus === "active"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                : callStatus === "connecting" || callStatus === "finishing"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  : callStatus === "ended"
                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30"
                    : "bg-muted text-muted-foreground border-border"
            }`}
          >
            <span className={`w-2 h-2 rounded-full mr-2 ${callStatus === "active" ? "bg-emerald-400 animate-ping" : "bg-slate-500"}`}></span>
            {callStatus.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="my-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 glass-card rounded-xl p-5 flex flex-col justify-between border border-border">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Microphone</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Status: <span className="font-semibold text-indigo-700 dark:text-indigo-400">{micPermission}</span>
            </p>

            <div className="h-24 bg-card/90 rounded-xl border border-border flex flex-col items-center justify-center space-y-2 px-4">
              {callStatus === "active" ? (
                <>
                  <div className="flex items-center space-x-1.5 h-10">
                    {[35, 75, 45, 90, 60, 85, 40, 95, 70, 50].map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-gradient-to-t from-indigo-500 to-purple-400 rounded-full wave-bar"
                        style={{ animationDelay: `${i * 0.1}s`, height: `${Math.max(15, (h * (volumeLevel || 50)) / 100)}%` }}
                      ></div>
                    ))}
                  </div>
                  <div className="flex items-center space-x-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>
                      {formatClock(elapsedSeconds)}
                      {sessionCapSeconds !== null && ` / ${formatClock(sessionCapSeconds)}`}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Microphone idle</span>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {!inCall && callStatus !== "finishing" ? (
              <button
                onClick={handleStartInterview}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2 transition-all duration-200 cursor-pointer"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                <span>{isLoading ? "Starting..." : callStatus === "ended" ? "Start Another Defense" : "Start Defense"}</span>
              </button>
            ) : callStatus === "finishing" ? (
              <div className="w-full py-3 px-4 rounded-xl border border-border bg-muted text-muted-foreground text-xs font-medium flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Evaluating...</span>
              </div>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={toggleMute}
                  className={`flex-1 py-3 px-3 rounded-xl border text-xs font-medium flex items-center justify-center space-x-1.5 cursor-pointer ${
                    isMuted
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                  }`}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isMuted ? "Muted" : "Mute Mic"}</span>
                </button>
                <button
                  onClick={handleEndCall}
                  className="flex-1 py-3 px-3 bg-red-600/90 hover:bg-red-500 text-white rounded-xl text-xs font-medium flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Call</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 glass-card rounded-xl p-5 flex flex-col border border-border min-h-[220px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Live Transcript</h3>
            <span className="text-xs text-muted-foreground">{transcripts.length} messages</span>
          </div>

          <div className="flex-1 bg-background/80 rounded-xl p-4 border border-border overflow-y-auto max-h-[200px] space-y-3">
            {transcripts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
                The transcript appears here once the call starts.
              </div>
            ) : (
              transcripts.map((t, idx) => (
                <div key={idx} className={`flex flex-col ${t.role === "Candidate" ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-muted-foreground mb-0.5 font-medium">{t.role}</span>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                      t.role === "Candidate"
                        ? "bg-indigo-600 text-white rounded-tr-none"
                        : "bg-muted text-foreground border border-border rounded-tl-none"
                    }`}
                  >
                    {t.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {upgradePrompt && (
        <div className="mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{upgradePrompt.message}</p>
              {upgradePrompt.usageResetsAt && (
                <p className="mt-0.5 text-amber-800/80 dark:text-amber-200/80">
                  Your monthly minutes reset on {new Date(upgradePrompt.usageResetsAt).toLocaleDateString()}.
                </p>
              )}
            </div>
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0"
          >
            See plans &amp; top-ups
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {statusMessage && (
        <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 rounded-xl text-xs text-indigo-800 dark:text-indigo-300 flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-indigo-700 dark:text-indigo-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {result?.status === "evaluated" && (
        <div className="mt-6 p-5 bg-card border border-border rounded-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-foreground">Defense Evaluation</h4>
            <div className="flex flex-wrap gap-2">
              {typeof result.technicalScore === "number" && (
                <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20">
                  Technical: {Math.round(result.technicalScore)}%
                </span>
              )}
              {typeof result.communicationScore === "number" && (
                <span className="text-sm font-bold text-purple-700 dark:text-purple-400 bg-purple-500/10 px-3 py-1 rounded-lg border border-purple-500/20">
                  Communication: {Math.round(result.communicationScore)}%
                </span>
              )}
            </div>
          </div>

          {result.missingSkills && result.missingSkills.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Areas to strengthen:</p>
              <div className="flex flex-wrap gap-2">
                {result.missingSkills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">No skill gaps identified.</p>
          )}

          {result.credentialIssued && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Award className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span className="text-foreground font-medium">
                {result.credentialUnderReview ? "Credential issued — pending integrity review." : "Credential issued."}
              </span>
              {result.publicUrlSlug && (
                <Link href={`/credential/${result.publicUrlSlug}`} className="text-indigo-700 dark:text-indigo-400 font-semibold hover:underline">
                  View credential
                </Link>
              )}
            </div>
          )}

          {showRecommendations && (
            <Link
              href="/referrals"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Learning recommendations
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
