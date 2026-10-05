"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Eye,
  Maximize2,
  Minimize2,
  Copy,
  Activity,
  History,
  ChevronDown,
  ChevronUp,
  Fingerprint,
  Lock,
} from "lucide-react";

import { API_BASE_URL } from "@/lib/apiClient";

interface ProctoringHUDProps {
  sessionId: string;
  candidateEmail?: string;
  onViolationOccurred?: (type: string, severity: string, score: number) => void;
  apiBaseUrl?: string;
}

interface IncidentItem {
  id: string;
  eventType: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  message: string;
  timestamp: string;
}

export default function ProctoringHUD({
  sessionId,
  candidateEmail = "candidate@ucsoft.edu",
  onViolationOccurred,
  apiBaseUrl = API_BASE_URL,
}: ProctoringHUDProps) {
  const [integrityScore, setIntegrityScore] = useState<number>(100);
  const [riskLevel, setRiskLevel] = useState<"Clean" | "Suspicious" | "Flagged">("Clean");
  const [isDisqualified, setIsDisqualified] = useState<boolean>(false);
  const [totalViolations, setTotalViolations] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [liveTimestamp, setLiveTimestamp] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      setLiveTimestamp(new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const blurTimeRef = useRef<number | null>(null);

  // Ingest telemetry event to backend
  const sendTelemetryEvent = async (
    eventType: string,
    severity: "Low" | "Medium" | "High" | "Critical",
    metadata: Record<string, unknown>
  ) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/proctoring/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          eventType,
          severity,
          metadata,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIntegrityScore(data.integrityScore);
        setRiskLevel(data.riskLevel);
        setIsDisqualified(data.isDisqualified);
        setTotalViolations(data.totalViolations);

        const newIncident: IncidentItem = {
          id: Math.random().toString(36).substring(7),
          eventType,
          severity,
          message: `${eventType} (${severity}): ${JSON.stringify(metadata)}`,
          timestamp: new Date().toLocaleTimeString(),
        };

        setIncidents((prev) => [newIncident, ...prev].slice(0, 15));

        setToastMessage(`Security Event: ${eventType} logged.`);
        setTimeout(() => setToastMessage(null), 4000);

        if (onViolationOccurred) {
          onViolationOccurred(eventType, severity, data.integrityScore);
        }
      }
    } catch (err) {
      console.error("Proctoring telemetry dispatch error:", err);
    }
  };

  useEffect(() => {
    if (!sessionId) return;

    // 1. Tab Switch & Visibility Change Detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        blurTimeRef.current = Date.now();
      } else {
        const blurDuration = blurTimeRef.current
          ? Date.now() - blurTimeRef.current
          : 0;
        blurTimeRef.current = null;

        const severity = blurDuration > 4000 ? "High" : "Medium";
        sendTelemetryEvent("TabSwitch", severity, {
          durationMs: blurDuration,
          hiddenState: true,
        });
      }
    };

    // 2. Window Blur / Focus Loss Detection
    const handleBlur = () => {
      blurTimeRef.current = Date.now();
    };

    const handleFocus = () => {
      if (blurTimeRef.current) {
        const duration = Date.now() - blurTimeRef.current;
        blurTimeRef.current = null;
        if (duration > 1500) {
          sendTelemetryEvent("WindowBlur", duration > 5000 ? "High" : "Low", {
            durationMs: duration,
          });
        }
      }
    };

    // 3. Full-Screen Change Detection
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) {
        sendTelemetryEvent("FullScreenExit", "Medium", {
          windowInnerWidth: window.innerWidth,
          windowInnerHeight: window.innerHeight,
        });
      }
    };

    // 4. Global Clipboard Paste Listener
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text") || "";
      const charCount = text.length;
      if (charCount > 250) {
        const severity = charCount > 1000 ? "Critical" : "High";
        sendTelemetryEvent("ClipboardPaste", severity, {
          characterCount: charCount,
          snippetPreview: text.slice(0, 40) + "...",
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("paste", handlePaste);
    };
  }, [sessionId]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Full screen request rejected:", err);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const getStatusColor = () => {
    if (isDisqualified) return "border-red-300 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-950/80 dark:text-red-300";
    if (riskLevel === "Flagged") return "border-red-300 bg-red-50 text-red-900 dark:border-red-500 dark:bg-red-950/40 dark:text-red-400";
    if (riskLevel === "Suspicious") return "border-amber-300 bg-amber-50 text-amber-900 dark:border-yellow-500 dark:bg-yellow-950/40 dark:text-yellow-400";
    return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400";
  };

  return (
    <div className="w-full">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-yellow-500/50 text-yellow-600 dark:text-yellow-300 text-xs shadow-2xl animate-bounce">
          <AlertTriangle className="w-4 h-4 text-yellow-700 dark:text-yellow-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main HUD Bar */}
      <div
        className={`flex flex-wrap items-center justify-between p-3 rounded-xl border backdrop-blur-md transition-all ${getStatusColor()}`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            {riskLevel === "Clean" ? (
              <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-yellow-700 dark:text-yellow-400 animate-pulse" />
            )}
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs tracking-wider uppercase text-foreground">
                Integrity Monitor
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  riskLevel === "Clean"
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                    : riskLevel === "Suspicious"
                    ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-300"
                    : "bg-red-500/20 text-red-600 dark:text-red-300"
                }`}
              >
                {isDisqualified ? "DISQUALIFIED" : riskLevel}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Session Integrity Active (Focus, Tab, Clipboard)
            </p>
          </div>
        </div>

        {/* Score & Telemetry Metrics */}
        <div className="flex items-center gap-4 mt-2 sm:mt-0">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-100 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-300 text-[10px] font-mono shadow-sm">
            <Fingerprint className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-400 animate-pulse" />
            <span>VERIFICATION ACTIVE</span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
              Integrity Score
            </span>
            <span className="text-lg font-black tracking-tight text-foreground">
              {integrityScore}%
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
              Notices
            </span>
            <span className="text-sm font-semibold text-foreground">
              {totalViolations} logged
            </span>
          </div>

          {/* Full-Screen Toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Exam Fullscreen"}
            className="p-1.5 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* Expand Ledger */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors"
          >
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Activity Log</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Incident Ledger */}
      {isExpanded && (
        <div className="mt-2 p-3 rounded-xl bg-card border border-border text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <History className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
              Session Activity History ({incidents.length})
            </span>
            <span className="text-[10px] text-muted-foreground">
              Real-time activity log
            </span>
          </div>

          {incidents.length === 0 ? (
            <p className="py-2 text-center text-zinc-500 text-xs italic">
              No issues detected in this session. All good!
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="flex items-center justify-between p-2 rounded bg-zinc-800/50 border border-zinc-700/50 text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        inc.severity === "Critical"
                          ? "bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30"
                          : inc.severity === "High"
                          ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                          : inc.severity === "Medium"
                          ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30"
                          : "bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {inc.severity}
                    </span>
                    <span className="text-foreground font-mono font-medium">
                      {inc.eventType}
                    </span>
                    <span className="text-muted-foreground truncate max-w-xs">
                      {inc.message}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-[10px] font-mono">
                    {inc.timestamp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dynamic Forensic Watermark Overlay (Anti-Leak & Steganography Shield) */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden select-none opacity-[0.06] flex flex-col justify-around">
        {Array.from({ length: 6 }).map((_, rIdx) => (
          <div
            key={rIdx}
            className="flex justify-around whitespace-nowrap transform -rotate-12 text-[11px] font-mono tracking-widest text-cyan-600 dark:text-cyan-300 font-bold"
          >
            {Array.from({ length: 4 }).map((_, cIdx) => (
              <span key={cIdx} className="px-8">
                {candidateEmail} • Session ID: {sessionId.slice(0, 8)} • {liveTimestamp} • Verified Session
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
