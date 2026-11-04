"use client";

/**
 * Edulexa tenant console (phase E, 24 Oct 2026), for an organisation's admins. Every number here is a count of the
 * organisation's own records.
 * - Follow-up calls: off until turned on; a call needs the person's express consent, passes the do-not-call registry
 *   check of the number's country, happens only in calling hours in the person's time zone, opens by saying who is
 *   calling, that it is recorded and how to opt out; opt-outs stop calls at once; every decision is in the audit trail.
 * - Protected content: signed, watermarked links and leak lookup.
 * - Mentor payments, by the school's country: in India TDS at the payee's rate, an NEFT batch file and a TDS statement (not a
 *   Form 16A, which comes from TRACES); elsewhere the school's currency, an optional tax ID, the bank's routing code, withholding
 *   only when the school must, a payment batch file and a payee statement by calendar quarter.
 * - Integration: the pixel snippet (consent-based) and a signed webhook test.
 * (This page used to show invented call recoveries, discounts, payees, a made-up Form 16A and fixed platform claims.)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Download, PhoneCall, Search, Shield, Wallet, Webhook } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { getApiBaseUrl } from "@/lib/apiClient";
import { useEn } from "@/lib/english/EnglishProvider";
import { EmptyState, Loading, PageHeader, StatTile, Tabs, brandFill, buttonClass } from "@/components/career/ui";

interface Metrics {
  tenantId: string;
  followUpCallsRequested: number;
  followUpCallsPlaced: number;
  followUpCallsBlocked: number;
  followUpCallsScheduled: number;
  activeConsents: number;
  optOuts: number;
  protectedAssetsCount: number;
  signedSessionsCount: number;
  activeSignedSessionsCount: number;
  totalMentorPayoutsGross: number;
  totalTdsWithheld: number;
  pendingMentorPayoutsCount: number;
  country: string;
  currency: string;
}
interface Country {
  code: string;
  name: string;
  prefix: string;
  registry: string;
  registryConnected: boolean;
  legalHours: string;
}
interface Settings {
  enabled: boolean;
  callerName: string;
  windowStart: string;
  windowEnd: string;
  providerConnected: boolean;
  providerMissing: string[];
  countries: Country[];
  disclosure: string;
}
interface Call {
  id: string;
  name: string;
  phone: string;
  topic: string;
  status: string;
  reason: string;
  source: string;
  scheduledFor: string | null;
  placedAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
}
interface Consent {
  id: string;
  name: string;
  phone: string;
  consentText: string;
  source: string;
  timeZone: string;
  capturedAt: string;
  revokedAt: string | null;
}
interface OptOut {
  id: string;
  phone: string;
  source: string;
  createdAt: string;
}
interface AuditEvent {
  id: string;
  phone: string;
  event: string;
  detail: string;
  at: string;
}
interface Asset {
  id: string;
  assetTitle: string;
  assetType: string;
  ttlMinutes: number;
  totalSignedUrlRequests: number;
  createdAt: string;
}
interface Payout {
  id: string;
  mentorName: string;
  mentorPan: string;
  contractType: string;
  totalSessionsOrHours: number;
  ratePerUnit: number;
  grossAmount: number;
  tdsRatePercent: number;
  tdsAmount: number;
  netAmount: number;
  payoutStatus: string;
  paymentBatchReference: string | null;
  createdAt: string;
  currency: string;
}
interface TdsStatement {
  payeeName: string;
  payeePanMasked: string;
  totalGrossAmount: number;
  totalTdsDeducted: number;
  quarters: { quarter: string; grossAmount: number; tdsDeducted: number }[];
  note: string;
  currency: string;
}

type Tab = "calls" | "content" | "payments" | "integration";
const card = "rounded-xl border border-border bg-card shadow-sm";
const input = "mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm";
const button = buttonClass("primary");
const ghost = buttonClass("secondary");
// Amounts in the payment currency (Indian digit grouping for rupees)
const money = (n: number, currency: string) =>
  new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
const when = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");
const STATUS: Record<string, string> = {
  Placed: "text-emerald-700 dark:text-emerald-400",
  Completed: "text-emerald-700 dark:text-emerald-400",
  Scheduled: "text-indigo-700 dark:text-indigo-300",
  Blocked: "text-amber-700 dark:text-amber-400",
  Failed: "text-red-700 dark:text-red-400",
  Cancelled: "text-muted-foreground",
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <StatTile label={label} value={value} />;
}

export default function EdulexaConsolePage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [tab, setTab] = useState<Tab>("calls");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [optOuts, setOptOuts] = useState<OptOut[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const json = useCallback(
    async <T,>(path: string, fallback: T): Promise<T> => {
      const res = await apiFetch(path);
      return res.ok ? ((await res.json()) as T) : fallback;
    },
    [apiFetch],
  );

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/v1/dashboard/metrics");
      if (!res.ok) return setFailed(res.status !== 401 && res.status !== 403);
      setMetrics((await res.json()) as Metrics);
      const [s, c, co, o, a, as, p] = await Promise.all([
        json<Settings | null>("/v1/voice/settings", null),
        json<Call[]>("/v1/voice/calls", []),
        json<Consent[]>("/v1/voice/consents", []),
        json<OptOut[]>("/v1/voice/opt-outs", []),
        json<AuditEvent[]>("/v1/voice/audit", []),
        json<Asset[]>("/v1/assets", []),
        json<Payout[]>("/v1/payouts", []),
      ]);
      setSettings(s);
      setCalls(c);
      setConsents(co);
      setOptOuts(o);
      setAudit(a);
      setAssets(as);
      setPayouts(p);
    } catch {
      setFailed(true);
    }
  }, [apiFetch, json]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  /** Sends a JSON request; shows the API's error message on failure. Returns the parsed body on success. */
  const send = async <T,>(path: string, method: string, body: unknown, success: string): Promise<T | null> => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiFetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!res.ok) {
        setNotice({ ok: false, text: data?.error ?? "That didn't work. Please try again." });
        return null;
      }
      setNotice({ ok: true, text: success });
      await load();
      return data;
    } catch {
      setNotice({ ok: false, text: en("The request failed. Please try again.") });
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (access) return <AccessNotice problem={access} feature="the Edulexa console" />;
  if (failed)
    return (
      <div>
        <PageHeader title={en("Edulexa console")} />
        <EmptyState title={en("We couldn't load the console")}>{en("Please refresh the page to try again.")}</EmptyState>
      </div>
    );
  if (!metrics)
    return (
      <div aria-busy="true">
        <Loading label={en("Loading the console")} />
      </div>
    );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "calls", label: en("Follow-up calls"), icon: <PhoneCall /> },
    { id: "content", label: en("Protected content"), icon: <Shield /> },
    { id: "payments", label: en("Mentor payments"), icon: <Wallet /> },
    { id: "integration", label: en("Integration"), icon: <Webhook /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={en("Edulexa console")}
        description={en("Follow-up calls, protected content, mentor payments and integration for your organization. Every number here is a count of your own records.")}
      />

      <Tabs items={tabs} value={tab} onChange={setTab} label={en("Console sections")} />

      {notice && (
        <p role="status" className={`flex items-start gap-2 text-sm ${notice.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
          {notice.ok ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4" />}
          {notice.text}
        </p>
      )}

      {tab === "calls" && settings && (
        <CallsTab settings={settings} metrics={metrics} calls={calls} consents={consents} optOuts={optOuts} audit={audit} busy={busy} send={send} />
      )}
      {tab === "content" && <ContentTab metrics={metrics} assets={assets} busy={busy} send={send} />}
      {tab === "payments" && <PaymentsTab metrics={metrics} payouts={payouts} busy={busy} send={send} apiFetch={apiFetch} setNotice={setNotice} />}
      {tab === "integration" && <IntegrationTab tenantId={metrics.tenantId} busy={busy} send={send} />}
    </div>
  );
}

type Send = <T>(path: string, method: string, body: unknown, success: string) => Promise<T | null>;

function CallsTab({ settings, metrics, calls, consents, optOuts, audit, busy, send }: {
  settings: Settings;
  metrics: Metrics;
  calls: Call[];
  consents: Consent[];
  optOuts: OptOut[];
  audit: AuditEvent[];
  busy: boolean;
  send: Send;
}) {
  const en = useEn();
  const [form, setForm] = useState({ enabled: settings.enabled, callerName: settings.callerName, windowStart: settings.windowStart, windowEnd: settings.windowEnd });
  const browserZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  }, []);
  const [consent, setConsent] = useState({ name: "", phone: "", email: "", timeZone: browserZone, consentText: "" });
  const [request, setRequest] = useState({ name: "", phone: "", topic: "" });
  const [optOut, setOptOut] = useState("");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={en("Requested")} value={metrics.followUpCallsRequested} />
        <Stat label={en("Placed")} value={metrics.followUpCallsPlaced} />
        <Stat label={en("Blocked by a check")} value={metrics.followUpCallsBlocked} />
        <Stat label={en("Scheduled")} value={metrics.followUpCallsScheduled} />
        <Stat label={en("Active consents")} value={metrics.activeConsents} />
        <Stat label={en("Opted out")} value={metrics.optOuts} />
      </div>

      <section className={`${card} space-y-4 p-5`} aria-labelledby="vc-settings">
        <h2 id="vc-settings" className="text-base font-semibold">
          {en("Settings and compliance")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {en("A call is placed only when every check passes: calls are on, the person gave express consent, the number isn't opted out or on its country's do-not-call registry, it wasn't called in the last 24 hours, and it's within calling hours in the person's time zone (otherwise it's scheduled). Staff can't lift an opt-out.")}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            {en("Follow-up calls are on")}
          </label>
          <Field label={en("Calls say they are from")}>
            <input className={input} value={form.callerName} maxLength={120} onChange={(e) => setForm({ ...form, callerName: e.target.value })} />
          </Field>
          <Field label={en("Earliest call (person's local time)")} hint={en("Inside the legal hours of each country below.")}>
            <input className={input} type="time" value={form.windowStart} onChange={(e) => setForm({ ...form, windowStart: e.target.value })} />
          </Field>
          <Field label={en("Latest call (person's local time)")}>
            <input className={input} type="time" value={form.windowEnd} onChange={(e) => setForm({ ...form, windowEnd: e.target.value })} />
          </Field>
        </div>
        <button className={button} style={brandFill} disabled={busy} onClick={() => void send("/v1/voice/settings", "PUT", form, "Settings saved.")}>
          {en("Save settings")}
        </button>
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <p className="font-medium">{en("Every call opens with:")}</p>
          <p className="mt-1 italic">{en("“")}{settings.disclosure}{en("”")}</p>
        </div>
        <div className="text-sm">
          <p className="font-medium">
            {en("Voice provider:")}{" "}
            {settings.providerConnected ? (
              <span className="text-emerald-700 dark:text-emerald-400">connected</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">{en("not connected (missing: {value})", { value: settings.providerMissing.join(", ") })}</span>
            )}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-140 text-start">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pe-3 font-medium">{en("Numbers")}</th>
                  <th className="py-1 pe-3 font-medium">{en("Do-not-call registry")}</th>
                  <th className="py-1 pe-3 font-medium">{en("Legal calling hours")}</th>
                </tr>
              </thead>
              <tbody>
                {settings.countries.map((c) => (
                  <tr key={c.code} className="border-t border-border">
                    <td className="py-2 pe-3">
                      {c.name} ({c.prefix})
                    </td>
                    <td className="py-2 pe-3">
                      {c.registry}:{" "}
                      {c.registryConnected ? (
                        <span className="text-emerald-700 dark:text-emerald-400">connected</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">{en("not connected, so these numbers aren't called")}</span>
                      )}
                    </td>
                    <td className="py-2 pe-3">{c.legalHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{en("Numbers in other countries aren't called.")}</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${card} space-y-3 p-5`} aria-labelledby="vc-consent">
          <h2 id="vc-consent" className="text-base font-semibold">
            {en("Record a consent")}
          </h2>
          <p className="text-sm text-muted-foreground">{en("For a person who agreed to be called (in a form, by email or in person). Keep their exact words.")}</p>
          <Field label={en("Name")}>
            <input className={input} value={consent.name} onChange={(e) => setConsent({ ...consent, name: e.target.value })} />
          </Field>
          <Field label={en("Phone (international format)")}>
            <input className={input} value={consent.phone} placeholder="+1 555 123 4567" onChange={(e) => setConsent({ ...consent, phone: e.target.value })} />
          </Field>
          <Field label={en("Their time zone")} hint={en("IANA name, e.g. Asia/Kolkata. Needed for numbers in countries with several time zones.")}>
            <input className={input} value={consent.timeZone} onChange={(e) => setConsent({ ...consent, timeZone: e.target.value })} />
          </Field>
          <Field label={en("The words they agreed to")}>
            <textarea className={input} rows={3} value={consent.consentText} maxLength={1000} onChange={(e) => setConsent({ ...consent, consentText: e.target.value })} />
          </Field>
          <button
            className={button} style={brandFill}
            disabled={busy}
            onClick={async () => {
              if (await send("/v1/voice/consents", "POST", consent, "Consent recorded.")) setConsent({ name: "", phone: "", email: "", timeZone: browserZone, consentText: "" });
            }}
          >
            {en("Record consent")}
          </button>
        </section>

        <section className={`${card} space-y-3 p-5`} aria-labelledby="vc-request">
          <h2 id="vc-request" className="text-base font-semibold">
            {en("Request a call")}
          </h2>
          <p className="text-sm text-muted-foreground">{en("The result says whether it was placed, scheduled or blocked, and why.")}</p>
          <Field label={en("Name")}>
            <input className={input} value={request.name} onChange={(e) => setRequest({ ...request, name: e.target.value })} />
          </Field>
          <Field label={en("Phone")}>
            <input className={input} value={request.phone} placeholder="+1 555 123 4567" onChange={(e) => setRequest({ ...request, phone: e.target.value })} />
          </Field>
          <Field label={en("What the call is about")} hint={en("e.g. the course they asked about. The call says this.")}>
            <input className={input} value={request.topic} maxLength={200} onChange={(e) => setRequest({ ...request, topic: e.target.value })} />
          </Field>
          <button
            className={button} style={brandFill}
            disabled={busy}
            onClick={async () => {
              const call = await send<Call>("/v1/voice/calls", "POST", request, "Call requested.");
              if (call) setRequest({ name: "", phone: "", topic: "" });
            }}
          >
            <PhoneCall aria-hidden="true" className="h-4 w-4" />{en(" Request call")}
          </button>
          <div className="border-t border-border pt-3">
            <Field label={en("Opt a number out")} hint={en("Stops all calls to it at once and withdraws its consent.")}>
              <input className={input} value={optOut} placeholder="+1 555 123 4567" onChange={(e) => setOptOut(e.target.value)} />
            </Field>
            <button
              className={`${ghost} mt-2`}
              disabled={busy}
              onClick={async () => {
                if (await send("/v1/voice/opt-outs", "POST", { phone: optOut }, "Opted out.")) setOptOut("");
              }}
            >
              {en("Opt out")}
            </button>
          </div>
        </section>
      </div>

      <section className={`${card} overflow-x-auto p-5`} aria-labelledby="vc-calls">
        <h2 id="vc-calls" className="text-base font-semibold">
          {en("Calls")}
        </h2>
        {calls.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{en("No calls requested yet.")}</p>
        ) : (
          <table className="mt-3 w-full min-w-190 text-start text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pe-3 font-medium">{en("Requested")}</th>
                <th className="py-2 pe-3 font-medium">{en("Person")}</th>
                <th className="py-2 pe-3 font-medium">{en("About")}</th>
                <th className="py-2 pe-3 font-medium">{en("Status")}</th>
                <th className="py-2 pe-3 font-medium">{en("Details")}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-t border-border align-top">
                  <td className="py-2 pe-3 whitespace-nowrap">{when(c.createdAt)}</td>
                  <td className="py-2 pe-3">
                    {c.name || "—"}
                    <span className="block text-xs text-muted-foreground">{c.phone}</span>
                  </td>
                  <td className="py-2 pe-3">{c.topic}</td>
                  <td className={`py-2 pe-3 font-medium ${STATUS[c.status] ?? ""}`}>{String(c.status ?? "").replace(/([a-z])([A-Z])/g, (_m, a: string, b: string) => `${a} ${b.toLowerCase()}`)}</td>
                  <td className="py-2 pe-3 text-xs">
                    {c.status === "Scheduled" && <span className="block">{en("For {scheduledFor}", { scheduledFor: when(c.scheduledFor) })}</span>}
                    {c.placedAt && <span className="block">{en("Placed {placedAt}", { placedAt: when(c.placedAt) })}</span>}
                    {c.durationSeconds != null && <span className="block">{c.durationSeconds} s</span>}
                    {c.reason}
                  </td>
                  <td className="py-2">
                    {c.status === "Scheduled" && (
                      <button className={ghost} disabled={busy} onClick={() => void send(`/v1/voice/calls/${c.id}/cancel`, "POST", undefined, en("Call cancelled."))}>
                        {en("Cancel")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${card} overflow-x-auto p-5`} aria-labelledby="vc-consents">
          <h2 id="vc-consents" className="text-base font-semibold">
            {en("Consents")}
          </h2>
          {consents.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{en("No consents recorded.")}</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {consents.map((c) => (
                <li key={c.id} className="border-t border-border pt-2">
                  <span className="font-medium">{c.name || c.phone}</span> <span className="text-muted-foreground">{c.phone}</span>
                  {c.revokedAt && <span className="ms-2 text-xs text-amber-700 dark:text-amber-400">withdrawn {when(c.revokedAt)}</span>}
                  <span className="block text-xs text-muted-foreground">
                    {when(c.capturedAt)} · {c.source}
                    {c.timeZone ? ` · ${c.timeZone}` : ""}
                  </span>
                  <q className="mt-1 block text-xs italic">{c.consentText}</q>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={`${card} overflow-x-auto p-5`} aria-labelledby="vc-optouts">
          <h2 id="vc-optouts" className="text-base font-semibold">
            {en("Opted out")}
          </h2>
          {optOuts.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{en("No numbers have opted out.")}</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {optOuts.map((o) => (
                <li key={o.id}>
                  {o.phone} <span className="text-xs text-muted-foreground">({o.source === "call" ? en("said so on a call") : o.source}, {when(o.createdAt)})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={`${card} overflow-x-auto p-5`} aria-labelledby="vc-audit">
        <h2 id="vc-audit" className="text-base font-semibold">
          {en("Audit trail")}
        </h2>
        {audit.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{en("Nothing yet.")}</p>
        ) : (
          <table className="mt-3 w-full min-w-160 text-start text-sm">
            <tbody>
              {audit.map((e) => (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="py-2 pe-3 whitespace-nowrap text-xs text-muted-foreground">{when(e.at)}</td>
                  <td className="py-2 pe-3 font-medium">{e.event}</td>
                  <td className="py-2 pe-3 text-xs">{e.phone}</td>
                  <td className="py-2 text-xs">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function ContentTab({ metrics, assets, busy, send }: { metrics: Metrics; assets: Asset[]; busy: boolean; send: Send }) {
  const en = useEn();
  const [asset, setAsset] = useState({ assetTitle: "", originalStorageUrl: "", assetType: "CourseLecture", ttlMinutes: 30 });
  const [signed, setSigned] = useState<{ signedUrl: string; watermarkStamp: string; expiresAt: string } | null>(null);
  const [leak, setLeak] = useState("");
  const [match, setMatch] = useState<{ attributionFound: boolean; leakerEmail: string; assetTitle: string; matchedOn: string | null; sessionTimestamp: string | null; remediationAction: string } | null>(null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={en("Protected assets")} value={metrics.protectedAssetsCount} />
        <Stat label={en("Signed links issued")} value={metrics.signedSessionsCount} />
        <Stat label={en("Links still valid")} value={metrics.activeSignedSessionsCount} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${card} space-y-3 p-5`} aria-labelledby="pc-sign">
          <h2 id="pc-sign" className="text-base font-semibold">
            {en("Register an asset and sign a link")}
          </h2>
          <p className="text-sm text-muted-foreground">{en("Each link expires and carries a watermark naming the viewer, so a leaked copy can be traced to its session.")}</p>
          <Field label={en("Title")}>
            <input className={input} value={asset.assetTitle} onChange={(e) => setAsset({ ...asset, assetTitle: e.target.value })} />
          </Field>
          <Field label={en("Storage URL (https)")}>
            <input className={input} value={asset.originalStorageUrl} onChange={(e) => setAsset({ ...asset, originalStorageUrl: e.target.value })} />
          </Field>
          <Field label={en("Type")}>
            <select className={input} value={asset.assetType} onChange={(e) => setAsset({ ...asset, assetType: e.target.value })}>
              <option value="CourseLecture">{en("Course lecture")}</option>
              <option value="CodeRepository">{en("Code repository")}</option>
              <option value="AssessmentPrompt">{en("Assessment prompt")}</option>
              <option value="ProctoredReplayVideo">{en("Proctored replay video")}</option>
            </select>
          </Field>
          <button
            className={button} style={brandFill}
            disabled={busy}
            onClick={async () => setSigned(await send<{ signedUrl: string; watermarkStamp: string; expiresAt: string }>("/v1/assets/sign", "POST", asset, "Link signed."))}
          >
            {en("Sign a link")}
          </button>
          {signed && (
            <div className="rounded-lg bg-muted/60 p-3 text-xs">
              <p className="break-all font-mono">{signed.signedUrl}</p>
              <p className="mt-1">{en("Watermark: {watermarkStamp}", { watermarkStamp: signed.watermarkStamp })}</p>
              <p>{en("Expires {expiresAt}", { expiresAt: when(signed.expiresAt) })}</p>
            </div>
          )}
        </section>
        <section className={`${card} space-y-3 p-5`} aria-labelledby="pc-leak">
          <h2 id="pc-leak" className="text-base font-semibold">
            {en("Trace a leaked copy")}
          </h2>
          <p className="text-sm text-muted-foreground">{en("Paste the watermark text, signed token or session id from the leaked copy.")}</p>
          <Field label={en("Watermark, token or session id")}>
            <input className={input} value={leak} onChange={(e) => setLeak(e.target.value)} />
          </Field>
          <button
            className={button} style={brandFill}
            disabled={busy || leak.trim().length < 4}
            onClick={async () => setMatch(await send("/v1/assets/leak-attribution", "POST", { leakSnippetOrFingerprint: leak }, "Lookup done."))}
          >
            <Search aria-hidden="true" className="h-4 w-4" />{en(" Look up")}
          </button>
          {match &&
            (match.attributionFound ? (
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <p>
                  {en("Matched a viewing session of ")}<span className="font-medium">{match.assetTitle}</span> by {match.leakerEmail || "an unknown viewer"} on{" "}
                  {when(match.sessionTimestamp)}{en(" (matched on ")}{match.matchedOn}).
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{match.remediationAction}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{en("No recorded viewing session matches.")}</p>
            ))}
        </section>
      </div>
      <section className={`${card} overflow-x-auto p-5`} aria-labelledby="pc-assets">
        <h2 id="pc-assets" className="text-base font-semibold">
          {en("Assets")}
        </h2>
        {assets.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{en("No assets registered.")}</p>
        ) : (
          <table className="mt-3 w-full min-w-140 text-start text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pe-3 font-medium">{en("Title")}</th>
                <th className="py-2 pe-3 font-medium">{en("Type")}</th>
                <th className="py-2 pe-3 font-medium">{en("Link lifetime")}</th>
                <th className="py-2 font-medium">{en("Links signed")}</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="py-2 pe-3">{a.assetTitle}</td>
                  <td className="py-2 pe-3">{a.assetType}</td>
                  <td className="py-2 pe-3">{a.ttlMinutes} min</td>
                  <td className="py-2 tabular-nums">{a.totalSignedUrlRequests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function PaymentsTab({ metrics, payouts, busy, send, apiFetch, setNotice }: {
  metrics: Metrics;
  payouts: Payout[];
  busy: boolean;
  send: Send;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  setNotice: (n: { ok: boolean; text: string } | null) => void;
}) {
  const en = useEn();
  // The school's country decides the rules: India keeps PAN, IFSC, TDS and NEFT; elsewhere a tax id, routing code and optional withholding
  const india = metrics.country === "IN";
  const cur = metrics.currency || "USD";
  const empty = { mentorName: "", mentorEmail: "", payeeTaxId: "", bankName: "", bankAccountNumber: "", bankRoutingCode: "", contractType: "PerSession", totalSessionsOrHours: "", ratePerUnit: "", withholdingRatePercent: "" };
  const [p, setP] = useState(empty);
  const [taxId, setTaxId] = useState("");
  const [statement, setStatement] = useState<TdsStatement | null>(null);
  const withheld = india ? en("TDS") : en("Withheld");

  const exportBatch = async () => {
    const res = await apiFetch("/v1/payouts/export", { method: "POST" });
    if (!res.ok) return setNotice({ ok: false, text: en("We couldn't create the export. Please try again.") });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `${india ? "neft-batch" : "payment-batch"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice({ ok: true, text: india ? en("NEFT batch file downloaded; the payments in it are marked exported.") : en("Payment batch file downloaded; the payments in it are marked exported.") });
  };

  const lookup = async () => {
    setStatement(null);
    const res = await apiFetch(`/v1/payouts/statement?taxId=${encodeURIComponent(taxId.trim())}`);
    if (res.ok) setStatement((await res.json()) as TdsStatement);
    else setNotice({ ok: false, text: res.status === 404 ? en("No recorded payments for that tax id.") : en("We couldn't look that up. Please try again.") });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={en("Recorded (gross)")} value={money(metrics.totalMentorPayoutsGross, cur)} />
        <Stat label={india ? en("TDS withheld") : en("Tax withheld")} value={money(metrics.totalTdsWithheld, cur)} />
        <Stat label={en("Waiting for export")} value={metrics.pendingMentorPayoutsCount} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${card} space-y-3 p-5`} aria-labelledby="mp-record">
          <h2 id="mp-record" className="text-base font-semibold">
            {en("Record a payment")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={en("Payee name")}>
              <input className={input} value={p.mentorName} onChange={(e) => setP({ ...p, mentorName: e.target.value })} />
            </Field>
            <Field label={en("Email (optional)")}>
              <input className={input} value={p.mentorEmail} onChange={(e) => setP({ ...p, mentorEmail: e.target.value })} />
            </Field>
            <Field
              label={india ? en("PAN") : en("Tax ID (optional)")}
              hint={india ? undefined : en("For example an EIN or SSN in the US. Leave it blank if you don't report payments to this payee.")}
            >
              <input className={input} value={p.payeeTaxId} maxLength={india ? 10 : 24} onChange={(e) => setP({ ...p, payeeTaxId: e.target.value.toUpperCase() })} />
            </Field>
            <Field label={en("Bank (optional)")}>
              <input className={input} value={p.bankName} onChange={(e) => setP({ ...p, bankName: e.target.value })} />
            </Field>
            <Field label={india ? en("Account number") : en("Account number or IBAN")}>
              <input className={input} value={p.bankAccountNumber} inputMode={india ? "numeric" : undefined} onChange={(e) => setP({ ...p, bankAccountNumber: e.target.value })} />
            </Field>
            <Field
              label={india ? en("IFSC") : en("Routing code")}
              hint={india ? undefined : en("The routing number in the US, the sort code in the UK, or the bank's BIC (SWIFT code).")}
            >
              <input className={input} value={p.bankRoutingCode} maxLength={india ? 11 : 14} onChange={(e) => setP({ ...p, bankRoutingCode: e.target.value.toUpperCase() })} />
            </Field>
            <Field label={en("Paid per")}>
              <select className={input} value={p.contractType} onChange={(e) => setP({ ...p, contractType: e.target.value })}>
                <option value="PerSession">{en("Session")}</option>
                <option value="Hourly">{en("Hour")}</option>
              </select>
            </Field>
            <Field label={p.contractType === "Hourly" ? en("Hours") : en("Sessions")}>
              <input className={input} type="number" min="0" step="0.5" value={p.totalSessionsOrHours} onChange={(e) => setP({ ...p, totalSessionsOrHours: e.target.value })} />
            </Field>
            <Field label={en("Rate ({currency})", { currency: cur })}>
              <input className={input} type="number" min="0" value={p.ratePerUnit} onChange={(e) => setP({ ...p, ratePerUnit: e.target.value })} />
            </Field>
            <Field
              label={india ? en("TDS rate (%)") : en("Withholding (%), optional")}
              hint={india
                ? en("The rate that applies to this payee, e.g. 10 under section 194J for professional fees.")
                : en("Leave blank unless you must withhold tax from this payee, such as US backup withholding when there is no tax ID.")}
            >
              <input className={input} type="number" min="0" max={india ? 40 : 50} step="0.1" value={p.withholdingRatePercent} onChange={(e) => setP({ ...p, withholdingRatePercent: e.target.value })} />
            </Field>
          </div>
          <button
            className={button} style={brandFill}
            disabled={busy}
            onClick={async () => {
              const body = {
                ...p,
                totalSessionsOrHours: Number(p.totalSessionsOrHours) || 0,
                ratePerUnit: Number(p.ratePerUnit) || 0,
                withholdingRatePercent: p.withholdingRatePercent === "" ? null : Number(p.withholdingRatePercent),
              };
              if (await send("/v1/payouts", "POST", body, "Payment recorded.")) setP(empty);
            }}
          >
            {en("Record payment")}
          </button>
        </section>
        <section className={`${card} space-y-3 p-5`} aria-labelledby="mp-tds">
          <h2 id="mp-tds" className="text-base font-semibold">
            {india ? en("TDS statement") : en("Payee statement")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {india
              ? en("From the payments recorded here, by quarter. It isn't a Form 16A: download that from TRACES after filing the quarterly TDS return.")
              : en("A payee's payments by quarter, from the records here, to help with year-end forms such as the US Form 1099-NEC.")}
          </p>
          <Field label={india ? en("Payee PAN") : en("Payee tax ID")}>
            <input className={input} value={taxId} maxLength={india ? 10 : 24} onChange={(e) => setTaxId(e.target.value.toUpperCase())} />
          </Field>
          <button className={button} style={brandFill} disabled={india ? taxId.trim().length !== 10 : taxId.trim().length < 4} onClick={() => void lookup()}>
            {en("Show statement")}
          </button>
          {statement && (
            <div className="rounded-lg bg-muted/60 p-3 text-sm">
              <p className="font-medium">
                {statement.payeeName} ({statement.payeePanMasked})
              </p>
              <ul className="mt-2 space-y-1">
                {statement.quarters.map((q) => (
                  <li key={q.quarter}>
                    {en("{quarter}: paid {grossAmount}, {withheld} {tdsDeducted}", { quarter: q.quarter, grossAmount: money(q.grossAmount, statement.currency || cur), withheld, tdsDeducted: money(q.tdsDeducted, statement.currency || cur) })}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                {en("Total: paid {totalGrossAmount}, {withheld} {totalTdsDeducted}", { totalGrossAmount: money(statement.totalGrossAmount, statement.currency || cur), withheld, totalTdsDeducted: money(statement.totalTdsDeducted, statement.currency || cur) })}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{statement.note}</p>
            </div>
          )}
        </section>
      </div>
      <section className={`${card} overflow-x-auto p-5`} aria-labelledby="mp-list">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="mp-list" className="text-base font-semibold">
            {en("Payments")}
          </h2>
          <button className={ghost} disabled={busy || metrics.pendingMentorPayoutsCount === 0} onClick={() => void exportBatch()}>
            <Download aria-hidden="true" className="h-4 w-4" />
            {india ? en("Export NEFT batch file") : en("Export payment batch file")}
          </button>
        </div>
        {payouts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{en("No payments recorded.")}</p>
        ) : (
          <table className="mt-3 w-full min-w-190 text-start text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pe-3 font-medium">{en("Recorded")}</th>
                <th className="py-2 pe-3 font-medium">{en("Payee")}</th>
                <th className="py-2 pe-3 font-medium">{en("Work")}</th>
                <th className="py-2 pe-3 font-medium">{en("Gross")}</th>
                <th className="py-2 pe-3 font-medium">{withheld}</th>
                <th className="py-2 pe-3 font-medium">{en("Net")}</th>
                <th className="py-2 font-medium">{en("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((x) => (
                <tr key={x.id} className="border-t border-border">
                  <td className="py-2 pe-3 whitespace-nowrap">{new Date(x.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 pe-3">{x.mentorName}</td>
                  <td className="py-2 pe-3">
                    {x.totalSessionsOrHours} {x.contractType === "Hourly" ? en("h") : en("sessions")} × {money(x.ratePerUnit, x.currency || cur)}
                  </td>
                  <td className="py-2 pe-3 tabular-nums">{money(x.grossAmount, x.currency || cur)}</td>
                  <td className="py-2 pe-3 tabular-nums">
                    {money(x.tdsAmount, x.currency || cur)} <span className="text-xs text-muted-foreground">({x.tdsRatePercent}%)</span>
                  </td>
                  <td className="py-2 pe-3 tabular-nums">{money(x.netAmount, x.currency || cur)}</td>
                  <td className="py-2">
                    {x.payoutStatus}
                    {x.paymentBatchReference && <span className="block text-xs text-muted-foreground">{x.paymentBatchReference}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function IntegrationTab({ tenantId, busy, send }: { tenantId: string; busy: boolean; send: Send }) {
  const en = useEn();
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ delivered: boolean; responseStatusCode: number; error?: string | null; targetWebhookUrl: string } | null>(null);
  const api = getApiBaseUrl().replace(/\/$/, "");
  const snippet = `<script src="${api}/v1/pixel.js?tenant=${tenantId}" async></script>
<script>
  // When the person leaves checkout. Only with the box they ticked:
  // voiceConsent is true only if they agreed, and consentText is that box's exact wording.
  EdulexaPixel.track("cart_abandoned", {
    candidateName: form.name.value,
    candidatePhone: form.phone.value,
    cartItemName: "Your course name",
    voiceConsent: form.callMe.checked,
    consentText: "Yes, you may call me about this course. I can say stop at any time."
  });
  // An "Don't call me" link: EdulexaPixel.optOut(form.phone.value);
</script>`;

  return (
    <div className="space-y-6">
      <section className={`${card} space-y-3 p-5`} aria-labelledby="in-pixel">
        <h2 id="in-pixel" className="text-base font-semibold">
          {en("Checkout pixel")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {en("Add it to your checkout page. It sends only what your code passes to it; a follow-up call is requested only when the person ticked a box agreeing to be called, and the call still goes through every check. Your organization needs an active API key for the pixel to work.")}
        </p>
        <pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs">
          <code>{snippet}</code>
        </pre>
        <button
          className={ghost}
          onClick={() => {
            void navigator.clipboard.writeText(snippet).then(() => setCopied(true));
          }}
        >
          <Copy aria-hidden="true" className="h-4 w-4" /> {copied ? en("Copied") : en("Copy snippet")}
        </button>
      </section>
      <section className={`${card} space-y-3 p-5`} aria-labelledby="in-webhook">
        <h2 id="in-webhook" className="text-base font-semibold">
          {en("Webhook test")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {en("Sends a signed test event (header X-Edulexa-Signature: t=timestamp,v1=HMAC-SHA256 of “timestamp.body” with your API key) to your webhook URL.")}
        </p>
        <button
          className={button} style={brandFill}
          disabled={busy}
          onClick={async () => setResult(await send("/v1/webhooks/test-dispatch", "POST", { eventType: "test.ping", payload: { test: true } }, "Test sent."))}
        >
          {en("Send test event")}
        </button>
        {result && (
          <p className="text-sm">
            {result.delivered
              ? `Delivered to ${result.targetWebhookUrl} (HTTP ${result.responseStatusCode}).`
              : result.error ?? `Not delivered (HTTP ${result.responseStatusCode}).`}
          </p>
        )}
      </section>
    </div>
  );
}
