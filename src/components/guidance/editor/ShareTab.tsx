"use client";

/** Sharing a form: the public link, links that record a campaign, the code for the institute's website and a QR code. */

import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, ExternalLink } from "lucide-react";
import QRCode from "qrcode";

function CopyBox({ label, value, mono = true, rows }: { label: string; value: string; mono?: boolean; rows?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex gap-2">
        {rows ? (
          <textarea readOnly rows={rows} value={value} className={`min-w-0 flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs ${mono ? "font-mono" : ""}`} onFocus={(e) => e.target.select()} />
        ) : (
          <input readOnly value={value} className={`min-w-0 flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs ${mono ? "font-mono" : ""}`} onFocus={(e) => e.target.select()} />
        )}
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })}
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
        >
          {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function ShareTab({
  view,
  setPublic,
  canEdit,
}: {
  view: { name: string; link: string; publicEnabled: boolean; hasDraft: boolean };
  setPublic: (on: boolean) => void;
  canEdit: boolean;
}) {
  const [campaign, setCampaign] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const slug = campaign.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const link = slug ? `${view.link}&utm_campaign=${slug}` : view.link;
  const embed = `<iframe src="${view.link}" title="${view.name.replace(/"/g, "&quot;")}" style="width:100%;max-width:640px;height:860px;border:0" loading="lazy"></iframe>`;

  useEffect(() => {
    if (canvas.current && view.publicEnabled) QRCode.toCanvas(canvas.current, link, { width: 220, margin: 1 }).catch(() => undefined);
  }, [link, view.publicEnabled]);

  if (!view.publicEnabled)
    return (
      <div className="max-w-xl rounded-2xl border border-border bg-card p-5 text-sm">
        <p className="font-medium">The public link is off</p>
        <p className="mt-1 text-muted-foreground">Turn it on to share this form on your website, by QR code or on social media. Signed-in Edulexa members can use your default form either way.</p>
        {canEdit && (
          <button type="button" onClick={() => setPublic(true)} className="mt-3 rounded-lg bg-cyan-700 px-3.5 py-2 font-medium text-white hover:bg-cyan-800">
            Turn on the public link
          </button>
        )}
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,16rem]">
      <div className="space-y-5">
        {view.hasDraft && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">You have unpublished changes. People see the published version until you publish.</p>}
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <CopyBox label="Link" value={link} />
          </div>
          <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted">
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /> Open
          </a>
        </div>
        <label className="block text-xs font-medium text-muted-foreground">
          Campaign (optional): links and QR codes with a campaign name show it as the lead&apos;s source in the CRM and in Insights
          <input value={campaign} onChange={(e) => setCampaign(e.target.value)} maxLength={60} placeholder="e.g. open-day-2027, instagram, school-visit" className="mt-1 block w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <CopyBox label="Put the form on your website (paste this where it should appear)" value={embed} rows={3} />
        <p className="text-xs text-muted-foreground">
          Your website can also add <code>&amp;utm_campaign=…</code> to the link. People can save their answers and finish later; the form shows in their language when you&apos;ve added it.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 text-center">
        <p className="text-xs font-medium text-muted-foreground">QR code{slug ? ` (${slug})` : ""}</p>
        <canvas ref={canvas} className="mx-auto mt-2 rounded-lg bg-white" aria-label="QR code for the form link" />
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
          <Download aria-hidden="true" className="h-3.5 w-3.5" /> Download PNG
        </button>
        <p className="mt-2 text-xs text-muted-foreground">For posters, brochures and stalls.</p>
      </div>
    </div>
  );
}
