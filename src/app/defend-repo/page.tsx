"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { Badge, Button, ErrorBanner, PageHeader } from "@/components/career/ui";
import {
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  FileCode,
  RefreshCw,
  CircleDot,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import VoiceDefenseRoom from "@/components/VoiceDefenseRoom";
import SignInRequired from "@/components/SignInRequired";
import { useEn } from "@/lib/english/EnglishProvider";

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

const STATUS_TONES: Record<RepoDefenseStatus, "warn" | "good" | "bad" | "info"> = {
  PendingVerification: "warn",
  Ready: "good",
  Failed: "bad",
  Defended: "info",
};

const STATUS_LABELS: Record<RepoDefenseStatus, string> = {
  PendingVerification: "Pending verification",
  Ready: "Ready to defend",
  Failed: "Verification failed",
  Defended: "Defended",
};

function StatusBadge({ status }: { status: RepoDefenseStatus }) {
  const en = useEn();
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"}>{en(STATUS_LABELS[status] ?? status)}</Badge>
  );
}

export default function DefendRepoPage() {
  const en = useEn();
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
      if (!res.ok || !body?.id) throw new Error(body?.error || "Something went wrong. Please try again.");

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
      setError(err instanceof Error && !(err instanceof TypeError) ? err.message : "Could not register the repository.");
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
      if (!res.ok || !body) throw new Error(body?.error || "Something went wrong. Please try again.");
      setCurrent({ ...current, ...body, id: current.id });
      await refreshHistory();
    } catch (err) {
      setError(err instanceof Error && !(err instanceof TypeError) ? err.message : "We couldn't check your repository. Please try again.");
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
      <SignInRequired title={en("Defend your real work")} message="Sign in to link a GitHub repository or pull request." />
    );
  }

  const canDefend = current && (current.status === "Ready" || current.status === "Defended");

  return (
    <div className="text-foreground">
      <div className="space-y-8">
        <PageHeader
          title={en("Defend your real work")}
          description={en("Link a public GitHub repository or pull request you wrote, prove the GitHub account is yours, then explain your code in a voice defense. The interviewer asks about the files you authored.")}
        />

        <ErrorBanner error={error} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-base font-semibold text-foreground">{en("1. Link a repository or pull request")}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="sm:col-span-2 text-xs text-muted-foreground space-y-1">
                  <span>{en("GitHub repo or PR URL")}</span>
                  <input
                    required
                    value={repository}
                    onChange={(e) => setRepository(e.target.value)}
                    placeholder="https://github.com/owner/repo/pull/42 or owner/repo"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </label>
                <label className="text-xs text-muted-foreground space-y-1">
                  <span>{en("PR number (optional)")}</span>
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
                <span>{en("Your GitHub username")}</span>
                <input
                  required
                  value={gitHubLogin}
                  onChange={(e) => setGitHubLogin(e.target.value)}
                  placeholder="octocat"
                  className="w-full sm:max-w-xs px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </label>
              <p className="text-xs text-muted-foreground">{en("Only public repositories are supported.")}</p>
              <Button type="submit" busy={creating}>
                {en("Get verification token")}
              </Button>
            </form>

            {current && (
              <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-foreground">
                    {en("2. Verify ownership")}
                    {current.repository && (
                      <span className="ms-2 font-mono font-normal text-muted-foreground">
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
                        <p className="text-xs text-muted-foreground">{en("Your one-time verification token:")}</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 min-w-0 truncate px-3 py-2 rounded-xl bg-muted border border-border font-mono text-sm text-foreground">
                            {currentToken}
                          </code>
                          <Button type="button" variant="secondary" onClick={copyToken} className="shrink-0">
                            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                            {copied ? en("Copied") : en("Copy")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <div className="text-xs text-muted-foreground space-y-1.5">
                      {instructions && <p>{instructions}</p>}
                      <ol className="list-decimal ps-5 space-y-1">
                        <li>
                          {en("Add the token to your GitHub profile bio (")}
                          <a href="https://github.com/settings/profile" target="_blank" rel="noreferrer" className="text-indigo-700 dark:text-indigo-400 hover:underline">
                            github.com/settings/profile
                          </a>
                          ), <strong>or</strong>{en(" create a public gist whose description contains it (")}
                          <a href="https://gist.github.com/" target="_blank" rel="noreferrer" className="text-indigo-700 dark:text-indigo-400 hover:underline">
                            gist.github.com
                          </a>
                          ).
                        </li>
                        <li>{en("Click Verify. You can remove the token from GitHub afterwards.")}</li>
                      </ol>
                    </div>
                    <Button type="button" onClick={handleVerify} busy={verifying}>
                      {!verifying && <ShieldCheck className="h-4 w-4" aria-hidden />}
                      {en("Verify")}
                    </Button>
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
                          {en("Commits authored by you:")}{" "}
                          <span className="font-semibold text-foreground">{Math.round(current.authorCommitShare * 100)}%</span>
                          {typeof current.authorCommitCount === "number" && <> {" "}{en("({authorCommitCount} commits sampled as yours)", { authorCommitCount: current.authorCommitCount })}</>}
                        </p>
                      )}
                      {current.selectedFiles && current.selectedFiles.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">{en("Files selected for your defense:")}</p>
                          <ul className="space-y-1">
                            {current.selectedFiles.map((f) => (
                              <li key={f.path} className="flex items-center justify-between gap-2 text-xs px-3 py-1.5 rounded-lg bg-muted/60 border border-border">
                                <span className="flex items-center gap-1.5 min-w-0 font-mono text-foreground">
                                  <FileCode className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                  <span className="truncate">{f.path}</span>
                                </span>
                                <span className="text-muted-foreground shrink-0">{en("+{authorAdditions} lines by you", { authorAdditions: f.authorAdditions })}</span>
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
                <h2 className="text-base font-semibold text-foreground">{en("3. Defend it")}</h2>
                {current.status === "Defended" && (
                  <p className="text-xs text-muted-foreground">{en("You've already defended this work. You can start another session if you want.")}</p>
                )}
                <VoiceDefenseRoom
                  key={current.id}
                  repoDefenseId={current.id}
                  jobDescription="Defend your real work"
                  onResult={() => void refreshHistory()}
                />
              </div>
            )}
          </div>

          <aside className="h-fit space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">{en("Your linked work")}</h2>
              <button
                type="button"
                onClick={() => void refreshHistory()}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label={en("Refresh")}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {historyLoading ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />{en(" Loading...")}
              </p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">{en("Nothing linked yet.")}</p>
            ) : (
              <ul className="space-y-2">
                {history.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => selectExisting(item)}
                      className={`w-full text-start p-3 rounded-xl border transition-colors ${
                        current?.id === item.id ? "border-indigo-500 bg-muted/60" : "border-border hover:bg-muted/60"
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
                          <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span>
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
