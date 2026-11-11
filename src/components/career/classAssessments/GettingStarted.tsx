"use client";

/**
 * Build & Defend Stage 3: the school admin's steps to a first result, each ticked from what the school has really done (faculty
 * added, a class with students, an assessment, given to a class, a first decision). Shown until they're all done; for a pilot
 * school it then shows the pilot's weeks and its results. API: /api/career/admin/getting-started.
 */
import React from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useEn } from "@/lib/english/EnglishProvider";
import { Card, formatDate, useLoad } from "@/components/career/ui";
import { HelpLink } from "@/components/help/HelpLink";

interface GettingStartedData {
  pilot: { startsAt: string; endsAt: string } | null;
  steps: { key: "faculty" | "class" | "assessment" | "assigned" | "result"; done: boolean; count: number }[];
  done: boolean;
}

export function GettingStarted({ schoolId }: { schoolId: string | null }) {
  const en = useEn();
  const api = useApi();
  const data = useLoad(() => api<GettingStartedData>("/api/career/admin/getting-started"), [api, schoolId]);
  const d = data.data;
  if (!d) return null;
  const pilotLine = d.pilot
    ? en("Your Build & Defend pilot runs from {from} to {to}.", { from: formatDate(d.pilot.startsAt), to: formatDate(d.pilot.endsAt) })
    : null;

  if (d.done)
    return d.pilot ? (
      <Card title={en("Your pilot")}>
        <p className="text-sm">
          {pilotLine}{" "}
          <Link href="/faculty/results" className="font-medium underline underline-offset-2">{en("See the pilot results")}</Link>
        </p>
      </Card>
    ) : null;

  const text: Record<GettingStartedData["steps"][number]["key"], { title: string; how: string; href: string; action: string }> = {
    faculty: { title: en("Add your faculty"), how: en("Each teacher gets an e-mail with where to sign in."), href: "/career-center/people", action: en("Add people") },
    class: { title: en("Add a class and its students"), how: en("Teachers create their classes and import the roster from a spreadsheet (CSV file)."), href: "/faculty/classes", action: en("Open classes") },
    assessment: { title: en("Create an assessment from a template"), how: en("An essay, report, lab report, presentation, project, coding task or written exam, each with a rubric and a viva you can change."), href: "/faculty/assessments", action: en("Create an assessment") },
    assigned: { title: en("Give it to a class"), how: en("Students get an e-mail and see it under My assessments."), href: "/faculty/assessments", action: en("Open assessments") },
    result: { title: en("Decide the first results"), how: en("Teachers review each student's work, change task and viva, and decide."), href: "/faculty/review", action: en("Open reviews") },
  };
  const doneCount = d.steps.filter((s) => s.done).length;
  const next = d.steps.find((s) => !s.done)?.key;

  return (
    <Card title={en("Get started with Build & Defend")}>
      <div className="space-y-4 text-sm">
        <div>
          {pilotLine && <p className="mb-1">{pilotLine}</p>}
          <p className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
            {en("{done} of {total} steps done", { done: doneCount, total: d.steps.length })}
            <HelpLink slug="getting-started" label={en("How it works")} />
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.round((100 * doneCount) / d.steps.length)}%` }} />
          </div>
        </div>
        <ol className="space-y-2">
          {d.steps.map((s, i) => {
            const t = text[s.key];
            return (
              <li key={s.key} className={"flex gap-3 rounded-lg border p-3 " + (s.key === next ? "border-[var(--brand)]/50 bg-[var(--brand)]/5" : "border-border")}>
                <span
                  aria-hidden
                  className={
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                    (s.done ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950" : "border border-border text-muted-foreground")
                  }
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {t.title}
                    <span className="sr-only">{s.done ? en(" (done)") : en(" (to do)")}</span>
                  </p>
                  <p className="text-muted-foreground">{t.how}</p>
                </div>
                {!s.done && (
                  <Link href={t.href} className="shrink-0 self-center font-medium text-[var(--brand-text-light,var(--brand))] dark:text-[var(--brand-text-dark,var(--brand))] underline-offset-2 hover:underline">
                    {t.action}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}
