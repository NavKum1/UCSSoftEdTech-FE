"use client";

/**
 * Build & Defend 1.0 Stage 2 (2.2): one class. Its roster (CSV: name, email, roll_number, branch; a student is linked when they
 * first sign in with that e-mail), its teachers and its assessments. API: /api/career/class-assessments/faculty/classes/{id}.
 */
import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, ScrollArea, SuccessBanner, useLoad } from "@/components/career/ui";
import { CA_API, formatWhen, type ClassDetail } from "@/components/career/classAssessments/types";

interface ImportResult {
  added: number;
  updated: number;
  unchanged: number;
  rejected: boolean;
  errors: { line: number; message: string }[];
}

export default function FacultyClassPage() {
  const en = useEn();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const { id } = useParams<{ id: string }>();
  const cls = useLoad(() => api<ClassDetail>(`${CA_API}/faculty/classes/${id}`), [api, id, schoolId]);
  const [csv, setCsv] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<ImportResult["errors"]>([]);

  const fail = (e: unknown) =>
    setError(e instanceof TypeError ? en("We couldn't reach the server. Please check your connection and try again.") : (e as Error).message);

  const importRoster = async () => {
    setBusy("import");
    setError(null);
    setMessage(null);
    setImportErrors([]);
    try {
      const r = await api<ImportResult>(`${CA_API}/faculty/classes/${id}/roster`, { json: { csv } });
      setImportErrors(r.errors ?? []);
      if (r.rejected) setError(en("The file wasn't imported. Check the rows below."));
      else {
        setMessage(en("Roster imported: {added} added, {updated} updated, {unchanged} unchanged.", { added: r.added, updated: r.updated, unchanged: r.unchanged }));
        setCsv("");
        cls.reload();
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5_000_000) return setError(en("The file is too large (5 MB at most)."));
    setCsv(await file.text());
  };

  const removeMember = async (memberId: string, name: string) => {
    if (!window.confirm(en("Remove {name} from this class?", { name }))) return;
    setBusy(memberId);
    try {
      await api(`${CA_API}/faculty/classes/${id}/members/${memberId}`, { method: "DELETE" });
      cls.reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const addTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("teacher");
    setError(null);
    setMessage(null);
    try {
      const next = await api<ClassDetail>(`${CA_API}/faculty/classes/${id}/teachers`, { json: { email: teacherEmail } });
      cls.setData(next);
      setTeacherEmail("");
      setMessage(en("Teacher added."));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const removeTeacher = async (userId: string) => {
    setBusy(userId);
    try {
      cls.setData(await api<ClassDetail>(`${CA_API}/faculty/classes/${id}/teachers/${userId}`, { method: "DELETE" }));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  if (cls.loading) return <Loading />;
  if (!cls.data) return <ErrorBanner error={cls.error ?? en("This class couldn't be loaded.")} onRetry={cls.reload} />;
  const c = cls.data;

  return (
    <div>
      <PageHeader
        title={c.name}
        description={[c.program, c.graduationYear].filter(Boolean).join(", ") || undefined}
        actions={
          <Link href="/faculty/assessments" className="text-sm font-medium underline-offset-2 hover:underline">
            {en("Give this class an assessment")}
          </Link>
        }
      />
      <ErrorBanner error={error} />
      <SuccessBanner message={message} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={en("Students ({count})", { count: c.members.length })}>
            {c.members.length === 0 ? (
              <EmptyState title={en("No students yet")}>{en("Import the roster from a spreadsheet.")}</EmptyState>
            ) : (
              <ScrollArea>
                <table className="w-full text-start text-sm [&_th]:text-start">
                  <caption className="sr-only">{en("Students")}</caption>
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pe-3 font-medium">{en("Student")}</th>
                      <th scope="col" className="hidden pe-3 font-medium sm:table-cell">{en("Roll number")}</th>
                      <th scope="col" className="pe-3 font-medium">{en("Signed in")}</th>
                      <th scope="col" className="font-medium"><span className="sr-only">{en("Actions")}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.members.map((m) => (
                      <tr key={m.id} className="border-b border-border/60">
                        <td className="min-w-0 py-2 pe-3">
                          <span className="block font-medium">{m.name}</span>
                          <span className="block break-all text-xs text-muted-foreground">{m.email}</span>
                          {m.rollNumber && <span className="block text-xs text-muted-foreground sm:hidden">{m.rollNumber}</span>}
                        </td>
                        <td className="hidden pe-3 sm:table-cell">{m.rollNumber || "—"}</td>
                        <td className="whitespace-nowrap pe-3">{m.signedIn ? <Badge tone="good">{en("Yes")}</Badge> : <Badge>{en("Not yet")}</Badge>}</td>
                        <td className="text-end">
                          <Button variant="ghost" busy={busy === m.id} onClick={() => void removeMember(m.id, m.name)} aria-label={en("Remove {name}", { name: m.name })}>
                            {en("Remove")}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </Card>

          <Card title={en("Assessments")}>
            {c.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{en("No assessments given to this class yet.")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {c.assignments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                    <Link href={`/faculty/assessments/${a.assessmentId}`} className="font-medium underline-offset-2 hover:underline">
                      {a.title}
                    </Link>
                    <span className="text-muted-foreground">{en("Due {when}", { when: formatWhen(a.dueAt) })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={en("Import roster")}>
            <p className="mb-3 text-sm text-muted-foreground">
              {en("A CSV with the columns name, email, roll_number and branch (roll number and branch are optional). Students already in the class are updated, not added twice.")}
            </p>
            <div className="space-y-3">
              <Field label={en("CSV file")}>
                {(p) => <input {...p} type="file" accept=".csv,text/csv" onChange={(e) => void readFile(e.target.files?.[0])} />}
              </Field>
              <Field label={en("Or paste the rows")}>
                {(p) => <textarea {...p} rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"name,email,roll_number,branch\nAsha Rao,asha@school.edu,R101,CSE"} />}
              </Field>
              <Button busy={busy === "import"} disabled={!csv.trim()} onClick={() => void importRoster()} className="w-full">
                {en("Import")}
              </Button>
              {importErrors.length > 0 && (
                <ul className="space-y-1 text-xs text-red-700 dark:text-red-400" role="alert">
                  {importErrors.slice(0, 20).map((x, i) => (
                    <li key={i}>{en("Row {line}: {message}", { line: x.line, message: x.message })}</li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card title={en("Teachers")}>
            <ul className="mb-3 space-y-2 text-sm">
              {c.teachers.map((t) => (
                <li key={t.userId} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block font-medium">{t.name || t.email}</span>
                    <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {t.role === "Owner" ? en("Owner") : en("Co-teacher")} · {t.email}
                    </span>
                  </span>
                  {c.canManage && t.role !== "Owner" && (
                    <Button variant="ghost" busy={busy === t.userId} onClick={() => void removeTeacher(t.userId)}>
                      {en("Remove")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {c.canManage && (
              <form onSubmit={addTeacher} className="space-y-2">
                <Field label={en("Add a co-teacher")} hint={en("A teacher at your school who has signed in to Edulexa.")}>
                  {(p) => <input {...p} type="email" value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)} required placeholder="name@school.edu" />}
                </Field>
                <Button type="submit" variant="secondary" busy={busy === "teacher"} className="w-full">
                  {en("Add teacher")}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
