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
import EmailComposer from "./EmailComposer";
import Communication from "./Communication";
import {
  CALL_OUTCOMES,
  crm,
  localInput,
  LOST_REASONS,
  relative,
  PriorityBadge,
  StageBadge,
  STAGE_LABEL,
  STAGE_SOLID,
  STAGE_TONE,
  STAGES,
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
  me,
  onClose,
  onChanged,
}: {
  leadId: string;
  getToken: GetToken;
  team: Member[];
  templates: Template[];
  isAdmin: boolean;
  /** The caller on the team list, if they are on it */
  me: { id: string; name: string } | null;
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
  const [replySubject, setReplySubject] = useState("");
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
    setLosing(false);
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
                {lead?.highPriority && <PriorityBadge />}
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
              {lead.spam && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-500/30 bg-zinc-500/10 px-3 py-2 text-xs">
                  <span>
                    <span className="font-medium">Possible spam.</span> {lead.spamReasons ? `Why: ${lead.spamReasons}.` : ""} It&apos;s kept out of your leads until you say it&apos;s real.
                  </span>
                  <button type="button" disabled={busy} onClick={() => update({ spam: false }, "Moved to your leads.")} className="rounded-lg bg-cyan-700 px-3 py-1.5 font-medium text-white hover:bg-cyan-800">
                    Not spam
                  </button>
                </div>
              )}
              {lead.duplicates.length > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                  This person sent {lead.duplicates.length} other {lead.duplicates.length === 1 ? "inquiry" : "inquiries"} with the same email. Check before contacting twice.
                </p>
              )}
              {(() => {
                const lastIn = lead.activities.find((a) => a.kind === "EmailReply");
                const lastOut = lead.activities.find((a) => ["Email", "Sms", "WhatsApp", "Call", "Meeting"].includes(a.kind));
                return lastIn && (!lastOut || new Date(lastIn.createdAt) > new Date(lastOut.createdAt)) ? (
                  <p className="mt-2 rounded-lg bg-cyan-600/10 px-3 py-2 text-xs font-medium text-cyan-900 dark:text-cyan-200">
                    {lead.name?.split(" ")[0] || "They"} replied {relative(lastIn.createdAt)} and is waiting for your answer. Read it below.
                  </p>
                ) : null;
              })()}
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
              {mode === "Email" && lead.channels.email && !lead.doNotContact ? (
                <EmailComposer
                  key={replySubject}
                  lead={lead}
                  templates={templates}
                  isAdmin={isAdmin}
                  initialSubject={replySubject}
                  getToken={getToken}
                  busy={busy}
                  send={async (body) => {
                    const ok = await act(`/leads/${leadId}/email`, body, `Email sent to ${lead.email}.`);
                    if (ok) {
                      setMode(null);
                      setReplySubject("");
                    }
                    return ok;
                  }}
                  onCancel={() => {
                    setMode(null);
                    setReplySubject("");
                  }}
                  onTemplatesChanged={onChanged}
                  onRecorded={(updated) => {
                    setLead(updated);
                    setMode(null);
                    setReplySubject("");
                    setNotice("Recorded on the timeline.");
                    onChanged();
                  }}
                />
              ) : mode && (
                <Composer
                  key={mode + replySubject}
                  mode={mode}
                  initialSubject={replySubject}
                  lead={lead}
                  templates={templates}
                  isAdmin={isAdmin}
                  busy={busy}
                  onCancel={() => {
                    setMode(null);
                    setReplySubject("");
                  }}
                  act={act}
                  done={() => {
                    setMode(null);
                    setReplySubject("");
                  }}
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
                            ? `${STAGE_SOLID[s]} font-medium`
                            : s === "Lost" && losing
                              ? STAGE_TONE.Lost
                              : `${STAGE_TONE[s]} opacity-70 hover:opacity-100`
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
                  <OwnerField
                    lead={lead}
                    team={activeTeam}
                    me={me}
                    isAdmin={isAdmin}
                    busy={busy}
                    getToken={getToken}
                    assign={(id, done) => update({ ownerSet: true, ownerMemberId: id }, done)}
                    setError={setError}
                    onTeamChanged={onChanged}
                  />
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
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={!!lead.highPriority} disabled={busy} onChange={(e) => update({ highPriority: e.target.checked }, e.target.checked ? "Marked high priority." : "No longer high priority.")} />
                  <span className="font-medium">High priority</span>
                  <span className="text-muted-foreground">(set by form rules too)</span>
                </label>
                {!lead.spam && (
                  <button type="button" disabled={busy} onClick={() => update({ spam: true }, "Moved to Possible spam.")} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                    This is spam
                  </button>
                )}
              </section>

              {/* Tabs */}
              <div role="tablist" aria-label="Lead details" className="mt-6 flex gap-4 border-b border-border text-sm">
                {(
                  [
                    ["timeline", `Communication (${lead.activities.filter((a) => !["Stage", "Assignment", "Task", "System"].includes(a.kind)).length})`],
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
                {tab === "timeline" && (
                  <Communication
                    items={lead.activities}
                    personName={lead.name?.split(" ")[0] || "them"}
                    busy={busy}
                    onPin={(a, pinned) => act(`/leads/${leadId}/activities/${a.id}/pin`, { pinned }, pinned ? "Pinned to key facts." : "Unpinned.")}
                    onReply={() => {
                      const last = lead.activities.find((x) => x.kind === "Email" && x.subject)?.subject ?? "Your inquiry";
                      setReplySubject(last.startsWith("Re: ") ? last : `Re: ${last}`);
                      setMode("Email");
                      document.getElementById("lead-title")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  />
                )}
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

/**
 * The lead's owner: anyone active on the team. Admins can add themselves or someone new right here and assign in one
 * step, so they don't have to leave the lead for Settings.
 */
function OwnerField({
  lead,
  team,
  me,
  isAdmin,
  busy,
  getToken,
  assign,
  setError,
  onTeamChanged,
}: {
  lead: LeadFull;
  team: Member[];
  me: { id: string; name: string } | null;
  isAdmin: boolean;
  busy: boolean;
  getToken: GetToken;
  assign: (id: string | null, done: string) => Promise<boolean>;
  setError: (e: string | null) => void;
  onTeamChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const addAndAssign = async (path: string, body?: unknown) => {
    setSaving(true);
    try {
      const m = await crm<Member>(getToken, path, { method: "POST", body });
      onTeamChanged();
      setAdding(false);
      setName("");
      setEmail("");
      await assign(m.id, `${m.name} added to the team and assigned.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const pick = (v: string) => {
    if (v === "__me") addAndAssign("/team/me");
    else if (v === "__new") setAdding(true);
    else assign(v || null, v ? "Owner updated." : "Unassigned.");
  };

  return (
    <div className="text-xs font-medium text-muted-foreground">
      <label htmlFor="lead-owner">Owner</label>
      <select id="lead-owner" className={`${input} mt-1`} value={lead.ownerMemberId ?? ""} disabled={busy || saving} onChange={(e) => pick(e.target.value)}>
        <option value="">Unassigned</option>
        {me && <option value={me.id}>Me ({me.name})</option>}
        {team
          .filter((m) => m.id !== me?.id)
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        {isAdmin && !me && <option value="__me">+ Add me to the team and assign to me</option>}
        {isAdmin && <option value="__new">+ Add someone to the team…</option>}
      </select>
      {!isAdmin && team.length === 0 && <span className="mt-1 block font-normal">Your admin hasn&apos;t added the team yet, so leads can&apos;t be assigned.</span>}
      {!isAdmin && team.length > 0 && !me && <span className="mt-1 block font-normal">You&apos;re not on the team list; ask your admin to add your sign-in email.</span>}
      {adding && (
        <form
          className="mt-2 space-y-1.5 rounded-lg border border-border bg-muted/40 p-2 font-normal"
          onSubmit={(e) => {
            e.preventDefault();
            addAndAssign("/team", { name, email, role: "Counsellor", active: true });
          }}
        >
          <input className={input} placeholder="Name" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
          <input className={input} type="email" placeholder="Email they sign in with" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="flex gap-2">
            <button type="submit" className={primary} disabled={saving}>
              Add and assign
            </button>
            <button type="button" className={secondary} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
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
  initialSubject,
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
  initialSubject: string;
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
  const [subject, setSubject] = useState(initialSubject);
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

