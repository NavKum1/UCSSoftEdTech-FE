"use client";

/**
 * H12: import exam questions from a CSV or JSON file. "Preview" is a dry run (nothing is saved); "Import" adds the
 * questions only when no row has an error.
 */

import React, { useId, useState } from "react";
import { Badge, Button, ErrorBanner, Field, Modal, ScrollArea } from "@/components/career/ui";
import { ADMIN_BASE, ExamApiError, PoolHealthBadge, useExamAdminApi, type PoolHealth } from "@/components/admin/exams/shared";

interface PreviewRow {
  row: number;
  questionText: string | null;
  options: string[] | null;
  correctOptionIndex: number | null;
  topic: string | null;
  errors: string[];
  warnings: string[];
}

interface Preview {
  dryRun: boolean;
  imported: boolean;
  status: string;
  total: number;
  valid: number;
  invalid: number;
  errors: string[];
  warnings: string[];
  numbers: number[];
  poolBefore: number;
  poolAfter: number;
  poolHealthAfter: PoolHealth;
  rows: PreviewRow[];
}

const CSV_EXAMPLE = `question,option1,option2,option3,option4,correct,explanation,topic
"Which index type suits equality lookups?",B-tree,Hash,GiST,BRIN,B,"Hash indexes only serve equality.",Indexes`;

export function ImportDialog({ examId, onClose, onImported }: { examId: string; onClose: () => void; onImported: (msg: string) => void }) {
  const { call } = useExamAdminApi();
  const titleId = useId();
  const helpId = useId();
  const [format, setFormat] = useState<"auto" | "csv" | "json">("auto");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<"Approved" | "Draft">("Approved");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.name.toLowerCase().endsWith(".json")) setFormat("json");
    else if (file.name.toLowerCase().endsWith(".csv")) setFormat("csv");
    setContent(await file.text());
    setPreview(null);
  };

  const run = async (dryRun: boolean) => {
    setBusy(dryRun ? "preview" : "import");
    setErr(null);
    try {
      const r = await call<Preview>(`${ADMIN_BASE}/exams/${encodeURIComponent(examId)}/questions/import`, { method: "POST", json: { format, content, status, dryRun } });
      if (dryRun) setPreview(r);
      else onImported(`Imported ${r.numbers.length} question${r.numbers.length === 1 ? "" : "s"}${r.status === "Draft" ? " as drafts" : ""}.`);
    } catch (x) {
      setErr((x as Error).message);
      if (x instanceof ExamApiError && x.body && typeof x.body === "object" && "rows" in x.body) setPreview(x.body as Preview);
    } finally {
      setBusy(null);
    }
  };

  const canImport = !!preview && preview.dryRun && preview.errors.length === 0 && preview.invalid === 0 && preview.total > 0;

  return (
    <Modal labelledBy={titleId} onClose={onClose}>
      <div className="max-h-[90vh] w-full max-w-4xl space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 id={titleId} className="text-lg font-semibold">
          Import questions
        </h2>
        <div id={helpId} className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">CSV</strong> with a header row: <code>question</code>, <code>option1</code> to <code>option8</code> (or <code>A</code> to <code>H</code>),{" "}
            <code>correct</code> (a letter, a number from 1, or the right option&apos;s text), and optionally <code>explanation</code>, <code>topic</code>, <code>codeSnippet</code>.
          </p>
          <p>
            <strong className="text-foreground">JSON</strong>: a list of <code>{"{ questionText, options, correctOptionIndex, explanation, topic }"}</code> (correctOptionIndex starts at 0).
          </p>
          <details>
            <summary className="cursor-pointer text-foreground">CSV example</summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-2 text-xs text-foreground">{CSV_EXAMPLE}</pre>
          </details>
        </div>
        <ErrorBanner error={err} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="File" hint={fileName ? `Loaded ${fileName}` : "CSV or JSON, up to 500 questions"}>
            {(p) => <input {...p} type="file" accept=".csv,.json,text/csv,application/json" onChange={onFile} />}
          </Field>
          <Field label="Format">
            {(p) => (
              <select {...p} value={format} onChange={(e) => { setFormat(e.target.value as "auto" | "csv" | "json"); setPreview(null); }}>
                <option value="auto">Detect</option>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            )}
          </Field>
        </div>
        <Field label="Or paste the file's content">
          {(p) => (
            <textarea
              {...p}
              rows={6}
              className={`${p.className} font-mono`}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setPreview(null);
              }}
            />
          )}
        </Field>
        <fieldset>
          <legend className="text-sm font-medium">Add the questions as</legend>
          <div className="mt-1 flex flex-wrap gap-4 text-sm">
            {(["Approved", "Draft"] as const).map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input type="radio" name={`${titleId}-status`} checked={status === s} onChange={() => { setStatus(s); setPreview(null); }} className="h-4 w-4" />
                {s === "Approved" ? "Approved (used in new attempts)" : "Drafts (review and approve them later)"}
              </label>
            ))}
          </div>
        </fieldset>

        {preview && (
          <section aria-labelledby={`${titleId}-preview`} className="space-y-3">
            <h3 id={`${titleId}-preview`} className="font-semibold">
              Preview
            </h3>
            <p role="status" className="text-sm">
              {preview.total} question{preview.total === 1 ? "" : "s"} read: {preview.valid} ready, {preview.invalid} with errors. Approved pool: {preview.poolBefore} now,{" "}
              {preview.poolAfter} after the import. <PoolHealthBadge health={preview.poolHealthAfter} />
            </p>
            {preview.poolHealthAfter.level !== "ok" && <p className="text-sm text-muted-foreground">{preview.poolHealthAfter.message}</p>}
            {preview.errors.map((e) => (
              <p key={e} className="text-sm text-red-700 dark:text-red-300">
                {e}
              </p>
            ))}
            {preview.warnings.map((w) => (
              <p key={w} className="text-sm text-amber-800 dark:text-amber-300">
                {w}
              </p>
            ))}
            {preview.rows.length > 0 && (
              <ScrollArea className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Questions in the file</caption>
                  <thead>
                    <tr className="border-b border-border [&_th]:py-2 [&_th]:pe-3 [&_th]:text-start">
                      <th scope="col">Row</th>
                      <th scope="col">Question</th>
                      <th scope="col">Correct answer</th>
                      <th scope="col">Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.row} className="border-b border-border align-top last:border-0 [&_td]:py-2 [&_td]:pe-3">
                        <td>{r.row}</td>
                        <td className="whitespace-pre-wrap">{r.questionText}</td>
                        <td>{r.correctOptionIndex !== null && r.options?.[r.correctOptionIndex] !== undefined ? r.options[r.correctOptionIndex] : "—"}</td>
                        <td>
                          {r.errors.length === 0 ? <Badge tone="good">Ready</Badge> : <Badge tone="bad">Error</Badge>}
                          <ul className="mt-1 space-y-0.5 text-xs">
                            {r.errors.map((x) => (
                              <li key={x} className="text-red-700 dark:text-red-300">
                                {x}
                              </li>
                            ))}
                            {r.warnings.map((x) => (
                              <li key={x} className="text-amber-800 dark:text-amber-300">
                                {x}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </section>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={() => run(true)} busy={busy === "preview"} disabled={!content.trim()} aria-describedby={helpId}>
            Preview
          </Button>
          <Button type="button" onClick={() => run(false)} busy={busy === "import"} disabled={!canImport}>
            {preview && canImport ? `Import ${preview.valid} question${preview.valid === 1 ? "" : "s"}` : "Import"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
