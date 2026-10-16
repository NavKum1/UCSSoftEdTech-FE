"use client";

/** G15: short-term credentials the school defines and awards; students download them as Open Badges 3.0. */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, ScrollArea, SuccessBanner, useCareerT, useLoad } from "@/components/career/ui";
import { checkboxClass, useDateOnly, useIsCareerAdmin } from "./shared";

interface Credential {
  id: string;
  name: string;
  description: string;
  criteria: string;
  achievementType: string;
  contactHours?: number | null;
  programCode?: string | null;
  wioaRecognized: boolean;
  pirlTypeCode?: number | null;
  validMonths?: number | null;
  active: boolean;
  awarded: number;
}

interface Award {
  id: string;
  studentName?: string | null;
  studentEmail?: string | null;
  awardedOn: string;
  evidence?: string | null;
  revokedAt?: string | null;
  revokeReason?: string | null;
}

const blank = { name: "", description: "", criteria: "", achievementType: "Certificate", contactHours: "", programCode: "", wioaRecognized: false, pirlTypeCode: "5", validMonths: "", active: true };

function CredentialForm({ types, initial, onSubmit, submitLabel }: { types: string[]; initial: typeof blank; onSubmit: (f: typeof blank) => Promise<void>; submitLabel: string }) {
  const t = useCareerT("shortCredentials");
  const tw = useCareerT("workforce");
  const [f, setF] = useState(initial);
  const set = (p: Partial<typeof blank>) => setF({ ...f, ...p });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(f);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("name")}>{(props) => <input {...props} required value={f.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
        <Field label={t("type")}>
          {(props) => (
            <select {...props} value={f.achievementType} onChange={(e) => set({ achievementType: e.target.value })}>
              {types.map((x) => (
                <option key={x} value={x}>{t(`types.${x}`)}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("contactHours")}>{(props) => <input {...props} type="number" min={0} step="0.5" value={f.contactHours} onChange={(e) => set({ contactHours: e.target.value })} />}</Field>
        <Field label={t("programCode")}>{(props) => <input {...props} dir="ltr" value={f.programCode} onChange={(e) => set({ programCode: e.target.value })} />}</Field>
        <Field label={t("validMonths")} hint={t("validMonthsHint")}>{(props) => <input {...props} type="number" min={1} max={120} value={f.validMonths} onChange={(e) => set({ validMonths: e.target.value })} />}</Field>
      </div>
      <Field label={t("description")}>{(props) => <textarea {...props} rows={2} required value={f.description} onChange={(e) => set({ description: e.target.value })} />}</Field>
      <Field label={t("criteria")}>{(props) => <textarea {...props} rows={2} required value={f.criteria} onChange={(e) => set({ criteria: e.target.value })} />}</Field>
      <div className="flex items-center gap-2">
        <input id="sc-wioa" type="checkbox" className={checkboxClass} checked={f.wioaRecognized} onChange={(e) => set({ wioaRecognized: e.target.checked })} />
        <label htmlFor="sc-wioa" className="text-sm">{t("wioaRecognized")}</label>
      </div>
      {f.wioaRecognized && (
        <Field label={t("pirlType")}>
          {(props) => (
            <select {...props} value={f.pirlTypeCode} onChange={(e) => set({ pirlTypeCode: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                <option key={c} value={String(c)}>{tw(`credentialTypes.t${c}`)}</option>
              ))}
            </select>
          )}
        </Field>
      )}
      <div className="flex items-center gap-2">
        <input id="sc-active" type="checkbox" className={checkboxClass} checked={f.active} onChange={(e) => set({ active: e.target.checked })} />
        <label htmlFor="sc-active" className="text-sm">{t("active")}</label>
      </div>
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}

const toPayload = (f: typeof blank) => ({
  name: f.name, description: f.description, criteria: f.criteria, achievementType: f.achievementType,
  contactHours: f.contactHours === "" ? null : Number(f.contactHours), programCode: f.programCode || null, wioaRecognized: f.wioaRecognized,
  pirlTypeCode: f.wioaRecognized ? Number(f.pirlTypeCode) : null, validMonths: f.validMonths === "" ? null : Number(f.validMonths), active: f.active,
});

function Awards({ credential, onChanged }: { credential: Credential; onChanged: () => void }) {
  const api = useApi();
  const t = useCareerT("shortCredentials");
  const dateOnly = useDateOnly();
  const isAdmin = useIsCareerAdmin();
  const awards = useLoad(() => api<Award[]>(`/api/career/workforce/credentials/${credential.id}/awards`), [api, credential.id]);
  const [emails, setEmails] = useState("");
  const [on, setOn] = useState("");
  const [evidence, setEvidence] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <section aria-labelledby={`aw-${credential.id}`} className="mt-4 space-y-3 border-t border-border pt-4">
      <h3 id={`aw-${credential.id}`} className="font-semibold">{t("awardsTitle", { name: credential.name })}</h3>
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      {credential.active && (
        <form
          className="grid gap-3 sm:grid-cols-3 sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            setMsg(null);
            try {
              const r = await api<{ awarded: number; skipped: { email: string; reason: string }[] }>(`/api/career/workforce/credentials/${credential.id}/awards`, {
                json: { emails: emails.split(/[\s,;]+/).filter(Boolean), awardedOn: on || null, evidence: evidence || null },
              });
              setMsg(t("awardResult", { awarded: r.awarded, skipped: r.skipped.length }));
              setEmails("");
              awards.reload();
              onChanged();
            } catch (ex) {
              setErr((ex as Error).message);
            }
          }}
        >
          <Field label={t("awardEmails")} hint={t("awardEmailsHint")}>{(props) => <textarea {...props} rows={2} dir="ltr" required value={emails} onChange={(e) => setEmails(e.target.value)} />}</Field>
          <Field label={t("awardedOn")}>{(props) => <input {...props} type="date" value={on} onChange={(e) => setOn(e.target.value)} />}</Field>
          <Field label={t("evidence")}>{(props) => <input {...props} value={evidence} onChange={(e) => setEvidence(e.target.value)} />}</Field>
          <Button type="submit">{t("award")}</Button>
        </form>
      )}
      {awards.loading && !awards.data ? (
        <Loading />
      ) : !awards.data?.length ? (
        <p className="text-sm text-muted-foreground">{t("noAwards")}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {awards.data.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2">
              <bdi>{a.studentName ?? a.studentEmail}</bdi>
              <span className="text-muted-foreground">{dateOnly(a.awardedOn)}</span>
              {a.revokedAt ? <Badge tone="bad">{t("revoked")}</Badge> : <Badge tone="good">{t("valid")}</Badge>}
              {isAdmin && !a.revokedAt && revoking !== a.id && (
                <Button variant="ghost" onClick={() => setRevoking(a.id)}>{t("revoke")}</Button>
              )}
              {revoking === a.id && (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setErr(null);
                    try {
                      await api(`/api/career/workforce/awards/${a.id}/revoke`, { json: { reason } });
                      setRevoking(null);
                      setReason("");
                      setMsg(t("revokedMsg"));
                      awards.reload();
                      onChanged();
                    } catch (ex) {
                      setErr((ex as Error).message);
                    }
                  }}
                >
                  <Field label={t("revokeReason")}>{(props) => <input {...props} required value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
                  <Button type="submit" variant="danger">{t("confirmRevoke")}</Button>
                  <Button type="button" variant="ghost" onClick={() => setRevoking(null)}>{t("cancel")}</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ShortCredentialsPanel() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const t = useCareerT("shortCredentials");
  const tw = useCareerT("workforce");
  const isAdmin = useIsCareerAdmin();
  const list = useLoad(() => api<{ achievementTypes: string[]; credentials: Credential[] }>("/api/career/workforce/credentials"), [api, schoolId]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (list.loading && !list.data) return <Loading />;
  if (!list.data) return <ErrorBanner error={list.error} onRetry={list.reload} />;
  const types = list.data.achievementTypes;

  const save = async (id: string | null, f: typeof blank) => {
    setErr(null);
    setMsg(null);
    try {
      await api(id ? `/api/career/workforce/credentials/${id}` : "/api/career/workforce/credentials", { method: id ? "PUT" : "POST", json: toPayload(f) });
      setCreating(false);
      setEditing(null);
      setMsg(t("saved"));
      list.reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm">{t("intro")}</p>
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      {isAdmin && !creating && <Button onClick={() => setCreating(true)}>{t("create")}</Button>}
      {creating && (
        <Card title={t("createTitle")}>
          <CredentialForm types={types} initial={blank} submitLabel={t("create")} onSubmit={(f) => save(null, f)} />
        </Card>
      )}
      {list.data.credentials.length === 0 ? (
        <EmptyState title={t("none")}>{t("noneHint")}</EmptyState>
      ) : (
        <ScrollArea>
          <table className="w-full text-sm [&_th]:text-start">
            <caption className="sr-only">{t("caption")}</caption>
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pe-3">{t("name")}</th>
                <th className="py-2 pe-3">{t("type")}</th>
                <th className="py-2 pe-3">{t("wioaCol")}</th>
                <th className="py-2 pe-3">{t("awardedCol")}</th>
                <th className="py-2">{tw("actionsCol")}</th>
              </tr>
            </thead>
            <tbody>
              {list.data.credentials.map((c) => (
                <tr key={c.id} className="border-b border-border align-top">
                  <td className="py-2 pe-3">
                    <span className="font-medium">{c.name}</span>
                    {!c.active && <span className="ms-2"><Badge>{t("inactive")}</Badge></span>}
                  </td>
                  <td className="py-2 pe-3">{t(`types.${c.achievementType}`)}</td>
                  <td className="py-2 pe-3">{c.wioaRecognized && c.pirlTypeCode ? tw(`credentialTypes.t${c.pirlTypeCode}`) : t("notCounted")}</td>
                  <td className="py-2 pe-3">{c.awarded}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                        {t("awards")}
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" onClick={() => setEditing(editing === c.id ? null : c.id)}>
                          {t("edit")}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
      {list.data.credentials.filter((c) => c.id === editing).map((c) => (
        <Card key={`e-${c.id}`} title={t("editTitle", { name: c.name })}>
          <CredentialForm
            types={types}
            submitLabel={t("save")}
            initial={{ name: c.name, description: c.description, criteria: c.criteria, achievementType: c.achievementType, contactHours: c.contactHours?.toString() ?? "", programCode: c.programCode ?? "", wioaRecognized: c.wioaRecognized, pirlTypeCode: String(c.pirlTypeCode ?? 5), validMonths: c.validMonths?.toString() ?? "", active: c.active }}
            onSubmit={(f) => save(c.id, f)}
          />
        </Card>
      ))}
      {list.data.credentials.filter((c) => c.id === open).map((c) => (
        <Card key={`a-${c.id}`}>
          <Awards credential={c} onChanged={list.reload} />
        </Card>
      ))}
    </div>
  );
}
