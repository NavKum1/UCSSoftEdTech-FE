"use client";

/**
 * The guidance form builder. Questions: sections (steps) and questions of every type, dragged or moved to reorder, each
 * with help text, options, limits, "show only if" logic and CRM rules (tag, assign, high priority), plus the question
 * bank. Settings: texts, branding, contact fields, languages, public link. Translations: every text side by side.
 * Share: link, campaign links, embed code, QR code. Insights: visits, starts, completions, where people stop. A live
 * preview sits beside the questions. Changes save as a draft automatically; Publish makes them live as a new version.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  GitBranch,
  GripVertical,
  Monitor,
  Plus,
  Smartphone,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import GuidanceForm from "@/components/guidance/form/GuidanceForm";
import {
  KIND_LABEL,
  KINDS,
  newId,
  WITH_OPTIONS,
  type Condition,
  type FormDef,
  type Kind,
  type Question,
  type Rule,
  type Section,
} from "@/components/guidance/form/model";
import ShareTab from "./ShareTab";
import InsightsTab from "./InsightsTab";
import TranslationsTab from "./TranslationsTab";

interface View {
  id: string;
  instituteId: string;
  name: string;
  isDefault: boolean;
  publicEnabled: boolean;
  version: number;
  publishedAt: string;
  hasDraft: boolean;
  published: FormDef;
  draft: FormDef | null;
  link: string;
}

type Tab = "questions" | "settings" | "translations" | "share" | "insights";
const TABS: [Tab, string][] = [
  ["questions", "Questions"],
  ["settings", "Settings"],
  ["translations", "Translations"],
  ["share", "Share"],
  ["insights", "Insights"],
];

export const input = "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20";
const small = "rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-40";

/** Fill in fields the API may leave out */
function normalise(d: FormDef): FormDef {
  return {
    languages: d.languages?.length ? d.languages : ["en"],
    sections: (d.sections ?? []).map((s) => ({ ...s, translations: s.translations ?? {} })),
    questions: (d.questions ?? []).map((q) => ({ ...q, options: q.options ?? [], rules: q.rules ?? [], translations: q.translations ?? {}, required: !!q.required })),
    settings: {
      ...(d.settings ?? {}),
      askUnsure: d.settings?.askUnsure ?? true,
      askPhone: d.settings?.askPhone ?? true,
      phoneRequired: d.settings?.phoneRequired ?? false,
      translations: d.settings?.translations ?? {},
    },
  };
}

export default function FormBuilder({ formId, backHref }: { formId: string; backHref: string }) {
  const params = useSearchParams();
  const { apiFetch, ready, access } = useLegacyApi();
  const [view, setView] = useState<View | null>(null);
  const [def, setDef] = useState<FormDef | null>(null);
  const [name, setName] = useState("");
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "questions");
  const [team, setTeam] = useState<{ id: string; name: string }[]>([]);
  const [languages, setLanguages] = useState<{ code: string; name: string }[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [bank, setBank] = useState<{ topic: string; questions: Question[] }[]>([]);
  const [status, setStatus] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const editVersion = useRef(0);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/guidance-forms/${formId}`);
    if (!res.ok) return setNotice({ ok: false, text: "This form couldn't be loaded." });
    const v = (await res.json()) as View;
    setView(v);
    setDef(normalise(v.draft ?? v.published));
    setName(v.name);
    setStatus("saved");
    const [list, t] = await Promise.all([apiFetch(`/api/guidance-forms?instituteId=${v.instituteId}`), apiFetch("/api/guidance-forms/templates")]);
    if (list.ok) {
      const d = await list.json();
      setTeam(d.team);
      setLanguages(d.languages);
      setCanEdit(d.canEdit);
    }
    if (t.ok) setBank((await t.json()).bank);
  }, [apiFetch, formId]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) loadRef.current();
  }, [ready, loadRef]);

  // Autosave the draft a moment after each change
  const save = useCallback(
    async (d: FormDef, n: string) => {
      const mine = editVersion.current;
      setStatus("saving");
      const res = await apiFetch(`/api/guidance-forms/${formId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ definition: d, name: n }) });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus("error");
        setNotice({ ok: false, text: body?.error ?? "Your changes couldn't be saved." });
        return false;
      }
      setView((v) => (v ? { ...v, hasDraft: body.hasDraft, name: body.name } : v));
      if (mine === editVersion.current) setStatus("saved");
      setNotice((x) => (x && !x.ok ? null : x));
      return true;
    },
    [apiFetch, formId],
  );
  useEffect(() => {
    if (status !== "dirty" || !def) return;
    const t = setTimeout(() => save(def, name), 1200);
    return () => clearTimeout(t);
  }, [status, def, name, save]);

  const change = (d: FormDef) => {
    editVersion.current++;
    setDef(d);
    setStatus("dirty");
  };

  const publish = async () => {
    if (!def) return;
    if (status !== "saved" && !(await save(def, name))) return;
    const res = await apiFetch(`/api/guidance-forms/${formId}/publish`, { method: "POST" });
    const body = await res.json().catch(() => null);
    if (!res.ok) return setNotice({ ok: false, text: body?.error ?? "The form couldn't be published." });
    setView(body);
    setNotice({ ok: true, text: `Published as version ${body.version}. New visitors see it now; earlier inquiries keep the questions as they were asked.` });
  };

  const discard = async () => {
    if (!window.confirm("Throw away your unpublished changes and go back to the published form?")) return;
    await apiFetch(`/api/guidance-forms/${formId}/discard-draft`, { method: "POST" });
    load();
    setNotice({ ok: true, text: "Changes discarded." });
  };

  const setPublic = async (on: boolean) => {
    const res = await apiFetch(`/api/guidance-forms/${formId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicEnabled: on }) });
    if (res.ok) setView((v) => (v ? { ...v, publicEnabled: on } : v));
  };

  if (access) return <AccessNotice problem={access} />;
  if (!view || !def) return <div className="h-64 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />;
  const readOnly = !canEdit;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link href={backHref} aria-label="All forms" className="rounded-lg p-1.5 hover:bg-muted">
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
          <input
            value={name}
            readOnly={readOnly}
            maxLength={120}
            aria-label="Form name"
            onChange={(e) => {
              setName(e.target.value);
              editVersion.current++;
              setStatus("dirty");
            }}
            className="min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-semibold hover:border-border focus:border-cyan-600 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground" role="status">
            {status === "saving" ? "Saving…" : status === "dirty" ? "Unsaved changes" : status === "error" ? "Not saved" : view.hasDraft ? "Draft saved, not published" : `Published · version ${view.version}`}
          </span>
          {canEdit && view.hasDraft && (
            <button type="button" onClick={discard} className={small}>
              Discard changes
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={publish}
              disabled={!view.hasDraft && status === "saved"}
              className="rounded-lg bg-cyan-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-50"
            >
              Publish
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p role={notice.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${notice.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-800 dark:text-red-300"}`}>
          {notice.text}
        </p>
      )}

      <div role="tablist" aria-label="Form" className="flex gap-5 overflow-x-auto border-b border-border text-sm">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 ${tab === k ? "border-cyan-600 font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === "questions" || tab === "settings") && (
        <div className="grid gap-6 xl:grid-cols-[1fr,26rem]">
          <div className="min-w-0">
            {tab === "questions" ? (
              <QuestionsEditor def={def} onChange={change} team={team} bank={bank} open={open} setOpen={setOpen} readOnly={readOnly} isPlatform={view.instituteId === "ceacdd2c-975f-41fd-959e-cc530240931c"} />
            ) : (
              <SettingsEditor def={def} onChange={change} languages={languages} readOnly={readOnly} publicEnabled={view.publicEnabled} setPublic={setPublic} isDefault={view.isDefault} />
            )}
          </div>
          <aside className="xl:sticky xl:top-20 xl:self-start">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Live preview (nothing is sent)</p>
              <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Preview size">
                <button type="button" aria-pressed={device === "phone"} onClick={() => setDevice("phone")} className={`rounded-md p-1.5 ${device === "phone" ? "bg-muted" : ""}`} aria-label="Phone">
                  <Smartphone aria-hidden="true" className="h-4 w-4" />
                </button>
                <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} className={`rounded-md p-1.5 ${device === "desktop" ? "bg-muted" : ""}`} aria-label="Wide">
                  <Monitor aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className={`mx-auto max-h-[75vh] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-sm ${device === "phone" ? "max-w-[375px]" : ""}`}>
              <GuidanceForm
                fill={{ formId: view.id, name, version: view.version, instituteId: view.instituteId, instituteName: "your institute", definition: def, languageNames: Object.fromEntries(languages.map((l) => [l.code, l.name])) }}
                mode="preview"
                consentText="Send this to your institute so an advisor can contact me."
                onSubmit={async () => null}
              />
            </div>
          </aside>
        </div>
      )}
      {tab === "translations" && <TranslationsTab def={def} onChange={change} languages={languages} readOnly={readOnly} />}
      {tab === "share" && <ShareTab view={view} setPublic={setPublic} canEdit={canEdit} />}
      {tab === "insights" && <InsightsTab formId={view.id} apiFetch={apiFetch} instituteId={view.instituteId} />}
    </div>
  );
}

// ------------------------------------------------------------------ questions

function QuestionsEditor({
  def,
  onChange,
  team,
  bank,
  open,
  setOpen,
  readOnly,
  isPlatform,
}: {
  def: FormDef;
  onChange: (d: FormDef) => void;
  team: { id: string; name: string }[];
  bank: { topic: string; questions: Question[] }[];
  open: string | null;
  setOpen: (id: string | null) => void;
  readOnly: boolean;
  isPlatform: boolean;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [bankFor, setBankFor] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);

  const ordered = useMemo(() => def.sections.flatMap((s) => def.questions.filter((q) => q.sectionId === s.id)), [def]);
  const setQuestions = (qs: Question[]) => onChange({ ...def, questions: qs });
  const updateQ = (id: string, patch: Partial<Question>) => setQuestions(def.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const addQuestion = (sectionId: string, kind: Kind, from?: Question) => {
    const q: Question = from
      ? { ...from, id: newId(), sectionId, showIf: null, rules: [], translations: {} }
      : {
          id: newId(),
          sectionId,
          kind,
          label: kind === "info" ? "Something people should know" : kind === "consent" ? "I agree to be contacted about courses" : "New question",
          required: kind === "consent",
          options: WITH_OPTIONS.includes(kind) ? ["Option 1", "Option 2"] : [],
          min: kind === "scale" ? 1 : null,
          max: kind === "scale" ? 5 : kind === "file" ? 1 : null,
          rules: [],
          translations: {},
        };
    setQuestions([...def.questions, q]);
    setOpen(q.id);
    setAdding(null);
    setBankFor(null);
  };

  /** Moves a question before another one (or to the end of a section) */
  const moveTo = (id: string, beforeId: string | null, sectionId: string) => {
    const q = def.questions.find((x) => x.id === id);
    if (!q || id === beforeId) return;
    const rest = ordered.filter((x) => x.id !== id);
    const moved = { ...q, sectionId };
    const at = beforeId ? rest.findIndex((x) => x.id === beforeId) : rest.map((x) => x.sectionId).lastIndexOf(sectionId) + 1;
    rest.splice(at < 0 ? rest.length : at, 0, moved);
    setQuestions(rest);
  };

  const step = (id: string, dir: -1 | 1) => {
    const i = ordered.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    const other = ordered[j];
    if (other.sectionId !== ordered[i].sectionId) {
      // Into the next/previous section
      const list = [...ordered];
      list[i] = { ...ordered[i], sectionId: other.sectionId };
      setQuestions(list);
      return;
    }
    const list = [...ordered];
    [list[i], list[j]] = [list[j], list[i]];
    setQuestions(list);
  };

  const removeQ = (id: string) => {
    const dependants = def.questions.filter((x) => x.showIf?.questionId === id).length + def.sections.filter((s) => s.showIf?.questionId === id).length;
    if (dependants && !window.confirm(`${dependants} question(s) or section(s) depend on this one; their condition will be removed. Delete it?`)) return;
    onChange({
      ...def,
      questions: def.questions.filter((x) => x.id !== id).map((x) => (x.showIf?.questionId === id ? { ...x, showIf: null } : x)),
      sections: def.sections.map((s) => (s.showIf?.questionId === id ? { ...s, showIf: null } : s)),
    });
  };

  const updateS = (id: string, patch: Partial<Section>) => onChange({ ...def, sections: def.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const addSection = () => onChange({ ...def, sections: [...def.sections, { id: newId(), title: `Step ${def.sections.length + 1}`, translations: {} }] });
  const moveSection = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= def.sections.length) return;
    const list = [...def.sections];
    [list[i], list[j]] = [list[j], list[i]];
    // Questions keep their order inside sections; conditions that would now look forward are removed by the server's check
    onChange({ ...def, sections: list });
  };
  const removeSection = (id: string) => {
    if (def.sections.length === 1) return;
    const i = def.sections.findIndex((s) => s.id === id);
    const target = def.sections[i === 0 ? 1 : i - 1].id;
    if (!window.confirm("Delete this step? Its questions move to the step before.")) return;
    onChange({ ...def, sections: def.sections.filter((s) => s.id !== id), questions: def.questions.map((q) => (q.sectionId === id ? { ...q, sectionId: target } : q)) });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        {def.settings.askUnsure && <p>Always asked first: “What are you unsure about?” (turn off in Settings). </p>}
        <p>Always asked last: name, email{def.settings.askPhone ? ", phone" : ""} and consent.</p>
      </div>

      {def.sections.map((s, si) => {
        const qs = def.questions.filter((q) => q.sectionId === s.id);
        const earlier = def.questions.filter((q) => def.sections.slice(0, si).some((x) => x.id === q.sectionId));
        return (
          <section
            key={s.id}
            className="rounded-2xl border border-border bg-card"
            onDragOver={(e) => drag && e.preventDefault()}
            onDrop={() => {
              if (drag) moveTo(drag, null, s.id);
              setDrag(null);
            }}
          >
            <div className="flex flex-wrap items-start gap-2 border-b border-border p-3">
              <span className="mt-2 rounded-full bg-cyan-600/10 px-2 py-0.5 text-[11px] font-medium text-cyan-800 dark:text-cyan-300">Step {si + 1}</span>
              <div className="min-w-0 flex-1 space-y-1">
                <input
                  value={s.title}
                  readOnly={readOnly}
                  maxLength={160}
                  aria-label="Step title"
                  onChange={(e) => updateS(s.id, { title: e.target.value })}
                  className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-semibold hover:border-border focus:border-cyan-600 focus:outline-none"
                />
                <input
                  value={s.description ?? ""}
                  readOnly={readOnly}
                  maxLength={1000}
                  placeholder="Description (optional)"
                  aria-label="Step description"
                  onChange={(e) => updateS(s.id, { description: e.target.value })}
                  className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-xs text-muted-foreground hover:border-border focus:border-cyan-600 focus:outline-none"
                />
                {si > 0 && <ConditionEditor value={s.showIf ?? null} earlier={earlier} onChange={(c) => updateS(s.id, { showIf: c })} what="this step" readOnly={readOnly} />}
              </div>
              {!readOnly && (
                <div className="flex gap-1">
                  <button type="button" className={small} disabled={si === 0} onClick={() => moveSection(si, -1)} aria-label="Move step up">
                    <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className={small} disabled={si === def.sections.length - 1} onClick={() => moveSection(si, 1)} aria-label="Move step down">
                    <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className={small} disabled={def.sections.length === 1} onClick={() => removeSection(s.id)} aria-label="Delete step">
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <ul className="space-y-2 p-3">
              {qs.length === 0 && <li className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No questions in this step yet{drag ? "; drop one here" : ""}.</li>}
              {qs.map((q) => {
                const isOpen = open === q.id;
                const before = ordered.slice(0, ordered.findIndex((x) => x.id === q.id));
                return (
                  <li
                    key={q.id}
                    draggable={!readOnly && !isOpen}
                    onDragStart={() => setDrag(q.id)}
                    onDragEnd={() => setDrag(null)}
                    onDragOver={(e) => drag && e.preventDefault()}
                    onDrop={(e) => {
                      e.stopPropagation();
                      if (drag) moveTo(drag, q.id, s.id);
                      setDrag(null);
                    }}
                    className={`rounded-xl border ${isOpen ? "border-cyan-600/50 shadow-sm" : "border-border"} bg-background`}
                  >
                    <div className="flex items-center gap-2 p-2.5">
                      {!readOnly && <GripVertical aria-hidden="true" className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />}
                      <button type="button" onClick={() => setOpen(isOpen ? null : q.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen}>
                        {isOpen ? <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" /> : <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {q.label}
                            {q.required && <span className="text-red-600"> *</span>}
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            {KIND_LABEL[q.kind]}
                            {q.options.length > 0 && ` · ${q.options.length} options`}
                            {q.showIf && (
                              <span className="inline-flex items-center gap-0.5 text-violet-700 dark:text-violet-300">
                                <GitBranch aria-hidden="true" className="h-3 w-3" /> shown only sometimes
                              </span>
                            )}
                            {(q.rules?.length ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-amber-800 dark:text-amber-300">
                                <Tag aria-hidden="true" className="h-3 w-3" /> {q.rules!.length} CRM rule{q.rules!.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                      {!readOnly && (
                        <div className="flex shrink-0 gap-1">
                          <button type="button" className={small} onClick={() => step(q.id, -1)} aria-label="Move up">
                            <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className={small} onClick={() => step(q.id, 1)} aria-label="Move down">
                            <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className={small} onClick={() => addQuestion(q.sectionId, q.kind, q)} aria-label="Duplicate">
                            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className={small} onClick={() => removeQ(q.id)} aria-label="Delete">
                            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {isOpen && <QuestionEditor q={q} update={(p) => updateQ(q.id, p)} earlier={before} team={team} readOnly={readOnly} isPlatform={isPlatform} />}
                  </li>
                );
              })}
            </ul>

            {!readOnly && (
              <div className="flex flex-wrap gap-2 px-3 pb-3">
                <div className="relative">
                  <button type="button" onClick={() => setAdding(adding === s.id ? null : s.id)} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-cyan-600/60 px-3 py-1.5 text-xs font-medium text-cyan-800 hover:bg-cyan-600/5 dark:text-cyan-300">
                    <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add question
                  </button>
                  {adding === s.id && (
                    <div className="absolute left-0 top-full z-20 mt-1 grid w-[22rem] grid-cols-2 gap-1 rounded-xl border border-border bg-card p-2 shadow-lg">
                      {KINDS.map((k) => (
                        <button key={k.kind} type="button" onClick={() => addQuestion(s.id, k.kind)} className="rounded-lg p-2 text-left text-xs hover:bg-muted">
                          <span className="block font-medium">{k.label}</span>
                          <span className="text-muted-foreground">{k.hint}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setBankFor(s.id)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">
                  <BookOpen aria-hidden="true" className="h-3.5 w-3.5" /> From the question bank
                </button>
              </div>
            )}
          </section>
        );
      })}

      {!readOnly && (
        <button type="button" onClick={addSection} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
          <Plus aria-hidden="true" className="h-4 w-4" /> Add a step
        </button>
      )}

      {bankFor && <BankPicker bank={bank} onPick={(q) => addQuestion(bankFor, q.kind, q)} onClose={() => setBankFor(null)} />}
    </div>
  );
}

function ConditionEditor({ value, earlier, onChange, what, readOnly }: { value: Condition | null; earlier: Question[]; onChange: (c: Condition | null) => void; what: string; readOnly: boolean }) {
  const usable = earlier.filter((q) => !["info", "file", "consent"].includes(q.kind));
  const q = usable.find((x) => x.id === value?.questionId);
  const options = q ? (q.kind === "yesno" ? ["Yes", "No"] : q.options) : [];
  if (!value)
    return readOnly || usable.length === 0 ? null : (
      <button type="button" onClick={() => onChange({ questionId: usable[usable.length - 1].id, op: "answered" })} className="inline-flex items-center gap-1 text-xs text-violet-700 hover:underline dark:text-violet-300">
        <GitBranch aria-hidden="true" className="h-3 w-3" /> Show {what} only for some answers
      </button>
    );
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-violet-500/5 p-2 text-xs">
      <GitBranch aria-hidden="true" className="h-3.5 w-3.5 text-violet-700 dark:text-violet-300" />
      Show {what} only if
      <select disabled={readOnly} value={value.questionId} onChange={(e) => onChange({ questionId: e.target.value, op: "answered" })} className="max-w-48 rounded-md border border-border bg-background px-1.5 py-1">
        {usable.map((x) => (
          <option key={x.id} value={x.id}>
            {x.label}
          </option>
        ))}
      </select>
      <select disabled={readOnly} value={value.op} onChange={(e) => onChange({ ...value, op: e.target.value as Condition["op"], value: e.target.value === "answered" ? null : (value.value ?? options[0] ?? "") })} className="rounded-md border border-border bg-background px-1.5 py-1">
        <option value="answered">is answered</option>
        {options.length > 0 && q?.kind !== "multi" && <option value="is">is</option>}
        {options.length > 0 && q?.kind !== "multi" && <option value="isNot">is not</option>}
        {q?.kind === "multi" && <option value="includes">includes</option>}
        {options.length === 0 && <option value="is">is exactly</option>}
      </select>
      {value.op !== "answered" &&
        (options.length > 0 ? (
          <select disabled={readOnly} value={value.value ?? ""} onChange={(e) => onChange({ ...value, value: e.target.value })} className="max-w-40 rounded-md border border-border bg-background px-1.5 py-1">
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input disabled={readOnly} value={value.value ?? ""} onChange={(e) => onChange({ ...value, value: e.target.value })} className="w-32 rounded-md border border-border bg-background px-1.5 py-1" />
        ))}
      {!readOnly && (
        <button type="button" onClick={() => onChange(null)} aria-label="Remove condition" className="rounded p-0.5 hover:bg-muted">
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function QuestionEditor({
  q,
  update,
  earlier,
  team,
  readOnly,
  isPlatform,
}: {
  q: Question;
  update: (p: Partial<Question>) => void;
  earlier: Question[];
  team: { id: string; name: string }[];
  readOnly: boolean;
  isPlatform: boolean;
}) {
  const hasOptions = WITH_OPTIONS.includes(q.kind);
  const [optionsText, setOptionsText] = useState(q.options.join("\n"));
  const ruleTargets = q.kind === "yesno" ? ["Yes", "No"] : hasOptions ? q.options : [];
  const rule = (when: string) => q.rules?.find((r) => r.when === when);
  const setRule = (when: string, patch: Partial<Rule>) => {
    const others = (q.rules ?? []).filter((r) => r.when !== when);
    const next = { ...(rule(when) ?? { when }), ...patch };
    update({ rules: next.tag || next.ownerMemberId || next.priority ? [...others, next] : others });
  };

  return (
    <fieldset disabled={readOnly} className="space-y-3 border-t border-border p-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-[1fr,12rem]">
        <label className="block text-xs font-medium text-muted-foreground">
          {q.kind === "info" ? "Text" : "Question"}
          <textarea rows={2} className={input} value={q.label} maxLength={300} onChange={(e) => update({ label: e.target.value })} />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Type
          <select
            className={input}
            value={q.kind}
            onChange={(e) => {
              const kind = e.target.value as Kind;
              update({
                kind,
                options: WITH_OPTIONS.includes(kind) ? (q.options.length >= 2 ? q.options : ["Option 1", "Option 2"]) : [],
                min: kind === "scale" ? 1 : null,
                max: kind === "scale" ? 5 : kind === "file" ? 1 : null,
                rules: WITH_OPTIONS.includes(kind) || kind === "yesno" ? q.rules : [],
              });
              setOptionsText(WITH_OPTIONS.includes(kind) ? (q.options.length >= 2 ? q.options : ["Option 1", "Option 2"]).join("\n") : "");
            }}
          >
            {KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-muted-foreground">
          Help text (optional)
          <input className={input} value={q.help ?? ""} maxLength={500} onChange={(e) => update({ help: e.target.value })} />
        </label>
        {["text", "longtext", "number", "email", "phone"].includes(q.kind) && (
          <label className="block text-xs font-medium text-muted-foreground">
            Placeholder (optional)
            <input className={input} value={q.placeholder ?? ""} maxLength={120} onChange={(e) => update({ placeholder: e.target.value })} />
          </label>
        )}
      </div>

      {hasOptions && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Options, one per line
            <textarea
              rows={Math.min(10, Math.max(3, optionsText.split("\n").length))}
              className={input}
              value={optionsText}
              onChange={(e) => {
                setOptionsText(e.target.value);
                update({ options: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) });
              }}
            />
          </label>
          <div className="space-y-2 pt-5 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!q.allowOther} onChange={(e) => update({ allowOther: e.target.checked })} /> Add “Other (please specify)”
            </label>
            {q.kind === "multi" && (
              <div className="flex gap-2">
                <label>
                  Fewest
                  <input type="number" min={0} className={`${input} w-20`} value={q.min ?? ""} onChange={(e) => update({ min: e.target.value === "" ? null : Number(e.target.value) })} />
                </label>
                <label>
                  Most
                  <input type="number" min={1} className={`${input} w-20`} value={q.max ?? ""} onChange={(e) => update({ max: e.target.value === "" ? null : Number(e.target.value) })} />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {q.kind === "number" && (
        <div className="flex gap-3 text-xs font-medium text-muted-foreground">
          <label>
            Lowest
            <input type="number" className={`${input} w-28`} value={q.min ?? ""} onChange={(e) => update({ min: e.target.value === "" ? null : Number(e.target.value) })} />
          </label>
          <label>
            Highest
            <input type="number" className={`${input} w-28`} value={q.max ?? ""} onChange={(e) => update({ max: e.target.value === "" ? null : Number(e.target.value) })} />
          </label>
        </div>
      )}
      {q.kind === "scale" && (
        <div className="flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
          <label>
            From
            <select className={`${input} w-20`} value={q.min ?? 1} onChange={(e) => update({ min: Number(e.target.value) })}>
              <option value={0}>0</option>
              <option value={1}>1</option>
            </select>
          </label>
          <label>
            To
            <select className={`${input} w-20`} value={q.max ?? 5} onChange={(e) => update({ max: Number(e.target.value) })}>
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Low end label
            <input className={`${input} w-36`} value={q.minLabel ?? ""} maxLength={40} placeholder="Not at all" onChange={(e) => update({ minLabel: e.target.value })} />
          </label>
          <label>
            High end label
            <input className={`${input} w-36`} value={q.maxLabel ?? ""} maxLength={40} placeholder="Very" onChange={(e) => update({ maxLabel: e.target.value })} />
          </label>
        </div>
      )}
      {q.kind === "file" && (
        <label className="block w-40 text-xs font-medium text-muted-foreground">
          Files allowed
          <select className={input} value={q.max ?? 1} onChange={(e) => update({ max: Number(e.target.value) })}>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}

      {q.kind !== "info" && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={q.required} onChange={(e) => update({ required: e.target.checked })} /> Required
        </label>
      )}

      <ConditionEditor value={q.showIf ?? null} earlier={earlier} onChange={(c) => update({ showIf: c })} what="this question" readOnly={readOnly} />

      {ruleTargets.length > 0 && !isPlatform && (
        <details className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs" open={(q.rules?.length ?? 0) > 0}>
          <summary className="cursor-pointer font-medium">
            <Tag aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" /> CRM rules: what each answer does to the lead
          </summary>
          <table className="mt-2 w-full">
            <thead className="text-muted-foreground">
              <tr>
                <th className="pb-1 text-left font-medium">If they pick</th>
                <th className="pb-1 text-left font-medium">Add tag</th>
                <th className="pb-1 text-left font-medium">Assign to</th>
                <th className="pb-1 text-left font-medium">High priority</th>
              </tr>
            </thead>
            <tbody>
              {ruleTargets.map((o) => (
                <tr key={o} className="border-t border-amber-500/20">
                  <td className="py-1 pr-2">{o}</td>
                  <td className="py-1 pr-2">
                    <input className="w-full rounded-md border border-border bg-background px-1.5 py-1" maxLength={40} value={rule(o)?.tag ?? ""} onChange={(e) => setRule(o, { tag: e.target.value || null })} />
                  </td>
                  <td className="py-1 pr-2">
                    <select className="w-full rounded-md border border-border bg-background px-1.5 py-1" value={rule(o)?.ownerMemberId ?? ""} onChange={(e) => setRule(o, { ownerMemberId: e.target.value || null })}>
                      <option value="">—</option>
                      {team.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1">
                    <input type="checkbox" checked={rule(o)?.priority === "High"} onChange={(e) => setRule(o, { priority: e.target.checked ? "High" : null })} aria-label={`High priority when ${o}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {team.length === 0 && <p className="mt-1 text-muted-foreground">Add your team in the CRM&apos;s Settings to assign leads automatically.</p>}
          <p className="mt-1 text-muted-foreground">Rules run when the inquiry arrives. An owner is set only if the lead has none.</p>
        </details>
      )}
    </fieldset>
  );
}

function BankPicker({ bank, onPick, onClose }: { bank: { topic: string; questions: Question[] }[]; onPick: (q: Question) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="bank-title" className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border p-4">
          <h2 id="bank-title" className="text-base font-semibold">
            Question bank
          </h2>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="ml-auto w-48 rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-muted">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4">
          {bank.map((g) => {
            const list = g.questions.filter((x) => !t || x.label.toLowerCase().includes(t));
            if (list.length === 0) return null;
            return (
              <section key={g.topic}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.topic}</h3>
                <ul className="space-y-1.5">
                  {list.map((x) => (
                    <li key={x.label}>
                      <button type="button" onClick={() => onPick(x)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-2.5 text-left text-sm hover:bg-muted">
                        <span>
                          {x.label}
                          {x.options.length > 0 && <span className="block truncate text-xs text-muted-foreground">{x.options.join(" · ")}</span>}
                        </span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px]">{KIND_LABEL[x.kind]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ settings

function SettingsEditor({
  def,
  onChange,
  languages,
  readOnly,
  publicEnabled,
  setPublic,
  isDefault,
}: {
  def: FormDef;
  onChange: (d: FormDef) => void;
  languages: { code: string; name: string }[];
  readOnly: boolean;
  publicEnabled: boolean;
  setPublic: (on: boolean) => void;
  isDefault: boolean;
}) {
  const s = def.settings;
  const set = (patch: Partial<FormDef["settings"]>) => onChange({ ...def, settings: { ...s, ...patch } });
  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Texts</h2>
        <label className="block text-xs font-medium text-muted-foreground">
          Heading
          <input className={input} value={s.title ?? ""} maxLength={160} placeholder="Get career guidance from your institute" onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Introduction
          <textarea rows={2} className={input} value={s.intro ?? ""} maxLength={1000} onChange={(e) => set({ intro: e.target.value })} />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Thank-you message
          <textarea rows={2} className={input} value={s.thankYou ?? ""} maxLength={1000} placeholder="Thank you. Your request was sent." onChange={(e) => set({ thankYou: e.target.value })} />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          After sending, open this page instead (website forms; optional)
          <input className={input} value={s.redirectUrl ?? ""} maxLength={500} placeholder="https://your-site.example/thank-you" onChange={(e) => set({ redirectUrl: e.target.value })} />
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Look</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block text-xs font-medium text-muted-foreground">
            Colour
            <span className="mt-1 flex items-center gap-2">
              <input type="color" value={s.accent ?? "#4f46e5"} onChange={(e) => set({ accent: e.target.value })} className="h-9 w-14 rounded border border-border" />
              <input className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs" value={s.accent ?? ""} placeholder="#4f46e5" onChange={(e) => set({ accent: e.target.value })} />
            </span>
          </label>
          <label className="block min-w-64 flex-1 text-xs font-medium text-muted-foreground">
            Logo (https link to an image)
            <input className={input} value={s.logoUrl ?? ""} maxLength={500} placeholder="https://your-site.example/logo.png" onChange={(e) => set({ logoUrl: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
        <h2 className="text-sm font-semibold">What else is asked</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.askUnsure} onChange={(e) => set({ askUnsure: e.target.checked })} /> “What are you unsure about?” (first, required)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.askPhone} onChange={(e) => set({ askPhone: e.target.checked, phoneRequired: e.target.checked && s.phoneRequired })} /> Phone number
        </label>
        {s.askPhone && (
          <label className="ml-6 flex items-center gap-2">
            <input type="checkbox" checked={s.phoneRequired} onChange={(e) => set({ phoneRequired: e.target.checked })} /> Required
          </label>
        )}
        <p className="text-xs text-muted-foreground">Name, email and consent are always asked.</p>
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
        <h2 className="text-sm font-semibold">Languages</h2>
        <p className="text-xs text-muted-foreground">People choose the language on the form. Translate your texts in the Translations tab (untranslated texts show in {languages.find((l) => l.code === def.languages[0])?.name ?? "the first language"}).</p>
        <div className="flex flex-wrap gap-2">
          {languages.map((l) => {
            const on = def.languages.includes(l.code);
            const first = def.languages[0] === l.code;
            return (
              <label key={l.code} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${on ? "border-cyan-600 bg-cyan-600/5" : "border-border"}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={first}
                  onChange={(e) => onChange({ ...def, languages: e.target.checked ? [...def.languages, l.code] : def.languages.filter((x) => x !== l.code) })}
                />
                {l.name}
                {first && <span className="text-muted-foreground">(written in)</span>}
              </label>
            );
          })}
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
        <h2 className="text-sm font-semibold">Who can fill it in</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={publicEnabled} onChange={(e) => setPublic(e.target.checked)} /> Anyone with the link (your website, QR codes, social media)
        </label>
        <p className="text-xs text-muted-foreground">
          {isDefault ? "Signed-in Edulexa members always use this form when they ask you for guidance." : "Inside Edulexa, members use your default form; this one is for links and your website."}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Check aria-hidden="true" className="h-3.5 w-3.5" /> Bots are filtered out (hidden field, time check, rate limits).
        </p>
      </section>
    </fieldset>
  );
}
