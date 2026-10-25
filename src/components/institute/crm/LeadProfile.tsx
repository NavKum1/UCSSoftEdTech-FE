"use client";

/**
 * What the person shared with their inquiry: their question or what they're unsure about, their answers to the
 * institute's guidance form, and (when they chose to share it) their counselling quiz result with every answer. Helps a
 * counsellor understand someone who can't decide which area or certification suits them before calling.
 */

import React from "react";
import type { LeadFull } from "./api";
import AnswerFiles from "@/components/guidance/AnswerFiles";

const CONFIDENCE: Record<string, string> = {
  clear: "A clear match: their answers point mostly to one area.",
  moderate: "A moderate match: one area leads, with a second close behind.",
  close: "A close call: two areas are nearly tied, so they may be unsure between them.",
  none: "No clear match: their answers are spread across areas.",
};

export default function LeadProfile({ lead }: { lead: LeadFull }) {
  const q = lead.quiz;
  return (
    <div className="space-y-6 text-sm">
      <section>
        <h3 className="font-semibold">{lead.requestType === "guidance" ? "What they're unsure about" : "Their question"}</h3>
        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{lead.notes?.trim() || "They didn't add a question."}</p>
      </section>

      {lead.situation && lead.situation.length > 0 && (
        <section>
          <h3 className="font-semibold">Their answers to your guidance form</h3>
          <dl className="mt-1 space-y-2">
            {lead.situation.map((s, i) => (
              <div key={i}>
                <dt className="text-muted-foreground">{s.question}</dt>
                <dd className="whitespace-pre-wrap font-medium">
                  {s.answer}
                  <AnswerFiles files={s.files} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {!q ? (
        <p className="rounded-xl bg-muted/60 p-3 text-muted-foreground">They didn&apos;t share counselling quiz answers with this inquiry.</p>
      ) : (
        <>
          <section>
            <h3 className="font-semibold">Counselling quiz result</h3>
            <p className="mt-1 text-xs text-muted-foreground">Taken {new Date(q.takenAt).toLocaleDateString()}. Shared by the person with this inquiry.</p>
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
                    <div className="h-full rounded-full bg-cyan-600" style={{ width: `${Math.min(100, r.percent)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">Score per area: of the questions that offered that area, the share where they picked it.</p>
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

          <details>
            <summary className="cursor-pointer font-semibold">All their answers ({q.answers.length})</summary>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {q.answers.map((a, i) => (
                <li key={i}>
                  <span className="text-muted-foreground">{a.question}</span>
                  <span className="block font-medium">{a.answer}</span>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </div>
  );
}
