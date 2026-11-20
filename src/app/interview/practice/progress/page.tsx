"use client";

/**
 * Interview practice over time (stage 2, 19 Nov 2026): how your four scoring points have moved, your stories, what happened in
 * real interviews (a debrief brings their questions back into practice), and prep plans before real interviews, with reminders.
 * Only you see this page; stories are never sent to the AI.
 */

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import JobPicker, { type PickedJob } from "@/components/interview/JobPicker";
import { Badge, Button, PageHeader, buttonClass } from "@/components/career/ui";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";

interface ProgressCareer {
  career: string;
  careerName: string;
  sessions: { id: string; createdAt: string; jobTitle: string; round: string; mode?: string; overall: number; status: string }[];
  dimensions: { key: string; label: string; good: string; latest: number | null; previous: number | null; history: number[] }[];
  weakest: string[];
  focuses: { focus: string; level: string; at: string }[];
}
interface Story { id: string; title: string; situation: string; action: string; result: string; learned: string; updatedAt: string }
interface Debrief { id: string; jobTitle: string; company?: string | null; interviewDate?: string | null; questions: { text: string; went: string }[]; createdAt: string }
interface PrepPlan { id: string; jobTitle: string; interviewDate: string; steps: { day: string; round: string; label: string; doneSessionId?: string | null }[] }

// en() where shown
const RESULTS: Record<string, { label: string; tone: "good" | "warn" | "bad" }> = {
  strong: { label: "Strong", tone: "good" },
  "interview-ready": { label: "Interview-ready", tone: "good" },
  "getting-there": { label: "Getting there", tone: "warn" },
  "keep-practicing": { label: "Keep practicing", tone: "bad" },
};
const WENT: Record<string, string> = { badly: "It went badly", okay: "It went okay", good: "It went well" };
const STORY_PARTS: [keyof Story, string, string][] = [
  ["situation", "The situation", "Where you were and what was happening, in a sentence or two"],
  ["action", "What you did", "What you did yourself, step by step"],
  ["result", "How it turned out", "The result, with a number if you have one"],
  ["learned", "What you learned", "What you'd do again, or differently"],
];

export default function PracticeProgressPage() {
  return (
    <Suspense fallback={null}>
      <PracticeProgress />
    </Suspense>
  );
}

function PracticeProgress() {
  const en = useEn();
  const search = useSearchParams();
  const { apiFetch, access, ready } = useLegacyApi();
  const [careers, setCareers] = useState<ProgressCareer[] | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [debriefs, setDebriefs] = useState<Debrief[]>([]);
  const [plans, setPlans] = useState<PrepPlan[]>([]);
  const [editing, setEditing] = useState<Story | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Prep plan form (a campus interview slot can fill it: ?prepDate=…&prepTitle=…)
  const [prepJob, setPrepJob] = useState<PickedJob | null>(() => (search.get("prepTitle") ? { code: null, title: search.get("prepTitle")!.slice(0, 100), family: null } : null));
  const [prepDate, setPrepDate] = useState(() => (search.get("prepDate") ?? "").slice(0, 10));
  // Debrief form
  const [dJob, setDJob] = useState<PickedJob | null>(null);
  const [dCompany, setDCompany] = useState("");
  const [dDate, setDDate] = useState("");
  const [dQuestions, setDQuestions] = useState<{ text: string; went: string }[]>([{ text: "", went: "okay" }]);

  const load = async () => {
    const [p, s, d, pl] = await Promise.all([
      apiFetch("/api/interview/practice/progress", {}, { quiet: true }),
      apiFetch("/api/interview/practice/stories", {}, { quiet: true }),
      apiFetch("/api/interview/practice/debriefs", {}, { quiet: true }),
      apiFetch("/api/interview/practice/prep", {}, { quiet: true }),
    ]);
    setCareers(p.ok ? ((await p.json()) as { careers: ProgressCareer[] }).careers : []);
    if (s.ok) setStories(((await s.json()) as { stories: Story[] }).stories);
    if (d.ok) setDebriefs(((await d.json()) as { debriefs: Debrief[] }).debriefs);
    if (pl.ok) setPlans(((await pl.json()) as { plans: PrepPlan[] }).plans);
  };
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (!ready) return;
    void loadRef.current();
  }, [ready, loadRef]);

  const send = async (path: string, method: string, body?: unknown, done?: string) => {
    setMessage(null);
    const res = await apiFetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }, { quiet: true });
    const out = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setMessage(out?.error ?? en("That didn't work. Please try again."));
      return false;
    }
    if (done) setMessage(done);
    await load();
    return true;
  };

  if (access) return <AccessNotice problem={access} feature="Interview practice" />;
  const dimLabel = (c: ProgressCareer, key: string) => c.dimensions.find((d) => d.key === key)?.label ?? key;

  return (
    <div className="space-y-8">
      <PageHeader
        title={en("Your interview practice")}
        description={en("How you're improving, your stories, and help before and after real interviews. Only you see this page.")}
        actions={<Link href="/interview/practice" className={buttonClass("secondary")}>{en("Practice an interview")}</Link>}
      />
      {message && <p role="status" className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">{message}</p>}

      {/* Progress */}
      <section className="space-y-4" aria-labelledby="progress-h">
        <h2 id="progress-h" className="text-lg font-semibold text-foreground">{en("How you're improving")}</h2>
        {careers === null ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-busy="true" />
        ) : careers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{en("After your first coached interview, your scores show here.")}</p>
        ) : (
          careers.map((c) => (
            <div key={c.career} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold text-foreground">{c.careerName}</h3>
                <span className="text-xs text-muted-foreground">{c.sessions.length === 1 ? en("1 coached interview") : en("{n} coached interviews", { n: c.sessions.length })}</span>
              </div>
              {c.weakest.length > 0 && (
                <p className="text-sm text-foreground">
                  {en("Your next interview will focus on:")} <strong>{c.weakest.map((k) => dimLabel(c, k)).join(en(" and "))}</strong>
                </p>
              )}
              <ul className="grid gap-3 sm:grid-cols-2">
                {c.dimensions.map((d) => {
                  const change = d.latest !== null && d.previous !== null ? Math.round(d.latest - d.previous) : null;
                  return (
                    <li key={d.key} className={`space-y-2 rounded-lg border p-3 ${c.weakest.includes(d.key) ? "border-amber-500/60" : "border-border"}`}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium text-foreground">{d.label}</span>
                        <span className="tabular-nums text-foreground">
                          {d.latest === null ? "–" : Math.round(d.latest)}
                          {change !== null && change !== 0 && (
                            <span className={`ms-1 text-xs ${change > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                              {change > 0 ? `+${change}` : change}
                            </span>
                          )}
                        </span>
                      </div>
                      {d.history.length < 2 ? (
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <div className="h-1.5 rounded-full bg-[var(--brand)]" style={{ width: `${Math.min(100, Math.max(4, d.latest ?? 0))}%` }} />
                        </div>
                      ) : (
                      <div className="flex h-8 items-end gap-1" aria-label={en("Scores over time: {list}", { list: d.history.map((h) => Math.round(h)).join(", ") })}>
                        {d.history.slice(-10).map((h, i) => (
                          <span key={i} className="w-full rounded-sm bg-[var(--brand)]/70" style={{ height: `${Math.max(8, h)}%` }} />
                        ))}
                      </div>
                      )}
                      <p className="text-xs leading-relaxed text-muted-foreground">{d.good}</p>
                    </li>
                  );
                })}
              </ul>
              <ul className="divide-y divide-border text-sm">
                {[...c.sessions].reverse().slice(0, 5).map((s) => {
                  const r = RESULTS[s.status];
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
                      <Link href={`/interview/practice/${s.id}`} className="min-w-0 flex-1 truncate text-foreground hover:underline">{s.jobTitle}</Link>
                      <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</span>
                      {r && <Badge tone={r.tone}>{en(r.label)}</Badge>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* Before a real interview */}
      <section className="space-y-4" aria-labelledby="prep-h">
        <div>
          <h2 id="prep-h" className="text-lg font-semibold text-foreground">{en("Before a real interview")}</h2>
          <p className="text-sm text-muted-foreground">{en("Add the date and the job, and get a short practice for each day until then, with a reminder on the day.")}</p>
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <JobPicker value={prepJob} onChange={setPrepJob} />
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span className="block font-medium text-foreground">{en("Interview date")}</span>
              <input type="date" value={prepDate} onChange={(e) => setPrepDate(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
            </label>
            <Button onClick={() => void send("/api/interview/practice/prep", "POST", { jobTitle: prepJob?.title, jobCode: prepJob?.code, interviewDate: prepDate, utcOffsetMinutes: -new Date().getTimezoneOffset() }, en("Your prep plan is ready."))} disabled={!prepJob || !prepDate}>
              <CalendarDays aria-hidden="true" className="h-4 w-4" />
              {en("Make my prep plan")}
            </Button>
          </div>
        </div>
        {plans.map((p) => (
          <div key={p.id} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">{en("{job}, on {date}", { job: p.jobTitle, date: new Date(p.interviewDate + "T00:00:00").toLocaleDateString() })}</h3>
              <button type="button" onClick={() => void send(`/api/interview/practice/prep/${p.id}`, "DELETE")} aria-label={en("Delete this prep plan")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <ol className="space-y-2">
              {p.steps.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{new Date(s.day + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span className="min-w-0 flex-1 text-foreground">{en(s.label)}</span>
                  {s.doneSessionId ? (
                    <Badge tone="good">{en("Done")}</Badge>
                  ) : (
                    <Link href={`/interview/practice?prep=${p.id}&step=${i}`} className={buttonClass("secondary")}>{en("Practice")}</Link>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      {/* After a real interview */}
      <section className="space-y-4" aria-labelledby="debrief-h">
        <div>
          <h2 id="debrief-h" className="text-lg font-semibold text-foreground">{en("After a real interview")}</h2>
          <p className="text-sm text-muted-foreground">{en("Note the questions you were asked and how each went. Your next practice for this kind of job asks them again, the hardest first.")}</p>
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <JobPicker value={dJob} onChange={setDJob} />
          <div className="flex flex-wrap gap-3">
            <label className="min-w-0 flex-1 space-y-1 text-sm">
              <span className="block font-medium text-foreground">{en("Company (optional, never sent to the AI)")}</span>
              <input value={dCompany} onChange={(e) => setDCompany(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block font-medium text-foreground">{en("Date")}</span>
              <input type="date" value={dDate} onChange={(e) => setDDate(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{en("Questions you were asked")}</legend>
            {dQuestions.map((qq, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <input aria-label={en("Question {n}", { n: i + 1 })} value={qq.text} onChange={(e) => setDQuestions((xs) => xs.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  placeholder={en("e.g. Tell me about a time you disagreed with a manager.")} className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
                <select aria-label={en("How it went")} value={qq.went} onChange={(e) => setDQuestions((xs) => xs.map((x, j) => (j === i ? { ...x, went: e.target.value } : x)))}
                  className="rounded-lg border border-border bg-card px-2 py-2 text-sm text-foreground">
                  {Object.entries(WENT).map(([k, v]) => <option key={k} value={k}>{en(v)}</option>)}
                </select>
              </div>
            ))}
            <button type="button" onClick={() => setDQuestions((xs) => [...xs, { text: "", went: "okay" }])} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)] hover:underline">
              <Plus aria-hidden="true" className="h-4 w-4" />{en("Add another question")}
            </button>
          </fieldset>
          <Button onClick={async () => {
            if (await send("/api/interview/practice/debriefs", "POST", { jobTitle: dJob?.title, jobCode: dJob?.code, company: dCompany, interviewDate: dDate || null, questions: dQuestions.filter((x) => x.text.trim()) }, en("Saved. Your next practice will ask these again."))) {
              setDQuestions([{ text: "", went: "okay" }]); setDCompany("");
            }
          }} disabled={!dJob || !dQuestions.some((x) => x.text.trim())}>{en("Save the debrief")}</Button>
        </div>
        {debriefs.map((d) => (
          <div key={d.id} className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">{[d.jobTitle, d.company, d.interviewDate ? new Date(d.interviewDate).toLocaleDateString() : null].filter(Boolean).join(" · ")}</h3>
              <button type="button" onClick={() => void send(`/api/interview/practice/debriefs/${d.id}`, "DELETE")} aria-label={en("Delete this debrief")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1 text-sm">
              {d.questions.map((qq, i) => (
                <li key={i} className="flex flex-wrap gap-2"><span className="min-w-0 flex-1 text-foreground">{qq.text}</span><span className="text-xs text-muted-foreground">{en(WENT[qq.went] ?? qq.went)}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Stories */}
      <section className="space-y-4" aria-labelledby="stories-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="stories-h" className="text-lg font-semibold text-foreground">{en("Your stories")}</h2>
            <p className="text-sm text-muted-foreground">{en("Real situations you can use in interviews. Save them from your coaching, or write your own. Only you see them, and they're never sent to the AI.")}</p>
          </div>
          <Button variant="secondary" onClick={() => setEditing({ id: "", title: "", situation: "", action: "", result: "", learned: "", updatedAt: "" })}>
            <Plus aria-hidden="true" className="h-4 w-4" />{en("Write a story")}
          </Button>
        </div>
        {editing && (
          <form className="space-y-3 rounded-xl border border-[var(--brand)] bg-card p-5 shadow-sm" onSubmit={async (e) => {
            e.preventDefault();
            const ok = await send(editing.id ? `/api/interview/practice/stories/${editing.id}` : "/api/interview/practice/stories", editing.id ? "PUT" : "POST", editing, en("Story saved."));
            if (ok) setEditing(null);
          }}>
            <label className="block space-y-1 text-sm">
              <span className="block font-medium text-foreground">{en("Title")}</span>
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
            </label>
            {STORY_PARTS.map(([key, label, hint]) => (
              <label key={key} className="block space-y-1 text-sm">
                <span className="block font-medium text-foreground">{en(label)}</span>
                <span className="block text-xs text-muted-foreground">{en(hint)}</span>
                <textarea rows={2} value={String(editing[key] ?? "")} onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
              </label>
            ))}
            <div className="flex gap-2">
              <Button type="submit">{en("Save story")}</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>{en("Cancel")}</Button>
            </div>
          </form>
        )}
        {stories.length === 0 && !editing && <p className="text-sm text-muted-foreground">{en("No stories yet. In your coaching, select \"Save as one of my stories\" on a good answer.")}</p>}
        <ul className="grid gap-3 md:grid-cols-2">
          {stories.map((s) => (
            <li key={s.id} className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{s.title || en("Untitled story")}</h3>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => setEditing(s)} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">{en("Edit")}</button>
                  <button type="button" onClick={() => void send(`/api/interview/practice/stories/${s.id}`, "DELETE")} aria-label={en("Delete this story")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {STORY_PARTS.map(([key, label]) => (s[key] ? <p key={key} className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{en(label)}: </span>{String(s[key])}</p> : null))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
