"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Button, EmptyState, ErrorBanner, Loading, Modal, PageHeader, Tabs } from "@/components/career/ui";
import { authenticatedFetch } from "@/lib/apiClient";
import { STATUS_STYLES, categoryLabel, errorMessage, fmtDate, statusLabel } from "@/lib/candidateExperience";
import { useEn } from "@/lib/english/EnglishProvider";

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
  const en = useEn();
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
      <PageHeader
        title={en("Candidate appeals")}
        description={en("Appeals must be resolved by someone other than the reviewer who recorded the latest decision. Your response is emailed to the candidate.")}
        actions={
          <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            {en("Refresh")}
          </Button>
        }
      />

      <Tabs
        label={en("Appeal status")}
        value={filter}
        onChange={(f) => {
          setRows(null);
          setFilter(f);
        }}
        items={FILTERS.map((f) => ({ id: f, label: en(f) }))}
      />

      {notice && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span>{notice.text}</span>
          {notice.evidenceUrl && (
            <Link href={notice.evidenceUrl} className="font-medium underline">{en("Open the evidence pack")}</Link>
          )}
        </div>
      )}

      {error ? (
        <ErrorBanner error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : rows === null ? (
        <Loading label={en("Loading appeals…")} />
      ) : rows.length === 0 ? (
        <EmptyState title={en("No {value}appeals.", { value: filter === "All" ? "" : filter.toLowerCase() + " " })} />
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[a.status] ?? ""}`}>
                    {statusLabel(a.status)}
                  </span>
                  <span className="font-semibold text-foreground">{a.candidateName}</span>
                  <span className="text-muted-foreground text-xs">{a.sprintTitle ?? "Submission"} · {categoryLabel(a.category)} · {fmtDate(a.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/recruiter/evidence/${a.submissionId}`} className="text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-400">
                    {en("Evidence pack")}
                  </Link>
                  {a.status === "Open" && (
                    <Button onClick={() => openDialog(a)} disabled={!a.canResolve} title={a.cannotResolveReason ?? undefined}>
                      {en("Resolve")}
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{a.reason}</p>
              <p className="text-xs text-muted-foreground">
                {en("Latest decision: {value}", { value: a.latestDecision ? `${a.latestDecision.decision} by ${a.latestDecision.reviewerName} on ${fmtDate(a.latestDecision.createdAt)}` : en("none yet") })}
              </p>
              {a.cannotResolveReason && <p className="text-xs text-amber-700 dark:text-amber-400">{a.cannotResolveReason}</p>}
              {a.response && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <span className="font-medium text-foreground">{en("Response by {value} ({date}):", { value: a.resolverName ?? "reviewer", date: fmtDate(a.resolvedAt) })}{" "}</span>
                  <span className="text-foreground whitespace-pre-wrap">{a.response}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {resolving && (
        <Modal labelledBy="resolve-title" onClose={() => setResolving(null)}>
          <form onSubmit={resolve} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 id="resolve-title" className="text-base font-semibold text-foreground">{en("Resolve appeal: {candidateName}", { candidateName: resolving.candidateName })}</h2>
              <button type="button" onClick={() => setResolving(null)} aria-label={en("Close")} className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <p className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{resolving.reason}</p>
            <fieldset className="grid gap-2">
              <legend className="sr-only">{en("Outcome")}</legend>
              {[
                { value: "Upheld" as const, label: en("Uphold the original result"), hint: en("The appeal does not change the assessment.") },
                { value: "Overturned" as const, label: en("Overturn: the appeal succeeds"), hint: en("Re-review the submission and record a new decision in the evidence pack. The earlier decision stays in its history.") },
              ].map((o) => (
                <label
                  key={o.value}
                  className={`cursor-pointer rounded-lg border p-3 text-sm transition-colors ${outcome === o.value ? "border-[var(--brand,#0e7490)] bg-muted/50" : "border-border hover:bg-muted/50"}`}
                >
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <input type="radio" name="outcome" checked={outcome === o.value} onChange={() => setOutcome(o.value)} />
                    {en(o.label)}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-1">{en(o.hint)}</span>
                </label>
              ))}
            </fieldset>
            <div>
              <label htmlFor="response" className="text-sm font-medium text-foreground">{en("Response to the candidate (emailed to them)")}</label>
              <textarea
                id="response"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={4}
                maxLength={4000}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1"
              />
              <div className={`mt-1 text-xs ${responseLength >= MIN_RESPONSE ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}`}>
                {en("{responseLength}/{mIN_RESPONSE} characters minimum", { responseLength, mIN_RESPONSE: MIN_RESPONSE })}
              </div>
            </div>
            {resolveError && (
              <p role="alert" className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400"><AlertCircle aria-hidden="true" className="h-4 w-4" /> {resolveError}</p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setResolving(null)}>
                {en("Cancel")}
              </Button>
              <Button type="submit" busy={busy} disabled={!outcome || responseLength < MIN_RESPONSE}>
                {en("Resolve appeal")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
