"use client";

import React, { useEffect, useState } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  Plug,
  Plus,
  Power,
  RefreshCw,
  ScrollText,
  Send,
  XCircle,
} from "lucide-react";

interface Provider {
  id: string;
  mode: string;
}

interface Connection {
  id: string;
  provider: string;
  displayName: string;
  webhookUrl: string | null;
  isActive: boolean;
  createdAt: string;
  hasProviderApiKey: boolean;
}

interface CreatedConnection {
  id: string;
  provider: string;
  displayName: string;
  inboundApiKey: string;
  signingSecret: string;
  setup: string;
}

interface DispatchLog {
  id: string;
  submissionId: string;
  success: boolean;
  httpStatus: number | null;
  error: string | null;
  createdAt: string;
}

const WEBHOOK_PROVIDERS = ["Workday", "SeekJobs", "Webhook"];

const VERIFY_SNIPPET = `import crypto from "node:crypto";

// Use the raw request body (before JSON parsing).
export function verifyEdulexaSignature(rawBody, header, signingSecret) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.trim().split("=", 2))
  );
  const t = Number(parts.t);
  if (!t || !parts.v1) return false;

  // Reject events older than 5 minutes (replay protection).
  if (Math.abs(Date.now() / 1000 - t) > 300) return false;

  const expected = crypto
    .createHmac("sha256", signingSecret)
    .update(\`\${t}.\${rawBody}\`)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parts.v1, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Express: app.post("/edulexa", express.raw({ type: "application/json" }), (req, res) => {
//   const ok = verifyEdulexaSignature(req.body.toString("utf8"),
//     req.get("X-Edulexa-Signature") ?? "", process.env.EDULEXA_SIGNING_SECRET);
//   if (!ok) return res.status(401).end();
//   ...
// });`;

// The API only delivers to HTTPS URLs (plain HTTP is allowed for loopback during development)
function isDeliverableUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname));
  } catch {
    return false;
  }
}

async function errorMessage(res: Response, fallback: string) {
  try {
    const body = await res.json();
    if (body?.error) return body.error as string;
  } catch {
    // non-JSON body
  }
  if (res.status === 401 || res.status === 403) return "You need recruiter access to manage integrations.";
  return `${fallback} (HTTP ${res.status}).`;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the value is still selectable
    }
  };
  return (
    <div>
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 min-w-0 break-all rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs font-mono text-foreground select-all">{value}</code>
        <button
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="shrink-0 p-2 rounded-lg border border-border bg-card hover:bg-muted cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}

function ConnectionLogs({ connectionId, getToken }: { connectionId: string; getToken: () => Promise<string | null> }) {
  const [logs, setLogs] = useState<DispatchLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await authenticatedFetch(`/api/integrations/connections/${connectionId}/logs`, {}, getToken);
      if (!res.ok) throw new Error(await errorMessage(res, "Could not load logs"));
      return (await res.json()) as DispatchLog[];
    })()
      .then((data) => active && setLogs(data))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load logs."));
    return () => {
      active = false;
    };
  }, [connectionId, getToken]);

  if (error) return <p className="text-xs text-rose-700 dark:text-rose-400">{error}</p>;
  if (!logs) return <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading logs...</p>;
  if (logs.length === 0) return <p className="text-xs text-muted-foreground">No deliveries yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-1.5 pr-3 font-semibold">Time</th>
            <th className="py-1.5 pr-3 font-semibold">Result</th>
            <th className="py-1.5 pr-3 font-semibold">HTTP</th>
            <th className="py-1.5 pr-3 font-semibold">Submission</th>
            <th className="py-1.5 font-semibold">Error</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-b border-border last:border-0">
              <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
              <td className="py-1.5 pr-3">
                {l.success ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Delivered</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400"><XCircle className="w-3 h-3" /> Failed</span>
                )}
              </td>
              <td className="py-1.5 pr-3 text-foreground">{l.httpStatus ?? "—"}</td>
              <td className="py-1.5 pr-3 font-mono text-muted-foreground">{l.submissionId.slice(0, 8)}</td>
              <td className="py-1.5 text-muted-foreground break-all">{l.error ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function IntegrationsPage() {
  const { getToken } = useAuth();

  const [providers, setProviders] = useState<Provider[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [provider, setProvider] = useState("Greenhouse");
  const [displayName, setDisplayName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [leverPerformAs, setLeverPerformAs] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedConnection | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [openLogs, setOpenLogs] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      const [pRes, cRes] = await Promise.all([
        authenticatedFetch("/api/integrations/providers", {}, getToken),
        authenticatedFetch("/api/integrations/connections", {}, getToken),
      ]);
      if (!cRes.ok) throw new Error(await errorMessage(cRes, "Could not load connections"));
      return {
        providers: pRes.ok ? ((await pRes.json()) as Provider[]) : [],
        connections: (await cRes.json()) as Connection[],
      };
    })()
      .then((data) => {
        if (!active) return;
        setProviders(data.providers);
        setConnections(data.connections);
        setError(null);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load connections."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [getToken, reloadKey]);

  const refresh = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const needsWebhook = WEBHOOK_PROVIDERS.includes(provider);
  const isLever = provider === "Lever";
  const canCreate = displayName.trim().length > 0 && (!needsWebhook || isDeliverableUrl(webhookUrl.trim())) && (!isLever || providerApiKey.trim().length > 0);

  const createConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await authenticatedFetch(
        "/api/integrations/connections",
        {
          method: "POST",
          body: JSON.stringify({
            provider,
            displayName: displayName.trim(),
            webhookUrl: needsWebhook ? webhookUrl.trim() : undefined,
            providerApiKey: isLever ? providerApiKey.trim() : undefined,
            leverPerformAsUserId: isLever && leverPerformAs.trim() ? leverPerformAs.trim() : undefined,
          }),
        },
        getToken
      );
      if (!res.ok) {
        setCreateError(await errorMessage(res, "Could not create the connection"));
        return;
      }
      setCreated(await res.json());
      setDisplayName("");
      setWebhookUrl("");
      setProviderApiKey("");
      setLeverPerformAs("");
      refresh();
    } catch {
      setCreateError("Network error while creating the connection.");
    } finally {
      setCreating(false);
    }
  };

  const sendTest = async (id: string) => {
    setBusy(`test-${id}`);
    try {
      const res = await authenticatedFetch(`/api/integrations/connections/${id}/test`, { method: "POST" }, getToken);
      if (!res.ok) {
        const text = await errorMessage(res, "Test failed");
        setRowMessage((m) => ({ ...m, [id]: { ok: false, text } }));
        return;
      }
      const body = (await res.json()) as { success: boolean; httpStatus: number | null; error: string | null };
      setRowMessage((m) => ({
        ...m,
        [id]: body.success
          ? { ok: true, text: `Test event delivered${body.httpStatus ? ` (HTTP ${body.httpStatus})` : ""}.` }
          : { ok: false, text: `Test event failed${body.httpStatus ? ` (HTTP ${body.httpStatus})` : ""}${body.error ? `: ${body.error}` : "."}` },
      }));
      setOpenLogs((o) => (id in o ? { ...o, [id]: o[id] + 1 } : o));
    } catch {
      setRowMessage((m) => ({ ...m, [id]: { ok: false, text: "Network error while sending the test." } }));
    } finally {
      setBusy(null);
    }
  };

  const disable = async (c: Connection) => {
    if (!window.confirm(`Disable "${c.displayName}"? Its inbound API key will stop working and no further results will be sent.`)) return;
    setBusy(`disable-${c.id}`);
    try {
      const res = await authenticatedFetch(`/api/integrations/connections/${c.id}`, { method: "DELETE" }, getToken);
      if (!res.ok) {
        const text = await errorMessage(res, "Could not disable");
        setRowMessage((m) => ({ ...m, [c.id]: { ok: false, text } }));
        return;
      }
      setConnections((list) => list.map((x) => (x.id === c.id ? { ...x, isActive: false } : x)));
    } catch {
      setRowMessage((m) => ({ ...m, [c.id]: { ok: false, text: "Network error while disabling." } }));
    } finally {
      setBusy(null);
    }
  };

  const toggleLogs = (id: string) =>
    setOpenLogs((o) => {
      const next = { ...o };
      if (id in next) delete next[id];
      else next[id] = 0;
      return next;
    });

  const inputClass = "mt-1 w-full rounded-xl bg-card border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground";
  const providerOptions = providers.length > 0 ? providers : ["Greenhouse", "Lever", "Workday", "SeekJobs", "Webhook"].map((id) => ({ id, mode: "" }));
  const selectedMode = providerOptions.find((p) => p.id === provider)?.mode;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
            <Plug className="w-4 h-4" /> Integrations
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mt-1">ATS connections</h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Invite candidates from your applicant tracking system and receive results back. Results include the
            reviewer&apos;s decision (if any) and a link to the evidence pack, never an automatic verdict.
          </p>
        </div>
        <button
          onClick={refresh}
          className="self-start md:self-auto py-2 px-3 rounded-xl bg-card hover:bg-muted border border-border text-xs font-medium text-muted-foreground flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {created && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-foreground">&quot;{created.displayName}&quot; ({created.provider}) created</h2>
              <p className="text-xs text-foreground mt-1">
                Copy these values now and store them securely. They will not be shown again; to get new ones, disable this
                connection and create another.
              </p>
            </div>
          </div>
          <CopyField label="Inbound API key" value={created.inboundApiKey} />
          <CopyField label="Webhook signing secret" value={created.signingSecret} />
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">Setup</div>
            <p className="mt-1 text-xs text-foreground wrap-break-word">{created.setup}</p>
          </div>
          <button
            onClick={() => setCreated(null)}
            className="py-2 px-3 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground cursor-pointer"
          >
            I have saved these values
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Connections */}
        <section className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Link2 className="w-4 h-4" /> Your connections</h2>
          {loading && connections.length === 0 ? (
            <div className="glass-panel rounded-2xl border border-border p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading connections...
            </div>
          ) : error ? (
            <div className="glass-panel rounded-2xl border border-border p-6 text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          ) : connections.length === 0 ? (
            <div className="glass-panel rounded-2xl border border-border p-8 text-center text-sm text-muted-foreground">
              No connections yet. Create one to start inviting candidates from your ATS.
            </div>
          ) : (
            connections.map((c) => (
              <div key={c.id} className={`glass-panel rounded-2xl border border-border p-4 space-y-3 ${c.isActive ? "" : "opacity-70"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{c.displayName}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-border bg-muted text-muted-foreground">{c.provider}</span>
                      {c.isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Active</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-border bg-muted text-muted-foreground">Disabled</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 break-all">
                      Created {new Date(c.createdAt).toLocaleDateString()}
                      {c.webhookUrl ? ` · ${c.webhookUrl}` : ""}
                      {c.hasProviderApiKey ? " · provider API key stored" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => sendTest(c.id)}
                      disabled={!c.isActive || busy !== null}
                      className="py-1.5 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {busy === `test-${c.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send test
                    </button>
                    <button
                      onClick={() => toggleLogs(c.id)}
                      aria-expanded={c.id in openLogs}
                      className="py-1.5 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground flex items-center gap-1 cursor-pointer"
                    >
                      <ScrollText className="w-3.5 h-3.5" /> {c.id in openLogs ? "Hide logs" : "Logs"}
                    </button>
                    {c.isActive && (
                      <button
                        onClick={() => disable(c)}
                        disabled={busy !== null}
                        className="py-1.5 px-2.5 rounded-lg border border-rose-500/30 bg-card hover:bg-rose-500/10 text-xs font-medium text-rose-700 dark:text-rose-400 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        {busy === `disable-${c.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />} Disable
                      </button>
                    )}
                  </div>
                </div>
                {rowMessage[c.id] && (
                  <p className={`text-xs ${rowMessage[c.id].ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                    {rowMessage[c.id].text}
                  </p>
                )}
                {c.id in openLogs && (
                  <div className="pt-2 border-t border-border">
                    <ConnectionLogs key={openLogs[c.id]} connectionId={c.id} getToken={getToken} />
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        {/* Create form */}
        <section className="lg:col-span-2">
          <form onSubmit={createConnection} className="glass-panel rounded-2xl border border-border p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Plus className="w-4 h-4" /> New connection</h2>
            <label className="block text-xs font-semibold text-foreground">
              Provider
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className={inputClass}>
                {providerOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.id}</option>
                ))}
              </select>
              {selectedMode && <span className="block mt-1 font-normal text-[11px] text-muted-foreground">{selectedMode}</span>}
            </label>
            <label className="block text-xs font-semibold text-foreground">
              Display name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Engineering hiring" className={inputClass} required />
            </label>
            {needsWebhook && (
              <label className="block text-xs font-semibold text-foreground">
                Webhook URL (HTTPS; HTTP only for localhost)
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-integration.example.com/edulexa"
                  className={inputClass}
                  required
                />
              </label>
            )}
            {isLever && (
              <>
                <label className="block text-xs font-semibold text-foreground">
                  Lever API key
                  <input type="password" value={providerApiKey} onChange={(e) => setProviderApiKey(e.target.value)} autoComplete="off" className={inputClass} required />
                </label>
                <label className="block text-xs font-semibold text-foreground">
                  Perform as (Lever user id)
                  <input value={leverPerformAs} onChange={(e) => setLeverPerformAs(e.target.value)} placeholder="Lever user who authors the notes" className={inputClass} />
                </label>
              </>
            )}
            {createError && (
              <p className="text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {createError}</p>
            )}
            <button
              type="submit"
              disabled={!canCreate || creating}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create connection
            </button>
          </form>
        </section>
      </div>

      {/* Verification guide */}
      <section className="glass-panel rounded-2xl border border-border p-5 space-y-3">
        <h2 className="text-sm font-bold text-foreground">How to verify our webhooks</h2>
        <p className="text-xs text-muted-foreground">
          Every webhook (<code className="font-mono">assessment.completed</code>, <code className="font-mono">assessment.reviewed</code>) carries
          a header <code className="font-mono">X-Edulexa-Signature: t=&lt;unix seconds&gt;,v1=&lt;hex&gt;</code>, where v1 is
          HMAC-SHA256 of <code className="font-mono">{"`${t}.${rawBody}`"}</code> keyed with your signing secret. Compare with a
          constant-time check and reject timestamps older than five minutes.
        </p>
        <pre className="text-xs font-mono rounded-xl border border-border bg-muted/30 p-4 overflow-x-auto text-foreground">{VERIFY_SNIPPET}</pre>
      </section>
    </div>
  );
}
