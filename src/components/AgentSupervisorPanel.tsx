"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Info,
  Loader2,
  Send,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";

interface ProjectFile {
  name: string;
  content: string;
}

interface AgentSupervisorPanelProps {
  attemptId: string;
  getFiles: () => ProjectFile[];
  /** Replaces a file's content in the editor; the edit is recorded as source "ai-assistant" with interactionId = proposalId. */
  applyFile: (name: string, content: string, proposalId: string) => void;
  onTestRun?: () => void;
  disabled?: boolean;
}

type ProposalStatus = "Proposed" | "Accepted" | "PartiallyAccepted" | "Rejected";

interface FileChange {
  file: string;
  newContent: string;
  diff: string;
}

interface Proposal {
  proposalId: string;
  requestNumber: number;
  instruction: string;
  explanation: string;
  status: ProposalStatus;
  acceptedFiles: string[];
  changes: FileChange[];
  /** performance.now() when the proposal was first shown in this page session */
  shownAt: number;
  closed: boolean;
}

interface TestRun {
  testRunId: string;
  passed: number;
  total: number;
  output: string;
  ranAt: string;
  proposalId?: string | null;
}

interface Limits {
  maxProposals: number;
  maxTestRuns: number;
  maxInstructionChars: number;
}

const DEFAULT_LIMITS: Limits = { maxProposals: 20, maxTestRuns: 30, maxInstructionChars: 4000 };

function toStatus(value: unknown): ProposalStatus {
  return value === "Accepted" || value === "PartiallyAccepted" || value === "Rejected" ? value : "Proposed";
}

function toChanges(value: unknown): FileChange[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c) => c && typeof c.file === "string")
    .map((c) => ({
      file: c.file as string,
      newContent: typeof c.newContent === "string" ? c.newContent : "",
      diff: typeof c.diff === "string" ? c.diff : "",
    }));
}

function toProposal(raw: Record<string, unknown>, shownAt: number): Proposal {
  const status = toStatus(raw.status);
  return {
    proposalId: String(raw.proposalId),
    requestNumber: Number(raw.requestNumber) || 0,
    instruction: typeof raw.instruction === "string" ? raw.instruction : "",
    explanation: typeof raw.explanation === "string" ? raw.explanation : "",
    status,
    acceptedFiles: Array.isArray(raw.acceptedFiles) ? raw.acceptedFiles.filter((f): f is string => typeof f === "string") : [],
    changes: toChanges(raw.changes),
    shownAt,
    closed: status === "Accepted" || status === "Rejected",
  };
}

function toTestRun(raw: Record<string, unknown>): TestRun {
  return {
    testRunId: String(raw.testRunId ?? Math.random()),
    passed: Number(raw.passed) || 0,
    total: Number(raw.total) || 0,
    output: typeof raw.output === "string" ? raw.output : "",
    ranAt: typeof raw.ranAt === "string" ? raw.ranAt : "",
    proposalId: typeof raw.proposalId === "string" ? raw.proposalId : null,
  };
}

// Milliseconds since a performance.now() timestamp; only called from event handlers
const elapsedMs = (since: number) => Math.max(0, Math.round(performance.now() - since));

const normalize = (s: string) => s.replace(/\r\n?/g, "\n");

// The file as it was when the agent made the proposal, rebuilt from the diff's context and removed lines
function contentBefore(diff: string): string | null {
  if (!diff || diff.startsWith("(file too large")) return null;
  const lines = diff.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines
    .filter((l) => !l.startsWith("+ "))
    .map((l) => l.slice(2))
    .join("\n");
}

function DiffView({ diff }: { diff: string }) {
  const lines = diff.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return (
    <pre className="max-h-72 overflow-auto bg-slate-950 text-[11px] font-mono leading-relaxed py-2">
      {lines.map((line, idx) => {
        const kind = line.startsWith("+ ") ? "add" : line.startsWith("- ") ? "del" : "ctx";
        return (
          <div
            key={idx}
            className={`px-2.5 whitespace-pre ${
              kind === "add"
                ? "bg-emerald-500/15 text-emerald-300"
                : kind === "del"
                  ? "bg-red-500/15 text-red-300"
                  : "text-slate-400"
            }`}
          >
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  const styles: Record<ProposalStatus, string> = {
    Proposed: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    Accepted: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    PartiallyAccepted: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
    Rejected: "bg-muted text-muted-foreground border-border",
  };
  const label: Record<ProposalStatus, string> = {
    Proposed: "Awaiting review",
    Accepted: "Accepted",
    PartiallyAccepted: "Partly accepted",
    Rejected: "Rejected",
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${styles[status]}`}>{label[status]}</span>;
}

export default function AgentSupervisorPanel({ attemptId, getFiles, applyFile, onTestRun, disabled = false }: AgentSupervisorPanelProps) {
  const { getToken } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [sending, setSending] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null); // "all" or a proposalId
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch(`/api/agent/attempts/${attemptId}/history`, {}, getToken)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.error || "Couldn't load the agent history.");
          return;
        }
        const now = performance.now();
        setProposals(Array.isArray(data.proposals) ? data.proposals.map((p: Record<string, unknown>) => toProposal(p, now)) : []);
        setTestRuns(Array.isArray(data.testRuns) ? data.testRuns.map(toTestRun) : []);
        if (data.limits) setLimits({ ...DEFAULT_LIMITS, ...data.limits });
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't reach the server to load the agent history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId, getToken]);

  const scrollToEnd = () =>
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);

  const send = async () => {
    const text = instruction.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    setError(null);
    try {
      const res = await authenticatedFetch(
        `/api/agent/attempts/${attemptId}/propose`,
        { method: "POST", body: JSON.stringify({ instruction: text, files: getFiles() }) },
        getToken
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.proposalId) {
        setProposals((prev) => [...prev, toProposal({ ...data, instruction: text }, performance.now())]);
        setInstruction("");
        scrollToEnd();
      } else {
        setError(data.error || "The agent is unavailable right now.");
      }
    } catch {
      setError("Couldn't reach the agent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const decide = async (proposal: Proposal, status: "Accepted" | "PartiallyAccepted" | "Rejected", files: FileChange[]) => {
    if (disabled || deciding) return;

    // Accepting replaces the whole file, so warn when the candidate has edited it since the agent saw it
    if (files.length > 0) {
      const current = new Map(getFiles().map((f) => [f.name, normalize(f.content)]));
      const changedSince = files.filter((c) => {
        const before = contentBefore(c.diff);
        return before !== null && current.has(c.file) && current.get(c.file) !== before;
      });
      if (
        changedSince.length > 0 &&
        !window.confirm(
          `${changedSince.map((c) => c.file).join(", ")} changed after the agent made this proposal. Accepting replaces the whole file with the agent's version, and your later edits to it will be lost. Continue?`
        )
      ) {
        return;
      }
    }

    setDeciding(proposal.proposalId);
    setError(null);
    const reviewMs = elapsedMs(proposal.shownAt);
    try {
      const res = await authenticatedFetch(
        `/api/agent/proposals/${proposal.proposalId}/decision`,
        { method: "POST", body: JSON.stringify({ status, acceptedFiles: files.map((f) => f.file), reviewMs }) },
        getToken
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Your decision couldn't be saved. Try again.");
        return;
      }
      for (const change of files) applyFile(change.file, change.newContent, proposal.proposalId);
      const nextStatus = toStatus(data.status);
      const acceptedFiles: string[] = Array.isArray(data.acceptedFiles) ? data.acceptedFiles : files.map((f) => f.file);
      setProposals((prev) =>
        prev.map((p) =>
          p.proposalId === proposal.proposalId
            ? {
                ...p,
                status: nextStatus,
                acceptedFiles,
                closed: status === "Rejected" || nextStatus === "Accepted" || nextStatus === "Rejected",
              }
            : p
        )
      );
    } catch {
      setError("Couldn't reach the server. Your decision wasn't saved.");
    } finally {
      setDeciding(null);
    }
  };

  const runTests = useCallback(
    async (proposal?: Proposal) => {
      if (disabled || running) return;
      let files = getFiles();
      if (proposal) {
        const replacements = new Map(proposal.changes.map((c) => [c.file, c.newContent]));
        files = files.map((f) => (replacements.has(f.name) ? { name: f.name, content: replacements.get(f.name)! } : f));
      }
      setRunning(proposal?.proposalId ?? "all");
      setError(null);
      onTestRun?.();
      try {
        const res = await authenticatedFetch(
          `/api/agent/attempts/${attemptId}/run-tests`,
          { method: "POST", body: JSON.stringify({ files, proposalId: proposal?.proposalId }) },
          getToken
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setTestRuns((prev) => [...prev, toTestRun({ ...data, proposalId: proposal?.proposalId ?? null })]);
        } else {
          setError(data.error || "The tests couldn't be run right now.");
        }
      } catch {
        setError("Couldn't reach the test runner. Check your connection and try again.");
      } finally {
        setRunning(null);
      }
    },
    [attemptId, disabled, getFiles, getToken, onTestRun, running]
  );

  const lastRun = testRuns[testRuns.length - 1];
  const proposalsLeft = Math.max(0, limits.maxProposals - proposals.length);
  const runsLeft = Math.max(0, limits.maxTestRuns - testRuns.length);

  return (
    <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center space-x-2">
          <Wrench className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
          <h3 className="text-sm font-semibold text-foreground">Coding Agent</h3>
        </div>
        <span className="text-[10px] px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-semibold border border-indigo-500/20">
          Supervision reviewed
        </span>
      </div>

      <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-700 dark:text-indigo-400" />
        <span>
          Tell the agent what to change, then review each proposal before accepting it. Reviewers see your instructions, which
          changes you accepted or rejected, how long you spent reviewing, and your test runs. The agent can be wrong, and the
          visible tests don&apos;t cover everything.
        </span>
      </div>

      <div ref={scrollRef} className="space-y-4 max-h-[32rem] overflow-y-auto pr-1">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading agent history...
          </div>
        )}
        {loadError && <p className="text-[11px] text-red-600 dark:text-red-400">{loadError}</p>}
        {!loading && !loadError && proposals.length === 0 && !sending && (
          <p className="text-xs text-muted-foreground italic">
            No requests yet. The agent sees the current contents of your files when you send an instruction.
          </p>
        )}

        {proposals.map((p) => {
          const open = p.status === "Proposed" || p.status === "PartiallyAccepted";
          const actionable = open && !p.closed && !disabled;
          const isCollapsed = collapsed[p.proposalId] ?? !open;
          const pending = p.changes.filter((c) => !p.acceptedFiles.includes(c.file));
          const busy = deciding === p.proposalId;
          return (
            <div key={p.proposalId} className="space-y-2">
              <div className="ml-8 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-foreground whitespace-pre-wrap">
                <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 block mb-0.5">
                  Request {p.requestNumber}
                </span>
                {p.instruction}
              </div>
              <div className="mr-2 rounded-xl bg-card border border-border text-xs text-foreground overflow-hidden">
                <div className="flex items-start justify-between gap-2 p-2.5">
                  <p className="whitespace-pre-wrap leading-relaxed">{p.explanation}</p>
                  <StatusBadge status={p.status} />
                </div>

                {p.changes.length === 0 ? (
                  <p className="px-2.5 pb-2.5 text-[11px] text-muted-foreground italic">No file changes proposed.</p>
                ) : (
                  <>
                    <button
                      onClick={() => setCollapsed((prev) => ({ ...prev, [p.proposalId]: !isCollapsed }))}
                      className="w-full flex items-center gap-1 px-2.5 py-1.5 border-t border-border text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isCollapsed ? "Show" : "Hide"} changes ({p.changes.length} file{p.changes.length === 1 ? "" : "s"})
                    </button>
                    {!isCollapsed &&
                      p.changes.map((c) => {
                        const fileAccepted = p.acceptedFiles.includes(c.file);
                        return (
                          <div key={c.file} className="border-t border-border">
                            <div className="flex items-center justify-between px-2.5 py-1 bg-muted text-[10px] font-mono text-muted-foreground">
                              <span>{c.file}</span>
                              {fileAccepted ? (
                                <span className="font-sans font-semibold text-emerald-700 dark:text-emerald-400">Accepted</span>
                              ) : actionable && p.changes.length > 1 ? (
                                <button
                                  onClick={() => void decide(p, "PartiallyAccepted", [c])}
                                  disabled={busy}
                                  className="flex items-center gap-1 font-sans font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <Check className="w-3 h-3" /> Accept file
                                </button>
                              ) : null}
                            </div>
                            <DiffView diff={c.diff} />
                          </div>
                        );
                      })}
                  </>
                )}

                {actionable && (
                  <div className="flex flex-wrap items-center gap-2 p-2.5 border-t border-border">
                    {pending.length > 0 && (
                      <button
                        onClick={() => void decide(p, "Accepted", pending)}
                        disabled={busy}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                        {p.changes.length > 1 ? (p.acceptedFiles.length > 0 ? "Accept remaining" : "Accept all") : "Accept"}
                      </button>
                    )}
                    <button
                      onClick={() => void decide(p, "Rejected", [])}
                      disabled={busy}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-[11px] font-semibold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <X className="w-3 h-3" /> {p.acceptedFiles.length > 0 ? "Reject remaining" : "Reject"}
                    </button>
                    {p.changes.length > 0 && (
                      <button
                        onClick={() => void runTests(p)}
                        disabled={running !== null || runsLeft === 0}
                        title="Runs the visible tests on your current files with this proposal applied. Nothing changes in the editor."
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-[11px] font-semibold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {running === p.proposalId ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />}
                        Test this change
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> The agent is working...
          </div>
        )}
      </div>

      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}

      <div className="space-y-1.5">
        <div className="flex items-end gap-2">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value.slice(0, limits.maxInstructionChars))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={3}
            disabled={disabled || proposalsLeft === 0}
            placeholder={
              disabled
                ? "The agent is closed after submission."
                : proposalsLeft === 0
                  ? "You've used all requests to the agent."
                  : "Tell the agent what to change..."
            }
            className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
          <button
            onClick={() => void send()}
            disabled={disabled || sending || !instruction.trim() || proposalsLeft === 0}
            aria-label="Send instruction to the agent"
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-muted disabled:text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {proposalsLeft} of {limits.maxProposals} agent requests left · {runsLeft} of {limits.maxTestRuns} test runs left
        </p>
      </div>

      <div className="pt-3 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-foreground">Visible tests</span>
            {lastRun && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${
                  lastRun.total > 0 && lastRun.passed === lastRun.total
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
                }`}
              >
                {lastRun.passed}/{lastRun.total} passed{lastRun.proposalId ? " (proposal preview)" : ""}
              </span>
            )}
          </div>
          <button
            onClick={() => void runTests()}
            disabled={disabled || running !== null || runsLeft === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-[11px] font-semibold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {running === "all" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />}
            Run tests
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Runs a small set of visible tests against the code in your editor. Hidden tests run when you submit.
        </p>
        {lastRun && (
          <pre className="max-h-48 overflow-auto rounded-lg bg-slate-950 text-slate-100 text-[11px] font-mono p-2.5 whitespace-pre-wrap">
            {lastRun.output.trim() || "(no output)"}
          </pre>
        )}
      </div>
    </div>
  );
}
