"use client";

/**
 * Pieces of a person's results shared by the form's thank-you page and their report page: the score dial, next steps,
 * share buttons (the score and a link to the form, never the report) and the work-style grid. Colours come from the
 * form's accent (--gf-accent, and --gf-on for text on it).
 */

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowRight, Check, Link2, Share2 } from "lucide-react";
import type { NextSteps } from "./model";

/** A half-circle dial that fills to the percentage once, with the band's words under it */
export function ScoreDial({ percent, label, title }: { percent: number; label?: string | null; title?: string | null }) {
  const length = Math.PI * 80;
  // Starts empty and fills once on show (no movement when reduced motion is asked for: the CSS transition is off then)
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(percent));
    return () => cancelAnimationFrame(id);
  }, [percent]);
  return (
    <div className="flex flex-col items-center text-center">
      {title && <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>}
      <svg viewBox="0 0 200 116" className="mt-2 w-56 max-w-full sm:w-64" role="img" aria-label={`${percent}%${label ? `, ${label}` : ""}`}>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" strokeWidth="16" strokeLinecap="round" className="stroke-muted" />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          stroke="var(--gf-accent)"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - shown / 100)}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-out"
        />
        <text x="100" y="94" textAnchor="middle" className="fill-foreground text-[44px] font-bold tracking-tight">
          {percent}%
        </text>
      </svg>
      {label && <p className="mt-1 text-xl font-semibold tracking-tight text-[var(--gf-accent)] sm:text-2xl">{label}</p>}
    </div>
  );
}

/** The heading, a line and the button the school sets for this score */
export function NextStepsBlock({ next }: { next: NextSteps }) {
  return (
    <div className="text-center">
      {next.title && <p className="text-balance text-lg font-semibold leading-snug tracking-tight sm:text-xl">{next.title}</p>}
      {next.text && <p className="mx-auto mt-1.5 max-w-prose text-pretty leading-relaxed text-muted-foreground">{next.text}</p>}
      {next.url && next.label && (
        <a
          href={next.url}
          target="_blank"
          rel="noopener"
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--gf-accent)] px-6 py-2.5 font-semibold text-[var(--gf-on)] shadow-sm transition-[filter] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gf-accent)] focus-visible:ring-offset-2"
        >
          {next.label} <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

const noSubscribe = () => () => undefined;

/** Share the score: the phone's own share sheet where there is one, else Facebook, X, LinkedIn and copying the link */
export function ShareRow({ url, text, t }: { url: string; text: string; t: (k: string) => string }) {
  const [copied, setCopied] = useState(false);
  // The phone's share sheet, where the browser has one (never on the server)
  const native = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);
  const u = encodeURIComponent(url);
  const links = [
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: "X", href: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${u}` },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  ];
  const chip =
    "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-[var(--gf-accent)] hover:text-[var(--gf-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gf-accent)]";
  return (
    <div className="flex flex-wrap items-center justify-center gap-2" aria-label={t("share")} role="group">
      {native && (
        <button type="button" className={chip} onClick={() => navigator.share({ text, url }).catch(() => undefined)}>
          <Share2 aria-hidden="true" className="h-4 w-4" /> {t("share")}
        </button>
      )}
      {links.map((l) => (
        <a key={l.name} href={l.href} target="_blank" rel="noopener noreferrer" className={chip}>
          {l.name}
        </a>
      ))}
      <button
        type="button"
        className={chip}
        onClick={() =>
          navigator.clipboard
            ?.writeText(url)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => undefined)
        }
      >
        {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Link2 aria-hidden="true" className="h-4 w-4" />}
        <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
      </button>
    </div>
  );
}

export interface GridView {
  top: string;
  bottom: string;
  left: string;
  right: string;
  cells: { id: string; name: string }[];
  active?: string | null;
}

/** Each square's outer corner is rounded, so the four read as one shape */
const CORNERS = ["rounded-tl-2xl", "rounded-tr-2xl", "rounded-bl-2xl", "rounded-br-2xl"];

/** The four outcomes in a two-by-two grid with the words at each end of its axes; theirs filled with the form's colour */
export function StyleGrid({ grid, t }: { grid: GridView; t: (k: string) => string }) {
  const activeName = grid.cells.find((c) => c.id === grid.active)?.name;
  return (
    <figure className="mx-auto w-full max-w-md" aria-label={activeName ? `${t("yourStyle")} ${activeName}` : undefined}>
      <p className="text-center text-xs font-medium text-muted-foreground">{grid.top}</p>
      <div className="mt-1.5 grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <span className="w-12 text-right text-xs font-medium text-muted-foreground sm:w-16">{grid.left}</span>
        <ul className="grid aspect-square grid-cols-2 gap-1.5">
          {grid.cells.map((c, i) => {
            const on = c.id === grid.active;
            return (
              <li
                key={c.id}
                className={`relative grid place-items-center rounded-md ${CORNERS[i]} p-2 text-center text-sm font-semibold sm:text-base ${
                  on ? "bg-[var(--gf-accent)] text-[var(--gf-on)] shadow-md" : "bg-[color-mix(in_srgb,var(--gf-accent)_9%,transparent)] text-foreground/70"
                }`}
                aria-current={on ? "true" : undefined}
              >
                {on && <Check aria-hidden="true" className="absolute right-2 top-2 h-4 w-4" strokeWidth={3} />}
                {c.name}
              </li>
            );
          })}
        </ul>
        <span className="w-12 text-xs font-medium text-muted-foreground sm:w-16">{grid.right}</span>
      </div>
      <p className="mt-1.5 text-center text-xs font-medium text-muted-foreground">{grid.bottom}</p>
    </figure>
  );
}
