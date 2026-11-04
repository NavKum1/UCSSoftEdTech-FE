/**
 * The Edulexa logo in the app (5 Nov 2026): the only place it is drawn, so the final logo (not decided yet) is a change
 * to this file alone. For now it is edulexa.com's current mark: three bars forming an implicit "E" on a cyan-to-violet
 * tile, with the lowercase wordmark.
 */
import React from "react";

export default function BrandMark({ size = 32, wordmark = true, area }: { size?: number; wordmark?: boolean; area?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center rounded-[8px] text-white"
        style={{ width: size, height: size, background: "linear-gradient(135deg, #0891b2 0%, #0891b2 45%, oklch(0.6 0.2 295) 100%)" }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M5 6h14" />
          <path d="M5 12h9" />
          <path d="M5 18h14" />
          <path d="M17 9.5l3.5 -3.5" strokeWidth="2.2" opacity="0.85" />
        </svg>
      </span>
      {wordmark && (
        <span className="truncate text-[0.9375rem] font-semibold tracking-tight text-foreground">
          edulexa
          {area && <span className="font-normal text-muted-foreground"> · {area}</span>}
        </span>
      )}
    </span>
  );
}
