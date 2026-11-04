"use client";

/**
 * An institute's guidance forms (or Edulexa's own, for advisors): each form with its status, link and submissions; a new
 * form from a ready-made template (school career cell, college placement cell, coaching, upskilling) or a copy; and the
 * details shown on the institute's card when people choose an institute to talk to.
 */

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Code2, Copy, ExternalLink, FileText, Plus, Star, Trash2, X } from "lucide-react";
import EmbedBuilder from "./EmbedBuilder";
import NotificationsView from "./NotificationsView";
import StatisticsView from "./StatisticsView";
import SiteCard from "./SiteCard";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import GuidanceForm from "@/components/guidance/form/GuidanceForm";
import type { FormDef } from "@/components/guidance/form/model";
import { Badge as UiBadge, PageHeader, Tabs, brandFill, buttonClass } from "@/components/career/ui";
import { useEn } from "@/lib/english/EnglishProvider";
import { useSchoolCountry } from "@/components/institute/SchoolEnglish";

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
  /** The kind of organisation it's for: school, college, training, coaching, any */
  group: string;
  /** An ISO code when its wording is for one country, "any" otherwise */
  country: string;
  definition: FormDef;
}

const GROUP_NAMES: Record<string, string> = {
  school: "Schools",
  college: "Colleges and universities",
  training: "Career and training schools",
  coaching: "Coaching",
  any: "Anyone",
};
const COUNTRY_NAMES: Record<string, string> = { IN: "India", US: "United States" };

/** What the person gets back: the score and the result */
function reportOf(d: FormDef) {
  const r = d.results;
  const parts = [r?.matchEnabled && r.matchTitle, r?.outcomeEnabled && r.outcomeTitle].filter(Boolean);
  return parts.length ? `Report: ${parts.join(" + ")}` : null;
}
interface Profile {
  city: string | null;
  modes: string[];
  feesRange: string | null;
  about: string | null;
}

const card = "rounded-xl border border-border bg-card p-5 shadow-sm";
const small = "inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted";
const input = "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const MODES = ["Online", "In person", "Hybrid"];
const noSubscribe = () => () => undefined;
type View = "forms" | "statistics" | "notifications";

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
  const en = useEn();
  const q = instituteId ? `?instituteId=${instituteId}` : "";
  const router = useRouter();
  const { apiFetch, ready, access } = useLegacyApi();
  const [forms, setForms] = useState<FormRow[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [embedFor, setEmbedFor] = useState<FormRow | null>(null);
  const [owner, setOwner] = useState<string>("");
  // The forms, or every automatic message they sent (?view=notifications, e.g. from a form's Automatic messages tab)
  const fromUrl = useSyncExternalStore(noSubscribe, () => new URLSearchParams(window.location.search).get("view"), () => null);
  const [picked, setPicked] = useState<View | null>(null);
  const view: View = picked ?? (fromUrl === "notifications" || fromUrl === "statistics" ? fromUrl : "forms");
  const showView = (v: View) => {
    setPicked(v);
    const u = new URL(window.location.href);
    if (v !== "forms") u.searchParams.set("view", v);
    else u.searchParams.delete("view");
    window.history.replaceState(null, "", u);
  };

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/guidance-forms${q}`);
    if (!res.ok) return setNotice({ ok: false, text: en("We couldn't load your forms.") });
    const d = await res.json();
    setForms(d.forms);
    setCanEdit(d.canEdit);
    setOwner(d.instituteId);
  }, [apiFetch, q, en]);
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
      <PageHeader
        title={title}
        description={intro}
        actions={
          canEdit && (
            <button type="button" onClick={() => setCreating(true)} className={buttonClass("primary")} style={brandFill}>
              <Plus aria-hidden="true" className="h-4 w-4" />{en(" New form")}
            </button>
          )
        }
      />

      {notice && (
        <p role={notice.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${notice.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-800 dark:text-red-300"}`}>
          {notice.text}
        </p>
      )}

      <Tabs<View>
        label={en("Forms and messages")}
        value={view}
        onChange={showView}
        items={[
          { id: "forms", label: en("Forms") },
          { id: "statistics", label: en("Statistics") },
          { id: "notifications", label: en("Notifications") },
        ]}
      />

      {view === "statistics" ? (
        <StatisticsView instituteId={instituteId} />
      ) : view === "notifications" ? (
        <NotificationsView instituteId={instituteId} forms={forms ?? []} canEdit={canEdit} />
      ) : !forms ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-busy="true" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {forms.map((f) => (
            <li key={f.id} className={`${card} flex flex-col gap-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`${basePath}/${f.id}`} className="inline-flex items-center gap-1.5 text-base font-semibold hover:underline">
                    <FileText aria-hidden="true" className="h-4 w-4 text-indigo-700" /> {f.name}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                    {f.isDefault && <Badge tone="cyan">{en("Used for “Ask an advisor”")}</Badge>}
                    <Badge tone={f.publicEnabled ? "emerald" : "zinc"}>{f.publicEnabled ? en("Public link on") : en("Public link off")}</Badge>
                    <Badge tone="zinc">{en("Version {version}", { version: f.version })}</Badge>
                    {f.hasDraft && <Badge tone="amber">{en("Unpublished changes")}</Badge>}
                  </div>
                </div>
                <span className="shrink-0 text-end text-xs text-muted-foreground">
                  <span className="block text-lg font-semibold tabular-nums text-foreground">{f.submissions.toLocaleString()}</span>
                  sent
                </span>
              </div>
              <div className="mt-auto flex flex-wrap gap-1.5">
                <Link href={`${basePath}/${f.id}`} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--brand-foreground,#fff)] shadow-sm hover:brightness-110" style={brandFill}>
                  {canEdit ? en("Edit") : en("Open")}
                </Link>
                <Link href={`${basePath}/${f.id}?tab=insights`} className={small}>
                  {en("Insights")}
                </Link>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(f.link).then(() => setCopied(f.id))}
                  title={f.publicEnabled ? undefined : en("Works once the public link is on")}
                  className={small}
                >
                  <Copy aria-hidden="true" className="h-3 w-3" /> {copied === f.id ? en("Copied") : en("Copy link")}
                </button>
                <button type="button" onClick={() => setEmbedFor(f)} className={small}>
                  <Code2 aria-hidden="true" className="h-3 w-3" />{en(" Put on your website")}
                </button>
                {f.publicEnabled && (
                  <a href={f.link} target="_blank" rel="noreferrer" className={small}>
                    <ExternalLink aria-hidden="true" className="h-3 w-3" />{en(" Open")}
                  </a>
                )}
                {canEdit && (
                  <>
                    <button type="button" onClick={() => createCopy(apiFetch, q, f, router, basePath, setNotice)} className={small}>
                      {en("Duplicate")}
                    </button>
                    {!f.isDefault && (
                      <>
                        <button type="button" onClick={() => act(`/api/guidance-forms/${f.id}/default`, "POST", `"${f.name}" is now used for “Ask an advisor”.`)} className={small}>
                          <Star aria-hidden="true" className="h-3 w-3" />{en(" Use for “Ask an advisor”")}
                        </button>
                        <button
                          type="button"
                          onClick={() => window.confirm(`Remove "${f.name}"? Its link stops working; inquiries already sent are kept.`) && act(`/api/guidance-forms/${f.id}`, "DELETE", `"${f.name}" removed.`)}
                          className={`${small} text-red-700 hover:bg-red-500/10 dark:text-red-400`}
                        >
                          <Trash2 aria-hidden="true" className="h-3 w-3" />{en(" Remove")}
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

      {view === "forms" && forms && withProfile && <SiteCard instituteId={instituteId} forms={forms} canEdit={canEdit} />}
      {view === "forms" && withProfile && canEdit && <ProfileCard apiFetch={apiFetch} q={q} ready={ready} />}

      {embedFor && (
        <div className="fixed inset-0 z-100 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setEmbedFor(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="embed-title" className="my-8 w-full max-w-5xl rounded-xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="embed-title" className="text-base font-semibold">
                {en("Put “{name}” on your website", { name: embedFor.name })}
              </h2>
              <div className="flex items-center gap-2">
                {canEdit && !embedFor.publicEnabled && (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await apiFetch(`/api/guidance-forms/${embedFor.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicEnabled: true }) });
                      if (res.ok) {
                        setEmbedFor({ ...embedFor, publicEnabled: true });
                        load();
                      }
                    }}
                    className={buttonClass("primary")}
                    style={brandFill}
                  >
                    {en("Turn on the public link")}
                  </button>
                )}
                <button type="button" onClick={() => setEmbedFor(null)} aria-label={en("Close")} className="rounded-lg p-1.5 hover:bg-muted">
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
            </div>
            <EmbedBuilder instituteId={owner} formId={embedFor.id} formName={embedFor.name} publicEnabled={embedFor.publicEnabled} />
          </div>
        </div>
      )}

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
  return <UiBadge tone={({ cyan: "info", emerald: "good", zinc: "neutral", amber: "warn" } as const)[tone]}>{children}</UiBadge>;
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
  const en = useEn();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [country, setCountry] = useState("all");
  const [pick, setPick] = useState("general");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch("/api/guidance-forms/templates")
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates);
        setGroups(d.groups ?? []);
      })
      .catch(() => setError(en("Templates couldn't be loaded.")));
  }, [apiFetch, en]);

  const chosen = templates.find((t) => t.key === pick);
  const countries = [...new Set(templates.map((t) => t.country).filter((c) => c !== "any"))];
  const shown = templates.filter((t) => country === "all" || t.country === "any" || t.country === country);
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
      <div role="dialog" aria-modal="true" aria-labelledby="new-form-title" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="new-form-title" className="text-base font-semibold">
            {en("New form")}
          </h2>
          <button type="button" onClick={onClose} aria-label={en("Close")} className="rounded-lg p-1.5 hover:bg-muted">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 md:grid-cols-[22rem_1fr]">
          <div className="space-y-2 overflow-y-auto border-e border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">{en("Start from")}</p>
              {countries.length > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {en("For")}
                  <select aria-label={en("Show templates for")} className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground" value={country} onChange={(e) => setCountry(e.target.value)}>
                    <option value="all">{en("Any country")}</option>
                    {countries.map((c) => (
                      <option key={c} value={c}>
                        {en(COUNTRY_NAMES[c] ?? c)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {(groups.length ? groups : [...new Set(shown.map((t) => t.group))]).map((g) => {
              const inGroup = shown.filter((t) => t.group === g);
              if (inGroup.length === 0) return null;
              return (
                <section key={g} aria-labelledby={`tpl-group-${g}`} className="space-y-2 pt-1">
                  <h3 id={`tpl-group-${g}`} className="text-xs font-semibold">
                    {en(GROUP_NAMES[g] ?? g)}
                  </h3>
                  {inGroup.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setPick(t.key)}
                      aria-pressed={pick === t.key}
                      className={`block w-full rounded-xl border p-3 text-start text-sm ${pick === t.key ? "border-indigo-600 ring-1 ring-indigo-600" : "border-border hover:bg-muted"}`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-medium">{t.name}</span>
                        {t.country !== "any" && (
                          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{en(COUNTRY_NAMES[t.country] ?? t.country)}</span>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">{en("For: {audience}", { audience: t.audience })}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{t.description}</span>
                      {reportOf(t.definition) && <span className="mt-1 block text-xs font-medium text-indigo-800 dark:text-indigo-300">{reportOf(t.definition)}</span>}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {en("{length} questions · {length2} {value}", { length: t.definition.questions.length, length2: t.definition.sections.length, value: t.definition.sections.length === 1 ? "step" : "steps" })}
                      </span>
                    </button>
                  ))}
                </section>
              );
            })}
            <label className="block pt-2 text-xs font-medium text-muted-foreground">
              {en("Name")}
              <input className={input} value={name} maxLength={120} placeholder={chosen?.name ?? "e.g. Data Science open day 2027"} onChange={(e) => setName(e.target.value)} />
            </label>
            {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
            <button type="button" disabled={busy || !chosen} onClick={create} className={`${buttonClass("primary")} w-full`} style={brandFill}>
              {en("Create and edit")}
            </button>
            <p className="text-xs text-muted-foreground">{en("You can change every question before publishing.")}</p>
          </div>
          <div className="overflow-y-auto bg-muted/30 p-5">
            <p className="mb-3 text-xs font-medium text-muted-foreground">{en("Preview")}</p>
            {chosen && (
              <div className="mx-auto max-w-lg rounded-xl border border-border bg-background p-5">
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
  const en = useEn();
  const india = useSchoolCountry() === "IN";
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
    setMsg(res.ok ? { ok: true, text: en("Saved.") } : { ok: false, text: en("That couldn't be saved.") });
  };
  return (
    <section className={card}>
      <h2 className="text-base font-semibold">{en("Your institute's card")}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{en("Shown when people on Edulexa choose an institute to talk to. Only what you fill in is shown, with your real courses.")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          {en("City")}
          <input className={input} value={p.city ?? ""} maxLength={120} onChange={(e) => setP({ ...p, city: e.target.value })} />
        </label>
        <label className="text-sm">
          {en("Fees range")}
          <input className={input} value={p.feesRange ?? ""} maxLength={200} placeholder={india ? en("e.g. ₹40,000 to ₹80,000") : en("e.g. $4,000 to $8,000")} onChange={(e) => setP({ ...p, feesRange: e.target.value })} />
        </label>
        <fieldset className="text-sm sm:col-span-2">
          <legend>{en("How you teach")}</legend>
          <div className="mt-1 flex gap-3">
            {MODES.map((m) => (
              <label key={m} className="flex items-center gap-1.5">
                <input type="checkbox" checked={p.modes.includes(m)} onChange={(e) => setP({ ...p, modes: e.target.checked ? [...p.modes, m] : p.modes.filter((x) => x !== m) })} />
                {en(m)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-sm sm:col-span-2">
          {en("About")}
          <textarea className={input} rows={3} value={p.about ?? ""} maxLength={600} onChange={(e) => setP({ ...p, about: e.target.value })} />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={save} className={buttonClass("primary")} style={brandFill}>
          {en("Save card")}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
