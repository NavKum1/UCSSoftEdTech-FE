"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { AlertCircle, CheckCircle2, Flag, Inbox, Loader2, RefreshCw, X } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { STATUS_STYLES, categoryLabel, errorMessage, fmtDate, statusLabel } from "@/lib/candidateExperience";

interface ReviewAppeal {
  id: string;
  submissionId: string;
  candidateName: string;
  sprintTitle: string | null;
  category: string;
  reason: string;
  status: string;
  response: string | null;
  resolverName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  latestDecision: { decision: string; reviewerName: string; createdAt: string } | null;
  canResolve: boolean;
  cannotResolveReason: string | null;
}

const FILTERS = ["Open", "Overturned", "Upheld", "Withdrawn", "All"] as const;
const MIN_RESPONSE = 20;

export default function RecruiterAppealsPage() {
  const { getToken } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Open");
  const [rows, setRows] = useState<ReviewAppeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [resolving, setResolving] = useState<ReviewAppeal | null>(null);
  const [outcome, setOutcome] = useState<"Upheld" | "Overturned" | "">("");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; evidenceUrl?: string } | null>(null);

  useEffect(() => {
    let active = true;
    authenticatedFetch(`/api/appeals?status=${filter}`, {}, getToken)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) throw new Error("You need recruiter access to review appeals.");
        if (!res.ok) throw new Error(await errorMessage(res, "Could not load appeals"));
        return (await res.json()) as ReviewAppeal[];
      })
      .then((data) => {
        if (!active) return;
        setRows(data);
        setError(null);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load appeals."));
    return () => {
      active = false;
    };
  }, [filter, getToken, reloadKey]);

  const openDialog = (a: ReviewAppeal) => {
    setResolving(a);
    setOutcome("");
    setResponse("");
    setResolveError(null);
  };

  const resolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolving || !outcome || response.trim().length < MIN_RESPONSE) return;
    setBusy(true);
    setResolveError(null);
    try {
      const res = await authenticatedFetch(
        `/api/appeals/${resolving.id}/resolve`,
        { method: "POST", body: JSON.stringify({ outcome, response: response.trim() }) },
        getToken
      );
      if (!res.ok) {
        setResolveError(await errorMessage(res, "Could not resolve the appeal"));
        return;
      }
      const body = (await res.json()) as { nextStep: string | null; evidencePackUrl: string };
      setNotice({
        text: body.nextStep ?? "Appeal resolved. The candidate has been emailed your response.",
        evidenceUrl: body.nextStep ? body.evidencePackUrl : undefined,
      });
      setResolving(null);
      setReloadKey((k) => k + 1);
    } catch {
      setResolveError("We couldn't reach the server while resolving the appeal. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const responseLength = response.trim().length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Flag className="w-6 h-6 text-amber-600 dark:text-amber-400" /> Candidate appeals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Appeals must be resolved by someone other than the reviewer who recorded the latest decision. Your response is emailed to
            the candidate.
          </p>
        </div>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="py-2 px-3 rounded-xl bg-card hover:bg-muted border border-border text-xs font-medium text-muted-foreground flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-1 bg-card/80 p-1 rounded-xl border border-border w-fit" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => {
              setRows(null);
              setFilter(f);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              filter === f ? "bg-indigo-600 text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400 flex flex-wrap items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice.text}
          {notice.evidenceUrl && (
            <Link href={notice.evidenceUrl} className="underline font-semibold">Open the evidence pack</Link>
          )}
        </div>
      )}

      {error ? (
        <div className="glass-panel rounded-2xl p-6 border border-border text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      ) : rows === null ? (
        <div className="p-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading appeals...
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 border border-border text-center space-y-2">
          <Inbox className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No {filter === "All" ? "" : filter.toLowerCase() + " "}appeals.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="glass-panel rounded-2xl p-4 border border-border space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[a.status] ?? ""}`}>
                    {statusLabel(a.status)}
                  </span>
                  <span className="font-semibold text-foreground">{a.candidateName}</span>
                  <span className="text-muted-foreground text-xs">{a.sprintTitle ?? "Submission"} · {categoryLabel(a.category)} · {fmtDate(a.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/recruiter/evidence/${a.submissionId}`} className="text-xs text-indigo-700 dark:text-indigo-400 underline">
                    Evidence pack
                  </Link>
                  {a.status === "Open" && (
                    <button
                      onClick={() => openDialog(a)}
                      disabled={!a.canResolve}
                      title={a.cannotResolveReason ?? undefined}
                      className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{a.reason}</p>
              <p className="text-xs text-muted-foreground">
                Latest decision:{" "}
                {a.latestDecision ? `${a.latestDecision.decision} by ${a.latestDecision.reviewerName} on ${fmtDate(a.latestDecision.createdAt)}` : "none yet"}
              </p>
              {a.cannotResolveReason && <p className="text-xs text-amber-700 dark:text-amber-400">{a.cannotResolveReason}</p>}
              {a.response && (
                <div className="rounded-lg bg-muted/40 border border-border p-2 text-xs">
                  <span className="font-semibold text-foreground">Response by {a.resolverName ?? "reviewer"} ({fmtDate(a.resolvedAt)}): </span>
                  <span className="text-foreground whitespace-pre-wrap">{a.response}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {resolving && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="resolve-title">
          <form onSubmit={resolve} className="glass-panel bg-card rounded-2xl p-5 border border-border w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="resolve-title" className="text-base font-bold text-foreground">Resolve appeal: {resolving.candidateName}</h2>
              <button type="button" onClick={() => setResolving(null)} aria-label="Close" className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">{resolving.reason}</p>
            <fieldset className="grid gap-2">
              <legend className="sr-only">Outcome</legend>
              {[
                { value: "Upheld" as const, label: "Uphold the original result", hint: "The appeal does not change the assessment." },
                { value: "Overturned" as const, label: "Overturn: the appeal succeeds", hint: "Re-review the submission and record a new decision in the evidence pack. The earlier decision stays in its history." },
              ].map((o) => (
                <label
                  key={o.value}
                  className={`rounded-xl border p-3 cursor-pointer text-sm ${outcome === o.value ? "border-indigo-500 bg-indigo-500/10" : "border-border hover:bg-muted/50"}`}
                >
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    <input type="radio" name="outcome" checked={outcome === o.value} onChange={() => setOutcome(o.value)} />
                    {o.label}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-1">{o.hint}</span>
                </label>
              ))}
            </fieldset>
            <div>
              <label htmlFor="response" className="text-xs font-semibold text-foreground">Response to the candidate (emailed to them)</label>
              <textarea
                id="response"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={4}
                maxLength={4000}
                className="mt-1 w-full rounded-xl bg-background border border-border p-3 text-sm text-foreground"
              />
              <div className={`text-[11px] mt-1 ${responseLength >= MIN_RESPONSE ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}`}>
                {responseLength}/{MIN_RESPONSE} characters minimum
              </div>
            </div>
            {resolveError && (
              <p className="text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {resolveError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setResolving(null)} className="py-2 px-3 rounded-xl bg-card hover:bg-muted border border-border text-sm cursor-pointer">
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !outcome || responseLength < MIN_RESPONSE}
                className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Resolve appeal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
