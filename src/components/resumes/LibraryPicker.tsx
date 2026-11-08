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

/** The current version of each résumé in the library that can be sent (null while loading) */
export function useLibraryResumes() {
  const { getToken, isSignedIn } = useAppAuth();
  const [items, setItems] = useState<LibraryResume[] | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await authenticatedFetch("/api/resumes/attachable", {}, getToken);
      const body = res.ok ? ((await res.json()) as { resumes: LibraryResume[] }) : { resumes: [] };
      setItems(body.resumes);
    } catch {
      setItems([]);
    }
  }, [getToken]);
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    authenticatedFetch("/api/resumes/attachable", {}, getToken)
      .then(async (res) => (res.ok ? ((await res.json()) as { resumes: LibraryResume[] }).resumes : []))
      .catch(() => [] as LibraryResume[])
      .then((list) => {
        if (!cancelled) setItems(list);
      });
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);
  return { items, reload: load };
}

/** One résumé from the library, as radio choices; `null` means none chosen */
export default function LibraryPicker({ value, onChange, name = "library-resume" }: { value: string | null; onChange: (versionId: string | null) => void; name?: string }) {
  const en = useEn();
  const { items } = useLibraryResumes();
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
