"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  Award,
  AlertTriangle,
  Play,
  Compass,
  Copy,
  Check,
  Trash2,
  MessageSquare,
  User,
  Bot
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CancellationQuizModal } from "@/components/CancellationQuizModal";
import JobPicker, { type PickedJob } from "@/components/interview/JobPicker";
import PrivacyPreview from "@/components/interview/PrivacyPreview";
import LibraryPicker from "@/components/resumes/LibraryPicker";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, PageHeader, buttonClass } from "@/components/career/ui";
import { openRealtimeCall, type RealtimeCall, type RealtimeEvent } from "@/lib/realtimeCall";

interface TranscriptMessage {
  id: string;
  role: "interviewer" | "candidate";
  text: string;
  timestamp: string;
  isFinal?: boolean;
}

// A practice interview the server opened (12 Nov 2026: billed by the minutes used)
interface PracticeCall {
  id: string;
  finishing: boolean;
  ending?: Promise<PracticeEndResult | null>;
}

// POST /api/interview/practice/{id}/end: what the server measured, and the transcript it kept
interface PracticeEndResult {
  status: "ended" | "no-answers" | "not-connected" | "stopped" | "lost" | "ending";
  heldMinutes: number;
  minutesUsed: number;
  minutesGivenBack: number;
  message?: string | null;
  transcript: { role: "interviewer" | "candidate"; text: string }[];
  remainingMinutes: number;
}

// The parts of the Web Speech API this page uses (not in TypeScript's DOM lib), and the prefixed browser globals.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string } | undefined;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type BrowserSpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  webkitAudioContext?: typeof AudioContext;
};

// B2 (18 Nov 2026): what the person practices for, from GET /api/interview/careers
interface Career {
  id: string;
  kind: "career" | "admissions" | "scholarship" | "visa";
  name: string;
  roles: string[];
  dimensions: { key: string; name: string; good: string }[];
}

// 19 Nov 2026 (interview coaching): the rounds of a real hiring process, for jobs. en() where shown.
const ROUNDS = [
  { id: "screening", label: "Screening call", description: "A short first call: your background, why this job, and what you expect." },
  { id: "behavioral", label: "Behavioral", description: "Real situations from your past: what happened, what you did, and the result." },
  { id: "hiring-manager", label: "Hiring manager", description: "Deeper questions about the job's own tasks and the judgment it needs." },
];

// A job's top tasks, for "What this interview tests"
interface JobDetail {
  code: string;
  title: string;
  tasks: { text: string }[];
}

// The person's saved interviews (GET /api/interview/practice/sessions)
interface SessionItem {
  id: string;
  careerName?: string;
  jobTitle: string;
  roundName?: string | null;
  createdAt: string;
  coachedAt?: string | null;
  status?: string | null;
  deletesOn?: string | null;
}

interface KeepInfo {
  planDays: number;
  choice: number | null;
  choices: number[];
}

// How the interviewer behaves; the career gives the questions. en() where shown.
const STYLES = [
  { id: "supportive", label: "Supportive", description: "Gives you hints when you're stuck and points out what went well." },
  { id: "standard", label: "Standard", description: "Like a typical real interview: friendly, with a follow-up when an answer is vague." },
  { id: "demanding", label: "Demanding", description: "Pushes back on vague answers and asks for specific examples and results." },
];

// The scorecard's plain results. en() where shown.
const RESULTS: Record<string, { label: string; tone: "good" | "warn" | "bad" }> = {
  strong: { label: "Strong", tone: "good" },
  "interview-ready": { label: "Interview-ready", tone: "good" },
  "getting-there": { label: "Getting there", tone: "warn" },
  "keep-practicing": { label: "Keep practicing", tone: "bad" },
  "not-enough": { label: "Not enough to score", tone: "bad" },
};

const VOICES = [
  { id: "verse", label: "Verse (Dynamic & Natural)" },
  { id: "alloy", label: "Alloy (Neutral & Balanced)" },
  { id: "echo", label: "Echo (Warm & Authoritative)" },
  { id: "shimmer", label: "Shimmer (Expressive & Clear)" },
  { id: "coral", label: "Coral (Energetic & Friendly)" }
];

export default function MultiStreamInterviewPracticePage() {
  const en = useEn();
  const { apiFetch, access, ready } = useLegacyApi();
  const [careers, setCareers] = useState<Career[]>([]);
  const [jobTitle, setJobTitle] = useState<string>("");
  const [jobDescription, setJobDescription] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<string>("verse");
  const [selectedStyle, setSelectedStyle] = useState<string>("standard");
  const candidateName = en("You");
  const router = useRouter();
  // 19 Nov 2026: a job from the job library (or the person's own title), the round, their résumé, lines they left out
  const [job, setJob] = useState<PickedJob | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [round, setRound] = useState<string>("behavioral");
  const [resumeVersionId, setResumeVersionId] = useState<string | null>(null);
  const [removedLines, setRemovedLines] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [keep, setKeep] = useState<KeepInfo | null>(null);
  const [credits, setCredits] = useState<string[]>([]);
  // "job" for a job interview; otherwise admissions, scholarship or visa
  const [practiceFor, setPracticeFor] = useState<string>("job");
  const isJob = practiceFor === "job";
  const career = (isJob ? careers.find((c) => c.id === (job?.family ?? "general")) : careers.find((c) => c.id === practiceFor)) ?? null;

  // Session state
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [aiStatus, setAiStatus] = useState<"connecting" | "speaking" | "listening" | "idle">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  // The call's length limit (the minutes set aside for it), from the server
  const [maxSeconds, setMaxSeconds] = useState<number | null>(null);
  // The longest interview, for the note before starting
  const [sessionCapMinutes, setSessionCapMinutes] = useState<number | null>(null);

  // Live Speech-to-Text Transcript Feed State
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [currentAiInterim, setCurrentAiInterim] = useState<string>("");
  const [currentCandidateInterim, setCurrentCandidateInterim] = useState<string>("");
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedTranscript, setCopiedTranscript] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  // An interview that ended without a score (no answers, interrupted): what the server said
  const [endNotice, setEndNotice] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState<string | null>(null);

  // Cancellation modal
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);

  // Call & audio refs
  const callRef = useRef<RealtimeCall | null>(null);
  const practiceRef = useRef<PracticeCall | null>(null);
  const transcriptsRef = useRef<TranscriptMessage[]>([]);
  const sessionActiveRef = useRef<boolean>(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const transcriptFeedRef = useRef<HTMLDivElement | null>(null);


  // Auto-scroll transcript container
  useEffect(() => {
    const feed = transcriptFeedRef.current;
    if (!autoScroll || !feed) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    feed.scrollTo({ top: feed.scrollHeight, behavior: reduceMotion ? "instant" : "smooth" });
  }, [transcripts, currentAiInterim, currentCandidateInterim, autoScroll]);

  // The longest interview (the minutes set aside when one starts), for the note before starting
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/billing/usage", {}, { quiet: true });
        if (!res.ok) return;
        const usage = (await res.json()) as { maxSessionMinutes?: number };
        if (!cancelled && typeof usage.maxSessionMinutes === "number") setSessionCapMinutes(usage.maxSessionMinutes);
      } catch {
        // the note falls back to general words
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, apiFetch]);

  // The interviews to choose from; the first role of the chosen one fills the job title until the person types their own
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/interview/careers", {}, { quiet: true });
        if (!res.ok) return;
        const list = (await res.json()) as Career[];
        if (cancelled) return;
        setCareers(list);
      } catch {
        // the page still lets the person search for a job
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, apiFetch]);

  // The person's saved interviews, how long they're kept, and the job library's credit lines
  const loadSessions = async () => {
    try {
      const [s, k, c] = await Promise.all([
        apiFetch("/api/interview/practice/sessions", {}, { quiet: true }),
        apiFetch("/api/interview/practice/keep", {}, { quiet: true }),
        apiFetch("/api/jobs/credits", {}, { quiet: true }),
      ]);
      if (s.ok) setSessions(((await s.json()) as { sessions: SessionItem[] }).sessions);
      if (k.ok) setKeep((await k.json()) as KeepInfo);
      if (c.ok) setCredits(((await c.json()) as { lines: string[] }).lines);
    } catch {
      setSessions((x) => x ?? []);
    }
  };
  const loadSessionsRef = useLatestRef(loadSessions);
  useEffect(() => {
    if (ready) void loadSessionsRef.current();
  }, [ready, loadSessionsRef]);

  // A library job's most important tasks, for "What this interview tests"
  useEffect(() => {
    if (!ready || !job?.code) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/jobs/${encodeURIComponent(job.code!)}`, {}, { quiet: true });
        if (res.ok && !cancelled) setJobDetail((await res.json()) as JobDetail);
      } catch {
        // the panel shows the scoring points only
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, apiFetch, job?.code]);

  const choosePracticeFor = (id: string) => {
    setPracticeFor(id);
    if (id !== "job") {
      const c = careers.find((x) => x.id === id);
      setJobTitle(c?.roles[0] ?? c?.name ?? "");
    } else {
      setJobTitle(job?.title ?? "");
    }
  };

  const chooseJob = (j: PickedJob | null) => {
    setJob(j);
    setJobTitle(j?.title ?? "");
  };

  const deleteSession = async (id: string) => {
    if (!window.confirm(en("Delete this interview, its coaching and its tries? This can't be undone."))) return;
    const res = await apiFetch(`/api/interview/practice/${id}`, { method: "DELETE" }, { quiet: true });
    if (res.ok) setSessions((list) => (list ?? []).filter((s) => s.id !== id));
  };

  const chooseKeep = async (choice: number | null) => {
    const res = await apiFetch("/api/interview/practice/keep", { method: "PUT", body: JSON.stringify({ choice }) }, { quiet: true });
    if (res.ok) await loadSessions();
  };

  // Setup Web Audio API volume meter for lively equalizer visualizer
  const setupAudioMeter = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as BrowserSpeechWindow).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };
      animFrameRef.current = requestAnimationFrame(checkVolume);
    } catch (e) {
      console.warn("Audio visualizer initialization fallback:", e);
    }
  };

  const stamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // A finished turn of the conversation, from the voice service's own transcription
  const addTurn = (role: TranscriptMessage["role"], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const prev = transcriptsRef.current;
    const last = prev[prev.length - 1];
    if (last && last.role === role && last.text === clean) return;
    transcriptsRef.current = [...prev, { id: `${role}-${Date.now()}-${Math.random()}`, role, text: clean, timestamp: stamp(), isFinal: true }];
    setTranscripts(transcriptsRef.current);
  };

  // Live words while the interviewer speaks
  const handleEvent = (msg: RealtimeEvent) => {
    if (msg.type === "response.audio_transcript.delta" || msg.type === "response.output_audio_transcript.delta") {
      setCurrentAiInterim((prev) => prev + (msg.delta ?? ""));
      setAiStatus("speaking");
    } else if (msg.type === "response.audio_transcript.done" || msg.type === "response.output_audio_transcript.done") {
      setCurrentAiInterim("");
      setAiStatus("listening");
    } else if (msg.type === "input_audio_buffer.speech_started") {
      setAiStatus("listening");
    } else if (msg.type === "conversation.item.input_audio_transcription.completed") {
      setCurrentCandidateInterim("");
    }
  };

  // The browser's own speech recognition shows your words as you speak (where the browser has it); the finished turn
  // comes from the voice service
  const setupSpeechRecognition = () => {
    if (typeof window === "undefined") return;
    const speechWindow = window as BrowserSpeechWindow;
    const SpeechRec = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRec) {
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (!item.isFinal) interim += item[0]?.transcript || "";
        }
        setCurrentCandidateInterim(interim);
      };

      recognition.onerror = (e: { error: string }) => {
        console.warn("Speech Recognition notice:", e.error);
      };

      recognition.onend = () => {
        // Automatically restart if session remains active
        if (recognitionRef.current && sessionActiveRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("Speech recognition initialization error:", err);
    }
  };

  // Ends the interview on the server: it measures the minutes used and gives the rest back (once, however often it's asked)
  const endPractice = (keepalive = false): Promise<PracticeEndResult | null> => {
    const p = practiceRef.current;
    if (!p) return Promise.resolve(null);
    if (!p.ending) {
      p.ending = (async () => {
        try {
          const res = await apiFetch(`/api/interview/practice/${p.id}/end`, { method: "POST", body: "{}", keepalive }, { quiet: true });
          return res.ok ? ((await res.json()) as PracticeEndResult) : null;
        } catch {
          return null;
        }
      })();
    }
    return p.ending;
  };

  const startInterview = async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    setEndNotice(null);
    setCancelNote(null);
    setTranscripts([]);
    transcriptsRef.current = [];
    setCurrentAiInterim("");
    setCurrentCandidateInterim("");
    setIsMuted(false);
    practiceRef.current = null;

    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg(en("We couldn't use your microphone. Allow microphone access in your browser, then try again."));
      setIsConnecting(false);
      return;
    }
    localStreamRef.current = mic;
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioElRef.current = audioEl;

    try {
      // The server opens the call, sets aside the minutes, and measures how long it lasts
      callRef.current = await openRealtimeCall({
        mic,
        audio: audioEl,
        exchange: async (sdpOffer) => {
          const res = await apiFetch(`/api/interview/practice/start`, {
            method: "POST",
            body: JSON.stringify({
              career: isJob ? job?.family ?? "general" : practiceFor,
              jobCode: isJob ? job?.code ?? null : null,
              round: isJob ? round : null,
              resumeVersionId,
              removedLines,
              style: selectedStyle,
              jobTitle,
              // A job ad pasted before switching to admissions, a scholarship or a visa isn't sent
              jobDescription: isJob ? jobDescription : "",
              voice: selectedVoice,
              sdpOffer,
            }),
          });
          const body = (await res.json().catch(() => null)) as { practiceId?: string; sdpAnswer?: string; maxSeconds?: number; error?: string } | null;
          if (!res.ok || !body?.practiceId || !body.sdpAnswer) {
            throw new Error(body?.error || en("We couldn't start the interview. Please try again."));
          }
          practiceRef.current = { id: body.practiceId, finishing: false };
          setMaxSeconds(body.maxSeconds ?? null);
          return body.sdpAnswer;
        },
        onRemoteStream: () => setAiStatus("speaking"),
        onEvent: handleEvent,
        onCaption: (c) => addTurn(c.role === "student" ? "candidate" : "interviewer", c.text),
        // The time limit, a dropped line, or a call that never connected
        onEnded: (_reason, wasConnected) => {
          callRef.current = null;
          void finishInterview(wasConnected ? "score" : "failed");
        },
      });

      setupAudioMeter(mic);
      setupSpeechRecognition();
      sessionActiveRef.current = true;
      setIsSessionActive(true);
      setAiStatus("listening");
      setSessionDuration(0);

      timerRef.current = setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Interview setup failed:", err);
      // If the server opened the call, end it: a call that never connected uses no minutes
      void endPractice();
      practiceRef.current = null;
      setErrorMsg(err instanceof TypeError ? en("We couldn't reach Edulexa. Check your internet connection and try again.") : (err as Error).message || en("We couldn't start the voice interview. Please allow microphone access and try again."));
      endSessionCleanup();
    } finally {
      setIsConnecting(false);
    }
  };

  const endSessionCleanup = () => {
    sessionActiveRef.current = false;
    callRef.current?.close();
    callRef.current = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch {}
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsSessionActive(false);
    setAiStatus("idle");
    setAudioLevel(0);
    setCurrentAiInterim("");
    setCurrentCandidateInterim("");
  };

  // Leaving the page during an interview: end it, so the minutes not used go back straight away
  useEffect(() => {
    const leave = () => {
      if (!practiceRef.current || practiceRef.current.finishing) return;
      callRef.current?.close();
      void endPractice(true);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Ends the interview, whichever way: "score" (you ended it, or it reached its time limit or the line dropped), "cancel"
   * (no scorecard) or "failed" (it never connected). The server ends the call, keeps the minutes used and gives the rest back;
   * the scorecard uses the transcript the server kept.
   */
  const finishInterview = async (mode: "score" | "cancel" | "failed") => {
    const p = practiceRef.current;
    if (!p || p.finishing) return;
    p.finishing = true;
    const practiceId = p.id;
    endSessionCleanup();

    if (mode === "cancel") {
      const r = await endPractice();
      practiceRef.current = null;
      setCancelNote(
        r && r.minutesUsed > 0
          ? en("Interview canceled. It used {used} of your voice minutes, and the other {back} went back to your balance.", { used: r.minutesUsed, back: r.minutesGivenBack })
          : en("Interview canceled. No minutes were used."),
      );
      return;
    }

    setIsEvaluating(true);
    const r = await endPractice();
    practiceRef.current = null;
    if (r && r.status !== "ended" && r.status !== "ending") {
      setIsEvaluating(false);
      if (mode === "failed") setErrorMsg(en("We couldn't connect the voice interview, so no minutes were used. Please try again."));
      else setEndNotice(r.message || en("This interview didn't record any answers, so no minutes were used."));
      return;
    }
    // 19 Nov 2026: the coaching page coaches each answer from the transcript the server kept
    const minutes = r?.status === "ended" ? `?used=${r.minutesUsed}&back=${r.minutesGivenBack}` : "";
    router.push(`/interview/practice/${practiceId}${minutes}`);
  };

  const endInterviewAndScore = () => finishInterview("score");

  const toggleMute = () => {
    const next = !isMuted;
    callRef.current?.setMuted(next);
    setIsMuted(next);
  };

  const handleCopyTranscript = (items: TranscriptMessage[]) => {
    const text = items
      .map(m => `[${m.timestamp}] ${m.role === "interviewer" ? "AI Interviewer" : candidateName}: ${m.text}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (access) return <AccessNotice problem={access} feature="Interview practice" />;

  return (
    <div className="text-foreground">
      <PageHeader
          title={en("Interview practice")}
          description={en("Practice a spoken interview for a real job with an AI interviewer, then get coaching on each answer and try any question again.")}
          actions={
            <>
              <Link href="/prep/exam" className={buttonClass("secondary")}>
                {en("Written exam practice")}
              </Link>
              <Link href="/prep/counselling" className={buttonClass("secondary")}>
                <Compass className="h-4 w-4" />
                {en("Career quiz")}
              </Link>
            </>
          }
        />

      <div className="space-y-8">
        {errorMsg && (
          <div role="alert" className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="font-medium underline ms-4 hover:opacity-80 cursor-pointer"
            >
              {en("Dismiss")}
            </button>
          </div>
        )}

        {cancelNote && !isSessionActive && (
          <div role="status" className="p-3 rounded-lg border border-border bg-muted/40 text-sm text-foreground flex items-center justify-between">
            <span>{cancelNote}</span>
            <button onClick={() => setCancelNote(null)} className="font-medium underline ms-4 hover:opacity-80 cursor-pointer">
              {en("Dismiss")}
            </button>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* ACTIVE LIVE INTERVIEW HUD WITH SPLIT TRANSCRIPT VIEW */}
        {/* ---------------------------------------------------- */}
        {isSessionActive ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in zoom-in-95 duration-200">
            {/* Left Column (5 cols): AI Voice Studio & Equalizer HUD */}
            <div className="lg:col-span-5 p-6 rounded-xl border border-border bg-card shadow-sm relative overflow-hidden space-y-6">

              <div className="flex items-center justify-between relative z-10">
                <div>
                  <Badge tone="info">{en("Live session • {name}", { name: career?.name ?? "" })}</Badge>
                  <h2 className="text-lg font-semibold text-foreground mt-2">
                    {jobTitle}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {en("Voice: ")}<span className="font-medium text-foreground capitalize">{selectedVoice}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-sm font-mono font-semibold tabular-nums text-foreground">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{formatDuration(sessionDuration)}</span>
                  {maxSeconds !== null && <span className="font-sans font-normal text-xs text-muted-foreground">{en("of {limit}", { limit: formatDuration(maxSeconds) })}</span>}
                </div>
              </div>

              {/* Pulsating Voice Visualizer & Animated Wave */}
              <div className="py-8 flex flex-col items-center justify-center space-y-5 relative z-10">
                <div className="relative flex items-center justify-center">
                  <div
                    className={`w-28 h-28 rounded-full border-2 border-primary/40 bg-primary/10 flex items-center justify-center transition-transform duration-300 ${
                      aiStatus === "speaking" ? "scale-105 ring-4 ring-primary/20" : "scale-100"
                    }`}
                  >
                    <Volume2 className="w-10 h-10 text-primary" />
                  </div>
                </div>

                {/* Dynamic 5-Bar Audio Equalizer */}
                <div className="flex items-end justify-center gap-1.5 h-8">
                  {[0.4, 0.7, 1.0, 0.6, 0.3].map((multiplier, idx) => {
                    const activeHeight = aiStatus === "speaking" 
                      ? Math.max(12, Math.round(28 * multiplier)) 
                      : Math.max(6, Math.round((audioLevel / 100) * 32 * multiplier));
                    return (
                      <div
                        key={idx}
                        className={`w-1.5 rounded-full transition-all duration-75 ${
                          aiStatus === "speaking"
                            ? "bg-indigo-500"
                            : audioLevel > 15
                            ? "bg-emerald-500"
                            : "bg-muted-foreground/30"
                        }`}
                        style={{ height: `${activeHeight}px` }}
                      />
                    );
                  })}
                </div>

                <div className="text-center space-y-1">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-muted border border-border/80 text-foreground">
                    {aiStatus === "speaking" ? en("AI interviewer speaking…") : en("Listening…")}
                  </span>
                  <p className="text-xs text-muted-foreground pt-1">
                    {isMuted ? en("Your microphone is muted.") : en("Speak naturally into your mic. Spoken words transcribe live.")}
                  </p>
                </div>
              </div>

              {/* Control Action Buttons */}
              <div className="space-y-3 pt-3 border-t border-border relative z-10">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`${buttonClass("secondary")} flex-1 ${isMuted ? "ring-1 ring-amber-500" : ""}`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isMuted ? en("Unmute") : en("Mute")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    className={`${buttonClass("secondary")} text-red-700 dark:text-red-400`}
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>{en("Cancel")}</span>
                  </button>
                </div>

                <Button type="button" onClick={endInterviewAndScore} className="w-full">
                  <Award className="w-4 h-4" />
                  <span>{en("End and get my coaching")}</span>
                </Button>
              </div>

              {/* Real-time Tips Card */}
              <div className="p-3.5 rounded-lg bg-muted/40 border border-border text-start space-y-1">
                <div className="text-sm font-medium text-foreground">
                  {en("Answering tip")}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {en("Structure responses around situation, key trade-offs, and latency/business impacts. The interviewer will challenge edge-cases.")}
                </p>
              </div>
            </div>

            {/* Right Column (7 cols): Live Speech-to-Text Transcript Feed */}
            <div className="lg:col-span-7 rounded-xl border border-border bg-card shadow-sm flex flex-col h-[580px] overflow-hidden">
              {/* Transcript Header */}
              <div className="p-4 border-b border-border bg-card flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
                  <span className="text-sm font-semibold text-foreground">{en("Live transcript")}</span>
                  <Badge>{en("{length} turns", { length: transcripts.length })}</Badge>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setAutoScroll(!autoScroll)}
                    aria-label={en("Auto-scroll")}
                    aria-pressed={autoScroll}
                    className={buttonClass("ghost")}
                    title={en("Toggle auto-scrolling as words arrive")}
                  >
                    {en("Auto-scroll: {value}", { value: autoScroll ? en("on") : en("off") })}
                  </button>

                  {transcripts.length > 0 && (
                    <button
                      onClick={() => handleCopyTranscript(transcripts)}
                      className={buttonClass("secondary")}
                      title={en("Copy full transcript to clipboard")}
                    >
                      {copiedTranscript ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                      <span>{copiedTranscript ? en("Copied") : en("Copy")}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Message Bubbles Stream */}
              <div
                ref={transcriptFeedRef}
                role="log"
                aria-label={en("Live transcript")}
                tabIndex={0}
                className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 text-sm focus-visible:outline-offset-[-3px]"
              >
                {transcripts.length === 0 && !currentAiInterim && !currentCandidateInterim && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 opacity-40 text-primary" />
                    <p className="font-medium text-foreground text-sm">{en("Connecting…")}</p>
                    <p className="text-xs max-w-sm leading-relaxed">
                      {en("Your spoken dialogue and the AI interviewer's responses appear here as you speak.")}
                    </p>
                  </div>
                )}

                {/* Historical Conversation Turns */}
                {transcripts.map((msg) => {
                  const isAi = msg.role === "interviewer";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col space-y-1 ${isAi ? "items-start" : "items-end"}`}
                    >
                      <div className="flex items-center space-x-1.5 text-xs text-muted-foreground px-1">
                        {isAi ? (
                          <>
                            <Bot className="w-3 h-3 text-indigo-500" />
                            <span className="font-medium text-foreground">{en("AI interviewer ({selectedVoice})", { selectedVoice })}</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium text-foreground">{candidateName}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="font-mono">{msg.timestamp}</span>
                      </div>

                      <div
                        className={`max-w-[85%] rounded-xl p-3.5 leading-relaxed ${
                          isAi
                            ? "bg-muted border border-border text-foreground rounded-ss-sm"
                            : "bg-indigo-600 text-white rounded-se-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}

                {/* Active AI Streaming Delta Bubble */}
                {currentAiInterim && (
                  <div aria-hidden="true" className="flex flex-col space-y-1 items-start">
                    <div className="flex items-center space-x-1.5 text-xs text-muted-foreground px-1 font-medium">
                      <Bot className="w-3 h-3" />
                      <span>{en("AI interviewer speaking…")}</span>
                    </div>
                    <div className="max-w-[85%] rounded-xl rounded-ss-sm p-3.5 bg-muted border border-border text-foreground">
                      <span>{currentAiInterim}</span>
                      <span className="inline-block w-1.5 h-3 ms-1 bg-indigo-500 animate-pulse" />
                    </div>
                  </div>
                )}

                {/* Active Candidate Interim Speech Bubble */}
                {currentCandidateInterim && (
                  <div aria-hidden="true" className="flex flex-col space-y-1 items-end">
                    <div className="flex items-center space-x-1.5 text-xs text-muted-foreground px-1 font-medium">
                      <Mic className="w-3 h-3" />
                      <span>{en("Transcribing {candidateName}…", { candidateName })}</span>
                    </div>
                    <div className="max-w-[85%] rounded-xl rounded-se-sm p-3.5 bg-indigo-600/80 text-white italic">
                      <span>{currentCandidateInterim}</span>
                      <span className="inline-block w-1.5 h-3 ms-1 bg-white/70 animate-pulse" />
                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>
        ) : isEvaluating ? (
          <div className="p-16 rounded-xl border border-border bg-card shadow-sm flex flex-col items-center justify-center text-center space-y-5">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin motion-reduce:animate-none" />
            <div className="space-y-1.5 max-w-lg">
              <h2 className="text-lg font-semibold text-foreground">{en("Ending your interview")}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{en("Next you'll see coaching on each of your answers.")}</p>
            </div>
          </div>
        ) : endNotice ? (
          <div role="status" className="p-10 rounded-xl border border-border bg-card shadow-sm flex flex-col items-center justify-center text-center space-y-4">
            <MessageSquare aria-hidden="true" className="w-8 h-8 text-muted-foreground" />
            <div className="space-y-1.5 max-w-lg">
              <h2 className="text-lg font-semibold text-foreground">{en("No coaching this time")}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{endNotice}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={startInterview} busy={isConnecting}>{en("Start again")}</Button>
              <Button variant="secondary" onClick={() => setEndNotice(null)}>{en("Change the setup")}</Button>
            </div>
          </div>
        ) : (
          /* ---------------------------------------------------- */
          /* SETUP (19 Nov 2026: job, round, résumé, job ad)      */
          /* ---------------------------------------------------- */
          <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* 1. What you're practicing for */}
              <section className="space-y-3" aria-labelledby="setup-for">
                <h2 id="setup-for" className="text-base font-semibold text-foreground">{en("1. What you're practicing for")}</h2>
                <div className="flex flex-wrap gap-2" role="group" aria-label={en("What you're practicing for")}>
                  {[{ id: "job", name: en("A job") }, ...careers.filter((c) => c.kind !== "career").map((c) => ({ id: c.id, name: c.name }))].map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={practiceFor === o.id}
                      onClick={() => choosePracticeFor(o.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm ${practiceFor === o.id ? "border-[var(--brand)] bg-muted font-medium text-foreground" : "border-border text-muted-foreground hover:bg-muted/50"}`}
                    >
                      {o.name}
                    </button>
                  ))}
                </div>
                {isJob ? (
                  <JobPicker value={job} onChange={chooseJob} />
                ) : (
                  <p className="text-sm text-muted-foreground">{career?.name}</p>
                )}
                {career?.kind === "visa" && (
                  <p className="text-xs text-muted-foreground">{en("This is practice only, not legal or immigration advice. Follow the official guidance for the country you're applying to.")}</p>
                )}
              </section>

              {/* 2. The round (jobs only) */}
              {isJob && (
                <section className="space-y-3" aria-labelledby="setup-round">
                  <h2 id="setup-round" className="text-base font-semibold text-foreground">{en("2. The round")}</h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {ROUNDS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        aria-pressed={round === r.id}
                        onClick={() => setRound(r.id)}
                        className={`rounded-xl border bg-card p-4 text-start shadow-sm transition-colors ${round === r.id ? "border-[var(--brand)] ring-1 ring-[var(--brand)]" : "border-border hover:bg-muted/50"}`}
                      >
                        <p className="mb-1 text-sm font-medium text-foreground">{en(r.label)}</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">{en(r.description)}</p>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* 3. Your résumé and the job ad */}
              <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm" aria-labelledby="setup-you">
                <div>
                  <h2 id="setup-you" className="text-base font-semibold text-foreground">{isJob ? en("3. Your résumé and the job ad") : en("2. Your résumé")}</h2>
                  <p className="text-xs text-muted-foreground">{en("Optional. With them, the interviewer asks about your own experience and this job.")}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{en("Your résumé")}</p>
                  <LibraryPicker value={resumeVersionId} onChange={(v) => { setResumeVersionId(v); setRemovedLines([]); }} name="interview-resume" />
                  {resumeVersionId && (
                    <button type="button" onClick={() => { setResumeVersionId(null); setRemovedLines([]); }} className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">
                      {en("Don't use a résumé")}
                    </button>
                  )}
                </div>
                {isJob && (
                  <div className="space-y-2">
                    <label htmlFor="interview-job-description" className="text-sm font-medium text-foreground">{en("The job ad (optional)")}</label>
                    <textarea
                      id="interview-job-description"
                      rows={4}
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder={en("Paste the job ad, or the main duties and requirements")}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card shadow-sm text-sm text-foreground leading-relaxed"
                    />
                  </div>
                )}
                <PrivacyPreview resumeVersionId={resumeVersionId} jobDescription={isJob ? jobDescription : ""} removedLines={removedLines} onRemovedLinesChange={setRemovedLines} />
              </section>

              {/* 4. The interviewer */}
              <section className="space-y-3" aria-labelledby="setup-style">
                <h2 id="setup-style" className="text-base font-semibold text-foreground">{isJob ? en("4. The interviewer") : en("3. The interviewer")}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {STYLES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      aria-pressed={selectedStyle === st.id}
                      onClick={() => setSelectedStyle(st.id)}
                      className={`rounded-xl border bg-card p-4 text-start shadow-sm transition-colors ${selectedStyle === st.id ? "border-[var(--brand)] ring-1 ring-[var(--brand)]" : "border-border hover:bg-muted/50"}`}
                    >
                      <p className="mb-1 text-sm font-medium text-foreground">{en(st.label)}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{en(st.description)}</p>
                    </button>
                  ))}
                </div>
                <div className="max-w-xs space-y-1.5">
                  <label htmlFor="interview-voice" className="text-sm font-medium text-foreground">{en("Interviewer voice")}</label>
                  <select
                    id="interview-voice"
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card shadow-sm text-sm text-foreground"
                  >
                    {VOICES.map((v) => (
                      <option key={v.id} value={v.id}>{en(v.label)}</option>
                    ))}
                  </select>
                </div>
              </section>

              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm text-foreground">{en("Don't say your name or contact details during the interview. Speak as you would in the real one.")}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {sessionCapMinutes
                    ? en("You pay only for the minutes you use. Starting sets aside up to {limit} minutes, and the ones you don't use go back to your balance when you end.", { limit: sessionCapMinutes })
                    : en("You pay only for the minutes you use. Starting sets aside a whole interview's minutes, and the ones you don't use go back to your balance when you end.")}
                </p>
                <Button type="button" onClick={startInterview} disabled={!jobTitle.trim() || (isJob && !job)} busy={isConnecting} className="h-10 w-full">
                  {!isConnecting && <Play className="w-4 h-4" />}
                  <span>{isConnecting ? en("Connecting…") : en("Start interview")}</span>
                </Button>
              </div>
            </div>

            {/* What this interview tests */}
            <aside className="space-y-4" aria-labelledby="setup-tests">
              <h2 id="setup-tests" className="text-base font-semibold text-foreground">{en("What this interview tests")}</h2>
              {jobDetail && jobDetail.code === job?.code && jobDetail.tasks.length > 0 && (
                <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground">{en("The job's most important tasks")}</p>
                  <ul className="space-y-1.5 text-sm text-foreground">
                    {jobDetail.tasks.slice(0, 5).map((t) => (
                      <li key={t.text} className="flex gap-2"><span aria-hidden="true" className="text-[var(--brand)]">•</span><span>{t.text}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {career ? (
                <ul className="space-y-3">
                  {career.dimensions.map((d) => (
                    <li key={d.key} className="space-y-1 rounded-xl border border-border bg-card p-4 shadow-sm">
                      <p className="text-sm font-medium text-foreground">{d.name}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{d.good}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{en("Choose a job to see what the interviewer listens for.")}</p>
              )}
              <p className="text-xs text-muted-foreground">{en("Six to eight questions, made for you from the job and your résumé. Afterwards you get coaching on each answer and can try any question again.")}</p>
              {credits.length > 0 && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {en("Job information from O*NET® and ESCO.")}{" "}
                  <Link href="/help/job-information-sources" className="underline underline-offset-2 hover:text-foreground">{en("Sources and credits")}</Link>
                </p>
              )}
            </aside>
          </div>

          {/* Your interviews */}
          <section className="space-y-3 border-t border-border pt-6" aria-labelledby="setup-sessions">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="setup-sessions" className="text-base font-semibold text-foreground">{en("Your interviews")}</h2>
                <p className="text-xs text-muted-foreground">{en("Only you can see them.")}</p>
              </div>
              {keep && (
                <div className="flex items-center gap-2 text-sm">
                  <label htmlFor="interview-keep" className="text-muted-foreground">{en("Keep them for")}</label>
                  <select
                    id="interview-keep"
                    value={keep.choice === null ? "" : String(keep.choice)}
                    onChange={(e) => void chooseKeep(e.target.value === "" ? null : Number(e.target.value))}
                    className="rounded-lg border border-border bg-card px-2 py-1 text-sm text-foreground"
                  >
                    <option value="">{keep.planDays === 0 ? en("Until I delete them (your plan)") : en("{days} days (your plan)", { days: keep.planDays })}</option>
                    {keep.choices.filter((d) => d !== keep.planDays).map((d) => (
                      <option key={d} value={d}>{d === 0 ? en("Until I delete them") : en("{days} days", { days: d })}</option>
                    ))}
                    <option value="-1">{en("A day after I see the coaching")}</option>
                  </select>
                </div>
              )}
            </div>
            {sessions === null ? (
              <div className="h-16 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-busy="true" />
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{en("Your interviews and their coaching will show here.")}</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {sessions.slice(0, 10).map((s) => {
                  const result = s.status ? RESULTS[s.status] : null;
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <Link href={`/interview/practice/${s.id}`} className="min-w-0 flex-1 hover:underline">
                        <span className="block truncate text-sm font-medium text-foreground">{s.jobTitle}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[s.roundName ? en(s.roundName) : null, new Date(s.createdAt).toLocaleDateString(), s.deletesOn ? en("deleted on {date}", { date: new Date(s.deletesOn + "T00:00:00").toLocaleDateString() }) : null].filter(Boolean).join(" · ")}
                        </span>
                      </Link>
                      {result ? <Badge tone={result.tone}>{en(result.label)}</Badge> : <Badge tone="info">{en("Not coached yet")}</Badge>}
                      <button
                        type="button"
                        onClick={() => void deleteSession(s.id)}
                        aria-label={en("Delete the interview for {title}", { title: s.jobTitle })}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          </>
        )}
      </div>

      {/* Cancellation Quiz Modal */}
      <CancellationQuizModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        sessionType="Interview"
        onConfirmedCancel={() => void finishInterview("cancel")}
      />
    </div>
  );
}
