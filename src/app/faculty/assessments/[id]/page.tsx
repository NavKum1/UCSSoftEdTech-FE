"use client";

/**
 * Build & Defend 1.0 Stage 2 (2.3, 2.4): the assessment builder. Title and instructions, the task (a coding task or an exam for
 * those templates), the rubric (weights add up to 100), the viva (voice, writing or the student's choice; questions; minutes;
 * language), publishing, and giving it to a class with its dates. "new" (?template=coding|exam) creates one once its task is
 * chosen. Once students have started, the task, rubric and viva are locked. 2.12: a project or coding assessment can add a change
 * task (a small change to the student's own code, before the viva), which adds its rubric criterion.
 * API: /api/career/class-assessments/faculty/...
 */
import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad } from "@/components/career/ui";
import {
  CA_API,
  formatWhen,
  toLocalInput,
  type AssessmentDetail,
  type ClassSummary,
  type Criterion,
  type TaskChoices,
  type Template,
  type TemplateInfo,
  type VivaMode,
  withChangeCriterion,
  CHANGE_CRITERION_KEY,
} from "@/components/career/classAssessments/types";
import { useTemplateNames, useVivaModeNames } from "@/components/career/classAssessments/names";

interface Templates {
  templates: TemplateInfo[];
  voice: { defaultLanguage: string; languages: { key: string; label: string }[] };
}

type Draft = Omit<AssessmentDetail, "id" | "status" | "canEdit" | "locked" | "assignments">;

export default function AssessmentBuilderPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AssessmentBuilder />
    </Suspense>
  );
}

function AssessmentBuilder() {
  const en = useEn();
  const api = useApi();
  const router = useRouter();
  const search = useSearchParams();
  const { schoolId } = useCareerShell();
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const names = useTemplateNames();
  const vivaNames = useVivaModeNames();

  const meta = useLoad(() => api<Templates>(`${CA_API}/faculty/templates`), [api, schoolId]);
  const choices = useLoad(() => api<TaskChoices>(`${CA_API}/faculty/task-choices`), [api, schoolId]);
  const classes = useLoad(() => api<{ classes: ClassSummary[] }>(`${CA_API}/faculty/classes`), [api, schoolId]);
  const saved = useLoad(() => (isNew ? Promise.resolve(null) : api<AssessmentDetail>(`${CA_API}/faculty/assessments/${id}`)), [api, id, schoolId]);

  // The teacher's unsaved edits; without any, the form shows the saved assessment (or, new, the template)
  const [edits, setEdits] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [assign, setAssign] = useState({ classId: "", opensAt: "", dueAt: "", acceptLate: true });

  const template = (search.get("template") as Template) || "coding";
  const startTitle = search.get("title") ?? "";
  const base = useMemo<Draft | null>(() => {
    if (saved.data) {
      const s = saved.data;
      return {
        title: s.title, instructions: s.instructions, template: s.template, sprintId: s.sprintId, examId: s.examId, rubric: s.rubric,
        vivaMode: s.vivaMode, vivaQuestions: s.vivaQuestions, vivaMinutes: s.vivaMinutes, vivaLanguage: s.vivaLanguage,
        changeTask: s.changeTask, changeTaskMinutes: s.changeTaskMinutes, issuesCredential: s.issuesCredential,
      };
    }
    if (!isNew || !meta.data) return null;
    return {
      title: startTitle, instructions: "", template, sprintId: null, examId: null,
      rubric: meta.data.templates.find((x) => x.key === template)?.rubric ?? [],
      vivaMode: "voice", vivaQuestions: 5, vivaMinutes: 15, vivaLanguage: null, changeTask: false, changeTaskMinutes: 20, issuesCredential: true,
    };
  }, [saved.data, meta.data, isNew, template, startTitle]);
  const draft = edits ?? base;
  const setDraft = (f: (d: Draft | null) => Draft | null) => setEdits(f(draft));

  const a = saved.data;
  const archived = a?.status === "Archived";
  const readOnly = !!a && (!a.canEdit || archived);
  const locked = !!a?.locked;
  const total = useMemo(() => (draft?.rubric ?? []).reduce((s, c) => s + (Number(c.weight) || 0), 0), [draft]);

  const fail = (e: unknown) =>
    setError(e instanceof TypeError ? en("We couldn't reach the server. Please check your connection and try again.") : (e as Error).message);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const setCriterion = (i: number, patch: Partial<Criterion>) =>
    setDraft((d) => (d ? { ...d, rubric: d.rubric.map((c, j) => (j === i ? { ...c, ...patch } : c)) } : d));

  const save = async () => {
    if (!draft) return;
    setBusy("save");
    setError(null);
    setMessage(null);
    const body = {
      title: draft.title,
      instructions: draft.instructions,
      template: draft.template,
      // 2.9: not part of how students are assessed, so it can change after students have started
      issuesCredential: draft.issuesCredential,
      ...(locked
        ? {}
        : {
            sprintId: draft.template === "coding" ? draft.sprintId : undefined,
            examId: draft.template === "exam" ? draft.examId : undefined,
            rubric: draft.rubric.map((c) => ({ key: c.key || undefined, name: c.name, description: c.description, weight: Number(c.weight) })),
            vivaMode: draft.vivaMode,
            vivaQuestions: draft.vivaQuestions,
            vivaMinutes: draft.vivaMinutes,
            vivaLanguage: draft.vivaLanguage ?? "",
            // 2.12: an exam has no code to change
            changeTask: draft.template !== "exam" && draft.changeTask,
            changeTaskMinutes: draft.changeTaskMinutes,
          }),
    };
    try {
      if (isNew) {
        const created = await api<AssessmentDetail>(`${CA_API}/faculty/assessments`, { json: body });
        router.replace(`/faculty/assessments/${created.id}`);
        return;
      }
      saved.setData(await api<AssessmentDetail>(`${CA_API}/faculty/assessments/${id}`, { method: "PUT", json: body }));
      setEdits(null);
      setMessage(en("Saved."));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    setBusy("publish");
    setError(null);
    setMessage(null);
    try {
      saved.setData(await api<AssessmentDetail>(`${CA_API}/faculty/assessments/${id}/publish`, { method: "POST" }));
      setMessage(en("Published. Give it to a class below."));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const giveToClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("assign");
    setError(null);
    setMessage(null);
    try {
      const r = await api<{ emailWhen: "now" | "opens"; opensAt: string; assessment: AssessmentDetail }>(`${CA_API}/faculty/assessments/${id}/assign`, {
        json: {
          classId: assign.classId,
          opensAt: assign.opensAt ? new Date(assign.opensAt).toISOString() : undefined,
          dueAt: assign.dueAt ? new Date(assign.dueAt).toISOString() : undefined,
          acceptLate: assign.acceptLate,
        },
      });
      saved.setData(r.assessment);
      setAssign({ classId: "", opensAt: "", dueAt: "", acceptLate: true });
      setMessage(
        r.emailWhen === "now"
          ? en("Given to the class. The students are being e-mailed now.")
          : en("Given to the class. The students will be e-mailed when it opens on {when}.", { when: formatWhen(r.opensAt) }),
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const archive = async () => {
    if (!window.confirm(en("Archive this assessment? It leaves your list; you can restore it from the archived ones."))) return;
    setBusy("archive");
    setError(null);
    setMessage(null);
    try {
      const url = `${CA_API}/faculty/assessments/${id}/archive`;
      const r = await api<{ archived: boolean; resubmissionsWaiting?: number }>(url, { method: "POST" });
      // 2.8: students asked to resubmit who haven't started again lose that chance; the teacher confirms, and they're told
      if (!r.archived) {
        const n = r.resubmissionsWaiting ?? 0;
        const ok = window.confirm(
          n === 1
            ? en("One student was asked to resubmit and hasn't started again. Archiving closes the assessment for them too, and they're told. Archive anyway?")
            : en("{count} students were asked to resubmit and haven't started again. Archiving closes the assessment for them too, and they're told. Archive anyway?", { count: n }),
        );
        if (!ok) {
          setBusy(null);
          return;
        }
        await api(`${url}?confirm=true`, { method: "POST" });
      }
      router.push("/faculty/assessments?archived=1");
    } catch (e) {
      fail(e);
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy("restore");
    setError(null);
    setMessage(null);
    try {
      saved.setData(await api<AssessmentDetail>(`${CA_API}/faculty/assessments/${id}/restore`, { method: "POST" }));
      setMessage(en("Restored."));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const takeBack = async (assignmentId: string, className: string) => {
    if (!window.confirm(en("Take this assessment back from {name}?", { name: className }))) return;
    setBusy(assignmentId);
    try {
      await api(`${CA_API}/faculty/assessments/${id}/assignments/${assignmentId}`, { method: "DELETE" });
      saved.reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  if (meta.loading || saved.loading || !draft) return saved.error ? <ErrorBanner error={saved.error} onRetry={saved.reload} /> : <Loading />;

  const assignedIds = new Set((a?.assignments ?? []).map((x) => x.classId));
  const freeClasses = (classes.data?.classes ?? []).filter((c) => !assignedIds.has(c.id));
  const disabledHow = readOnly || locked;

  return (
    <div>
      <PageHeader
        title={isNew ? en("New assessment") : draft.title || en("Assessment")}
        description={names[draft.template]}
        actions={
          a && (
            <Badge tone={a.status === "Published" ? "good" : "neutral"}>
              {a.status === "Published" ? en("Published") : a.status === "Archived" ? en("Archived") : en("Draft")}
            </Badge>
          )
        }
      />
      <p className="mb-4 text-sm">
        <Link href="/faculty/assessments" className="underline-offset-2 hover:underline">
          {en("All assessments")}
        </Link>
      </p>
      <ErrorBanner error={error} />
      <SuccessBanner message={message} />
      {archived && a?.canEdit && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <span>{en("This assessment is archived. Restore it to change it or give it to a class.")}</span>
          <Button variant="secondary" busy={busy === "restore"} onClick={() => void restore()}>
            {en("Restore")}
          </Button>
        </div>
      )}
      {readOnly && !archived && <p className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">{en("You can see this assessment because it's given to your class. Only its owner or a school admin can change it.")}</p>}
      {locked && !readOnly && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {en("Students have started this assessment, so its task, rubric and viva are locked (everyone is assessed the same way). You can still edit the title, the instructions and whether a pass issues a credential.")}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={en("Details")}>
            <div className="space-y-3">
              <Field label={en("Title")}>{(p) => <input {...p} value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={200} disabled={readOnly} />}</Field>
              <Field label={en("Instructions for students")} hint={en("What to submit, what the viva covers, and anything they should prepare.")}>
                {(p) => <textarea {...p} rows={6} value={draft.instructions} onChange={(e) => set("instructions", e.target.value)} maxLength={8000} disabled={readOnly} />}
              </Field>
              {draft.template === "coding" && (
                <Field label={en("Coding task")} hint={en("Your school's coding tasks and the public ones.")}>
                  {(p) => (
                    <select {...p} value={draft.sprintId ?? ""} onChange={(e) => set("sprintId", e.target.value || null)} disabled={disabledHow}>
                      <option value="">{en("Choose a coding task")}</option>
                      {(choices.data?.codingTasks ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.language})
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              )}
              {draft.template === "exam" && (
                <Field label={en("Written exam")} hint={en("Exams from Edulexa, your school, and ones you created.")}>
                  {(p) => (
                    <select {...p} value={draft.examId ?? ""} onChange={(e) => set("examId", e.target.value || null)} disabled={disabledHow}>
                      <option value="">{en("Choose an exam")}</option>
                      {(choices.data?.exams ?? []).map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.title} ({en("{minutes} min", { minutes: x.durationMinutes })})
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              )}
            </div>
          </Card>

          <Card
            title={en("Rubric")}
            actions={
              <span className={`text-sm font-medium tabular-nums ${total === 100 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`} role="status">
                {en("Weights: {total} of 100", { total })}
              </span>
            }
          >
            <p className="mb-3 text-sm text-muted-foreground">{en("After the viva, the AI suggests a score for each criterion with its reason. You decide the final scores.")}</p>
            <div className="space-y-3">
              {draft.rubric.map((c, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_7rem_auto] sm:items-start">
                  <div className="space-y-2">
                    <Field label={en("Criterion {n}", { n: i + 1 })}>
                      {(p) => <input {...p} value={c.name} onChange={(e) => setCriterion(i, { name: e.target.value })} maxLength={80} disabled={disabledHow} />}
                    </Field>
                    <Field label={en("What a strong answer shows")}>
                      {(p) => <textarea {...p} rows={2} value={c.description} onChange={(e) => setCriterion(i, { description: e.target.value })} maxLength={400} disabled={disabledHow} />}
                    </Field>
                  </div>
                  <Field label={en("Weight")}>
                    {(p) => (
                      <input {...p} type="number" min={5} max={80} value={c.weight} onChange={(e) => setCriterion(i, { weight: Number(e.target.value) })} disabled={disabledHow} />
                    )}
                  </Field>
                  {!disabledHow && draft.rubric.length > 2 && (
                    <Button
                      variant="ghost"
                      className="sm:mt-6"
                      onClick={() => set("rubric", draft.rubric.filter((_, j) => j !== i))}
                      aria-label={en("Remove criterion {n}", { n: i + 1 })}
                    >
                      {en("Remove")}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {!disabledHow && draft.rubric.length < 8 && (
              <Button variant="secondary" className="mt-3" onClick={() => set("rubric", [...draft.rubric, { key: "", name: "", description: "", weight: 10 }])}>
                {en("Add a criterion")}
              </Button>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={en("Viva")}>
            <div className="space-y-3">
              <fieldset className="space-y-1.5">
                <legend className="mb-1 text-sm font-medium">{en("How students answer")}</legend>
                {(["voice", "text", "choice"] as VivaMode[]).map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="vivaMode" checked={draft.vivaMode === m} onChange={() => set("vivaMode", m)} disabled={disabledHow} />
                    {vivaNames[m]}
                  </label>
                ))}
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <Field label={en("Questions")}>
                  {(p) => <input {...p} type="number" min={3} max={10} value={draft.vivaQuestions} onChange={(e) => set("vivaQuestions", Number(e.target.value))} disabled={disabledHow} />}
                </Field>
                <Field label={en("Minutes")}>
                  {(p) => <input {...p} type="number" min={5} max={30} value={draft.vivaMinutes} onChange={(e) => set("vivaMinutes", Number(e.target.value))} disabled={disabledHow} />}
                </Field>
              </div>
              <Field label={en("Language")} hint={en("Students are judged on understanding, never on accent or grammar.")}>
                {(p) => (
                  <select {...p} value={draft.vivaLanguage ?? ""} onChange={(e) => set("vivaLanguage", e.target.value || null)} disabled={disabledHow}>
                    <option value="">{en("Each student's own choice")}</option>
                    {(meta.data?.voice.languages ?? []).map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </Card>

          {draft.template !== "exam" && (
            <Card title={en("Change task")}>
              <div className="space-y-3 text-sm">
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={draft.changeTask}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setDraft((d) => (d ? { ...d, changeTask: on, rubric: withChangeCriterion(d.rubric, on) } : d));
                    }}
                    disabled={disabledHow}
                    aria-describedby="change-hint"
                  />
                  <span>
                    <span className="block font-medium">{en("Ask for a small change to their own code")}</span>
                    <span id="change-hint" className="block text-muted-foreground">
                      {en("After the hand-in, the AI writes one short change request from the student's own code, checked by hidden tests. They make it in the coding workspace without the AI assistant, then the viva asks about it. Python, JavaScript and TypeScript; for other code the student goes straight to the viva and you see why.")}
                    </span>
                  </span>
                </label>
                {draft.changeTask && (
                  <>
                    <Field label={en("Minutes for the change")}>
                      {(p) => (
                        <input {...p} type="number" min={10} max={60} value={draft.changeTaskMinutes} onChange={(e) => set("changeTaskMinutes", Number(e.target.value))} disabled={disabledHow} />
                      )}
                    </Field>
                    <p className="text-muted-foreground">
                      {draft.rubric.some((c) => c.key === CHANGE_CRITERION_KEY)
                        ? en("The rubric now has \"Changes their own code\" (15%). You can edit or remove it.")
                        : en("The rubric has no criterion for the change. A rubric has at most 8 criteria; to judge the change, make room and add one.")}
                    </p>
                  </>
                )}
              </div>
            </Card>
          )}

          <Card title={en("Credential")}>
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.issuesCredential}
                onChange={(e) => set("issuesCredential", e.target.checked)}
                disabled={readOnly}
                aria-describedby="credential-hint"
              />
              <span>
                <span className="block font-medium">{en("Issue a credential when a student passes")}</span>
                <span id="credential-hint" className="block text-muted-foreground">
                  {en("A signed credential goes to the student's wallet when a teacher passes their work. Turn it off for practice or homework. Credentials already issued stay.")}
                </span>
              </span>
            </label>
          </Card>

          {!readOnly && (
            <Card>
              <div className="space-y-2">
                <Button busy={busy === "save"} onClick={() => void save()} className="w-full">
                  {isNew ? en("Create assessment") : en("Save changes")}
                </Button>
                {a && a.status === "Draft" && (
                  <Button variant="secondary" busy={busy === "publish"} onClick={() => void publish()} className="w-full">
                    {en("Publish")}
                  </Button>
                )}
                {a && (
                  <Button variant="ghost" busy={busy === "archive"} onClick={() => void archive()} className="w-full">
                    {en("Archive")}
                  </Button>
                )}
              </div>
            </Card>
          )}

          {a && a.status === "Published" && (
            <Card title={en("Classes")}>
              {a.assignments.length > 0 && (
                <ul className="mb-4 divide-y divide-border text-sm">
                  {a.assignments.map((x) => (
                    <li key={x.id} className="flex items-start justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <Link href={`/faculty/classes/${x.classId}`} className="font-medium underline-offset-2 hover:underline">
                          {x.className}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {en("Due {when}", { when: formatWhen(x.dueAt) })}
                          {!x.acceptLate && " · " + en("no late work")}
                        </span>
                        <Link href={`/faculty/assessments/${a.id}/classes/${x.id}`} className="mt-1 inline-block text-xs font-medium underline underline-offset-2 hover:decoration-2">
                          {en("Students and their work")}
                        </Link>
                      </span>
                      {!readOnly && (
                        <Button variant="ghost" className="shrink-0 whitespace-nowrap" busy={busy === x.id} onClick={() => void takeBack(x.id, x.className)}>
                          {en("Take back")}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!readOnly &&
                (freeClasses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {en("Every one of your classes has it.")}{" "}
                    <Link href="/faculty/classes" className="underline">
                      {en("Create a class")}
                    </Link>
                  </p>
                ) : (
                  <form onSubmit={giveToClass} className="space-y-3">
                    <Field label={en("Give it to")}>
                      {(p) => (
                        <select {...p} value={assign.classId} onChange={(e) => setAssign({ ...assign, classId: e.target.value })} required>
                          <option value="">{en("Choose a class")}</option>
                          {freeClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({en("{count} students", { count: c.students })})
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                    <Field label={en("Opens (optional)")} hint={en("Leave empty to open now.")}>
                      {(p) => <input {...p} type="datetime-local" value={assign.opensAt} onChange={(e) => setAssign({ ...assign, opensAt: e.target.value })} />}
                    </Field>
                    <Field label={en("Due")}>
                      {(p) => (
                        <input {...p} type="datetime-local" value={assign.dueAt} min={toLocalInput(new Date().toISOString())} onChange={(e) => setAssign({ ...assign, dueAt: e.target.value })} required />
                      )}
                    </Field>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={assign.acceptLate} onChange={(e) => setAssign({ ...assign, acceptLate: e.target.checked })} />
                      {en("Accept late work (marked late)")}
                    </label>
                    <Button type="submit" busy={busy === "assign"} className="w-full">
                      {en("Give to class")}
                    </Button>
                    <p className="text-xs text-muted-foreground">{en("Students are e-mailed when you give it to the class.")}</p>
                  </form>
                ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
