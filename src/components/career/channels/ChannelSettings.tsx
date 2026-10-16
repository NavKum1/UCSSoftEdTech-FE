"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useCareerT, useLoad } from "@/components/career/ui";

interface ChannelInfo {
  channel: string;
  implemented: boolean;
  platformConfigured: boolean;
  schoolConnected: boolean;
  schoolEnabled: boolean;
  available: boolean;
}
interface WaTemplate {
  name: string;
  language?: string | null;
  params?: string[] | null;
}
interface SmsTemplate {
  dltTemplateId?: string | null;
  text?: string | null;
}
interface WapprState {
  platformEnabled: boolean;
  baseUrl?: string | null;
  connected: boolean;
  workspaceId?: string | null;
  keyKind?: string | null;
  keyHint?: string | null;
  hasKey: boolean;
  webhookRegistered: boolean;
  whatsAppNumberId?: string | null;
  smsChannelId?: string | null;
  checkedAt?: string | null;
  status?: string | null;
}
interface Settings {
  canEdit: boolean;
  timeZone: string;
  types: string[];
  channels: ChannelInfo[];
  optedIn: Record<string, number>;
  wappr: WapprState;
  enabledChannels: string[];
  allowedTypes: string[];
  quietStart?: string | null;
  quietEnd?: string | null;
  allowRecordContent: boolean;
  whatsAppTemplates: Record<string, WaTemplate>;
  smsTemplates: Record<string, SmsTemplate>;
  whatsAppOtpTemplate?: string | null;
  whatsAppOtpLanguage?: string | null;
  platformWhatsAppOtpTemplate: string;
  smsOtpDltTemplateId?: string | null;
  smsOtpText?: string | null;
}
interface Catalog {
  templates: {
    whatsapp: { name: string; language: string; category: string; status: string; variables: number }[];
    sms_dlt: { dlt_template_id: string; name: string; sender_id: string; category: string; body: string }[];
  };
  numbers: {
    whatsapp: { id: string; phone?: string | null; label?: string | null; is_default: boolean }[];
    sms: { id: string; provider: string; sender?: string | null; name?: string | null; is_default: boolean }[];
  };
}
interface LogRow {
  id: string;
  channel: string;
  type: string;
  status: string;
  skipReason?: string | null;
  errorCode?: string | null;
  createdAt: string;
  phone?: string | null;
  student?: string | null;
}

const PARAMS = ["brand", "link", "title"];

function ConnectionCard({ s, onSaved }: { s: Settings; onSaved: (v: Settings) => void }) {
  const t = useCareerT("careerCenterChatSms");
  const api = useApi();
  const [workspaceId, setWorkspaceId] = useState(s.wappr.workspaceId ?? "");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const w = s.wappr;

  const run = async (k: string, fn: () => Promise<void>) => {
    setBusy(k);
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void run("save", async () => {
      onSaved(await api<Settings>("/api/career/channels/admin/wappr", { method: "PUT", json: { workspaceId, key } }));
      setKey("");
      setMsg(t("connectionSaved"));
    });
  };
  const disconnect = () =>
    run("disconnect", async () => {
      if (!window.confirm(t("disconnectConfirm"))) return;
      onSaved(await api<Settings>("/api/career/channels/admin/wappr", { method: "DELETE" }));
      setMsg(t("disconnected"));
    });

  return (
    <Card title={t("connectionTitle")} actions={w.connected ? <Badge tone="good">{t("connected")}</Badge> : <Badge tone="warn">{t("notConnected")}</Badge>}>
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      {!w.platformEnabled ? (
        <p className="text-sm text-muted-foreground">{t("platformOff")}</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("connectionHelp")}</p>
          {w.connected && (
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">{t("keyType")}</dt>
              <dd>{w.keyKind === "partner" ? t("keyPartner") : t("keyWorkspace")} <span dir="ltr">{w.keyHint}</span></dd>
              <dt className="text-muted-foreground">{t("webhook")}</dt>
              <dd>{w.webhookRegistered ? t("webhookOn") : t("webhookOff")}</dd>
              <dt className="text-muted-foreground">{t("lastChecked")}</dt>
              <dd>{formatDate(w.checkedAt, true)}</dd>
            </dl>
          )}
          {s.canEdit ? (
            <form onSubmit={save} className="space-y-3">
              <Field label={t("workspaceId")} hint={t("workspaceIdHint")}>
                {(p) => <input {...p} dir="ltr" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value.trim())} required />}
              </Field>
              <Field label={t("key")} hint={w.hasKey ? t("keyKeepHint") : t("keyHint")}>
                {(p) => <input {...p} dir="ltr" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value.trim())} required={!w.hasKey} />}
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" busy={busy === "save"}>
                  {w.connected ? t("checkAndSave") : t("connect")}
                </Button>
                {w.connected && (
                  <Button type="button" variant="secondary" busy={busy === "disconnect"} onClick={() => void disconnect()}>
                    {t("disconnect")}
                  </Button>
                )}
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">{t("adminOnly")}</p>
          )}
        </div>
      )}
    </Card>
  );
}

/** Career center: Pulse Relay connection, channels, allowed types, quiet hours, template mapping and the send log. */
export default function ChannelSettings() {
  const t = useCareerT("careerCenterChatSms");
  const api = useApi();
  const loaded = useLoad(() => api<Settings>("/api/career/channels/admin/settings"), [api]);
  // The loaded settings are also the form state (edited in place, replaced by each save)
  const s = loaded.data;
  const setS = loaded.setData;
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [log, setLog] = useState<LogRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (k: string, fn: () => Promise<void>) => {
    setBusy(k);
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (loaded.loading && !s) return <Loading />;
  if (!s) return <ErrorBanner error={loaded.error} onRetry={loaded.reload} />;

  const edit = s.canEdit;
  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });
  const toggle = (list: string[], v: string, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));
  const waTpl = (type: string) => s.whatsAppTemplates[type] ?? { name: "" };
  const smsTpl = (type: string) => s.smsTemplates[type] ?? {};
  const setWa = (type: string, v: WaTemplate) => set({ whatsAppTemplates: { ...s.whatsAppTemplates, [type]: v } });
  const setSms = (type: string, v: SmsTemplate) => set({ smsTemplates: { ...s.smsTemplates, [type]: v } });
  const waOptions = (catalog?.templates.whatsapp ?? []).filter((x) => x.status === "approved" && x.category !== "AUTHENTICATION");
  const authOptions = (catalog?.templates.whatsapp ?? []).filter((x) => x.status === "approved" && x.category === "AUTHENTICATION");
  const dltOptions = catalog?.templates.sms_dlt ?? [];

  const loadCatalog = () =>
    run("catalog", async () => {
      setCatalog(await api<Catalog>("/api/career/channels/admin/wappr/catalog"));
    });
  const loadLog = () =>
    run("log", async () => {
      setLog(await api<LogRow[]>("/api/career/channels/admin/log?take=100"));
    });
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void run("save", async () => {
      const next = await api<Settings>("/api/career/channels/admin/settings", {
        method: "PUT",
        json: {
          enabledChannels: s.enabledChannels,
          allowedTypes: s.allowedTypes,
          quietStart: s.quietStart ?? "",
          quietEnd: s.quietEnd ?? "",
          allowRecordContent: s.allowRecordContent,
          whatsAppTemplates: s.whatsAppTemplates,
          smsTemplates: s.smsTemplates,
          whatsAppOtpTemplate: s.whatsAppOtpTemplate ?? "",
          whatsAppOtpLanguage: s.whatsAppOtpLanguage ?? "",
          smsOtpDltTemplateId: s.smsOtpDltTemplateId ?? "",
          smsOtpText: s.smsOtpText ?? "",
          whatsAppNumberId: s.wappr.whatsAppNumberId ?? "",
          smsChannelId: s.wappr.smsChannelId ?? "",
        },
      });
      setS(next);
      setMsg(t("saved"));
    });
  };

  const sendable = s.channels.filter((c) => c.implemented);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <ConnectionCard s={s} onSaved={setS} />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />

      <form onSubmit={save} className="space-y-6">
        <Card title={t("channelsTitle")}>
          <fieldset className="space-y-2 text-sm" disabled={!edit}>
            <legend className="mb-1 font-medium">{t("channelsLegend")}</legend>
            {sendable.map((c) => {
              const id = `ch-${c.channel}`;
              return (
                <label key={c.channel} htmlFor={id} className="flex items-start gap-2">
                  <input id={id} type="checkbox" checked={s.enabledChannels.includes(c.channel)} disabled={!c.platformConfigured || !c.schoolConnected}
                    onChange={(e) => set({ enabledChannels: toggle(s.enabledChannels, c.channel, e.target.checked) })} />
                  <span>
                    {t(`channel.${c.channel}`)} <span className="text-xs text-muted-foreground">{t("optedIn", { count: s.optedIn[c.channel] ?? 0 })}</span>
                  </span>
                </label>
              );
            })}
            <p className="text-xs text-muted-foreground">{t("messengerLater")}</p>
          </fieldset>
          <fieldset className="mt-4 space-y-2 text-sm" disabled={!edit}>
            <legend className="mb-1 font-medium">{t("typesLegend")}</legend>
            {s.types.map((type) => {
              const id = `type-${type}`;
              return (
                <label key={type} htmlFor={id} className="flex items-start gap-2">
                  <input id={id} type="checkbox" checked={s.allowedTypes.includes(type)} onChange={(e) => set({ allowedTypes: toggle(s.allowedTypes, type, e.target.checked) })} />
                  <span>{t(`type.${type}`)}</span>
                </label>
              );
            })}
            <p className="text-xs text-muted-foreground">{t("typesHint")}</p>
          </fieldset>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t("quietStart")} hint={t("quietHint", { tz: s.timeZone })}>
              {(p) => <input {...p} type="time" disabled={!edit} value={s.quietStart ?? ""} onChange={(e) => set({ quietStart: e.target.value })} />}
            </Field>
            <Field label={t("quietEnd")}>
              {(p) => <input {...p} type="time" disabled={!edit} value={s.quietEnd ?? ""} onChange={(e) => set({ quietEnd: e.target.value })} />}
            </Field>
          </div>
          <label htmlFor="record-content" className="mt-4 flex items-start gap-2 text-sm">
            <input id="record-content" type="checkbox" disabled={!edit} checked={s.allowRecordContent} onChange={(e) => set({ allowRecordContent: e.target.checked })} />
            <span>{t("recordContent")}</span>
          </label>
        </Card>

        <Card
          title={t("mappingTitle")}
          actions={
            s.wappr.connected ? (
              <Button type="button" variant="secondary" busy={busy === "catalog"} onClick={() => void loadCatalog()}>
                {catalog ? t("reloadTemplates") : t("loadTemplates")}
              </Button>
            ) : undefined
          }
        >
          <p className="mb-4 text-sm text-muted-foreground">{t("mappingHelp")}</p>
          {catalog && (
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Field label={t("whatsAppNumber")}>
                {(p) => (
                  <select {...p} disabled={!edit} value={s.wappr.whatsAppNumberId ?? ""} onChange={(e) => set({ wappr: { ...s.wappr, whatsAppNumberId: e.target.value || null } })}>
                    <option value="">{t("workspaceDefault")}</option>
                    {catalog.numbers.whatsapp.map((n) => (
                      <option key={n.id} value={n.id}>{[n.label, n.phone].filter(Boolean).join(" · ")}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t("smsSender")}>
                {(p) => (
                  <select {...p} disabled={!edit} value={s.wappr.smsChannelId ?? ""} onChange={(e) => set({ wappr: { ...s.wappr, smsChannelId: e.target.value || null } })}>
                    <option value="">{t("workspaceDefault")}</option>
                    {catalog.numbers.sms.map((n) => (
                      <option key={n.id} value={n.id}>{[n.name, n.sender, n.provider].filter(Boolean).join(" · ")}</option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          )}
          <div className="space-y-6">
            {s.types.map((type) => {
              const wa = waTpl(type);
              const sms = smsTpl(type);
              return (
                <fieldset key={type} className="space-y-3 border-t border-border pt-4" disabled={!edit}>
                  <legend className="text-sm font-medium">{t(`type.${type}`)}</legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label={t("waTemplate")}>
                      {(p) =>
                        catalog ? (
                          <select {...p} value={wa.name ? `${wa.name}|${wa.language ?? ""}` : ""} onChange={(e) => {
                            const [name, language] = e.target.value.split("|");
                            setWa(type, { ...wa, name: name ?? "", language: language || null });
                          }}>
                            <option value="">{t("none")}</option>
                            {waOptions.map((o) => (
                              <option key={`${o.name}|${o.language}`} value={`${o.name}|${o.language}`}>{`${o.name} (${o.language}, ${o.variables})`}</option>
                            ))}
                          </select>
                        ) : (
                          <input {...p} dir="ltr" value={wa.name} onChange={(e) => setWa(type, { ...wa, name: e.target.value })} />
                        )
                      }
                    </Field>
                    <Field label={t("waLanguage")}>
                      {(p) => <input {...p} dir="ltr" value={wa.language ?? ""} placeholder="en" onChange={(e) => setWa(type, { ...wa, language: e.target.value || null })} />}
                    </Field>
                    <Field label={t("waParams")} hint={t("waParamsHint", { names: PARAMS.join(", ") })}>
                      {(p) => (
                        <input {...p} dir="ltr" value={(wa.params ?? []).join(", ")} placeholder="brand, link"
                          onChange={(e) => setWa(type, { ...wa, params: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                      )}
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label={t("dltTemplate")}>
                      {(p) =>
                        catalog ? (
                          <select {...p} value={sms.dltTemplateId ?? ""} onChange={(e) => setSms(type, { ...sms, dltTemplateId: e.target.value || null })}>
                            <option value="">{t("none")}</option>
                            {dltOptions.map((o) => (
                              <option key={o.dlt_template_id} value={o.dlt_template_id}>{`${o.name} (${o.dlt_template_id})`}</option>
                            ))}
                          </select>
                        ) : (
                          <input {...p} dir="ltr" value={sms.dltTemplateId ?? ""} onChange={(e) => setSms(type, { ...sms, dltTemplateId: e.target.value || null })} />
                        )
                      }
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label={t("smsText")} hint={t("smsTextHint")}>
                        {(p) => <textarea {...p} rows={2} value={sms.text ?? ""} onChange={(e) => setSms(type, { ...sms, text: e.target.value || null })} />}
                      </Field>
                    </div>
                  </div>
                </fieldset>
              );
            })}
            <fieldset className="space-y-3 border-t border-border pt-4" disabled={!edit}>
              <legend className="text-sm font-medium">{t("otpTitle")}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t("otpWaTemplate")} hint={t("otpWaTemplateHint", { name: s.platformWhatsAppOtpTemplate })}>
                  {(p) =>
                    catalog ? (
                      <select {...p} value={s.whatsAppOtpTemplate ?? ""} onChange={(e) => {
                        const opt = authOptions.find((o) => o.name === e.target.value);
                        set({ whatsAppOtpTemplate: e.target.value || null, whatsAppOtpLanguage: opt?.language ?? s.whatsAppOtpLanguage ?? null });
                      }}>
                        <option value="">{t("platformDefault")}</option>
                        {authOptions.map((o) => (
                          <option key={`${o.name}|${o.language}`} value={o.name}>{`${o.name} (${o.language})`}</option>
                        ))}
                      </select>
                    ) : (
                      <input {...p} dir="ltr" value={s.whatsAppOtpTemplate ?? ""} onChange={(e) => set({ whatsAppOtpTemplate: e.target.value || null })} />
                    )
                  }
                </Field>
                <Field label={t("otpDltTemplate")}>
                  {(p) =>
                    catalog ? (
                      <select {...p} value={s.smsOtpDltTemplateId ?? ""} onChange={(e) => set({ smsOtpDltTemplateId: e.target.value || null })}>
                        <option value="">{t("none")}</option>
                        {dltOptions.filter((o) => o.category !== "promotional").map((o) => (
                          <option key={o.dlt_template_id} value={o.dlt_template_id}>{`${o.name} (${o.dlt_template_id})`}</option>
                        ))}
                      </select>
                    ) : (
                      <input {...p} dir="ltr" value={s.smsOtpDltTemplateId ?? ""} onChange={(e) => set({ smsOtpDltTemplateId: e.target.value || null })} />
                    )
                  }
                </Field>
                <Field label={t("otpSmsText")} hint={t("otpSmsTextHint")}>
                  {(p) => <input {...p} value={s.smsOtpText ?? ""} onChange={(e) => set({ smsOtpText: e.target.value || null })} />}
                </Field>
              </div>
            </fieldset>
          </div>
        </Card>

        {edit && (
          <Button type="submit" busy={busy === "save"}>
            {t("save")}
          </Button>
        )}
      </form>

      {edit && (
        <Card
          title={t("logTitle")}
          actions={
            <Button type="button" variant="secondary" busy={busy === "log"} onClick={() => void loadLog()}>
              {log ? t("refresh") : t("showLog")}
            </Button>
          }
        >
          <p className="mb-3 text-sm text-muted-foreground">{t("logHelp")}</p>
          {log && (log.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("logEmpty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-start text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="pb-2 pe-3 text-start">{t("colWhen")}</th>
                    <th scope="col" className="pb-2 pe-3 text-start">{t("colStudent")}</th>
                    <th scope="col" className="pb-2 pe-3 text-start">{t("colChannel")}</th>
                    <th scope="col" className="pb-2 pe-3 text-start">{t("colType")}</th>
                    <th scope="col" className="pb-2 text-start">{t("colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((m) => (
                    <tr key={m.id} className="border-t border-border">
                      <td className="py-2 pe-3">{formatDate(m.createdAt, true)}</td>
                      <td className="py-2 pe-3">{m.student ?? "—"} <span dir="ltr" className="text-xs text-muted-foreground">{m.phone}</span></td>
                      <td className="py-2 pe-3">{t(`channel.${m.channel}`)}</td>
                      <td className="py-2 pe-3">{m.type === "otp" ? t("type.otp") : t(`type.${m.type}`)}</td>
                      <td className="py-2">
                        {m.status} {m.skipReason || m.errorCode ? <span className="text-xs text-muted-foreground">({m.skipReason ?? m.errorCode})</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
