"use client";

/**
 * Sharing a form: the public link (on or off), links that record a campaign, a QR code, and the code that puts the
 * form on the institute's website (inline, a button, or a floating button; styled to match the site).
 */

import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, ExternalLink } from "lucide-react";
import QRCode from "qrcode";
import EmbedBuilder from "./EmbedBuilder";

export default function ShareTab({
  view,
  setPublic,
  canEdit,
}: {
  view: { id: string; instituteId: string; name: string; link: string; publicEnabled: boolean; hasDraft: boolean };
  setPublic: (on: boolean) => void;
  canEdit: boolean;
}) {
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const slug = campaign.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const link = slug ? `${view.link}&utm_campaign=${slug}` : view.link;

  useEffect(() => {
    if (canvas.current) QRCode.toCanvas(canvas.current, link, { width: 200, margin: 1 }).catch(() => undefined);
  }, [link]);

  return (
    <div className="space-y-6">
      <section className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm ${view.publicEnabled ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <div>
          <p className="font-medium">{view.publicEnabled ? "The public link is on" : "The public link is off"}</p>
          <p className="text-xs text-muted-foreground">
            {view.publicEnabled
              ? "Anyone with the link, the QR code or your website can fill in the published version."
              : "Nobody outside Edulexa can open the form yet. Everything below is ready for when you turn it on."}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setPublic(!view.publicEnabled)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium ${view.publicEnabled ? "border border-border hover:bg-muted" : "bg-cyan-700 text-white hover:bg-cyan-800"}`}
          >
            {view.publicEnabled ? "Turn off" : "Turn on the public link"}
          </button>
        )}
      </section>
      {view.hasDraft && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">You have unpublished changes. People see the published version until you publish.</p>}

      <section className="grid gap-5 rounded-2xl border border-border bg-card p-5 lg:grid-cols-[1fr_14rem]">
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Link and QR code</h2>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Link</p>
            <div className="mt-1 flex gap-2">
              <input readOnly value={link} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs" />
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard?.writeText(link).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  })
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
              >
                {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
              </button>
              {view.publicEnabled && (
                <a href={link} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted">
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /> Open
                </a>
              )}
            </div>
          </div>
          <label className="block text-xs font-medium text-muted-foreground">
            Campaign (optional): shown as the lead&apos;s source in the CRM and in Insights
            <input value={campaign} onChange={(e) => setCampaign(e.target.value)} maxLength={60} placeholder="e.g. open-day-2027, instagram, school-visit" className="mt-1 block w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <p className="text-xs text-muted-foreground">People can save their answers and finish later, and see the form in their language when you&apos;ve added it.</p>
        </div>
        <div className="text-center">
          <canvas ref={canvas} className="mx-auto rounded-lg bg-white" aria-label="QR code for the form link" />
          <button
            type="button"
            onClick={() => {
              const a = document.createElement("a");
              a.href = canvas.current?.toDataURL("image/png") ?? "";
              a.download = `${view.name.replace(/[^\w-]+/g, "-")}${slug ? `-${slug}` : ""}-qr.png`;
              a.click();
            }}
            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Download aria-hidden="true" className="h-3.5 w-3.5" /> Download QR (PNG)
          </button>
          <p className="mt-1 text-xs text-muted-foreground">For posters, brochures and stalls.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">Put it on your website</h2>
        <EmbedBuilder instituteId={view.instituteId} formId={view.id} formName={view.name} publicEnabled={view.publicEnabled} />
      </section>
    </div>
  );
}
