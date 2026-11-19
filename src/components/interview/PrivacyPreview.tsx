"use client";

/**
 * "What the AI interviewer will see" (19 Nov 2026): the person's résumé and job ad after Edulexa takes out their name,
 * contact details and other personal details, and puts stand-ins like [Employer 1] in place of the names of employers,
 * schools and places. The person can leave out any other line before starting.
 */

import React, { useEffect, useState } from "react";
import { EyeOff, ShieldCheck, Undo2 } from "lucide-react";
import { useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";

interface Preview {
  resume: string;
  posting: string;
  removed: string[];
  placeholders: Record<string, string>;
  resumeReadable: boolean;
  resumeNote?: string | null;
}

export default function PrivacyPreview({
  resumeVersionId,
  jobDescription,
  removedLines,
  onRemovedLinesChange,
}: {
  resumeVersionId: string | null;
  jobDescription: string;
  removedLines: string[];
  onRemovedLinesChange: (lines: string[]) => void;
}) {
  const en = useEn();
  const { apiFetch, ready } = useLegacyApi();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);

  // The full prepared text (nothing left out), so each line can be put back
  useEffect(() => {
    if (!open || !ready) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch("/api/interview/practice/preview", { method: "POST", body: JSON.stringify({ resumeVersionId, jobDescription }) }, { quiet: true });
        if (!res.ok) throw new Error();
        const body = (await res.json()) as Preview;
        if (!cancelled) {
          setPreview(body);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, ready, apiFetch, resumeVersionId, jobDescription]);

  const toggle = (line: string) =>
    onRemovedLinesChange(removedLines.includes(line) ? removedLines.filter((l) => l !== line) : [...removedLines, line]);

  const lines = (preview?.resume ?? "").split("\n");
  const placeholders = Object.entries(preview?.placeholders ?? {});

  return (
    <details className="group rounded-xl border border-border bg-card shadow-sm" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-medium text-foreground">
        <ShieldCheck aria-hidden="true" className="h-4 w-4 text-[var(--brand)]" />
        {en("What the AI interviewer will see")}
        <span className="ms-auto text-xs font-normal text-muted-foreground group-open:hidden">{en("Show")}</span>
      </summary>
      <div className="space-y-4 border-t border-border p-4 text-sm">
        {failed && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{en("We couldn't show the preview just now. Please try again.")}</p>}
        {!preview && !failed && <div className="h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-busy="true" />}
        {preview && (
          <>
            {preview.removed.length > 0 && (
              <p className="text-muted-foreground">
                {en("Taken out before anything is sent:")} <span className="text-foreground">{preview.removed.map((r) => en(r)).join(", ")}</span>
              </p>
            )}
            {placeholders.length > 0 && (
              <div className="space-y-1">
                <p className="text-muted-foreground">{en("Names are replaced. Only you see what each stands for:")}</p>
                <ul className="flex flex-wrap gap-2">
                  {placeholders.map(([ph, real]) => (
                    <li key={ph} className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs">
                      <span className="font-mono text-foreground">{ph}</span> <span className="text-muted-foreground">= {real}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {resumeVersionId && preview.resumeNote && <p role="status" className="text-amber-800 dark:text-amber-300">{preview.resumeNote}</p>}
            {preview.resume && (
              <div className="space-y-1">
                <p className="font-medium text-foreground">{en("Your résumé")}</p>
                <ul className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2">
                  {lines.map((line, i) =>
                    line.trim() ? (
                      <li key={i} className="group/line flex items-start gap-2 rounded px-1.5 py-0.5 hover:bg-muted">
                        <span className={`flex-1 whitespace-pre-wrap ${removedLines.includes(line.trim()) ? "text-muted-foreground line-through" : "text-foreground"}`}>{line}</span>
                        <button
                          type="button"
                          onClick={() => toggle(line.trim())}
                          className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
                          aria-label={removedLines.includes(line.trim()) ? en("Put this line back") : en("Leave this line out")}
                        >
                          {removedLines.includes(line.trim()) ? <Undo2 aria-hidden="true" className="h-3.5 w-3.5" /> : <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />}
                          <span className="hidden sm:inline">{removedLines.includes(line.trim()) ? en("Put back") : en("Leave out")}</span>
                        </button>
                      </li>
                    ) : (
                      <li key={i} aria-hidden="true" className="h-2" />
                    ),
                  )}
                </ul>
              </div>
            )}
            {preview.posting && (
              <div className="space-y-1">
                <p className="font-medium text-foreground">{en("The job ad")}</p>
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-2 text-foreground">{preview.posting}</p>
              </div>
            )}
            {!preview.resume && !preview.posting && <p className="text-muted-foreground">{en("Nothing about you is sent: choose a résumé or add a job ad to see them here.")}</p>}
          </>
        )}
      </div>
    </details>
  );
}
