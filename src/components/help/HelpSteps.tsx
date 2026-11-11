"use client";

// S4b help center: "Your steps", the reader's work in the order it's done (content/help/audiences.yml)
import React from "react";
import Link from "next/link";
import type { HelpArticle } from "@/lib/help";

/** Numbered steps: the reader's work in the order it's done */
export function HelpStepsList({ steps, href, onOpen }: { steps: HelpArticle[]; href: (a: HelpArticle) => string; onOpen?: (a: HelpArticle, e: React.MouseEvent) => void }) {
  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {steps.map((a, i) => (
        <li key={a.slug}>
          <Link
            href={href(a)}
            onClick={onOpen ? (e) => onOpen(a, e) : undefined}
            className="flex h-full gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-[var(--brand)]/50 hover:bg-muted/40"
          >
            <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-sm font-semibold text-[var(--brand-foreground)]">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block font-medium">{a.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{a.summary}</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

