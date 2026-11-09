"use client";

/**
 * The student's place in their school's résumé book (docs/resume_tools_plan_nov2026.md, stage 3, G8): add one library
 * version under a FERPA consent, see how often employers opened it, change the version or leave. Shown only to students
 * whose school has its book open.
 */
import React, { useCallback, useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, ErrorBanner, formatDate } from "@/components/career/ui";

interface Status {
  open: boolean;
  school: string;
  approvalRequired: boolean;
  blocked: string | null;
  entry: null | { program: string; degree: string | null; graduationYear: number | null; updatedAt: string; views: number; version: { id: string; number: number; title: string } | null };
  removedBySchool: null | { removedAt: string; removedReason: string };
}
export interface BookChoice { versionId: string; label: string; approved: boolean }

export default function ResumeBookCard({ choices }: { choices: BookChoice[] }) {
  const en = useEn();
  const api = useApi();
  const [status, setStatus] = useState<Status | null>(null);
  const [versionId, setVersionId] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<Response>("/api/career/resume-books/student", { raw: true });
      setStatus(res.ok ? ((await res.json()) as Status) : null);
    } catch {
      setStatus(null);
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!status?.open) return null;
  const usable = choices.filter((c) => !status.approvalRequired || c.approved);
  const run = async (method: "PUT" | "DELETE") => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await api<Status>("/api/career/resume-books/student", method === "PUT" ? { method, json: { versionId, consent } } : { method }));
      setConsent(false);
      setVersionId("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="resume-book-title" className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="resume-book-title" className="text-base font-semibold">{en("{school} résumé book", { school: status.school })}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {en("Employers {school} has approved can find your résumé by program and graduation year. Each time one opens it, you see it here and on your privacy page.", { school: status.school })}
          </p>
          <ErrorBanner error={error} />
          {status.removedBySchool && !status.entry && (
            <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {en("Your school took your résumé out of the book on {date}: {reason}", { date: formatDate(status.removedBySchool.removedAt), reason: status.removedBySchool.removedReason })}
            </p>
          )}
          {status.blocked && (
            <p className="mt-3 text-sm">
              {status.blocked}
              {status.entry ? " " + en("Employers can't see your résumé while this is so. You can still leave the book.") : ""}
            </p>
          )}
          {status.entry ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone="good">{en("In the book")}</Badge>
                <span>
                  {status.entry.version
                    ? en("{title}, version {number}", { title: status.entry.version.title, number: status.entry.version.number })
                    : en("Your résumé")}
                </span>
                <span className="text-muted-foreground">
                  {[status.entry.program, status.entry.graduationYear ? en("class of {year}", { year: status.entry.graduationYear }) : null].filter(Boolean).join(", ")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {status.entry.views === 1 ? en("Opened by employers once.") : en("Opened by employers {count} times.", { count: status.entry.views })}
              </p>
              <Button type="button" variant="ghost" className="px-2 text-muted-foreground" busy={busy} onClick={() => void run("DELETE")}>
                {en("Leave the résumé book")}
              </Button>
            </div>
          ) : null}
          {!status.blocked && (
            <form
              className="mt-4 space-y-3 border-t border-border pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run("PUT");
              }}
            >
              <label htmlFor="book-version" className="block text-sm font-medium">
                {status.entry ? en("Change the résumé in the book") : en("Choose a résumé")}
              </label>
              {usable.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {status.approvalRequired
                    ? en("Your school asks for a résumé the career center approved. Send one for document review first.")
                    : en("Add a résumé to your library first.")}
                </p>
              ) : (
                <>
                  <select id="book-version" value={versionId} onChange={(e) => setVersionId(e.target.value)} className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="">{en("Choose…")}</option>
                    {usable.map((c) => (
                      <option key={c.versionId} value={c.versionId}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>{en("I agree that my résumé, program and graduation year can be shared with employers {school} has approved. I can leave at any time.", { school: status.school })}</span>
                  </label>
                  <Button type="submit" busy={busy} disabled={!versionId || !consent}>
                    {status.entry ? en("Use this résumé") : en("Add to the résumé book")}
                  </Button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
