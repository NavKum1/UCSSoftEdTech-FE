"use client";

/**
 * Build & Defend 1.0, 2.8: everything waiting for this teacher across their classes. Attempts handed in and ready for a
 * decision (oldest first), and appeals to resolve (only those of decisions someone else made; a school admin sees all).
 * API: /api/career/class-assessments/faculty/review.
 */
import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, EmptyState, ErrorBanner, Loading, PageHeader, ScrollArea, Tabs, useLoad } from "@/components/career/ui";
import { HelpLink } from "@/components/help/HelpLink";
import { CA_API, formatWhen, type ReviewQueue, type ReviewRow } from "@/components/career/classAssessments/types";

type Tab = "decide" | "appeals";

export default function ReviewQueuePage() {
  const en = useEn();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const q = useLoad(() => api<ReviewQueue>(`${CA_API}/faculty/review`), [api, schoolId]);
  const [tab, setTab] = useState<Tab | null>(null);

  if (q.loading) return <Loading />;
  if (!q.data) return <ErrorBanner error={q.error ?? en("The review queue couldn't be loaded.")} onRetry={q.reload} />;
  const d = q.data;
  // Open on appeals when only appeals are waiting
  const active: Tab = tab ?? (d.toDecide.length === 0 && d.appeals.length > 0 ? "appeals" : "decide");
  const rows = active === "decide" ? d.toDecide : d.appeals;

  return (
    <div>
      <PageHeader title={en("Review")} description={en("Attempts waiting for your decision, and appeals to resolve, across your classes.")} actions={<HelpLink slug="decide-and-appeals" />} />
      <div className="mb-4">
        <Tabs<Tab>
          label={en("Show")}
          value={active}
          onChange={setTab}
          items={[
            { id: "decide", label: en("To decide"), count: d.toDecide.length },
            { id: "appeals", label: en("Appeals"), count: d.appeals.length },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title={active === "decide" ? en("Nothing waiting for a decision") : en("No appeals to resolve")}>
          {active === "decide"
            ? en("Attempts show up here once the student has handed in the work and finished the viva.")
            : en("When a student appeals a decision someone else in the class made, it shows up here.")}
        </EmptyState>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <ScrollArea label={active === "decide" ? en("To decide") : en("Appeals")}>
            <table className="w-full text-start text-sm [&_td]:py-3 [&_th]:text-start">
              <caption className="sr-only">{active === "decide" ? en("Attempts waiting for a decision") : en("Appeals waiting to be resolved")}</caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-2.5 ps-4 pe-3 font-medium">{en("Student")}</th>
                  <th scope="col" className="pe-3 font-medium">{en("Assessment")}</th>
                  <th scope="col" className="hidden pe-3 font-medium sm:table-cell">{active === "decide" ? en("Handed in") : en("Appealed")}</th>
                  <th scope="col" className="pe-4 font-medium"><span className="sr-only">{en("Open")}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Row key={r.attemptId} r={r} appeal={active === "appeals"} />
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function Row({ r, appeal }: { r: ReviewRow; appeal: boolean }) {
  const en = useEn();
  const when = appeal ? r.appealedAt : r.submittedAt;
  const name = r.student || en("A student");
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="min-w-0 ps-4 pe-3 align-top">
        <span className="block font-medium">{name}</span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          {r.number > 1 && <Badge>{en("Attempt {n}", { n: r.number })}</Badge>}
          {r.late && <Badge tone="warn">{en("Late")}</Badge>}
          {!appeal && !r.suggested && <Badge>{en("No suggested scores")}</Badge>}
        </span>
        {when && <span className="mt-1 block text-xs text-muted-foreground sm:hidden">{formatWhen(when)}</span>}
      </td>
      <td className="min-w-0 pe-3 align-top">
        <span className="block">{r.assessment}</span>
        <span className="block text-xs text-muted-foreground">{r.class}</span>
        {appeal && r.decidedBy && <span className="block text-xs text-muted-foreground">{en("Decided by {name}", { name: r.decidedBy })}</span>}
      </td>
      <td className="hidden whitespace-nowrap pe-3 align-top text-muted-foreground sm:table-cell">{when ? formatWhen(when) : "—"}</td>
      <td className="whitespace-nowrap pe-4 text-end align-top">
        <Link href={`/faculty/attempts/${r.attemptId}`} className="font-medium underline underline-offset-2 hover:decoration-2">
          {appeal ? en("Resolve") : en("Review")}
          <span className="sr-only"> {name}</span>
        </Link>
      </td>
    </tr>
  );
}
