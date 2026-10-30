"use client";

/**
 * Putting a form on the institute's website: choose how it appears (inline on the page, a button that opens it, or a
 * floating button in the corner) and how it looks (light/dark, corners, the site's font, heading, colour, campaign),
 * see it live, and copy the two lines to paste. The script (public/embed/guidance.js) sizes the frame to the form and
 * records the page and the site's UTM tags with each inquiry.
 */

import React, { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

type Mode = "inline" | "button" | "floating";

export default function EmbedBuilder({ instituteId, formId, formName, publicEnabled }: { instituteId: string; formId: string; formName: string; publicEnabled: boolean }) {
  const [mode, setMode] = useState<Mode>("inline");
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("light");
  const [corners, setCorners] = useState<"rounded" | "square">("rounded");
  const [font, setFont] = useState<"inherit" | "system">("inherit");
  const [heading, setHeading] = useState<"show" | "hide">("show");
  const [buttonText, setButtonText] = useState("Get career guidance");
  const [accent, setAccent] = useState("");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const slug = campaign.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const validAccent = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent.toLowerCase() : "";

  const snippet = useMemo(() => {
    const attrs = [`data-edulexa-guidance`, `data-institute="${instituteId}"`, `data-form="${formId}"`];
    if (mode !== "inline") attrs.push(`data-mode="${mode}"`, `data-button-text="${buttonText.replace(/"/g, "&quot;")}"`);
    if (theme !== "light") attrs.push(`data-theme="${theme}"`);
    if (corners !== "rounded") attrs.push(`data-corners="${corners}"`);
    if (font !== "inherit") attrs.push(`data-font="${font}"`);
    if (heading === "hide") attrs.push(`data-heading="hide"`);
    if (validAccent) attrs.push(`data-accent="${validAccent}"`);
    if (slug) attrs.push(`data-campaign="${slug}"`);
    return `<div ${attrs.join(" ")}></div>\n<script src="${origin}/embed/guidance.js" async></script>`;
  }, [instituteId, formId, mode, buttonText, theme, corners, font, heading, validAccent, slug, origin]);

  const previewSrc = useMemo(() => {
    const p = new URLSearchParams({ form: formId, embed: "1", theme, corners });
    if (heading === "hide") p.set("heading", "hide");
    if (validAccent) p.set("accent", validAccent);
    if (slug) p.set("campaign", slug);
    p.set("page", "preview");
    // Starts empty each time: no answers kept from an earlier try in this browser
    p.set("fresh", "1");
    return `/embed/guidance/${instituteId}?${p}`;
  }, [formId, theme, corners, heading, validAccent, slug, instituteId]);

  const opt = (label: string, value: string, current: string, set: (v: never) => void) => (
    <button key={value} type="button" aria-pressed={current === value} onClick={() => set(value as never)} className={`rounded-full border px-2.5 py-1 text-xs ${current === value ? "border-cyan-700 bg-cyan-700 text-white" : "border-border hover:bg-muted"}`}>
      {label}
    </button>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4 text-sm">
        {!publicEnabled && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-200">
            The public link is off, so the form won&apos;t show on your site yet. Turn it on when you&apos;re ready; the code stays the same.
          </p>
        )}
        <Row label="How it appears">
          {opt("On the page", "inline", mode, setMode)}
          {opt("A button that opens it", "button", mode, setMode)}
          {opt("Floating button (corner)", "floating", mode, setMode)}
        </Row>
        {mode !== "inline" && (
          <label className="block text-xs font-medium text-muted-foreground">
            Button text
            <input value={buttonText} maxLength={40} onChange={(e) => setButtonText(e.target.value)} className="mt-1 block w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
        )}
        <Row label="Colours">
          {opt("Light", "light", theme, setTheme)}
          {opt("Dark", "dark", theme, setTheme)}
          {opt("Follow the visitor", "auto", theme, setTheme)}
        </Row>
        <Row label="Corners">
          {opt("Rounded", "rounded", corners, setCorners)}
          {opt("Square", "square", corners, setCorners)}
        </Row>
        <Row label="Font">
          {opt("Your website's font", "inherit", font, setFont)}
          {opt("Standard", "system", font, setFont)}
        </Row>
        <Row label="Heading">
          {opt("Show", "show", heading, setHeading)}
          {opt("Hide (your page has its own)", "hide", heading, setHeading)}
        </Row>
        <div className="flex flex-wrap gap-4">
          <label className="block text-xs font-medium text-muted-foreground">
            Colour (optional; else the form&apos;s)
            <span className="mt-1 flex items-center gap-2">
              <input type="color" value={validAccent || "#4f46e5"} onChange={(e) => setAccent(e.target.value)} className="h-9 w-12 rounded border border-border" />
              <input value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="#rrggbb" className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs" />
            </span>
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Campaign (optional)
            <input value={campaign} maxLength={60} onChange={(e) => setCampaign(e.target.value)} placeholder="e.g. website-home" className="mt-1 block w-44 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground">Paste this where the form{mode === "floating" ? " button" : ""} should appear on your website</p>
          <textarea readOnly rows={4} value={snippet} onFocus={(e) => e.target.select()} className="mt-1 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs" />
          <button
            type="button"
            onClick={() =>
              navigator.clipboard?.writeText(snippet).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
            }
            className="mt-1 inline-flex items-center gap-1 rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-800"
          >
            {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy code"}
          </button>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>The form fits its height on its own; no scrollbar inside it.</li>
          <li>Each inquiry records the page it came from and your page&apos;s UTM tags (Insights and the CRM show them).</li>
          <li>Works on any site builder that accepts HTML (WordPress “Custom HTML”, Wix “Embed code”, Webflow “Embed”).</li>
          <li>Prefer a plain link? Use the link above, or the QR code.</li>
        </ul>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Preview of “{formName}”</p>
        <div className={`rounded-2xl border border-border p-4 ${theme === "dark" ? "bg-slate-900" : "bg-white"}`}>
          {mode === "inline" ? (
            publicEnabled ? (
              <iframe key={previewSrc} src={previewSrc} title="Preview" className="h-[560px] w-full rounded-lg border-0" />
            ) : (
              <p className="py-16 text-center text-sm text-slate-500">The preview appears once the public link is on.</p>
            )
          ) : (
            <div className="relative h-40">
              <p className="text-sm text-slate-500">Your page…</p>
              <button
                type="button"
                className={`${mode === "floating" ? "absolute bottom-2 right-2" : "mt-3"} px-4 py-2.5 text-sm font-semibold text-white shadow`}
                style={{ background: validAccent || "#4f46e5", borderRadius: corners === "square" ? 4 : 999 }}
              >
                {buttonText || "Get career guidance"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
