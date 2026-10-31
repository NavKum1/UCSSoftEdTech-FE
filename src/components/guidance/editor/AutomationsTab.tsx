"use client";

/**
 * A form's automatic messages: when something happens (the form is sent, someone stops part way, a meeting is asked
 * for), after a wait, an email to the person or to the team (the lead's owner, chosen team members, other addresses), or
 * an SMS or WhatsApp through Pulse Relay, optionally only for one outcome or a range of match scores, and skipped when
 * they've already opened their results or asked for a meeting. Saved with the form (a draft until published). Every message sent is listed in Notifications.
 */

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Mail, MessageSquare, Plus, Send, Trash2, Users } from "lucide-react";
import { newId, type Automation, type FormDef } from "@/components/guidance/form/model";

const field = "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20";

const TRIGGERS: Record<Automation["trigger"], string> = {
  sent: "When the form is sent",
  stopped: "When someone stops part way",
  booking: "When a meeting is asked for or booked",
};
const CHANNELS: Record<Automation["channel"], { label: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }> }> = {
  email: { label: "Email to the person", icon: Mail },
  team: { label: "Email to your team", icon: Users },
  sms: { label: "SMS (Pulse Relay)", icon: MessageSquare },
  whatsapp: { label: "WhatsApp (Pulse Relay)", icon: Send },
};
const FIELDS: [string, string][] = [
  ["first_name", "Ravi"],
  ["name", "Ravi Kumar"],
  ["institute", "your institute"],
  ["form", "IT career readiness quiz"],
  ["outcome", "Analytical"],
  ["match", "86%"],
  ["match_label", "A great match"],
  ["report_link", "https://…/report?token=…"],
  ["form_link", "https://…/embed/guidance/…"],
  ["meeting", "Tuesday 4 November 2026, 10:00 AM (Asia/Kolkata)"],
  ["lead_link", "https://…/institute/dashboard?lead=…"],
];

const EXAMPLES: { label: string; make: () => Automation }[] = [
  {
    label: "Their results by email",
    make: () => ({ ...blank("email"), name: "Your results", subject: "Your results from {institute}", body: "Hi {first_name},\n\nThank you for filling in our form. Your results and your answers are here:\n{report_link}\n\nAn adviser will be in touch soon.\n\n{institute}" }),
  },
  {
    label: "A reminder if they haven't looked",
    make: () => ({ ...blank("email"), name: "Reminder", delayMinutes: 2880, unlessReportOpened: true, subject: "Your results are waiting", body: "Hi {first_name},\n\nYour results are ready whenever you are:\n{report_link}\n\n{institute}" }),
  },
  {
    label: "Ask them to finish (stopped part way)",
    make: () => ({ ...blank("email"), name: "Finish the form", trigger: "stopped", delayMinutes: 60, subject: "Finish your form", body: "Hi {first_name},\n\nYou started our form but didn't get to the end. It only takes a few more minutes:\n{form_link}\n\n{institute}" }),
  },
  {
    label: "Tell the team",
    make: () => ({ ...blank("team"), name: "Tell the team", subject: "{name} sent {form}", body: "{name} sent {form}. Match: {match} ({match_label}). Work style: {outcome}." }),
  },
];

function blank(channel: Automation["channel"]): Automation {
  return { id: newId(), name: "", active: true, trigger: "sent", delayMinutes: 0, channel, subject: channel === "email" || channel === "team" ? "" : null, body: "", variables: [] };
}

/** "straight away", "after 2 hours", "after 3 days" */
function waitText(m: number): string {
  if (m <= 0) return "straight away";
  if (m % 1440 === 0) return `after ${m / 1440} day${m === 1440 ? "" : "s"}`;
  if (m % 60 === 0) return `after ${m / 60} hour${m === 60 ? "" : "s"}`;
  return `after ${m} minutes`;
}

type Member = { id: string; name: string };

export default function AutomationsTab({ def, onChange, readOnly, instituteId, team }: { def: FormDef; onChange: (d: FormDef) => void; readOnly: boolean; instituteId: string; team: Member[] }) {
  const list = def.automations ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const set = (next: Automation[]) => onChange({ ...def, automations: next });
  const update = (id: string, patch: Partial<Automation>) => set(list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const add = (a: Automation) => {
    set([...list, a]);
    setOpen(a.id);
  };
  const outcomes = def.results?.outcomeEnabled ? def.results.outcomes : [];
  const match = !!def.results?.matchEnabled;

  return (
    <fieldset disabled={readOnly} className="max-w-3xl space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 text-sm">
        <p className="font-medium">Messages this form sends by itself</p>
        <p className="mt-1 text-muted-foreground">
          They go to people who sent (or started) this form, and to your team. Nobody who asked not to be contacted gets one, nor a lead in Possible spam. When the form asks people to confirm their email, messages to them wait until they do. Changes take effect when you publish.{" "}
          <Link href={`/institute/guidance?view=notifications${instituteId ? `&instituteId=${instituteId}` : ""}`} className="text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-400">
            See every message sent in Notifications
          </Link>
          .
        </p>
      </div>

      {list.length === 0 && <p className="text-sm text-muted-foreground">No automatic messages yet. Start from an example, or add one.</p>}

      <ul className="space-y-2">
        {list.map((a) => {
          const Icon = CHANNELS[a.channel].icon;
          const expanded = open === a.id;
          const conditions = [
            a.outcome ? `only ${outcomes.find((o) => o.id === a.outcome)?.name ?? "one outcome"}` : null,
            a.matchFrom != null || a.matchTo != null ? `match ${a.matchFrom ?? 0}–${a.matchTo ?? 100}%` : null,
            a.unlessReportOpened ? "unless they opened their results" : null,
            a.unlessMeeting ? "unless they asked for a meeting" : null,
          ].filter(Boolean);
          return (
            <li key={a.id} className={`rounded-2xl border bg-card ${a.active ? "border-border" : "border-dashed border-border opacity-80"}`}>
              <div className="flex items-center gap-3 p-3">
                <button type="button" onClick={() => setOpen(expanded ? null : a.id)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  {expanded ? <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" /> : <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />}
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{a.name || "(no name yet)"}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {CHANNELS[a.channel].label} · {TRIGGERS[a.trigger].toLowerCase()}, {waitText(a.delayMinutes)}
                      {conditions.length ? ` · ${conditions.join(", ")}` : ""}
                    </span>
                  </span>
                </button>
                <label className="flex shrink-0 items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={a.active} onChange={(e) => update(a.id, { active: e.target.checked })} /> On
                </label>
                <button type="button" aria-label={`Remove ${a.name || "this message"}`} onClick={() => window.confirm("Remove this automatic message?") && set(list.filter((x) => x.id !== a.id))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              {expanded && <AutomationEditor a={a} update={(p) => update(a.id, p)} outcomes={outcomes} match={match} team={team} />}
            </li>
          );
        })}
      </ul>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CHANNELS) as Automation["channel"][]).map((c) => {
            const Icon = CHANNELS[c].icon;
            return (
              <button key={c} type="button" onClick={() => add(blank(c))} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
                <Plus aria-hidden="true" className="h-3.5 w-3.5" /> <Icon aria-hidden="true" className="h-3.5 w-3.5" /> {CHANNELS[c].label}
              </button>
            );
          })}
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium hover:bg-muted">Start from an example</summary>
            <div className="absolute z-10 mt-1 w-72 rounded-xl border border-border bg-popover p-1 shadow-lg">
              {EXAMPLES.map((x) => (
                <button key={x.label} type="button" onClick={() => add(x.make())} className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-muted">
                  {x.label}
                </button>
              ))}
            </div>
          </details>
        </div>
      )}
    </fieldset>
  );
}

function AutomationEditor({ a, update, outcomes, match, team }: { a: Automation; update: (p: Partial<Automation>) => void; outcomes: { id: string; name: string }[]; match: boolean; team: Member[] }) {
  const unit = a.delayMinutes > 0 && a.delayMinutes % 1440 === 0 ? 1440 : a.delayMinutes > 0 && a.delayMinutes % 60 === 0 ? 60 : 1;
  const email = a.channel === "email" || a.channel === "team";
  const fill = (t: string | null | undefined) => (t ?? "").replace(/\{(\w+)\}/g, (m, k: string) => FIELDS.find((f) => f[0] === k)?.[1] ?? m);
  const insert = (key: string) => update({ body: `${a.body ?? ""}{${key}}` });
  return (
    <div className="space-y-3 border-t border-border p-4 text-xs">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block font-medium">
          Name (for you)
          <input className={field} maxLength={80} value={a.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Your results" />
        </label>
        <label className="block font-medium">
          Send
          <select className={field} value={a.channel} onChange={(e) => update({ channel: e.target.value as Automation["channel"], subject: e.target.value === "email" || e.target.value === "team" ? (a.subject ?? "") : null })}>
            {(Object.keys(CHANNELS) as Automation["channel"][]).map((c) => (
              <option key={c} value={c}>
                {CHANNELS[c].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block font-medium">
          When
          <select
            className={field}
            value={a.trigger}
            onChange={(e) => {
              const trigger = e.target.value as Automation["trigger"];
              update({ trigger, delayMinutes: trigger === "stopped" ? Math.max(60, a.delayMinutes) : a.delayMinutes });
            }}
          >
            {(Object.keys(TRIGGERS) as Automation["trigger"][]).map((t) => (
              <option key={t} value={t}>
                {TRIGGERS[t]}
              </option>
            ))}
          </select>
        </label>
        <div className="block font-medium">
          Wait
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              min={0}
              aria-label="How long to wait"
              className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={a.delayMinutes / unit}
              onChange={(e) => update({ delayMinutes: Math.min(43200, Math.max(0, Math.round((Number(e.target.value) || 0) * unit))) })}
            />
            <select aria-label="Unit" className="rounded-lg border border-border bg-background px-2 py-2 text-sm" value={unit} onChange={(e) => update({ delayMinutes: Math.min(43200, (a.delayMinutes / unit) * Number(e.target.value)) })}>
              <option value={1}>minutes</option>
              <option value={60}>hours</option>
              <option value={1440}>days</option>
            </select>
          </div>
          {a.trigger === "stopped" && <span className="mt-1 block font-normal text-muted-foreground">At least 30 minutes, so people still filling it in aren&apos;t interrupted. Skipped if they finish first.</span>}
        </div>
      </div>

      {a.channel === "team" && <Recipients a={a} update={update} team={team} />}

      {email && (
        <label className="block font-medium">
          Subject
          <input className={field} maxLength={200} value={a.subject ?? ""} onChange={(e) => update({ subject: e.target.value })} />
        </label>
      )}
      {a.channel !== "whatsapp" ? (
        <label className="block font-medium">
          {a.channel === "sms" ? "Text" : "Message"}
          <textarea rows={a.channel === "sms" ? 3 : 7} maxLength={a.channel === "sms" ? 640 : 5000} className={field} value={a.body ?? ""} onChange={(e) => update({ body: e.target.value })} />
        </label>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <label className="block font-medium">
            Approved template name in Pulse Relay
            <input className={field} maxLength={120} value={a.templateName ?? ""} onChange={(e) => update({ templateName: e.target.value })} placeholder="e.g. quiz_results" />
          </label>
          <label className="block font-medium">
            Language
            <input className={field} maxLength={10} value={a.templateLanguage ?? "en"} onChange={(e) => update({ templateLanguage: e.target.value })} />
          </label>
          <label className="block font-medium sm:col-span-2">
            Its variables, in order (one per line)
            <textarea rows={3} className={field} value={(a.variables ?? []).join("\n")} onChange={(e) => update({ variables: e.target.value.split("\n").slice(0, 10) })} placeholder={"{first_name}\n{report_link}"} />
          </label>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground">Add a field:</span>
        {FIELDS.filter(([k]) => a.channel === "team" || k !== "lead_link").map(([k]) => (
          <button key={k} type="button" onClick={() => (a.channel === "whatsapp" ? update({ variables: [...(a.variables ?? []), `{${k}}`] }) : insert(k))} className="rounded-full border border-border px-2 py-0.5 font-mono hover:bg-muted">
            {`{${k}}`}
          </button>
        ))}
      </div>
      {a.channel === "sms" && (
        <label className="block font-medium">
          DLT template id <span className="font-normal text-muted-foreground">(India: the registered template this text matches)</span>
          <input className={field} maxLength={40} value={a.dltTemplateId ?? ""} onChange={(e) => update({ dltTemplateId: e.target.value })} />
        </label>
      )}

      <div className="space-y-2 rounded-lg bg-muted/40 p-3">
        <p className="font-medium">Only when</p>
        {outcomes.length > 0 && (
          <label className="flex flex-wrap items-center gap-2">
            The result is
            <select className="rounded-md border border-border bg-background px-2 py-1" value={a.outcome ?? ""} onChange={(e) => update({ outcome: e.target.value || null })}>
              <option value="">any outcome</option>
              {outcomes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {match && (
          <div className="flex flex-wrap items-center gap-2">
            The match score is from
            <input type="number" min={0} max={100} aria-label="Lowest match" className="w-16 rounded-md border border-border bg-background px-2 py-1" value={a.matchFrom ?? ""} placeholder="0" onChange={(e) => update({ matchFrom: e.target.value === "" ? null : Number(e.target.value) })} />
            % to
            <input type="number" min={0} max={100} aria-label="Highest match" className="w-16 rounded-md border border-border bg-background px-2 py-1" value={a.matchTo ?? ""} placeholder="100" onChange={(e) => update({ matchTo: e.target.value === "" ? null : Number(e.target.value) })} />%
          </div>
        )}
        {a.channel === "email" && (
          <>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!a.scoreCard} onChange={(e) => update({ scoreCard: e.target.checked })} /> Show their score card above the message (your logo, the score,
              next steps and a button to their report)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!a.attachReport} onChange={(e) => update({ attachReport: e.target.checked })} /> Attach their report as a PDF
            </label>
          </>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!a.unlessReportOpened} onChange={(e) => update({ unlessReportOpened: e.target.checked })} /> Not if they&apos;ve opened their results by then
        </label>
        {a.trigger !== "booking" && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!a.unlessMeeting} onChange={(e) => update({ unlessMeeting: e.target.checked })} /> Not if they&apos;ve asked for a meeting by then
          </label>
        )}
      </div>

      {a.channel !== "whatsapp" && (a.body ?? "").trim() && (
        <div>
          <p className="font-medium text-muted-foreground">How it reads (example)</p>
          <div className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm">
            {email && <p className="mb-2 font-semibold">{fill(a.subject)}</p>}
            {fill(a.body)}
          </div>
        </div>
      )}
    </div>
  );
}

/** Who an email to the team goes to: the lead's owner, chosen team members and other addresses (any mix) */
function Recipients({ a, update, team }: { a: Automation; update: (p: Partial<Automation>) => void; team: Member[] }) {
  const members = a.members ?? [];
  const emails = a.emails ?? [];
  const toOwner = a.toOwner !== false;
  const nobody = !toOwner && members.length === 0 && !emails.some((e) => e.trim());
  return (
    <div className="space-y-2.5 rounded-lg bg-muted/40 p-3">
      <p className="font-medium">Send to</p>
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-0.5" checked={toOwner} onChange={(e) => update({ toOwner: e.target.checked })} />
        <span>
          The lead&apos;s owner <span className="text-muted-foreground">(your CRM admins when nobody owns it yet)</span>
        </span>
      </label>
      {team.length > 0 ? (
        <div>
          <p className="text-muted-foreground">Also these team members</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
            {team.map((m) => (
              <label key={m.id} className="flex items-center gap-1.5">
                <input type="checkbox" checked={members.includes(m.id)} onChange={(e) => update({ members: e.target.checked ? [...members, m.id] : members.filter((x) => x !== m.id) })} />
                {m.name}
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">Add your team in the CRM&apos;s Settings to choose people here.</p>
      )}
      <label className="block font-medium">
        Other email addresses <span className="font-normal text-muted-foreground">(one per line, up to 10, e.g. your admissions inbox)</span>
        <textarea rows={2} className={field} value={emails.join("\n")} onChange={(e) => update({ emails: e.target.value.split("\n").slice(0, 10) })} placeholder="admissions@yourschool.edu" />
      </label>
      {nobody && <p role="alert" className="text-amber-700 dark:text-amber-400">Choose who it goes to.</p>}
    </div>
  );
}
