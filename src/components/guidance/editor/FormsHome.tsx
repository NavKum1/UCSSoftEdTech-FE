"use client";

/**
 * An institute's guidance forms (or Edulexa's own, for advisors): each form with its status, link and submissions; a new
 * form from a ready-made template (school career cell, college placement cell, coaching, upskilling) or a copy; and the
 * details shown on the institute's card when people choose an institute to talk to.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, FileText, Plus, Star, Trash2, X } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import GuidanceForm from "@/components/guidance/form/GuidanceForm";
import type { FormDef } from "@/components/guidance/form/model";

interface FormRow {
  id: string;
  name: string;
  isDefault: boolean;
  publicEnabled: boolean;
  version: number;
  publishedAt: string;
  hasDraft: boolean;
  submissions: number;
  link: string;
}
interface Template {
  key: string;
  name: string;
  audience: string;
  description: string;
  definition: FormDef;
}
interface Profile {
  city: string | null;
  modes: string[];
  feesRange: string | null;
  about: string | null;
}

const card = "rounded-2xl border border-border bg-card p-5";
const input = "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const MODES = ["Online", "In person", "Hybrid"];

export default function FormsHome({
  instituteId,
  basePath,
  title,
  intro,
  withProfile = true,
}: {
  /** Whose forms; omitted: the signed-in admin's institute */
  instituteId?: string;
  /** Where a form opens: `${basePath}/${formId}` */
  basePath: string;
  title: string;
  intro: React.ReactNode;
  withProfile?: boolean;
}) {
  const q = instituteId ? `?instituteId=${instituteId}` : "";
  const router = useRouter();
  const { apiFetch, ready, access } = useLegacyApi();
  const [forms, setForms] = useState<FormRow[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/guidance-forms${q}`);
    if (!res.ok) return setNotice({ ok: false, text: "We couldn't load your forms." });
    const d = await res.json();
    setForms(d.forms);
    setCanEdit(d.canEdit);
  }, [apiFetch, q]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) loadRef.current();
  }, [ready, loadRef]);

  const act = async (path: string, method: string, done: string) => {
    setNotice(null);
    const res = await apiFetch(path, { method });
    const d = await res.json().catch(() => null);
    if (!res.ok) return setNotice({ ok: false, text: d?.error ?? "That didn't work. Please try again." });
    setNotice({ ok: true, text: done });
    load();
  };

  if (access) return <AccessNotice problem={access} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{intro}</p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-cyan-800">
            <Plus aria-hidden="true" className="h-4 w-4" /> New form
          </button>
        )}
      </div>

      {notice && (
        <p role={notice.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${notice.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-800 dark:text-red-300"}`}>
          {notice.text}
        </p>
      )}

      {!forms ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {forms.map((f) => (
            <li key={f.id} className={`${card} flex flex-col gap-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`${basePath}/${f.id}`} className="inline-flex items-center gap-1.5 text-base font-semibold hover:underline">
                    <FileText aria-hidden="true" className="h-4 w-4 text-cyan-700" /> {f.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                    {f.isDefault && <Badge tone="cyan">Used for “Ask an advisor”</Badge>}
                    <Badge tone={f.publicEnabled ? "emerald" : "zinc"}>{f.publicEnabled ? "Public link on" : "Public link off"}</Badge>
                    <Badge tone="zinc">Version {f.version}</Badge>
                    {f.hasDraft && <Badge tone="amber">Unpublished changes</Badge>}
                  </div>
                </div>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  <span className="block text-lg font-semibold tabular-nums text-foreground">{f.submissions.toLocaleString()}</span>
                  sent
                </span>
              </div>
              <div className="mt-auto flex flex-wrap gap-1.5">
                <Link href={`${basePath}/${f.id}`} className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-800">
                  {canEdit ? "Edit" : "Open"}
                </Link>
                <Link href={`${basePath}/${f.id}?tab=insights`} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">
                  Insights
                </Link>
                {f.publicEnabled && (
                  <>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(f.link).then(() => setCopied(f.id))}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
                    >
                      <Copy aria-hidden="true" className="h-3 w-3" /> {copied === f.id ? "Copied" : "Copy link"}
                    </button>
                    <a href={f.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">
                      <ExternalLink aria-hidden="true" className="h-3 w-3" /> Open
                    </a>
                  </>
                )}
                {canEdit && (
                  <>
                    <button type="button" onClick={() => createCopy(apiFetch, q, f, router, basePath, setNotice)} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">
                      Duplicate
                    </button>
                    {!f.isDefault && (
                      <>
                        <button type="button" onClick={() => act(`/api/guidance-forms/${f.id}/default`, "POST", `"${f.name}" is now used for “Ask an advisor”.`)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">
                          <Star aria-hidden="true" className="h-3 w-3" /> Use for “Ask an advisor”
                        </button>
                        <button
                          type="button"
                          onClick={() => window.confirm(`Remove "${f.name}"? Its link stops working; inquiries already sent are kept.`) && act(`/api/guidance-forms/${f.id}`, "DELETE", `"${f.name}" removed.`)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-red-700 hover:bg-red-500/10 dark:text-red-400"
                        >
                          <Trash2 aria-hidden="true" className="h-3 w-3" /> Remove
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {withProfile && canEdit && <ProfileCard apiFetch={apiFetch} q={q} ready={ready} />}

      {creating && (
        <NewForm
          apiFetch={apiFetch}
          instituteId={instituteId}
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push(`${basePath}/${id}`)}
        />
      )}
    </div>
  );
}

async function createCopy(
  apiFetch: (p: string, i?: RequestInit) => Promise<Response>,
  q: string,
  f: FormRow,
  router: ReturnType<typeof useRouter>,
  basePath: string,
  setNotice: (n: { ok: boolean; text: string }) => void,
) {
  const instituteId = new URLSearchParams(q).get("instituteId");
  const res = await apiFetch(`/api/guidance-forms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instituteId, copyOf: f.id }) });
  const d = await res.json().catch(() => null);
  if (!res.ok) return setNotice({ ok: false, text: d?.error ?? "The form couldn't be copied." });
  router.push(`${basePath}/${d.id}`);
}

function Badge({ tone, children }: { tone: "cyan" | "emerald" | "zinc" | "amber"; children: React.ReactNode }) {
  const c = {
    cyan: "bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-500/30",
    emerald: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
    zinc: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
    amber: "bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-500/30",
  }[tone];
  return <span className={`rounded-full border px-2 py-0.5 font-medium ${c}`}>{children}</span>;
}

function NewForm({
  apiFetch,
  instituteId,
  onClose,
  onCreated,
}: {
  apiFetch: (p: string, i?: RequestInit) => Promise<Response>;
  instituteId?: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pick, setPick] = useState("general");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch("/api/guidance-forms/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates))
      .catch(() => setError("Templates couldn't be loaded."));
  }, [apiFetch]);

  const chosen = templates.find((t) => t.key === pick);
  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await apiFetch("/api/guidance-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instituteId: instituteId ?? null, template: pick, name: name.trim() || null }),
    });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(d?.error ?? "The form couldn't be created.");
    onCreated(d.id);
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="new-form-title" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="new-form-title" className="text-base font-semibold">
            New form
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-muted">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 md:grid-cols-[22rem,1fr]">
          <div className="space-y-2 overflow-y-auto border-r border-border p-4">
            <p className="text-xs font-medium text-muted-foreground">Start from</p>
            {templates.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setPick(t.key)}
                aria-pressed={pick === t.key}
                className={`block w-full rounded-xl border p-3 text-left text-sm ${pick === t.key ? "border-cyan-600 bg-cyan-600/5" : "border-border hover:bg-muted"}`}
              >
                <span className="font-medium">{t.name}</span>
                <span className="block text-xs text-muted-foreground">For: {t.audience}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{t.description}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t.definition.questions.length} questions · {t.definition.sections.length} {t.definition.sections.length === 1 ? "step" : "steps"}
                </span>
              </button>
            ))}
            <label className="block pt-2 text-xs font-medium text-muted-foreground">
              Name
              <input className={input} value={name} maxLength={120} placeholder={chosen?.name ?? "e.g. Data Science open day 2027"} onChange={(e) => setName(e.target.value)} />
            </label>
            {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
            <button type="button" disabled={busy || !chosen} onClick={create} className="w-full rounded-lg bg-cyan-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-50">
              Create and edit
            </button>
            <p className="text-xs text-muted-foreground">You can change every question before publishing.</p>
          </div>
          <div className="overflow-y-auto bg-muted/30 p-5">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Preview</p>
            {chosen && (
              <div className="mx-auto max-w-lg rounded-2xl border border-border bg-background p-5">
                <GuidanceForm
                  key={chosen.key}
                  fill={{ formId: "preview", name: chosen.name, version: 1, instituteId: "", instituteName: "your institute", definition: chosen.definition, languageNames: { en: "English" } }}
                  mode="preview"
                  consentText="Send this to your institute so an advisor can contact me."
                  onSubmit={async () => null}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileCard({ apiFetch, q, ready }: { apiFetch: (p: string, i?: RequestInit) => Promise<Response>; q: string; ready: boolean }) {
  const [p, setP] = useState<Profile>({ city: null, modes: [], feesRange: null, about: null });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!ready) return;
    apiFetch(`/api/guidance-forms/profile${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setP(d))
      .catch(() => undefined);
  }, [apiFetch, q, ready]);
  const save = async () => {
    const res = await apiFetch(`/api/guidance-forms/profile${q}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: "That couldn't be saved." });
  };
  return (
    <section className={card}>
      <h2 className="text-base font-semibold">Your institute&apos;s card</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Shown when people on Edulexa choose an institute to talk to. Only what you fill in is shown, with your real courses.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          City
          <input className={input} value={p.city ?? ""} maxLength={120} onChange={(e) => setP({ ...p, city: e.target.value })} />
        </label>
        <label className="text-sm">
          Fees range
          <input className={input} value={p.feesRange ?? ""} maxLength={200} placeholder="e.g. ₹40,000 to ₹80,000" onChange={(e) => setP({ ...p, feesRange: e.target.value })} />
        </label>
        <fieldset className="text-sm sm:col-span-2">
          <legend>How you teach</legend>
          <div className="mt-1 flex gap-3">
            {MODES.map((m) => (
              <label key={m} className="flex items-center gap-1.5">
                <input type="checkbox" checked={p.modes.includes(m)} onChange={(e) => setP({ ...p, modes: e.target.checked ? [...p.modes, m] : p.modes.filter((x) => x !== m) })} />
                {m}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-sm sm:col-span-2">
          About
          <textarea className={input} rows={3} value={p.about ?? ""} maxLength={600} onChange={(e) => setP({ ...p, about: e.target.value })} />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={save} className="rounded-lg bg-cyan-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-cyan-800">
          Save card
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
