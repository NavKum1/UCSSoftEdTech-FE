"use client";

/**
 * Graded AI voice defense on OpenAI Realtime (6 Nov 2026: Vapi is no longer used). The browser sends its WebRTC offer to
 * POST /api/interview/start; the API opens the call with instructions built from the student's own work, joins it, keeps the
 * transcript and grades it when the call ends. Captions on screen are for the student only; the browser never sends a
 * transcript or holds a key.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Info,
  AlertTriangle,
  Volume2,
  Clock,
  Award,
  BookOpen,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, brandFill, buttonClass } from "@/components/career/ui";

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

export interface VoiceDefenseRoomProps {
  userId?: string;
  jobDescription?: string;
  selectedTenantId?: string;
  sprintSubmissionId?: string;
  repoDefenseId?: string;
  personaCode?: string;
  dialectCode?: string;
  // Key from GET /api/interview/languages; when omitted the student's campus preference (if any) or the server default is used
  language?: string;
  onResult?: (r: DefenseResult) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLeadReferralGenerated?: (recs: any[]) => void;
}

type CallStatus = "idle" | "connecting" | "active" | "finishing" | "ended";

interface StartResponse {
  sessionId: string;
  maxDurationSeconds: number;
  remainingMinutes: number;
  voice?: string;
  sdpAnswer?: string | null;
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

interface LanguageOption {
  key: string;
  label: string;
}

// The OpenAI Realtime events used for on-screen captions (current and older names)
interface RealtimeEvent {
  type?: string;
  transcript?: string;
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

export default function VoiceDefenseRoom({
  jobDescription,
  sprintSubmissionId,
  repoDefenseId,
  personaCode,
  dialectCode,
  language,
  onResult,
  onLeadReferralGenerated,
}: VoiceDefenseRoomProps) {
  const en = useEn();
  const { getToken, isLoaded } = useAuth();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const meterRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);
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
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState(language ?? "");
  // Build & Defend pilot 1.7 (6 Nov 2026): when voice doesn't work, the student can answer in writing (reviewers see it was typed)
  const router = useRouter();
  const [typedBusy, setTypedBusy] = useState(false);
  const [typedError, setTypedError] = useState<string | null>(null);
  const [voiceTrouble, setVoiceTrouble] = useState(false);
  const answerInWriting = async () => {
    if (!sprintSubmissionId) return;
    setTypedBusy(true);
    setTypedError(null);
    try {
      const res = await authenticatedFetch(
        "/api/written-defense/start",
        { method: "POST", body: JSON.stringify({ sprintSubmissionId, afterVoiceProblem: true }) },
        getToken
      );
      const body = (await res.json().catch(() => null)) as { sessionId?: string; error?: string } | null;
      if (!res.ok || !body?.sessionId) {
        setTypedError(body?.error ?? en("We couldn't start the written defense. Please try again."));
        return;
      }
      router.push(`/written-defense/${body.sessionId}`);
    } catch {
      setTypedError(en("We couldn't reach the server. Please check your connection and try again."));
    } finally {
      setTypedBusy(false);
    }
  };
  const languageTouchedRef = useRef(Boolean(language));

  // Languages offered for the defense; default to the prop, else the student's campus preference, else the server default
  useEffect(() => {
    if (!isLoaded) return; // H7: /api/interview/languages needs the token, which exists once auth has loaded
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch("/api/interview/languages", {}, getToken);
        if (!res.ok || cancelled) return;
        const data = await readJson<{ defaultLanguage?: string; languages?: LanguageOption[] }>(res);
        if (!data?.languages || cancelled) return;
        setLanguages(data.languages);
        let preferred: string | null = null;
        if (!languageTouchedRef.current) {
          try {
            const prefRes = await authenticatedFetch("/api/campus/my-preferences", {}, getToken);
            if (prefRes.ok) preferred = (await readJson<{ preferredLanguage?: string | null }>(prefRes))?.preferredLanguage ?? null;
          } catch {
            // no campus preference available
          }
        }
        if (cancelled || languageTouchedRef.current) return;
        const known = (key: string | null | undefined) => (key && data.languages!.some((l) => l.key === key) ? key : null);
        setSelectedLanguage(known(preferred) ?? known(data.defaultLanguage) ?? data.languages[0]?.key ?? "");
      } catch {
        // language list is optional; the server default applies
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Ends our side of the call: the server notices and grades what it kept
  const closeConnection = useCallback(() => {
    if (meterRef.current) {
      cancelAnimationFrame(meterRef.current.raf);
      void meterRef.current.ctx.close().catch(() => undefined);
      meterRef.current = null;
    }
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setVolumeLevel(0);
  }, []);

  // The interviewer's loudness, for the wave
  const watchVolume = (stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
        if (meterRef.current) meterRef.current.raf = requestAnimationFrame(tick);
      };
      meterRef.current = { ctx, raf: requestAnimationFrame(tick) };
    } catch {
      // the wave is decoration; the call works without it
    }
  };

  useEffect(() => {
    return () => {
      // Leaving the page mid-call: hang up; the server grades the call when it ends
      const session = sessionRef.current;
      closeConnection();
      if (session && !session.completing && session.connected) {
        void authenticatedFetch(`/api/interview/${session.id}/complete`, { method: "POST", body: "{}" }, getToken).catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const requestMicrophoneAccess = async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      setMicPermission("granted");
      return stream;
    } catch {
      setMicPermission("denied");
      setStatusMessage("Microphone permission denied. Please enable microphone access in your browser.");
      return null;
    }
  };

  const handleStartInterview = async () => {
    setIsLoading(true);
    setUpgradePrompt(null);
    setResult(null);
    setStatusMessage("Preparing your defense room...");

    const mic = await requestMicrophoneAccess();
    if (!mic) {
      setIsLoading(false);
      return;
    }
    micRef.current = mic;

    try {
      if (typeof RTCPeerConnection === "undefined") throw new Error("This browser can't make voice calls. Answer in writing instead.");
      // The voice connection: the student's microphone out, the interviewer's voice in, captions on a data channel
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));
      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0];
          void audioRef.current.play().catch(() => undefined);
        }
        watchVolume(e.streams[0]);
      };
      const dc = pc.createDataChannel("oai-events");
      dc.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as RealtimeEvent;
          const said = msg.transcript?.trim();
          if (!said) return;
          let role: TranscriptLine["role"] | null = null;
          if (msg.type === "conversation.item.input_audio_transcription.completed") role = "Candidate";
          else if (msg.type === "response.output_audio_transcript.done" || msg.type === "response.audio_transcript.done") role = "AI Interviewer";
          if (!role) return;
          transcriptRef.current = [...transcriptRef.current, { role, text: said }];
          setTranscripts(transcriptRef.current);
        } catch {
          // captions are optional
        }
      };
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        const session = sessionRef.current;
        if (state === "connected" && session && !session.connected) {
          session.connected = true;
          setCallStatus("active");
          setCallStartedAt(Date.now());
          setStatusMessage("Connected. The interviewer will begin shortly.");
        } else if (state === "failed" || state === "disconnected" || state === "closed") {
          if (pcRef.current !== pc) return; // we closed it ourselves
          if (state === "failed" && !session?.connected) setVoiceTrouble(true);
          closeConnection();
          setCallStartedAt(null);
          void finalizeRef.current();
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await authenticatedFetch(
        "/api/interview/start",
        {
          method: "POST",
          body: JSON.stringify({
            jobDescription,
            sprintSubmissionId,
            repoDefenseId,
            personaCode,
            dialectCode,
            language: selectedLanguage || language || undefined,
            sdpOffer: offer.sdp,
          }),
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
        throw new Error(err?.error || err?.message || "The defense couldn't start. Please try again in a moment.");
      }

      const data = await readJson<StartResponse>(res);
      if (!data?.sessionId || !data.sdpAnswer) throw new Error("The session couldn't be set up. Please try again.");

      sessionRef.current = { id: data.sessionId, resultsVia: data.resultsVia ?? "server", completing: false, connected: false };
      transcriptRef.current = [];
      setTranscripts([]);
      setRemainingMinutes(data.remainingMinutes);
      setSessionCapSeconds(data.maxDurationSeconds);
      setCallStatus("connecting");
      setStatusMessage("Joining room...");

      await pc.setRemoteDescription({ type: "answer", sdp: data.sdpAnswer });
    } catch (err) {
      sessionRef.current = null;
      closeConnection();
      setVoiceTrouble(true);
      setCallStatus("idle");
      setStatusMessage(err instanceof Error && err.message ? `Could not start the defense. ${err.message}` : "Could not start the defense. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    if (callStatus === "active") micRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setIsMuted(next);
  };

  const handleEndCall = async () => {
    setStatusMessage("Ending call...");
    closeConnection();
    setCallStartedAt(null);
    void finalizeRef.current();
  };

  const elapsedSeconds = callStartedAt !== null ? Math.max(0, (now - callStartedAt) / 1000) : 0;
  const inCall = callStatus === "connecting" || callStatus === "active";
  const showRecommendations =
    result?.status === "evaluated" &&
    (result.recommendations?.length ?? 0) > 0 &&
    (result.technicalScore ?? 100) <= RECOMMENDATION_SCORE_THRESHOLD;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
      <audio ref={audioRef} autoPlay className="hidden" />
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{en("AI voice defense")}</h2>
            <p className="text-sm text-muted-foreground">{en("Graded by the server from the recorded call")}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(remainingMinutes !== null || sessionCapSeconds !== null) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border bg-muted text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {remainingMinutes !== null && <span>{en("{remainingMinutes} min left", { remainingMinutes })}</span>}
              {remainingMinutes !== null && sessionCapSeconds !== null && <span>·</span>}
              {sessionCapSeconds !== null && <span>{en("{value} min max this session", { value: Math.floor(sessionCapSeconds / 60) })}</span>}
            </span>
          )}
          <Badge tone={callStatus === "active" ? "good" : callStatus === "connecting" || callStatus === "finishing" ? "warn" : "neutral"}>
            {callStatus.charAt(0).toUpperCase() + callStatus.slice(1)}
          </Badge>
        </div>
      </div>

      <div className="my-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 rounded-xl p-5 flex flex-col justify-between border border-border bg-card">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">{en("Microphone")}</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {en("Status: ")}<span className="font-medium text-foreground">{micPermission}</span>
            </p>

            <div className="h-24 bg-muted/40 rounded-lg border border-border flex flex-col items-center justify-center space-y-2 px-4">
              {callStatus === "active" ? (
                <>
                  <div className="flex items-center space-x-1.5 h-10">
                    {[35, 75, 45, 90, 60, 85, 40, 95, 70, 50].map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-indigo-500 rounded-full wave-bar"
                        style={{ animationDelay: `${i * 0.1}s`, height: `${Math.max(15, (h * (volumeLevel || 50)) / 100)}%` }}
                      ></div>
                    ))}
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-emerald-700 dark:text-emerald-400">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>
                      {formatClock(elapsedSeconds)}
                      {sessionCapSeconds !== null && ` / ${formatClock(sessionCapSeconds)}`}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">{en("Microphone idle")}</span>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {languages.length > 1 && (
              <label className="block text-sm font-medium text-foreground">
                {en("Conversation language")}
                <select
                  value={selectedLanguage}
                  onChange={(e) => {
                    languageTouchedRef.current = true;
                    setSelectedLanguage(e.target.value);
                  }}
                  disabled={inCall || callStatus === "finishing" || isLoading}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground disabled:opacity-60"
                >
                  {languages.map((l) => (
                    <option key={l.key} value={l.key}>{l.label}</option>
                  ))}
                </select>
              </label>
            )}
            {!inCall && callStatus !== "finishing" ? (
              <Button
                onClick={handleStartInterview}
                disabled={isLoading}
                className="h-10 w-full"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                <span>{isLoading ? en("Starting...") : callStatus === "ended" ? en("Start another defense") : en("Start defense")}</span>
              </Button>
            ) : callStatus === "finishing" ? (
              <div className="w-full py-3 px-4 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-medium flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{en("Evaluating...")}</span>
              </div>
            ) : (
              <div className="flex space-x-2">
                <Button
                  variant="secondary"
                  onClick={toggleMute}
                  className={`h-10 flex-1 ${isMuted ? "ring-1 ring-amber-500" : ""}`}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isMuted ? en("Muted") : en("Mute")}</span>
                </Button>
                <Button
                  variant="danger"
                  onClick={handleEndCall}
                  className="h-10 flex-1"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>{en("End call")}</span>
                </Button>
              </div>
            )}
            {sprintSubmissionId && !inCall && callStatus !== "finishing" && !result && (
              <div className={`mt-3 rounded-lg p-3 text-xs ${voiceTrouble || micPermission === "denied" ? "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200" : "text-muted-foreground"}`}>
                <p>
                  {voiceTrouble || micPermission === "denied"
                    ? en("Voice isn't working here. You can answer the same questions in writing instead; your reviewer will see that you typed them.")
                    : en("Microphone or connection trouble? You can answer in writing instead; your reviewer will see that you typed it.")}
                </p>
                <Button variant="secondary" onClick={answerInWriting} busy={typedBusy} className="mt-2 h-9 w-full">
                  {en("Answer in writing instead")}
                </Button>
                {typedError && <p role="alert" className="mt-2 text-red-700 dark:text-red-400">{typedError}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 rounded-xl p-5 flex flex-col border border-border bg-card min-h-[220px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{en("Live transcript")}</h3>
            <span className="text-xs text-muted-foreground">{transcripts.length} messages</span>
          </div>

          <div className="flex-1 bg-background rounded-lg p-4 border border-border overflow-y-auto max-h-[200px] space-y-3">
            {transcripts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
                {en("The transcript appears here once the call starts.")}
              </div>
            ) : (
              transcripts.map((t, idx) => (
                <div key={idx} className={`flex flex-col ${t.role === "Candidate" ? "items-end" : "items-start"}`}>
                  <span className="text-xs text-muted-foreground mb-0.5 font-medium">{t.role}</span>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                      t.role === "Candidate"
                        ? "bg-indigo-600 text-white rounded-se-none"
                        : "bg-muted text-foreground border border-border rounded-ss-none"
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
                  {en("Your monthly minutes reset on {date}.", { date: new Date(upgradePrompt.usageResetsAt).toLocaleDateString() })}</p>
              )}
            </div>
          </div>
          <Link
            href="/pricing"
            className={`${buttonClass("primary")} shrink-0`}
            style={brandFill}
          >
            {en("See plans and top-ups")}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {statusMessage && (
        <div role="status" className="mt-4 p-3 bg-muted/50 border border-border rounded-lg text-sm text-foreground flex items-center space-x-2">
          <Info className="w-4 h-4 text-indigo-700 dark:text-indigo-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {result?.status === "evaluated" && (
        <div className="mt-6 p-5 bg-card border border-border rounded-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-foreground">{en("Defense evaluation")}</h4>
            <div className="flex flex-wrap gap-2">
              {typeof result.technicalScore === "number" && (
                <span className="text-sm font-semibold tabular-nums text-foreground bg-muted px-3 py-1 rounded-lg border border-border">
                  {en("Technical: {technicalScore}%", { technicalScore: Math.round(result.technicalScore) })}</span>
              )}
              {typeof result.communicationScore === "number" && (
                <span className="text-sm font-semibold tabular-nums text-foreground bg-muted px-3 py-1 rounded-lg border border-border">
                  {en("Communication: {communicationScore}%", { communicationScore: Math.round(result.communicationScore) })}</span>
              )}
            </div>
          </div>

          {result.missingSkills && result.missingSkills.length > 0 ? (
            <div>
              <p className="text-xs text-muted-foreground mb-2">{en("Areas to strengthen:")}</p>
              <div className="flex flex-wrap gap-2">
                {result.missingSkills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{en("No skill gaps identified.")}</p>
          )}

          {result.credentialIssued && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Award className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span className="text-foreground font-medium">
                {result.credentialUnderReview ? en("Credential issued — pending integrity review.") : en("Credential issued.")}
              </span>
              {result.publicUrlSlug && (
                <Link href={`/credential/${result.publicUrlSlug}`} className="text-indigo-700 dark:text-indigo-400 font-semibold hover:underline">
                  {en("View credential")}
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
              {en("Learning recommendations")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
