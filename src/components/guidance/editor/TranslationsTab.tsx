"use client";

/**
 * Translating a form: every text of the form (heading, introduction, thank-you, step titles, questions, help texts,
 * options, slider and scale ends, list columns and their choices, and the results people read) beside its translation,
 * one language at a time, with a count of what's still missing.
 */

import React, { useState } from "react";
import type { FormDef, FormText, ResultsText } from "@/components/guidance/form/model";

type Texts = Record<string, FormText> | undefined;

export default function TranslationsTab({
  def,
  onChange,
  languages,
  readOnly,
}: {
  def: FormDef;
  onChange: (d: FormDef) => void;
  languages: { code: string; name: string }[];
  readOnly: boolean;
}) {
  const others = def.languages.slice(1);
  const [lang, setLang] = useState(others[0] ?? "");
  const nameOf = (c: string) => languages.find((l) => l.code === c)?.name ?? c;

  if (others.length === 0)
    return (
      <div className="max-w-xl rounded-2xl border border-border bg-card p-5 text-sm">
        <p className="font-medium">This form is in one language</p>
        <p className="mt-1 text-muted-foreground">Add languages in Settings (for example हिन्दी or தமிழ்); then translate each text here. People pick their language on the form.</p>
      </div>
    );
  const current = others.includes(lang) ? lang : others[0];

  const put = (t: Texts, key: keyof FormText, value: string | string[]): Record<string, FormText> => ({ ...(t ?? {}), [current]: { ...(t?.[current] ?? {}), [key]: value } });
  const setS = (key: keyof FormText, v: string) => onChange({ ...def, settings: { ...def.settings, translations: put(def.settings.translations, key, v) } });
  const setSection = (id: string, key: keyof FormText, v: string) =>
    onChange({ ...def, sections: def.sections.map((s) => (s.id === id ? { ...s, translations: put(s.translations, key, v) } : s)) });
  const setQ = (id: string, key: keyof FormText, v: string | string[] | string[][]) =>
    onChange({ ...def, questions: def.questions.map((q) => (q.id === id ? { ...q, translations: { ...(q.translations ?? {}), [current]: { ...(q.translations?.[current] ?? {}), [key]: v } } } : q)) });
  const r = def.results;
  const rt: ResultsText = r?.translations?.[current] ?? {};
  const setR = (patch: Partial<ResultsText>) => r && onChange({ ...def, results: { ...r, translations: { ...(r.translations ?? {}), [current]: { ...rt, ...patch } } } });
  // Outcomes and bands line up one to one with the form's own
  const line = (list: { name?: string | null; summary?: string | null }[] | null | undefined, n: number) => Array.from({ length: n }, (_, i) => list?.[i] ?? {});
  const setOutcome = (i: number, key: "name" | "summary", v: string) => setR({ outcomes: line(rt.outcomes, r!.outcomes.length).map((x, j) => (j === i ? { ...x, [key]: v } : x)) });
  const setBand = (i: number, key: "name" | "summary", v: string) => setR({ bands: line(rt.bands, r!.bands.length).map((x, j) => (j === i ? { ...x, [key]: v } : x)) });
  const results = !!r && (r.outcomeEnabled || r.matchEnabled) && r.showToPerson;

  // What still needs translating
  let total = 0;
  let missing = 0;
  const count = (orig: string | null | undefined, t: string | null | undefined) => {
    if (!orig) return;
    total++;
    if (!t?.trim()) missing++;
  };
  count(def.settings.title, def.settings.translations?.[current]?.title);
  count(def.settings.intro, def.settings.translations?.[current]?.description);
  count(def.settings.thankYou, def.settings.translations?.[current]?.label);
  if (def.settings.savePartial) count(def.settings.partialNotice, def.settings.translations?.[current]?.notice);
  def.sections.forEach((s) => count(s.title, s.translations?.[current]?.title));
  def.questions.forEach((q) => {
    const t = q.translations?.[current];
    count(q.label, t?.label);
    count(q.help, t?.help);
    if (q.options.length) count("options", t?.options?.length === q.options.length ? "ok" : "");
    if (q.kind === "scale" || q.kind === "slider") {
      count(q.minLabel, t?.minLabel);
      count(q.maxLabel, t?.maxLabel);
    }
    (q.columns ?? []).forEach((c, i) => {
      count(c.label, t?.columns?.[i]);
      if (c.options.length) count("choices", t?.columnOptions?.[i]?.length === c.options.length ? "ok" : "");
    });
  });
  if (results) {
    if (r!.outcomeEnabled) {
      count(r!.outcomeTitle, rt.outcomeTitle);
      r!.outcomes.forEach((o, i) => {
        count(o.name, rt.outcomes?.[i]?.name);
        count(o.summary, rt.outcomes?.[i]?.summary);
      });
    }
    if (r!.matchEnabled) {
      count(r!.matchTitle, rt.matchTitle);
      r!.bands.forEach((b, i) => {
        count(b.label, rt.bands?.[i]?.name);
        count(b.message, rt.bands?.[i]?.summary);
      });
    }
  }

  return (
    <fieldset disabled={readOnly} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {others.map((l) => (
          <button key={l} type="button" aria-pressed={current === l} onClick={() => setLang(l)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${current === l ? "border-cyan-700 bg-cyan-700 text-white" : "border-border bg-card hover:bg-muted"}`}>
            {nameOf(l)}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {missing === 0 ? "Everything is translated." : `${missing} of ${total} texts not translated yet (they show in ${nameOf(def.languages[0])}).`}
        </span>
      </div>

      <Group title="Form texts">
        <Row original={def.settings.title} value={def.settings.translations?.[current]?.title} onChange={(v) => setS("title", v)} />
        <Row original={def.settings.intro} value={def.settings.translations?.[current]?.description} onChange={(v) => setS("description", v)} long />
        <Row original={def.settings.thankYou} value={def.settings.translations?.[current]?.label} onChange={(v) => setS("label", v)} long />
        {def.settings.savePartial && <Row original={def.settings.partialNotice} value={def.settings.translations?.[current]?.notice} onChange={(v) => setS("notice", v)} />}
      </Group>

      {def.sections.map((s) => (
        <Group key={s.id} title={`Step: ${s.title}`}>
          <Row original={s.title} value={s.translations?.[current]?.title} onChange={(v) => setSection(s.id, "title", v)} />
          <Row original={s.description} value={s.translations?.[current]?.description} onChange={(v) => setSection(s.id, "description", v)} />
          {def.questions
            .filter((q) => q.sectionId === s.id)
            .map((q) => (
              <div key={q.id} className="space-y-2 rounded-xl border border-border p-3">
                <Row original={q.label} value={q.translations?.[current]?.label} onChange={(v) => setQ(q.id, "label", v)} />
                <Row original={q.help} value={q.translations?.[current]?.help} onChange={(v) => setQ(q.id, "help", v)} />
                <Row original={q.placeholder} value={q.translations?.[current]?.placeholder} onChange={(v) => setQ(q.id, "placeholder", v)} />
                {q.options.length > 0 && <Lines original={q.options} value={q.translations?.[current]?.options} onChange={(v) => setQ(q.id, "options", v)} />}
                {(q.kind === "scale" || q.kind === "slider") && (
                  <>
                    <Row original={q.minLabel} value={q.translations?.[current]?.minLabel} onChange={(v) => setQ(q.id, "minLabel", v)} />
                    <Row original={q.maxLabel} value={q.translations?.[current]?.maxLabel} onChange={(v) => setQ(q.id, "maxLabel", v)} />
                  </>
                )}
                {(q.columns ?? []).map((c, i) => {
                  const t = q.translations?.[current];
                  const cols = Array.from({ length: q.columns!.length }, (_, j) => t?.columns?.[j] ?? "");
                  const opts = Array.from({ length: q.columns!.length }, (_, j) => t?.columnOptions?.[j] ?? []);
                  return (
                    <div key={c.id} className="space-y-2">
                      <Row original={c.label} value={cols[i]} onChange={(v) => setQ(q.id, "columns", cols.map((x, j) => (j === i ? v : x)))} />
                      {c.options.length > 0 && (
                        <Lines original={c.options} value={opts[i]} onChange={(v) => setQ(q.id, "columnOptions", opts.map((x, j) => (j === i ? v : x)))} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
        </Group>
      ))}

      {results && (
        <Group title="Results people read">
          {r!.outcomeEnabled && (
            <>
              <Row original={r!.outcomeTitle} value={rt.outcomeTitle} onChange={(v) => setR({ outcomeTitle: v })} />
              {r!.outcomes.map((o, i) => (
                <div key={o.id} className="space-y-2 rounded-xl border border-border p-3">
                  <Row original={o.name} value={rt.outcomes?.[i]?.name} onChange={(v) => setOutcome(i, "name", v)} />
                  <Row original={o.summary} value={rt.outcomes?.[i]?.summary} onChange={(v) => setOutcome(i, "summary", v)} long />
                </div>
              ))}
            </>
          )}
          {r!.matchEnabled && (
            <>
              <Row original={r!.matchTitle} value={rt.matchTitle} onChange={(v) => setR({ matchTitle: v })} />
              {r!.bands.map((b, i) => (
                <div key={b.from} className="space-y-2 rounded-xl border border-border p-3">
                  <Row original={b.label} value={rt.bands?.[i]?.name} onChange={(v) => setBand(i, "name", v)} />
                  <Row original={b.message} value={rt.bands?.[i]?.summary} onChange={(v) => setBand(i, "summary", v)} long />
                </div>
              ))}
            </>
          )}
          <p className="text-xs text-muted-foreground">Notes for counsellors aren&apos;t translated: only your team reads them.</p>
        </Group>
      )}
    </fieldset>
  );
}

/** Choices, one per line beside their translations in the same order */
function Lines({ original, value, onChange }: { original: string[]; value: string[] | null | undefined; onChange: (v: string[]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <p className="whitespace-pre-line rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{original.join("\n")}</p>
      <textarea
        rows={original.length}
        aria-label="Translations, one per line, in the same order"
        placeholder="One per line, same order"
        className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
        value={(value ?? []).join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
      />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Row({ original, value, onChange, long }: { original: string | null | undefined; value: string | null | undefined; onChange: (v: string) => void; long?: boolean }) {
  if (!original) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <p className="whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{original}</p>
      {long ? (
        <textarea rows={2} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
