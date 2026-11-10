"use client";

/**
 * Build & Defend 1.0 Stage 2 (2.7): one assessment in one class. Every student and where they are: not started, working on it,
 * work in with the viva next, ready for review, or decided. Each attempt opens its evidence. Only the class's teachers and
 * school admins see it. API: /api/career/class-assessments/faculty/assessments/{id}/assignments/{assignmentId}/students.
 * 2.10: the results from the teachers' decisions, a CSV download, and each student's grade in the school's LMS when the
 * assignment is linked to one (ClassResults).
 */
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, EmptyState, ErrorBanner, Loading, PageHeader, ScrollArea, Tabs, useLoad } from "@/components/career/ui";
import { CA_API, formatWhen, type AssignmentStudents, type StudentRow } from "@/components/career/classAssessments/types";
import { useStudentStatus, useSuggestionStateText, useWorkKindNames } from "@/components/career/classAssessments/evidenceText";
import { CsvButton, LmsCell, ResultsSummary } from "@/components/career/classAssessments/ClassResults";

type Filter = "all" | "review" | "viva" | "working" | "not_started" | "decided";

const matches = (f: Filter, s: StudentRow) => {
  const st = s.attempt?.status;
  switch (f) {
    case "review": return st === "Submitted";
    case "viva": return st === "Viva";
    case "working": return st === "Started";
    case "not_started": return !s.attempt;
    case "decided": return st === "Decided";
    default: return true;
  }
};

export default function AssignmentStudentsPage() {
  const en = useEn();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const data = useLoad(() => api<AssignmentStudents>(`${CA_API}/faculty/assessments/${id}/assignments/${assignmentId}/students`), [api, id, assignmentId, schoolId]);
  const status = useStudentStatus();
  const suggestions = useSuggestionStateText();
  const kinds = useWorkKindNames();
  const [filter, setFilter] = useState<Filter | null>(null);

  const d = data.data;
  // Open on what needs the teacher, when there is any
  const active: Filter = filter ?? (d && d.counts.toReview > 0 ? "review" : "all");
  const rows = useMemo(() => (d?.students ?? []).filter((s) => matches(active, s)), [d, active]);

  if (data.loading) return <Loading />;
  if (!d) return <ErrorBanner error={data.error ?? en("This class couldn't be loaded.")} onRetry={data.reload} />;
  const c = d.counts;

  return (
    <div>
      <PageHeader
        title={d.assessment.title}
        description={en("{className}, due {when}", { className: d.class.name, when: formatWhen(d.assignment.dueAt) })}
        actions={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href={`/faculty/assessments/${d.assessment.id}`} className="text-sm font-medium underline-offset-2 hover:underline">
              {en("Assessment settings")}
            </Link>
            <CsvButton
              assessmentId={d.assessment.id}
              assignmentId={d.assignment.id}
              fileName={`${[d.assessment.title, d.class.name, "results"].join(" ").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}.csv`}
            />
          </div>
        }
      />

      {d.lmsLinked && (
        <p className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          {en("Linked to your course's gradebook. When you decide, the score and your comment go to the LMS; asked to resubmit shows as in progress.")}
        </p>
      )}

      <ResultsSummary results={d.results} />

      <div className="mb-4">
        <Tabs<Filter>
          label={en("Show students")}
          value={active}
          onChange={setFilter}
          items={[
            { id: "review", label: en("Ready for review"), count: c.toReview },
            { id: "viva", label: en("Viva next"), count: c.vivaNext },
            { id: "working", label: en("Working on it"), count: c.working },
            { id: "not_started", label: en("Not started"), count: c.notStarted },
            { id: "decided", label: en("Decided"), count: c.decided },
            { id: "all", label: en("Everyone"), count: d.students.length },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title={active === "review" ? en("Nothing to review yet") : en("No students here")}>
          {active === "review" ? en("Attempts show up here once the student has finished the viva.") : en("Try another tab.")}
        </EmptyState>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <ScrollArea label={en("Students")}>
            <table className="w-full text-start text-sm [&_td]:py-3 [&_th]:text-start">
              <caption className="sr-only">{en("Students and where they are")}</caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-2.5 ps-4 pe-3 font-medium">{en("Student")}</th>
                  <th scope="col" className="pe-3 font-medium">{en("Where they are")}</th>
                  <th scope="col" className="hidden pe-3 font-medium md:table-cell">{en("Work")}</th>
                  <th scope="col" className="hidden pe-3 font-medium lg:table-cell">{en("Suggested scores")}</th>
                  <th scope="col" className="hidden pe-3 font-medium sm:table-cell">{en("Handed in")}</th>
                  {d.lmsLinked && <th scope="col" className="pe-3 font-medium">{en("Gradebook")}</th>}
                  <th scope="col" className="pe-4 font-medium"><span className="sr-only">{en("Evidence")}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const t = s.attempt;
                  const st = status(s);
                  return (
                    <tr key={s.memberId ?? s.userId ?? s.email} className="border-b border-border/60 last:border-0">
                      <td className="min-w-0 ps-4 pe-3 align-top">
                        <span className="block font-medium">{s.name || s.email}</span>
                        <span className="block break-all text-xs text-muted-foreground">{s.rollNumber ? `${s.rollNumber} · ${s.email}` : s.email}</span>
                        {!s.inClass && <span className="block text-xs text-muted-foreground">{en("No longer in the class")}</span>}
                      </td>
                      <td className="pe-3 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={st.tone}>{st.label}</Badge>
                          {t?.late && <Badge tone="warn">{en("Late")}</Badge>}
                          {t && t.number > 1 && <Badge>{en("Attempt {n}", { n: t.number })}</Badge>}
                        </div>
                        {t?.status === "Decided" && t.score !== null && (
                          <span className="mt-1 block text-xs text-muted-foreground">{en("Score {score} of 100", { score: Math.round(t.score) })}</span>
                        )}
                        {t?.status === "Viva" && t.voiceTries > 0 && (
                          <span className="mt-1 block text-xs text-muted-foreground">{en("Voice didn't go through ({count} tries)", { count: t.voiceTries })}</span>
                        )}
                      </td>
                      <td className="hidden pe-3 align-top text-muted-foreground md:table-cell">{t?.workKind ? kinds[t.workKind] : "—"}</td>
                      <td className="hidden pe-3 align-top text-muted-foreground lg:table-cell">{t && t.suggestions !== "after_viva" ? suggestions[t.suggestions] : "—"}</td>
                      <td className="hidden whitespace-nowrap pe-3 align-top text-muted-foreground sm:table-cell">{t?.submittedAt ? formatWhen(t.submittedAt) : "—"}</td>
                      {d.lmsLinked && (
                        <td className="pe-3 align-top text-sm">
                          <LmsCell row={s} onSent={data.reload} />
                        </td>
                      )}
                      <td className="whitespace-nowrap pe-4 text-end align-top">
                        {t && (
                          <Link href={`/faculty/attempts/${t.id}`} className="font-medium underline underline-offset-2 hover:decoration-2">
                            {t.status === "Submitted" ? en("Review") : en("Open")}
                            <span className="sr-only"> {s.name}</span>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
