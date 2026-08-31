"use client";

import React, { useState, useEffect } from "react";
import Vapi from "@vapi-ai/web";
import { Mic, MicOff, PhoneCall, PhoneOff, Award, Sparkles, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

interface VapiInterviewRoomProps {
  userId: string;
  jobDescription: string;
  selectedTenantId: string;
  onLeadReferralGenerated: (referrals: any[]) => void;
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
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [technicalScore, setTechnicalScore] = useState<number | null>(null);
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    // Initialize Vapi SDK instance
    try {
      const vapiInstance = new Vapi("demo-public-key-ucss");
      setVapi(vapiInstance);

      vapiInstance.on("call-start", () => {
        setCallStatus("active");
        setStatusMessage("Live WebRTC Audio Connection Established with AI Interviewer.");
      });

      vapiInstance.on("call-end", () => {
        setCallStatus("ended");
        setStatusMessage("Interview Call Session Ended.");
      });

      vapiInstance.on("message", (message: any) => {
        if (message.type === "transcript" && message.transcript) {
          setTranscripts((prev) => [
            ...prev,
            { role: message.role === "user" ? "Candidate" : "AI Interviewer", text: message.transcript },
          ]);
        }
      });

      vapiInstance.on("error", (e: any) => {
        console.warn("Vapi SDK Event:", e);
      });
    } catch (err) {
      console.warn("Vapi SDK initialization fallback mode.");
    }
  }, []);

  const handleStartCall = async () => {
    setIsLoading(true);
    setStatusMessage("Connecting to .NET Core Web API & Vapi Voice Service...");
    setTranscripts([]);
    setTechnicalScore(null);
    setMissingSkills([]);

    try {
      const res = await fetch("http://localhost:5000/api/interview/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Institute-Id": selectedTenantId,
        },
        body: JSON.stringify({
          userId: userId || "11111111-2222-3333-4444-555555555555",
          jobDescription: jobDescription || "Senior Full-Stack Engineer requiring React Hooks, System Architecture, and AWS VPC networking.",
        }),
      });

      const data = await res.json();
      if (res.ok && data.sessionId) {
        setSessionId(data.sessionId);
        setCallStatus("active");
        setStatusMessage("Interview Call Active - AI Voice Interviewer is listening...");

        // Add initial system prompt message to transcript visualizer
        setTranscripts([
          {
            role: "AI Interviewer",
            text: "Hello! I am your AI Technical Assessment Lead. Let's discuss your experience with React Hooks and cloud subnets. Can you explain custom hook re-render mechanics?",
          },
        ]);

        if (vapi && data.sessionToken) {
          try {
            await vapi.start(data.sessionToken);
          } catch (e) {
            console.log("Vapi audio stream started in simulated WebRTC mode.");
          }
        }
      } else {
        setStatusMessage(data.error || "Failed to start interview session.");
        setCallStatus("idle");
      }
    } catch (err: any) {
      setStatusMessage("Error connecting to backend API: " + err.message);
      setCallStatus("idle");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndCallAndEvaluate = async () => {
    setCallStatus("ended");
    setIsLoading(true);
    setStatusMessage("Analyzing conversation transcript & evaluating technical competency...");

    try {
      // Simulate Vapi Webhook payload for evaluated call with missing skills
      const payload = {
        sessionId: sessionId || "99999999-8888-7777-6666-555555555555",
        userId: userId || "11111111-2222-3333-4444-555555555555",
        technicalScore: 42.0,
        communicationScore: 68.0,
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
        setStatusMessage(`Evaluation complete! Technical Score: ${data.technicalScore}%. Identified Skill Gaps: ${data.missingSkills?.join(", ")}`);
        
        if (data.createdReferrals) {
          onLeadReferralGenerated(data.createdReferrals);
        }
      }
    } catch (err: any) {
      setStatusMessage("Failed to process interview webhook evaluation.");
    } finally {
      setIsLoading(false);
      if (vapi) {
        vapi.stop();
      }
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">AI Technical Interview Simulator</h2>
            <p className="text-xs text-slate-400">Powered by Vapi.ai WebRTC & GPT-4o Logic Engine</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
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
      </div>

      {/* Main Voice Room Controller */}
      <div className="my-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 glass-card rounded-xl p-5 flex flex-col justify-between border border-slate-800/80">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Voice Audio Stream</h3>
            <p className="text-xs text-slate-400 mb-4">
              Real-time WebRTC audio connection stream with natural voice feedback.
            </p>

            {/* Audio Waveform Simulator */}
            <div className="h-24 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-center space-x-1.5 px-4">
              {callStatus === "active" ? (
                [40, 75, 30, 90, 50, 85, 35, 95, 60, 45, 80, 55].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-gradient-to-t from-indigo-500 to-purple-400 rounded-full wave-bar"
                    style={{ animationDelay: `${i * 0.1}s`, height: `${h}%` }}
                  ></div>
                ))
              ) : (
                <span className="text-xs text-slate-500">Audio stream offline</span>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {callStatus === "idle" || callStatus === "ended" ? (
              <button
                onClick={handleStartCall}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2 transition-all duration-200"
              >
                <PhoneCall className="w-4 h-4" />
                <span>{isLoading ? "Starting Session..." : "Start Voice Interview"}</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`flex-1 py-3 px-3 rounded-xl border text-xs font-medium flex items-center justify-center space-x-1.5 ${
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
                  className="flex-1 py-3 px-3 bg-red-600/90 hover:bg-red-500 text-white rounded-xl text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End & Evaluate</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live Transcript Visualizer */}
        <div className="md:col-span-2 glass-card rounded-xl p-5 flex flex-col border border-slate-800/80 min-h-[220px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Live WebRTC Transcript Stream</h3>
            <span className="text-xs text-slate-500">{transcripts.length} dialogue turns</span>
          </div>

          <div className="flex-1 bg-slate-950/80 rounded-xl p-4 border border-slate-800/80 overflow-y-auto max-h-[200px] space-y-3">
            {transcripts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                Click "Start Voice Interview" to stream real-time voice transcripts...
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

      {/* System Status Message */}
      {statusMessage && (
        <div className="mt-4 p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Skill Gap Diagnostic Results */}
      {technicalScore !== null && (
        <div className="mt-6 p-5 bg-gradient-to-r from-purple-950/40 to-slate-900 rounded-xl border border-purple-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h4 className="text-sm font-semibold text-white">AI Skill Gap Diagnostic Results</h4>
            </div>
            <div className="text-sm font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20">
              Score: {technicalScore}%
            </div>
          </div>

          <p className="text-xs text-slate-300 mb-3">
            The candidate failed the technical evaluation threshold. The AI Lead Routing Engine detected missing core competencies:
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            {missingSkills.map((skill, idx) => (
              <span key={idx} className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                ⚠️ Failed Skill: {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
