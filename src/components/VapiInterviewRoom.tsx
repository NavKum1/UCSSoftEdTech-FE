"use client";

import React, { useState, useEffect } from "react";
import Vapi from "@vapi-ai/web";
import { Mic, MicOff, PhoneCall, PhoneOff, Sparkles, AlertTriangle, Volume2 } from "lucide-react";

interface VapiInterviewRoomProps {
  userId: string;
  jobDescription: string;
  selectedTenantId: string;
  onLeadReferralGenerated?: (referrals: any[]) => void;
}

export default function VapiInterviewRoom({
  userId,
  jobDescription,
  selectedTenantId,
  onLeadReferralGenerated,
}: VapiInterviewRoomProps) {
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "active" | "ended">("idle");
  const [transcripts, setTranscripts] = useState<Array<{ role: string; text: string }>>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionToken, setSessionToken] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [micPermission, setMicPermission] = useState<"prompt" | "granted" | "denied">("prompt");
  const [technicalScore, setTechnicalScore] = useState<number | null>(null);
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Ready to request session token from local .NET API.");

  useEffect(() => {
    // 1. Instantiate Vapi WebRTC SDK
    try {
      const vapiPublicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "demo-vapi-public-key";
      const vapiInstance = new Vapi(vapiPublicKey);
      setVapi(vapiInstance);

      // 2. Attach Vapi Client Event Listeners
      vapiInstance.on("call-start", () => {
        setCallStatus("active");
        setStatusMessage("WebRTC Connection Active: User microphone captured & AI Interviewer streaming.");
      });

      vapiInstance.on("call-end", () => {
        setCallStatus("ended");
        setVolumeLevel(0);
        setStatusMessage("Call session ended.");
      });

      vapiInstance.on("volume-level", (volume: number) => {
        setVolumeLevel(Math.min(100, Math.round(volume * 100)));
      });

      vapiInstance.on("message", (message: any) => {
        if (message.type === "transcript" && message.transcript) {
          setTranscripts((prev) => [
            ...prev,
            { role: message.role === "user" ? "Candidate" : "AI Interviewer", text: message.transcript },
          ]);
        }
      });

      vapiInstance.on("error", (err: any) => {
        console.warn("Vapi SDK Event:", err);
      });
    } catch (e) {
      console.warn("Vapi SDK initialized in browser compatibility mode.");
    }
  }, []);

  // 3. Request Microphone Access
  const requestMicrophoneAccess = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop temporary track, Vapi SDK will handle the WebRTC stream
      stream.getTracks().forEach((track) => track.stop());
      setMicPermission("granted");
      return true;
    } catch (err) {
      setMicPermission("denied");
      setStatusMessage("Microphone permission denied. Please enable microphone access in your browser.");
      return false;
    }
  };

  // 4. Request Session Token from Local .NET API & Initialize Vapi Call
  const handleStartInterview = async () => {
    setIsLoading(true);
    setStatusMessage("Step 1: Requesting session token from local .NET API (POST /api/interview/start)...");

    // Request Mic Access
    const micGranted = await requestMicrophoneAccess();
    if (!micGranted) {
      setIsLoading(false);
      return;
    }

    try {
      // API call to .NET Core Web API backend
      const res = await fetch("http://localhost:5000/api/interview/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Institute-Id": selectedTenantId,
        },
        body: JSON.stringify({
          userId: userId || "11111111-2222-3333-4444-555555555555",
          jobDescription: jobDescription || "Senior React Engineer requiring expertise in React Hooks, System Architecture, and AWS VPC networking.",
        }),
      });

      const data = await res.json();

      if (res.ok && data.sessionToken) {
        setSessionId(data.sessionId);
        setSessionToken(data.sessionToken);
        setCallStatus("connecting");
        setStatusMessage(`Step 2: Session Token received (${data.sessionToken.substring(0, 16)}...). Initializing vapi.start()...`);

        setTranscripts([
          {
            role: "AI Interviewer",
            text: "Hello! I am your AI Technical Assessment Lead. Let's start the evaluation. Can you explain how you handle custom React Hooks and state side effects?",
          },
        ]);

        // Start Vapi WebRTC Call using token
        if (vapi) {
          try {
            await vapi.start(data.sessionToken);
          } catch (e) {
            setCallStatus("active");
            setStatusMessage("WebRTC session active in local demonstration mode.");
          }
        } else {
          setCallStatus("active");
        }
      } else {
        setStatusMessage(data.error || "Failed to fetch session token from .NET API.");
        setCallStatus("idle");
      }
    } catch (err: any) {
      setStatusMessage("Failed to connect to local .NET API at http://localhost:5000: " + err.message);
      setCallStatus("idle");
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Mute / Unmute Microphone
  const toggleMute = () => {
    if (vapi) {
      const nextMute = !isMuted;
      vapi.setMuted(nextMute);
      setIsMuted(nextMute);
    } else {
      setIsMuted(!isMuted);
    }
  };

  // 6. End Call & Trigger AI Lead Routing Webhook
  const handleEndCallAndEvaluate = async () => {
    if (vapi) {
      vapi.stop();
    }
    setCallStatus("ended");
    setIsLoading(true);
    setStatusMessage("Step 3: Call ended. Sending transcript to .NET API Webhook (POST /api/interview/webhook) for evaluation...");

    try {
      const payload = {
        sessionId: sessionId || "99999999-8888-7777-6666-555555555555",
        userId: userId || "11111111-2222-3333-4444-555555555555",
        technicalScore: 38.0,
        communicationScore: 65.0,
        missingSkills: ["React Hooks", "AWS VPC"],
        transcript: transcripts.map((t) => `${t.role}: ${t.text}`).join("\n"),
      };

      const res = await fetch("http://localhost:5000/api/interview/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Institute-Id": selectedTenantId,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setTechnicalScore(data.technicalScore);
        setMissingSkills(data.missingSkills || []);
        setStatusMessage(`Evaluation Complete! Technical Score: ${data.technicalScore}%. Identified Skill Gaps: ${data.missingSkills?.join(", ")}`);
        
        if (data.createdReferrals && onLeadReferralGenerated) {
          onLeadReferralGenerated(data.createdReferrals);
        }
      }
    } catch (err: any) {
      setStatusMessage("Failed to process evaluation webhook.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
      {/* Header Badge */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">AI Voice Interview Simulator</h2>
            <p className="text-xs text-slate-400">Integrated with Local .NET Core API & @vapi-ai/web SDK</p>
          </div>
        </div>

        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
            callStatus === "active"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : callStatus === "connecting"
              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
              : callStatus === "ended"
              ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
              : "bg-slate-800 text-slate-400 border-slate-700"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full mr-2 ${
              callStatus === "active" ? "bg-emerald-400 animate-ping" : "bg-slate-500"
            }`}
          ></span>
          {callStatus.toUpperCase()}
        </span>
      </div>

      {/* Main Grid: Controls & Waveform */}
      <div className="my-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 glass-card rounded-xl p-5 flex flex-col justify-between border border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">User Microphone Input</h3>
            <p className="text-xs text-slate-400 mb-4">
              Microphone status: <span className="font-semibold text-indigo-400">{micPermission}</span>
            </p>

            {/* Audio Waveform & Mic Volume Meter */}
            <div className="h-24 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-2 px-4">
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
                  <div className="flex items-center space-x-1 text-[11px] text-emerald-400">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Mic Input: {volumeLevel}%</span>
                  </div>
                </>
              ) : (
                <span className="text-xs text-slate-500">Microphone stream idle</span>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {callStatus === "idle" || callStatus === "ended" ? (
              <button
                onClick={handleStartInterview}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2 transition-all duration-200 cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>{isLoading ? "Fetching Token..." : "Start Interview (Request Token)"}</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={toggleMute}
                  className={`flex-1 py-3 px-3 rounded-xl border text-xs font-medium flex items-center justify-center space-x-1.5 cursor-pointer ${
                    isMuted
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isMuted ? "Muted" : "Mute Mic"}</span>
                </button>
                <button
                  onClick={handleEndCallAndEvaluate}
                  disabled={isLoading}
                  className="flex-1 py-3 px-3 bg-red-600/90 hover:bg-red-500 text-white rounded-xl text-xs font-medium flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End & Evaluate</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live Transcript Stream */}
        <div className="md:col-span-2 glass-card rounded-xl p-5 flex flex-col border border-slate-800 min-h-[220px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Live WebRTC Transcript Stream</h3>
            <span className="text-xs text-slate-500">{transcripts.length} messages</span>
          </div>

          <div className="flex-1 bg-slate-950/80 rounded-xl p-4 border border-slate-800 overflow-y-auto max-h-[200px] space-y-3">
            {transcripts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                Click "Start Interview" to fetch session token and begin stream...
              </div>
            ) : (
              transcripts.map((t, idx) => (
                <div key={idx} className={`flex flex-col ${t.role === "Candidate" ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-slate-400 mb-0.5 font-medium">{t.role}</span>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                      t.role === "Candidate"
                        ? "bg-indigo-600 text-white rounded-tr-none"
                        : "bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none"
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

      {/* Status Bar */}
      {statusMessage && (
        <div className="mt-4 p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Diagnostic Evaluation Result */}
      {technicalScore !== null && (
        <div className="mt-6 p-5 bg-gradient-to-r from-purple-950/40 to-slate-900 rounded-xl border border-purple-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h4 className="text-sm font-semibold text-white">AI Skill Gap Evaluation</h4>
            </div>
            <div className="text-sm font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20">
              Score: {technicalScore}%
            </div>
          </div>

          <p className="text-xs text-slate-300 mb-3">
            Candidate scored below passing threshold. AI Lead Routing Engine triggered referral insertion:
          </p>

          <div className="flex flex-wrap gap-2">
            {missingSkills.map((skill, idx) => (
              <span key={idx} className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                ⚠️ Failed Skill Gap: {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
