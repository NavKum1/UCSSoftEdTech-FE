"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";

interface Segment {
  roles: string[];
  statuses: string[];
  degreeLevels: string[];
  majors: string[];
  graduationFrom: string | null;
  graduationTo: string | null;
  workAuthorizations: string[];
  hadAppointment: boolean | null;
  hadDocReview: boolean | null;
  activityDays: number | null;
}

interface Options {
  categories: string[];
  mergeFields: string[];
  roles: string[];
  statuses: string[];
  degreeLevels: string[];
  workAuthorizations: string[];
}

interface CampaignRow {
  id: string;
  name: string;
  category: string;
  subject: string;
  status: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  recipientCount: number;
  sent: number;
  failed: number;
  createdAt: string;
}

interface CampaignDetail extends CampaignRow {
  body: string;
  sendEmail: boolean;
  sendInApp: boolean;
  segment: Partial<Segment>;
  metrics: { recipients: number; pending: number; sent: number; failed: number; suppressed: number; emailsSent: number; inAppSent: number; unsubscribes: number; trackingNote: string };
  failures: { name: string; email: string; error?: string | null }[];
}

interface Preview {
  count: number;
  emailUnsubscribed: number;
  notSignedIn: number;
  sample: { name: string; email: string; signedIn: boolean }[];
  rendered: { subject: string; body: string } | null;
}

const EMPTY: Segment = { roles: [], statuses: ["Active"], degreeLevels: [], majors: [], graduationFrom: null, graduationTo: null, workAuthorizations: [], hadAppointment: null, hadDocReview: null, activityDays: 180 };

const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "info" | "bad"> = { Draft: "neutral", Scheduled: "info", Sending: "warn", Sent: "good", Cancelled: "bad" };

function MultiCheck({ legend, options, value, onChange }: { legend: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={value.includes(o)} onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))} />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TriState({ legend, value, onChange }: { legend: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <Field label={legend}>
      {(p) => (
        <select {...p} value={value === null ? "" : value ? "yes" : "no"} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "yes")}>
          <option value="">Any</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      )}
    </Field>
  );
}

/** Campaign builder (segment, preview, schedule or send now), history and metrics for career-center staff. */
export default function CampaignsPanel() {
  const api = useApi();
  const options = useLoad(() => api<Options>("/api/career/messaging/campaigns/options"));
  const list = useLoad(() => api<CampaignRow[]>("/api/career/messaging/campaigns"));
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {editing ? (
        <Builder
          key={editing}
          id={editing === "new" ? null : editing}
          options={options.data}
          onDone={(id) => {
            setEditing(null);
            list.reload();
            if (id) setViewing(id);
          }}
        />
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>New campaign</Button>
        </div>
      )}
      {viewing && !editing && <Metrics id={viewing} onEdit={() => setEditing(viewing)} onChanged={list.reload} onClose={() => setViewing(null)} />}
      <Card title="Campaign history">
        <ErrorBanner error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? (
          <Loading />
        ) : list.data && list.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Campaigns</caption>
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3">Name</th>
                  <th scope="col" className="py-2 pr-3">Category</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2 pr-3">When</th>
                  <th scope="col" className="py-2 pr-3">Recipients</th>
                  <th scope="col" className="py-2 pr-3">Sent / failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.data.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-3">
                      <button type="button" className="font-medium underline" onClick={() => setViewing(c.id)}>
                        {c.name}
                      </button>
                    </td>
                    <td className="py-2 pr-3">{c.category}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                    </td>
                    <td className="py-2 pr-3">{formatDate(c.completedAt ?? c.scheduledAt ?? c.createdAt, true)}</td>
                    <td className="py-2 pr-3">{c.recipientCount}</td>
                    <td className="py-2 pr-3">
                      {c.sent} / {c.failed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No campaigns yet">Create one to reach a group of your students or alumni.</EmptyState>
        )}
      </Card>
    </div>
  );
}

function Builder({ id, options, onDone }: { id: string | null; options: Options | null; onDone: (id: string | null) => void }) {
  const api = useApi();
  const existing = useLoad(() => (id ? api<CampaignDetail>(`/api/career/messaging/campaigns/${id}`) : Promise.resolve(null)), [id]);
  const [form, setForm] = useState<{ name: string; category: string; subject: string; body: string; sendEmail: boolean; sendInApp: boolean; segment: Segment } | null>(null);
  const [majorsText, setMajorsText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existing.loading && id) return <Loading />;
  const f =
    form ??
    (existing.data
      ? { name: existing.data.name, category: existing.data.category, subject: existing.data.subject, body: existing.data.body, sendEmail: existing.data.sendEmail, sendInApp: existing.data.sendInApp, segment: { ...EMPTY, ...stripNulls(existing.data.segment) } }
      : { name: "", category: "announcements", subject: "", body: "Hi {{firstName}},\n\n", sendEmail: true, sendInApp: true, segment: EMPTY });
  const set = (patch: Partial<typeof f>) => setForm({ ...f, ...patch });
  const setSeg = (patch: Partial<Segment>) => setForm({ ...f, segment: { ...f.segment, ...patch } });
  const payload = () => ({ ...f, segment: { ...f.segment, majors: majorsText ? majorsText.split(",").map((m) => m.trim()).filter(Boolean) : f.segment.majors } });

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    const body = payload();
    const res = id ? await api<CampaignDetail>(`/api/career/messaging/campaigns/${id}`, { method: "PUT", json: body }) : await api<CampaignDetail>("/api/career/messaging/campaigns", { json: body });
    return res.id;
  };

  return (
    <Card title={id ? "Edit campaign" : "New campaign"}>
      <div aria-live="polite">
        <ErrorBanner error={error} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Campaign name (staff only)">{(p) => <input {...p} value={f.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
        <Field label="Category" hint="Recipients can unsubscribe from each category.">
          {(p) => (
            <select {...p} value={f.category} onChange={(e) => set({ category: e.target.value })}>
              {(options?.categories ?? ["announcements"]).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Field>
        <div className="md:col-span-2">
          <Field label="Subject" hint="Merge fields: {{firstName}}, {{school}}">{(p) => <input {...p} maxLength={200} value={f.subject} onChange={(e) => set({ subject: e.target.value })} />}</Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Message" hint="Plain text; blank lines start new paragraphs. A footer with your school contact and an unsubscribe link is added to emails.">
            {(p) => <textarea {...p} rows={8} maxLength={20000} value={f.body} onChange={(e) => set({ body: e.target.value })} />}
          </Field>
        </div>
        <fieldset className="md:col-span-2 flex flex-wrap gap-4">
          <legend className="sr-only">Channels</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.sendEmail} onChange={(e) => set({ sendEmail: e.target.checked })} /> Email
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.sendInApp} onChange={(e) => set({ sendInApp: e.target.checked })} /> In-app notification
          </label>
        </fieldset>
      </div>

      <h3 className="mt-6 mb-3 text-sm font-semibold">Who receives it</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <MultiCheck legend="Role (none = students and alumni)" options={options?.roles ?? ["Student", "Alumni"]} value={f.segment.roles} onChange={(v) => setSeg({ roles: v })} />
        <MultiCheck legend="Membership status" options={options?.statuses ?? ["Active", "Invited"]} value={f.segment.statuses} onChange={(v) => setSeg({ statuses: v })} />
        <MultiCheck legend="Degree level" options={options?.degreeLevels ?? []} value={f.segment.degreeLevels} onChange={(v) => setSeg({ degreeLevels: v })} />
        <Field label="Majors (comma-separated, partial match)">{(p) => <input {...p} value={majorsText || f.segment.majors.join(", ")} onChange={(e) => setMajorsText(e.target.value)} />}</Field>
        <Field label="Graduating on or after">{(p) => <input {...p} type="date" value={f.segment.graduationFrom ?? ""} onChange={(e) => setSeg({ graduationFrom: e.target.value || null })} />}</Field>
        <Field label="Graduating on or before">{(p) => <input {...p} type="date" value={f.segment.graduationTo ?? ""} onChange={(e) => setSeg({ graduationTo: e.target.value || null })} />}</Field>
        <div className="md:col-span-2">
          <MultiCheck legend="Work authorization" options={options?.workAuthorizations ?? []} value={f.segment.workAuthorizations} onChange={(v) => setSeg({ workAuthorizations: v })} />
        </div>
        <TriState legend="Had an advising appointment" value={f.segment.hadAppointment} onChange={(v) => setSeg({ hadAppointment: v })} />
        <TriState legend="Submitted a document for review" value={f.segment.hadDocReview} onChange={(v) => setSeg({ hadDocReview: v })} />
        <Field label="Activity window (days)">
          {(p) => <input {...p} type="number" min={1} max={3650} value={f.segment.activityDays ?? 180} onChange={(e) => setSeg({ activityDays: Number(e.target.value) || 180 })} />}
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="secondary" busy={busy} onClick={() => act(async () => setPreview(await api<Preview>("/api/career/messaging/campaigns/preview", { json: payload() })))}>
          Preview recipients
        </Button>
        <Button variant="secondary" busy={busy} onClick={() => act(async () => onDone(await save()))}>
          Save draft
        </Button>
        <Button variant="ghost" onClick={() => onDone(null)}>
          Cancel
        </Button>
      </div>

      {preview && (
        <div role="status" className="mt-4 rounded-md border border-border p-4 text-sm">
          <p className="font-medium">
            {preview.count} recipient{preview.count === 1 ? "" : "s"}
            {preview.emailUnsubscribed > 0 && ` · ${preview.emailUnsubscribed} unsubscribed from this category's email`}
            {preview.notSignedIn > 0 && ` · ${preview.notSignedIn} not signed in yet (email only)`}
          </p>
          {preview.sample.length > 0 && (
            <p className="mt-1 text-muted-foreground">Sample: {preview.sample.map((s) => `${s.name} (${s.email})`).join("; ")}</p>
          )}
          {preview.rendered && (
            <div className="mt-3 rounded-md bg-muted p-3">
              <p className="font-medium">{preview.rendered.subject}</p>
              <p className="mt-1 whitespace-pre-wrap">{preview.rendered.body}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-border pt-4">
        <Field label="Schedule for (your local time)">{(p) => <input {...p} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />}</Field>
        <Button
          busy={busy}
          disabled={!when}
          onClick={() =>
            act(async () => {
              const cid = await save();
              await api(`/api/career/messaging/campaigns/${cid}/schedule`, { json: { at: new Date(when).toISOString() } });
              onDone(cid);
            })
          }
        >
          Schedule
        </Button>
        <Button
          busy={busy}
          onClick={() =>
            act(async () => {
              if (!window.confirm("Send this campaign now?")) return;
              const cid = await save();
              await api(`/api/career/messaging/campaigns/${cid}/schedule`, { json: {} });
              onDone(cid);
            })
          }
        >
          Send now
        </Button>
      </div>
    </Card>
  );
}

function stripNulls(seg: Partial<Segment>): Partial<Segment> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(seg)) if (v !== null && v !== undefined) out[k] = v;
  if ("hadAppointment" in seg) out.hadAppointment = seg.hadAppointment ?? null;
  if ("hadDocReview" in seg) out.hadDocReview = seg.hadDocReview ?? null;
  return out as Partial<Segment>;
}

function Metrics({ id, onEdit, onChanged, onClose }: { id: string; onEdit: () => void; onChanged: () => void; onClose: () => void }) {
  const api = useApi();
  const { data, error, loading, reload } = useLoad(() => api<CampaignDetail>(`/api/career/messaging/campaigns/${id}`), [id]);
  const [msg, setMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (!data) return null;
  const m = data.metrics;
  const act = (fn: () => Promise<unknown>, success: string) =>
    fn()
      .then(() => {
        setMsg(success);
        reload();
        onChanged();
      })
      .catch((e: Error) => setActionError(e.message));
  const stats: [string, number][] = [
    ["Recipients", m.recipients || data.recipientCount],
    ["Pending", m.pending],
    ["Delivered", m.sent],
    ["Emails sent", m.emailsSent],
    ["In-app sent", m.inAppSent],
    ["Failed", m.failed],
    ["Email suppressed", m.suppressed],
    ["Unsubscribes", m.unsubscribes],
  ];
  return (
    <Card
      title={data.name}
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={reload}>
            Refresh
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div aria-live="polite">
        <ErrorBanner error={actionError} />
        <SuccessBanner message={msg} />
      </div>
      <p className="mb-3 text-sm">
        <Badge tone={STATUS_TONE[data.status]}>{data.status}</Badge> <span className="ml-2">{data.subject}</span>
        {data.scheduledAt && <span className="ml-2 text-muted-foreground">Scheduled {formatDate(data.scheduledAt, true)}</span>}
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-md border border-border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">{m.trackingNote}</p>
      {data.failures.length > 0 && (
        <details className="mt-3 text-sm">
          <summary>Failed deliveries ({data.failures.length})</summary>
          <ul className="mt-2 list-disc pl-5">
            {data.failures.map((x) => (
              <li key={x.email}>
                {x.name} ({x.email}): {x.error}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {(data.status === "Draft" || data.status === "Scheduled") && (
          <Button variant="secondary" onClick={onEdit}>
            Edit
          </Button>
        )}
        {(data.status === "Scheduled" || data.status === "Sending") && (
          <Button variant="danger" onClick={() => act(() => api(`/api/career/messaging/campaigns/${id}/cancel`, { method: "POST" }), "Campaign cancelled.")}>
            Cancel sending
          </Button>
        )}
        {data.status === "Draft" && (
          <Button
            variant="danger"
            onClick={() =>
              act(async () => {
                await api(`/api/career/messaging/campaigns/${id}`, { method: "DELETE" });
                onClose();
              }, "Draft deleted.")
            }
          >
            Delete draft
          </Button>
        )}
      </div>
    </Card>
  );
}
