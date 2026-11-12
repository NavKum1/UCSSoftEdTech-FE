"use client";

import React, { useEffect, useState } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { RefreshCw } from "lucide-react";
import { Button, EmptyState, ErrorBanner, Loading, PageHeader, Tabs } from "@/components/career/ui";
import { authenticatedFetch } from "@/lib/apiClient";
import { STATUS_STYLES, accommodationLabel, errorMessage, fmtDate } from "@/lib/candidateExperience";
import { useEn } from "@/lib/english/EnglishProvider";

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
  const en = useEn();
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
      setError(en("We couldn't reach Edulexa while recording the decision. Please check your connection and try again."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-sm font-medium text-foreground">{en("Note to the candidate (required to decline, at least 20 characters)")}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={2000}
          className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => decide("Approved")} disabled={busy !== null} busy={busy === "Approved"}>
          {en("Approve")}
        </Button>
        <Button variant="secondary" onClick={() => decide("Declined")} disabled={busy !== null || note.trim().length < 20} busy={busy === "Declined"}>
          {en("Decline")}
        </Button>
        {error && <span role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</span>}
      </div>
    </div>
  );
}

export default function RecruiterAccommodationsPage() {
  const en = useEn();
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
      <PageHeader
        title={en("Accommodation requests")}
        description={en("Approved accommodations appear in the candidate's evidence packs so reviewers interpret timing and defense format fairly. An approved written-defense accommodation lets the candidate defend their code in writing instead of by voice.")}
        actions={
          <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            {en("Refresh")}
          </Button>
        }
      />

      <Tabs
        label={en("Request status")}
        value={filter}
        onChange={(f) => {
          setRows(null);
          setFilter(f);
        }}
        items={FILTERS.map((f) => ({ id: f, label: en(f) }))}
      />

      {error ? (
        <ErrorBanner error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : rows === null ? (
        <Loading label={en("Loading requests…")} />
      ) : rows.length === 0 ? (
        <EmptyState title={en("No {value}requests.", { value: filter === "All" ? "" : filter.toLowerCase() + " " })} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status] ?? ""}`}>{r.status.replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
                <span className="font-semibold text-foreground">{r.candidateName}</span>
                <span className="text-xs text-muted-foreground">
                  {en("{type} · {value} · requested {date}", { type: en(accommodationLabel(r.type)), value: r.sprintTitle ?? r.scope, date: fmtDate(r.createdAt) })}
                </span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{r.details}</p>
              {r.status === "Requested" ? (
                <DecisionForm row={r} getToken={getToken} onDone={() => setReloadKey((k) => k + 1)} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {r.status.replace(/([a-z])([A-Z])/g, "$1 $2")} by {r.decidedBy ?? "reviewer"} on {fmtDate(r.decidedAt)}
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
