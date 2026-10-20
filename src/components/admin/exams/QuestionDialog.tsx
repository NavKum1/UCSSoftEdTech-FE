"use client";

/**
 * H12: add or edit one exam question. An edit of a question that attempts already showed is saved as a new version
 * (the API retires the old one), so past grades stay as they were; the dialog says so before saving.
 */

import React, { useId, useState } from "react";
import { Button, ErrorBanner, Field, Modal } from "@/components/career/ui";
import { ADMIN_BASE, useExamAdminApi, type Question } from "@/components/admin/exams/shared";

const MAX_OPTIONS = 8;

export function QuestionDialog({ examId, question, onClose, onSaved }: { examId: string; question: Question | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const { call } = useExamAdminApi();
  const titleId = useId();
  const groupId = useId();
  const [text, setText] = useState(question?.questionText ?? "");
  const [code, setCode] = useState(question?.codeSnippet ?? "");
  const [options, setOptions] = useState<string[]>(question?.options?.length ? question.options : ["", "", "", ""]);
  const [correct, setCorrect] = useState(question?.correctOptionIndex ?? 0);
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [topic, setTopic] = useState(question?.topic ?? "");
  const [status, setStatus] = useState<"Approved" | "Draft">("Approved");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const willVersion = !!question && question.status === "Approved" && question.timesServed > 0;

  const setOption = (i: number, v: string) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  const removeOption = (i: number) => {
    setOptions((o) => o.filter((_, j) => j !== i));
    setCorrect((c) => (c === i ? 0 : c > i ? c - 1 : c));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    // trailing empty options are dropped; the API checks the rest
    const trimmed = [...options];
    while (trimmed.length > 2 && !trimmed[trimmed.length - 1].trim() && trimmed.length - 1 > correct) trimmed.pop();
    const json = { questionText: text, codeSnippet: code || null, options: trimmed, correctOptionIndex: correct, explanation, topic, ...(question ? { expectedVersion: question.version } : { status }) };
    try {
      if (question) {
        const r = await call<{ versioned: boolean; unchanged?: boolean; question: Question }>(`${ADMIN_BASE}/exams/${encodeURIComponent(examId)}/questions/${question.number}`, { method: "PUT", json });
        onSaved(r.unchanged ? "Nothing changed." : r.versioned ? `Saved as question ${r.question.number} (version ${r.question.revision}); question ${question.number} is retired.` : `Question ${question.number} saved.`);
      } else {
        const r = await call<{ question: Question }>(`${ADMIN_BASE}/exams/${encodeURIComponent(examId)}/questions`, { method: "POST", json });
        onSaved(`Question ${r.question.number} added${r.question.status === "Draft" ? " as a draft" : ""}.`);
      }
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal labelledBy={titleId} onClose={onClose}>
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 id={titleId} className="text-lg font-semibold">
          {question ? `Edit question ${question.number}` : "Add a question"}
        </h2>
        {willVersion && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Attempts have already shown this question ({question!.timesServed}). Saving keeps this version for their grades and adds a new version that new attempts use.
          </p>
        )}
        <ErrorBanner error={err} />
        <Field label="Question">
          {(p) => <textarea {...p} rows={3} value={text} onChange={(e) => setText(e.target.value)} required maxLength={4000} />}
        </Field>
        <Field label="Code snippet (optional)">
          {(p) => <textarea {...p} rows={3} className={`${p.className} font-mono`} value={code} onChange={(e) => setCode(e.target.value)} maxLength={8000} />}
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Options (select the correct one)</legend>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name={groupId}
                id={`${groupId}-r${i}`}
                checked={correct === i}
                onChange={() => setCorrect(i)}
                className="h-4 w-4"
                aria-label={`Option ${i + 1} is the correct answer`}
              />
              <label htmlFor={`${groupId}-o${i}`} className="sr-only">
                Option {i + 1}
              </label>
              <input
                id={`${groupId}-o${i}`}
                value={o}
                onChange={(e) => setOption(i, e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1"
                placeholder={`Option ${i + 1}`}
                maxLength={1000}
              />
              {options.length > 2 && (
                <Button type="button" variant="ghost" onClick={() => removeOption(i)} aria-label={`Remove option ${i + 1}`}>
                  Remove
                </Button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <Button type="button" variant="secondary" onClick={() => setOptions((o) => [...o, ""])}>
              Add option
            </Button>
          )}
        </fieldset>
        <Field label="Explanation (shown after practice attempts only)">
          {(p) => <textarea {...p} rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} maxLength={4000} />}
        </Field>
        <Field label="Topic">
          {(p) => <input {...p} value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} />}
        </Field>
        {!question && (
          <fieldset>
            <legend className="text-sm font-medium">Status</legend>
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              {(["Approved", "Draft"] as const).map((s) => (
                <label key={s} className="flex items-center gap-2">
                  <input type="radio" name={`${groupId}-status`} checked={status === s} onChange={() => setStatus(s)} className="h-4 w-4" />
                  {s === "Approved" ? "Approved (used in new attempts)" : "Draft (not used until approved)"}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            {question ? (willVersion ? "Save as a new version" : "Save") : "Add question"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
