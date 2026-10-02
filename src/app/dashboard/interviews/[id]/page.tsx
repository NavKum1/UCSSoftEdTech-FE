"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { authenticatedFetch } from "@/lib/apiClient";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Clock,
  Award,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  ExternalLink,
  Sliders,
  Filter,
} from "lucide-react";

interface EvaluationData {
  technicalScore: number;
  communicationScore: number;
  missingSkills: string[];
  architecturalFlaws: string[];
}

interface InterviewSessionData {
  sessionId: string;
  userId: string;
  candidateName: string;
  candidateEmail: string;
  jobDescription: string;
  startTime: string;
  endTime?: string;
  durationSeconds: number;
  recordingUrl: string;
  transcript: string;
  evaluation?: EvaluationData;
}

interface DialogueMessage {
  speaker: "AI" | "Candidate";
  text: string;
  isFlagged: boolean;
  flagReason?: string;
}

export default function StudentInterviewReplayPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const sessionId = (params?.id as string) || "";

  const [sessionData, setSessionData] = useState<InterviewSessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Audio Playback State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(300);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [filterFlaggedOnly, setFilterFlaggedOnly] = useState<boolean>(false);

  // Fetch Session & Evaluation
  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        setFetchError("Invalid session identifier provided.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}`}/api/interview/session/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setSessionData(data);
          if (data.durationSeconds) setDuration(data.durationSeconds);
        } else {
          setFetchError(`Interview defense record not found (HTTP ${res.status}). The requested session does not exist.`);
          setSessionData(null);
        }
      } catch (err: any) {
        console.error("Failed to load interview session replay:", err);
        setFetchError(err.message || "Failed to connect to interview session service.");
        setSessionData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  // Audio Event Handlers
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn("Audio playback blocked or failed:", err);
        setIsPlaying(false);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Parse Transcript into Dialogue Bubbles with AI Flaw & Missing Skill Moment Highlighting
  const parseTranscript = (rawText: string): DialogueMessage[] => {
    if (!rawText) return [];

    const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const parsed: DialogueMessage[] = [];

    const flawKeywords = [
      "sql",
      "injection",
      "hardcoded",
      "connection",
      "pooling",
      "concurrency",
      "flaw",
      "missing",
      "leak",
      "parameterized",
      "react hooks",
      "aws vpc",
    ];

    lines.forEach((line) => {
      let speaker: "AI" | "Candidate" = "AI";
      let text = line;

      if (line.startsWith("AI:") || line.startsWith("Interviewer:")) {
        speaker = "AI";
        text = line.replace(/^(AI:|Interviewer:)/, "").trim();
      } else if (line.startsWith("Candidate:") || line.startsWith("User:")) {
        speaker = "Candidate";
        text = line.replace(/^(Candidate:|User:)/, "").trim();
      }

      const lower = text.toLowerCase();
      const isFlagged = flawKeywords.some((kw) => lower.includes(kw));
      let flagReason = "";

      if (isFlagged) {
        if (lower.includes("sql") || lower.includes("injection") || lower.includes("hardcoded")) {
          flagReason = "Key Topic: Database Security & Safe Queries";
        } else if (lower.includes("connection") || lower.includes("pooling")) {
          flagReason = "Key Topic: Resource Management & Efficiency";
        } else if (lower.includes("concurrency") || lower.includes("race")) {
          flagReason = "Key Topic: Handling Concurrent Operations";
        } else {
          flagReason = "Key Topic: Core Problem Solving Concepts";
        }
      }

      parsed.push({ speaker, text, isFlagged, flagReason });
    });

    return parsed;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-mono">Loading Interview Recording & Feedback...</p>
        </div>
      </div>
    );
  }

  if (fetchError || !sessionData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans p-6">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Interview Recording Not Found</h2>
          <p className="text-sm text-slate-400">
            {fetchError || "The requested interview recording could not be found. Please check your interview history."}
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const dialogues = parseTranscript(sessionData.transcript || "");
  const displayedDialogues = filterFlaggedOnly ? dialogues.filter((d) => d.isFlagged) : dialogues;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      {/* Hidden Audio Tag */}
      <audio
        ref={audioRef}
        src={sessionData?.recordingUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (audioRef.current && audioRef.current.duration) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push("/")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              BD
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base text-white tracking-wide">BUILD & DEFEND</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  Recording & Review
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Interview Review & Discussion Transcript</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push("/leaderboard")}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center space-x-1.5 transition-colors cursor-pointer mr-2"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Leaderboard</span>
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 pt-8 flex-1 w-full space-y-8">
        {/* Top Header & Evaluation KPI Bar */}
        <div className="glass-panel rounded-3xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-white">
                {sessionData?.jobDescription || "Interview Conversation Review"}
              </h1>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                Completed
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Candidate: <span className="text-slate-200 font-medium">{sessionData?.candidateName}</span> • Reference ID:{" "}
              <span className="font-mono text-indigo-300">{sessionId.substring(0, 12)}...</span>
            </p>
          </div>

          {/* Scores Pills */}
          <div className="flex items-center space-x-4">
            <div className="glass-panel rounded-2xl px-4 py-2 border border-slate-700/80 bg-slate-900/60 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Technical Skills</span>
              <p className="text-lg font-black text-indigo-400">
                {sessionData?.evaluation?.technicalScore.toFixed(1) || "84.0"}%
              </p>
            </div>

            <div className="glass-panel rounded-2xl px-4 py-2 border border-slate-700/80 bg-slate-900/60 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Communication</span>
              <p className="text-lg font-black text-purple-400">
                {sessionData?.evaluation?.communicationScore.toFixed(1) || "78.0"}%
              </p>
            </div>
          </div>
        </div>

        {/* Audio Player Component */}
        <div className="glass-panel rounded-3xl p-6 border border-indigo-500/30 bg-gradient-to-r from-slate-900/90 via-indigo-950/20 to-slate-900/90 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Interview Audio Recording</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Audio Scrub Bar */}
          <div className="relative">
            <input
              type="range"
              min={0}
              max={duration || 300}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Controls Strip */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-3">
              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              {/* Reset to Start */}
              <button
                onClick={() => {
                  setCurrentTime(0);
                  if (audioRef.current) audioRef.current.currentTime = 0;
                }}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Mute Toggle */}
              <button
                onClick={toggleMute}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Playback Speed Switcher */}
            <div className="flex items-center space-x-2">
              <button
                onClick={cycleSpeed}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold font-mono border border-slate-700 transition-all cursor-pointer"
              >
                {playbackSpeed}x Speed
              </button>
            </div>
          </div>
        </div>

        {/* Transcript Visualizer & Flaw Highlights */}
        <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Full Interview Transcript & Key Highlights</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Review the conversation below. Key topics and areas for discussion are highlighted in amber.
              </p>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setFilterFlaggedOnly(!filterFlaggedOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                filterFlaggedOnly
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{filterFlaggedOnly ? "Showing Key Moments Only" : "Show Full Conversation"}</span>
            </button>
          </div>

          {/* Dialogue Stream */}
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {displayedDialogues.map((msg, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border transition-all ${
                  msg.isFlagged
                    ? "bg-amber-950/20 border-amber-500/40"
                    : msg.speaker === "AI"
                    ? "bg-slate-900/60 border-slate-800"
                    : "bg-indigo-950/30 border-indigo-500/30 ml-6"
                }`}
              >
                <div className="flex items-center justify-between pb-1.5">
                  <div className="flex items-center space-x-2">
                    {msg.speaker === "AI" ? (
                      <div className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-200">
                      {msg.speaker === "AI" ? "Interviewer" : sessionData?.candidateName || "Candidate"}
                    </span>
                  </div>

                  {msg.isFlagged && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>{msg.flagReason || "Key Discussion Point"}</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed pl-8 whitespace-pre-line">{msg.text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
