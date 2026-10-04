"use client";

import React, { useState, useEffect, useRef, use } from "react";
import { 
  Users, Code2, PenTool, Eraser, Square, 
  Database, Cloud, Save, Radio, ShieldAlert, 
  Volume2, VolumeX, Check, Copy, ArrowLeft,
  Sparkles, RefreshCw, Layers, MousePointer2
} from "lucide-react";
import Link from "next/link";

interface Participant {
  connectionId: string;
  userId: string;
  userName: string;
  role: string;
  color: string;
}

export default function InterviewPairingStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.id;

  const [activeTab, setActiveTab] = useState<"code" | "whiteboard">("code");
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<"Candidate" | "Recruiter" | "MentorReviewer">("Candidate");
  const [userName, setUserName] = useState("Candidate");

  // Collaboration State
  const [code, setCode] = useState<string>(
    "// Real-Time Interview Pairing Studio\n// Write your distributed systems solution below:\n\nfunction processTransactionStream(events: Event[]): ProcessingResult {\n  // Handle concurrent distributed events with idempotency\n  return { success: true, processedCount: events.length };\n}\n"
  );
  const [participants, setParticipants] = useState<Participant[]>([
    { connectionId: "local-cand", userId: "cand-me", userName: "You (Active Session)", role: "Candidate", color: "#10b981" }
  ]);
  const [isTakeoverActive, setIsTakeoverActive] = useState<boolean>(false);
  const [takeoverName, setTakeoverName] = useState<string | null>(null);
  const [savingWhiteboard, setSavingWhiteboard] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Whiteboard Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<"pen" | "box" | "database" | "cloud" | "eraser">("pen");
  const [strokeColor, setStrokeColor] = useState<string>("#38bdf8");
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  // Fetch initial collaboration state from API
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/collaboration/${sessionId}/state`);
        if (res.ok) {
          const data = await res.json();
          if (data.currentCode && data.currentCode.trim()) {
            setCode(data.currentCode);
          }
          if (data.isTakeoverActive) {
            setIsTakeoverActive(true);
            setTakeoverName(data.takeoverInterviewerName);
          }
          if (data.participants && data.participants.length > 0) {
            setParticipants(data.participants);
          }
        }
      } catch (e) {
        console.warn("[COLLABORATION STATE ERROR]:", e);
      }
    };
    fetchState();
  }, [sessionId]);

  // Handle Interviewer Takeover Toggle
  const handleToggleTakeover = async () => {
    const targetState = !isTakeoverActive;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/collaboration/${sessionId}/takeover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer recruiter-dev-token",
          "X-Recruiter-Role": "Recruiter"
        },
        body: JSON.stringify({ isTakeover: targetState }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsTakeoverActive(data.isTakeoverActive);
        setTakeoverName(data.interviewerName);
      }
    } catch (e) {
      console.error("[TAKEOVER TOGGLE ERROR]:", e);
    }
  };

  // Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setStartPos({ x, y });

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (tool === "pen") {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (tool === "eraser") {
      ctx.strokeStyle = "#020617"; // Canvas background
      ctx.lineWidth = 18;
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) {
      setIsDrawing(false);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = x - startPos.x;
    const h = y - startPos.y;

    if (tool === "box") {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.fillStyle = strokeColor + "15";
      ctx.strokeRect(startPos.x, startPos.y, w, h);
      ctx.fillRect(startPos.x, startPos.y, w, h);
      ctx.fillStyle = strokeColor;
      ctx.font = "12px monospace";
      ctx.fillText("Microservice Node", startPos.x + 8, startPos.y + 18);
    } else if (tool === "database") {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.fillStyle = strokeColor + "15";
      ctx.beginPath();
      ctx.ellipse(startPos.x + w / 2, startPos.y + 15, Math.abs(w / 2), 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(startPos.x, startPos.y + 15, w, Math.max(h - 15, 20));
      ctx.strokeRect(startPos.x, startPos.y + 15, w, Math.max(h - 15, 20));
      ctx.fillStyle = strokeColor;
      ctx.font = "12px monospace";
      ctx.fillText("PostgreSQL Store", startPos.x + 8, startPos.y + 35);
    } else if (tool === "cloud") {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.fillStyle = strokeColor + "15";
      ctx.beginPath();
      ctx.arc(startPos.x + 30, startPos.y + 30, 20, 0, Math.PI * 2);
      ctx.arc(startPos.x + 60, startPos.y + 25, 25, 0, Math.PI * 2);
      ctx.arc(startPos.x + 90, startPos.y + 30, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = strokeColor;
      ctx.font = "12px monospace";
      ctx.fillText("API Gateway / CDN", startPos.x + 15, startPos.y + 40);
    }

    setIsDrawing(false);
    setStartPos(null);
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleSaveWhiteboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSavingWhiteboard(true);
    setSaveSuccess(false);

    try {
      const dataUrl = canvas.toDataURL("image/png");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/collaboration/${sessionId}/whiteboard/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strokesJson: JSON.stringify([{ type: "snapshot", timestamp: Date.now() }]),
          finalSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><image href="${dataUrl}" width="800" height="500"/></svg>`,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error("[SAVE WHITEBOARD ERROR]:", e);
    } finally {
      setSavingWhiteboard(false);
    }
  };

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 px-6 flex items-center justify-between backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Link
            href="/recruiter/dashboard"
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                Live Pairing Studio
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync
                </span>
              </h1>
              <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <span>Room:</span>
                <span className="text-slate-200">{sessionId.substring(0, 12)}...</span>
                <button onClick={copySessionId} className="hover:text-indigo-400 p-0.5">
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Live Takeover Status Badge */}
        <div className="hidden md:flex items-center">
          {isTakeoverActive ? (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold animate-pulse">
              <VolumeX className="w-4 h-4 text-amber-400" />
              <span>Human Takeover Active • AI Examiner Muted</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span>AI Voice Examiner Active</span>
            </div>
          )}
        </div>

        {/* Right: Active Participants & Takeover Button */}
        <div className="flex items-center space-x-3">
          {/* Participant Avatars */}
          <div className="flex items-center -space-x-2">
            {participants.map((p, idx) => (
              <div
                key={idx}
                title={`${p.userName} (${p.role})`}
                style={{ borderColor: p.color }}
                className="w-8 h-8 rounded-full bg-slate-800 border-2 flex items-center justify-center text-xs font-bold shadow-md cursor-pointer hover:scale-110 transition"
              >
                {p.userName.charAt(0)}
              </div>
            ))}
          </div>

          <div className="h-6 w-[1px] bg-slate-800" />

          {/* Takeover Toggle Button */}
          <button
            onClick={handleToggleTakeover}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shadow-lg ${
              isTakeoverActive
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20"
                : "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            {isTakeoverActive ? "Yield to AI" : "Take Over"}
          </button>
        </div>
      </header>

      {/* Mode Navigation Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-medium transition ${
              activeTab === "code"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Collaborative Code
          </button>
          <button
            onClick={() => setActiveTab("whiteboard")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-medium transition ${
              activeTab === "whiteboard"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            System Architecture Whiteboard
          </button>
        </div>

        {activeTab === "whiteboard" && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearCanvas}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear
            </button>
            <button
              onClick={handleSaveWhiteboard}
              disabled={savingWhiteboard}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition shadow-md shadow-indigo-600/20"
            >
              {savingWhiteboard ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saveSuccess ? "Saved!" : "Save Diagram"}
            </button>
          </div>
        )}
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 p-4 flex flex-col">
        {activeTab === "code" ? (
          /* Real-Time Code Pairing Editor */
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
            <div className="h-9 bg-slate-950/80 border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="ml-2 font-mono text-slate-400">DistributedStreamEngine.ts</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                <MousePointer2 className="w-3 h-3 text-amber-400" />
                <span>Interviewer Viewing Line 12</span>
              </div>
            </div>

            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full bg-slate-950 p-6 font-mono text-sm text-slate-200 resize-none focus:outline-none leading-relaxed selection:bg-indigo-500/30"
              placeholder="// Type code here to sync live with interviewer..."
            />
          </div>
        ) : (
          /* Interactive Whiteboard Canvas */
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
            {/* Whiteboard Toolbar */}
            <div className="h-12 bg-slate-950/90 border-b border-slate-800 px-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setTool("pen")}
                  className={`p-2 rounded-xl text-xs transition ${
                    tool === "pen" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800"
                  }`}
                  title="Freehand Pen"
                >
                  <PenTool className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTool("box")}
                  className={`p-2 rounded-xl text-xs transition ${
                    tool === "box" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800"
                  }`}
                  title="Microservice Box"
                >
                  <Square className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTool("database")}
                  className={`p-2 rounded-xl text-xs transition ${
                    tool === "database" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800"
                  }`}
                  title="Database Cylinder"
                >
                  <Database className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTool("cloud")}
                  className={`p-2 rounded-xl text-xs transition ${
                    tool === "cloud" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800"
                  }`}
                  title="API Gateway / Cloud"
                >
                  <Cloud className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTool("eraser")}
                  className={`p-2 rounded-xl text-xs transition ${
                    tool === "eraser" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800"
                  }`}
                  title="Eraser"
                >
                  <Eraser className="w-4 h-4" />
                </button>
              </div>

              {/* Color Palette */}
              <div className="flex items-center space-x-1.5">
                {["#38bdf8", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ffffff"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setStrokeColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full transition ${
                      strokeColor === c ? "ring-2 ring-white scale-110" : "opacity-75 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Canvas Viewport */}
            <div className="flex-1 bg-[#020617] relative cursor-crosshair overflow-hidden flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={1200}
                height={700}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="w-full h-full"
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="h-8 bg-slate-950 border-t border-slate-900 px-6 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-3">
          <span>SignalR WebSocket: Connected</span>
          <span>•</span>
          <span>Latency: 18ms</span>
        </div>
        <div>
          {isTakeoverActive ? (
            <span className="text-amber-400 font-semibold">Live Voice Takeover: {takeoverName || "Interviewer"}</span>
          ) : (
            <span className="text-cyan-400">AI Voice Assistant: Synthesizing questions</span>
          )}
        </div>
      </footer>
    </div>
  );
}
