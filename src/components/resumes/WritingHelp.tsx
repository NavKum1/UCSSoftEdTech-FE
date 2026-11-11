"use client";

/**
 * AI help for a built résumé (docs/resume_tools_plan_nov2026.md, stage 4): line-by-line feedback, and tailoring to a saved job
 * check. Suggestions are shown next to the original and applied only as the person accepts them; nothing is saved until they
 * save a version (where verified marks are checked again). Each AI request uses one of the month's AI uses.
 */
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquareText, Sparkles } from "lucide-react";
import { useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, ErrorBanner } from "@/components/career/ui";

interface Allowance { limit: number; left: number; reason: string | null }
interface Comment { lineId: string; line: string; kind: string; comment: string }
interface LineSuggestion { lineId: string; entryId: string; original: string; suggested: string; verified: boolean }
interface OrderSuggestion { entryId: string; title: string; original: string[]; suggested: string[] }
interface JobCheck { id: string; title: string; company: string | null; requirementCount: number }

export default function WritingHelp({
  documentId,
  versionId,
  dirty,
  lineText,
  onApply,
}: {
  documentId: string;
  versionId: string | null;
  dirty: boolean;
  /** The current text of a line, to show a suggested order in words */
  lineText: (lineId: string) => string;
  onApply: (lines: Record<string, string>, orders: Record<string, string[]>) => void;
}) {
  const en = useEn();
  const { apiFetch, ready } = useLegacyApi();
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [checks, setChecks] = useState<JobCheck[]>([]);
  const [checkId, setCheckId] = useState("");
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [lines, setLines] = useState<LineSuggestion[] | null>(null);
  const [orders, setOrders] = useState<OrderSuggestion[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, c] = await Promise.all([apiFetch("/api/resumes/ai-allowance"), apiFetch("/api/resumes/job-checks")]);
    if (a.ok) setAllowance((await a.json()) as Allowance);
    if (c.ok) setChecks(((await c.json()) as JobCheck[]).filter((x) => x.requirementCount > 0));
  }, [apiFetch]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);
  // Suggestions were made for the saved version: after an edit or a new version they no longer fit, so they go. Done while
  // rendering (not in an effect), so the stale suggestions are never shown for a moment
  const [seen, setSeen] = useState({ versionId, dirty });
  if (seen.versionId !== versionId || seen.dirty !== dirty) {
    const newVersion = seen.versionId !== versionId;
    setSeen({ versionId, dirty });
    if (newVersion || dirty) {
      setLines(null);
      setOrders([]);
    }
    if (newVersion) setComments(null);
  }

  const call = async <T,>(key: string, path: string, body?: unknown): Promise<T | null> => {
    setBusy(key);
    setError(null);
    try {
      const res = await apiFetch(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
      if (!res.ok) {
        setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? en("That didn't work. Please try again."));
        return null;
      }
      return (await res.json()) as T;
    } catch {
      setError(en("We couldn't reach Edulexa. Check your internet connection and try again."));
      return null;
    } finally {
      setBusy(null);
      void load();
    }
  };

  const feedback = async () => {
    if (!versionId) return;
    const r = await call<{ comments: Comment[] }>("feedback", `/api/resumes/versions/${versionId}/feedback`);
    if (r) setComments(r.comments);
  };
  const tailor = async () => {
    const r = await call<{ lines: LineSuggestion[]; orders: OrderSuggestion[] }>("tailor", `/api/resumes/${documentId}/tailor`, { jobCheckId: checkId, versionId });
    if (r) {
      setLines(r.lines);
      setOrders(r.orders);
      // Nothing is ticked: the person reads each suggestion and chooses
      setAccepted(new Set());
    }
  };
  const toggle = (key: string) => setAccepted((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });
  const apply = () => {
    const l: Record<string, string> = {};
    for (const x of lines ?? []) if (accepted.has(`line:${x.lineId}`)) l[x.lineId] = x.suggested;
    const o: Record<string, string[]> = {};
    for (const x of orders) if (accepted.has(`order:${x.entryId}`)) o[x.entryId] = x.suggested;
    onApply(l, o);
    setLines(null);
    setOrders([]);
  };

  const aiOff = !allowance || !!allowance.reason || dirty || !versionId;
  const KIND: Record<string, string> = { clarity: en("Clarity"), verb: en("Stronger verb"), outcome: en("Outcome") };

  return (
    <section aria-labelledby="ai-help" className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 id="ai-help" className="text-base font-semibold">{en("AI help")}</h2>
      <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
        {dirty
          ? en("Save your changes first: AI help reads the saved version.")
          : allowance?.reason
            ? allowance.reason
            : allowance
              ? en("Each request uses 1 of your {limit} AI uses this month; {left} left. The AI only suggests: you choose what to keep.", { limit: allowance.limit, left: allowance.left })
              : null}
      </p>
      <ErrorBanner error={error} />
      <div className="mt-3 space-y-3">
        <Button type="button" variant="secondary" className="w-full justify-center" busy={busy === "feedback"} disabled={aiOff} onClick={() => void feedback()}>
          <MessageSquareText aria-hidden="true" className="h-4 w-4" />
          {en("Get feedback on each line")}
        </Button>
        <div className="space-y-2">
          <label htmlFor="tailor-check" className="block text-sm font-medium">{en("Tailor to a job")}</label>
          {checks.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {en("Save a job check with its requirements first.")}{" "}
              <Link href="/resumes/job-check" className="underline">{en("Job check")}</Link>
            </p>
          ) : (
            <>
              <select id="tailor-check" value={checkId} onChange={(e) => setCheckId(e.target.value)} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm">
                <option value="">{en("Choose a job check…")}</option>
                {checks.map((c) => (
                  <option key={c.id} value={c.id}>{c.company ? `${c.title}, ${c.company}` : c.title}</option>
                ))}
              </select>
              <Button type="button" variant="secondary" className="w-full justify-center" busy={busy === "tailor"} disabled={aiOff || !checkId} onClick={() => void tailor()}>
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                {en("Suggest changes for this job")}
              </Button>
            </>
          )}
        </div>
      </div>

      {comments && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-sm font-semibold">{en("Feedback")}</h3>
          {comments.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">{en("No suggestions this time.")}</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {comments.map((c, i) => (
                <li key={i} className="text-sm">
                  <p className="text-xs text-muted-foreground">“{c.line}”</p>
                  <p className="mt-0.5"><Badge tone="info">{KIND[c.kind] ?? c.kind}</Badge> {c.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {lines && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-sm font-semibold">{en("Suggested changes")}</h3>
          {lines.length === 0 && orders.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">{en("No changes suggested for this job.")}</p>
          ) : (
            <>
              <ul className="mt-2 space-y-3">
                {lines.map((l) => (
                  <li key={l.lineId}>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" checked={accepted.has(`line:${l.lineId}`)} onChange={() => toggle(`line:${l.lineId}`)} />
                      <span className="min-w-0">
                        <span className="block text-xs text-muted-foreground line-through decoration-muted-foreground/50">{l.original}</span>
                        <span className="block">{l.suggested}</span>
                        {l.verified && <span className="block text-xs text-muted-foreground">{en("A verified line keeps its mark only if its numbers stay the same.")}</span>}
                      </span>
                    </label>
                  </li>
                ))}
                {orders.map((o) => (
                  <li key={o.entryId}>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" checked={accepted.has(`order:${o.entryId}`)} onChange={() => toggle(`order:${o.entryId}`)} />
                      <span className="min-w-0">
                        <span className="block font-medium">{en("New order for {entry}", { entry: o.title || en("an entry") })}</span>
                        <ol className="mt-1 list-decimal space-y-0.5 ps-4 text-xs text-muted-foreground">
                          {o.suggested.map((id) => <li key={id}>{lineText(id)}</li>)}
                        </ol>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <Button type="button" className="mt-3 w-full justify-center" disabled={accepted.size === 0} onClick={apply}>
                {en("Apply the ones I chose")}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
