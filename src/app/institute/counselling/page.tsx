"use client";

/**
 * Institute portal: the counselling quiz's question bank, the institute's course catalogue and the inquiries members sent
 * (phase B, 24 Oct 2026; these builders used to sit on the student quiz page). Institute admins edit their own
 * institute's bank and catalogue; counselors read the bank; SuperAdmins also edit the platform question pool, open any
 * institute by id and decide which catalogues are suggested to members of the platform quiz (the marketplace).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";

const CORE_TRACKS = [
  "Distributed Backend & Systems",
  "Cloud, DevOps & SRE",
  "Cybersecurity & Zero-Trust",
  "Modern Frontend & Web Architecture",
  "Data Engineering & AI/MLOps",
  "Product Management & Strategy",
];

interface Option {
  text: string;
  description: string;
  targetTrack: string;
  weight: number;
}
interface Question {
  id: number;
  title: string;
  subtitle: string;
  isActive: boolean;
  options: Option[];
}
interface CourseItem {
  courseId: string;
  instituteId: string;
  instituteName: string;
  courseName: string;
  description: string;
  targetTrack: string;
  credentialType: string;
  duration: string;
  intake: string;
  accreditation: string;
  rank: number;
  isActive: boolean;
  features: string[];
  version: number | null;
}
interface Lead {
  leadId: string;
  courseName: string | null;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  primaryTrack: string;
  notes: string | null;
  referralSource: string | null;
  referredForSelf: boolean;
  status: string;
  createdAt: string;
}

type Tab = "questions" | "courses" | "inquiries";
type ApiFetch = (path: string, init?: RequestInit, options?: { quiet?: boolean }) => Promise<Response>;

const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";
const input = "mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-2 focus:outline-cyan-600";
const button =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50";

const blankCourse = (instituteId: string): CourseItem => ({
  courseId: "",
  instituteId,
  instituteName: "",
  courseName: "",
  description: "",
  targetTrack: CORE_TRACKS[0],
  credentialType: "",
  duration: "",
  intake: "",
  accreditation: "",
  rank: 1,
  isActive: true,
  features: [],
  version: null,
});

export default function InstituteCounsellingPage() {
  const { apiFetch, ready, access, roles } = useLegacyApi();
  const isSuper = roles.includes("SuperAdmin");
  const isAdmin = isSuper || roles.includes("InstituteAdmin");
  const [ownInstitute, setOwnInstitute] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [typedId, setTypedId] = useState("");
  const [scope, setScope] = useState<string | null>(null); // institute id, null = platform pool (SuperAdmin)
  const [tab, setTab] = useState<Tab>("questions");

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/me/overview", {}, { quiet: true });
      const o = res.ok ? ((await res.json()) as { profile?: { organization?: { id: string; name: string } | null } }) : null;
      const org = o?.profile?.organization ?? null;
      setOwnInstitute(org);
      if (org) setScope(org.id);
    } catch {
      setOwnInstitute(null);
    }
  }, [apiFetch]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  if (access) return <AccessNotice problem={access} feature="The counselling builders" />;
  if (ready && !isAdmin && !roles.includes("Counselor"))
    return (
      <section className={`${card} p-6`}>
        <h1 className="text-lg font-semibold">For institute staff</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This is where institute administrators and counselors manage the counselling quiz. To take the quiz, open{" "}
          <Link href="/prep/counselling" className="font-medium text-cyan-700 underline dark:text-cyan-400">
            Career counselling
          </Link>
          .
        </p>
      </section>
    );
  if (ownInstitute === undefined) return <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} aria-busy="true" />;
  if (!isSuper && !ownInstitute)
    return (
      <section className={`${card} p-6`}>
        <h1 className="text-lg font-semibold">No institute on your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ask your institute&apos;s administrator to add you to the institute in Edulexa.</p>
      </section>
    );

  const tabs: { key: Tab; label: string }[] = [
    { key: "questions", label: "Questions" },
    ...(scope ? [{ key: "courses" as Tab, label: "Courses" }] : []),
    ...(isAdmin ? [{ key: "inquiries" as Tab, label: "Inquiries" }] : []),
  ];
  const activeTab = tabs.some((t) => t.key === tab) ? tab : "questions";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Counselling quiz and courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope
              ? `${ownInstitute && scope === ownInstitute.id ? ownInstitute.name : `Institute ${scope}`}: the questions your members answer and the courses suggested with their results.`
              : "The platform question pool: the quiz every member takes unless their institute has its own questions."}
          </p>
        </div>
        {isSuper && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setScope(typedId.trim() || null);
            }}
          >
            <label className="text-xs">
              <span className="font-medium">Institute id (empty for the platform pool)</span>
              <input value={typedId} onChange={(e) => setTypedId(e.target.value)} className={`${input} w-80`} placeholder="00000000-0000-0000-0000-000000000000" />
            </label>
            <button type="submit" className={button}>
              Open
            </button>
          </form>
        )}
      </header>

      <div role="tablist" aria-label="Builder sections" className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={activeTab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${activeTab === t.key ? "border-cyan-600 font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "questions" && <QuestionsTab key={`q-${scope}`} scope={scope} apiFetch={apiFetch} canEdit={isAdmin} />}
      {activeTab === "courses" && scope && <CoursesTab key={`c-${scope}`} scope={scope} apiFetch={apiFetch} canEdit={isAdmin} isSuper={isSuper} />}
      {activeTab === "inquiries" && <InquiriesTab key={`i-${scope}`} scope={scope} apiFetch={apiFetch} />}
    </div>
  );
}

// ------------------------------------------------------------------ questions

function QuestionsTab({ scope, apiFetch, canEdit }: { scope: string | null; apiFetch: ApiFetch; canEdit: boolean }) {
  const query = scope ? `instituteId=${encodeURIComponent(scope)}&` : "";
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [meta, setMeta] = useState<{ version: number; ownBank: boolean; source: string; questionsPerAttempt: number } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setMessage(null);
    const res = await apiFetch(`/api/quiz/counselling/questions?${query}includeInactive=true`, {}, { quiet: true });
    if (!res.ok) {
      setMessage({ text: res.status === 404 ? "You can't open this question bank." : "The questions couldn't be loaded.", error: true });
      setQuestions([]);
      return;
    }
    const body = await res.json();
    setQuestions(body.questions as Question[]);
    setMeta({ version: body.version, ownBank: body.ownBank, source: body.source, questionsPerAttempt: body.questionsPerAttempt });
    setDirty(false);
  }, [apiFetch, query]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    void loadRef.current();
  }, [loadRef]);

  const update = (i: number, change: Partial<Question>) => {
    setQuestions((qs) => qs!.map((q, k) => (k === i ? { ...q, ...change } : q)));
    setDirty(true);
  };
  const updateOption = (i: number, j: number, change: Partial<Option>) =>
    update(i, { options: questions![i].options.map((o, k) => (k === j ? { ...o, ...change } : o)) });

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch(`/api/quiz/counselling/questions?${query}version=${meta?.version ?? 0}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questions),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setMessage({ text: `Saved. ${body.activeCount} of ${body.count} questions are in use.` });
        await load();
      } else if (res.status === 409) setMessage({ text: "Someone else changed these questions meanwhile. Reload them, then make your change again.", error: true });
      else setMessage({ text: body?.error ?? "The questions couldn't be saved.", error: true });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Replace these questions with the platform question pool? Your own questions will be removed.")) return;
    const res = await apiFetch(`/api/quiz/counselling/questions/reset?${query.replace(/&$/, "")}`, { method: "POST" });
    if (res.ok) {
      setMessage({ text: "Replaced with the platform question pool." });
      await load();
    } else setMessage({ text: "That didn't work. Please try again.", error: true });
  };

  if (!questions) return <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} aria-busy="true" />;
  const active = questions.filter((q) => q.isActive).length;

  return (
    <section className="space-y-4">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <p className="text-sm text-muted-foreground">
          {active} active question{active === 1 ? "" : "s"}; each member answers {Math.min(meta?.questionsPerAttempt ?? 15, active)} drawn at random.
          {scope && meta && !meta.ownBank ? " This institute uses the platform question pool until you save your own." : ""}
          {" "}Members never see the areas or weights; give every area the same number of options and weights so none is favoured.
        </p>
        {canEdit && (
          <div className="flex gap-2">
            {scope && (
              <button type="button" className={button} onClick={() => void reset()}>
                <RotateCcw aria-hidden="true" className="h-4 w-4" /> Use the platform pool
              </button>
            )}
            <button
              type="button"
              className={button}
              onClick={() => {
                const id = Math.max(0, ...questions.map((q) => q.id)) + 1;
                setQuestions([...questions, { id, title: "", subtitle: "", isActive: true, options: [0, 1].map((k) => ({ text: "", description: "", targetTrack: CORE_TRACKS[k], weight: 10 })) }]);
                setDirty(true);
              }}
            >
              <Plus aria-hidden="true" className="h-4 w-4" /> Add a question
            </button>
            <button type="button" className={primary} disabled={!dirty || saving} onClick={() => void save()}>
              <Save aria-hidden="true" className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
      {message && (
        <p role="status" className={`text-sm ${message.error ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
          {message.text}
        </p>
      )}
      <datalist id="cq-tracks">
        {CORE_TRACKS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <ol className="space-y-3">
        {questions.map((q, i) => (
          <li key={`${q.id}-${i}`} className={`${card} p-4 ${q.isActive ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start gap-3">
              <span className="mt-2 w-8 text-xs font-semibold text-muted-foreground">#{q.id}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <label className="block text-xs">
                  <span className="font-medium">Question</span>
                  <input value={q.title} disabled={!canEdit} onChange={(e) => update(i, { title: e.target.value })} className={input} />
                </label>
                <label className="block text-xs">
                  <span className="font-medium">Hint (optional)</span>
                  <input value={q.subtitle} disabled={!canEdit} onChange={(e) => update(i, { subtitle: e.target.value })} className={input} />
                </label>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 font-medium">Answer</th>
                      <th className="py-1 font-medium">Points to area</th>
                      <th className="w-20 py-1 font-medium">Weight</th>
                      {canEdit && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {q.options.map((o, j) => (
                      <tr key={j}>
                        <td className="pr-2">
                          <input aria-label={`Answer ${j + 1}`} value={o.text} disabled={!canEdit} onChange={(e) => updateOption(i, j, { text: e.target.value })} className={input} />
                        </td>
                        <td className="pr-2">
                          <input aria-label={`Area of answer ${j + 1}`} list="cq-tracks" value={o.targetTrack} disabled={!canEdit} onChange={(e) => updateOption(i, j, { targetTrack: e.target.value })} className={input} />
                        </td>
                        <td className="pr-2">
                          <input aria-label={`Weight of answer ${j + 1}`} type="number" value={o.weight} disabled={!canEdit} onChange={(e) => updateOption(i, j, { weight: Number(e.target.value) })} className={input} />
                        </td>
                        {canEdit && (
                          <td>
                            <button
                              type="button"
                              aria-label={`Remove answer ${j + 1}`}
                              disabled={q.options.length <= 2}
                              onClick={() => update(i, { options: q.options.filter((_, k) => k !== j) })}
                              className="mt-1 rounded p-1 text-muted-foreground hover:text-red-600 disabled:opacity-30"
                            >
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {canEdit && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      className={button}
                      disabled={q.options.length >= 12}
                      onClick={() => update(i, { options: [...q.options, { text: "", description: "", targetTrack: "", weight: 10 }] })}
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" /> Answer
                    </button>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={q.isActive} onChange={(e) => update(i, { isActive: e.target.checked })} className="h-4 w-4 accent-cyan-700" />
                      In use
                    </label>
                    <button
                      type="button"
                      className={`${button} text-red-700 dark:text-red-400`}
                      onClick={() => {
                        setQuestions(questions.filter((_, k) => k !== i));
                        setDirty(true);
                      }}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------------ courses

function CoursesTab({ scope, apiFetch, canEdit, isSuper }: { scope: string; apiFetch: ApiFetch; canEdit: boolean; isSuper: boolean }) {
  const q = `instituteId=${encodeURIComponent(scope)}`;
  const [courses, setCourses] = useState<CourseItem[] | null>(null);
  const [listed, setListed] = useState(false);
  const [editing, setEditing] = useState<CourseItem | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/quiz/counselling/courses?${q}&includeInactive=true`, {}, { quiet: true });
    if (!res.ok) {
      setMessage({ text: res.status === 404 ? "This institute wasn't found." : "The courses couldn't be loaded.", error: true });
      setCourses([]);
      return;
    }
    const body = await res.json();
    setCourses(body.courses as CourseItem[]);
    setListed(!!body.marketplaceListed);
  }, [apiFetch, q]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    void loadRef.current();
  }, [loadRef]);

  const save = async (c: CourseItem) => {
    const res = await apiFetch(`/api/quiz/counselling/courses?${q}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
    const body = await res.json().catch(() => null);
    if (res.ok) {
      setEditing(null);
      setMessage({ text: body?.message ?? "Saved." });
      await load();
    } else if (res.status === 409) setMessage({ text: "Someone else changed this course meanwhile. Reload and try again.", error: true });
    else setMessage({ text: body?.error ?? "The course couldn't be saved.", error: true });
  };
  const remove = async (c: CourseItem) => {
    if (!window.confirm(`Remove "${c.courseName}" from the catalogue? Inquiries already sent about it are kept.`)) return;
    const res = await apiFetch(`/api/quiz/counselling/courses/${c.courseId}?${q}`, { method: "DELETE" });
    setMessage(res.ok ? { text: "Course removed." } : { text: "That didn't work. Please try again.", error: true });
    await load();
  };
  const toggleListing = async (value: boolean) => {
    const res = await apiFetch(`/api/quiz/counselling/courses/listing?${q}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listed: value }) });
    if (res.ok) setListed(value);
    else setMessage({ text: "The listing couldn't be changed.", error: true });
  };

  if (!courses) return <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} aria-busy="true" />;

  return (
    <section className="space-y-4">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <p className="text-sm text-muted-foreground">
          Active courses are suggested to this institute&apos;s members with their quiz results, best match first.
          {listed ? " They are also suggested to members of the platform quiz." : " They are not suggested to members of other institutes."}
        </p>
        <div className="flex items-center gap-3">
          {isSuper && (
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={listed} onChange={(e) => void toggleListing(e.target.checked)} className="h-4 w-4 accent-cyan-700" />
              Suggest on the platform quiz
            </label>
          )}
          {canEdit && (
            <button type="button" className={primary} onClick={() => setEditing(blankCourse(scope))}>
              <Plus aria-hidden="true" className="h-4 w-4" /> Add a course
            </button>
          )}
        </div>
      </div>
      {message && (
        <p role="status" className={`text-sm ${message.error ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
          {message.text}
        </p>
      )}
      {editing && <CourseForm course={editing} onCancel={() => setEditing(null)} onSave={(c) => void save(c)} />}
      {courses.length === 0 ? (
        <p className={`${card} p-6 text-sm text-muted-foreground`}>No courses yet.{canEdit ? " Add the courses you want members to see." : ""}</p>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Course</th>
                <th className="p-3 font-medium">Area</th>
                <th className="p-3 font-medium">Qualification</th>
                <th className="p-3 font-medium">Status</th>
                {canEdit && <th className="p-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courses.map((c) => (
                <tr key={c.courseId}>
                  <td className="p-3 font-medium">{c.courseName}</td>
                  <td className="p-3 text-muted-foreground">{c.targetTrack}</td>
                  <td className="p-3 text-muted-foreground">{c.credentialType || "—"}</td>
                  <td className="p-3">{c.isActive ? "Shown" : "Hidden"}</td>
                  {canEdit && (
                    <td className="whitespace-nowrap p-3 text-right">
                      <button type="button" className={button} onClick={() => setEditing(c)}>
                        Edit
                      </button>{" "}
                      <button type="button" className={`${button} text-red-700 dark:text-red-400`} onClick={() => void remove(c)}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CourseForm({ course, onCancel, onSave }: { course: CourseItem; onCancel: () => void; onSave: (c: CourseItem) => void }) {
  const [c, setC] = useState<CourseItem>(course);
  const [features, setFeatures] = useState(course.features.join("\n"));
  const set = (change: Partial<CourseItem>) => setC((x) => ({ ...x, ...change }));
  const tracks = useMemo(() => (CORE_TRACKS.includes(c.targetTrack) ? CORE_TRACKS : [...CORE_TRACKS, c.targetTrack]), [c.targetTrack]);
  return (
    <form
      className={`${card} grid gap-3 p-5 sm:grid-cols-2`}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...c, features: features.split("\n").map((f) => f.trim()).filter(Boolean) });
      }}
    >
      <h2 className="text-base font-semibold sm:col-span-2">{course.courseId ? "Edit course" : "New course"}</h2>
      <label className="text-xs sm:col-span-2">
        <span className="font-medium">Name</span>
        <input required value={c.courseName} maxLength={500} onChange={(e) => set({ courseName: e.target.value })} className={input} />
      </label>
      <label className="text-xs sm:col-span-2">
        <span className="font-medium">Description</span>
        <textarea value={c.description} rows={3} maxLength={4000} onChange={(e) => set({ description: e.target.value })} className={input} />
      </label>
      <label className="text-xs">
        <span className="font-medium">Area (matched to quiz results)</span>
        <select value={c.targetTrack} onChange={(e) => set({ targetTrack: e.target.value })} className={input}>
          {tracks.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="font-medium">Qualification (e.g. diploma, certificate)</span>
        <input value={c.credentialType} maxLength={200} onChange={(e) => set({ credentialType: e.target.value })} className={input} />
      </label>
      <label className="text-xs">
        <span className="font-medium">Length</span>
        <input value={c.duration} maxLength={200} onChange={(e) => set({ duration: e.target.value })} className={input} />
      </label>
      <label className="text-xs">
        <span className="font-medium">Next intake</span>
        <input value={c.intake} maxLength={200} onChange={(e) => set({ intake: e.target.value })} className={input} />
      </label>
      <label className="text-xs sm:col-span-2">
        <span className="font-medium">Accreditation (only what you can show members on request)</span>
        <input value={c.accreditation} maxLength={300} onChange={(e) => set({ accreditation: e.target.value })} className={input} />
      </label>
      <label className="text-xs sm:col-span-2">
        <span className="font-medium">Highlights (one per line)</span>
        <textarea value={features} rows={3} onChange={(e) => setFeatures(e.target.value)} className={input} />
      </label>
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={c.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-4 w-4 accent-cyan-700" />
        Shown to members
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className={button} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={primary}>
          <Save aria-hidden="true" className="h-4 w-4" /> Save course
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ inquiries

function InquiriesTab({ scope, apiFetch }: { scope: string | null; apiFetch: ApiFetch }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/quiz/counselling/leads${scope ? `?instituteId=${encodeURIComponent(scope)}` : ""}`, {}, { quiet: true });
    if (!res.ok) {
      setError(res.status === 403 ? "Only the institute's administrators see inquiries." : "The inquiries couldn't be loaded.");
      setLeads([]);
      return;
    }
    setLeads(((await res.json()) as { leads: Lead[] }).leads);
  }, [apiFetch, scope]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    void loadRef.current();
  }, [loadRef]);

  if (!leads) return <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} aria-busy="true" />;
  if (error) return <p className={`${card} p-6 text-sm text-muted-foreground`}>{error}</p>;
  if (leads.length === 0) return <p className={`${card} p-6 text-sm text-muted-foreground`}>No inquiries yet. They appear here when members ask about your courses.</p>;

  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th className="p-3 font-medium">Received</th>
            <th className="p-3 font-medium">From</th>
            <th className="p-3 font-medium">Course</th>
            <th className="p-3 font-medium">Area of their result</th>
            <th className="p-3 font-medium">Question</th>
            <th className="p-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {leads.map((l) => (
            <tr key={l.leadId} className="align-top">
              <td className="whitespace-nowrap p-3 text-muted-foreground">{new Date(l.createdAt).toLocaleDateString()}</td>
              <td className="p-3">
                <span className="block font-medium">{l.candidateName || "—"}</span>
                <a href={`mailto:${l.candidateEmail}`} className="block text-xs text-cyan-700 hover:underline dark:text-cyan-400">
                  {l.candidateEmail}
                </a>
                {l.candidatePhone && <span className="block text-xs text-muted-foreground">{l.candidatePhone}</span>}
                {!l.referredForSelf && <span className="block text-[11px] text-muted-foreground">Referred by staff</span>}
              </td>
              <td className="p-3">{l.courseName ?? "—"}</td>
              <td className="p-3 text-muted-foreground">{l.primaryTrack || "—"}</td>
              <td className="max-w-xs p-3 text-muted-foreground">{l.notes || "—"}</td>
              <td className="p-3">{l.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
