"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { ArrowLeft, ArrowRight, BookOpen, Lightbulb, MessageSquare, Search, Wand2 } from "lucide-react";
import { Badge, Button, EmptyState, ErrorBanner, PageHeader, Tabs, brandFill, buttonClass } from "@/components/career/ui";

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
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const params = useParams();
  const sprintId = (params?.id as string) || "";

  const [session, setSession] = useState<PairSession | null>(null);
  const [interactions, setInteractions] = useState<InteractionLog[]>([]);
  const [codeSmells, setCodeSmells] = useState<CodeSmell[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // The member's code: they write or paste it here (it used to start with an invented sample solution)
  const [codeSnippet, setCodeSnippet] = useState<string>("");

  const [userPrompt, setUserPrompt] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"chat" | "smells" | "diff">("chat");
  const [activeDiff, setActiveDiff] = useState<string | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);

  // Initialize or fetch active Pair Coach session
  const fetchOrStartSession = async () => {
    if (!sprintId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await apiFetch(`/api/pair-coach/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The session belongs to the signed-in member; the server takes them from the sign-in
          sprintId: sprintId,
        }),
      });

      const data = await res.json();
      if (data.success && data.session) {
        setSession(data.session);

        // Fetch full audit to retrieve previous interaction timeline
        const auditRes = await apiFetch(`/api/pair-coach/session/${data.session.id}`);
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

  const fetchOrStartSessionRef = useLatestRef(fetchOrStartSession);
  useEffect(() => {
    if (!ready) return;
    fetchOrStartSessionRef.current();
  }, [sprintId, ready, fetchOrStartSessionRef]);

  // Handle interaction dispatch (Hint, Explain, Refactor, Probe)
  const handleInteraction = async (type: "Hint" | "Explain" | "Refactor" | "Probe", customPrompt?: string) => {
    if (!session) return;
    setCoachError(null);
    try {
      setIsSubmitting(true);
      const promptToSend = customPrompt || userPrompt || `Requesting ${type.toLowerCase()} for my current code`;

      const res = await apiFetch(`/api/pair-coach/interact`, {
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

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        // P6: the server says when the AI coach isn't available; show it rather than an invented answer
        setCoachError(data?.message || en("The coach couldn't respond just now. Please try again."));
        return;
      }
      if (data.interaction) {
        setInteractions((prev) => [data.interaction, ...prev]);
        if (data.interaction.suggestedDiff) {
          setActiveDiff(data.interaction.suggestedDiff);
          setActiveTab("diff");
        }
        setUserPrompt("");

        // Refresh session telemetry (best effort: the coach's answer is already shown, so a failed refresh isn't an error)
        const auditData = await apiFetch(`/api/pair-coach/session/${session.id}`)
          .then((r) => r.json())
          .catch(() => null);
        if (auditData?.success && auditData.session) {
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
    } catch {
      setCoachError(en("We couldn't reach Edulexa. Check your internet connection and try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Run on-demand static code smell analysis
  const handleAnalyzeSmells = async () => {
    try {
      setIsSubmitting(true);
      const res = await apiFetch(`/api/pair-coach/analyze-smells`, {
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

  const tierLabel = (tier: string) => tier.replace(/_/g, " ");

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "Critical":
      case "High":
        return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
      case "Medium":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
      default:
        return "bg-muted text-foreground";
    }
  };

  if (access) return <AccessNotice problem={access} feature="The AI pair coach" />;

  if (!sprintId) {
    return (
      <EmptyState title={en("No challenge selected")}>
        <p>{en("Choose a challenge from your dashboard to work through it with the AI coach.")}</p>
        <Link href="/dashboard" className={`${buttonClass("primary")} mt-4`} style={brandFill}>
          {en("Go to dashboard")}
        </Link>
      </EmptyState>
    );
  }

  const tabs: { id: "chat" | "smells" | "diff"; label: string; count?: number }[] = [
    { id: "chat", label: en("Coach"), count: interactions.length },
    { id: "smells", label: en("Code review"), count: codeSmells.length },
    ...(activeDiff ? [{ id: "diff" as const, label: en("Suggested changes") }] : []),
  ];

  return (
    <div className="flex min-h-[70vh] flex-col text-foreground">
      <Link href={`/sprint/${sprintId}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {en("Back to the challenge")}
      </Link>
      <PageHeader
        title={en("AI coding coach")}
        description={en("Ask for hints, explanations or a code-quality review while you work. Each kind of help changes your independence score.")}
        actions={
          <div className="flex items-center gap-3">
            <div className="text-end">
              <div className="text-xs text-muted-foreground">{en("Independence score")}</div>
              <div className="text-sm font-semibold tabular-nums text-foreground">{session ? `${session.autonomyScore.toFixed(1)} / 100` : "—"}</div>
            </div>
            {session?.autonomyTier && <Badge>{tierLabel(session.autonomyTier)}</Badge>}
          </div>
        }
      />

      <div className="grid flex-1 grid-cols-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:grid-cols-12">
        {/* Left pane: the member's code (7 cols) */}
        <div className="flex flex-col border-border lg:col-span-7 lg:border-e">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">Solution.cs</span>
              <Badge>{en("C#")}</Badge>
            </div>
            <Button variant="secondary" onClick={handleAnalyzeSmells} disabled={isSubmitting || !codeSnippet.trim()}>
              <Search aria-hidden="true" className="h-4 w-4" />
              {en("Review code quality")}
            </Button>
          </div>

          <div className="relative flex-1 p-4">
            <textarea
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              aria-label={en("Your code")}
              className="h-full min-h-80 w-full resize-none rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              placeholder="// Write or paste your solution code here..."
              spellCheck={false}
            />
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
            <span className="me-2 text-sm text-muted-foreground">{en("Quick actions:")}</span>
            <Button variant="secondary" onClick={() => handleInteraction("Hint")} disabled={isSubmitting}>
              <Lightbulb aria-hidden="true" className="h-4 w-4" />
              {en("Get a hint (-3.5 pts)")}
            </Button>
            <Button variant="secondary" onClick={() => handleInteraction("Explain")} disabled={isSubmitting}>
              <BookOpen aria-hidden="true" className="h-4 w-4" />
              {en("Explain the solution (-2.0 pts)")}
            </Button>
            <Button variant="secondary" onClick={() => handleInteraction("Refactor")} disabled={isSubmitting}>
              <Wand2 aria-hidden="true" className="h-4 w-4" />
              {en("Improve code quality (-5.0 pts)")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleInteraction("Probe")}
              disabled={isSubmitting || !userPrompt.trim()}
              title={en("Type your approach in the message box first")}
            >
              <MessageSquare aria-hidden="true" className="h-4 w-4" />
              {en("Explain my approach (+1.5 bonus)")}
            </Button>
          </div>
        </div>

        {/* Right pane: the coach (5 cols) */}
        <div className="flex flex-col border-t border-border lg:col-span-5 lg:border-t-0">
          <div className="flex items-center justify-between gap-2 px-4">
            <Tabs items={tabs} value={activeTab} onChange={setActiveTab} label={en("Coach panels")} />
            <span className="shrink-0 text-xs text-muted-foreground">{en("Questions: {value}", { value: session?.totalInteractions || 0 })}</span>
          </div>

          <div className="max-h-[calc(100vh-210px)] flex-1 space-y-4 overflow-y-auto p-4">
            {activeTab === "chat" && (
              <>
                {interactions.length === 0 ? (
                  <EmptyState title={en("Your AI coach is ready")}>
                    {en("Choose an action or type a message below to ask questions, request hints, or review recommendations.")}
                  </EmptyState>
                ) : (
                  interactions.map((item) => (
                    <div key={item.id} className="space-y-2 rounded-lg border border-border bg-background p-4">
                      <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge tone="info">{item.interactionType}</Badge>
                          <span className="tabular-nums text-muted-foreground">
                            {item.autonomyPenalty > 0 ? `-${item.autonomyPenalty} pts` : `+${Math.abs(item.autonomyPenalty)} pts`}
                          </span>
                        </div>
                        <span className="tabular-nums text-muted-foreground">{new Date(item.createdAt).toLocaleTimeString()}</span>
                      </div>

                      {item.prompt && <div className="text-sm text-muted-foreground">&ldquo;{item.prompt}&rdquo;</div>}

                      <div className="whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-foreground">{item.aiResponse}</div>

                      {item.suggestedDiff && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDiff(item.suggestedDiff || null);
                            setActiveTab("diff");
                          }}
                          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300"
                        >
                          {en("View suggested changes")}
                          <ArrowRight aria-hidden="true" className="h-4 w-4" />
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
                  <EmptyState title={en("No code issues to show")}>{en("Use Review code quality to check your code for structural issues.")}</EmptyState>
                ) : (
                  codeSmells.map((smell, i) => (
                    <div key={i} className="space-y-2 rounded-lg border border-border bg-background p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground">{smell.smellType}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getSeverityBadge(smell.severity)}`}>{smell.severity}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">{smell.description}</p>
                      <div className="rounded-lg bg-muted/50 p-2.5 text-sm text-foreground">
                        <span className="font-medium">{en("Suggested fix: ")}</span>
                        {smell.recommendation}
                      </div>
                      {smell.lineNumber && <div className="font-mono text-xs text-muted-foreground">{en("Line #{lineNumber}", { lineNumber: smell.lineNumber })}</div>}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "diff" && activeDiff && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{en("Suggested code changes")}</span>
                  <button type="button" onClick={() => setActiveTab("chat")} className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline dark:text-indigo-300">
                    <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                    {en("Back to the coach")}
                  </button>
                </div>
                <div className="overflow-x-auto whitespace-pre rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed">
                  {activeDiff.split("\n").map((line, idx) => {
                    const isAdd = line.startsWith("+");
                    const isDel = line.startsWith("-");
                    const isHeader = line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++");
                    return (
                      <div
                        key={idx}
                        className={
                          isHeader
                            ? "font-semibold text-foreground"
                            : isAdd
                            ? "-mx-4 bg-emerald-50 px-4 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : isDel
                            ? "-mx-4 bg-red-50 px-4 text-red-800 line-through opacity-80 dark:bg-red-950/30 dark:text-red-400"
                            : "text-muted-foreground"
                        }
                      >
                        {line}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Message box */}
          <div className="border-t border-border p-3 space-y-2">
            <ErrorBanner error={coachError} />
            <div className="flex gap-2">
              <input
                type="text"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isSubmitting && handleInteraction("Hint")}
                placeholder={en("Ask your coach for guidance, hints, or alternative approaches...")}
                aria-label={en("Message to your coach")}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <Button onClick={() => handleInteraction("Hint")} disabled={isSubmitting || !userPrompt.trim()}>
                {en("Send")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
