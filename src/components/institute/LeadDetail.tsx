"use client";

/**
 * One lead, as the candidate shared it: contact details, their question or what they're unsure about, and (when they
 * chose to share it) their counselling quiz result: the suggested area and how clear the match is, scores by area, the
 * answers that pointed to each area, and every question with the answer they picked. Helps an advisor understand
 * a candidate who can't decide which area or certification suits them.
 */

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";

interface Shared {
  takenAt: string;
  primaryTrack: string;
  secondaryTrack: string;
  matchConfidence: string;
  ranking: { track: string; percent: number; picked: number; offered: number }[];
  reasons: { track: string; question: string; answer: string }[];
  answers: { question: string; answer: string }[];
}
interface Detail {
  leadId: string;
  status: string;
  createdAt: string;
  courseName: string | null;
  candidateName: string | null;
  candidateEmail: string | null;
  candidatePhone: string | null;
  notes: string | null;
  primaryTrack: string | null;
  quizShared: boolean;
  requestType: "guidance" | "course";
  situation: { question: string; answer: string }[] | null;
  quiz: Shared | null;
}

const CONFIDENCE: Record<string, string> = {
  clear: "A clear match: their answers point mostly to one area.",
  moderate: "A moderate match: one area leads, with a second close behind.",
  close: "A close call: two areas are nearly tied, so they may be unsure between them.",
  none: "No clear match: their answers are spread across areas.",
};

export default function LeadDetail({ leadId, getToken, onClose }: { leadId: string; getToken: () => Promise<string | null>; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch(`/api/institute/leads/${leadId}`, {}, getToken)
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) setDetail((await res.json()) as Detail);
        else setError("We couldn't load this lead.");
      })
      .catch(() => !cancelled && setError("We couldn't load this lead."));
    return () => {
      cancelled = true;
    };
  }, [leadId, getToken]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = detail?.quiz;
  return (
    <div className="fixed inset-0 z-100 flex justify-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-title"
        className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="lead-title" className="text-lg font-semibold">
            {detail?.candidateName ?? "Lead"}
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-muted">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-red-700 dark:text-red-400">{error}</p>}
        {!detail && !error && <div className="mt-4 h-40 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-busy="true" />}
        {detail && (
          <div className="mt-4 space-y-6 text-sm">
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{detail.candidateEmail || "—"}</dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{detail.candidatePhone || "—"}</dd>
              <dt className="text-muted-foreground">Request</dt>
              <dd>{detail.requestType === "guidance" ? "Career guidance (no course chosen)" : (detail.courseName ?? "Course no longer listed")}</dd>
              <dt className="text-muted-foreground">Received</dt>
              <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{detail.status}</dd>
            </dl>

            <section>
              <h3 className="font-semibold">{detail.requestType === "guidance" ? "What they're unsure about" : "Their question"}</h3>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{detail.notes?.trim() || "They didn't add a question."}</p>
            </section>

            {detail.situation && detail.situation.length > 0 && (
              <section>
                <h3 className="font-semibold">Their answers to your guidance form</h3>
                <dl className="mt-1 space-y-2">
                  {detail.situation.map((s, i) => (
                    <div key={i}>
                      <dt className="text-muted-foreground">{s.question}</dt>
                      <dd className="whitespace-pre-wrap font-medium">{s.answer}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {!q ? (
              <p className="rounded-xl bg-muted/60 p-3 text-muted-foreground">
                They didn&apos;t share their quiz answers with this inquiry
                {detail.primaryTrack ? ` (the area their result suggested: ${detail.primaryTrack})` : ""}.
              </p>
            ) : (
              <>
                <section>
                  <h3 className="font-semibold">Counselling quiz result</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Taken {new Date(q.takenAt).toLocaleDateString()}. Shared by the candidate with this inquiry.</p>
                  <p className="mt-2">
                    Suggested area: <span className="font-medium">{q.primaryTrack}</span>
                    {q.secondaryTrack && (
                      <>
                        , then <span className="font-medium">{q.secondaryTrack}</span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-muted-foreground">{CONFIDENCE[q.matchConfidence] ?? q.matchConfidence}</p>
                  <ul className="mt-3 space-y-1.5">
                    {q.ranking.map((r) => (
                      <li key={r.track}>
                        <div className="flex justify-between text-xs">
                          <span>{r.track}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {r.percent}% ({r.picked} of {r.offered})
                          </span>
                        </div>
                        <div className="mt-0.5 h-1.5 rounded-full bg-muted" aria-hidden="true">
                          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.min(100, r.percent)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Score per area: of the questions that offered that area, the share where they picked it.
                  </p>
                </section>

                {q.reasons.length > 0 && (
                  <section>
                    <h3 className="font-semibold">Why the quiz suggested it</h3>
                    <ul className="mt-1 space-y-1.5">
                      {q.reasons.map((r, i) => (
                        <li key={i}>
                          <span className="text-muted-foreground">{r.question}</span> <span className="font-medium">{r.answer}</span>{" "}
                          <span className="text-xs text-muted-foreground">({r.track})</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section>
                  <h3 className="font-semibold">All their answers ({q.answers.length})</h3>
                  <ol className="mt-1 list-decimal space-y-2 pl-5">
                    {q.answers.map((a, i) => (
                      <li key={i}>
                        <span className="text-muted-foreground">{a.question}</span>
                        <span className="block font-medium">{a.answer}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
