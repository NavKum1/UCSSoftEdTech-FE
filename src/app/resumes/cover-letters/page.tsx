"use client";

/**
 * Cover letters (docs/resume_tools_plan_nov2026.md, stage 4): drafted by the AI from one of the person's résumés and a job
 * (a saved job check or a pasted description), using only what the résumé says, then edited by the person. Each save is a
 * new version with its PDF; letters download as PDF or Word. Drafting is one AI use; editing is free.
 */
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Archive, ArrowLeft, Download, FileText, Plus, Sparkles } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, EmptyState, ErrorBanner, PageHeader, SuccessBanner, formatDate } from "@/components/career/ui";
import { downloadFrom } from "@/lib/resumeLibrary";

interface Letter { id: string; title: string; updatedAt: string; currentVersion: { id: string; number: number; createdAt: string } | null }
interface ResumeChoice { id: string; label: string }
interface JobCheck { id: string; title: string; company: string | null }
interface Allowance { limit: number; left: number; reason: string | null }

export default function CoverLettersPage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [letters, setLetters] = useState<Letter[] | null>(null);
  // Archived letters are listed apart, each with Restore
  const [archived, setArchived] = useState(false);
  const [resumes, setResumes] = useState<ResumeChoice[]>([]);
  const [checks, setChecks] = useState<JobCheck[]>([]);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [open, setOpen] = useState<Letter | null>(null);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [form, setForm] = useState({ versionId: "", jobCheckId: "", jobText: "", title: "", company: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const failure = async (res: Response) => ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? en("That didn't work. Please try again.");

  const load = useCallback(async () => {
    const [l, r, c, a] = await Promise.all([apiFetch(`/api/resumes?kind=cover-letters${archived ? "&archived=true" : ""}`), apiFetch("/api/resumes"), apiFetch("/api/resumes/job-checks"), apiFetch("/api/resumes/ai-allowance")]);
    setLetters(l.ok ? ((await l.json()) as { resumes: Letter[] }).resumes : []);
    if (r.ok) {
      const body = (await r.json()) as { resumes: { title: string; currentVersion: { id: string; number: number; textReadable: boolean } | null }[] };
      setResumes(body.resumes.filter((x) => x.currentVersion?.textReadable).map((x) => ({ id: x.currentVersion!.id, label: en("{title}, version {number}", { title: x.title, number: x.currentVersion!.number }) })));
    }
    if (c.ok) setChecks((await c.json()) as JobCheck[]);
    if (a.ok) setAllowance((await a.json()) as Allowance);
  }, [apiFetch, en, archived]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef, archived]);

  const restore = async (l: Letter) => {
    if ((await run(`restore-${l.id}`, () => apiFetch(`/api/resumes/${l.id}/restore`, { method: "POST" }))) !== null) {
      setNotice(en("Restored."));
      await load();
    }
  };

  const openLetter = async (l: Letter) => {
    if (!l.currentVersion) return;
    setError(null);
    setNotice(null);
    const res = await apiFetch(`/api/resumes/versions/${l.currentVersion.id}/text`);
    if (!res.ok) return setError(await failure(res));
    const body = (await res.json()) as { text: string };
    setOpen(l);
    setText(body.text);
    setSaved(body.text);
    setDrafting(false);
  };

  const run = async <T,>(key: string, call: () => Promise<Response>): Promise<T | null> => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await call();
      if (!res.ok) {
        setError(await failure(res));
        return null;
      }
      return (await res.json()) as T;
    } catch {
      setError(en("We couldn't reach Edulexa. Check your internet connection and try again."));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const draft = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = form.jobCheckId
      ? { versionId: form.versionId, jobCheckId: form.jobCheckId, company: form.company || null }
      : { versionId: form.versionId, jobText: form.jobText, title: form.title || null, company: form.company || null };
    const r = await run<{ id: string; title: string; versionId: string; text: string }>("draft", () => apiFetch("/api/resumes/cover-letters", { method: "POST", body: JSON.stringify(body) }));
    await load();
    if (!r) return;
    setOpen({ id: r.id, title: r.title, updatedAt: new Date().toISOString(), currentVersion: { id: r.versionId, number: 1, createdAt: new Date().toISOString() } });
    setText(r.text);
    setSaved(r.text);
    setDrafting(false);
    setNotice(en("Drafted from your résumé. Read it closely and make it yours before you send it."));
  };

  const save = async () => {
    if (!open) return;
    const r = await run<{ versionId: string; number: number; text: string }>("save", () => apiFetch(`/api/resumes/cover-letters/${open.id}`, { method: "PUT", body: JSON.stringify({ text }) }));
    if (!r) return;
    setOpen({ ...open, currentVersion: { id: r.versionId, number: r.number, createdAt: new Date().toISOString() } });
    setSaved(r.text);
    setNotice(en("Saved as version {number}.", { number: r.number }));
    await load();
  };

  const archive = async () => {
    if (!open) return;
    if ((await run("archive", () => apiFetch(`/api/resumes/${open.id}/archive`, { method: "POST" }))) !== null) {
      setOpen(null);
      setNotice(en("Archived."));
      await load();
    }
  };

  if (access) return <AccessNotice problem={access} feature="your cover letters" />;
  const dirty = open !== null && text !== saved;
  const aiOff = !allowance || !!allowance.reason;

  return (
    <div className="space-y-6">
      <Link href="/resumes" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {en("Résumés")}
      </Link>
      <PageHeader
        title={en("Cover letters")}
        description={en("Drafted from your résumé for one job, using only what your résumé says. You edit it; each save keeps a version with its PDF.")}
        actions={
          <Button type="button" onClick={() => { setDrafting(true); setOpen(null); setForm((f) => ({ ...f, versionId: f.versionId || resumes[0]?.id || "" })); }}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            {en("Draft a cover letter")}
          </Button>
        }
      />
      <ErrorBanner error={error} />
      <SuccessBanner message={notice} />

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside aria-label={en("Your cover letters")} className="space-y-3">
          <div className="inline-flex rounded-lg border border-border p-0.5 text-sm" role="group" aria-label={en("Which letters")}>
            {[false, true].map((a) => (
              <button key={String(a)} type="button" aria-pressed={archived === a} onClick={() => { setArchived(a); setLetters(null); setOpen(null); }}
                className={`rounded-md px-3 py-1 ${archived === a ? "bg-muted font-medium" : "text-muted-foreground"}`}>
                {a ? en("Archived") : en("Current")}
              </button>
            ))}
          </div>
          {!letters ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-busy="true" />
          ) : letters.length === 0 ? (
            <p className="text-sm text-muted-foreground">{en("Your cover letters appear here.")}</p>
          ) : (
            <ul className="space-y-2">
              {letters.map((l) => (
                <li key={l.id}>
                  {archived ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{l.title}</span>
                      <Button type="button" variant="ghost" className="px-2" busy={busy === `restore-${l.id}`} onClick={() => void restore(l)}>{en("Restore")}</Button>
                    </div>
                  ) : (
                  <button
                    type="button"
                    aria-current={open?.id === l.id ? "true" : undefined}
                    onClick={() => void openLetter(l)}
                    className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-start text-sm hover:bg-muted/50 ${open?.id === l.id ? "border-[var(--brand)] bg-muted/40" : "border-border"}`}
                  >
                    <FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block font-medium">{l.title}</span>
                      <span className="block text-xs text-muted-foreground">{en("Updated {date}", { date: formatDate(l.updatedAt) })}</span>
                    </span>
                  </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div>
          {drafting ? (
            <form onSubmit={draft} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm" aria-labelledby="draft-title">
              <h2 id="draft-title" className="text-base font-semibold">{en("Draft a cover letter")}</h2>
              {resumes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {en("Add a résumé we can read to your library first.")} <Link href="/resumes" className="underline">{en("Go to Résumés")}</Link>
                </p>
              ) : (
                <>
                  <label className="block text-sm">
                    <span className="font-medium">{en("Based on this résumé")}</span>
                    <select value={form.versionId} onChange={(e) => setForm({ ...form, versionId: e.target.value })} className="mt-1 block w-full max-w-md rounded-lg border border-border bg-background px-3 py-2">
                      {resumes.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">{en("For this job")}</span>
                    <select value={form.jobCheckId} onChange={(e) => setForm({ ...form, jobCheckId: e.target.value })} className="mt-1 block w-full max-w-md rounded-lg border border-border bg-background px-3 py-2">
                      <option value="">{en("A job I'll paste below")}</option>
                      {checks.map((c) => <option key={c.id} value={c.id}>{c.company ? `${c.title}, ${c.company}` : c.title}</option>)}
                    </select>
                  </label>
                  {!form.jobCheckId && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm">
                        <span className="font-medium">{en("Job title")}</span>
                        <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
                      </label>
                      <label className="block text-sm">
                        <span className="font-medium">{en("Company (optional)")}</span>
                        <input value={form.company} maxLength={120} onChange={(e) => setForm({ ...form, company: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
                      </label>
                      <label className="block text-sm sm:col-span-2">
                        <span className="font-medium">{en("Job description")}</span>
                        <textarea value={form.jobText} rows={7} maxLength={20000} onChange={(e) => setForm({ ...form, jobText: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
                      </label>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground" aria-live="polite">
                    {allowance?.reason ?? (allowance ? en("Drafting uses 1 of your {limit} AI uses this month; {left} left.", { limit: allowance.limit, left: allowance.left }) : null)}
                  </p>
                  <div className="flex gap-2">
                    <Button type="submit" busy={busy === "draft"} disabled={aiOff || !form.versionId || (!form.jobCheckId && form.jobText.trim().length < 40)}>
                      <Sparkles aria-hidden="true" className="h-4 w-4" />
                      {en("Draft with AI")}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setDrafting(false)}>{en("Cancel")}</Button>
                  </div>
                </>
              )}
            </form>
          ) : open ? (
            <section aria-labelledby="letter-title" className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="letter-title" className="text-base font-semibold">{open.title}</h2>
                {open.currentVersion && <span className="text-xs text-muted-foreground">{en("Version {number}", { number: open.currentVersion.number })}</span>}
              </div>
              <label htmlFor="letter-text" className="sr-only">{en("Cover letter text")}</label>
              <textarea id="letter-text" value={text} rows={18} maxLength={8000} onChange={(e) => setText(e.target.value)} className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm leading-relaxed" />
              <div className="flex flex-wrap gap-2">
                <Button type="button" busy={busy === "save"} disabled={!dirty} onClick={() => void save()}>{en("Save version")}</Button>
                <Button type="button" variant="secondary" disabled={dirty || !open.currentVersion} onClick={async () => setError(await downloadFrom(apiFetch, `/api/resumes/versions/${open.currentVersion!.id}/file`, `${open.title}.pdf`))}>
                  <Download aria-hidden="true" className="h-4 w-4" />
                  {en("Download PDF")}
                </Button>
                <Button type="button" variant="secondary" disabled={dirty || !open.currentVersion} onClick={async () => setError(await downloadFrom(apiFetch, `/api/resumes/versions/${open.currentVersion!.id}/docx`, `${open.title}.docx`))}>
                  <Download aria-hidden="true" className="h-4 w-4" />
                  {en("Download Word")}
                </Button>
                <Button type="button" variant="ghost" className="ms-auto px-2 text-muted-foreground" busy={busy === "archive"} onClick={() => void archive()}>
                  <Archive aria-hidden="true" className="h-4 w-4" />
                  {en("Archive")}
                </Button>
              </div>
              {dirty && <p className="text-xs text-muted-foreground">{en("Save to download the version you see.")}</p>}
            </section>
          ) : (
            <EmptyState title={en("A letter for each job")}>
              <p>{en("Choose a cover letter, or draft a new one from your résumé and a job.")}</p>
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
