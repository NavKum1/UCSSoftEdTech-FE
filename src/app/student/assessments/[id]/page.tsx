"use client";

/**
 * Build & Defend 1.0 Stage 2 (2.4): one assessment for a student: what to do (once it opens), how they're assessed (the
 * rubric), the viva format, the dates and their teachers, and the decision once it's made.
 * API: /api/career/class-assessments/student/assessments/{assignmentId}.
 */
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { useEn } from "@/lib/english/EnglishProvider";
import { Card, ErrorBanner, Loading, PageHeader, useLoad } from "@/components/career/ui";
import { CA_API, formatWhen, type StudentAssessmentDetail } from "@/components/career/classAssessments/types";
import { useTemplateNames } from "@/components/career/classAssessments/names";
import { StudentStateBadge } from "@/components/career/classAssessments/studentState";
import { AttemptPanel } from "@/components/career/classAssessments/AttemptPanel";

export default function StudentAssessmentPage() {
  const en = useEn();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const { id } = useParams<{ id: string }>();
  const names = useTemplateNames();
  const item = useLoad(() => api<StudentAssessmentDetail>(`${CA_API}/student/assessments/${id}`), [api, id, schoolId]);

  // A reload (after the attempt moves on) keeps the page, so the attempt panel stays as it is
  if (item.loading && !item.data) return <Loading />;
  if (!item.data) return <ErrorBanner error={item.error ?? en("This assessment couldn't be loaded.")} onRetry={item.reload} />;
  const x = item.data;
  const vivaHow =
    x.viva.mode === "voice" ? en("You answer by voice.") : x.viva.mode === "text" ? en("You answer in writing.") : en("You choose: by voice or in writing.");

  return (
    <div>
      <PageHeader title={x.title} description={`${x.className} · ${names[x.template]}`} actions={<StudentStateBadge item={x} />} />
      <p className="mb-4 text-sm">
        <Link href="/student/assessments" className="underline-offset-2 hover:underline">
          {en("All my assessments")}
        </Link>
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* The result (2.8) is in the attempt panel: decision, scores, comment, appeal and starting again */}
          {x.state === "decided" && <AttemptPanel assignmentId={x.assignmentId} onChange={item.reload} />}

          <Card title={en("What to do")}>
            {x.instructions == null ? (
              <p className="text-sm text-muted-foreground">{en("The instructions appear here when it opens on {when}.", { when: formatWhen(x.opensAt) })}</p>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="whitespace-pre-line leading-relaxed">{x.instructions}</p>
                {x.task && (
                  <p className="rounded-lg border border-border bg-muted/40 p-3">
                    {x.task.kind === "coding"
                      ? en("Coding task: {title} ({language})", { title: x.task.title, language: x.task.language ?? "" })
                      : en("Written exam: {title} ({minutes} minutes)", { title: x.task.title, minutes: x.task.minutes ?? 0 })}
                  </p>
                )}
              </div>
            )}
          </Card>

          {x.state !== "upcoming" && x.state !== "decided" && <AttemptPanel assignmentId={x.assignmentId} onChange={item.reload} />}

          <Card title={en("How you're assessed")}>
            <ul className="divide-y divide-border text-sm">
              {x.rubric.map((c) => (
                <li key={c.name} className="flex items-start justify-between gap-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-medium">{c.name}</span>
                    {c.description && <span className="block text-muted-foreground">{c.description}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{c.weight}%</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={en("The viva")}>
            <div className="space-y-2 text-sm">
              <p>
                {en("After you submit, you explain your work: {questions} questions in about {minutes} minutes, in {language}.", {
                  questions: x.viva.questions,
                  minutes: x.viva.minutes,
                  language: x.viva.language,
                })}{" "}
                {vivaHow}
              </p>
              {x.changeTaskMinutes != null && (
                <p>{en("You'll also make one small change to your own code in {minutes} minutes.", { minutes: x.changeTaskMinutes })}</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={en("Dates")}>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">{en("Opens")}</dt>
                <dd>{formatWhen(x.opensAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{en("Due")}</dt>
                <dd>{formatWhen(x.dueAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{en("Late work")}</dt>
                <dd>{x.acceptLate ? en("Accepted, marked late") : en("Not accepted")}</dd>
              </div>
            </dl>
          </Card>
          {x.teachers.length > 0 && (
            <Card title={en("Teachers")}>
              <ul className="space-y-1 text-sm">
                {x.teachers.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
