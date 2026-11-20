"use client";

/**
 * Coaching on one answer of a practice interview (19 Nov 2026): what the person said, what worked, what was missing, and a
 * stronger version built only from their own answer and résumé. Gaps in [brackets] are facts only they can fill in; the
 * coaching never invents them. Their tries of the same question show underneath, newest first.
 */

import React from "react";
import { BookmarkPlus, RotateCcw } from "lucide-react";
import { Badge, Button } from "@/components/career/ui";
import { useEn } from "@/lib/english/EnglishProvider";

export interface AnswerCoachingData {
  question: number;
  questionText: string;
  focus: string;
  answer: string;
  said: string;
  worked: string[];
  missing: string[];
  stronger: string | null;
  strongerDropped: boolean;
  level: string;
  tries: AnswerCoachingData[];
}

// Plain levels. en() where shown.
export const LEVELS: Record<string, { label: string; tone: "good" | "warn" | "bad" | "info" }> = {
  strong: { label: "Strong", tone: "good" },
  good: { label: "Good", tone: "good" },
  "getting-there": { label: "Getting there", tone: "warn" },
  "keep-practicing": { label: "Keep practicing", tone: "bad" },
};

/** The stronger version, with the gaps the person fills in shown as blanks */
export function WithGaps({ text }: { text: string }) {
  const en = useEn();
  return (
    <>
      {text.split(/(\[[^\]]+\])/g).map((part, i) =>
        /^\[[^\]]+\]$/.test(part) ? (
          <mark
            key={i}
            title={en("Fill this in with your own fact")}
            className="mx-0.5 rounded border border-dashed border-amber-500/70 bg-amber-50 px-1 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {part.slice(1, -1).replace(/\?$/, "")}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

function Body({ a, compact = false }: { a: AnswerCoachingData; compact?: boolean }) {
  const en = useEn();
  const coached = a.level !== "";
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{en("You said")}</p>
        <blockquote className="border-s-2 border-border ps-3 text-sm leading-relaxed text-foreground">{a.answer || a.said}</blockquote>
      </div>
      {coached && (a.worked.length > 0 || a.missing.length > 0) && (
        <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
          {a.worked.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">{en("What worked")}</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {a.worked.map((w, i) => (
                  <li key={i} className="flex gap-2"><span aria-hidden="true" className="text-emerald-600 dark:text-emerald-400">✓</span><span>{w}</span></li>
                ))}
              </ul>
            </div>
          )}
          {a.missing.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">{en("What was missing")}</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {a.missing.map((m, i) => (
                  <li key={i} className="flex gap-2"><span aria-hidden="true" className="text-amber-600 dark:text-amber-400">+</span><span>{m}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {coached && (
        <div className="space-y-1.5 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/5 p-3">
          <p className="text-sm font-semibold text-foreground">{en("A stronger version, in your words")}</p>
          {a.stronger ? (
            <>
              <p className="text-sm leading-relaxed text-foreground"><WithGaps text={a.stronger} /></p>
              {/\[[^\]]+\]/.test(a.stronger) && <p className="text-xs text-muted-foreground">{en("The highlighted parts are facts only you know. Fill them in with what really happened.")}</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {a.strongerDropped
                ? en("Add your own example here: what happened, what you did, and how it turned out. We don't write facts you didn't give.")
                : en("Give a specific example next time, and we'll show you a stronger version of it.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnswerCoaching({
  a,
  index,
  maxTries,
  triesUsed,
  onSaveStory,
  storySaved,
  onTry,
  trying,
}: {
  a: AnswerCoachingData;
  index: number;
  maxTries: number;
  /** Counted by the server, including tries that dropped or weren't coached */
  triesUsed?: number;
  /** Stage 2: save this answer as one of the person's stories */
  onSaveStory?: () => void;
  storySaved?: boolean;
  onTry?: () => void;
  trying?: boolean;
}) {
  const en = useEn();
  const level = LEVELS[a.level];
  const triesLeft = Math.max(0, maxTries - (triesUsed ?? a.tries.length));
  return (
    <article className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm" aria-labelledby={`answer-${index}`}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{a.question >= 0 ? en("Question {n}", { n: a.question + 1 }) : en("Another question")}</span>
          {a.focus && <span className="rounded-full border border-border px-2 py-0.5">{en("tests: {focus}", { focus: a.focus })}</span>}
          {level && <span className="ms-auto"><Badge tone={level.tone}>{en(level.label)}</Badge></span>}
        </div>
        <h3 id={`answer-${index}`} className="text-base font-semibold leading-snug text-foreground">{a.questionText}</h3>
      </header>
      <Body a={a} />
      {a.question >= 0 && onTry && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button variant="secondary" onClick={onTry} disabled={triesLeft === 0} busy={trying}>
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            {en("Try this question again")}
          </Button>
          {onSaveStory && (
            <Button variant="ghost" onClick={onSaveStory} disabled={storySaved}>
              <BookmarkPlus aria-hidden="true" className="h-4 w-4" />
              {storySaved ? en("Saved to your stories") : en("Save as one of my stories")}
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {triesLeft > 0 ? en("{n} of {max} tries left · uses practice minutes", { n: triesLeft, max: maxTries }) : en("You've used all {max} tries for this question.", { max: maxTries })}
          </span>
        </div>
      )}
      {a.tries.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">{en("Your tries")}</p>
          {a.tries.map((t, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{en("Try {n}", { n: a.tries.length - i })}</span>
                {LEVELS[t.level] && <Badge tone={LEVELS[t.level].tone}>{en(LEVELS[t.level].label)}</Badge>}
              </div>
              <Body a={t} compact />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
