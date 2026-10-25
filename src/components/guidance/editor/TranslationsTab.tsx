"use client";

/**
 * Translating a form: every text of the form (heading, introduction, thank-you, step titles, questions, help texts,
 * options) beside its translation, one language at a time, with a count of what's still missing.
 */

import React, { useState } from "react";
import type { FormDef, FormText } from "@/components/guidance/form/model";

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
  const setQ = (id: string, key: keyof FormText, v: string | string[]) =>
    onChange({ ...def, questions: def.questions.map((q) => (q.id === id ? { ...q, translations: put(q.translations, key, v) } : q)) });

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
  def.sections.forEach((s) => count(s.title, s.translations?.[current]?.title));
  def.questions.forEach((q) => {
    count(q.label, q.translations?.[current]?.label);
    count(q.help, q.translations?.[current]?.help);
    if (q.options.length) count("options", q.translations?.[current]?.options?.length === q.options.length ? "ok" : "");
  });

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
                {q.options.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p className="whitespace-pre-line rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{q.options.join("\n")}</p>
                    <textarea
                      rows={q.options.length}
                      aria-label="Options, one per line, in the same order"
                      placeholder="One per line, same order"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
                      value={(q.translations?.[current]?.options ?? []).join("\n")}
                      onChange={(e) => setQ(q.id, "options", e.target.value.split("\n"))}
                    />
                  </div>
                )}
              </div>
            ))}
        </Group>
      ))}
    </fieldset>
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
