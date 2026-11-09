"use client";

/**
 * The job check (docs/resume_tools_plan_nov2026.md, stage 3): paste a job description, settle its requirements (type them,
 * or let the AI suggest them as one use of the monthly allowance), then see where a résumé mentions each one. No score:
 * a mention is not proof, and a missing word is something to add only if it's true.
 */
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDashed, ListChecks, Plus, Sparkles, Trash2 } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, EmptyState, ErrorBanner, formatDate, PageHeader, SuccessBanner } from "@/components/career/ui";

interface Allowance { limit: number; used: number; left: number; plan: string; resetsAt: string; reason: string | null }
interface Summary { id: string; title: string; company: string | null; requirementCount: number; checkedAt: string | null; updatedAt: string }
interface Result { requirement: string; mentioned: boolean; matchedTerms: string[]; lines: string[] }
interface Check {
  id: string;
  title: string;
  company: string | null;
  jobText: string;
  requirements: string[];
  versionId: string | null;
  checkedAt: string | null;
  results: { mentionedCount: number; requirementCount: number; results: Result[]; note: string } | null;
}
interface Choice { id: string; label: string }

const blank = { title: "", company: "", jobText: "", requirements: "" };

export default function JobCheckPage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [list, setList] = useState<Summary[] | null>(null);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [current, setCurrent] = useState<Check | null>(null);
  const [form, setForm] = useState(blank);
  const [versionId, setVersionId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const failure = async (res: Response) => ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? en("That didn't work. Please try again.");

  const load = useCallback(async () => {
    const [l, a, r] = await Promise.all([apiFetch("/api/resumes/job-checks"), apiFetch("/api/resumes/ai-allowance"), apiFetch("/api/resumes")]);
    setList(l.ok ? ((await l.json()) as Summary[]) : []);
    if (a.ok) setAllowance((await a.json()) as Allowance);
    if (r.ok) {
      const body = (await r.json()) as { resumes: { title: string; currentVersion: { id: string; number: number; textReadable: boolean } | null }[] };
      setChoices(body.resumes.filter((x) => x.currentVersion?.textReadable).map((x) => ({ id: x.currentVersion!.id, label: en("{title}, version {number}", { title: x.title, number: x.currentVersion!.number }) })));
    }
  }, [apiFetch, en]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  const open = (c: Check | null) => {
    setCurrent(c);
    setForm(c ? { title: c.title, company: c.company ?? "", jobText: c.jobText, requirements: c.requirements.join("\n") } : blank);
    setVersionId(c?.versionId ?? choices[0]?.id ?? "");
    setError(null);
    setNotice(null);
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
      return res.status === 204 ? ({} as T) : ((await res.json()) as T);
    } catch {
      setError(en("We couldn't reach the server. Please check your connection and try again."));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const body = () => JSON.stringify({ title: form.title, company: form.company || null, jobText: form.jobText, requirements: form.requirements.split("\n") });

  const save = async () => {
    const saved = await run<Check>("save", () =>
      current ? apiFetch(`/api/resumes/job-checks/${current.id}`, { method: "PUT", body: body() }) : apiFetch("/api/resumes/job-checks", { method: "POST", body: body() }));
    if (saved) {
      setCurrent(saved);
      setNotice(en("Saved."));
      await load();
    }
    return saved;
  };

  const suggest = async () => {
    const res = await run<{ requirements: string[]; dropped: number; usesLeft: number }>("suggest", () =>
      apiFetch("/api/resumes/job-checks/suggest", { method: "POST", body: JSON.stringify({ jobText: form.jobText }) }));
    if (!res) return void load();
    const have = form.requirements.split("\n").map((x) => x.trim()).filter(Boolean);
    const merged = [...have, ...res.requirements.filter((x) => !have.some((h) => h.toLowerCase() === x.toLowerCase()))];
    setForm({ ...form, requirements: merged.join("\n") });
    setNotice(
      res.dropped > 0
        ? en("Added {count} requirements from the job description. {dropped} other suggestions weren't in the description, so they were left out. Check the list before saving.", { count: res.requirements.length, dropped: res.dropped })
        : en("Added {count} requirements from the job description. Check the list before saving.", { count: res.requirements.length }));
    if (allowance) setAllowance({ ...allowance, left: res.usesLeft, used: allowance.limit - res.usesLeft });
  };

  const check = async () => {
    const saved = await save();
    if (!saved || !versionId) return;
    const res = await run<Check>("run", () => apiFetch(`/api/resumes/job-checks/${saved.id}/run`, { method: "POST", body: JSON.stringify({ versionId }) }));
    if (res) {
      setCurrent(res);
      setNotice(null);
      await load();
    }
  };

  const remove = async () => {
    if (!current) return;
    if ((await run("delete", () => apiFetch(`/api/resumes/job-checks/${current.id}`, { method: "DELETE" }))) !== null) {
      open(null);
      setNotice(en("Deleted."));
      await load();
    }
  };

  if (access) return <AccessNotice problem={access} feature="the job check" />;
  const aiOff = !allowance || !!allowance.reason;

  return (
    <div className="space-y-6">
      <Link href="/resumes" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {en("Résumés")}
      </Link>
      <PageHeader
        title={en("Job check")}
        description={en("Paste a job description, list what it asks for, and see where your résumé mentions each requirement. There's no score: a mention isn't proof, and only add what's true.")}
      />
      <ErrorBanner error={error} />
      <SuccessBanner message={notice} />

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside aria-label={en("Saved job checks")} className="space-y-3">
          <Button type="button" variant="secondary" className="w-full justify-center" onClick={() => open(null)}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            {en("New job check")}
          </Button>
          {!list ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-busy="true" />
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">{en("Your saved job checks appear here.")}</p>
          ) : (
            <ul className="space-y-2">
              {list.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-current={current?.id === c.id ? "true" : undefined}
                    className={`w-full rounded-lg border px-3 py-2 text-start text-sm hover:bg-muted/50 ${current?.id === c.id ? "border-primary bg-muted/50" : "border-border"}`}
                    onClick={async () => {
                      const res = await apiFetch(`/api/resumes/job-checks/${c.id}`);
                      if (res.ok) open((await res.json()) as Check);
                    }}
                  >
                    <span className="block font-medium">{c.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[c.company, en("{count} requirements", { count: c.requirementCount }), c.checkedAt ? en("checked {date}", { date: formatDate(c.checkedAt) }) : null].filter(Boolean).join(", ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="space-y-6">
          <section aria-labelledby="job-title" className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 id="job-title" className="text-base font-semibold">{current ? current.title : en("New job check")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">{en("Job title")}</span>
                <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="font-medium">{en("Company (optional)")}</span>
                <input value={form.company} maxLength={120} onChange={(e) => setForm({ ...form, company: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
              </label>
            </div>
            <label className="block text-sm">
              <span className="font-medium">{en("Job description")}</span>
              <textarea value={form.jobText} rows={8} maxLength={20000} onChange={(e) => setForm({ ...form, jobText: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
            </label>
            <div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <label htmlFor="reqs" className="text-sm font-medium">{en("Requirements, one per line")}</label>
                <Button type="button" variant="secondary" busy={busy === "suggest"} disabled={aiOff || form.jobText.trim().length < 40} onClick={() => void suggest()}>
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                  {en("Suggest requirements")}
                </Button>
              </div>
              <textarea id="reqs" value={form.requirements} rows={6} onChange={(e) => setForm({ ...form, requirements: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
                {!allowance
                  ? null
                  : allowance.reason
                    ? allowance.reason
                    : en("AI suggestions use 1 of your {limit} AI uses this month; {left} left. The AI only copies requirements the description states.", { limit: allowance.limit, left: allowance.left })}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
              <label className="block text-sm">
                <span className="font-medium">{en("Check this résumé")}</span>
                <select value={versionId} onChange={(e) => setVersionId(e.target.value)} className="mt-1 block w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2">
                  <option value="">{en("Choose…")}</option>
                  {choices.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
              <Button type="button" busy={busy === "run"} disabled={!versionId} onClick={() => void check()}>
                <ListChecks aria-hidden="true" className="h-4 w-4" />
                {en("Save and check")}
              </Button>
              <Button type="button" variant="secondary" busy={busy === "save"} onClick={() => void save()}>
                {en("Save")}
              </Button>
              {current && (
                <Button type="button" variant="ghost" className="ms-auto px-2 text-muted-foreground" busy={busy === "delete"} onClick={() => void remove()}>
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  {en("Delete")}
                </Button>
              )}
            </div>
            {choices.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {en("Add a résumé we can read (PDF or Word) to your library first.")}{" "}
                <Link href="/resumes" className="font-medium underline">{en("Go to Résumés")}</Link>
              </p>
            )}
          </section>

          {current?.results ? (
            <section aria-labelledby="results-title" className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="results-title" className="text-base font-semibold">
                  {en("{mentioned} of {total} requirements are mentioned", { mentioned: current.results.mentionedCount, total: current.results.requirementCount })}
                </h2>
                {current.checkedAt && <span className="text-xs text-muted-foreground">{en("Checked {date}", { date: formatDate(current.checkedAt) })}</span>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{en("A mention isn't proof, and a missing word is something to add only if it's true.")}</p>
              <ul className="mt-4 divide-y divide-border">
                {current.results.results.map((x) => (
                  <li key={x.requirement} className="flex gap-3 py-3">
                    {x.mentioned ? (
                      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <CircleDashed aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {x.requirement} <Badge tone={x.mentioned ? "good" : "neutral"}>{x.mentioned ? en("Mentioned") : en("Not found")}</Badge>
                      </p>
                      {x.lines.map((l, i) => (
                        <p key={i} className="mt-1 break-words text-sm text-muted-foreground">“{l}”</p>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            !current && (
              <EmptyState title={en("Check your résumé against a job")}>
                <p>{en("Paste the job description, list its requirements (or let the AI suggest them), choose a résumé and press Save and check.")}</p>
              </EmptyState>
            )
          )}
        </div>
      </div>
    </div>
  );
}
