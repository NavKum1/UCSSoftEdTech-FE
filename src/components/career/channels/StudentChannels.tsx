"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useCareerT, useLoad } from "@/components/career/ui";

interface ChannelInfo {
  channel: string;
  implemented: boolean;
  platformConfigured: boolean;
  schoolConnected: boolean;
  schoolEnabled: boolean;
  available: boolean;
}

interface MyChannel {
  info: ChannelInfo;
  status?: string | null;
  phoneLast4?: string | null;
  consentAt?: string | null;
  verifiedAt?: string | null;
  optOutAt?: string | null;
  optOutSource?: string | null;
  codeExpiresAt?: string | null;
  mutedTypes: string[];
  // H3: campus-drive notice types this student turned on
  optedInTypes?: string[];
}

interface MineResponse {
  schoolName: string;
  brand: string;
  consentVersion: string;
  allowedTypes: string[];
  // H3: types the student turns on one by one, with their own consent statement
  optInTypes?: string[];
  driveConsentVersion?: string;
  quietStart?: string | null;
  quietEnd?: string | null;
  timeZone: string;
  channels: MyChannel[];
}

const TYPE_KEYS = ["appointment_reminders", "document_review_results", "internship_approvals", "counselor_messages"];

function ChannelPanel({ c, mine, onChanged }: { c: MyChannel; mine: MineResponse; onChanged: () => void }) {
  const t = useCareerT("studentChatSms");
  const api = useApi();
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [driveConsent, setDriveConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const ch = c.info.channel;
  const label = t(`channel.${ch}`);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
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

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    void run("start", async () => {
      await api(`/api/career/channels/me/${ch}/start`, { method: "POST", json: { phone, consent } });
      setMsg(t("codeSent", { channel: label }));
      onChanged();
    });
  };
  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    void run("verify", async () => {
      await api(`/api/career/channels/me/${ch}/verify`, { method: "POST", json: { code } });
      setCode("");
      setMsg(t("verified", { channel: label }));
      onChanged();
    });
  };
  const toggleMute = (type: string, muted: boolean) =>
    run("mute", async () => {
      const next = muted ? [...c.mutedTypes, type] : c.mutedTypes.filter((x) => x !== type);
      await api(`/api/career/channels/me/${ch}`, { method: "PUT", json: { mutedTypes: next } });
      onChanged();
    });
  const setDriveType = (type: string, on: boolean) =>
    run("drive", async () => {
      const current = c.optedInTypes ?? [];
      const next = on ? [...new Set([...current, type])] : current.filter((x) => x !== type);
      await api(`/api/career/channels/me/${ch}`, { method: "PUT", json: { mutedTypes: c.mutedTypes, optInTypes: next, driveConsent } });
      setMsg(t("driveSaved"));
      onChanged();
    });
  const optOut = () =>
    run("optout", async () => {
      await api(`/api/career/channels/me/${ch}`, { method: "DELETE" });
      setMsg(t("turnedOff", { channel: label }));
      onChanged();
    });

  if (!c.info.implemented) {
    return (
      <Card title={label}>
        <p className="text-sm text-muted-foreground">{t("notAvailableYet")}</p>
      </Card>
    );
  }
  if (!c.info.available) {
    return (
      <Card title={label}>
        <p className="text-sm text-muted-foreground">{t("schoolHasntTurnedOn")}</p>
      </Card>
    );
  }

  const status = c.status;
  return (
    <Card
      title={label}
      actions={
        status === "Active" ? <Badge tone="good">{t("status.on")}</Badge> : status === "PendingVerification" ? <Badge tone="warn">{t("status.pending")}</Badge> : <Badge>{t("status.off")}</Badge>
      }
    >
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      {status === "Active" ? (
        <div className="space-y-4">
          <p className="text-sm">{t("onFor", { last4: c.phoneLast4 ?? "" })}</p>
          <p className="text-xs text-muted-foreground">{t("consentGiven", { date: formatDate(c.consentAt, true) })}</p>
          {mine.allowedTypes.length > 0 && (
            <fieldset className="space-y-2 text-sm">
              <legend className="mb-1 font-medium">{t("whatToSend")}</legend>
              {mine.allowedTypes
                .filter((x) => TYPE_KEYS.includes(x))
                .map((type) => {
                  const id = `${ch}-${type}`;
                  const on = !c.mutedTypes.includes(type);
                  return (
                    <label key={type} htmlFor={id} className="flex items-start gap-2">
                      <input id={id} type="checkbox" checked={on} disabled={busy === "mute"} onChange={(e) => void toggleMute(type, !e.target.checked)} />
                      <span>{t(`type.${type}`)}</span>
                    </label>
                  );
                })}
            </fieldset>
          )}
          {(mine.optInTypes ?? []).some((x) => mine.allowedTypes.includes(x)) && (
            <fieldset className="space-y-2 text-sm">
              <legend className="mb-1 font-medium">{t("driveTitle")}</legend>
              <p className="text-xs text-muted-foreground">{t("driveHelp", { school: mine.schoolName })}</p>
              <label htmlFor={`${ch}-drive-consent`} className="flex items-start gap-2">
                <input id={`${ch}-drive-consent`} type="checkbox" checked={driveConsent} onChange={(e) => setDriveConsent(e.target.checked)} />
                <span>{t("driveConsent", { school: mine.schoolName, channel: label })}</span>
              </label>
              {(mine.optInTypes ?? [])
                .filter((x) => mine.allowedTypes.includes(x))
                .map((type) => {
                  const id = `${ch}-drive-${type}`;
                  const on = (c.optedInTypes ?? []).includes(type);
                  return (
                    <label key={type} htmlFor={id} className="flex items-start gap-2">
                      <input id={id} type="checkbox" checked={on} disabled={busy === "drive" || (!on && !driveConsent)} onChange={(e) => void setDriveType(type, e.target.checked)} />
                      <span>{t(`type.${type}`)}</span>
                    </label>
                  );
                })}
              {!driveConsent && <p className="text-xs text-muted-foreground">{t("driveConsentFirst")}</p>}
            </fieldset>
          )}
          <Button variant="secondary" busy={busy === "optout"} onClick={() => void optOut()}>
            {t("turnOff", { channel: label })}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {status === "OptedOut" && c.optOutAt && <p className="text-xs text-muted-foreground">{t("turnedOffOn", { date: formatDate(c.optOutAt, true) })}</p>}
          <form onSubmit={start} className="space-y-3">
            <Field label={t("mobileNumber")} hint={t("mobileNumberHint")}>
              {(p) => <input {...p} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} required />}
            </Field>
            <label htmlFor={`${ch}-consent`} className="flex items-start gap-2 text-sm">
              <input id={`${ch}-consent`} type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{t("consentStatement", { brand: mine.brand, school: mine.schoolName, channel: label })}</span>
            </label>
            <Button type="submit" busy={busy === "start"} disabled={!consent || !phone.trim()}>
              {status === "PendingVerification" ? t("sendNewCode") : t("sendCode")}
            </Button>
          </form>
          {status === "PendingVerification" && (
            <form onSubmit={verify} className="space-y-3 border-t border-border pt-3">
              <Field label={t("enterCode", { last4: c.phoneLast4 ?? "" })} hint={c.codeExpiresAt ? t("codeExpires", { date: formatDate(c.codeExpiresAt, true) }) : undefined}>
                {(p) => <input {...p} inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />}
              </Field>
              <Button type="submit" busy={busy === "verify"} disabled={code.length < 4}>
                {t("verify")}
              </Button>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}

/** Student: turn chat-app / SMS notifications on (with a one-time code), choose what comes, turn them off. */
export default function StudentChannels() {
  const t = useCareerT("studentChatSms");
  const api = useApi();
  const mine = useLoad(() => api<MineResponse>("/api/career/channels/me"), [api]);
  const d = mine.data;
  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <ErrorBanner error={mine.error} onRetry={mine.reload} />
      {mine.loading && !d ? (
        <Loading />
      ) : !d ? null : d.channels.every((c) => !c.info.available) ? (
        <EmptyState title={t("noneAvailable")}>{t("noneAvailableHint")}</EmptyState>
      ) : (
        <div className="space-y-4">
          {d.quietStart && d.quietEnd && <p className="text-sm text-muted-foreground">{t("quietHours", { start: d.quietStart, end: d.quietEnd, tz: d.timeZone })}</p>}
          <p className="text-sm text-muted-foreground">{t("stopHint")}</p>
          {d.channels.map((c) => (
            <ChannelPanel key={c.info.channel} c={c} mine={d} onChanged={mine.reload} />
          ))}
        </div>
      )}
    </div>
  );
}
