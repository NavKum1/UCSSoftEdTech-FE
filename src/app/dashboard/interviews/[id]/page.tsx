"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Award,
  AlertTriangle,
  ArrowLeft,
  Bot,
  User,
} from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, Card, EmptyState, Loading, PageHeader, StatTile } from "@/components/career/ui";

interface EvaluationData {
  technicalScore: number;
  communicationScore: number | null;
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
}

export default function StudentInterviewReplayPage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const params = useParams();
  const router = useRouter();
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

  // Fetch Session & Evaluation
  useEffect(() => {
    if (!ready) return;
    const fetchSession = async () => {
      if (!sessionId) {
        setFetchError("Invalid session identifier provided.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setFetchError(null);
      try {
        const res = await apiFetch(`/api/interview/session/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setSessionData(data);
          if (data.durationSeconds) setDuration(data.durationSeconds);
        } else {
          setFetchError("We couldn't find this interview. It may have been removed, or the link may be wrong.");
          setSessionData(null);
        }
      } catch (err) {
        console.error("Failed to load interview session replay:", err);
        setFetchError(err instanceof TypeError ? "We couldn't reach Edulexa. Check your internet connection and try again." : (err as Error).message || "We couldn't load this interview. Please try again.");
        setSessionData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, ready, apiFetch]);

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

  // The transcript as it was spoken. P6 (5 Nov 2026): lines are no longer flagged by matching tech keywords on this page.
  const parseTranscript = (rawText: string): DialogueMessage[] => {
    if (!rawText) return [];
    return rawText
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        if (line.startsWith("Candidate:") || line.startsWith("User:")) {
          return { speaker: "Candidate" as const, text: line.replace(/^(Candidate:|User:)/, "").trim() };
        }
        return { speaker: "AI" as const, text: line.replace(/^(AI:|Interviewer:)/, "").trim() };
      });
  };

  if (access) return <AccessNotice problem={access} feature="This interview replay" />;

  if (loading) {
    return <Loading label={en("Loading your interview…")} />;
  }

  if (fetchError || !sessionData) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-foreground">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-6 w-6 text-amber-700 dark:text-amber-400" />
          <h2 className="text-lg font-semibold text-foreground">{en("Interview recording not found")}</h2>
          <p className="text-sm text-muted-foreground">
            {fetchError || en("We couldn't find this interview recording. Check your interview history.")}
          </p>
          <Button className="w-full" onClick={() => router.push("/dashboard")}>
            {en("Back to dashboard")}
          </Button>
        </div>
      </div>
    );
  }

  const dialogues = parseTranscript(sessionData.transcript || "");
  const score = sessionData?.evaluation?.technicalScore;

  return (
    <div className="flex flex-col text-foreground">
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

      <PageHeader
        title={sessionData?.jobDescription || en("Interview review")}
        description={
          <>
            {en("Candidate: ")}
            <span className="font-medium text-foreground">{sessionData?.candidateName}</span>
            {en(" • Reference ID:")} <span className="font-mono">{sessionId.substring(0, 12)}…</span>
          </>
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
              <span>{en("Back to dashboard")}</span>
            </Button>
            <Button variant="secondary" onClick={() => router.push("/leaderboard")}>
              <Award className="h-4 w-4" />
              <span>{en("Leaderboard")}</span>
            </Button>
          </>
        }
      />

      <div className="w-full flex-1 space-y-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            label={en("Technical skills")}
            value={typeof score === "number" && score >= 0 ? `${score.toFixed(1)}%` : en("Not scored")}
            icon={<Award />}
          />
          <StatTile label={en("Status")} value={<Badge tone="good">{en("Completed")}</Badge>} />
          <StatTile label={en("Length")} value={formatTime(duration)} />
        </div>

        {/* Audio Player Component */}
        <Card
          title={en("Recording")}
          actions={
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          }
        >
          <div className="space-y-4">
            {/* Audio Scrub Bar */}
            <input
              type="range"
              min={0}
              max={duration || 300}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              aria-label={en("Position in recording")}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-indigo-500"
            />

            {/* Controls Strip */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button onClick={togglePlay} aria-label={isPlaying ? en("Pause") : en("Play")}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  aria-label={en("Restart")}
                  onClick={() => {
                    setCurrentTime(0);
                    if (audioRef.current) audioRef.current.currentTime = 0;
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={toggleMute} aria-label={isMuted ? en("Unmute") : en("Mute")}>
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
              </div>

              <Button variant="secondary" onClick={cycleSpeed}>
                <span className="tabular-nums">{en("{playbackSpeed}x speed", { playbackSpeed })}</span>
              </Button>
            </div>
          </div>
        </Card>

        {/* Transcript Visualizer & Flaw Highlights */}
        <Card title={en("Transcript")}>
          {/* Dialogue Stream */}
          <div className="max-h-[600px] space-y-3 overflow-y-auto pe-2">
            {dialogues.length === 0 && <EmptyState title={en("No transcript lines to show.")} />}
            {dialogues.map((msg, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-4 ${
                  msg.speaker === "AI"
                    ? "border-border bg-card"
                    : "ms-6 border-border bg-muted/40"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {msg.speaker === "AI" ? <Bot className="h-4 w-4 text-indigo-700 dark:text-indigo-400" /> : <User className="h-4 w-4 text-muted-foreground" />}
                    <span>{msg.speaker === "AI" ? en("Interviewer") : sessionData?.candidateName || en("Candidate")}</span>
                  </div>

                </div>

                <p className="whitespace-pre-line ps-6 text-sm leading-relaxed text-muted-foreground">{msg.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
