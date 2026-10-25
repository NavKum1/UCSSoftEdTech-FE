"use client";

/**
 * A lead's communication history, made to be read quickly before calling or replying: a summary (last contact, their
 * last reply, counts per channel), key facts the team pinned, filters by type with counts, search, and the history by
 * day: their replies on the left, the team's messages on the right (full text one click away), calls with how they
 * went, notes highlighted, and pipeline changes as single grey lines.
 */

import React, { useMemo, useState } from "react";
import { CalendarClock, Mail, MessageCircle, MessageSquare, NotebookPen, Phone, Pin, PinOff, Reply, Search } from "lucide-react";
import { CALL_OUTCOMES, relative, type Activity } from "./api";

const OUT = ["Email", "Sms", "WhatsApp"];
const CHANGES = ["Stage", "Assignment", "Task", "System"];

type Filter = "all" | "conversation" | "calls" | "notes" | "changes";
const FILTERS: { key: Filter; label: string; match: (a: Activity) => boolean }[] = [
  { key: "all", label: "Everything", match: () => true },
  { key: "conversation", label: "Messages", match: (a) => [...OUT, "EmailReply"].includes(a.kind) },
  { key: "calls", label: "Calls and meetings", match: (a) => a.kind === "Call" || a.kind === "Meeting" },
  { key: "notes", label: "Notes", match: (a) => a.kind === "Note" },
  { key: "changes", label: "Changes", match: (a) => CHANGES.includes(a.kind) },
];

const CHANNEL: Record<string, { label: string; icon: React.ElementType }> = {
  Email: { label: "Email", icon: Mail },
  EmailReply: { label: "Email", icon: Mail },
  Sms: { label: "SMS", icon: MessageSquare },
  WhatsApp: { label: "WhatsApp", icon: MessageCircle },
  Call: { label: "Call", icon: Phone },
  Meeting: { label: "Meeting", icon: CalendarClock },
  Note: { label: "Note", icon: NotebookPen },
};

function day(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function Communication({
  items,
  personName,
  busy,
  onPin,
  onReply,
}: {
  items: Activity[];
  personName: string;
  busy: boolean;
  onPin: (a: Activity, pinned: boolean) => void;
  onReply: (subject: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const lastOut = items.find((a) => [...OUT, "Call", "Meeting"].includes(a.kind));
  const lastIn = items.find((a) => a.kind === "EmailReply");
  const awaiting = !!lastIn && (!lastOut || new Date(lastIn.createdAt) > new Date(lastOut.createdAt));
  const calls = items.filter((a) => a.kind === "Call");
  const reached = calls.filter((a) => a.meta?.outcome === "Reached").length;
  const pinned = items.filter((a) => a.pinned);

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const t = q.trim().toLowerCase();
    return items.filter((a) => f.match(a) && (!t || `${a.subject ?? ""} ${a.body} ${a.actorName}`.toLowerCase().includes(t)));
  }, [items, filter, q]);

  const groups = useMemo(() => {
    const g: [string, Activity[]][] = [];
    for (const a of shown) {
      const d = day(a.createdAt);
      if (g.length && g[g.length - 1][0] === d) g[g.length - 1][1].push(a);
      else g.push([d, [a]]);
    }
    return g;
  }, [shown]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Fact label="Last contact" value={lastOut ? `${CHANNEL[lastOut.kind]?.label ?? lastOut.kind} ${relative(lastOut.createdAt)}` : "Never"} sub={lastOut?.actorName} warn={!lastOut} />
        <Fact label="Their last reply" value={lastIn ? relative(lastIn.createdAt) : "None yet"} sub={awaiting ? "Waiting for your answer" : undefined} warn={awaiting} />
        <Fact label="Calls" value={String(calls.length)} sub={calls.length ? `${reached} answered` : undefined} />
        <Fact
          label="Messages"
          value={String(items.filter((a) => OUT.includes(a.kind)).length)}
          sub={`${items.filter((a) => a.kind === "EmailReply").length} replies`}
        />
      </dl>

      {/* Key facts */}
      <section aria-label="Key facts" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold">
          <Pin aria-hidden="true" className="h-3.5 w-3.5" /> Key facts
        </h3>
        {pinned.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Pin what every counsellor should know before talking to {personName} (budget, preferred time, what they decided). Use the pin on any note, call or message.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1.5 text-sm">
            {pinned.map((a) => (
              <li key={a.id} className="flex items-start gap-2">
                <span className="min-w-0 flex-1 whitespace-pre-wrap">
                  {a.subject ? <span className="font-medium">{a.subject}: </span> : null}
                  {a.body || CALL_OUTCOMES[String(a.meta?.outcome)] || CHANNEL[a.kind]?.label}
                  <span className="block text-xs text-muted-foreground">
                    {CHANNEL[a.kind]?.label ?? a.kind} · {a.actorName} · {day(a.createdAt)}
                  </span>
                </span>
                <button type="button" disabled={busy} onClick={() => onPin(a, false)} aria-label="Unpin" className="rounded p-1 text-muted-foreground hover:bg-muted">
                  <PinOff aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Filters and search */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const n = items.filter(f.match).length;
          return (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} className={`rounded-full border px-2.5 py-1 text-xs ${filter === f.key ? "border-cyan-700 bg-cyan-700 text-white" : "border-border hover:bg-muted"}`}>
              {f.label} <span className="tabular-nums opacity-75">{n}</span>
            </button>
          );
        })}
        <label className="relative ml-auto min-w-40 flex-1 sm:flex-none">
          <span className="sr-only">Search the history</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the history" className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-xs focus:border-cyan-600 focus:outline-none" />
        </label>
      </div>

      {items.length === 0 && <p className="text-sm text-muted-foreground">No communication yet. Use the buttons above to call, email or message {personName}; everything is kept here.</p>}
      {items.length > 0 && shown.length === 0 && <p className="text-sm text-muted-foreground">Nothing matches.</p>}

      {groups.map(([d, list]) => (
        <section key={d} aria-label={d}>
          <h3 className="sticky top-0 z-1 mb-2 bg-card py-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{d}</h3>
          <ol className="space-y-2.5">
            {list.map((a) => (
              <Item key={a.id} a={a} personName={personName} busy={busy} onPin={onPin} onReply={onReply} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function Fact({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium ${warn ? "text-amber-800 dark:text-amber-300" : ""}`}>{value}</dd>
      {sub && <dd className={`truncate ${warn ? "font-medium text-amber-800 dark:text-amber-300" : "text-muted-foreground"}`}>{sub}</dd>}
    </div>
  );
}

function Body({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 320 || text.split("\n").length > 6;
  return (
    <>
      <p className={`whitespace-pre-wrap ${long && !open ? "line-clamp-6" : ""}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-400">
          {open ? "Show less" : "Show the full message"}
        </button>
      )}
    </>
  );
}

function PinButton({ a, busy, onPin }: { a: Activity; busy: boolean; onPin: (a: Activity, p: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onPin(a, !a.pinned)}
      aria-label={a.pinned ? "Unpin from key facts" : "Pin as a key fact"}
      title={a.pinned ? "Unpin from key facts" : "Pin as a key fact"}
      className={`rounded p-1 hover:bg-muted ${a.pinned ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
    >
      <Pin aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  );
}

function Item({ a, personName, busy, onPin, onReply }: { a: Activity; personName: string; busy: boolean; onPin: (a: Activity, p: boolean) => void; onReply: (s: string) => void }) {
  const meta = a.meta ?? {};
  const failed = meta.delivered === false || meta.sent === false;

  if (CHANGES.includes(a.kind)) {
    return (
      <li className="text-center text-xs text-muted-foreground">
        {a.body} · {a.actorName} · {time(a.createdAt)}
      </li>
    );
  }

  const Icon = CHANNEL[a.kind]?.icon ?? NotebookPen;
  const head = (who: string, what: string) => (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          <span className="font-medium text-foreground">{who}</span> · {what} · {time(a.createdAt)}
        </span>
      </span>
      <PinButton a={a} busy={busy} onPin={onPin} />
    </div>
  );

  if (a.kind === "EmailReply") {
    return (
      <li className="mr-8 rounded-2xl rounded-tl-sm border border-cyan-600/40 bg-cyan-600/5 p-3 text-sm">
        {head(personName, "replied by email")}
        <div className="mt-1.5">
          <Body text={a.body} />
        </div>
        <button type="button" onClick={() => onReply(a.subject ?? "")} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted">
          <Reply aria-hidden="true" className="h-3.5 w-3.5" /> Reply
        </button>
      </li>
    );
  }

  if (OUT.includes(a.kind)) {
    const what = a.kind === "Email" ? `emailed ${typeof meta.to === "string" ? meta.to : ""}` : a.kind === "Sms" ? "sent an SMS" : "opened a WhatsApp chat";
    return (
      <li className="ml-8 rounded-2xl rounded-tr-sm border border-border bg-muted/50 p-3 text-sm">
        {head(a.actorName, what)}
        {a.subject && <p className="mt-1.5 font-medium">{a.subject}</p>}
        <div className="mt-1">{a.body ? <Body text={a.body} /> : <p className="text-muted-foreground">No message text.</p>}</div>
        {failed && <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">Not delivered{typeof meta.error === "string" ? ` (${meta.error})` : ""}. Try again or use another channel.</p>}
      </li>
    );
  }

  if (a.kind === "Call") {
    const outcome = String(meta.outcome ?? "");
    return (
      <li className="rounded-xl border border-border p-3 text-sm">
        {head(a.actorName, "called")}
        <p className="mt-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${outcome === "Reached" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
            {CALL_OUTCOMES[outcome] ?? outcome}
          </span>
        </p>
        {a.body && (
          <div className="mt-1.5">
            <Body text={a.body} />
          </div>
        )}
      </li>
    );
  }

  if (a.kind === "Meeting") {
    return (
      <li className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-sm">
        {head(a.actorName, "booked a meeting")}
        <p className="mt-1.5 font-medium">{typeof meta.at === "string" ? new Date(meta.at).toLocaleString([], { dateStyle: "full", timeStyle: "short" }) : ""}</p>
        {a.body && <Body text={a.body} />}
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
      {head(a.actorName, "note")}
      <div className="mt-1.5">
        <Body text={a.body} />
      </div>
    </li>
  );
}
