"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { authenticatedFetch } from "@/lib/apiClient";
import { AlertCircle, CheckCircle2, ExternalLink, Eye, FileBarChart, Loader2, Send, Undo2 } from "lucide-react";
import TransparencyReportView from "@/components/transparency/TransparencyReportView";
import { formatDate, formatPeriod, type AdminReport } from "@/lib/transparency";

interface Loaded<T> {
  key: string;
  data: T | null;
  error: string | null;
}

async function readError(res: Response, fallback: string) {
  if (res.status === 401 || res.status === 403) return "You need super admin access for this.";
  try {
    const body = await res.json();
    if (body?.error) return body.error as string;
  } catch {
    // non-JSON body
  }
  return `${fallback} (HTTP ${res.status}).`;
}

function previousMonth() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Published: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Withdrawn: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[status] ?? "border-border"}`}>{status}</span>;
}

export default function AdminTransparencyPage() {
  const { getToken } = useAuth();
  const defaults = previousMonth();
  const [periodStart, setPeriodStart] = useState(defaults.start);
  const [periodEnd, setPeriodEnd] = useState(defaults.end);
  const [generating, setGenerating] = useState(false);

  const [version, setVersion] = useState(0);
  const [list, setList] = useState<Loaded<AdminReport[]> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Loaded<AdminReport> | null>(null);

  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"publish" | "withdraw" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const listKey = String(version);
  useEffect(() => {
    let active = true;
    authenticatedFetch("/api/transparency/reports", {}, getToken)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, "Could not load reports"));
        return (await res.json()) as AdminReport[];
      })
      .then((data) => active && setList({ key: listKey, data, error: null }))
      .catch((e) => active && setList({ key: listKey, data: null, error: e instanceof Error ? e.message : "Could not load reports." }));
    return () => {
      active = false;
    };
  }, [getToken, listKey]);

  const detailKey = `${selectedId}|${version}`;
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    authenticatedFetch(`/api/transparency/reports/${selectedId}`, {}, getToken)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, "Could not load the report"));
        return (await res.json()) as AdminReport;
      })
      .then((data) => active && setDetail({ key: detailKey, data, error: null }))
      .catch((e) => active && setDetail({ key: detailKey, data: null, error: e instanceof Error ? e.message : "Could not load the report." }));
    return () => {
      active = false;
    };
  }, [getToken, selectedId, detailKey]);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setMessage(null);
    try {
      const res = await authenticatedFetch("/api/transparency/reports", { method: "POST", body: JSON.stringify({ periodStart, periodEnd }) }, getToken);
      if (!res.ok) {
        setMessage({ ok: false, text: await readError(res, "Could not generate the report") });
        return;
      }
      const created = (await res.json()) as AdminReport;
      setSelectedId(created.id);
      setNotes("");
      setVersion((v) => v + 1);
      setMessage({ ok: true, text: `Draft generated for ${formatPeriod(created.periodStart, created.periodEnd)}. Review it below before publishing.` });
    } catch {
      setMessage({ ok: false, text: "Network error while generating the report." });
    } finally {
      setGenerating(false);
    }
  };

  const act = async (action: "publish" | "withdraw") => {
    if (!selectedId) return;
    const prompt =
      action === "publish"
        ? "Publish this report? It becomes publicly visible and cannot be edited, only withdrawn."
        : "Withdraw this report? If it was published, it stays listed publicly as withdrawn with your reason.";
    if (!window.confirm(prompt)) return;
    setBusy(action);
    setMessage(null);
    try {
      const res = await authenticatedFetch(`/api/transparency/reports/${selectedId}/${action}`, { method: "POST", body: JSON.stringify({ notes: notes.trim() || null }) }, getToken);
      if (!res.ok) {
        setMessage({ ok: false, text: await readError(res, `Could not ${action} the report`) });
        return;
      }
      setNotes("");
      setVersion((v) => v + 1);
      setMessage({ ok: true, text: action === "publish" ? "Report published." : "Report withdrawn." });
    } catch {
      setMessage({ ok: false, text: "Network error." });
    } finally {
      setBusy(null);
    }
  };

  const listLoading = list?.key !== listKey;
  const detailLoading = selectedId != null && detail?.key !== detailKey;
  const selected = detail?.key === detailKey ? detail.data : null;
  const inputClass = "mt-1 w-full rounded-xl bg-card border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground";

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-border flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
            <FileBarChart className="w-4 h-4" /> Transparency
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mt-1">Transparency reports</h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Generate a platform-wide report for a period, review the frozen draft, then publish it. Published reports can be withdrawn with a public reason but never edited.
          </p>
        </div>
        <Link href="/transparency" className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline inline-flex items-center gap-1">
          Public page <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={generate} className="glass-panel rounded-2xl border border-border p-5 space-y-3">
          <h2 className="text-sm font-bold text-foreground">Generate a draft</h2>
          <label className="block text-xs font-semibold text-foreground">
            Period start (UTC)
            <input type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-foreground">
            Period end (UTC, inclusive)
            <input type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputClass} />
          </label>
          <button
            type="submit"
            disabled={generating || !periodStart || !periodEnd}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            {generating && <Loader2 className="w-4 h-4 animate-spin" />} Generate draft
          </button>
          {message && (
            <p className={`text-xs flex items-start gap-1.5 ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
              {message.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />} {message.text}
            </p>
          )}
        </form>

        <div className="lg:col-span-2 glass-panel rounded-2xl border border-border p-5 space-y-3">
          <h2 className="text-sm font-bold text-foreground">All reports</h2>
          {listLoading ? (
            <div className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
          ) : list?.error ? (
            <p className="text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {list.error}</p>
          ) : !list?.data?.length ? (
            <p className="text-sm text-muted-foreground">No reports yet. Generate a draft to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-semibold">Period</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Generated</th>
                    <th className="py-2 pr-3 font-semibold">Published</th>
                    <th className="py-2 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((r) => (
                    <tr key={r.id} className={`border-b border-border last:border-0 ${r.id === selectedId ? "bg-indigo-500/5" : ""}`}>
                      <td className="py-2 pr-3 text-foreground whitespace-nowrap">{formatPeriod(r.periodStart, r.periodEnd)}</td>
                      <td className="py-2 pr-3"><StatusBadge status={r.status} /></td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{formatDate(r.generatedAt)} · {r.generatedBy}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{r.publishedAt ? `${formatDate(r.publishedAt)} · ${r.publishedBy ?? ""}` : "—"}</td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(r.id);
                            setNotes("");
                            setMessage(null);
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedId && (
        <div className="space-y-4">
          {detailLoading ? (
            <div className="glass-panel rounded-2xl border border-border py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading report...
            </div>
          ) : detail?.error ? (
            <p className="text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {detail.error}</p>
          ) : selected ? (
            <>
              <div className="glass-panel rounded-2xl border border-border p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground">{formatPeriod(selected.periodStart, selected.periodEnd)}</h2>
                  <StatusBadge status={selected.status} />
                </div>
                {selected.notes && <p className="text-xs text-muted-foreground">Release notes: {selected.notes}</p>}
                {selected.status === "Withdrawn" && (
                  <p className="text-xs text-muted-foreground">
                    Withdrawn {formatDate(selected.withdrawnAt)} by {selected.withdrawnBy ?? "unknown"}
                    {selected.withdrawalReason ? `: ${selected.withdrawalReason}` : ""}
                  </p>
                )}
                {selected.status !== "Withdrawn" && (
                  <>
                    <label className="block text-xs font-semibold text-foreground">
                      {selected.status === "Draft" ? "Notes (shown publicly as release notes when publishing; optional reason when withdrawing)" : "Public reason for withdrawal (required, at least 10 characters)"}
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} className={inputClass} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selected.status === "Draft" && (
                        <button
                          type="button"
                          onClick={() => act("publish")}
                          disabled={busy != null}
                          className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                        >
                          {busy === "publish" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Publish
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => act("withdraw")}
                        disabled={busy != null || (selected.status === "Published" && notes.trim().length < 10)}
                        className="py-2 px-4 rounded-xl bg-card hover:bg-muted border border-border disabled:opacity-50 text-sm font-semibold text-foreground inline-flex items-center gap-2 cursor-pointer"
                      >
                        {busy === "withdraw" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} {selected.status === "Draft" ? "Discard draft" : "Withdraw"}
                      </button>
                    </div>
                  </>
                )}
              </div>
              {selected.report ? (
                <TransparencyReportView report={selected.report} meta={selected} draft={selected.status !== "Published"} />
              ) : (
                <p className="text-sm text-rose-700 dark:text-rose-400">The stored report payload could not be read.</p>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
