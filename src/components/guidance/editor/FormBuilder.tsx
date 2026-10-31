"use client";

/**
 * The guidance form builder. Questions: sections (steps) and questions of every type, dragged or moved to reorder, each
 * with help text, options, limits, "show only if" logic and CRM rules (tag, assign, high priority), plus the question
 * bank, notes for counsellors beside the answers, and "Book a meeting" questions. Automatic messages: emails, SMS and
 * WhatsApp the form sends by itself. Settings: texts, branding, contact fields, languages, public link. Translations:
 * every text side by side.
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
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  GitBranch,
  Lightbulb,
  GripVertical,
  Monitor,
  Plus,
  Smartphone,
  Tag,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import GuidanceForm, { ResultsView } from "@/components/guidance/form/GuidanceForm";
import {
  KIND_LABEL,
  KINDS,
  newId,
  nextFor,
  onAccent,
  WITH_OPTIONS,
  type Condition,
  type Band,
  type FormDef,
  type Kind,
  type ListColumn,
  type Outcome,
  type Question,
  type Results,
  type Rule,
  type Score,
  type Section,
} from "@/components/guidance/form/model";
import { UI } from "@/components/guidance/form/uiText";
import ShareTab from "./ShareTab";
import InsightsTab from "./InsightsTab";
import TranslationsTab from "./TranslationsTab";
import AutomationsTab from "./AutomationsTab";
import MeetingEditor, { EditingInstitute } from "./MeetingEditor";

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

type Tab = "questions" | "results" | "automations" | "settings" | "translations" | "share" | "insights";
const TABS: [Tab, string][] = [
  ["questions", "Questions"],
  ["results", "Results"],
  ["automations", "Automatic messages"],
  ["settings", "Settings"],
  ["translations", "Translations"],
  ["share", "Share"],
  ["insights", "Insights"],
];

export const input = "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20";
const small = "rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-40";

/** The notice when the institute writes none (the form shows it in each language) */
const DEFAULT_PARTIAL_NOTICE = UI.en.partialNotice;

/**
 * The report texts a template has for this form, only where the form's are blank (never over the school's own): each
 * question's texts for its answers (those that are still its options), each step's report text and counsellor guide,
 * and the report's heading, introduction, next steps, sharing and grid. Matched by question and step id. Returns the
 * form and how many texts were added.
 */
function fillFromTemplate(d: FormDef, tpl: FormDef): { def: FormDef; filled: number } {
  let filled = 0;
  const blank = (s: string | null | undefined) => !s?.trim();
  const questions = d.questions.map((q) => {
    const t = tpl.questions.find((x) => x.id === q.id);
    if (!t || (q.explain?.length ?? 0) > 0) return q;
    const valid = (when: string) => when === "answered" || (q.kind === "yesno" ? when === "Yes" || when === "No" : q.options.includes(when));
    const explain = (t.explain ?? []).filter((e) => valid(e.when));
    filled += explain.length;
    const hide = !q.hideInReport && !!t.hideInReport;
    if (hide) filled++;
    return { ...q, explain, hideInReport: q.hideInReport || !!t.hideInReport };
  });
  const sections = d.sections.map((s) => {
    const t = tpl.sections.find((x) => x.id === s.id);
    if (!t) return s;
    const next = { ...s };
    for (const k of ["report", "guideTitle", "guide"] as const)
      if (blank(s[k]) && !blank(t[k])) {
        next[k] = t[k];
        filled++;
      }
    return next;
  });
  const r = { ...d.results! };
  const tr = tpl.results;
  if (tr) {
    for (const k of ["reportTitle", "intro", "nextTitle", "nextText", "nextLabel"] as const)
      if (blank(r[k]) && !blank(tr[k])) {
        r[k] = tr[k];
        filled++;
      }
    if (r.nextFrom == null && tr.nextFrom != null && r.nextTitle === tr.nextTitle) r.nextFrom = tr.nextFrom;
    if (!r.share && tr.share) {
      r.share = true;
      filled++;
    }
    // The grid only when the form still has the template's four outcomes
    if (!r.grid && tr.grid && tr.grid.cells.every((c) => r.outcomes.some((o) => o.id === c))) {
      r.grid = tr.grid;
      filled++;
    }
  }
  // The template's results email: its score card and PDF, on the form's copy of it when both are off
  const automations = (d.automations ?? []).map((a) => {
    const t = tpl.automations?.find((x) => x.id === a.id && x.channel === "email");
    if (!t || a.channel !== "email" || a.scoreCard || a.attachReport || !(t.scoreCard || t.attachReport)) return a;
    filled++;
    return { ...a, scoreCard: !!t.scoreCard, attachReport: !!t.attachReport };
  });
  return { def: { ...d, questions, sections, results: r, automations }, filled };
}

/** Fill in fields the API may leave out */
function normalise(d: FormDef): FormDef {
  return {
    languages: d.languages?.length ? d.languages : ["en"],
    sections: (d.sections ?? []).map((s) => ({ ...s, translations: s.translations ?? {} })),
    questions: (d.questions ?? []).map((q) => ({
      ...q,
      options: q.options ?? [],
      rules: q.rules ?? [],
      scores: q.scores ?? [],
      tips: q.tips ?? [],
      explain: q.explain ?? [],
      booking: q.kind === "booking" ? (q.booking ?? newBooking()) : null,
      columns: q.columns ?? [],
      translations: q.translations ?? {},
      required: !!q.required,
    })),
    results: {
      // The report's texts, next steps, sharing and grid as the API gives them
      ...(d.results ?? {}),
      outcomeEnabled: d.results?.outcomeEnabled ?? false,
      outcomeTitle: d.results?.outcomeTitle ?? null,
      outcomes: d.results?.outcomes ?? [],
      matchEnabled: d.results?.matchEnabled ?? false,
      matchTitle: d.results?.matchTitle ?? null,
      bands: d.results?.bands ?? [],
      showToPerson: d.results?.showToPerson ?? true,
      translations: d.results?.translations ?? {},
    },
    automations: (d.automations ?? []).map((a) => ({ ...a, variables: a.variables ?? [] })),
    settings: {
      ...(d.settings ?? {}),
      layout: d.settings?.layout === "cover" ? "cover" : "classic",
      askUnsure: d.settings?.askUnsure ?? true,
      askPhone: d.settings?.askPhone ?? true,
      phoneRequired: d.settings?.phoneRequired ?? false,
      requireEmailConfirmation: d.settings?.requireEmailConfirmation ?? true,
      requirePhoneCheck: d.settings?.requirePhoneCheck ?? false,
      savePartial: d.settings?.savePartial ?? false,
      partialRetentionDays: d.settings?.partialRetentionDays ?? 30,
      notifyOnPartial: d.settings?.notifyOnPartial ?? false,
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
  /** The templates' own definitions (their report texts fill blanks on a form built from one) */
  const [templates, setTemplates] = useState<{ key: string; name: string; definition: FormDef }[]>([]);
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
    if (t.ok) {
      const body = await t.json();
      setBank(body.bank);
      setTemplates(body.templates ?? []);
    }
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
      const clean = { ...d, questions: d.questions.map((q) => pruneAnswerTexts({ ...q, options: q.options.filter((o) => o.trim()) })) };
      const res = await apiFetch(`/api/guidance-forms/${formId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ definition: clean, name: n }) });
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
  const unfinished = def
    ? def.questions.find(
        (q) =>
          !q.label.trim() ||
          (WITH_OPTIONS.includes(q.kind) && q.options.filter((o) => o.trim()).length < 2) ||
          (q.kind === "slider" && (!q.minLabel?.trim() || !q.maxLabel?.trim())) ||
          (q.kind === "list" && (!(q.columns ?? []).length || (q.columns ?? []).some((c) => !c.label.trim()))) ||
          (q.kind === "booking" && q.booking?.mode === "slots" && !q.booking.typeId),
      )
    : undefined;
  // Outcomes and bands need their names, and a match score a band from 0%, before the server takes them
  const resultsUnfinished =
    !!def?.results &&
    (def.results.outcomes.some((o) => !o.name.trim()) || def.results.bands.some((b) => !b.label.trim()) || (def.results.matchEnabled && !def.results.bands.some((b) => b.from === 0)));
  useEffect(() => {
    if (status !== "dirty" || !def || unfinished || resultsUnfinished) return;
    const t = setTimeout(() => save(def, name), 1200);
    return () => clearTimeout(t);
  }, [status, def, name, save, unfinished, resultsUnfinished]);

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

  // The template this form was built from (most of its questions' ids match one with report texts)
  const source = def
    ? templates
        .filter((t) => t.definition.questions.some((q) => (q.explain?.length ?? 0) > 0))
        .map((t) => ({ t, n: t.definition.questions.filter((q) => def.questions.some((x) => x.id === q.id)).length }))
        .filter((x) => x.n >= 3)
        .sort((a, b) => b.n - a.n)[0]?.t
    : undefined;
  const fillTemplate = () => {
    if (!source || !def) return;
    const { def: next, filled } = fillFromTemplate(def, normalise(source.definition));
    if (filled === 0) return setNotice({ ok: true, text: "Every report text already has your own words; nothing was changed." });
    change(next);
    setNotice({ ok: true, text: `Added ${filled} text${filled > 1 ? "s" : ""} from the ${source.name} template where yours were blank. Check them, then publish.` });
  };

  if (access) return <AccessNotice problem={access} />;
  if (!view || !def) return <div className="h-64 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />;
  const readOnly = !canEdit;

  return (
    <EditingInstitute.Provider value={view.instituteId}>
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
            {status === "dirty" && unfinished ? "Finish the new question to save (its text, and options, slider ends, column names or the meeting's appointment)" : status === "dirty" && resultsUnfinished ? "Finish the results to save (name every outcome and band; one band starts at 0%)" : status === "saving" ? "Saving…" : status === "dirty" ? "Unsaved changes" : status === "error" ? "Not saved" : view.hasDraft ? "Draft saved, not published" : `Published · version ${view.version}`}
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

      {(tab === "questions" || tab === "results" || tab === "settings") && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
          <div className="min-w-0">
            {tab === "questions" ? (
              <QuestionsEditor def={def} onChange={change} team={team} bank={bank} open={open} setOpen={setOpen} readOnly={readOnly} isPlatform={view.instituteId === "ceacdd2c-975f-41fd-959e-cc530240931c"} />
            ) : tab === "results" ? (
              <ResultsEditor def={def} onChange={change} readOnly={readOnly} onFill={source ? fillTemplate : undefined} />
            ) : (
              <SettingsEditor def={def} onChange={change} languages={languages} readOnly={readOnly} publicEnabled={view.publicEnabled} setPublic={setPublic} isDefault={view.isDefault} />
            )}
          </div>
          {tab === "results" ? (
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Example of what people see after sending</p>
              <div
                className="rounded-2xl border border-border bg-background p-4 text-sm shadow-sm"
                style={{ "--gf-accent": def.settings.accent || "#4f46e5", "--gf-on": onAccent(def.settings.accent || "#4f46e5") } as React.CSSProperties}
              >
                {(() => {
                  const r = def.results!;
                  const outcome = r.outcomeEnabled ? r.outcomes.find((o) => o.name.trim()) : undefined;
                  const band = r.matchEnabled ? [...r.bands].sort((a, b) => b.from - a.from)[0] : undefined;
                  if (!outcome && !band) return <p className="text-muted-foreground">Switch on an outcome or a match score to see an example.</p>;
                  if (!r.showToPerson) return <p className="text-muted-foreground">People see only your thank-you message; your team sees the results in the CRM.</p>;
                  const example = {
                    outcomeTitle: r.outcomeTitle,
                    outcome: outcome ?? null,
                    points: [],
                    matchTitle: r.matchTitle,
                    match: band ? { percent: Math.max(band.from, 86), label: band.label, message: band.message } : null,
                  };
                  return (
                    <ResultsView
                      accent={def.settings.accent || "#4f46e5"}
                      t={(k) => (UI.en as Record<string, string>)[k] ?? k}
                      result={example}
                      next={nextFor(def, example, def.languages[0] ?? "en", "your school")}
                    />
                  );
                })()}
              </div>
            </aside>
          ) : (
          <aside className="lg:sticky lg:top-24 lg:self-start">
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
                fill={{ formId: view.id, name, version: view.version, instituteId: view.instituteId, instituteName: "your institute", definition: { ...def, questions: def.questions.map((x) => ({ ...x, label: x.label || "(question text)", options: x.options.filter((o) => o.trim()) })) }, languageNames: Object.fromEntries(languages.map((l) => [l.code, l.name])) }}
                mode="preview"
                consentText="Send this to your institute so an advisor can contact me."
                onSubmit={async () => null}
              />
            </div>
          </aside>
          )}
        </div>
      )}
      {tab === "automations" && <AutomationsTab def={def} onChange={change} readOnly={readOnly} instituteId={view.instituteId} team={team} />}
      {tab === "translations" && <TranslationsTab def={def} onChange={change} languages={languages} readOnly={readOnly} />}
      {tab === "share" && <ShareTab view={view} setPublic={setPublic} canEdit={canEdit} />}
      {tab === "insights" && <InsightsTab formId={view.id} apiFetch={apiFetch} instituteId={view.instituteId} />}
    </div>
    </EditingInstitute.Provider>
  );
}

// ------------------------------------------------------------------ questions

/** The limits and parts a new question of this type starts with */
function kindDefaults(kind: Kind): Partial<Question> {
  return {
    min: kind === "scale" || kind === "slider" ? 1 : null,
    max: kind === "scale" ? 5 : kind === "slider" ? 7 : kind === "list" ? 5 : kind === "file" ? 1 : null,
    minLabel: null,
    maxLabel: null,
    columns: kind === "list" ? [{ id: newId(), label: "Name", options: [] }] : [],
    booking: kind === "booking" ? newBooking() : null,
  };
}

/** A new "Book a meeting" question: people ask for a day, by phone or video, in this browser's time zone */
function newBooking(): NonNullable<Question["booking"]> {
  let timeZone = "Asia/Kolkata";
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || timeZone;
  } catch {
    // keep the default
  }
  return { mode: "request", modes: ["Phone", "Video"], daysAhead: 14, timeZone };
}

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
          label: kind === "consent" ? "I agree to be contacted about courses" : "",
          required: kind === "consent",
          options: WITH_OPTIONS.includes(kind) ? ["", ""] : [],
          ...kindDefaults(kind),
          rules: [],
          scores: [],
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
                <SectionReportEditor s={s} readOnly={readOnly} update={(p) => updateS(s.id, p)} />
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
                            {q.label || <span className="font-normal italic text-muted-foreground">New question (type it below)</span>}
                            {q.required && <span className="text-red-600"> *</span>}
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            {KIND_LABEL[q.kind]}
                            {q.options.filter((o) => o.trim()).length > 0 && ` · ${q.options.filter((o) => o.trim()).length} options`}
                            {q.showIf && (
                              <span className="inline-flex items-center gap-0.5 text-violet-700 dark:text-violet-300">
                                <GitBranch aria-hidden="true" className="h-3 w-3" /> shown only sometimes
                              </span>
                            )}
                            {(q.scores?.length ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300">
                                <Trophy aria-hidden="true" className="h-3 w-3" /> counts towards results
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
                          <button type="button" className={`${small} hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400`} onClick={() => removeQ(q.id)} aria-label="Delete" title="Delete question">
                            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {isOpen && <QuestionEditor q={q} update={(p) => updateQ(q.id, p)} earlier={before} team={team} readOnly={readOnly} isPlatform={isPlatform} results={def.results ?? null} />}
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
  const usable = earlier.filter((q) => !["info", "file", "consent", "slider"].includes(q.kind));
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
        {options.length === 0 && q?.kind !== "list" && <option value="is">is exactly</option>}
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
  results,
}: {
  q: Question;
  update: (p: Partial<Question>) => void;
  earlier: Question[];
  team: { id: string; name: string }[];
  readOnly: boolean;
  isPlatform: boolean;
  results: Results | null;
}) {
  const hasOptions = WITH_OPTIONS.includes(q.kind);
  const named = q.options.filter((o) => o.trim());
  const ruleTargets = q.kind === "yesno" ? ["Yes", "No"] : hasOptions ? named : [];
  const [limits, setLimits] = useState(q.kind === "multi" && (q.min != null || q.max != null));
  const rule = (when: string) => q.rules?.find((r) => r.when === when);
  const setRule = (when: string, patch: Partial<Rule>) => {
    const others = (q.rules ?? []).filter((r) => r.when !== when);
    const next = { ...(rule(when) ?? { when }), ...patch };
    update({ rules: next.tag || next.ownerMemberId || next.priority ? [...others, next] : others });
  };
  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <fieldset disabled={readOnly} className="space-y-4 border-t border-border p-4 text-sm">
      {/* The question, its type and whether it's required */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
        <label className="block text-xs font-medium text-muted-foreground">
          {q.kind === "info" ? "Text to show" : "Question"}
          <textarea
            rows={2}
            autoFocus={!q.label}
            className={input}
            value={q.label}
            maxLength={300}
            placeholder={q.kind === "info" ? "e.g. We reply within two working days." : "Type your question, e.g. Which area interests you most?"}
            onChange={(e) => update({ label: e.target.value })}
          />
        </label>
        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-muted-foreground">
            Type
            <select
              className={input}
              value={q.kind}
              onChange={(e) => {
                const kind = e.target.value as Kind;
                const keep = q.options.length >= 2 ? q.options : ["", ""];
                update({
                  kind,
                  options: WITH_OPTIONS.includes(kind) ? keep : [],
                  ...kindDefaults(kind),
                  minLabel: kind === "scale" || kind === "slider" ? q.minLabel : null,
                  maxLabel: kind === "scale" || kind === "slider" ? q.maxLabel : null,
                  rules: WITH_OPTIONS.includes(kind) || kind === "yesno" ? q.rules : [],
                  // Scores name answers of the old type
                  scores: [],
                });
              }}
            >
              {KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {q.kind !== "info" && (
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium">
              Required
              <span className="relative inline-flex">
                <input type="checkbox" role="switch" className="peer sr-only" checked={q.required} onChange={(e) => update({ required: e.target.checked })} />
                <span className="h-5 w-9 rounded-full bg-muted-foreground/30 transition-colors peer-checked:bg-cyan-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan-600" />
                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </span>
            </label>
          )}
        </div>
      </div>

      <label className="block text-xs font-medium text-muted-foreground">
        Help text <span className="font-normal">(optional, shown under the question)</span>
        <input className={input} value={q.help ?? ""} maxLength={500} placeholder="e.g. Pick the one closest to you; you can explain more later." onChange={(e) => update({ help: e.target.value })} />
      </label>

      {["text", "longtext", "number", "email", "phone"].includes(q.kind) && (
        <label className="block text-xs font-medium text-muted-foreground">
          Example answer in the box <span className="font-normal">(optional)</span>
          <input className={input} value={q.placeholder ?? ""} maxLength={120} placeholder="e.g. 8 hours" onChange={(e) => update({ placeholder: e.target.value })} />
        </label>
      )}

      {hasOptions && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Options</p>
          <OptionsEditor options={q.options} onChange={(options) => update({ options })} />
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!q.allowOther} onChange={(e) => update({ allowOther: e.target.checked })} /> Add “Other (please specify)”
            </label>
            {q.kind === "multi" && !limits && (
              <button type="button" onClick={() => setLimits(true)} className="text-cyan-700 hover:underline dark:text-cyan-400">
                Limit how many they can pick
              </button>
            )}
          </div>
          {q.kind === "multi" && limits && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
              People pick at least
              <input type="number" min={0} aria-label="At least" className="w-16 rounded-md border border-border bg-background px-2 py-1" value={q.min ?? ""} placeholder="—" onChange={(e) => update({ min: num(e.target.value) })} />
              and at most
              <input type="number" min={1} aria-label="At most" className="w-16 rounded-md border border-border bg-background px-2 py-1" value={q.max ?? ""} placeholder="—" onChange={(e) => update({ max: num(e.target.value) })} />
              <span className="text-muted-foreground">(leave empty for no limit)</span>
              <button
                type="button"
                className="ml-auto rounded p-0.5 hover:bg-muted"
                aria-label="Remove the limit"
                onClick={() => {
                  update({ min: null, max: null });
                  setLimits(false);
                }}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {q.kind === "number" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          Allowed from
          <input type="number" aria-label="Lowest" className="w-24 rounded-md border border-border bg-background px-2 py-1" value={q.min ?? ""} placeholder="any" onChange={(e) => update({ min: num(e.target.value) })} />
          to
          <input type="number" aria-label="Highest" className="w-24 rounded-md border border-border bg-background px-2 py-1" value={q.max ?? ""} placeholder="any" onChange={(e) => update({ max: num(e.target.value) })} />
        </div>
      )}
      {q.kind === "scale" && (
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            Scale from
            <select className="rounded-md border border-border bg-background px-2 py-1" value={q.min ?? 1} onChange={(e) => update({ min: Number(e.target.value) })} aria-label="From">
              <option value={0}>0</option>
              <option value={1}>1</option>
            </select>
            to
            <select className="rounded-md border border-border bg-background px-2 py-1" value={q.max ?? 5} onChange={(e) => update({ max: Number(e.target.value) })} aria-label="To">
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="font-medium text-muted-foreground">
              Words under the lowest
              <input className={input} value={q.minLabel ?? ""} maxLength={40} placeholder="e.g. Not at all" onChange={(e) => update({ minLabel: e.target.value })} />
            </label>
            <label className="font-medium text-muted-foreground">
              Words under the highest
              <input className={input} value={q.maxLabel ?? ""} maxLength={40} placeholder="e.g. Very sure" onChange={(e) => update({ maxLabel: e.target.value })} />
            </label>
          </div>
        </div>
      )}
      {q.kind === "slider" && (
        <div className="space-y-2 text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="font-medium text-muted-foreground">
              Left end
              <input className={input} value={q.minLabel ?? ""} maxLength={40} placeholder="e.g. Support others" onChange={(e) => update({ minLabel: e.target.value })} />
            </label>
            <label className="font-medium text-muted-foreground">
              Right end
              <input className={input} value={q.maxLabel ?? ""} maxLength={40} placeholder="e.g. Take charge" onChange={(e) => update({ maxLabel: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            Positions
            <select className="rounded-md border border-border bg-background px-2 py-1" value={q.max ?? 7} onChange={(e) => update({ min: 1, max: Number(e.target.value) })} aria-label="Positions">
              {[3, 5, 7, 9, 11].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground">It starts in the middle; left there, the answer is the middle.</span>
          </div>
        </div>
      )}
      {q.kind === "list" && <ColumnsEditor q={q} update={update} />}
      {q.kind === "booking" && <MeetingEditor q={q} update={update} />}
      {q.kind === "file" && (
        <div className="flex items-center gap-2 text-xs">
          People can attach up to
          <select className="rounded-md border border-border bg-background px-2 py-1" value={q.max ?? 1} onChange={(e) => update({ max: Number(e.target.value) })} aria-label="Files allowed">
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {(q.max ?? 1) === 1 ? "file" : "files"} (PDF, Word, JPG or PNG, 5 MB each)
        </div>
      )}

      <div className="border-t border-border pt-3">
        <ConditionEditor value={q.showIf ?? null} earlier={earlier} onChange={(c) => update({ showIf: c })} what="this question" readOnly={readOnly} />
      </div>

      {results && (results.outcomeEnabled || results.matchEnabled) && SCORABLE.includes(q.kind) && <ScoresEditor q={q} update={update} results={results} />}

      {q.kind !== "info" && !isPlatform && <TipsEditor q={q} update={update} />}
      {IN_REPORT_PARTS.includes(q.kind) && !isPlatform && <ExplainEditor q={q} update={update} />}

      {!["info", "consent", "file"].includes(q.kind) && !isPlatform && (
        <label className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium">Show the answer on the person&apos;s profile (People)</span>
          <select
            className="rounded-md border border-border bg-background px-2 py-1"
            value={q.profileCard ?? ""}
            onChange={(e) => update({ profileCard: (e.target.value || null) as Question["profileCard"] })}
          >
            <option value="">No</option>
            <option value="background">Background</option>
            <option value="logistics">Logistics</option>
            <option value="motivation">Motivation</option>
          </select>
        </label>
      )}

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

/**
 * The options of a choice question, one row each: type, Enter for the next one, Backspace on an empty row removes it,
 * pasting several lines adds several options, rows move up and down.
 */
function OptionsEditor({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const pending = useRef<number | null>(null);
  const setFocus = (i: number) => {
    pending.current = i;
  };
  useEffect(() => {
    if (pending.current != null) {
      refs.current[pending.current]?.focus();
      pending.current = null;
    }
  });

  const set = (i: number, v: string) => onChange(options.map((o, j) => (j === i ? v : o)));
  const insert = (i: number, values: string[]) => {
    const list = [...options];
    list.splice(i, 0, ...values);
    onChange(list.slice(0, 30));
  };
  const remove = (i: number) => onChange(options.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= options.length) return;
    const list = [...options];
    [list[i], list[j]] = [list[j], list[i]];
    onChange(list);
  };
  const dupes = new Set(options.map((o) => o.trim().toLowerCase()).filter((o, i, a) => o && a.indexOf(o) !== i));

  return (
    <div className="mt-1 space-y-1.5">
      <ol className="space-y-1.5">
        {options.map((o, i) => (
          <li key={i} className="group flex items-center gap-1.5">
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
            <input
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={o}
              maxLength={120}
              placeholder={`Option ${i + 1}`}
              aria-label={`Option ${i + 1}`}
              aria-invalid={dupes.has(o.trim().toLowerCase())}
              onChange={(e) => set(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  // Go to the next empty row, or add one
                  if (options[i + 1] !== undefined && !options[i + 1].trim()) refs.current[i + 1]?.focus();
                  else {
                    insert(i + 1, [""]);
                    setFocus(i + 1);
                  }
                } else if (e.key === "Backspace" && o === "" && options.length > 2) {
                  e.preventDefault();
                  remove(i);
                  setFocus(Math.max(0, i - 1));
                }
              }}
              onPaste={(e) => {
                const lines = e.clipboardData.getData("text").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
                if (lines.length < 2) return;
                e.preventDefault();
                const list = [...options];
                list.splice(i, o ? 0 : 1, ...lines);
                onChange(list.slice(0, 30));
              }}
              className={`min-w-0 flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20 ${dupes.has(o.trim().toLowerCase()) ? "border-red-500" : "border-border"}`}
            />
            <div className="flex shrink-0 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move option ${i + 1} up`} className="rounded p-1 hover:bg-muted disabled:opacity-30">
                <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === options.length - 1} aria-label={`Move option ${i + 1} down`} className="rounded p-1 hover:bg-muted disabled:opacity-30">
                <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => remove(i)} disabled={options.length <= 2} aria-label={`Remove option ${i + 1}`} className="rounded p-1 hover:bg-red-500/10 hover:text-red-700 disabled:opacity-30">
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {dupes.size > 0 && <p className="pl-6 text-xs text-red-700 dark:text-red-400">Two options are the same.</p>}
      {options.length < 30 && (
        <button
          type="button"
          onClick={() => {
            insert(options.length, [""]);
            setFocus(options.length);
          }}
          className="ml-6 inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-400"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add option
        </button>
      )}
      <p className="pl-6 text-[11px] text-muted-foreground">Tip: press Enter for the next option, or paste a list to add many at once.</p>
    </div>
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

/** The columns of a "list of rows" question (1 to 4), each typed or picked from choices, and how many rows people can add */
/**
 * Notes for counsellors beside an answer in the CRM (the green boxes): one per answer, or one for any answer. Rules
 * written by the institute, never AI; never shown to the person.
 */
/** A step's text in the person's report, and the counsellor's guide to it beside the answers in the CRM */
function SectionReportEditor({ s, readOnly, update }: { s: Section; readOnly: boolean; update: (p: Partial<Section>) => void }) {
  return (
    <details className="px-2 text-xs" open={!!(s.report || s.guide || s.guideTitle)}>
      <summary className="cursor-pointer py-1 font-medium text-muted-foreground">Report text and counsellor guide</summary>
      <fieldset disabled={readOnly} className="mt-1 space-y-2">
        <label className="block font-medium">
          What the person reads at the top of this part of their report
          <textarea
            rows={2}
            maxLength={1500}
            className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 font-normal"
            value={s.report ?? ""}
            placeholder="e.g. Knowing where you are today helps you see where you want to go."
            onChange={(e) => update({ report: e.target.value })}
          />
        </label>
        <div className="space-y-1 rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-2">
          <p className="font-medium">
            Counsellor guide <span className="font-normal text-muted-foreground">(above this part&apos;s answers in the CRM&apos;s Insights summary; never shown to the person)</span>
          </p>
          <input
            maxLength={120}
            aria-label="Guide heading"
            className="block w-full rounded-md border border-border bg-background px-2 py-1.5"
            value={s.guideTitle ?? ""}
            placeholder="Heading, e.g. Current situation: why they want a change"
            onChange={(e) => update({ guideTitle: e.target.value })}
          />
          <textarea
            rows={3}
            maxLength={2000}
            aria-label="Guide"
            className="block w-full rounded-md border border-border bg-background px-2 py-1.5"
            value={s.guide ?? ""}
            placeholder={"Start a line with \"- \" for a point, e.g.\n- If they're unhappy, ask what's behind it"}
            onChange={(e) => update({ guide: e.target.value })}
          />
        </div>
      </fieldset>
    </details>
  );
}

/** A question's translated report texts, changed in every language the same way */
function mapExplain(t: Question["translations"], fn: (a: string[]) => string[]): Question["translations"] {
  return Object.fromEntries(Object.entries(t ?? {}).map(([lang, x]) => [lang, x?.explain ? { ...x, explain: fn(x.explain) } : x]));
}

/**
 * Before saving: coaching notes and report texts for answers the question no longer has (an option renamed or removed,
 * or the question's type changed) are dropped, with their translations, as the server only takes current answers.
 */
function pruneAnswerTexts(q: Question): Question {
  const valid = (when: string) =>
    q.kind !== "info" &&
    (when === "answered" ||
      (q.kind === "slider" ? when === "left" || when === "right" : q.kind === "yesno" ? when === "Yes" || when === "No" : WITH_OPTIONS.includes(q.kind) && q.options.includes(when)));
  const explain = q.explain ?? [];
  const keep = explain.map((e) => valid(e.when));
  if (keep.every(Boolean) && (q.tips ?? []).every((t) => valid(t.when))) return q;
  return {
    ...q,
    tips: (q.tips ?? []).filter((t) => valid(t.when)),
    explain: explain.filter((_, i) => keep[i]),
    translations: mapExplain(q.translations, (a) => a.filter((_, i) => keep[i] ?? true)),
  };
}

/** Kinds whose answers show in the report's parts (sliders make the grid; the rest are contact details, files, meetings) */
const IN_REPORT_PARTS: Kind[] = ["choice", "multi", "dropdown", "yesno", "scale", "text", "longtext", "number", "date", "list"];

/** What the person reads in their report under each answer, and whether the question shows in the report's parts */
function ExplainEditor({ q, update }: { q: Question; update: (p: Partial<Question>) => void }) {
  const targets: [string, string][] =
    q.kind === "yesno" ? [["Yes", "Yes"], ["No", "No"]] : WITH_OPTIONS.includes(q.kind) ? q.options.filter((o) => o.trim()).map((o) => [o, o]) : [];
  const all: [string, string][] = [...targets, ["answered", targets.length ? "Any answer" : "When they answer"]];
  const text = (when: string) => q.explain?.find((t) => t.when === when)?.text ?? "";
  // Edited in place, so its translations (matched by position) stay with it; adding or removing one moves them along
  const setText = (when: string, value: string) => {
    const list = q.explain ?? [];
    const i = list.findIndex((t) => t.when === when);
    if (i >= 0 && value) return update({ explain: list.map((t, j) => (j === i ? { ...t, text: value } : t)) });
    if (i >= 0) return update({ explain: list.filter((_, j) => j !== i), translations: mapExplain(q.translations, (a) => a.filter((_, j) => j !== i)) });
    if (value) update({ explain: [...list, { when, text: value }], translations: mapExplain(q.translations, (a) => [...a, ""]) });
  };
  return (
    <details className="rounded-lg border border-sky-600/30 bg-sky-600/5 p-2 text-xs" open={(q.explain?.length ?? 0) > 0}>
      <summary className="cursor-pointer font-medium">
        <FileText aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" /> What the person reads in their report
      </summary>
      <p className="mt-1 text-muted-foreground">Shown under their answer in their report, its PDF and the results email. Leave blank for just the answer.</p>
      <label className="mt-2 flex items-center gap-2">
        <input type="checkbox" checked={!!q.hideInReport} onChange={(e) => update({ hideInReport: e.target.checked })} />
        Leave this question out of the report&apos;s parts <span className="text-muted-foreground">(it stays under &ldquo;All your answers&rdquo;)</span>
      </label>
      {!q.hideInReport && (
        <div className="mt-2 space-y-2">
          {all.map(([when, label]) => (
            <label key={when} className="block">
              <span className="font-medium">{label}</span>
              <textarea
                rows={text(when) ? 2 : 1}
                maxLength={1500}
                className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5"
                value={text(when)}
                placeholder={when === "answered" ? "e.g. Each of these areas leads to recognised certifications." : "e.g. You're doing something about it, and that's the hardest step."}
                onChange={(e) => setText(when, e.target.value)}
              />
            </label>
          ))}
        </div>
      )}
    </details>
  );
}

function TipsEditor({ q, update }: { q: Question; update: (p: Partial<Question>) => void }) {
  const targets: [string, string][] =
    q.kind === "slider"
      ? [["left", `Leans to “${q.minLabel || "left"}”`], ["right", `Leans to “${q.maxLabel || "right"}”`]]
      : q.kind === "yesno"
        ? [["Yes", "Yes"], ["No", "No"]]
        : WITH_OPTIONS.includes(q.kind)
          ? q.options.filter((o) => o.trim()).map((o) => [o, o])
          : [];
  const all: [string, string][] = [...targets, ["answered", targets.length ? "Any answer" : "When they answer"]];
  const tip = (when: string) => q.tips?.find((t) => t.when === when)?.text ?? "";
  const setTip = (when: string, text: string) => {
    const others = (q.tips ?? []).filter((t) => t.when !== when);
    update({ tips: text ? [...others, { when, text }] : others });
  };
  return (
    <details className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-2 text-xs" open={(q.tips?.length ?? 0) > 0}>
      <summary className="cursor-pointer font-medium">
        <Lightbulb aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" /> Notes for counsellors beside this answer
      </summary>
      <p className="mt-1 text-muted-foreground">Shown in green beside the answer on the lead, to help your team talk with the person. Never shown to the person.</p>
      <div className="mt-2 space-y-2">
        {all.map(([when, label]) => (
          <label key={when} className="block">
            <span className="font-medium">{label}</span>
            <textarea
              rows={tip(when) ? 2 : 1}
              maxLength={600}
              className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5"
              value={tip(when)}
              placeholder={when === "answered" ? "e.g. Ask what they meant and what matters most to them." : "e.g. Explain the instalment plan and scholarships early."}
              onChange={(e) => setTip(when, e.target.value)}
            />
          </label>
        ))}
      </div>
    </details>
  );
}

function ColumnsEditor({ q, update }: { q: Question; update: (p: Partial<Question>) => void }) {
  const cols = q.columns ?? [];
  const set = (i: number, patch: Partial<ListColumn>) => update({ columns: cols.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div className="space-y-2 text-xs">
      <p className="font-medium text-muted-foreground">Columns of each row</p>
      <ol className="space-y-2">
        {cols.map((c, i) => (
          <li key={c.id} className="space-y-2 rounded-lg border border-border p-2.5">
            <div className="flex items-center gap-2">
              <input className={`${input} mt-0`} value={c.label} maxLength={60} placeholder={`Column ${i + 1}, e.g. Relationship`} aria-label={`Column ${i + 1} name`} onChange={(e) => set(i, { label: e.target.value })} />
              <button type="button" className={small} disabled={cols.length === 1} onClick={() => update({ columns: cols.filter((_, j) => j !== i) })} aria-label={`Remove column ${i + 1}`}>
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={c.options.length > 0} onChange={(e) => set(i, { options: e.target.checked ? ["", ""] : [] })} /> People pick from choices
            </label>
            {c.options.length > 0 && (
              <label className="block font-medium text-muted-foreground">
                Choices, one per line
                <textarea
                  rows={3}
                  className={input}
                  value={c.options.join("\n")}
                  placeholder={"Parent\nFriend\nEmployer"}
                  onChange={(e) => set(i, { options: e.target.value.split("\n").slice(0, 15) })}
                />
              </label>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        {cols.length < 4 && (
          <button type="button" className={small} onClick={() => update({ columns: [...cols, { id: newId(), label: "", options: [] }] })}>
            <Plus aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" /> Add a column
          </button>
        )}
        <span className="flex items-center gap-2">
          People can add up to
          <select className="rounded-md border border-border bg-background px-2 py-1" value={q.max ?? 5} onChange={(e) => update({ max: Number(e.target.value) })} aria-label="Most rows">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          rows
        </span>
      </div>
    </div>
  );
}

const SCORABLE: Kind[] = ["choice", "multi", "dropdown", "yesno", "slider"];

/** What each answer counts for in the results: outcomes it gives a point to, and match points */
function ScoresEditor({ q, update, results }: { q: Question; update: (p: Partial<Question>) => void; results: Results }) {
  const targets: [string, string][] =
    q.kind === "slider"
      ? [
          ["left", `Towards “${q.minLabel || "left end"}”`],
          ["right", `Towards “${q.maxLabel || "right end"}”`],
        ]
      : q.kind === "yesno"
        ? [
            ["Yes", "Yes"],
            ["No", "No"],
          ]
        : q.options.filter((o) => o.trim()).map((o) => [o, o]);
  const scores = q.scores ?? [];
  const score = (when: string) => scores.find((s) => s.when === when);
  const set = (when: string, patch: Partial<Score>) => {
    const next = { ...(score(when) ?? { when, outcomes: [] }), ...patch };
    const others = scores.filter((s) => s.when !== when);
    update({ scores: next.outcomes.length || next.match ? [...others, next] : others });
  };
  const outcomes = results.outcomeEnabled ? results.outcomes.filter((o) => o.name.trim()) : [];
  return (
    <details className="rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-2 text-xs" open={scores.length > 0}>
      <summary className="cursor-pointer font-medium">
        <Trophy aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" /> Counts towards results
      </summary>
      {q.kind === "slider" && <p className="mt-1 text-muted-foreground">A slider counts by how far it is towards an end: all the way gives the full points, the middle gives none.</p>}
      {targets.length === 0 ? (
        <p className="mt-2 text-muted-foreground">Add the options first.</p>
      ) : (
        <table className="mt-2 w-full">
          <thead className="text-muted-foreground">
            <tr>
              <th className="pb-1 text-left font-medium">If they pick</th>
              {outcomes.length > 0 && <th className="pb-1 text-left font-medium">A point for</th>}
              {results.matchEnabled && <th className="w-24 pb-1 text-left font-medium">Match points</th>}
            </tr>
          </thead>
          <tbody>
            {targets.map(([when, label]) => {
              const sc = score(when);
              return (
                <tr key={when} className="border-t border-emerald-600/20 align-top">
                  <td className="py-1.5 pr-2">{label}</td>
                  {outcomes.length > 0 && (
                    <td className="py-1.5 pr-2">
                      <div className="flex flex-wrap gap-1">
                        {outcomes.map((o) => {
                          const on = !!sc?.outcomes.includes(o.id);
                          return (
                            <button
                              key={o.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => set(when, { outcomes: on ? sc!.outcomes.filter((x) => x !== o.id) : [...(sc?.outcomes ?? []), o.id] })}
                              className={`rounded-full border px-2 py-0.5 ${on ? "border-emerald-700 bg-emerald-700 text-white" : "border-border bg-background hover:bg-muted"}`}
                            >
                              {o.name}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  )}
                  {results.matchEnabled && (
                    <td className="py-1.5">
                      <input
                        type="number"
                        step={1}
                        min={-100}
                        max={100}
                        aria-label={`Match points for ${label}`}
                        className="w-20 rounded-md border border-border bg-background px-1.5 py-1"
                        value={sc?.match ?? ""}
                        placeholder="0"
                        onChange={(e) => set(when, { match: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </details>
  );
}

// ------------------------------------------------------------------ results

/**
 * What the form works out from the answers, each switched on separately: an outcome (e.g. a work style; the answers'
 * points decide) and a match score (points earned out of the most possible, in bands). Each outcome and band has words
 * for the person and a note for the counsellor.
 */
function ResultsEditor({ def, onChange, readOnly, onFill }: { def: FormDef; onChange: (d: FormDef) => void; readOnly: boolean; onFill?: () => void }) {
  const r = def.results!;
  const set = (patch: Partial<Results>) => onChange({ ...def, results: { ...r, ...patch } });
  const setOutcome = (i: number, patch: Partial<Outcome>) => set({ outcomes: r.outcomes.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const setBand = (i: number, patch: Partial<Band>) => set({ bands: r.bands.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const scored = def.questions.filter((q) => (q.scores?.length ?? 0) > 0);
  const removeOutcome = (id: string) =>
    onChange({
      ...def,
      // The grid goes too when it showed this outcome
      results: { ...r, outcomes: r.outcomes.filter((o) => o.id !== id), grid: r.grid?.cells.includes(id) ? null : r.grid },
      // Points for it go too
      questions: def.questions.map((q) => (q.scores?.length ? { ...q, scores: q.scores.map((s) => ({ ...s, outcomes: s.outcomes.filter((x) => x !== id) })).filter((s) => s.outcomes.length || s.match) } : q)),
    });
  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <section className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
        <h2 className="text-sm font-semibold">How results work</h2>
        <p className="text-xs text-muted-foreground">
          Switch on an outcome, a match score or both. Then, in the Questions tab, open a question with options, yes/no or a slider and set what each answer
          counts for. Your team sees the result on the lead in your CRM, with your note on how to talk with them.
        </p>
        <p className="text-xs text-muted-foreground">
          {scored.length === 0 ? "No question counts towards results yet." : `${scored.length} question${scored.length > 1 ? "s count" : " counts"} towards results.`}
        </p>
        <Switch
          checked={r.showToPerson}
          onChange={(v) => set({ showToPerson: v })}
          title="Show people their results after they send"
          detail="Off: only your team sees them, in the CRM."
        />
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
        <Switch
          checked={r.outcomeEnabled}
          onChange={(v) => set({ outcomeEnabled: v, outcomes: v ? (r.outcomes.length === 0 ? [{ id: newId(), name: "" }, { id: newId(), name: "" }] : r.outcomes) : r.outcomes.filter((o) => o.name.trim()) })}
          title="Outcome"
          detail="Each answer gives points to one or more outcomes; the one with the most points is the result (e.g. a work style, or the course that suits them best)."
        />
        {r.outcomeEnabled && (
          <div className="space-y-3 border-l-2 border-border pl-4">
            <label className="block text-xs font-medium text-muted-foreground">
              Heading on the result
              <input className={input} value={r.outcomeTitle ?? ""} maxLength={80} placeholder="e.g. Your work style" onChange={(e) => set({ outcomeTitle: e.target.value })} />
            </label>
            <ol className="space-y-2">
              {r.outcomes.map((o, i) => (
                <li key={o.id} className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <input className={`${input} mt-0 font-medium`} value={o.name} maxLength={60} placeholder={`Outcome ${i + 1}, e.g. Analytical`} aria-label={`Outcome ${i + 1} name`} onChange={(e) => setOutcome(i, { name: e.target.value })} />
                    <button type="button" className={small} onClick={() => removeOutcome(o.id)} aria-label={`Remove ${o.name || `outcome ${i + 1}`}`}>
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    What the person reads
                    <textarea rows={2} className={input} value={o.summary ?? ""} maxLength={1500} onChange={(e) => setOutcome(i, { summary: e.target.value })} />
                  </label>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Note for your counsellor <span className="font-normal">(only in the CRM)</span>
                    <textarea rows={2} className={input} value={o.coaching ?? ""} maxLength={1500} placeholder="e.g. Give facts and proof; don't rush them." onChange={(e) => setOutcome(i, { coaching: e.target.value })} />
                  </label>
                </li>
              ))}
            </ol>
            {r.outcomes.length < 12 && (
              <button type="button" className={small} onClick={() => set({ outcomes: [...r.outcomes, { id: newId(), name: "" }] })}>
                <Plus aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" /> Add an outcome
              </button>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
        <Switch
          checked={r.matchEnabled}
          onChange={(v) =>
            set({
              matchEnabled: v,
              bands:
                v && r.bands.length === 0
                  ? [
                      { from: 0, label: "Let's talk" },
                      { from: 50, label: "A good match" },
                      { from: 80, label: "A great match" },
                    ]
                  : v
                    ? r.bands
                    : r.bands.filter((b) => b.label.trim()),
            })
          }
          title="Match score"
          detail="Answers earn match points; the score is the points earned out of the most possible, as a percentage (e.g. how well your school fits what they want). A skipped question earns no points."
        />
        {r.matchEnabled && (
          <div className="space-y-3 border-l-2 border-border pl-4">
            <label className="block text-xs font-medium text-muted-foreground">
              Heading on the score
              <input className={input} value={r.matchTitle ?? ""} maxLength={80} placeholder="e.g. School match" onChange={(e) => set({ matchTitle: e.target.value })} />
            </label>
            <p className="text-xs text-muted-foreground">Bands: the highest one the score reaches applies. One band starts at 0%, for the lowest scores.</p>
            {r.bands.length > 0 && !r.bands.some((b) => b.from === 0) && (
              <p role="alert" className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                No band starts at 0%, so low scores would have no words. Set one band to start at 0%.
              </p>
            )}
            <ol className="space-y-2">
              {r.bands.map((b, i) => (
                <li key={i} className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    From
                    <input
                      type="number"
                      min={0}
                      max={100}
                      aria-label={`Band ${i + 1} starts at`}
                      className="w-16 rounded-md border border-border bg-background px-2 py-1"
                      value={b.from}
                      onChange={(e) => setBand(i, { from: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })}
                    />
                    %
                    <input className={`${input} mt-0 min-w-40 flex-1 font-medium`} value={b.label} maxLength={60} placeholder="e.g. A great match" aria-label={`Band ${i + 1} name`} onChange={(e) => setBand(i, { label: e.target.value })} />
                    <button type="button" className={small} disabled={r.bands.length === 1} onClick={() => set({ bands: r.bands.filter((_, j) => j !== i) })} aria-label={`Remove band ${i + 1}`}>
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    What the person reads
                    <textarea rows={2} className={input} value={b.message ?? ""} maxLength={1000} onChange={(e) => setBand(i, { message: e.target.value })} />
                  </label>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Note for your counsellor <span className="font-normal">(only in the CRM)</span>
                    <textarea rows={2} className={input} value={b.coaching ?? ""} maxLength={1000} onChange={(e) => setBand(i, { coaching: e.target.value })} />
                  </label>
                </li>
              ))}
            </ol>
            {r.bands.length < 6 && (
              <button type="button" className={small} onClick={() => set({ bands: [...r.bands, { from: Math.min(100, (r.bands.at(-1)?.from ?? 0) + 10), label: "" }] })}>
                <Plus aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" /> Add a band
              </button>
            )}
          </div>
        )}
      </section>

      <ReportSettings r={r} set={set} onFill={onFill} />
    </fieldset>
  );
}

/** The person's report: heading, introduction, next steps for a score, sharing, and the outcomes as a grid */
function ReportSettings({ r, set, onFill }: { r: Results; set: (p: Partial<Results>) => void; onFill?: () => void }) {
  const named = r.outcomes.filter((o) => o.name.trim());
  const grid = r.grid ?? null;
  const setGrid = (patch: Partial<NonNullable<Results["grid"]>>) => grid && set({ grid: { ...grid, ...patch } });
  const CELLS = ["Top left", "Top right", "Bottom left", "Bottom right"];
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">The person&apos;s report</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Their private report (linked on the thank-you page and in the results email): the score, your next steps, your introduction, then each step with their
            answers and what you say about them (set on each step and question).
          </p>
        </div>
        {onFill && (
          <button type="button" className={small} onClick={onFill}>
            Fill empty texts from the template
          </button>
        )}
      </div>
      <label className="block text-xs font-medium text-muted-foreground">
        Report heading
        <input className={input} value={r.reportTitle ?? ""} maxLength={120} placeholder="e.g. Your IT career training readiness report" onChange={(e) => set({ reportTitle: e.target.value })} />
      </label>
      <label className="block text-xs font-medium text-muted-foreground">
        Your introduction <span className="font-normal">({"{institute}"} is your name)</span>
        <textarea rows={3} className={input} value={r.intro ?? ""} maxLength={2000} placeholder="What your school offers, and what this report is for." onChange={(e) => set({ intro: e.target.value })} />
      </label>

      <div className="space-y-2 rounded-xl border border-border p-3">
        <p className="text-xs font-semibold">Next steps under the score</p>
        <label className="flex flex-wrap items-center gap-2 text-xs">
          Show from a score of
          <input
            type="number"
            min={0}
            max={100}
            className="w-16 rounded-md border border-border bg-background px-2 py-1"
            value={r.nextFrom ?? ""}
            placeholder="any"
            aria-label="Show next steps from this score"
            onChange={(e) => set({ nextFrom: e.target.value === "" ? null : Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })}
          />
          % <span className="text-muted-foreground">(blank: everyone)</span>
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Heading
          <input className={input} value={r.nextTitle ?? ""} maxLength={200} placeholder="e.g. Congratulations! You qualify for a free consultation" onChange={(e) => set({ nextTitle: e.target.value })} />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Line under it
          <input className={input} value={r.nextText ?? ""} maxLength={300} placeholder="e.g. Talk through your results with an admissions adviser." onChange={(e) => set({ nextText: e.target.value })} />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Button
            <input className={input} value={r.nextLabel ?? ""} maxLength={40} placeholder="e.g. Book my consultation" onChange={(e) => set({ nextLabel: e.target.value })} />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Button link <span className="font-normal">(https; no link, no button)</span>
            <input className={input} type="url" value={r.nextUrl ?? ""} maxLength={500} placeholder="https://" onChange={(e) => set({ nextUrl: e.target.value || null })} />
          </label>
        </div>
      </div>

      <Switch
        checked={!!r.share}
        onChange={(v) => set({ share: v })}
        title="Share buttons"
        detail="People can share their score on Facebook, X or LinkedIn, or copy a link. The link is to this form, never to their report or answers."
      />

      {r.outcomeEnabled && named.length >= 4 && (
        <div className="space-y-2">
          <Switch
            checked={!!grid}
            onChange={(v) =>
              set({ grid: v ? { top: "Focus on tasks", bottom: "Focus on people", left: "Asks", right: "Tells", cells: named.slice(0, 4).map((o) => o.id) } : null })
            }
            title="Show the outcomes as a grid"
            detail="Four outcomes in a two-by-two grid with words at each end of the axes (e.g. social styles), theirs picked out."
          />
          {grid && (
            <div className="grid gap-2 border-l-2 border-border pl-4 sm:grid-cols-2">
              {CELLS.map((label, i) => (
                <label key={label} className="block text-xs font-medium text-muted-foreground">
                  {label}
                  <select
                    className={input}
                    value={grid.cells[i] ?? ""}
                    onChange={(e) => setGrid({ cells: grid.cells.map((c, j) => (j === i ? e.target.value : c)) })}
                  >
                    {named.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {(["top", "bottom", "left", "right"] as const).map((end) => (
                <label key={end} className="block text-xs font-medium capitalize text-muted-foreground">
                  {end} end
                  <input className={input} value={grid[end]} maxLength={40} onChange={(e) => setGrid({ [end]: e.target.value })} />
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
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
        <div role="radiogroup" aria-label="Layout" className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["classic", "Classic", "A clean card that fits into your page."],
              ["cover", "Photo background", "A full-page photo behind the form, each step's title over it. On your website and the public link."],
            ] as const
          ).map(([value, title, detail]) => {
            const on = (s.layout ?? "classic") === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ layout: value })}
                className={`rounded-xl border p-3 text-left text-xs ${on ? "border-cyan-600 bg-cyan-600/5 ring-1 ring-cyan-600" : "border-border hover:bg-muted"}`}
              >
                <span
                  aria-hidden="true"
                  className="mb-2 flex h-14 items-center justify-center rounded-lg bg-cover bg-center"
                  style={value === "cover" ? { backgroundImage: s.backgroundUrl ? `url(${JSON.stringify(s.backgroundUrl)})` : `linear-gradient(135deg, ${s.accent || "#4f46e5"}, #0f172a)` } : { background: "var(--muted)" }}
                >
                  <span className="h-8 w-16 rounded-md bg-background shadow" />
                </span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="text-muted-foreground">{detail}</span>
              </button>
            );
          })}
        </div>
        {s.layout === "cover" && (
          <label className="block text-xs font-medium text-muted-foreground">
            Background photo (https link to an image; without one, your colour is used)
            <input className={input} value={s.backgroundUrl ?? ""} maxLength={500} placeholder="https://your-site.example/campus.jpg" onChange={(e) => set({ backgroundUrl: e.target.value })} />
            <span className="mt-1 block font-normal">Use a photo you have the rights to, at least 1600 pixels wide. It&apos;s darkened so the titles stay readable.</span>
          </label>
        )}
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
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
        <div>
          <h2 className="text-sm font-semibold">People who don&apos;t finish</h2>
          <p className="text-xs text-muted-foreground">For the public link and your website. Answers are always kept in the person&apos;s own browser, so they can pick up where they left off.</p>
        </div>
        <Switch
          checked={!!s.savePartial}
          onChange={(v) => set({ savePartial: v })}
          title="Save answers as people go"
          detail="Once someone has given their email or phone and moves to the next step, what they've filled in reaches your CRM under Incomplete, even if they never press Send. If they finish later, it becomes a normal lead."
        />
        {s.savePartial && (
          <div className="space-y-3 border-l-2 border-border pl-4">
            <label className="block text-xs font-medium text-muted-foreground">
              Start saving after
              <select className={input} value={s.partialAfter ?? ""} onChange={(e) => set({ partialAfter: e.target.value || null })}>
                <option value="">Their contact details (asked first, so you can follow up)</option>
                {def.questions
                  .filter((q) => q.kind !== "info")
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      The step with “{q.label.length > 60 ? `${q.label.slice(0, 60)}…` : q.label}”
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Message shown on the form
              <input
                className={input}
                value={s.partialNotice ?? ""}
                maxLength={300}
                placeholder={DEFAULT_PARTIAL_NOTICE}
                onChange={(e) => set({ partialNotice: e.target.value })}
              />
              <span className="mt-1 block font-normal">{"{institute}"} becomes your institute&apos;s name. Translate it in the Translations tab.</span>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Remove unfinished answers after
              <span className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  value={s.partialRetentionDays ?? 30}
                  onChange={(e) => set({ partialRetentionDays: Math.round(Number(e.target.value) || 0) })}
                />
                <span className="font-normal">days (1 to 365). Leads your team has worked on are kept.</span>
              </span>
            </label>
            <Switch
              checked={!!s.notifyOnPartial}
              onChange={(v) => set({ notifyOnPartial: v })}
              title="Email my team when someone stops part way"
              detail="Your CRM admins (or the whole team if there are none) get an email with a link to the lead."
            />
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
        <div>
          <h2 className="text-sm font-semibold">Protection against bots and fake requests</h2>
          <p className="text-xs text-muted-foreground">For the public link and your website. Members signed in to Edulexa are already verified.</p>
        </div>
        <Switch
          checked={s.requireEmailConfirmation !== false}
          onChange={(v) => set({ requireEmailConfirmation: v })}
          title="Confirm by email (recommended)"
          detail="Requests reach your CRM straight away, marked “Email not confirmed” until the person clicks the link in an email. Messages to them wait for it, so nothing goes to a mistyped or someone else's address."
        />
        <Switch
          checked={!!s.requirePhoneCheck}
          onChange={(v) => set({ requirePhoneCheck: v, askPhone: v || s.askPhone, phoneRequired: v || s.phoneRequired })}
          title="Check the phone number by SMS code"
          detail="People enter a code we send to their phone. Needs your Pulse Relay connection (Career centre → Settings → Chat & SMS); each code is a normal SMS."
        />
        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Always on</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>A hidden field bots fill in, and a check that the form wasn&apos;t sent within seconds of opening (timed by our server).</li>
            <li>Limits on how often one visitor can send, and on files.</li>
            <li>An invisible human check by Cloudflare, once Edulexa has it switched on.</li>
            <li>
              A spam check (throwaway emails, links, random text, repeats): suspicious requests go to <span className="font-medium text-foreground">Possible spam</span> in your CRM,
              never deleted.
            </li>
          </ul>
        </div>
      </section>
    </fieldset>
  );
}

function Switch({ checked, onChange, title, detail }: { checked: boolean; onChange: (v: boolean) => void; title: string; detail: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-5 w-9 rounded-full bg-muted-foreground/30 transition-colors peer-checked:bg-cyan-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan-600" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
