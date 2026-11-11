"use client";

/**
 * Build & Defend 1.0 Stage 2 (2.4): "My assessments". The assessments teachers have given the student's classes, to do first,
 * then done. A class finds the student by the e-mail on its roster. API: /api/career/class-assessments/student/assessments.
 */
import React from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { useEn } from "@/lib/english/EnglishProvider";
import { Card, EmptyState, ErrorBanner, Loading, PageHeader, useLoad } from "@/components/career/ui";
import { HelpLink } from "@/components/help/HelpLink";
import { CA_API, formatWhen, type StudentAssessmentSummary } from "@/components/career/classAssessments/types";
import { useTemplateNames } from "@/components/career/classAssessments/names";
import { StudentStateBadge, isToDo } from "@/components/career/classAssessments/studentState";

export default function StudentAssessmentsPage() {
  const en = useEn();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const list = useLoad(() => api<{ assessments: StudentAssessmentSummary[] }>(`${CA_API}/student/assessments`), [api, schoolId]);

  const rows = list.data?.assessments ?? [];
  const toDo = rows.filter((x) => isToDo(x.state));
  const done = rows.filter((x) => !isToDo(x.state)).reverse();

  return (
    <div>
      <PageHeader title={en("My assessments")} description={en("What your teachers have set for your classes. You submit your work, then explain it in a short viva.")} actions={<HelpLink slug="hand-in-your-work" />} />
      <ErrorBanner error={list.error} onRetry={list.reload} />
      {list.loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState title={en("No assessments yet")}>
          {en("When a teacher gives your class an assessment, it appears here and you get an e-mail. Your class finds you by the e-mail address on its roster.")}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <Card title={en("To do ({count})", { count: toDo.length })}>
            {toDo.length === 0 ? <p className="text-sm text-muted-foreground">{en("You're all caught up.")}</p> : <AssessmentList items={toDo} />}
          </Card>
          {done.length > 0 && (
            <Card title={en("Done ({count})", { count: done.length })}>
              <AssessmentList items={done} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function AssessmentList({ items }: { items: StudentAssessmentSummary[] }) {
  const en = useEn();
  const names = useTemplateNames();
  return (
    <ul className="divide-y divide-border">
      {items.map((x) => (
        <li key={x.assignmentId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Link href={`/student/assessments/${x.assignmentId}`} className="font-medium underline-offset-2 hover:underline">
              {x.title}
            </Link>
            <p className="text-sm text-muted-foreground">
              {x.className} · {names[x.template]}
            </p>
            <p className="text-sm">
              {x.state === "upcoming"
                ? en("Opens {opens}, due {due}", { opens: formatWhen(x.opensAt), due: formatWhen(x.dueAt) })
                : en("Due {when}", { when: formatWhen(x.dueAt) })}
            </p>
          </div>
          <div className="shrink-0">
            <StudentStateBadge item={x} />
          </div>
        </li>
      ))}
    </ul>
  );
}
