"use client";

/**
 * The job to practice for (19 Nov 2026, docs/interview_coaching_job_library_plan.md): search the job library (about 1,000
 * jobs with their real tasks), or use your own job title when it isn't there. Nothing is made up: no match offers the
 * person's own words as the title.
 */

import React, { useEffect, useId, useState } from "react";
import { Search, X } from "lucide-react";
import { useLegacyApi } from "@/lib/legacyApi";
import { useEn, useEnglish } from "@/lib/english/EnglishProvider";

export interface PickedJob {
  /** The job library's code; null for the person's own title */
  code: string | null;
  title: string;
  /** The career file it belongs to (healthcare, teaching…); null for an own title */
  family: string | null;
}

interface JobMatch {
  code: string;
  title: string;
  family: string;
}

export default function JobPicker({ value, onChange }: { value: PickedJob | null; onChange: (job: PickedJob | null) => void }) {
  const en = useEn();
  const { language: locale } = useEnglish();
  const { apiFetch, ready } = useLegacyApi();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JobMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const inputId = useId();
  const listId = useId();

  useEffect(() => {
    if (!ready || value) return;
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(`/api/jobs/search?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(locale)}`, {}, { quiet: true });
        const body = res.ok ? ((await res.json()) as { jobs: JobMatch[] }) : { jobs: [] };
        if (!cancelled) setResults(body.jobs.slice(0, 8));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, ready, value, apiFetch, locale]);

  if (value) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border border-[var(--brand)] bg-card p-3 shadow-sm">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{value.title}</p>
          <p className="text-xs text-muted-foreground">
            {value.code ? en("From the job library: questions use this job's real tasks") : en("Your own job title: the questions are general for this kind of job")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          {en("Change")}
        </button>
      </div>
    );
  }

  const q = query.trim();
  // Results of an earlier search aren't shown once the search is too short
  const shown = q.length >= 2 ? results : null;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {en("Search for your job")}
      </label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={en("e.g. Registered nurse, teacher, electrician")}
          autoComplete="off"
          aria-controls={listId}
          className="w-full rounded-lg border border-border bg-card py-2 pe-3 ps-9 text-sm text-foreground shadow-sm"
        />
      </div>
      <div id={listId} aria-live="polite" className="space-y-1">
        {searching && <p className="text-xs text-muted-foreground">{en("Searching…")}</p>}
        {!searching && shown && shown.length === 0 && (
          <p className="text-xs text-muted-foreground">{en("That job isn't in the job library. You can still practice with your own job title.")}</p>
        )}
        {shown && shown.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {shown.map((j) => (
              <li key={j.code}>
                <button
                  type="button"
                  onClick={() => onChange({ code: j.code, title: j.title, family: j.family })}
                  className="w-full px-3 py-2 text-start text-sm text-foreground hover:bg-muted/60 focus-visible:bg-muted/60"
                >
                  {j.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        {q.length >= 2 && !searching && (
          <button
            type="button"
            onClick={() => onChange({ code: null, title: q.slice(0, 100), family: null })}
            className="text-xs font-medium text-[var(--brand)] underline-offset-2 hover:underline"
          >
            {en("Use “{title}” as your job title", { title: q.slice(0, 100) })}
          </button>
        )}
      </div>
    </div>
  );
}
