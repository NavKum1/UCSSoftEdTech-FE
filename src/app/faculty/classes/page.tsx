"use client";

/**
 * Build & Defend 1.0 Stage 2 (2.2): a teacher's classes. Teachers create their own classes and see only theirs; the school's
 * career admins see every class. API: /api/career/class-assessments/faculty/classes.
 */
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, ScrollArea, useLoad } from "@/components/career/ui";
import { CA_API, type ClassSummary } from "@/components/career/classAssessments/types";

export default function FacultyClassesPage() {
  const en = useEn();
  const api = useApi();
  const router = useRouter();
  const { schoolId } = useCareerShell();
  const list = useLoad(() => api<{ isAdmin: boolean; classes: ClassSummary[] }>(`${CA_API}/faculty/classes`), [api, schoolId]);
  const [name, setName] = useState("");
  const [program, setProgram] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>(`${CA_API}/faculty/classes`, {
        json: { name, program: program || undefined, graduationYear: year ? Number(year) : undefined },
      });
      router.push(`/faculty/classes/${created.id}`);
    } catch (err) {
      setError(err instanceof TypeError ? en("We couldn't reach the server. Please check your connection and try again.") : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const classes = list.data?.classes ?? [];
  return (
    <div>
      <PageHeader
        title={en("Classes")}
        description={list.data?.isAdmin ? en("Every class at your school. Teachers see only their own.") : en("Your classes. Add a roster, then give them an assessment.")}
      />
      <ErrorBanner error={list.error} onRetry={list.reload} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {list.loading ? (
            <Loading />
          ) : classes.length === 0 ? (
            <EmptyState title={en("No classes yet")}>{en("Create your first class, then import its roster from a spreadsheet.")}</EmptyState>
          ) : (
            <ScrollArea>
              <table className="w-full text-start text-sm [&_th]:text-start">
                <caption className="sr-only">{en("Classes")}</caption>
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pe-3 font-medium">{en("Class")}</th>
                    <th scope="col" className="pe-3 font-medium">{en("Students")}</th>
                    <th scope="col" className="pe-3 font-medium">{en("Assessments")}</th>
                    <th scope="col" className="font-medium">{en("Teachers")}</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id} className="border-b border-border/60 align-top">
                      <td className="py-2.5 pe-3">
                        <Link href={`/faculty/classes/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                          {c.name}
                        </Link>
                        {(c.program || c.graduationYear) && (
                          <span className="block text-xs text-muted-foreground">{[c.program, c.graduationYear].filter(Boolean).join(", ")}</span>
                        )}
                      </td>
                      <td className="pe-3 tabular-nums">
                        {c.students}
                        {c.students > 0 && <span className="block text-xs text-muted-foreground">{en("{count} signed in", { count: c.signedIn })}</span>}
                      </td>
                      <td className="pe-3 tabular-nums">{c.assessments}</td>
                      <td className="text-xs">{c.teachers.map((t) => t.name || t.email).join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </div>
        <Card title={en("New class")}>
          <form onSubmit={create} className="space-y-3">
            <Field label={en("Class name")} hint={en("For example: CS 341, Fall 2026")}>
              {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />}
            </Field>
            <Field label={en("Program (optional)")}>
              {(p) => <input {...p} value={program} onChange={(e) => setProgram(e.target.value)} maxLength={120} />}
            </Field>
            <Field label={en("Graduation year (optional)")}>
              {(p) => <input {...p} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" />}
            </Field>
            <ErrorBanner error={error} />
            <Button type="submit" busy={busy} className="w-full">
              {en("Create class")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
