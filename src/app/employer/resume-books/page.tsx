"use client";

/**
 * Résumé books for employers (docs/resume_tools_plan_nov2026.md, stage 3, G8): the books of schools that approved the
 * employer, filtered by program, degree and graduation year, with a keyword search. Opening a résumé is recorded and shown
 * to the student and their school.
 */
import React, { useState } from "react";
import Link from "next/link";
import { BookOpen, FileText, Search } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, EmptyState, ErrorBanner, Field, Loading, PageHeader, formatDate, useLoad } from "@/components/career/ui";
import { EmployerPicker, useEmployers } from "@/components/career/EmployerPicker";

interface SchoolBook { instituteId: string; school: string; entries: number }
interface Entry { id: string; name: string; program: string; degree: string | null; graduationYear: number | null; updatedAt: string }
interface Book { school: string; entries: Entry[]; programs: string[]; degrees: string[]; years: number[]; note: string }

export default function EmployerResumeBooksPage() {
  const en = useEn();
  const api = useApi();
  const emp = useEmployers();
  const employerId = emp.current?.employer.id;
  const q = employerId ? `employerId=${employerId}` : "";
  const schools = useLoad(() => (employerId ? api<SchoolBook[]>(`/api/career/resume-books/employer/schools?${q}`) : Promise.resolve([] as SchoolBook[])), [api, employerId]);
  const [school, setSchool] = useState<string>("");
  const [filters, setFilters] = useState({ program: "", degree: "", year: "", q: "" });
  const [book, setBook] = useState<Book | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const search = async (inst: string, f = filters) => {
    setBusy("search");
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (employerId) params.set("employerId", employerId);
      if (f.program) params.set("program", f.program);
      if (f.degree) params.set("degree", f.degree);
      if (f.year) params.set("year", f.year);
      if (f.q.trim()) params.set("q", f.q.trim());
      setBook(await api<Book>(`/api/career/resume-books/employer/schools/${inst}?${params}`));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const open = async (entry: Entry) => {
    setBusy(entry.id);
    setErr(null);
    try {
      const res = await api<Response>(`/api/career/resume-books/employer/schools/${school}/entries/${entry.id}/file?${q}`, { raw: true });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { message?: string; error?: string } | null)?.message ?? en("This résumé can't be opened now."));
      // A download, not a new tab: browsers block tabs opened after a network call
      const ext = (res.headers.get("content-type") ?? "").includes("pdf") ? "pdf" : "docx";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entry.name.replace(/[^\p{L}\p{N} ._-]/gu, "").trim() || "resume"}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (emp.loading && !emp.data) return <Loading />;
  if (emp.error) return <ErrorBanner error={emp.error} onRetry={emp.reload} />;
  if (!emp.current)
    return (
      <EmptyState title={en("Set up your company first")}>
        <Link href="/employer" className="underline">{en("Create your company profile")}</Link>
      </EmptyState>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={en("Résumé books")}
        description={en("Résumés students chose to share with employers their school approved. Each résumé you open is recorded and shown to the student and their school.")}
        actions={<EmployerPicker accounts={emp.accounts} current={emp.current} onSelect={emp.select} />}
      />
      <ErrorBanner error={err ?? schools.error} />
      {schools.loading && !schools.data ? (
        <Loading />
      ) : (schools.data ?? []).length === 0 ? (
        <EmptyState title={en("No résumé books yet")}>
          <p>{en("A school's résumé book appears here once the school approves your company and opens its book.")}</p>
          <Link href="/employer/schools" className="mt-2 inline-block font-medium underline">{en("Ask schools to recruit there")}</Link>
        </EmptyState>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {schools.data!.map((s) => (
              <li key={s.instituteId}>
                <button
                  type="button"
                  aria-pressed={school === s.instituteId}
                  onClick={() => {
                    setSchool(s.instituteId);
                    const f = { program: "", degree: "", year: "", q: "" };
                    setFilters(f);
                    void search(s.instituteId, f);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-4 text-start shadow-sm hover:bg-muted/50 ${school === s.instituteId ? "border-[var(--brand)] bg-muted/40" : "border-border bg-card"}`}
                >
                  <BookOpen aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.school}</span>
                    <span className="block text-sm text-muted-foreground">{s.entries === 1 ? en("1 résumé") : en("{count} résumés", { count: s.entries })}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {school && book && (
            <section aria-labelledby="book-title" className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 id="book-title" className="text-base font-semibold">{book.school}</h2>
              <form
                className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_8rem_1.5fr_auto] lg:items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  void search(school);
                }}
              >
                <Field label={en("Program")}>
                  {(p) => (
                    <select {...p} value={filters.program} onChange={(e) => setFilters({ ...filters, program: e.target.value })}>
                      <option value="">{en("All")}</option>
                      {book.programs.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  )}
                </Field>
                <Field label={en("Degree")}>
                  {(p) => (
                    <select {...p} value={filters.degree} onChange={(e) => setFilters({ ...filters, degree: e.target.value })}>
                      <option value="">{en("All")}</option>
                      {book.degrees.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  )}
                </Field>
                <Field label={en("Graduation year")}>
                  {(p) => (
                    <select {...p} value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })}>
                      <option value="">{en("All")}</option>
                      {book.years.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  )}
                </Field>
                <Field label={en("Words in the résumé")}>
                  {(p) => <input {...p} value={filters.q} placeholder={en("For example: Python SQL")} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />}
                </Field>
                <Button type="submit" busy={busy === "search"}>
                  <Search aria-hidden="true" className="h-4 w-4" />
                  {en("Search")}
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">{book.note}</p>
              {book.entries.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">{en("No résumés match. Try fewer filters.")}</p>
              ) : (
                <ul className="mt-4 divide-y divide-border">
                  {book.entries.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-medium">{x.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {[x.program, x.degree, x.graduationYear ? en("class of {year}", { year: x.graduationYear }) : null].filter(Boolean).join(", ")}
                        </p>
                        <p className="text-xs text-muted-foreground">{en("Updated {date}", { date: formatDate(x.updatedAt) })}</p>
                      </div>
                      <Button type="button" variant="secondary" busy={busy === x.id} onClick={() => void open(x)}>
                        <FileText aria-hidden="true" className="h-4 w-4" />
                        {en("Open résumé")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
