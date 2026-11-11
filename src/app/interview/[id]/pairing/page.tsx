"use client";

import React, { useState, useEffect, useRef, use } from "react";
import { ArrowLeft, Check, Cloud, Code2, Copy, Database, Eraser, Layers, PenTool, Save, ShieldAlert, Square, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import * as signalR from "@microsoft/signalr";
import { getApiBaseUrl } from "@/lib/apiClient";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, PageHeader, Tabs, buttonClass } from "@/components/career/ui";

interface Participant {
  connectionId: string;
  userId: string;
  userName: string;
  role: string;
  color: string;
}

export default function InterviewPairingStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const en = useEn();
  const { apiFetch, ready, access, getToken } = useLegacyApi();
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

  // SignalR Connection State
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);

  // Establish SignalR Connection
  useEffect(() => {
    if (!ready) return;
    const conn = new signalR.HubConnectionBuilder()
      // H7: the hub needs a signed-in user; SignalR sends this token as a Bearer header or ?access_token=
      .withUrl(`${getApiBaseUrl()}/hubs/collaboration`, { accessTokenFactory: async () => (await getToken()) ?? "" })
      .withAutomaticReconnect()
      .build();

    conn.on("InitialRoomState", (state) => {
      if (state.currentCode) setCode(state.currentCode);
      if (state.isTakeoverActive) {
        setIsTakeoverActive(true);
        setTakeoverName(state.takeoverInterviewerName);
      }
      if (state.participants) setParticipants(state.participants);
    });

    conn.on("UserJoined", (user, allUsers) => {
      setParticipants(allUsers);
    });

    conn.on("UserLeft", (user, allUsers) => {
      setParticipants(allUsers);
    });

    conn.on("CodeChanged", (data) => {
      setCode(data.code);
    });

    conn.on("InterviewerTakeoverToggled", (data) => {
      setIsTakeoverActive(data.isTakeoverActive);
      setTakeoverName(data.interviewerName);
    });

    conn.on("WhiteboardStrokeReceived", (strokeJson) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const stroke = JSON.parse(strokeJson);

      if (stroke.tool === "pen" || stroke.tool === "eraser") {
        ctx.strokeStyle = stroke.tool === "eraser" ? "#020617" : stroke.color;
        ctx.lineWidth = stroke.tool === "eraser" ? 18 : 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(stroke.startX, stroke.startY);
        ctx.lineTo(stroke.endX, stroke.endY);
        ctx.stroke();
      } else if (stroke.tool === "box") {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = 2;
        ctx.fillStyle = stroke.color + "15";
        ctx.strokeRect(stroke.x, stroke.y, stroke.w, stroke.h);
        ctx.fillRect(stroke.x, stroke.y, stroke.w, stroke.h);
        ctx.fillStyle = stroke.color;
        ctx.font = "12px monospace";
        ctx.fillText("Microservice Node", stroke.x + 8, stroke.y + 18);
      } else if (stroke.tool === "database") {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = 2;
        ctx.fillStyle = stroke.color + "15";
        ctx.beginPath();
        ctx.ellipse(stroke.x + stroke.w / 2, stroke.y + 15, Math.abs(stroke.w / 2), 10, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillRect(stroke.x, stroke.y + 15, stroke.w, Math.max(stroke.h - 15, 20));
        ctx.strokeRect(stroke.x, stroke.y + 15, stroke.w, Math.max(stroke.h - 15, 20));
        ctx.fillStyle = stroke.color;
        ctx.font = "12px monospace";
        ctx.fillText("PostgreSQL Store", stroke.x + 8, stroke.y + 35);
      } else if (stroke.tool === "cloud") {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = 2;
        ctx.fillStyle = stroke.color + "15";
        ctx.beginPath();
        ctx.arc(stroke.x + 30, stroke.y + 30, 20, 0, Math.PI * 2);
        ctx.arc(stroke.x + 60, stroke.y + 25, 25, 0, Math.PI * 2);
        ctx.arc(stroke.x + 90, stroke.y + 30, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = stroke.color;
        ctx.font = "12px monospace";
        ctx.fillText("API Gateway / CDN", stroke.x + 15, stroke.y + 40);
      }
    });

    conn.on("WhiteboardCleared", () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    conn.start()
      .then(() => {
        setConnection(conn);
        conn.invoke("JoinRoom", sessionId, "Candidate User", "Candidate", "cand-123");
      })
      .catch((err) => console.error("SignalR Connection Error:", err));

    return () => {
      conn.stop();
    };
  }, [sessionId, ready, getToken]);

  // Handle Interviewer Takeover Toggle
  const handleToggleTakeover = async () => {
    const targetState = !isTakeoverActive;
    if (connection) {
      connection.invoke("BroadcastTakeoverToggle", sessionId, targetState, "Recruiter (You)");
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

    if (tool === "pen" || tool === "eraser") {
      ctx.strokeStyle = tool === "eraser" ? "#020617" : strokeColor;
      ctx.lineWidth = tool === "eraser" ? 18 : 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      if (connection) {
        connection.invoke("BroadcastWhiteboardStroke", sessionId, JSON.stringify({
          tool, startX: startPos.x, startY: startPos.y, endX: x, endY: y, color: strokeColor
        }));
      }
      setStartPos({ x, y });
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

    if (tool !== "pen" && tool !== "eraser" && connection) {
      connection.invoke("BroadcastWhiteboardStroke", sessionId, JSON.stringify({
        tool, x: startPos.x, y: startPos.y, w, h, color: strokeColor
      }));
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
    if (connection) {
      connection.invoke("BroadcastWhiteboardClear", sessionId);
    }
  };

  const handleSaveWhiteboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSavingWhiteboard(true);
    setSaveSuccess(false);

    try {
      const dataUrl = canvas.toDataURL("image/png");
      const res = await apiFetch(`/api/collaboration/${sessionId}/whiteboard/save`, {
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

  if (access) return <AccessNotice problem={access} feature="The pairing studio" />;

  const toolButton = (id: typeof tool, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setTool(id)}
      className={`rounded-lg p-2 transition-colors ${tool === id ? "bg-muted text-foreground ring-1 ring-indigo-500" : "text-muted-foreground hover:bg-muted"}`}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex min-h-[70vh] flex-col text-foreground">
      <PageHeader
        title={en("Live pairing")}
        description={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span>{en("Room")}</span>
            <span className="font-mono text-foreground">{sessionId.substring(0, 12)}…</span>
            <button onClick={copySessionId} className="rounded p-0.5 hover:text-foreground" aria-label={en("Copy room ID")}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </span>
        }
        actions={
          <>
            <Link href="/recruiter/dashboard" className={buttonClass("ghost")}>
              <ArrowLeft className="h-4 w-4" />
              {en("Back")}
            </Link>
            {isTakeoverActive ? (
              <Badge tone="warn">
                <VolumeX className="me-1 h-3.5 w-3.5" />
                {en("You're speaking; AI interviewer muted")}
              </Badge>
            ) : (
              <Badge tone="neutral">
                <Volume2 className="me-1 h-3.5 w-3.5" />
                {en("AI interviewer speaking")}
              </Badge>
            )}
            {/* Participant Avatars */}
            <div className="flex items-center -space-x-2">
              {participants.map((p, idx) => (
                <div
                  key={idx}
                  title={`${p.userName} (${p.role})`}
                  style={{ borderColor: p.color }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 bg-muted text-xs font-semibold"
                >
                  {p.userName.charAt(0)}
                </div>
              ))}
            </div>
            <Button variant={isTakeoverActive ? "secondary" : "primary"} onClick={handleToggleTakeover}>
              <ShieldAlert className="h-4 w-4" />
              {isTakeoverActive ? en("Hand back to AI") : en("Take over")}
            </Button>
          </>
        }
      />

      {/* Mode Navigation Tabs */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex-1">
          <Tabs
            label={en("Workspace")}
            value={activeTab}
            onChange={setActiveTab}
            items={[
              { id: "code", label: en("Code"), icon: <Code2 /> },
              { id: "whiteboard", label: en("Whiteboard"), icon: <Layers /> },
            ]}
          />
        </div>

        {activeTab === "whiteboard" && (
          <div className="flex items-center gap-2 pb-2">
            <Button variant="secondary" onClick={handleClearCanvas}>
              <Eraser className="h-4 w-4" />
              {en("Clear")}
            </Button>
            <Button onClick={handleSaveWhiteboard} busy={savingWhiteboard}>
              {!savingWhiteboard && <Save className="h-4 w-4" />}
              {saveSuccess ? en("Saved") : en("Save diagram")}
            </Button>
          </div>
        )}
      </div>

      {/* Main Workspace Body */}
      <div className="flex flex-1 flex-col py-4">
        {activeTab === "code" ? (
          /* Real-Time Code Pairing Editor */
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex h-9 items-center border-b border-border bg-muted/40 px-4 text-xs text-muted-foreground">
              <span>{en("Shared editor: everyone in the room sees changes as they happen")}</span>
            </div>

            <textarea
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (connection) {
                  connection.invoke("BroadcastCodeChange", sessionId, e.target.value, 0, 0);
                }
              }}
              spellCheck={false}
              className="w-full flex-1 resize-none bg-background p-6 font-mono text-sm leading-relaxed text-foreground selection:bg-indigo-500/30 focus:outline-none"
              placeholder="// Type code here to sync live with interviewer..."
            />
          </div>
        ) : (
          /* Interactive Whiteboard Canvas */
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {/* Whiteboard Toolbar */}
            <div className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
              <div className="flex items-center gap-1">
                {toolButton("pen", en("Pen"), <PenTool className="h-4 w-4" />)}
                {toolButton("box", en("Service box"), <Square className="h-4 w-4" />)}
                {toolButton("database", en("Database"), <Database className="h-4 w-4" />)}
                {toolButton("cloud", en("API gateway or cloud"), <Cloud className="h-4 w-4" />)}
                {toolButton("eraser", en("Eraser"), <Eraser className="h-4 w-4" />)}
              </div>

              {/* Color Palette */}
              <div className="flex items-center gap-1.5">
                {["#38bdf8", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ffffff"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setStrokeColor(c)}
                    style={{ backgroundColor: c }}
                    aria-label={en("Color {value}", { value: c })}
                    className={`h-5 w-5 rounded-full border border-border transition ${strokeColor === c ? "ring-2 ring-indigo-500 ring-offset-1" : "opacity-75 hover:opacity-100"}`}
                  />
                ))}
              </div>
            </div>

            {/* Canvas Viewport */}
            <div className="relative flex flex-1 cursor-crosshair items-center justify-center overflow-hidden bg-[#020617]">
              <canvas
                ref={canvasRef}
                width={1200}
                height={700}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="h-full w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <footer className="flex h-8 items-center justify-end border-t border-border text-xs text-muted-foreground">
        {isTakeoverActive ? (
          <span className="font-medium text-amber-700 dark:text-amber-400">{en("Speaking: {value}", { value: takeoverName || en("Interviewer") })}</span>
        ) : (
          <span>{en("The AI interviewer is asking the questions")}</span>
        )}
      </footer>
    </div>
  );
}
