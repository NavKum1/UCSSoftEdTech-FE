"use client";

/**
 * The questions of an institute's career guidance form (set by its admins), as quick to answer as possible: choices are
 * one-tap buttons, text answers are short boxes. Used by "Ask an advisor" (signed in) and the public embedded form.
 */

import React from "react";

export interface GuidanceQuestion {
  id: string;
  label: string;
  kind: "choice" | "text" | "longtext";
  options: string[];
  required: boolean;
}

export const fieldInput =
  "mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-2 focus:outline-indigo-600";

export default function GuidanceFields({
  questions,
  values,
  onChange,
}: {
  questions: GuidanceQuestion[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
  return (
    <>
      {questions.map((q) =>
        q.kind === "choice" ? (
          <fieldset key={q.id}>
            <legend className="text-sm font-medium">
              {q.label}
              {!q.required && <span className="font-normal text-muted-foreground"> (optional)</span>}
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {q.options.map((o) => {
                const on = values[q.id] === o;
                return (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange(q.id, on ? "" : o)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      on ? "border-indigo-600 bg-indigo-600 text-white" : "border-border hover:border-indigo-400 hover:bg-muted"
                    }`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <label key={q.id} className="block text-sm">
            <span className="font-medium">
              {q.label}
              {!q.required && <span className="font-normal text-muted-foreground"> (optional)</span>}
            </span>
            {q.kind === "longtext" ? (
              <textarea rows={2} maxLength={2000} required={q.required} value={values[q.id] ?? ""} onChange={(e) => onChange(q.id, e.target.value)} className={fieldInput} />
            ) : (
              <input maxLength={500} required={q.required} value={values[q.id] ?? ""} onChange={(e) => onChange(q.id, e.target.value)} className={fieldInput} />
            )}
          </label>
        ),
      )}
    </>
  );
}

/** The answers in the API's shape (only answered questions). */
export const toAnswers = (values: Record<string, string>) =>
  Object.entries(values)
    .filter(([, v]) => v.trim())
    .map(([questionId, answer]) => ({ questionId, answer: answer.trim() }));
