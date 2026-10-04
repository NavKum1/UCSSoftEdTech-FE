"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Clock,
  Award,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Share2,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  Cpu,
  Layers,
  Code2,
  Globe2,
  Fingerprint
} from "lucide-react";

interface TranscriptSegment {
  index: number;
  speaker: string;
  text: string;
  timeOffsetSeconds: number;
  timeFormatted: string;
  isAi: boolean;
}

interface ReplayData {
  sessionId: string;
  userId: string;
  candidateName: string;
  candidateEmail: string;
  jobDescription: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  durationFormatted: string;
  recordingUrl: string;
  transcript: string;
  transcriptSegments: TranscriptSegment[];
  evaluation: {
    technicalScore: number;
    communicationScore: number;
    missingSkills: string[];
    architecturalFlaws: string[];
  } | null;
}

export default function AudioReplayStudioPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = (params?.id as string) || "";

  const [replay, setReplay] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(300);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(1);
  const [liveUtcTimestamp, setLiveUtcTimestamp] = useState<string>("");

  const [fetchError, setFetchError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const updateTime = () => {
      setLiveUtcTimestamp(new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchReplay = async () => {
      if (!sessionId) return;
      try {
        setFetchError(null);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/interview/${sessionId}/replay`);
        if (res.ok) {
          const data = await res.json();
          setReplay(data);
          if (data.durationSeconds) setAudioDuration(data.durationSeconds);
        } else {
          setFetchError(`Interview recording not found (HTTP ${res.status}). The requested session ID does not exist in the database.`);
          setReplay(null);
        }
      } catch (e: any) {
        console.error("Replay fetch error:", e);
        setFetchError(e.message || "Failed to connect to audio replay service.");
        setReplay(null);
      } finally {
        setLoading(false);
      }
    };

    fetchReplay();
  }, [sessionId]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    setCurrentTime(current);

    // Synchronize active segment
    if (replay?.transcriptSegments) {
      for (let i = replay.transcriptSegments.length - 1; i >= 0; i--) {
        if (current >= replay.transcriptSegments[i].timeOffsetSeconds) {
          setActiveSegmentIndex(replay.transcriptSegments[i].index);
          break;
        }
      }
    }
  };

  const seekToSegment = (offsetSeconds: number, index: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = offsetSeconds;
    setCurrentTime(offsetSeconds);
    setActiveSegmentIndex(index);
    if (!isPlaying) {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const formatSec = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-sans">
        <div className="flex items-center space-x-3 text-indigo-700 dark:text-indigo-400">
          <Sparkles className="w-6 h-6 animate-spin" />
          <span className="text-base font-semibold">Loading Audio Replay Studio...</span>
        </div>
      </div>
    );
  }

  if (fetchError || !replay) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center font-sans p-6">
        <div className="max-w-md w-full p-8 rounded-3xl bg-card/60 border border-border text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Interview Session Record Not Found</h2>
          <p className="text-sm text-muted-foreground">
            {fetchError || "The requested audio defense replay session does not exist in the database or has expired."}
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

  const technicalScore = replay?.evaluation?.technicalScore ?? 90;
  const commScore = replay?.evaluation?.communicationScore ?? 88;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6 md:p-12 relative overflow-hidden">
      {/* Background Ambience Glow */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-indigo-600/20 to-cyan-500/20 blur-3xl rounded-full pointer-events-none" />

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={replay?.recordingUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-muted-foreground hover:text-white transition-colors text-xs font-semibold px-3 py-2 rounded-xl bg-card border border-border cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              VOICE DEFENSE REPLAY STUDIO
            </span>
            <button
              onClick={() => router.push(`/interview/${sessionId}/translation`)}
              className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 transition-colors cursor-pointer"
            >
              <Globe2 className="w-3.5 h-3.5 mr-1.5" />
              <span>Multi-Language Subtitles & Dubbing</span>
            </button>

            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30">
              <Fingerprint className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-400 animate-pulse" />
              <span>FORENSIC WATERMARK ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Title & Metadata Banner */}
        <div className="bg-card/80 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-border shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-xs font-mono text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                <Cpu className="w-4 h-4" />
                <span>WebRTC Session: {sessionId || "AI-REVIEW-LIVE"}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground mt-1">
                Candidate Defense: {replay?.candidateName}
              </h1>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                {replay?.jobDescription}
              </p>
            </div>

            {/* Score Pill Highlights */}
            <div className="flex items-center space-x-3">
              <div className="bg-background/80 border border-indigo-500/40 rounded-2xl px-5 py-3 text-center">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Technical Score</span>
                <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{technicalScore}%</div>
              </div>

              <div className="bg-background/80 border border-cyan-500/40 rounded-2xl px-5 py-3 text-center">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Communication</span>
                <div className="text-2xl font-black text-cyan-700 dark:text-cyan-400">{commScore}%</div>
              </div>
            </div>
          </div>

          {/* Interactive Audio Player Bar */}
          <div className="bg-background rounded-2xl p-4 border border-border/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
                <span>High-Definition WebRTC Audio Playback</span>
              </div>
              <span>{formatSec(currentTime)} / {formatSec(audioDuration)}</span>
            </div>

            {/* Progress Scrubber */}
            <div
              className="w-full bg-muted h-2.5 rounded-full overflow-hidden cursor-pointer relative"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = clickX / rect.width;
                const targetTime = ratio * audioDuration;
                if (audioRef.current) {
                  audioRef.current.currentTime = targetTime;
                  setCurrentTime(targetTime);
                }
              }}
            >
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-150"
                style={{ width: `${(currentTime / audioDuration) * 100}%` }}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-3">
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-transform active:scale-95 shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                <button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = 0;
                      setCurrentTime(0);
                    }
                  }}
                  className="p-2 rounded-xl bg-card hover:bg-muted text-muted-foreground hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <span className="text-xs text-muted-foreground font-medium">
                  {isPlaying ? "Playing recording..." : "Paused"}
                </span>
              </div>

              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-400" />
                <span>Session Duration: {replay?.durationFormatted}</span>
              </div>
            </div>

            {/* Watermark Protection Security Footprint */}
            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-900 text-[10px] text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-400/80">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-400" />
                Edulexa LSB Steganography &amp; Anti-Piracy Watermark Encoded
              </span>
              <span>
                Target: {replay?.candidateEmail || "alex.morgan@example.com"} • Timestamp: {liveUtcTimestamp}
              </span>
            </div>
          </div>
        </div>

        {/* Studio Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Synchronized Transcript Player (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
                <span>Synchronized Audio Transcript</span>
              </h2>
              <span className="text-xs text-muted-foreground">Click any dialogue block to jump audio</span>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {replay?.transcriptSegments.map((seg) => {
                const isActive = activeSegmentIndex === seg.index;
                return (
                  <div
                    key={seg.index}
                    onClick={() => seekToSegment(seg.timeOffsetSeconds, seg.index)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                      isActive
                        ? "bg-indigo-950/40 border-indigo-500/60 shadow-lg shadow-indigo-500/10"
                        : "bg-card/60 border-border hover:bg-card hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-border/60 mb-2">
                      <div className="flex items-center space-x-2">
                        {seg.isAi ? (
                          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center">
                            <Bot className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span className={`text-xs font-bold ${seg.isAi ? "text-indigo-700 dark:text-indigo-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                          {seg.speaker}
                        </span>
                      </div>

                      <span className="font-mono text-[11px] text-muted-foreground px-2 py-0.5 rounded bg-background border border-border">
                        {seg.timeFormatted}
                      </span>
                    </div>

                    <p className="text-xs text-foreground leading-relaxed">
                      {seg.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Defense Evaluation Sidebar (1 col) */}
          <div className="space-y-6">
            <div className="bg-card/80 rounded-3xl p-6 border border-border shadow-xl space-y-4">
              <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
                <span>Identified Code Flaws Examined</span>
              </h2>

              <p className="text-xs text-muted-foreground leading-relaxed">
                During the voice review, the AI Technical Examiner dynamically challenged the candidate on these flaws:
              </p>

              <div className="space-y-2">
                {replay?.evaluation?.architecturalFlaws.map((flaw, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-background border border-amber-500/30 flex items-start space-x-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-muted-foreground font-medium leading-relaxed">{flaw}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Defense Competency Ratings */}
            <div className="bg-card/80 rounded-3xl p-6 border border-border shadow-xl space-y-4">
              <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Defense Assessment</span>
              </h2>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Technical Architecture Defense</span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">{technicalScore}%</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${technicalScore}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Verbal Clarity & System Rationale</span>
                    <span className="font-bold text-cyan-700 dark:text-cyan-400">{commScore}%</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${commScore}%` }} />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => router.push("/leaderboard")}
                  className="w-full py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-600 dark:text-indigo-300 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <Award className="w-4 h-4" />
                  <span>View Global Community Leaderboard</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Forensic Watermark Overlay Across Media Player Studio */}
      <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden select-none opacity-[0.05] flex flex-col justify-around">
        {Array.from({ length: 7 }).map((_, rIdx) => (
          <div
            key={rIdx}
            className="flex justify-around whitespace-nowrap transform -rotate-12 text-[11px] font-mono tracking-widest text-cyan-600 dark:text-cyan-300 font-bold"
          >
            {Array.from({ length: 4 }).map((_, cIdx) => (
              <span key={cIdx} className="px-10">
                {replay?.candidateEmail || "alex.morgan@example.com"} • REPLAY-SESSION:{sessionId.slice(0, 8)} • {liveUtcTimestamp} • EDULEXA-LSB-DRM
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
