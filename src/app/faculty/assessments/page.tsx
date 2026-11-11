"use client";

/**
 * Build & Defend 1.0 Stage 2 (2.3): a teacher's assessments, and starting a new one from a template (project defense, coding
 * task, written exam plus viva; C1: essay, report, lab report, presentation). API: /api/career/class-assessments/faculty/assessments.
 */
import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, ScrollArea, useLoad } from "@/components/career/ui";
import { CA_API, formatWhen, isDocumentTemplate, type AssessmentSummary, type Template, type TemplateInfo } from "@/components/career/classAssessments/types";
import { useTemplateNames } from "@/components/career/classAssessments/names";

export default function FacultyAssessmentsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <FacultyAssessments />
    </Suspense>
  );
}

function FacultyAssessments() {
  const en = useEn();
  const api = useApi();
  const router = useRouter();
  const archived = useSearchParams().get("archived") === "1";
  const { schoolId } = useCareerShell();
  const names = useTemplateNames();
  const list = useLoad(
    () => api<{ assessments: AssessmentSummary[] }>(`${CA_API}/faculty/assessments${archived ? "?archived=true" : ""}`),
    [api, schoolId, archived],
  );
  const templates = useLoad(() => api<{ templates: TemplateInfo[] }>(`${CA_API}/faculty/templates`), [api, schoolId]);
  const [template, setTemplate] = useState<Template>("project");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A coding or exam assessment needs its task chosen first; the builder asks for it
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (template === "coding" || template === "exam") {
      router.push(`/faculty/assessments/new?template=${template}&title=${encodeURIComponent(title)}`);
      return;
    }
    setBusy(true);
    try {
      const created = await api<{ id: string }>(`${CA_API}/faculty/assessments`, { json: { template, title } });
      router.push(`/faculty/assessments/${created.id}`);
    } catch (err) {
      setError(err instanceof TypeError ? en("We couldn't reach the server. Please check your connection and try again.") : (err as Error).message);
      setBusy(false);
    }
  };

  const rows = list.data?.assessments ?? [];
  return (
    <div>
      <PageHeader title={en("Assessments")} description={en("Build an assessment from a template, give it to a class, and review what students submit and how they defend it.")} />
      <ErrorBanner error={list.error} onRetry={list.reload} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <nav aria-label={en("Which assessments")} className="mb-3 flex gap-4 text-sm">
            <Link href="/faculty/assessments" aria-current={!archived ? "page" : undefined} className={archived ? "text-muted-foreground underline-offset-2 hover:underline" : "font-medium"}>
              {en("Current")}
            </Link>
            <Link href="/faculty/assessments?archived=1" aria-current={archived ? "page" : undefined} className={archived ? "font-medium" : "text-muted-foreground underline-offset-2 hover:underline"}>
              {en("Archived")}
            </Link>
          </nav>
          {list.loading ? (
            <Loading />
          ) : rows.length === 0 ? (
            archived ? (
              <EmptyState title={en("No archived assessments")}>{en("Assessments you archive are kept here.")}</EmptyState>
            ) : (
              <EmptyState title={en("No assessments yet")}>{en("Start one from a template.")}</EmptyState>
            )
          ) : (
            <ScrollArea>
              <table className="w-full text-start text-sm [&_th]:text-start">
                <caption className="sr-only">{en("Assessments")}</caption>
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pe-3 font-medium">{en("Assessment")}</th>
                    <th scope="col" className="pe-3 font-medium">{en("Status")}</th>
                    <th scope="col" className="pe-3 font-medium">{en("Classes")}</th>
                    <th scope="col" className="font-medium">{en("To review")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.id} className="border-b border-border/60 align-top">
                      <td className="py-2.5 pe-3">
                        <Link href={`/faculty/assessments/${x.id}`} className="font-medium underline-offset-2 hover:underline">
                          {x.title}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{names[x.template]}</span>
                      </td>
                      <td className="pe-3">
                        <Badge tone={x.status === "Published" ? "good" : "neutral"}>
                          {x.status === "Published" ? en("Published") : x.status === "Archived" ? en("Archived") : en("Draft")}
                        </Badge>
                      </td>
                      <td className="pe-3 text-xs">
                        {x.classes.length === 0
                          ? "—"
                          : x.classes.map((c) => (
                              <span key={c.assignmentId} className="block">
                                {c.className} · {en("due {when}", { when: formatWhen(c.dueAt) })}
                              </span>
                            ))}
                      </td>
                      <td className="tabular-nums">{x.toReview > 0 ? <Badge tone="warn">{x.toReview}</Badge> : 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </div>
        <Card title={en("New assessment")}>
          <form onSubmit={create} className="space-y-4">
            {[
              { legend: en("Any subject"), list: (templates.data?.templates ?? []).filter((t) => isDocumentTemplate(t.key)) },
              { legend: en("Code and exams"), list: (templates.data?.templates ?? []).filter((t) => !isDocumentTemplate(t.key)) },
            ].map((g) =>
              g.list.length === 0 ? null : (
                <fieldset key={g.legend} className="space-y-2">
                  <legend className="mb-1 text-sm font-medium">{g.legend}</legend>
                  {g.list.map((t) => (
                    <label
                      key={t.key}
                      className={`block cursor-pointer rounded-lg border p-3 text-sm transition-colors ${template === t.key ? "border-[var(--brand)] bg-[var(--brand)]/5" : "border-border hover:bg-muted/50"}`}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <input type="radio" name="template" value={t.key} checked={template === t.key} onChange={() => setTemplate(t.key)} />
                        {names[t.key]}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{t.description}</span>
                    </label>
                  ))}
                </fieldset>
              ),
            )}
            <Field label={en("Title")}>
              {(p) => <input {...p} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder={en("For example: Term project defense")} />}
            </Field>
            <ErrorBanner error={error} />
            <Button type="submit" busy={busy} className="w-full">
              {en("Continue")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
