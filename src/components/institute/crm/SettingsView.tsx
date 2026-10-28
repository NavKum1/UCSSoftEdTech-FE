"use client";

/**
 * CRM settings (institute admins): the admissions team who can own leads, email templates, and integrations (the signed
 * webhook to the institute's own systems, and SMS through Pulse Relay).
 */

import React, { useState } from "react";
import { Check, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { crm, type GetToken, type Member, type Template } from "./api";
import RichTextEditor from "./RichTextEditor";
import WebhookEvents from "./WebhookEvents";

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20";
const primary = "inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-50";
const secondary = "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";

export default function SettingsView({
  getToken,
  team,
  templates,
  webhookUrl,
  reload,
}: {
  getToken: GetToken;
  team: Member[];
  templates: Template[];
  webhookUrl: string;
  reload: () => void;
}) {
  const [section, setSection] = useState<"team" | "templates" | "integrations">(team.length === 0 ? "team" : "team");
  return (
    <div className="grid gap-6 md:grid-cols-[12rem_1fr]">
      <nav aria-label="Settings" className="flex gap-1 md:flex-col">
        {(
          [
            ["team", "Team"],
            ["templates", "Email templates"],
            ["integrations", "Integrations"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" aria-current={section === k ? "page" : undefined} onClick={() => setSection(k)} className={`rounded-lg px-3 py-2 text-left text-sm ${section === k ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"}`}>
            {label}
          </button>
        ))}
      </nav>
      <div>
        {section === "team" && <TeamSettings getToken={getToken} team={team} reload={reload} />}
        {section === "templates" && <TemplateSettings getToken={getToken} templates={templates} reload={reload} />}
        {section === "integrations" && <Integrations getToken={getToken} webhookUrl={webhookUrl} reload={reload} />}
      </div>
    </div>
  );
}

function Message({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return (
    <p role={m.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${m.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-800 dark:text-red-300"}`}>
      {m.text}
    </p>
  );
}

function TeamSettings({ getToken, team, reload }: { getToken: GetToken; team: Member[]; reload: () => void }) {
  const blank = { name: "", email: "", role: "Counsellor" as Member["role"], active: true };
  const [form, setForm] = useState<typeof blank & { id?: string }>(blank);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (m: typeof form, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await crm(getToken, m.id ? `/team/${m.id}` : "/team", { method: m.id ? "PUT" : "POST", body: m });
      setMsg({ ok: true, text: done });
      setForm(blank);
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Admissions team</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          People who can own leads and get follow-up reminders. Use the email they sign in with, so &ldquo;My leads&rdquo; finds theirs. Counsellors also need the
          Counselor role on their Edulexa account to open the CRM.
        </p>
      </div>
      <Message m={msg} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(form, form.id ? "Saved." : `${form.name} added.`);
        }}
        className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1fr_10rem_auto]"
      >
        <input className={input} placeholder="Name" aria-label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} />
        <input className={input} type="email" placeholder="Email" aria-label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <select className={input} aria-label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Member["role"] })}>
          <option value="Counsellor">Counsellor</option>
          <option value="Admin">Admin</option>
        </select>
        <div className="flex gap-2">
          <button type="submit" className={primary} disabled={busy}>
            {form.id ? <Check aria-hidden="true" className="h-4 w-4" /> : <Plus aria-hidden="true" className="h-4 w-4" />}
            {form.id ? "Save" : "Add"}
          </button>
          {form.id && (
            <button type="button" className={secondary} onClick={() => setForm(blank)}>
              Cancel
            </button>
          )}
        </div>
      </form>
      {team.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one yet. Add yourself first, then your counsellors.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {team.map((m) => (
            <li key={m.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm ${m.active ? "" : "opacity-60"}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {m.name} <span className="text-xs font-normal text-muted-foreground">· {m.role}{m.active ? "" : " · inactive"}</span>
                </p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <button type="button" className={secondary} onClick={() => setForm({ ...m })} aria-label={`Edit ${m.name}`}>
                <Pencil aria-hidden="true" className="h-3.5 w-3.5" /> Edit
              </button>
              <button type="button" className={secondary} disabled={busy} onClick={() => save({ ...m, active: !m.active }, m.active ? `${m.name} deactivated; their leads keep them as owner until reassigned.` : `${m.name} is active again.`)}>
                {m.active ? "Deactivate" : "Reactivate"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STARTERS = [
  {
    name: "First reply",
    subject: "Your inquiry about {course}",
    body: "Hi {name},\n\nThank you for asking about {course} at {institute}. I'd be glad to help you decide whether it suits you.\n\nWhen would be a good time for a short call?\n\n{counsellor}\n{institute}",
  },
  {
    name: "Couldn't reach you",
    subject: "Sorry we missed you",
    body: "Hi {name},\n\nI tried to call you about {course} but couldn't reach you. Reply to this email with a time that suits you and I'll call then.\n\n{counsellor}",
  },
];

function TemplateSettings({ getToken, templates, reload }: { getToken: GetToken; templates: Template[]; reload: () => void }) {
  const blank = { name: "", subject: "", body: "" };
  const [form, setForm] = useState<typeof blank & { id?: string }>(blank);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: done });
      setForm(blank);
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Email templates</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Save the emails your team sends often. {"{name}"}, {"{course}"}, {"{institute}"} and {"{counsellor}"} are filled in when sending, and the text can be changed
          before it goes.
        </p>
      </div>
      <Message m={msg} />
      {templates.length === 0 && !form.name && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Start from:</span>
          {STARTERS.map((s) => (
            <button key={s.name} type="button" className={secondary} onClick={() => setForm(s)}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          call(() => crm(getToken, form.id ? `/templates/${form.id}` : "/templates", { method: form.id ? "PUT" : "POST", body: form }), "Template saved.");
        }}
        className="space-y-2 rounded-xl border border-border p-3"
      >
        <input className={input} placeholder="Template name, e.g. First reply" aria-label="Template name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} />
        <input className={input} placeholder="Subject" aria-label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required maxLength={300} />
        <RichTextEditor value={form.body} onChange={(body) => setForm((f) => ({ ...f, body }))} placeholder="Message" />
        <div className="flex gap-2">
          <button type="submit" className={primary} disabled={busy}>
            {form.id ? "Save changes" : "Add template"}
          </button>
          {(form.id || form.name) && (
            <button type="button" className={secondary} onClick={() => setForm(blank)}>
              Cancel
            </button>
          )}
        </div>
      </form>
      <ul className="space-y-2">
        {templates.map((t) => (
          <li key={t.id} className="rounded-xl border border-border bg-card p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{t.name}</p>
                <p className="truncate text-xs text-muted-foreground">{t.subject}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" className={secondary} onClick={() => setForm({ ...t })} aria-label={`Edit ${t.name}`}>
                  <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className={secondary}
                  disabled={busy}
                  aria-label={`Delete ${t.name}`}
                  onClick={() => window.confirm(`Delete the template "${t.name}"?`) && call(() => crm(getToken, `/templates/${t.id}`, { method: "DELETE" }), "Template deleted.")}
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Whether CRM emails note when they're opened (a tiny image in the email). */
function OpenTracking({ getToken }: { getToken: GetToken }) {
  const [on, setOn] = useState<boolean | null>(null);
  React.useEffect(() => {
    crm<{ trackOpens: boolean }>(getToken, "/settings").then((d) => setOn(d.trackOpens)).catch(() => setOn(true));
  }, [getToken]);
  const save = async (v: boolean) => {
    setOn(v);
    await crm(getToken, "/settings", { method: "PUT", body: { trackOpens: v } }).catch(() => setOn(!v));
  };
  return (
    <section className="space-y-1">
      <h2 className="text-base font-semibold">Email opens</h2>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={on ?? true} disabled={on === null} onChange={(e) => save(e.target.checked)} />
        <span>
          Show when people open your emails
          <span className="block text-xs text-muted-foreground">
            A tiny invisible image in each email tells us when it&apos;s opened. Some mail apps (like Apple Mail) open emails automatically, so treat it as a hint. Turn
            it off if your institute&apos;s privacy policy prefers.
          </span>
        </span>
      </label>
    </section>
  );
}

function Integrations({ getToken, webhookUrl, reload }: { getToken: GetToken; webhookUrl: string; reload: () => void }) {
  const [url, setUrl] = useState(webhookUrl);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await authenticatedFetch("/api/institute/webhook-config", { method: "POST", body: JSON.stringify({ outboundWebhookUrl: url.trim() }) }, getToken);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "The URL couldn't be saved.");
      setMsg({ ok: true, text: "Saved. The events below are sent to this URL." });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await crm<{ delivered: boolean; status: number; error: string | null }>(getToken, "/webhook/test", { method: "POST" });
      setMsg(r.delivered ? { ok: true, text: `Your system received the test event (response code ${r.status}).` } : { ok: false, text: r.error ?? `Your system didn't accept the test event (response code ${r.status}). Ask your IT team to check the URL.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Send leads to your own systems</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Optional. If you also use another CRM (HubSpot, Salesforce, Zoho, or Zapier/Make), Edulexa can send each new lead, form and meeting there for you. The address must be https on a public host.
            For your IT team: each event is posted to this URL as JSON, signed with your
            institute&apos;s API key in the <code className="text-xs">X-Edulexa-Signature</code> header (<code className="text-xs">t=timestamp,v1=HMAC-SHA256 of &quot;timestamp.body&quot;</code>).
          </p>
        </div>
        <Message m={msg} />
        <div className="flex flex-wrap gap-2">
          <input className={`${input} min-w-64 flex-1 font-mono`} type="url" placeholder="https://" aria-label="Webhook URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="button" className={primary} disabled={busy || !url.trim() || url.trim() === webhookUrl} onClick={save}>
            Save
          </button>
          <button type="button" className={secondary} disabled={busy || !webhookUrl} onClick={test} title={webhookUrl ? undefined : "Save a URL first"}>
            <Send aria-hidden="true" className="h-4 w-4" /> Send a test event
          </button>
        </div>
        <WebhookEvents getToken={getToken} version={webhookUrl.length} />
      </section>

      <OpenTracking getToken={getToken} />

      <section className="space-y-1">
        <h2 className="text-base font-semibold">SMS and WhatsApp</h2>
        <p className="text-sm text-muted-foreground">
          WhatsApp works without setup: it opens the chat with your message ready. To send SMS from Edulexa, connect your Pulse Relay workspace.
        </p>
        <a href="/career-center/settings/chat-sms" className="inline-block text-sm text-cyan-700 hover:underline dark:text-cyan-400">
          Connect Pulse Relay
        </a>
      </section>
    </div>
  );
}
