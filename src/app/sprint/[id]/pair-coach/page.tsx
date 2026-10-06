"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface InteractionLog {
  id: string;
  sessionId: string;
  interactionType: "Hint" | "Explain" | "Refactor" | "Probe";
  prompt: string;
  codeContextSnapshot: string;
  language: string;
  aiResponse: string;
  suggestedDiff?: string | null;
  autonomyPenalty: number;
  createdAt: string;
}

interface CodeSmell {
  smellType: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  description: string;
  recommendation: string;
  lineNumber?: number;
}

interface PairSession {
  id: string;
  sprintId: string;
  userId: string;
  totalInteractions: number;
  hintsRequested: number;
  explanationsRequested: number;
  refactorsRequested: number;
  probesAnswered: number;
  autonomyScore: number;
  autonomyTier: string;
  codeSmellsDetected_JSON: string;
  startedAt: string;
  lastInteractionAt: string;
}

export default function AiPairCoachStudioPage() {
  const params = useParams();
  const sprintId = (params?.id as string) || "";
  const [userId] = useState<string>("c89ef120-745a-4b9b-9801-9a776c5b9812");

  const [session, setSession] = useState<PairSession | null>(null);
  const [interactions, setInteractions] = useState<InteractionLog[]>([]);
  const [codeSmells, setCodeSmells] = useState<CodeSmell[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active Code Snapshot in Candidate's IDE
  const [codeSnippet, setCodeSnippet] = useState<string>(`// Concurrent In-Memory Ring Buffer with Lock-Free Enqueue
public class HighThroughputBuffer<T>
{
    private readonly T[] _buffer;
    private long _head = 0;
    private long _tail = 0;
    private const int BufferCapacity = 1024;

    public HighThroughputBuffer()
    {
        _buffer = new T[BufferCapacity];
    }

    public bool TryEnqueue(T item)
    {
        long currentTail = Interlocked.Read(ref _tail);
        long currentHead = Interlocked.Read(ref _head);

        if (currentTail - currentHead >= BufferCapacity)
        {
            return false; // Ring buffer is saturated
        }

        int index = (int)(currentTail % BufferCapacity);
        _buffer[index] = item;
        Interlocked.Increment(ref _tail);
        return true;
    }
}`);

  const [userPrompt, setUserPrompt] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"chat" | "smells" | "diff">("chat");
  const [activeDiff, setActiveDiff] = useState<string | null>(null);

  // Initialize or fetch active Pair Coach session
  const fetchOrStartSession = async () => {
    if (!sprintId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/pair-coach/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sprintId: sprintId,
          userId: userId,
        }),
      });

      const data = await res.json();
      if (data.success && data.session) {
        setSession(data.session);

        // Fetch full audit to retrieve previous interaction timeline
        const auditRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/pair-coach/session/${data.session.id}`);
        const auditData = await auditRes.json();
        if (auditData.success && auditData.session) {
          setInteractions(auditData.session.interactions || []);
          if (auditData.session.codeSmellsDetected_JSON) {
            try {
              setCodeSmells(JSON.parse(auditData.session.codeSmellsDetected_JSON));
            } catch {
              setCodeSmells([]);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to start or fetch pair coach session:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrStartSession();
  }, [sprintId]);

  // Handle interaction dispatch (Hint, Explain, Refactor, Probe)
  const handleInteraction = async (type: "Hint" | "Explain" | "Refactor" | "Probe", customPrompt?: string) => {
    if (!session) return;
    try {
      setIsSubmitting(true);
      const promptToSend = customPrompt || userPrompt || `Requesting ${type.toLowerCase()} for current buffer implementation`;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/pair-coach/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          interactionType: type,
          prompt: promptToSend,
          code: codeSnippet,
          language: "csharp",
        }),
      });

      const data = await res.json();
      if (data.success && data.interaction) {
        setInteractions((prev) => [data.interaction, ...prev]);
        if (data.interaction.suggestedDiff) {
          setActiveDiff(data.interaction.suggestedDiff);
          setActiveTab("diff");
        }
        setUserPrompt("");

        // Refresh session telemetry
        const auditRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/pair-coach/session/${session.id}`);
        const auditData = await auditRes.json();
        if (auditData.success && auditData.session) {
          setSession(auditData.session);
          if (auditData.session.codeSmellsDetected_JSON) {
            try {
              setCodeSmells(JSON.parse(auditData.session.codeSmellsDetected_JSON));
            } catch {
              setCodeSmells([]);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to submit interaction:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Run on-demand static code smell analysis
  const handleAnalyzeSmells = async () => {
    try {
      setIsSubmitting(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/pair-coach/analyze-smells`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeSnippet,
          language: "csharp",
        }),
      });

      const data = await res.json();
      if (data.success && data.smells) {
        setCodeSmells(data.smells);
        setActiveTab("smells");
      }
    } catch (err) {
      console.error("Failed to run code smell analysis:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case "Autonomous_Lead":
        return "text-emerald-700 dark:text-emerald-400 bg-emerald-950/60 border-emerald-500/50";
      case "Self_Directed":
        return "text-cyan-700 dark:text-cyan-400 bg-cyan-950/60 border-cyan-500/50";
      case "Guided_Contributor":
        return "text-amber-700 dark:text-amber-400 bg-amber-950/60 border-amber-500/50";
      default:
        return "text-rose-400 bg-rose-950/60 border-rose-500/50";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "bg-rose-900/60 text-rose-300 border-rose-600/50";
      case "High":
        return "bg-orange-900/60 text-orange-300 border-orange-600/50";
      case "Medium":
        return "bg-amber-900/60 text-amber-600 dark:text-amber-300 border-amber-600/50";
      default:
        return "bg-blue-900/60 text-blue-600 dark:text-blue-300 border-blue-600/50";
    }
  };

  if (!sprintId) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md p-8 rounded-2xl border border-border bg-card/60 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 flex items-center justify-center mx-auto text-2xl">
            🤖
          </div>
          <h2 className="text-xl font-bold text-foreground">No Challenge Selected</h2>
          <p className="text-xs text-muted-foreground">
            Please select an active project challenge from your dashboard to begin coaching with your AI assistant.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20"
          >
            Go to Dashboard →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-16 z-20">
        <div className="flex items-center space-x-4">
          <Link
            href={`/sprint/${sprintId}`}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-slate-700 text-muted-foreground border border-border transition"
          >
            ← Back to Challenge
          </Link>
          <div className="h-4 w-px bg-muted" />
          <div className="flex items-center space-x-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
            </span>
            <h1 className="text-base font-bold bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              AI Coding Coach & Interactive Assistant
            </h1>
          </div>
        </div>

        {/* Real-time Autonomy Meter */}
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-muted-foreground">Independent Problem Solving</div>
            <div className="text-sm font-mono font-bold text-foreground">
              {session?.autonomyScore ? session.autonomyScore.toFixed(1) : "100.0"} / 100.0
            </div>
          </div>
          <div
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 ${getTierColor(
              session?.autonomyTier
            )}`}
          >
            <span>🛡️</span>
            <span>{session?.autonomyTier ? session.autonomyTier.replace("_", " ") : "Independent Lead"}</span>
          </div>
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* Left Pane: Candidate Code Editor (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col border-r border-border bg-background">
          <div className="bg-card/60 px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-muted-foreground text-xs font-mono">Solution.cs</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">C# (.NET 10)</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAnalyzeSmells}
                disabled={isSubmitting}
                className="text-xs px-3 py-1 rounded bg-muted hover:bg-slate-700 text-muted-foreground border border-border font-medium transition flex items-center space-x-1"
              >
                <span>🔍</span>
                <span>Review Code Quality</span>
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 relative font-mono text-xs">
            <textarea
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              className="w-full h-full bg-card/90 text-indigo-100 p-4 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none font-mono text-xs leading-relaxed"
              placeholder="// Write or paste your solution code here..."
              spellCheck={false}
            />
          </div>

          {/* Quick Action Tray */}
          <div className="p-4 border-t border-border bg-card/40 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-2">Quick Actions:</span>
            <button
              onClick={() => handleInteraction("Hint")}
              disabled={isSubmitting}
              className="text-xs px-3 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-600 dark:text-indigo-300 border border-indigo-500/40 font-medium transition flex items-center space-x-1"
            >
              <span>💡</span>
              <span>Need a Hint (-3.5 pts)</span>
            </button>
            <button
              onClick={() => handleInteraction("Explain")}
              disabled={isSubmitting}
              className="text-xs px-3 py-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40 font-medium transition flex items-center space-x-1"
            >
              <span>🔍</span>
              <span>Explain Solution (-2.0 pts)</span>
            </button>
            <button
              onClick={() => handleInteraction("Refactor")}
              disabled={isSubmitting}
              className="text-xs px-3 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-600 dark:text-purple-300 border border-purple-500/40 font-medium transition flex items-center space-x-1"
            >
              <span>✨</span>
              <span>Improve Code Quality (-5.0 pts)</span>
            </button>
            <button
              onClick={() => handleInteraction("Probe", "I used thread-safe concurrency controls to handle high load")}
              disabled={isSubmitting}
              className="text-xs px-3 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 font-medium transition flex items-center space-x-1"
            >
              <span>⚡</span>
              <span>Explain My Approach (+1.5 bonus)</span>
            </button>
          </div>
        </div>

        {/* Right Pane: AI Pair Coach Sidecar (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col bg-card/30">
          {/* Tabs */}
          <div className="border-b border-border bg-card/80 px-4 py-2 flex items-center justify-between">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === "chat" ? "bg-indigo-600 text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Coach Assistant ({interactions.length})
              </button>
              <button
                onClick={() => setActiveTab("smells")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === "smells" ? "bg-indigo-600 text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Code Review ({codeSmells.length})
              </button>
              {activeDiff && (
                <button
                  onClick={() => setActiveTab("diff")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === "diff" ? "bg-indigo-600 text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Suggested Changes
                </button>
              )}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              Questions: {session?.totalInteractions || 0}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-210px)]">
            {activeTab === "chat" && (
              <>
                {interactions.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-2xl bg-card/20 text-muted-foreground">
                    <span className="text-3xl mb-2">🤖</span>
                    <p className="text-xs font-medium">Your AI Coding Coach is ready to assist you.</p>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                      Choose an action above or type a message below to ask questions, request hints, or review recommendations.
                    </p>
                  </div>
                ) : (
                  interactions.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border bg-card/60 p-4 space-y-2 shadow-sm transition"
                    >
                      <div className="flex items-center justify-between text-xs border-b border-border pb-2">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              item.interactionType === "Hint"
                                ? "bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-700/50"
                                : item.interactionType === "Explain"
                                ? "bg-cyan-950 text-cyan-600 dark:text-cyan-300 border border-cyan-700/50"
                                : item.interactionType === "Refactor"
                                ? "bg-purple-950 text-purple-600 dark:text-purple-300 border border-purple-700/50"
                                : "bg-emerald-950 text-emerald-600 dark:text-emerald-300 border border-emerald-700/50"
                            }`}
                          >
                            {item.interactionType}
                          </span>
                          <span className="text-muted-foreground font-mono text-[11px]">
                            {item.autonomyPenalty > 0
                              ? `-${item.autonomyPenalty} pts`
                              : `+${Math.abs(item.autonomyPenalty)} pts`}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </span>
                      </div>

                      {item.prompt && (
                        <div className="text-xs text-muted-foreground font-medium italic">
                          "{item.prompt}"
                        </div>
                      )}

                      <div className="text-xs text-foreground leading-relaxed whitespace-pre-line bg-background/60 p-3 rounded-lg border border-border/80 font-sans">
                        {item.aiResponse}
                      </div>

                      {item.suggestedDiff && (
                        <button
                          onClick={() => {
                            setActiveDiff(item.suggestedDiff || null);
                            setActiveTab("diff");
                          }}
                          className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 hover:text-purple-600 dark:text-purple-300 flex items-center space-x-1"
                        >
                          <span>✨</span>
                          <span>View Suggested Changes →</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === "smells" && (
              <div className="space-y-3">
                {codeSmells.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-border rounded-2xl bg-card/20 text-emerald-700 dark:text-emerald-400">
                    <span className="text-3xl block mb-2">✅</span>
                    <p className="text-xs font-semibold">Great Job! Zero Code Issues Found</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Your solution follows clean standards with no structural issues or antipatterns detected.
                    </p>
                  </div>
                ) : (
                  codeSmells.map((smell, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-foreground">
                          {smell.smellType}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${getSeverityBadge(
                            smell.severity
                          )}`}
                        >
                          {smell.severity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{smell.description}</p>
                      <div className="text-[11px] text-indigo-600 dark:text-indigo-300 bg-indigo-950/30 p-2.5 rounded-lg border border-indigo-900/40">
                        <span className="font-semibold text-indigo-700 dark:text-indigo-400">Suggested Fix: </span>
                        {smell.recommendation}
                      </div>
                      {smell.lineNumber && (
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Line #{smell.lineNumber}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "diff" && activeDiff && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Suggested Code Updates</span>
                  <button
                    onClick={() => setActiveTab("chat")}
                    className="text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:text-indigo-300 font-semibold"
                  >
                    ← Back to Chat
                  </button>
                </div>
                <div className="bg-background p-4 rounded-xl border border-border font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed">
                  {activeDiff.split("\n").map((line, idx) => {
                    const isAdd = line.startsWith("+");
                    const isDel = line.startsWith("-");
                    const isHeader = line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++");
                    return (
                      <div
                        key={idx}
                        className={`${
                          isAdd
                            ? "text-emerald-700 dark:text-emerald-400 bg-emerald-950/30 -mx-4 px-4"
                            : isDel
                            ? "text-rose-400 bg-rose-950/30 -mx-4 px-4 line-through opacity-80"
                            : isHeader
                            ? "text-cyan-700 dark:text-cyan-400 font-bold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {line}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Chat Input */}
          <div className="p-3 border-t border-border bg-card/60">
            <div className="flex space-x-2">
              <input
                type="text"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isSubmitting && handleInteraction("Hint")}
                placeholder="Ask your coach for guidance, hints, or alternative approaches..."
                className="flex-1 bg-background text-foreground px-3.5 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs font-sans placeholder-slate-500"
              />
              <button
                onClick={() => handleInteraction("Hint")}
                disabled={isSubmitting || !userPrompt.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/20"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
