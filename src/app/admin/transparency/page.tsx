"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { AlertCircle, CheckCircle2, ExternalLink, Eye, Loader2, Send, Undo2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Loading, PageHeader, ScrollArea, buttonClass } from "@/components/career/ui";
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
  return `${fallback}. Please try again.`;
}

function previousMonth() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const STATUS_TONES: Record<string, "warn" | "good" | "bad"> = { Draft: "warn", Published: "good", Withdrawn: "bad" };

function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{status}</Badge>;
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
      .catch((e) => active && setList({ key: listKey, data: null, error: e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not load reports." }));
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
      .catch((e) => active && setDetail({ key: detailKey, data: null, error: e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not load the report." }));
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
  const inputClass = "mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal text-foreground shadow-sm placeholder:text-muted-foreground";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transparency reports"
        description="Generate a platform-wide report for a period, review the frozen draft, then publish it. Published reports can be withdrawn with a public reason but never edited."
        actions={
          <Link href="/transparency" className={buttonClass("secondary")}>
            Public page <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={generate} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Generate a draft</h2>
          <label className="block text-sm font-medium text-foreground">
            Period start (UTC)
            <input type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Period end (UTC, inclusive)
            <input type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputClass} />
          </label>
          <Button type="submit" busy={generating} disabled={!periodStart || !periodEnd} className="w-full">
            Generate draft
          </Button>
          {message && (
            <p role={message.ok ? "status" : "alert"} className={`flex items-start gap-1.5 text-sm ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
              {message.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />} {message.text}
            </p>
          )}
        </form>

        <Card title="All reports" className="lg:col-span-2">
          {listLoading ? (
            <Loading />
          ) : list?.error ? (
            <p className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400"><AlertCircle className="h-4 w-4" aria-hidden /> {list.error}</p>
          ) : !list?.data?.length ? (
            <EmptyState title="No reports yet">Generate a draft to get started.</EmptyState>
          ) : (
            <ScrollArea label="All reports">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-xs text-muted-foreground">
                    <th className="py-2 pe-3 text-start font-medium">Period</th>
                    <th className="py-2 pe-3 text-start font-medium">Status</th>
                    <th className="py-2 pe-3 text-start font-medium">Generated</th>
                    <th className="py-2 pe-3 text-start font-medium">Published</th>
                    <th className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((r) => (
                    <tr key={r.id} className={`border-b border-border last:border-0 ${r.id === selectedId ? "bg-muted/60" : ""}`}>
                      <td className="whitespace-nowrap py-2 pe-3 text-foreground">{formatPeriod(r.periodStart, r.periodEnd)}</td>
                      <td className="py-2 pe-3"><StatusBadge status={r.status} /></td>
                      <td className="py-2 pe-3 text-xs text-muted-foreground">{formatDate(r.generatedAt)} · {r.generatedBy}</td>
                      <td className="py-2 pe-3 text-xs text-muted-foreground">{r.publishedAt ? `${formatDate(r.publishedAt)} · ${r.publishedBy ?? ""}` : "—"}</td>
                      <td className="py-2 text-end">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setSelectedId(r.id);
                            setNotes("");
                            setMessage(null);
                          }}
                        >
                          <Eye className="h-4 w-4" aria-hidden /> Preview
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </Card>
      </div>

      {selectedId && (
        <div className="space-y-4">
          {detailLoading ? (
            <Loading label="Loading report..." />
          ) : detail?.error ? (
            <p className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400"><AlertCircle className="h-4 w-4" aria-hidden /> {detail.error}</p>
          ) : selected ? (
            <>
              <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground">{formatPeriod(selected.periodStart, selected.periodEnd)}</h2>
                  <StatusBadge status={selected.status} />
                </div>
                {selected.notes && <p className="text-sm text-muted-foreground">Release notes: {selected.notes}</p>}
                {selected.status === "Withdrawn" && (
                  <p className="text-sm text-muted-foreground">
                    Withdrawn {formatDate(selected.withdrawnAt)} by {selected.withdrawnBy ?? "unknown"}
                    {selected.withdrawalReason ? `: ${selected.withdrawalReason}` : ""}
                  </p>
                )}
                {selected.status !== "Withdrawn" && (
                  <>
                    <label className="block text-sm font-medium text-foreground">
                      {selected.status === "Draft" ? "Notes (shown publicly as release notes when publishing; optional reason when withdrawing)" : "Public reason for withdrawal (required, at least 10 characters)"}
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} className={inputClass} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selected.status === "Draft" && (
                        <Button type="button" onClick={() => act("publish")} disabled={busy != null}>
                          {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />} Publish
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => act("withdraw")}
                        disabled={busy != null || (selected.status === "Published" && notes.trim().length < 10)}
                      >
                        {busy === "withdraw" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Undo2 className="h-4 w-4" aria-hidden />} {selected.status === "Draft" ? "Discard draft" : "Withdraw"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
              {selected.report ? (
                <TransparencyReportView report={selected.report} meta={selected} draft={selected.status !== "Published"} />
              ) : (
                <p className="text-sm text-red-700 dark:text-red-400">We couldn&apos;t open this report. Please try again or create it again.</p>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
