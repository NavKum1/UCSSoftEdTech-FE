"use client";

/**
 * "From your library" (docs/resume_tools_plan_nov2026.md, stage 1): the résumés a person keeps at /resumes, offered where
 * a résumé is sent (campus job applications, document review, on-campus interview sign-up). The API takes the chosen
 * version and the feature keeps its own copy, so later changes in the library never change what was sent.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAppAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { useEn } from "@/lib/english/EnglishProvider";
import { formatDate } from "@/components/career/ui";

export interface LibraryResume {
  versionId: string;
  documentId: string;
  title: string;
  number: number;
  fileName: string | null;
  createdAt: string;
}

// One request for every picker on a page (a job board can show many), kept for 30 seconds; reload() fetches again
let shared: { key: string; at: number; promise: Promise<LibraryResume[] | null> } | null = null;

async function fetchLibrary(getToken: () => Promise<string | null>): Promise<LibraryResume[] | null> {
  try {
    const [rules, list] = await Promise.all([
      authenticatedFetch("/api/resumes/rules", {}, getToken).then((r) => (r.ok ? (r.json() as Promise<{ toolsEnabled: boolean }>) : null)),
      authenticatedFetch("/api/resumes/attachable", {}, getToken).then((r) => (r.ok ? (r.json() as Promise<{ resumes: LibraryResume[] }>) : null)),
    ]);
    // The school uses another résumé tool: its forms don't offer the library
    if (rules && !rules.toolsEnabled) return null;
    return list?.resumes ?? [];
  } catch {
    return [];
  }
}

/**
 * The current version of each résumé in the library that can be sent: null while loading, [] when there are none or the
 * visitor is signed out; `disabled` when the person's school uses another résumé tool (then the forms don't offer it).
 */
export function useLibraryResumes() {
  const { getToken, isSignedIn, isLoaded, userId } = useAppAuth() as ReturnType<typeof useAppAuth> & { userId?: string | null };
  const [state, setState] = useState<{ items: LibraryResume[] | null; disabled: boolean }>({ items: null, disabled: false });
  const load = useCallback(
    async (fresh: boolean) => {
      const key = String(userId ?? "me");
      if (fresh || !shared || shared.key !== key || Date.now() - shared.at > 30_000) shared = { key, at: Date.now(), promise: fetchLibrary(getToken) };
      const list = await shared.promise;
      setState({ items: list ?? [], disabled: list === null });
    },
    [getToken, userId],
  );
  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    if (!isSignedIn) {
      Promise.resolve().then(() => !cancelled && setState({ items: [], disabled: false }));
      return () => {
        cancelled = true;
      };
    }
    const key = String(userId ?? "me");
    if (!shared || shared.key !== key || Date.now() - shared.at > 30_000) shared = { key, at: Date.now(), promise: fetchLibrary(getToken) };
    shared.promise.then((list) => {
      if (!cancelled) setState({ items: list ?? [], disabled: list === null });
    });
    // A résumé added on this page (lib/resumeLibrary saveToLibrary): load again
    const onChange = () => {
      shared = { key, at: Date.now(), promise: fetchLibrary(getToken) };
      shared.promise.then((list) => {
        if (!cancelled) setState({ items: list ?? [], disabled: list === null });
      });
    };
    window.addEventListener("resume-library-changed", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("resume-library-changed", onChange);
    };
  }, [getToken, isLoaded, isSignedIn, userId]);
  return { items: state.items, disabled: state.disabled, reload: () => load(true) };
}

/** One résumé from the library, as radio choices; `null` means none chosen */
export default function LibraryPicker({ value, onChange, name = "library-resume" }: { value: string | null; onChange: (versionId: string | null) => void; name?: string }) {
  const en = useEn();
  const { items, disabled } = useLibraryResumes();
  if (disabled) return null;
  if (items === null) return <div className="h-16 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-busy="true" />;
  if (items.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {en("No résumés in your library yet.")}{" "}
        <Link href="/resumes" className="font-medium text-foreground underline">
          {en("Add one in Résumés")}
        </Link>
      </p>
    );
  return (
    <div className="space-y-1.5" role="radiogroup" aria-label={en("Résumés in your library")}>
      {items.map((r) => (
        <label key={r.versionId} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm hover:bg-muted/50 has-[:checked]:border-[var(--brand)] has-[:checked]:bg-muted/40">
          <input type="radio" name={name} className="mt-0.5" checked={value === r.versionId} onChange={() => onChange(r.versionId)} />
          <span>
            <span className="block font-medium">{r.title}</span>
            <span className="block text-xs text-muted-foreground">
              {en("Version {number}, {fileName}, added {date}", { number: r.number, fileName: r.fileName ?? "", date: formatDate(r.createdAt) })}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
