"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Accessibility, AlertCircle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { STATUS_STYLES, accommodationLabel, errorMessage, fmtDate } from "@/lib/candidateExperience";

interface ReviewAccommodation {
  id: string;
  userId: string;
  candidateName: string;
  type: string;
  details: string;
  status: string;
  sprintId: string | null;
  sprintTitle: string | null;
  scope: string;
  decidedBy: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

const FILTERS = ["Requested", "Approved", "Declined", "All"] as const;

function DecisionForm({ row, onDone, getToken }: { row: ReviewAccommodation; onDone: () => void; getToken: () => Promise<string | null> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"Approved" | "Declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "Approved" | "Declined") => {
    setBusy(decision);
    setError(null);
    try {
      const res = await authenticatedFetch(
        `/api/accommodations/${row.id}/decide`,
        { method: "POST", body: JSON.stringify({ decision, note: note.trim() || null }) },
        getToken
      );
      if (!res.ok) {
        setError(await errorMessage(res, "Could not record the decision"));
        return;
      }
      onDone();
    } catch {
      setError("Network error while recording the decision.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-xs font-semibold text-foreground">Note to the candidate (required to decline, at least 20 characters)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={2000}
          className="mt-1 w-full rounded-xl bg-card border border-border p-2 text-sm text-foreground"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => decide("Approved")}
          disabled={busy !== null}
          className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          {busy === "Approved" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Approve
        </button>
        <button
          onClick={() => decide("Declined")}
          disabled={busy !== null || note.trim().length < 20}
          className="py-1.5 px-3 rounded-lg bg-card hover:bg-muted border border-border disabled:opacity-50 disabled:cursor-not-allowed text-foreground text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          {busy === "Declined" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Decline
        </button>
        {error && <span className="text-xs text-rose-700 dark:text-rose-400">{error}</span>}
      </div>
    </div>
  );
}

export default function RecruiterAccommodationsPage() {
  const { getToken } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Requested");
  const [rows, setRows] = useState<ReviewAccommodation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    authenticatedFetch(`/api/accommodations?status=${filter}`, {}, getToken)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) throw new Error("You need recruiter access to review accommodations.");
        if (!res.ok) throw new Error(await errorMessage(res, "Could not load accommodation requests"));
        return (await res.json()) as ReviewAccommodation[];
      })
      .then((data) => {
        if (!active) return;
        setRows(data);
        setError(null);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load accommodation requests."));
    return () => {
      active = false;
    };
  }, [filter, getToken, reloadKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Accessibility className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> Accommodation requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Approved accommodations appear in the candidate&apos;s evidence packs so reviewers interpret timing and defense format fairly.
            An approved written-defense accommodation lets the candidate defend their code in writing instead of by voice.
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

      {error ? (
        <div className="glass-panel rounded-2xl p-6 border border-border text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      ) : rows === null ? (
        <div className="p-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading requests...
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 border border-border text-center space-y-2">
          <Inbox className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No {filter === "All" ? "" : filter.toLowerCase() + " "}requests.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="glass-panel rounded-2xl p-4 border border-border space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[r.status] ?? ""}`}>{r.status}</span>
                <span className="font-semibold text-foreground">{r.candidateName}</span>
                <span className="text-xs text-muted-foreground">
                  {accommodationLabel(r.type)} · {r.sprintTitle ?? r.scope} · requested {fmtDate(r.createdAt)}
                </span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{r.details}</p>
              {r.status === "Requested" ? (
                <DecisionForm row={r} getToken={getToken} onDone={() => setReloadKey((k) => k + 1)} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {r.status} by {r.decidedBy ?? "reviewer"} on {fmtDate(r.decidedAt)}
                  {r.decisionNote ? ` · Note: ${r.decisionNote}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
