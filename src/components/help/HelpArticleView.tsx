"use client";

/**
 * S4 help center: one article's text (built from content/help by scripts/help-build.ts). Labels the reader should look for
 * in the app ([ui: Save decision]) show as small chips; links to other articles and pages keep the reader's way back.
 */
import React from "react";
import Link from "next/link";
import type { HelpBlock, HelpInline } from "@/lib/help/types";

function Inlines({ items, from }: { items: HelpInline[]; from: string | null }) {
  return (
    <>
      {items.map((i, n) => {
        switch (i.t) {
          case "b":
            return <strong key={n} className="font-semibold">{i.v}</strong>;
          case "ui":
            return (
              <span key={n} className="whitespace-nowrap rounded border border-border bg-muted px-1.5 py-px text-[0.92em] font-medium text-foreground">
                {i.v}
              </span>
            );
          case "code":
            return <code key={n} className="rounded bg-muted px-1 py-px font-mono text-[0.9em]" dir="ltr">{i.v}</code>;
          case "link": {
            const external = /^(https?:|mailto:)/.test(i.href);
            if (external)
              return <a key={n} href={i.href} className="font-medium underline underline-offset-2" target={i.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{i.v}</a>;
            const href = i.href.startsWith("/help/") && from ? `${i.href}?from=${encodeURIComponent(from)}` : i.href;
            return <Link key={n} href={href} className="font-medium underline underline-offset-2">{i.v}</Link>;
          }
          default:
            return <React.Fragment key={n}>{i.v}</React.Fragment>;
        }
      })}
    </>
  );
}

export function HelpArticleView({ blocks, from }: { blocks: HelpBlock[]; from: string | null }) {
  return (
    <div className="space-y-4 text-[15px] leading-7">
      {blocks.map((b, n) => {
        switch (b.t) {
          case "h2":
            return <h2 key={n} className="pt-3 text-lg font-semibold leading-snug"><Inlines items={b.c} from={from} /></h2>;
          case "h3":
            return <h3 key={n} className="pt-1 font-semibold"><Inlines items={b.c} from={from} /></h3>;
          case "note":
            return (
              <p key={n} className="rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/5 px-4 py-3 text-sm leading-6">
                <Inlines items={b.c} from={from} />
              </p>
            );
          case "ul":
          case "ol": {
            const List = b.t === "ul" ? "ul" : "ol";
            return (
              <List key={n} className={`space-y-1.5 ps-6 ${b.t === "ul" ? "list-disc" : "list-decimal"} marker:text-muted-foreground`}>
                {b.items.map((it, k) => <li key={k} className="ps-1"><Inlines items={it} from={from} /></li>)}
              </List>
            );
          }
          default:
            return <p key={n}><Inlines items={b.c} from={from} /></p>;
        }
      })}
    </div>
  );
}
