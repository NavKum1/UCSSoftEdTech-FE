"use client";

/**
 * G5: post-study work-rights packs (UK, Australia, New Zealand, Ireland, Singapore, Netherlands, Germany, France, Malaysia,
 * UAE, Canada). A tracker for the student's own dates: never a job search. Every pack cites its sources and marks
 * unconfirmed values; the UI always says to verify with the international office.
 */

import React, { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, ScrollArea, SuccessBanner, useCareerFormat, useCareerT, useLoad } from "@/components/career/ui";

export interface PackFact {
  text: string;
  verified: boolean;
  sourceUrl?: string | null;
}
export interface PackDuration {
  key: string;
  label: string;
  months: number;
  verified: boolean;
  sourceUrl?: string | null;
}
export interface PackSource {
  title: string;
  url: string;
  official: boolean;
}
export interface WorkRightsPack {
  code: string;
  country: string;
  scheme: string;
  authority: string;
  workAllowed: boolean;
  summary: string;
  eligibility: PackFact[];
  durations: PackDuration[];
  notes: PackFact[];
  sources: PackSource[];
  lastReviewed: string;
  unconfirmedCount: number;
}
export interface PacksResponse {
  reviewedOn: string;
  verifyNotice: string;
  trackerOnly: string;
  packs: WorkRightsPack[];
}
export interface WorkRightsItem {
  key: string;
  label: string;
  kind: string;
  dueOn: string | null;
  status: "done" | "overdue" | "due-soon" | "upcoming" | "needs-date" | "past";
  daysLeft: number | null;
  verified: boolean;
  sourceUrl?: string | null;
}
export interface Tracker {
  id: string;
  countryCode: string;
  country: string;
  scheme: string;
  optionKey: string | null;
  optionLabel: string | null;
  status: string;
  courseCompletionDate: string | null;
  studentVisaExpiry: string | null;
  appliedOn: string | null;
  permitStart: string | null;
  permitEnd: string | null;
  computedPermitEnd: string | null;
  notes: string | null;
  items: WorkRightsItem[];
  warnings: string[];
  next: WorkRightsItem | null;
}
interface MineResponse {
  verifyNotice: string;
  trackerOnly: string;
  disclaimer: string;
  trackers: Tracker[];
}

const STATUSES = ["Planning", "Applied", "Granted", "Ended"] as const;

export const itemTone = (s: WorkRightsItem["status"]) => (s === "overdue" ? "bad" : s === "due-soon" ? "warn" : s === "done" ? "good" : "neutral") as "bad" | "warn" | "good" | "neutral";

/** The "verify with your international office" notice shown on every work-rights view. */
export function VerifyNotice({ text, extra }: { text: string; extra?: string }) {
  const t = useCareerT("workRights");
  return (
    <div role="note" className="mb-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{t("verifyHeading")}</p>
        <p>{text}</p>
        {extra && <p className="mt-1">{extra}</p>}
      </div>
    </div>
  );
}

function SourceLink({ url, verified }: { url?: string | null; verified: boolean }) {
  const t = useCareerT("workRights");
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge tone={verified ? "good" : "warn"}>{verified ? t("verified") : t("unconfirmed")}</Badge>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline">
          {t("sourceLink")}
        </a>
      )}
    </span>
  );
}

function Facts({ title, facts }: { title: string; facts: PackFact[] }) {
  if (facts.length === 0) return null;
  return (
      <div>
        <h4 className="mb-1 text-sm font-semibold">{title}</h4>
        <ul className="list-disc space-y-1 ps-5 text-sm">
          {facts.map((f, i) => (
            <li key={i}>
              {f.text} <SourceLink url={f.sourceUrl} verified={f.verified} />
            </li>
          ))}
        </ul>
      </div>
  );
}

/** Eligibility, permit lengths, notes and sources for one pack, each with its verified/unconfirmed mark. */
export function PackRules({ pack }: { pack: WorkRightsPack }) {
  const t = useCareerT("workRights");
  const fmt = useCareerFormat();
  return (
    <div className="space-y-3">
      <p className="text-sm">{pack.summary}</p>
      {!pack.workAllowed && <p className="text-sm font-medium">{t("noWork")}</p>}
      <Facts title={t("eligibility")} facts={pack.eligibility} />
      <div>
        <h4 className="mb-1 text-sm font-semibold">{t("durations")}</h4>
        <ul className="list-disc space-y-1 ps-5 text-sm">
          {pack.durations.map((d) => (
            <li key={d.key}>
              {d.label}: {d.months > 0 ? t("months", { count: d.months }) : t("sameAsProgram")} <SourceLink url={d.sourceUrl} verified={d.verified} />
            </li>
          ))}
        </ul>
      </div>
      <Facts title={t("notesHeading")} facts={pack.notes} />
      <div>
        <h4 className="mb-1 text-sm font-semibold">{t("sources")}</h4>
        <ul className="list-disc space-y-1 ps-5 text-sm">
          {pack.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">{t("reviewed", { date: fmt.date(pack.lastReviewed) })}</p>
    </div>
  );
}

interface FormState {
  countryCode: string;
  optionKey: string;
  status: string;
  courseCompletionDate: string;
  studentVisaExpiry: string;
  appliedOn: string;
  permitStart: string;
  permitEnd: string;
  notes: string;
}

const emptyForm: FormState = { countryCode: "", optionKey: "", status: "Planning", courseCompletionDate: "", studentVisaExpiry: "", appliedOn: "", permitStart: "", permitEnd: "", notes: "" };

const formFrom = (tr: Tracker): FormState => ({
  countryCode: tr.countryCode,
  optionKey: tr.optionKey ?? "",
  status: tr.status,
  courseCompletionDate: tr.courseCompletionDate ?? "",
  studentVisaExpiry: tr.studentVisaExpiry ?? "",
  appliedOn: tr.appliedOn ?? "",
  permitStart: tr.permitStart ?? "",
  permitEnd: tr.permitEnd ?? "",
  notes: tr.notes ?? "",
});

const payload = (f: FormState) => ({
  countryCode: f.countryCode,
  optionKey: f.optionKey,
  status: f.status,
  courseCompletionDate: f.courseCompletionDate || null,
  studentVisaExpiry: f.studentVisaExpiry || null,
  appliedOn: f.appliedOn || null,
  permitStart: f.permitStart || null,
  permitEnd: f.permitEnd || null,
  notes: f.notes,
});

export function ItemsTable({ tracker }: { tracker: Tracker }) {
  const t = useCareerT("workRights");
  const fmt = useCareerFormat();
  return (
    <ScrollArea label={t("datesCaption", { country: tracker.country })}>
      <table className="w-full text-sm">
        <caption className="sr-only">{t("datesCaption", { country: tracker.country })}</caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground [&_th]:text-start">
            <th scope="col" className="py-1.5 pe-3 font-medium">{t("colItem")}</th>
            <th scope="col" className="py-1.5 pe-3 font-medium">{t("colDate")}</th>
            <th scope="col" className="py-1.5 pe-3 font-medium">{t("colStatus")}</th>
            <th scope="col" className="py-1.5 pe-3 font-medium">{t("colSource")}</th>
          </tr>
        </thead>
        <tbody>
          {tracker.items.map((i) => (
            <tr key={i.key} className="border-b border-border/60 align-top">
              <th scope="row" className="py-1.5 pe-3 text-start font-normal">{i.label}</th>
              <td className="py-1.5 pe-3 whitespace-nowrap">
                {i.dueOn ? fmt.date(i.dueOn) : "—"}
                {i.daysLeft != null && i.daysLeft >= 0 && i.status !== "done" && <span className="block text-xs text-muted-foreground">{t("daysLeft", { count: i.daysLeft })}</span>}
              </td>
              <td className="py-1.5 pe-3">
                <Badge tone={itemTone(i.status)}>{t(`itemStatus.${i.status}`)}</Badge>
              </td>
              <td className="py-1.5 pe-3">
                <SourceLink url={i.sourceUrl} verified={i.verified} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}

/** Student view: add trackers, see dates and reminders, read each pack's rules. */
export default function WorkRightsTracker() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const t = useCareerT("workRights");
  const fmt = useCareerFormat();
  const packs = useLoad(() => api<PacksResponse>("/api/career/international/work-rights/packs"), [api]);
  const mine = useLoad(() => api<MineResponse>("/api/career/international/work-rights"), [api, schoolId]);
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if ((packs.loading && !packs.data) || (mine.loading && !mine.data)) return <Loading />;
  if (!packs.data || !mine.data) return <ErrorBanner error={packs.error ?? mine.error} onRetry={() => { packs.reload(); mine.reload(); }} />;
  const p = packs.data;
  const view = mine.data;
  const packFor = (code: string) => p.packs.find((x) => x.code === code);
  const formPack = form ? packFor(form.countryCode) : undefined;
  const tracked = new Set(view.trackers.map((x) => x.countryCode));

  const run = async (fn: () => Promise<MineResponse>, success: string) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      mine.setData(await fn());
      setMsg(success);
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !form.countryCode) return;
    const send = () =>
      editing
        ? api<MineResponse>(`/api/career/international/work-rights/${editing}`, { method: "PUT", json: payload(form) })
        : api<MineResponse>("/api/career/international/work-rights", { json: payload(form) });
    void run(send, t("saved")).then((ok) => {
      if (ok) {
        setForm(null);
        setEditing(null);
      }
    });
  };

  const remove = (tr: Tracker) => {
    if (!window.confirm(t("removeConfirm", { country: tr.country }))) return;
    void run(() => api<MineResponse>(`/api/career/international/work-rights/${tr.id}`, { method: "DELETE" }), t("removed"));
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));
  const dateField = (k: keyof FormState, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      {(props) => <input type="date" {...props} value={form?.[k] ?? ""} onChange={set(k)} />}
    </Field>
  );

  return (
    <Card
      title={t("title")}
      actions={
        !form ? (
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(null);
              setForm({ ...emptyForm });
            }}
          >
            {t("add")}
          </Button>
        ) : undefined
      }
    >
      <p className="mb-3 text-sm">{t("intro")}</p>
      <VerifyNotice text={view.verifyNotice} extra={t("trackerOnly")} />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />

      {form && (
        <form onSubmit={submit} className="mb-6 space-y-3 rounded-lg border border-border p-4" aria-label={editing ? t("editTitle", { country: formPack?.country ?? "" }) : t("addTitle")}>
          <h3 className="font-semibold">{editing ? t("editTitle", { country: formPack?.country ?? "" }) : t("addTitle")}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("country")}>
              {(props) => (
                <select {...props} value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value, optionKey: "" })} disabled={!!editing} required>
                  <option value="">{t("chooseCountry")}</option>
                  {p.packs
                    .filter((x) => editing || !tracked.has(x.code))
                    .map((x) => (
                      <option key={x.code} value={x.code}>
                        {x.country}: {x.scheme}
                      </option>
                    ))}
                </select>
              )}
            </Field>
            <Field label={t("option")}>
              {(props) => (
                <select {...props} value={form.optionKey} onChange={set("optionKey")} disabled={!formPack}>
                  <option value="">{t("chooseOption")}</option>
                  {formPack?.durations.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                      {d.verified ? "" : ` (${t("unconfirmed")})`}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("status")}>
              {(props) => (
                <select {...props} value={form.status} onChange={set("status")}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {dateField("courseCompletionDate", t("courseCompletion"), t("courseCompletionHint"))}
            {dateField("studentVisaExpiry", t("visaExpiry"))}
            {dateField("appliedOn", t("appliedOn"))}
            {dateField("permitStart", t("permitStart"))}
            {dateField("permitEnd", t("permitEnd"), t("permitEndHint"))}
          </div>
          <Field label={t("notes")}>{(props) => <textarea {...props} rows={2} maxLength={2000} value={form.notes} onChange={set("notes")} />}</Field>
          {formPack && (
            <details className="text-sm">
              <summary className="cursor-pointer underline">{t("rulesTitle", { country: formPack.country })}</summary>
              <div className="mt-2">
                <PackRules pack={formPack} />
              </div>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" busy={busy} disabled={!form.countryCode}>
              {t("save")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setForm(null);
                setEditing(null);
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}

      {view.trackers.length === 0 && !form ? (
        <EmptyState title={t("noTrackers")} />
      ) : (
        <div className="space-y-6">
          {view.trackers.map((tr) => {
            const pack = packFor(tr.countryCode);
            return (
              <section key={tr.id} aria-labelledby={`wr-${tr.id}`} className="rounded-lg border border-border p-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 id={`wr-${tr.id}`} className="font-semibold">
                      {tr.country}
                    </h3>
                    <p className="text-sm text-muted-foreground">{tr.optionLabel ?? tr.scheme}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{t(`statuses.${tr.status}`)}</Badge>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing(tr.id);
                        setForm(formFrom(tr));
                      }}
                    >
                      {t("edit")}
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => remove(tr)}>
                      {t("remove")}
                    </Button>
                  </div>
                </div>
                {tr.warnings.length > 0 && (
                  <div role="status">
                    <ul className="mb-2 list-disc space-y-1 ps-5 text-sm text-amber-800 dark:text-amber-200">
                      {tr.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {tr.computedPermitEnd && <p className="mb-2 text-sm">{t("estimatedEnd", { date: fmt.date(tr.computedPermitEnd) })}</p>}
                <ItemsTable tracker={tr} />
                {pack && (
                  <div className="mt-3">
                    <Button variant="ghost" aria-expanded={open === tr.id} onClick={() => setOpen(open === tr.id ? null : tr.id)}>
                      {open === tr.id ? t("hideRules") : t("showRules")}
                    </Button>
                    {open === tr.id && (
                      <div className="mt-2">
                        <PackRules pack={pack} />
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">{view.disclaimer}</p>
    </Card>
  );
}
