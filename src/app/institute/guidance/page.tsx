"use client";

/**
 * The institute's career guidance form: the questions a person answers when they ask the institute's advisor for help
 * choosing an area or certification ("Ask an advisor" in Edulexa, and the public form embedded on the institute's own
 * website). "What are you unsure about?" is always asked; the admins add their own questions here, turn the public form
 * on, and copy the embed code. Requests arrive in the lead inbox.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import GuidanceFields, { type GuidanceQuestion } from "@/components/counselling/GuidanceFields";

interface FormResponse {
  instituteId: string;
  questions: GuidanceQuestion[];
  custom: boolean;
  publicEnabled: boolean;
  alwaysAsked: string;
  maxQuestions: number;
}

const card = "rounded-2xl border border-border bg-card p-5";
const input = "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const KINDS: [GuidanceQuestion["kind"], string][] = [
  ["choice", "Pick one option"],
  ["text", "Short answer"],
  ["longtext", "Long answer"],
];

export default function GuidanceFormEditor() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [form, setForm] = useState<FormResponse | null>(null);
  const [questions, setQuestions] = useState<GuidanceQuestion[]>([]);
  const [publicEnabled, setPublicEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/quiz/counselling/guidance-form");
    if (!res.ok) return setNotice({ ok: false, text: "We couldn't load your guidance form." });
    const f = (await res.json()) as FormResponse;
    setForm(f);
    setQuestions(f.questions);
    setPublicEnabled(f.publicEnabled);
  }, [apiFetch]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  const update = (i: number, patch: Partial<GuidanceQuestion>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: number) =>
    setQuestions((qs) => {
      const next = [...qs];
      const [q] = next.splice(i, 1);
      next.splice(i + d, 0, q);
      return next;
    });

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiFetch("/api/quiz/counselling/guidance-form", {
        method: "PUT",
        body: JSON.stringify({ questions, publicEnabled }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error);
      setQuestions(body.questions);
      setNotice({ ok: true, text: "Saved. New requests use these questions." });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error && e.message ? e.message : "We couldn't save the form." });
    } finally {
      setBusy(false);
    }
  };

  if (access) return <AccessNotice problem={access} feature="the guidance form" />;
  if (!form) return <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} aria-busy="true" />;

  // Rendered only after the form loads in the browser, so window is available
  const embedUrl = `${typeof window === "undefined" ? "" : window.location.origin}/embed/guidance/${form.instituteId}`;
  const snippet = `<iframe src="${embedUrl}" title="Career guidance" style="width:100%;max-width:640px;height:900px;border:0" loading="lazy"></iframe>`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Career guidance form</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          For people who can&apos;t decide which area or certification suits them. They answer these questions and ask your advisor for help, from Edulexa or
          from the form on your website. Requests arrive in your{" "}
          <Link href="/institute/dashboard" className="underline">
            lead inbox
          </Link>
          . Keep it short: every question you add makes it a little harder to send.
        </p>
      </header>

      {notice && <p className={`text-sm ${notice.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{notice.text}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
        <section className={`${card} space-y-4`} aria-labelledby="gf-questions">
          <h2 id="gf-questions" className="font-semibold">
            Questions
          </h2>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
            Always asked first: <span className="font-medium">{form.alwaysAsked}</span>
          </p>
          {questions.map((q, i) => (
            <div key={q.id || i} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-start gap-2">
                <label className="flex-1 text-sm">
                  <span className="font-medium">Question {i + 1}</span>
                  <input value={q.label} maxLength={200} onChange={(e) => update(i, { label: e.target.value })} className={input} />
                </label>
                <div className="flex gap-1 pt-6">
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1.5 hover:bg-muted disabled:opacity-30">
                    <ArrowUp aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={i === questions.length - 1}
                    onClick={() => move(i, 1)}
                    className="rounded p-1.5 hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowDown aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Remove question" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} className="rounded p-1.5 hover:bg-muted">
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  Answer
                  <select value={q.kind} onChange={(e) => update(i, { kind: e.target.value as GuidanceQuestion["kind"] })} className="rounded-lg border border-border bg-background px-2 py-1">
                    {KINDS.map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} />
                  Required
                </label>
              </div>
              {q.kind === "choice" && (
                <label className="block text-sm">
                  <span className="font-medium">Options</span> <span className="text-muted-foreground">(one per line, 2 to 12)</span>
                  <textarea
                    rows={Math.max(3, q.options.length)}
                    value={q.options.join("\n")}
                    onChange={(e) => update(i, { options: e.target.value.split("\n") })}
                    className={input}
                  />
                </label>
              )}
            </div>
          ))}
          <button
            type="button"
            disabled={questions.length >= form.maxQuestions}
            onClick={() => setQuestions((qs) => [...qs, { id: "", label: "", kind: "choice", options: ["", ""], required: false }])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <Plus aria-hidden="true" className="h-4 w-4" /> Add a question
          </button>

          <div className="border-t border-border pt-4">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={publicEnabled} onChange={(e) => setPublicEnabled(e.target.checked)} className="mt-0.5" />
              <span>
                <span className="font-medium">Public form for our website</span>
                <span className="block text-muted-foreground">Anyone can send a request from the form embedded on your site, without an Edulexa account.</span>
              </span>
            </label>
          </div>
          <button type="button" onClick={() => void save()} disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
            {busy ? "Saving…" : "Save"}
          </button>
        </section>

        <div className="space-y-6">
          <section className={card} aria-labelledby="gf-preview">
            <h2 id="gf-preview" className="font-semibold">
              Preview
            </h2>
            <div className="mt-3 space-y-4">
              <label className="block text-sm">
                <span className="font-medium">{form.alwaysAsked}</span>
                <textarea rows={2} className={input} disabled />
              </label>
              <GuidanceFields
                questions={questions.filter((q) => q.label.trim()).map((q, i) => ({ ...q, id: q.id || `new-${i}`, options: q.options.filter((o) => o.trim()) }))}
                values={preview}
                onChange={(id, v) => setPreview((p) => ({ ...p, [id]: v }))}
              />
            </div>
          </section>

          <section className={card} aria-labelledby="gf-embed">
            <h2 id="gf-embed" className="font-semibold">
              Put it on your website
            </h2>
            {form.publicEnabled ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">Paste this where the form should appear on your site.</p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs">
                  <code>{snippet}</code>
                </pre>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(snippet).then(() => setCopied(true))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    <Copy aria-hidden="true" className="h-4 w-4" /> {copied ? "Copied" : "Copy code"}
                  </button>
                  <a href={embedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
                    <ExternalLink aria-hidden="true" className="h-4 w-4" /> Open the form
                  </a>
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Turn on &ldquo;Public form for our website&rdquo; and save to get the code.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
