"use client";

/**
 * One lead, everything in one place: contact details and one-click actions (log a call, email, SMS, WhatsApp, note,
 * meeting), the pipeline stage, owner, tags and follow-ups, the timeline of everything that happened (replies by email
 * included), and what the person shared with their inquiry.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  Check,
  Copy,
  Mail,
  MessageCircle,
  MessageSquare,
  NotebookPen,
  Phone,
  Plus,
  X,
} from "lucide-react";
import { useLatestRef } from "@/lib/legacyApi";
import LeadProfile from "./LeadProfile";
import {
  CALL_OUTCOMES,
  crm,
  localInput,
  LOST_REASONS,
  relative,
  StageBadge,
  STAGE_LABEL,
  STAGES,
  type Activity,
  type GetToken,
  type LeadFull,
  type Member,
  type Template,
} from "./api";

type Mode = "Call" | "Email" | "Sms" | "WhatsApp" | "Note" | "Meeting";

const ACTIONS: { mode: Mode; label: string; icon: React.ElementType }[] = [
  { mode: "Call", label: "Log call", icon: Phone },
  { mode: "Email", label: "Email", icon: Mail },
  { mode: "WhatsApp", label: "WhatsApp", icon: MessageCircle },
  { mode: "Sms", label: "SMS", icon: MessageSquare },
  { mode: "Meeting", label: "Meeting", icon: CalendarClock },
  { mode: "Note", label: "Note", icon: NotebookPen },
];

const KIND_LABEL: Record<string, string> = {
  Note: "Note",
  Call: "Call",
  Email: "Email sent",
  EmailReply: "Reply by email",
  Sms: "SMS",
  WhatsApp: "WhatsApp chat opened",
  Meeting: "Meeting booked",
  Stage: "Stage",
  Assignment: "Owner",
  Task: "Follow-up",
  System: "Update",
};

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20";
const primary = "inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-50";
const secondary = "inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";

/** Quick due times for follow-ups */
function presets(): { label: string; at: Date }[] {
  const at = (days: number, hour = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const inHours = new Date(Date.now() + 2 * 3600e3);
  return [
    { label: "In 2 hours", at: inHours },
    { label: "Tomorrow 10:00", at: at(1) },
    { label: "In 3 days", at: at(3) },
    { label: "Next week", at: at(7) },
  ];
}

export default function LeadDrawer({
  leadId,
  getToken,
  team,
  templates,
  isAdmin,
  onClose,
  onChanged,
}: {
  leadId: string;
  getToken: GetToken;
  team: Member[];
  templates: Template[];
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [lead, setLead] = useState<LeadFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"timeline" | "followups" | "shared">("timeline");
  const [mode, setMode] = useState<Mode | null>(null);
  const [losing, setLosing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const activeTeam = team.filter((m) => m.active);

  const load = useCallback(async () => {
    try {
      setLead(await crm<LeadFull>(getToken, `/leads/${leadId}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [getToken, leadId]);

  const loadRef = useLatestRef(load);
  useEffect(() => {
    loadRef.current();
  }, [loadRef, leadId]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Runs a change; the API answers with the updated lead */
  const act = async (path: string, body: unknown, done?: string, method = "POST") => {
    setBusy(true);
    setNotice(null);
    try {
      const updated = await crm<LeadFull>(getToken, path, { method, body });
      setLead(updated);
      setError(null);
      if (done) setNotice(done);
      onChanged();
      return true;
    } catch (e) {
      setError((e as Error).message);
      load();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const update = (body: Record<string, unknown>, done?: string) => act(`/leads/${leadId}`, body, done, "PATCH");

  const moveStage = (stage: string) => {
    if (!lead || stage === lead.stage) return;
    if (stage === "Lost") {
      setLosing(true);
      return;
    }
    update({ stage }, `Moved to ${STAGE_LABEL[stage]}.`);
  };

  return (
    <div className="fixed inset-0 z-100 flex justify-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-title"
        className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-border p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="lead-title" className="truncate text-lg font-semibold">
                  {lead?.name || lead?.email || "Lead"}
                </h2>
                {lead && <StageBadge stage={lead.stage} />}
                {lead?.doNotContact && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-800 dark:text-red-300">
                    <Ban aria-hidden="true" className="h-3 w-3" /> Do not contact
                  </span>
                )}
              </div>
              {lead && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {lead.requestType === "guidance" ? "Career guidance request" : (lead.course ?? "Course no longer listed")} · {lead.source ?? "Edulexa"} · received{" "}
                  {relative(lead.createdAt)}
                </p>
              )}
            </div>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-muted">
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          {lead && (
            <>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <Contact label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
                <Contact label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone.replace(/\s/g, "")}` : undefined} />
              </div>
              {lead.duplicates.length > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                  This person sent {lead.duplicates.length} other {lead.duplicates.length === 1 ? "inquiry" : "inquiries"} with the same email. Check before contacting twice.
                </p>
              )}
              {lead.stage === "New" && !lead.firstResponseAt && (
                <p className="mt-2 rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-200">
                  Not contacted yet. Call, email or message them; the lead moves to Contacted when you do.
                </p>
              )}

              {/* One-click actions */}
              <div className="mt-3 flex flex-wrap gap-1.5" role="toolbar" aria-label="Actions">
                {ACTIONS.map(({ mode: m, label, icon: Icon }) => {
                  const blocked = lead.doNotContact && m !== "Note" && m !== "Call";
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMode(mode === m ? null : m);
                        setTab("timeline");
                      }}
                      disabled={blocked}
                      aria-pressed={mode === m}
                      title={blocked ? "They asked not to be contacted" : undefined}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                        mode === m ? "border-cyan-600 bg-cyan-600/10 text-cyan-800 dark:text-cyan-300" : "border-border hover:bg-muted"
                      }`}
                    >
                      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <p role="alert" className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mb-3 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
              <Check aria-hidden="true" className="h-4 w-4" /> {notice}
            </p>
          )}
          {!lead && !error && <div className="h-48 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-busy="true" />}

          {lead && (
            <>
              {mode && (
                <Composer
                  key={mode}
                  mode={mode}
                  lead={lead}
                  templates={templates}
                  isAdmin={isAdmin}
                  busy={busy}
                  onCancel={() => setMode(null)}
                  act={act}
                  done={() => setMode(null)}
                  getToken={getToken}
                  setError={setError}
                  reload={load}
                  onChanged={onChanged}
                />
              )}

              {/* Pipeline */}
              <section aria-label="Pipeline" className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Stage</p>
                  <div className="flex flex-wrap gap-1">
                    {STAGES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busy}
                        onClick={() => moveStage(s)}
                        aria-pressed={lead.stage === s}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          lead.stage === s
                            ? s === "Lost"
                              ? "border-zinc-500 bg-zinc-600 text-white"
                              : "border-cyan-700 bg-cyan-700 text-white"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {STAGE_LABEL[s]}
                      </button>
                    ))}
                  </div>
                  {lead.stage === "Lost" && lead.lostReason && <p className="mt-1 text-xs text-muted-foreground">Lost: {lead.lostReason}</p>}
                  {losing && <LostForm busy={busy} onCancel={() => setLosing(false)} onSave={async (reason) => (await update({ stage: "Lost", lostReason: reason }, "Marked as lost.")) && setLosing(false)} />}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Owner
                    <select
                      className={`${input} mt-1`}
                      value={lead.ownerMemberId ?? ""}
                      disabled={busy}
                      onChange={(e) => update({ ownerSet: true, ownerMemberId: e.target.value || null }, "Owner updated.")}
                    >
                      <option value="">Unassigned</option>
                      {activeTeam.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    {activeTeam.length === 0 && (
                      <span className="mt-1 block font-normal">{isAdmin ? "Add your team in Settings to assign leads." : "Your admin hasn't added the team yet."}</span>
                    )}
                  </label>
                  <div className="text-xs font-medium text-muted-foreground">
                    Next follow-up
                    <p className="mt-1 rounded-lg border border-border px-3 py-2 text-sm font-normal text-foreground">
                      {lead.nextFollowUpAt ? (
                        <>
                          {new Date(lead.nextFollowUpAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}{" "}
                          <span className={new Date(lead.nextFollowUpAt) < new Date() ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}>
                            ({relative(lead.nextFollowUpAt)})
                          </span>
                        </>
                      ) : (
                        <button type="button" className="text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-400" onClick={() => setTab("followups")}>
                          Schedule one
                        </button>
                      )}
                    </p>
                  </div>
                </div>

                <Tags tags={lead.tags} busy={busy} onChange={(tags) => update({ tags })} />
              </section>

              {/* Tabs */}
              <div role="tablist" aria-label="Lead details" className="mt-6 flex gap-4 border-b border-border text-sm">
                {(
                  [
                    ["timeline", `Timeline (${lead.activities.length})`],
                    ["followups", `Follow-ups (${lead.tasks.filter((t) => !t.doneAt).length})`],
                    ["shared", "What they shared"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    role="tab"
                    type="button"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={`-mb-px border-b-2 pb-2 ${tab === k ? "border-cyan-600 font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="pt-4">
                {tab === "timeline" && <Timeline items={lead.activities} />}
                {tab === "followups" && <FollowUps lead={lead} team={activeTeam} busy={busy} act={act} />}
                {tab === "shared" && <LeadProfile lead={lead} />}
              </div>

              <label className="mt-8 flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                <input type="checkbox" className="mt-0.5" checked={lead.doNotContact} disabled={busy} onChange={(e) => update({ doNotContact: e.target.checked })} />
                <span>
                  <span className="font-medium text-foreground">Do not contact.</span> Blocks email, SMS and WhatsApp from Edulexa. Set automatically when the person
                  uses the link in your emails.
                </span>
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Contact({ label, value, href }: { label: string; value: string | null; href?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-muted-foreground">No {label.toLowerCase()}</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <a href={href} className="text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-400">
        {value}
      </a>
      <button
        type="button"
        aria-label={`Copy ${label.toLowerCase()}`}
        className="rounded p-1 text-muted-foreground hover:bg-muted"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

function LostForm({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="mt-2 rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-sm font-medium">Why was this lead lost?</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {LOST_REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)} aria-pressed={reason === r} className={`rounded-full border px-2.5 py-1 text-xs ${reason === r ? "border-cyan-700 bg-cyan-700 text-white" : "border-border bg-card hover:bg-muted"}`}>
            {r}
          </button>
        ))}
      </div>
      <input className={`${input} mt-2`} placeholder="Or write the reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      <div className="mt-2 flex gap-2">
        <button type="button" className={primary} disabled={busy || !reason.trim()} onClick={() => onSave(reason.trim())}>
          Mark as lost
        </button>
        <button type="button" className={secondary} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Tags({ tags, busy, onChange }: { tags: string[]; busy: boolean; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...tags, t]);
    setDraft("");
  };
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tags</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
            {t}
            <button type="button" aria-label={`Remove tag ${t}`} disabled={busy} onClick={() => onChange(tags.filter((x) => x !== t))} className="rounded-full hover:text-red-600">
              <X aria-hidden="true" className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={() => draft.trim() && add()}
          maxLength={40}
          placeholder="Add a tag, e.g. scholarship"
          aria-label="Add a tag"
          className="min-w-40 flex-1 rounded-lg border border-dashed border-border bg-transparent px-2 py-1 text-xs focus:border-cyan-600 focus:outline-none"
        />
      </div>
    </div>
  );
}

function Timeline({ items }: { items: Activity[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing yet. Calls, emails, notes and changes show up here.</p>;
  return (
    <ol className="space-y-3">
      {items.map((a) => {
        const reply = a.kind === "EmailReply";
        const meta = a.meta ?? {};
        return (
          <li key={a.id} className={`rounded-xl border p-3 text-sm ${reply ? "border-cyan-600/40 bg-cyan-600/5" : "border-border"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{KIND_LABEL[a.kind] ?? a.kind}</span>
                {a.kind === "Call" && typeof meta.outcome === "string" && ` · ${CALL_OUTCOMES[meta.outcome] ?? meta.outcome}`}
                {a.kind === "Meeting" && typeof meta.at === "string" && ` · ${new Date(meta.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`}
                {" · "}
                {a.actorName}
              </span>
              <time dateTime={a.createdAt} title={new Date(a.createdAt).toLocaleString()}>
                {relative(a.createdAt)}
              </time>
            </div>
            {a.subject && <p className="mt-1 font-medium">{a.subject}</p>}
            {a.body && <p className="mt-1 whitespace-pre-wrap">{a.body}</p>}
            {(meta.delivered === false || meta.sent === false) && <p className="mt-1 text-xs text-red-700 dark:text-red-400">Not delivered{typeof meta.error === "string" ? ` (${meta.error})` : ""}.</p>}
          </li>
        );
      })}
    </ol>
  );
}

function DuePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {presets().map((p) => {
          const v = localInput(p.at);
          return (
            <button key={p.label} type="button" onClick={() => onChange(v)} aria-pressed={value === v} className={`rounded-full border px-2.5 py-1 text-xs ${value === v ? "border-cyan-700 bg-cyan-700 text-white" : "border-border hover:bg-muted"}`}>
              {p.label}
            </button>
          );
        })}
      </div>
      <input type="datetime-local" className={input} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Due time" />
    </div>
  );
}

function FollowUps({ lead, team, busy, act }: { lead: LeadFull; team: Member[]; busy: boolean; act: (path: string, body: unknown, done?: string) => Promise<boolean> }) {
  const [title, setTitle] = useState("Call back");
  const [due, setDue] = useState(() => localInput(presets()[1].at));
  const [assignee, setAssignee] = useState(lead.ownerMemberId ?? "");
  const open = lead.tasks.filter((t) => !t.doneAt);
  const done = lead.tasks.filter((t) => t.doneAt);
  return (
    <div className="space-y-5">
      <form
        className="space-y-2 rounded-xl border border-border p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act("/tasks", { leadId: lead.leadId, title, dueAt: new Date(due).toISOString(), assigneeMemberId: assignee || null }, "Follow-up scheduled."))
            setTitle("Call back");
        }}
      >
        <p className="text-sm font-medium">Schedule a follow-up</p>
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} aria-label="What needs doing" placeholder="What needs doing" required />
        <DuePicker value={due} onChange={setDue} />
        <div className="flex flex-wrap items-center gap-2">
          <select className={`${input} w-auto`} value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Who">
            <option value="">{lead.owner ? `The lead's owner (${lead.owner})` : "Nobody yet"}</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="submit" className={primary} disabled={busy || !title.trim() || !due}>
            <Plus aria-hidden="true" className="h-4 w-4" /> Schedule
          </button>
        </div>
        <p className="text-xs text-muted-foreground">The person it&apos;s for gets an email reminder when it&apos;s due.</p>
      </form>

      {open.length === 0 && done.length === 0 && <p className="text-sm text-muted-foreground">No follow-ups yet.</p>}
      <ul className="space-y-2">
        {[...open, ...done].map((t) => {
          const late = !t.doneAt && new Date(t.dueAt) < new Date();
          return (
            <li key={t.id} className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!t.doneAt}
                disabled={busy}
                onChange={(e) => act(`/tasks/${t.id}/done`, { done: e.target.checked }, e.target.checked ? "Marked done." : undefined)}
                aria-label={`Done: ${t.title}`}
              />
              <div className="min-w-0">
                <p className={t.doneAt ? "text-muted-foreground line-through" : "font-medium"}>{t.title}</p>
                <p className={`text-xs ${late ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>
                  {late ? "Overdue · " : ""}
                  {new Date(t.dueAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  {t.assignee ? ` · ${t.assignee}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Composer({
  mode,
  lead,
  templates,
  isAdmin,
  busy,
  onCancel,
  act,
  done,
  getToken,
  setError,
  reload,
  onChanged,
}: {
  mode: Mode;
  lead: LeadFull;
  templates: Template[];
  isAdmin: boolean;
  busy: boolean;
  onCancel: () => void;
  act: (path: string, body: unknown, done?: string) => Promise<boolean>;
  done: () => void;
  getToken: GetToken;
  setError: (e: string | null) => void;
  reload: () => void;
  onChanged: () => void;
}) {
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [outcome, setOutcome] = useState("");
  const [at, setAt] = useState(() => localInput(presets()[1].at));
  const [dlt, setDlt] = useState("");
  const first = (lead.name ?? "").split(" ")[0] || "there";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let ok = false;
    const id = lead.leadId;
    if (mode === "Note") ok = await act(`/leads/${id}/activities`, { kind: "Note", body: text }, "Note added.");
    if (mode === "Call") ok = await act(`/leads/${id}/activities`, { kind: "Call", outcome, body: text }, "Call logged.");
    if (mode === "Meeting") ok = await act(`/leads/${id}/activities`, { kind: "Meeting", at: new Date(at).toISOString(), body: text }, "Meeting booked; a reminder is set.");
    if (mode === "Email") ok = await act(`/leads/${id}/email`, { templateId: templateId || null, subject, body: text }, `Email sent to ${lead.email}.`);
    if (mode === "Sms") ok = await act(`/leads/${id}/sms`, { text, dltTemplateId: dlt || null }, "SMS sent.");
    if (mode === "WhatsApp") {
      // Open the chat in WhatsApp with the message ready; the chat is recorded on the timeline
      const win = window.open("", "_blank");
      try {
        const r = await crm<{ url: string }>(getToken, `/leads/${id}/whatsapp`, { method: "POST", body: { text } });
        if (win) win.location.href = r.url;
        else window.open(r.url, "_blank", "noopener");
        reload();
        onChanged();
        ok = true;
      } catch (err) {
        win?.close();
        setError((err as Error).message);
      }
    }
    if (ok) done();
  };

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSubject(t.subject);
      setText(t.body);
    }
  };

  const title: Record<Mode, string> = {
    Call: "Log a call",
    Email: `Email ${lead.email ?? ""}`,
    Sms: `SMS to ${lead.phone ?? ""}`,
    WhatsApp: `WhatsApp ${lead.phone ?? ""}`,
    Note: "Add a note",
    Meeting: "Book a counselling meeting",
  };

  const unavailable =
    (mode === "Email" && !lead.channels.email && "This lead has no email address.") ||
    (mode === "WhatsApp" && !lead.channels.whatsapp && "This lead has no phone number.") ||
    (mode === "Sms" &&
      !lead.channels.sms &&
      (lead.phone ? (
        <>
          SMS isn&apos;t connected for your institute.{" "}
          {isAdmin ? (
            <a className="underline" href="/career-center/settings/chat-sms">
              Connect Pulse Relay
            </a>
          ) : (
            "Ask your admin to connect Pulse Relay."
          )}{" "}
          You can still use WhatsApp.
        </>
      ) : (
        "This lead has no phone number."
      )));

  return (
    <form onSubmit={submit} className="mb-6 space-y-2.5 rounded-xl border border-cyan-600/40 bg-cyan-600/5 p-4">
      <p className="text-sm font-semibold">{title[mode]}</p>
      {unavailable ? (
        <p className="text-sm text-muted-foreground">{unavailable}</p>
      ) : (
        <>
          {mode === "Call" && (
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="How did the call go?">
              {Object.entries(CALL_OUTCOMES).map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={outcome === k} onClick={() => setOutcome(k)} className={`rounded-full border px-2.5 py-1 text-xs ${outcome === k ? "border-cyan-700 bg-cyan-700 text-white" : "border-border bg-card hover:bg-muted"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {mode === "Meeting" && <DuePicker value={at} onChange={setAt} />}
          {mode === "Email" && (
            <>
              {templates.length > 0 && (
                <select className={input} value={templateId} onChange={(e) => pickTemplate(e.target.value)} aria-label="Template">
                  <option value="">Start from a template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" maxLength={300} required />
            </>
          )}
          <textarea
            className={`${input} min-h-28`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Message"
            required={mode === "Note" || mode === "Email" || mode === "Sms"}
            maxLength={mode === "Sms" ? 1000 : 10000}
            placeholder={
              mode === "Call"
                ? "What did you talk about? (optional)"
                : mode === "Meeting"
                  ? "Where, or the video link (optional)"
                  : mode === "Note"
                    ? "Only your team sees notes"
                    : `Hi ${first}, …`
            }
          />
          {mode === "Email" && (
            <p className="text-xs text-muted-foreground">
              {"{name}"}, {"{course}"}, {"{institute}"} and {"{counsellor}"} are filled in for you.{" "}
              {lead.channels.replyByEmail ? "Their reply lands on this timeline." : "Replies go to your institute's email."} Every email has a link to stop further contact.
            </p>
          )}
          {mode === "Sms" && (
            <input className={input} value={dlt} onChange={(e) => setDlt(e.target.value)} placeholder="DLT template id (needed for SMS in India)" aria-label="DLT template id" />
          )}
          {mode === "WhatsApp" && <p className="text-xs text-muted-foreground">Opens WhatsApp with this message ready to send from your phone or WhatsApp Web.</p>}
          <div className="flex gap-2">
            <button type="submit" className={primary} disabled={busy || (mode === "Call" && !outcome)}>
              {mode === "Note" ? "Save note" : mode === "Call" ? "Log call" : mode === "Meeting" ? "Book" : mode === "WhatsApp" ? "Open WhatsApp" : "Send"}
            </button>
            <button type="button" className={secondary} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      )}
      {unavailable && (
        <button type="button" className={secondary} onClick={onCancel}>
          Close
        </button>
      )}
    </form>
  );
}

