"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useLoad, ScrollArea, useCareerT } from "@/components/career/ui";

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
  const t = useCareerT("campaignsPanel");
  return (
    <Field label={legend}>
      {(p) => (
        <select {...p} value={value === null ? "" : value ? "yes" : "no"} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "yes")}>
          <option value="">{t("any")}</option>
          <option value="yes">{t("yes")}</option>
          <option value="no">{t("no")}</option>
        </select>
      )}
    </Field>
  );
}

/** Campaign builder (segment, preview, schedule or send now), history and metrics for career-center staff. */
export default function CampaignsPanel() {
  const t = useCareerT("campaignsPanel");
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
          <Button onClick={() => setEditing("new")}>{t("newCampaign")}</Button>
        </div>
      )}
      {viewing && !editing && <Metrics id={viewing} onEdit={() => setEditing(viewing)} onChanged={list.reload} onClose={() => setViewing(null)} />}
      <Card title={t("campaignHistory")}>
        <ErrorBanner error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? (
          <Loading />
        ) : list.data && list.data.length > 0 ? (
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">{t("campaigns")}</caption>
              <thead className="text-start text-xs text-muted-foreground [&_th]:text-start">
                <tr>
                  <th scope="col" className="py-2 pe-3">{t("name")}</th>
                  <th scope="col" className="py-2 pe-3">{t("category")}</th>
                  <th scope="col" className="py-2 pe-3">{t("status")}</th>
                  <th scope="col" className="py-2 pe-3">{t("when")}</th>
                  <th scope="col" className="py-2 pe-3">{t("recipients")}</th>
                  <th scope="col" className="py-2 pe-3">{t("sentFailed")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.data.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pe-3">
                      <button type="button" className="font-medium underline" onClick={() => setViewing(c.id)}>
                        {c.name}
                      </button>
                    </td>
                    <td className="py-2 pe-3">{c.category}</td>
                    <td className="py-2 pe-3">
                      <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                    </td>
                    <td className="py-2 pe-3">{formatDate(c.completedAt ?? c.scheduledAt ?? c.createdAt, true)}</td>
                    <td className="py-2 pe-3">{c.recipientCount}</td>
                    <td className="py-2 pe-3">
                      {c.sent} / {c.failed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        ) : (
          <EmptyState title={t("noCampaignsYet")}>{t("createOneToReachA")}</EmptyState>
        )}
      </Card>
    </div>
  );
}

function Builder({ id, options, onDone }: { id: string | null; options: Options | null; onDone: (id: string | null) => void }) {
  const t = useCareerT("campaignsPanel");
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
    <Card title={id ? t("editCampaign") : t("newCampaign")}>
      <div aria-live="polite">
        <ErrorBanner error={error} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("campaignNameStaffOnly")}>{(p) => <input {...p} value={f.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
        <Field label={t("category")} hint={t("recipientsCanUnsubscribeFromEach")}>
          {(p) => (
            <select {...p} value={f.category} onChange={(e) => set({ category: e.target.value })}>
              {(options?.categories ?? ["announcements"]).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Field>
        <div className="md:col-span-2">
          <Field label={t("subject")} hint={t("mergeFields")}>{(p) => <input {...p} maxLength={200} value={f.subject} onChange={(e) => set({ subject: e.target.value })} />}</Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t("message")} hint={t("plainTextBlankLinesStart")}>
            {(p) => <textarea {...p} rows={8} maxLength={20000} value={f.body} onChange={(e) => set({ body: e.target.value })} />}
          </Field>
        </div>
        <fieldset className="md:col-span-2 flex flex-wrap gap-4">
          <legend className="sr-only">{t("channels")}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.sendEmail} onChange={(e) => set({ sendEmail: e.target.checked })} />{" "}{t("email")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.sendInApp} onChange={(e) => set({ sendInApp: e.target.checked })} />{" "}{t("inAppNotification")}
          </label>
        </fieldset>
      </div>

      <h3 className="mt-6 mb-3 text-sm font-semibold">{t("whoReceivesIt")}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <MultiCheck legend={t("roleNoneStudentsAndAlumni")} options={options?.roles ?? ["Student", "Alumni"]} value={f.segment.roles} onChange={(v) => setSeg({ roles: v })} />
        <MultiCheck legend={t("membershipStatus")} options={options?.statuses ?? ["Active", "Invited"]} value={f.segment.statuses} onChange={(v) => setSeg({ statuses: v })} />
        <MultiCheck legend={t("degreeLevel")} options={options?.degreeLevels ?? []} value={f.segment.degreeLevels} onChange={(v) => setSeg({ degreeLevels: v })} />
        <Field label={t("majorsCommaSeparatedPartialMatch")}>{(p) => <input {...p} value={majorsText || f.segment.majors.join(", ")} onChange={(e) => setMajorsText(e.target.value)} />}</Field>
        <Field label={t("graduatingOnOrAfter")}>{(p) => <input {...p} type="date" value={f.segment.graduationFrom ?? ""} onChange={(e) => setSeg({ graduationFrom: e.target.value || null })} />}</Field>
        <Field label={t("graduatingOnOrBefore")}>{(p) => <input {...p} type="date" value={f.segment.graduationTo ?? ""} onChange={(e) => setSeg({ graduationTo: e.target.value || null })} />}</Field>
        <div className="md:col-span-2">
          <MultiCheck legend={t("workAuthorization")} options={options?.workAuthorizations ?? []} value={f.segment.workAuthorizations} onChange={(v) => setSeg({ workAuthorizations: v })} />
        </div>
        <TriState legend={t("hadAnAdvisingAppointment")} value={f.segment.hadAppointment} onChange={(v) => setSeg({ hadAppointment: v })} />
        <TriState legend={t("submittedADocumentForReview")} value={f.segment.hadDocReview} onChange={(v) => setSeg({ hadDocReview: v })} />
        <Field label={t("activityWindowDays")}>
          {(p) => <input {...p} type="number" min={1} max={3650} value={f.segment.activityDays ?? 180} onChange={(e) => setSeg({ activityDays: Number(e.target.value) || 180 })} />}
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="secondary" busy={busy} onClick={() => act(async () => setPreview(await api<Preview>("/api/career/messaging/campaigns/preview", { json: payload() })))}>
          {t("previewRecipients")}
        </Button>
        <Button variant="secondary" busy={busy} onClick={() => act(async () => onDone(await save()))}>
          {t("saveDraft")}
        </Button>
        <Button variant="ghost" onClick={() => onDone(null)}>
          {t("cancel")}
        </Button>
      </div>

      {preview && (
        <div role="status" className="mt-4 rounded-md border border-border p-4 text-sm">
          <p className="font-medium">
            {t("countRecipients", { count: preview.count })}
            {preview.emailUnsubscribed > 0 && t("emailUnsubscribedUnsubscribedFromThisCat", { emailUnsubscribed: preview.emailUnsubscribed })}
            {preview.notSignedIn > 0 && t("notSignedInNotSignedInYet", { notSignedIn: preview.notSignedIn })}
          </p>
          {preview.sample.length > 0 && (
            <p className="mt-1 text-muted-foreground">{t("sampleValue", { value: preview.sample.map((s) => `${s.name} (${s.email})`).join("; ") })}</p>
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
        <Field label={t("scheduleForYourLocalTime")}>{(p) => <input {...p} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />}</Field>
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
          {t("schedule")}
        </Button>
        <Button
          busy={busy}
          onClick={() =>
            act(async () => {
              if (!window.confirm(t("sendThisCampaignNow"))) return;
              const cid = await save();
              await api(`/api/career/messaging/campaigns/${cid}/schedule`, { json: {} });
              onDone(cid);
            })
          }
        >
          {t("sendNow")}
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
  const t = useCareerT("campaignsPanel");
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
    [t("statRecipients"), m.recipients || data.recipientCount],
    [t("statPending"), m.pending],
    [t("statDelivered"), m.sent],
    [t("statEmailsSent"), m.emailsSent],
    [t("statInAppSent"), m.inAppSent],
    [t("statFailed"), m.failed],
    [t("statEmailSuppressed"), m.suppressed],
    [t("statUnsubscribes"), m.unsubscribes],
  ];
  return (
    <Card
      title={data.name}
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={reload}>
            {t("refresh")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      }
    >
      <div aria-live="polite">
        <ErrorBanner error={actionError} />
        <SuccessBanner message={msg} />
      </div>
      <p className="mb-3 text-sm">
        <Badge tone={STATUS_TONE[data.status]}>{data.status}</Badge> <span className="ms-2">{data.subject}</span>
        {data.scheduledAt && <span className="ms-2 text-muted-foreground">{t("scheduledScheduledAt", { scheduledAt: formatDate(data.scheduledAt, true) })}</span>}
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
          <summary>{t("failedDeliveriesCount", { count: data.failures.length })}</summary>
          <ul className="mt-2 list-disc ps-5">
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
            {t("edit")}
          </Button>
        )}
        {(data.status === "Scheduled" || data.status === "Sending") && (
          <Button variant="danger" onClick={() => act(() => api(`/api/career/messaging/campaigns/${id}/cancel`, { method: "POST" }), t("campaignCancelled"))}>
            {t("cancelSending")}
          </Button>
        )}
        {data.status === "Draft" && (
          <Button
            variant="danger"
            onClick={() =>
              act(async () => {
                await api(`/api/career/messaging/campaigns/${id}`, { method: "DELETE" });
                onClose();
              }, t("draftDeleted"))
            }
          >
            {t("deleteDraft")}
          </Button>
        )}
      </div>
    </Card>
  );
}
