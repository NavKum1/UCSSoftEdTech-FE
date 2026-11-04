"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";
import { AlertTriangle, ArrowLeft, Award, Bot, Clock, Globe2, Pause, Play, RotateCcw, User, Volume2 } from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, Card, Loading, PageHeader, StatTile } from "@/components/career/ui";

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
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
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
    if (!ready) return;
    const fetchReplay = async () => {
      if (!sessionId) return;
      try {
        setFetchError(null);
        const res = await apiFetch(`/api/interview/${sessionId}/replay`);
        if (res.ok) {
          const data = await res.json();
          setReplay(data);
          if (data.durationSeconds) setAudioDuration(data.durationSeconds);
        } else {
          setFetchError("We couldn't find this recording. It may have been removed, or the link may be wrong.");
          setReplay(null);
        }
      } catch (e) {
        console.error("Replay fetch error:", e);
        setFetchError(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message || "We couldn't load this recording. Please try again.");
        setReplay(null);
      } finally {
        setLoading(false);
      }
    };

    fetchReplay();
  }, [sessionId, ready, apiFetch]);

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

  if (access) return <AccessNotice problem={access} feature="This interview replay" />;

  if (loading) {
    return <Loading label={en("Loading the recording…")} />;
  }

  if (fetchError || !replay) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-foreground">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-6 w-6 text-amber-700 dark:text-amber-400" />
          <h2 className="text-lg font-semibold text-foreground">{en("Recording not found")}</h2>
          <p className="text-sm text-muted-foreground">
            {fetchError || en("This interview recording doesn't exist or has expired.")}
          </p>
          <Button className="w-full" onClick={() => router.push("/dashboard")}>
            {en("Back to dashboard")}
          </Button>
        </div>
      </div>
    );
  }

  // Null while the interview is not scored (grader unavailable, or still processing): shown as "Not scored", never a number
  const rawScore = replay?.evaluation?.technicalScore;
  const technicalScore = typeof rawScore === "number" && rawScore >= 0 ? Math.round(rawScore) : null;
  const watermarkOwner = replay?.candidateEmail || replay?.candidateName || "";

  return (
    <div className="relative text-foreground">
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={replay?.recordingUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />

      <PageHeader
        title={en("Interview recording: {candidateName}", { candidateName: replay?.candidateName })}
        description={replay?.jobDescription || en("Listen to the interview and follow along in the transcript.")}
        actions={
          <>
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              <span>{en("Back")}</span>
            </Button>
            <Button variant="secondary" onClick={() => router.push(`/interview/${sessionId}/translation`)}>
              <Globe2 className="h-4 w-4" />
              <span>{en("Translate transcript")}</span>
            </Button>
          </>
        }
      />

      <div className="relative z-10 space-y-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label={en("Technical score")} value={technicalScore === null ? en("Not scored") : `${technicalScore}%`} icon={<Award />} />
          <StatTile label={en("Length")} value={replay?.durationFormatted || formatSec(audioDuration)} icon={<Clock />} />
          <StatTile label={en("Session")} value={<span className="font-mono text-base">{sessionId.slice(0, 8)}</span>} hint={en("Screen watermarked with the candidate's email")} />
        </div>

        {/* Interactive Audio Player Bar */}
        <Card>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-indigo-700 dark:text-indigo-400" />
                <span>{en("Recording")}</span>
              </div>
              <span className="font-mono text-xs tabular-nums">
                {formatSec(currentTime)} / {formatSec(audioDuration)}
              </span>
            </div>

            {/* Progress Scrubber */}
            <div
              className="relative h-2 w-full cursor-pointer overflow-hidden rounded-full bg-muted"
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
              <div className="h-full bg-indigo-500 transition-all duration-150" style={{ width: `${(currentTime / audioDuration) * 100}%` }} />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 pt-1">
              <Button onClick={togglePlay} aria-label={isPlaying ? en("Pause") : en("Play")}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                aria-label={en("Restart")}
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    setCurrentTime(0);
                  }
                }}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{isPlaying ? en("Playing…") : en("Paused")}</span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Synchronized Transcript Player (2 cols) */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">{en("Transcript")}</h2>
              <span className="text-sm text-muted-foreground">{en("Select a line to jump to it")}</span>
            </div>

            <div className="max-h-[600px] space-y-3 overflow-y-auto pe-2">
              {replay?.transcriptSegments.map((seg) => {
                const isActive = activeSegmentIndex === seg.index;
                return (
                  <div
                    key={seg.index}
                    onClick={() => seekToSegment(seg.timeOffsetSeconds, seg.index)}
                    className={`cursor-pointer rounded-xl border bg-card p-4 text-start shadow-sm transition-colors ${
                      isActive ? "border-indigo-500 ring-1 ring-indigo-500" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        {seg.isAi ? <Bot className="h-4 w-4 text-indigo-700 dark:text-indigo-400" /> : <User className="h-4 w-4 text-muted-foreground" />}
                        <span>{seg.speaker}</span>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{seg.timeFormatted}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{seg.text}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Defense Evaluation Sidebar (1 col) */}
          <div className="space-y-6">
            <Card title={en("Code issues discussed")}>
              <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                {en("The AI interviewer asked about these issues during the conversation:")}
              </p>
              {(replay?.evaluation?.architecturalFlaws ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{en("None recorded.")}</p>
              ) : (
                <div className="space-y-2">
                  {replay?.evaluation?.architecturalFlaws.map((flaw, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                      <span className="text-sm leading-relaxed text-foreground">{flaw}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title={en("Assessment")}>
              <div>
                <div className="mb-1 flex justify-between text-sm text-muted-foreground">
                  <span>{en("Technical defense")}</span>
                  <span className="font-medium text-foreground">{technicalScore === null ? en("Not scored") : `${technicalScore}%`}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${technicalScore ?? 0}%` }} />
                </div>
              </div>

              <Button variant="secondary" className="mt-4 w-full" onClick={() => router.push("/leaderboard")}>
                <Award className="h-4 w-4" />
                <span>{en("View leaderboard")}</span>
              </Button>
            </Card>
          </div>
        </div>
      </div>

      {/* Watermark overlay: the viewer's email and the time, so screenshots can be traced */}
      <div className="pointer-events-none fixed inset-0 z-30 flex select-none flex-col justify-around overflow-hidden opacity-[0.05]">
        {Array.from({ length: 7 }).map((_, rIdx) => (
          <div key={rIdx} className="flex -rotate-12 transform justify-around whitespace-nowrap font-mono text-xs font-semibold text-foreground">
            {Array.from({ length: 4 }).map((_, cIdx) => (
              <span key={cIdx} className="px-10">
                {watermarkOwner} • {sessionId.slice(0, 8)} • {liveUtcTimestamp}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
