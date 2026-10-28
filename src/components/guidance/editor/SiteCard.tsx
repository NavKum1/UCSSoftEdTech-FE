"use client";

/**
 * The institute's own address for its form: a name on Edulexa's site domain (globalit.edulexa.com) and/or its own domain
 * (quiz.globalit.edu), which works once the DNS records shown here are in place and checked. The address opens the
 * chosen public form (the default one when none is chosen).
 */

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Globe } from "lucide-react";
import { useLatestRef, useLegacyApi } from "@/lib/legacyApi";

interface Site {
  siteDomain: string | null;
  customDomainsOffered: boolean;
  slug: string | null;
  formId: string | null;
  url: string | null;
  customDomain: string | null;
  verified: boolean;
  customUrl: string | null;
  cname: { name: string; value: string } | null;
  txt: { name: string; value: string } | null;
}

const input = "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export default function SiteCard({ instituteId, forms, canEdit }: { instituteId?: string; forms: { id: string; name: string; publicEnabled: boolean; isDefault: boolean }[]; canEdit: boolean }) {
  const q = instituteId ? `?instituteId=${instituteId}` : "";
  const { apiFetch, ready } = useLegacyApi();
  const [site, setSite] = useState<Site | null>(null);
  const [slug, setSlug] = useState("");
  const [formId, setFormId] = useState("");
  const [domain, setDomain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const show = (s: Site) => {
    setSite(s);
    setSlug(s.slug ?? "");
    setFormId(s.formId ?? "");
    setDomain(s.customDomain ?? "");
  };
  const load = useCallback(async () => {
    const res = await apiFetch(`/api/guidance-forms/site${q}`);
    if (res.ok) show(await res.json());
  }, [apiFetch, q]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) loadRef.current();
  }, [ready, loadRef]);

  const call = async (path: string, method: string, body?: unknown, done?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch(path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const d = await res.json().catch(() => null);
      if (!res.ok) return setMsg({ ok: false, text: d?.error ?? "That didn't work. Please try again." });
      show(d);
      if (done) setMsg({ ok: true, text: done });
    } finally {
      setBusy(false);
    }
  };

  if (!site || (!site.siteDomain && !site.customDomainsOffered)) return null;
  const chosen = forms.find((f) => f.id === (site.formId ?? "")) ?? forms.find((f) => f.isDefault);
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => setCopied(text));

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Globe aria-hidden="true" className="h-4 w-4 text-cyan-700" /> Your form&apos;s own address
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Share a simple address that opens your form, on Edulexa&apos;s domain or your own.</p>
      {chosen && !chosen.publicEnabled && (
        <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200" role="alert">
          “{chosen.name}” isn&apos;t public yet, so the address won&apos;t open it. Turn its public link on in Share.
        </p>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-800 dark:text-red-300"}`}>
          {msg.text}
        </p>
      )}
      <fieldset disabled={!canEdit || busy} className="mt-3 space-y-3 text-sm">
        <div className="grid gap-3 md:grid-cols-2">
          {site.siteDomain && (
            <label className="block font-medium">
              Address on Edulexa
              <span className="mt-1 flex items-center rounded-lg border border-border bg-background focus-within:border-cyan-600">
                <span className="pl-3 text-muted-foreground">https://</span>
                <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} maxLength={40} placeholder="yourschool" aria-label="Your name" className="min-w-0 flex-1 bg-transparent px-1 py-2 focus:outline-none" />
                <span className="pr-3 text-muted-foreground">.{site.siteDomain}</span>
              </span>
            </label>
          )}
          <label className="block font-medium">
            Opens
            <select className={input} value={formId} onChange={(e) => setFormId(e.target.value)}>
              <option value="">Your default form</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.publicEnabled ? "" : " (not public)"}
                </option>
              ))}
            </select>
          </label>
          {site.customDomainsOffered && (
            <label className="block font-medium md:col-span-2">
              Your own domain <span className="font-normal text-muted-foreground">(optional, e.g. quiz.yourschool.edu)</span>
              <input className={input} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="quiz.yourschool.edu" />
            </label>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => call(`/api/guidance-forms/site${q}`, "PUT", { slug: slug.trim() || null, formId: formId || null, customDomain: domain.trim() || null }, "Saved.")}
            className="rounded-lg bg-cyan-700 px-3.5 py-2 font-medium text-white hover:bg-cyan-800"
          >
            Save
          </button>
        )}
      </fieldset>

      {(site.url || site.customDomain) && (
        <div className="mt-4 space-y-3 text-sm">
          {site.url && (
            <p className="flex flex-wrap items-center gap-2">
              <a href={site.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-cyan-700 hover:underline dark:text-cyan-400">
                {site.url} <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
              <button type="button" onClick={() => copy(site.url!)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted">
                <Copy aria-hidden="true" className="h-3 w-3" /> {copied === site.url ? "Copied" : "Copy"}
              </button>
            </p>
          )}
          {site.customDomain &&
            (site.verified ? (
              <p className="flex flex-wrap items-center gap-2">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600" />
                <a href={site.customUrl!} target="_blank" rel="noreferrer" className="font-medium text-cyan-700 hover:underline dark:text-cyan-400">
                  {site.customUrl}
                </a>
                <span className="text-xs text-muted-foreground">Verified. The secure certificate is set up on the first visit.</span>
              </p>
            ) : (
              <div className="rounded-xl border border-border p-3">
                <p className="font-medium">Add these two records at your domain&apos;s DNS provider, then check:</p>
                <table className="mt-2 w-full text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="pb-1 pr-3 font-medium">Type</th>
                      <th className="pb-1 pr-3 font-medium">Name</th>
                      <th className="pb-1 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {[
                      ["CNAME", site.cname?.name, site.cname?.value],
                      ["TXT", site.txt?.name, site.txt?.value],
                    ]
                      .filter((r) => r[1] && r[2])
                      .map(([type, name, value]) => (
                        <tr key={type} className="border-t border-border align-top">
                          <td className="py-1.5 pr-3">{type}</td>
                          <td className="break-all py-1.5 pr-3">{name}</td>
                          <td className="py-1.5">
                            <span className="break-all">{value}</span>{" "}
                            <button type="button" onClick={() => copy(value!)} className="ml-1 rounded border border-border px-1.5 py-0.5 font-sans hover:bg-muted">
                              {copied === value ? "Copied" : "Copy"}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {canEdit && (
                  <button type="button" disabled={busy} onClick={() => call(`/api/guidance-forms/site/verify${q}`, "POST", undefined, "Verified. Your domain opens your form now.")} className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                    Check the records
                  </button>
                )}
                <p className="mt-1 text-xs text-muted-foreground">DNS changes can take a while to spread. If the check fails, try again in a few minutes.</p>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
