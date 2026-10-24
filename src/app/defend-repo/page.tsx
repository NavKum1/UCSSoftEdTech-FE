"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import {
  GitBranch,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  FileCode,
  RefreshCw,
  CircleDot,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import VapiInterviewRoom from "@/components/VapiInterviewRoom";
import SignInRequired from "@/components/SignInRequired";

type RepoDefenseStatus = "PendingVerification" | "Ready" | "Failed" | "Defended";

interface RepoDefense {
  id: string;
  repository?: string;
  pullRequestNumber?: number | null;
  gitHubLogin?: string;
  status: RepoDefenseStatus;
  ownershipVerified?: boolean;
  authorCommitShare?: number;
  authorCommitCount?: number;
  failureReason?: string | null;
  verificationToken?: string | null; // present until ownership is verified
  selectedFiles?: Array<{ path: string; authorAdditions: number }>;
  createdAt?: string;
}

interface CreatedDefense {
  id: string;
  verificationToken: string;
  instructions: string;
}

async function fetchMine(getToken: () => Promise<string | null>): Promise<RepoDefense[] | null> {
  try {
    const res = await authenticatedFetch("/api/repo-defense/mine", {}, getToken);
    return res.ok ? ((await res.json()) as RepoDefense[]) : null;
  } catch {
    return null;
  }
}

const STATUS_STYLES: Record<RepoDefenseStatus, string> = {
  PendingVerification: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30",
  Ready: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Failed: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  Defended: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
};

const STATUS_LABELS: Record<RepoDefenseStatus, string> = {
  PendingVerification: "Pending verification",
  Ready: "Ready to defend",
  Failed: "Verification failed",
  Defended: "Defended",
};

function StatusBadge({ status }: { status: RepoDefenseStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLES[status] ?? ""}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function DefendRepoPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [repository, setRepository] = useState("");
  const [pullRequestNumber, setPullRequestNumber] = useState("");
  const [gitHubLogin, setGitHubLogin] = useState("");
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [current, setCurrent] = useState<RepoDefense | null>(null);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [history, setHistory] = useState<RepoDefense[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const refreshHistory = useCallback(async () => {
    const list = await fetchMine(getToken);
    if (list) setHistory(list);
    setHistoryLoading(false);
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetchMine(getToken).then((list) => {
      if (cancelled) return;
      if (list) setHistory(list);
      setHistoryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const pr = pullRequestNumber.trim() ? Number(pullRequestNumber.trim()) : undefined;
      const res = await authenticatedFetch(
        "/api/repo-defense",
        {
          method: "POST",
          body: JSON.stringify({
            repository: repository.trim(),
            pullRequestNumber: pr && Number.isFinite(pr) ? pr : undefined,
            gitHubLogin: gitHubLogin.trim(),
          }),
        },
        getToken
      );
      const body = (await res.json().catch(() => null)) as (CreatedDefense & { error?: string }) | null;
      if (!res.ok || !body?.id) throw new Error(body?.error || `HTTP ${res.status}`);

      setInstructions(body.instructions);
      setCurrent({
        id: body.id,
        status: "PendingVerification",
        gitHubLogin: gitHubLogin.trim(),
        repository: repository.trim(),
        verificationToken: body.verificationToken,
      });
      setCopied(false);
      await refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register the repository.");
    } finally {
      setCreating(false);
    }
  };

  const handleVerify = async () => {
    if (!current) return;
    setError(null);
    setVerifying(true);
    try {
      const res = await authenticatedFetch(`/api/repo-defense/${current.id}/verify`, { method: "POST" }, getToken);
      const body = (await res.json().catch(() => null)) as (RepoDefense & { error?: string }) | null;
      if (res.status === 429) throw new Error("Too many verification attempts. Please wait a minute and try again.");
      if (!res.ok || !body) throw new Error(body?.error || `HTTP ${res.status}`);
      setCurrent({ ...current, ...body, id: current.id });
      await refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const selectExisting = (item: RepoDefense) => {
    setError(null);
    setCurrent(item);
    setInstructions(null);
    setCopied(false);
  };

  const currentToken = current?.verificationToken ?? null;

  const copyToken = async () => {
    if (!currentToken) return;
    try {
      await navigator.clipboard.writeText(currentToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (isLoaded && !isSignedIn) {
    return (
      <SignInRequired title="Defend your real work" message="Sign in to link a GitHub repository or pull request." />
    );
  }

  const canDefend = current && (current.status === "Ready" || current.status === "Defended");

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-indigo-700 dark:text-indigo-400" />
            Defend your real work
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Link a public GitHub repository or pull request you wrote, prove the GitHub account is yours, then explain your code in
            a voice defense. The interviewer asks about the files you authored.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-500/10 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleCreate} className="glass-panel rounded-2xl p-5 border border-border space-y-4">
              <h2 className="text-sm font-bold text-foreground">1. Link a repository or pull request</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="sm:col-span-2 text-xs text-muted-foreground space-y-1">
                  <span>GitHub repo or PR URL</span>
                  <input
                    required
                    value={repository}
                    onChange={(e) => setRepository(e.target.value)}
                    placeholder="https://github.com/owner/repo/pull/42 or owner/repo"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </label>
                <label className="text-xs text-muted-foreground space-y-1">
                  <span>PR number (optional)</span>
                  <input
                    inputMode="numeric"
                    value={pullRequestNumber}
                    onChange={(e) => setPullRequestNumber(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="42"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </label>
              </div>
              <label className="block text-xs text-muted-foreground space-y-1">
                <span>Your GitHub username</span>
                <input
                  required
                  value={gitHubLogin}
                  onChange={(e) => setGitHubLogin(e.target.value)}
                  placeholder="octocat"
                  className="w-full sm:max-w-xs px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </label>
              <p className="text-[11px] text-muted-foreground">Only public repositories are supported.</p>
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Get verification token
              </button>
            </form>

            {current && (
              <div className="glass-panel rounded-2xl p-5 border border-border space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-foreground">
                    2. Verify ownership
                    {current.repository && (
                      <span className="ml-2 font-mono font-normal text-muted-foreground">
                        {current.repository}
                        {current.pullRequestNumber ? ` #${current.pullRequestNumber}` : ""}
                      </span>
                    )}
                  </h2>
                  <StatusBadge status={current.status} />
                </div>

                {current.status !== "Ready" && current.status !== "Defended" && (
                  <>
                    {currentToken ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Your one-time verification token:</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 min-w-0 truncate px-3 py-2 rounded-xl bg-muted border border-border font-mono text-sm text-foreground">
                            {currentToken}
                          </code>
                          <button
                            type="button"
                            onClick={copyToken}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground shrink-0"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="text-xs text-muted-foreground space-y-1.5">
                      {instructions && <p>{instructions}</p>}
                      <ol className="list-decimal pl-5 space-y-1">
                        <li>
                          Add the token to your GitHub profile bio (
                          <a href="https://github.com/settings/profile" target="_blank" rel="noreferrer" className="text-indigo-700 dark:text-indigo-400 hover:underline">
                            github.com/settings/profile
                          </a>
                          ), <strong>or</strong> create a public gist whose description contains it (
                          <a href="https://gist.github.com/" target="_blank" rel="noreferrer" className="text-indigo-700 dark:text-indigo-400 hover:underline">
                            gist.github.com
                          </a>
                          ).
                        </li>
                        <li>Click Verify. You can remove the token from GitHub afterwards.</li>
                      </ol>
                    </div>
                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={verifying}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold"
                    >
                      {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      Verify
                    </button>
                  </>
                )}

                {current.failureReason && current.status === "Failed" && (
                  <div className="p-3 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-500/10 text-xs text-red-700 dark:text-red-300">
                    {current.failureReason}
                  </div>
                )}

                {(typeof current.authorCommitShare === "number" || (current.selectedFiles?.length ?? 0) > 0) &&
                  current.status !== "PendingVerification" && (
                    <div className="space-y-3">
                      {typeof current.authorCommitShare === "number" && (
                        <p className="text-xs text-muted-foreground">
                          Commits authored by you:{" "}
                          <span className="font-semibold text-foreground">{Math.round(current.authorCommitShare * 100)}%</span>
                          {typeof current.authorCommitCount === "number" && <> ({current.authorCommitCount} commits sampled as yours)</>}
                        </p>
                      )}
                      {current.selectedFiles && current.selectedFiles.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">Files selected for your defense:</p>
                          <ul className="space-y-1">
                            {current.selectedFiles.map((f) => (
                              <li key={f.path} className="flex items-center justify-between gap-2 text-xs px-3 py-1.5 rounded-lg bg-muted/60 border border-border">
                                <span className="flex items-center gap-1.5 min-w-0 font-mono text-foreground">
                                  <FileCode className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                  <span className="truncate">{f.path}</span>
                                </span>
                                <span className="text-muted-foreground shrink-0">+{f.authorAdditions} lines by you</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            )}

            {canDefend && current && (
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-foreground">3. Defend it</h2>
                {current.status === "Defended" && (
                  <p className="text-xs text-muted-foreground">You&apos;ve already defended this work. You can start another session if you want.</p>
                )}
                <VapiInterviewRoom
                  key={current.id}
                  repoDefenseId={current.id}
                  jobDescription="Defend your real work"
                  onResult={() => void refreshHistory()}
                />
              </div>
            )}
          </div>

          <aside className="glass-panel rounded-2xl p-5 border border-border h-fit space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">Your linked work</h2>
              <button
                type="button"
                onClick={() => void refreshHistory()}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {historyLoading ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
              </p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing linked yet.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => selectExisting(item)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${
                        current?.id === item.id ? "border-indigo-500/50 bg-indigo-500/5" : "border-border hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-semibold text-foreground truncate flex items-center gap-1.5">
                          <CircleDot className="w-3 h-3 shrink-0 text-muted-foreground" />
                          {item.repository}
                          {item.pullRequestNumber ? ` #${item.pullRequestNumber}` : ""}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <StatusBadge status={item.status} />
                        {item.createdAt && (
                          <span className="text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
