"use client";

/**
 * Recruiters share their coding challenges (owner, 18 Nov 2026): the link a candidate opens (the challenge with its invite
 * code) after creating one, and the company's challenges listed again, each with Copy link. GET api/recruiter/sprints.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, EmptyState, ScrollArea } from "@/components/career/ui";
import { useEn } from "@/lib/english/EnglishProvider";
import { languageText } from "@/lib/taskWords";
import { useLatestRef } from "@/lib/legacyApi";

export interface CompanyChallenge {
  sprintId: string;
  title: string;
  language: string | null;
  inviteCode: string | null;
  /** The address a candidate opens, from the site's root (the challenge with its code) */
  link: string;
  submissions: number;
}

type ApiFetch = (path: string, init?: RequestInit, opts?: { quiet?: boolean }) => Promise<Response>;

const fullLink = (link: string) => (typeof window === "undefined" ? link : `${window.location.origin}${link}`);

/** A Copy link button that says Copied for a moment */
export function CopyLinkButton({ link, label }: { link: string; label?: string }) {
  const en = useEn();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(fullLink(link));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* the link stays visible to copy by hand */
        }
      }}
    >
      {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
      {copied ? en("Copied") : label ?? en("Copy link")}
    </Button>
  );
}

/** Shown in the New coding challenge window once it is created: the link to send, and the code on its own */
export function CreatedChallenge({ title, link, code, onDone }: { title: string; link: string; code: string; onDone: () => void }) {
  const en = useEn();
  return (
    <div className="space-y-4" role="status">
      <p className="text-sm text-foreground">
        {en("{title} is ready. Send candidates this link: it opens the challenge with its invite code.", { title })}
      </p>
      <input readOnly value={fullLink(link)} aria-label={en("Challenge link")} onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground" />
      <p className="text-sm text-muted-foreground">
        {en("Invite code: ")}<span className="font-mono font-medium text-foreground">{code}</span>
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <CopyLinkButton link={link} />
        <Button type="button" onClick={onDone}>{en("Done")}</Button>
      </div>
    </div>
  );
}

/** The company's coding challenges, to share again */
export function CompanyChallenges({ apiFetch, version }: { apiFetch: ApiFetch; /** Changes when a challenge is created */ version: number }) {
  const en = useEn();
  const [items, setItems] = useState<CompanyChallenge[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/recruiter/sprints", {}, { quiet: true });
      if (!res.ok) return setFailed(true);
      setFailed(false);
      setItems((await res.json()) as CompanyChallenge[]);
    } catch {
      setFailed(true);
    }
  }, [apiFetch]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    void loadRef.current();
  }, [loadRef, version]);

  return (
    <section aria-labelledby="your-challenges" className="space-y-3">
      <h3 id="your-challenges" className="text-sm font-semibold">{en("Your coding challenges")}</h3>
      {failed ? (
        <p className="text-sm text-muted-foreground">{en("Your challenges couldn't be loaded. Please refresh the page.")}</p>
      ) : !items ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-busy="true" />
      ) : items.length === 0 ? (
        <EmptyState title={en("No coding challenges yet")}>{en("Create one with New coding challenge, then send candidates its link.")}</EmptyState>
      ) : (
        <ScrollArea>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {items.map((c) => (
              <li key={c.sprintId} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[languageText(c.language), en(c.submissions === 1 ? "1 submission" : "{count} submissions", { count: c.submissions }), c.inviteCode ? en("code {code}", { code: c.inviteCode }) : null]
                      .filter(Boolean).join(" · ")}
                  </p>
                </div>
                <CopyLinkButton link={c.link} />
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </section>
  );
}
