"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Mic, MicOff, PhoneCall, PhoneOff, AlertTriangle, Volume2, ArrowRight, Info } from "lucide-react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, brandFill, buttonClass } from "@/components/career/ui";

interface OpenAIRealtimeInterviewRoomProps {
  userId?: string;
  jobDescription?: string;
  selectedTenantId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLeadReferralGenerated?: (referrals: any[]) => void;
  personaCode?: string;
  dialectCode?: string;
}

interface TranscriptLine {
  role: "Candidate" | "AI Interviewer";
  text: string;
  timestamp: string;
}

interface PracticeFeedback {
  overallScore: number;
  status?: string;
  disqualificationReason?: string | null;
  dimensions?: Array<{ label: string; score: number }>;
  strengths?: string[];
  improvements?: string[];
}

interface UpgradePrompt {
  message: string;
  usageResetsAt?: string;
}

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function OpenAIRealtimeInterviewRoom({
  jobDescription,
  personaCode,
}: OpenAIRealtimeInterviewRoomProps) {
  const en = useEn();
  const { getToken } = useAuth();

  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "active" | "ended">("idle");
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [micPermission, setMicPermission] = useState<"prompt" | "granted" | "denied">("prompt");
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePrompt | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Ready to begin a practice interview.");

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const volumeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const startedAtRef = useRef<number | null>(null);

  const releaseMedia = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    dataChannelRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
  }, []);

  useEffect(() => {
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioElementRef.current = audioEl;
    document.body.appendChild(audioEl);

    return () => {
      audioEl.remove();
      releaseMedia();
    };
  }, [releaseMedia]);

  const appendTranscript = (role: TranscriptLine["role"], text: string) => {
    if (!text) return;
    transcriptRef.current = [...transcriptRef.current, { role, text, timestamp: new Date().toISOString() }];
    setTranscripts(transcriptRef.current);
  };

  const requestMicrophoneAccess = async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("granted");
      return stream;
    } catch {
      setMicPermission("denied");
      setStatusMessage("Microphone permission denied. Please enable microphone access.");
      return null;
    }
  };

  const setupAudioVolumeMeter = (stream: MediaStream) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext();
    }
    const ctx = audioContextRef.current;
    const analyser = ctx.createAnalyser();
    const microphone = ctx.createMediaStreamSource(stream);
    microphone.connect(analyser);
    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    volumeIntervalRef.current = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      setVolumeLevel(Math.min(100, Math.round((average / 128) * 100)));
    }, 100);
  };

  const handleStartInterview = async () => {
    setIsLoading(true);
    setUpgradePrompt(null);
    setFeedback(null);
    setStatusMessage("Requesting a practice session...");

    let ephemeralToken = "";
    try {
      const res = await authenticatedFetch(
        "/api/interview/token",
        { method: "POST", body: JSON.stringify({ jobDescription, personaCode }) },
        getToken
      );

      if (!res.ok) {
        const err = await readJson<{ error?: string; requiresUpgrade?: boolean; usageResetsAt?: string }>(res);
        if (res.status === 403 && err?.requiresUpgrade) {
          setUpgradePrompt({ message: err.error || "Voice minutes exhausted", usageResetsAt: err.usageResetsAt });
          setStatusMessage("You have no voice minutes left this period.");
          setIsLoading(false);
          return;
        }
        if (res.status === 401) throw new Error("Please sign in to start a practice session.");
        throw new Error(err?.error || "The practice session couldn't start. Please try again in a moment.");
      }

      const data = await readJson<{ client_secret?: string }>(res);
      if (!data?.client_secret) throw new Error("The session couldn't be set up. Please try again.");
      ephemeralToken = data.client_secret;
    } catch (error) {
      setStatusMessage(error instanceof Error && error.message ? error.message : "The practice session couldn't start. Please try again in a moment.");
      setIsLoading(false);
      return;
    }

    setStatusMessage("Requesting microphone access...");
    const stream = await requestMicrophoneAccess();
    if (!stream) {
      setIsLoading(false);
      return;
    }
    localStreamRef.current = stream;
    setupAudioVolumeMeter(stream);

    transcriptRef.current = [];
    setTranscripts([]);
    setCallStatus("connecting");
    setStatusMessage("Connecting...");

    const pc = new RTCPeerConnection();
    peerConnectionRef.current = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      if (audioElementRef.current) {
        audioElementRef.current.srcObject = event.streams[0];
      }
    };

    const dc = pc.createDataChannel("oai-events");
    dataChannelRef.current = dc;

    dc.onopen = () => {
      startedAtRef.current = Date.now();
      setCallStatus("active");
      setStatusMessage("Connected. The practice interviewer is ready.");
      dc.send(
        JSON.stringify({
          type: "response.create",
          response: {
            modalities: ["audio", "text"],
            instructions: "Introduce yourself as the technical interviewer and ask the candidate if they are ready to begin.",
          },
        })
      );
    };

    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "response.audio_transcript.done") appendTranscript("AI Interviewer", msg.transcript);
        if (msg.type === "conversation.item.input_audio_transcription.completed") appendTranscript("Candidate", msg.transcript);
      } catch (err) {
        console.error("Error parsing data channel message", err);
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralToken}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        const errDetail = await sdpResponse.text().catch(() => "");
        console.warn("Realtime connection failed", sdpResponse.status, errDetail);
        throw new Error("connect");
      }

      await pc.setRemoteDescription({ type: "answer", sdp: await sdpResponse.text() });
    } catch {
      releaseMedia();
      setStatusMessage("We couldn't connect the voice session. Check your internet connection and microphone, then try again.");
      setCallStatus("idle");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleEndPractice = async () => {
    releaseMedia();
    setVolumeLevel(0);
    setCallStatus("ended");

    const lines = transcriptRef.current;
    if (lines.length === 0) {
      setStatusMessage("Practice session ended.");
      return;
    }

    setIsLoading(true);
    setStatusMessage("Practice session ended. Preparing feedback...");

    try {
      const startedAt = startedAtRef.current;
      const durationMinutes = startedAt ? Math.max(1, Math.ceil((Date.now() - startedAt) / 60000)) : 1;
      const res = await authenticatedFetch(
        "/api/interview/evaluate",
        {
          method: "POST",
          body: JSON.stringify({
            jobDescription,
            personaCode,
            durationMinutes,
            transcripts: lines.map((t) => ({
              role: t.role === "Candidate" ? "candidate" : "interviewer",
              text: t.text,
              timestamp: t.timestamp,
            })),
          }),
        },
        getToken
      );

      const data = await readJson<PracticeFeedback>(res);
      if (!res.ok || !data) throw new Error(`HTTP ${res.status}`);
      setFeedback(data);
      setStatusMessage("Practice feedback ready.");
    } catch {
      setStatusMessage("Could not generate practice feedback.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{en("AI voice interview practice")}</h2>
            <p className="text-sm text-muted-foreground">{en("Practice — not graded, no credential")}</p>
          </div>
        </div>

        <Badge tone={callStatus === "active" ? "good" : callStatus === "connecting" ? "warn" : "neutral"}>
            {callStatus.charAt(0).toUpperCase() + callStatus.slice(1)}
          </Badge>
      </div>

      <div className="mt-4 p-3 rounded-xl border border-border bg-muted/50 text-xs text-muted-foreground flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-700 dark:text-indigo-400" />
        <span>
          {en("Practice — not graded, no credential. Feedback here is for your own preparation and is never shared with employers. Starting a session reserves up to one session’s maximum length from your voice balance.")}
        </span>
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
                    <span>{en("Mic input: {volumeLevel}%", { volumeLevel })}</span>
                  </div>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">{en("Microphone idle")}</span>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {callStatus === "idle" || callStatus === "ended" ? (
              <Button
                onClick={handleStartInterview}
                disabled={isLoading}
                className="h-10 w-full"
              >
                <PhoneCall className="w-4 h-4" />
                <span>{isLoading ? en("Please wait…") : en("Start practice interview")}</span>
              </Button>
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
                  onClick={handleEndPractice}
                  disabled={isLoading}
                  className="h-10 flex-1"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>{en("End practice")}</span>
                </Button>
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
                {en("The transcript appears here once the practice session starts.")}
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

      {feedback && (
        <div className="mt-6 p-5 bg-card border border-border rounded-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">{en("Practice feedback")}</h4>
              <p className="text-xs text-muted-foreground">{en("Not graded · no credential · not shared")}</p>
            </div>
            <div className="text-sm font-semibold tabular-nums text-foreground bg-muted px-3 py-1 rounded-lg border border-border">
              {en("Practice score: {overallScore}%", { overallScore: Math.round(feedback.overallScore) })}</div>
          </div>

          {feedback.disqualificationReason && (
            <p className="text-xs text-amber-800 dark:text-amber-300">{feedback.disqualificationReason}</p>
          )}

          {feedback.dimensions && feedback.dimensions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {feedback.dimensions.map((d) => (
                <div key={d.label} className="p-2.5 rounded-lg border border-border bg-background/60 text-xs flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-semibold text-foreground">{Math.round(d.score)}%</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {feedback.strengths && feedback.strengths.length > 0 && (
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">{en("Strengths")}</p>
                <ul className="list-disc ps-4 space-y-1 text-muted-foreground">
                  {feedback.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {feedback.improvements && feedback.improvements.length > 0 && (
              <div>
                <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">{en("To improve")}</p>
                <ul className="list-disc ps-4 space-y-1 text-muted-foreground">
                  {feedback.improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
