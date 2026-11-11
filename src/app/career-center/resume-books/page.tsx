"use client";

/**
 * The school's résumé book (docs/resume_tools_plan_nov2026.md, stage 3, G8): who has added a résumé, how often employers
 * opened each one (every open is in the privacy log), and taking an entry out with a reason the student sees.
 */
import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, EmptyState, ErrorBanner, Loading, Modal, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import { HelpLink } from "@/components/help/HelpLink";

interface Entry { id: string; name: string; program: string; degree: string | null; graduationYear: number | null; joinedAt: string; updatedAt: string; opens: number; lastOpenedAt: string | null }
interface Book { open: boolean; entries: Entry[] }

export default function SchoolResumeBookPage() {
  const en = useEn();
  const api = useApi();
  const book = useLoad(() => api<Book>("/api/career/resume-books/admin"), [api]);
  const [removing, setRemoving] = useState<Entry | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setErr(null);
    try {
      book.setData(await api<Book>(`/api/career/resume-books/admin/entries/${removing.id}/remove`, { json: { reason } }));
      setMsg(en("{name}'s résumé was taken out. They were told why.", { name: removing.name }));
      setRemoving(null);
      setReason("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={en("Résumé book")}
        description={en("Résumés your students chose to share with the employers you approved. Every résumé an employer opens is in the privacy log.")} actions={<HelpLink slug="resume-book" />} />
      <ErrorBanner error={err ?? book.error} onRetry={book.error ? book.reload : undefined} />
      <SuccessBanner message={msg} />
      {book.loading && !book.data ? (
        <Loading />
      ) : !book.data?.open ? (
        <EmptyState title={en("The résumé book is closed")}>
          <p>{en("Open it in Settings, under Résumés. Students then choose whether to add a résumé.")}</p>
          <Link href="/career-center/settings" className="mt-2 inline-block font-medium underline">{en("Go to Settings")}</Link>
        </EmptyState>
      ) : book.data.entries.length === 0 ? (
        <EmptyState title={en("No résumés yet")}>
          <p>{en("Students add a résumé from their Résumés page. It appears here once they do.")}</p>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">{en("Résumé book entries")}</caption>
            <thead className="border-b border-border text-start text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 text-start font-medium">{en("Student")}</th>
                <th scope="col" className="px-4 py-2 text-start font-medium">{en("Program")}</th>
                <th scope="col" className="px-4 py-2 text-start font-medium">{en("Added")}</th>
                <th scope="col" className="px-4 py-2 text-end font-medium">{en("Opened by employers")}</th>
                <th scope="col" className="px-4 py-2"><span className="sr-only">{en("Actions")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {book.data.entries.map((x) => (
                <tr key={x.id}>
                  <td className="px-4 py-3 font-medium">{x.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[x.program, x.degree, x.graduationYear ? en("class of {year}", { year: x.graduationYear }) : null].filter(Boolean).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(x.joinedAt)}</td>
                  <td className="px-4 py-3 text-end tabular-nums">
                    {x.opens}
                    {x.lastOpenedAt && <span className="block text-xs text-muted-foreground">{en("last {date}", { date: formatDate(x.lastOpenedAt) })}</span>}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button type="button" variant="ghost" className="px-2 text-muted-foreground" onClick={() => setRemoving(x)}>
                      {en("Take out")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {removing && (
        <Modal labelledBy="remove-title" onClose={() => setRemoving(null)}>
          <h2 id="remove-title" className="text-lg font-semibold">{en("Take {name}'s résumé out", { name: removing.name })}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{en("Employers stop seeing it at once. The student sees your reason and can add a résumé again.")}</p>
          <label className="mt-4 block text-sm">
            <span className="font-medium">{en("Reason for the student")}</span>
            <textarea value={reason} maxLength={500} rows={3} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(null)}>{en("Cancel")}</Button>
            <Button busy={busy} disabled={reason.trim().length < 3} onClick={() => void remove()}>{en("Take out")}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
