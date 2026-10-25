"use client";

/**
 * A career guidance form on an institute's own website (iframe, usually placed by /embed/guidance.js) or opened from a
 * link or QR code. A visitor with no account asks the institute's advisor for help. Only forms the institute made public
 * open here.
 * ?form= one of the institute's forms (its default otherwise) · ?resume= answers saved for later ·
 * utm_campaign / utm_source / ?campaign= where the visitor came from · ?page= the page it's embedded on.
 * Embedded (?embed=1): transparent background, tells the parent page its height (so the frame fits the form), and
 * ?theme=light|dark|auto, ?corners=square, ?font=…, ?heading=hide, ?accent=#rrggbb match the institute's site.
 */

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getApiBaseUrl } from "@/lib/apiClient";
import GuidanceForm, { type SubmitPayload } from "@/components/guidance/form/GuidanceForm";
import type { Fillable } from "@/components/guidance/form/model";

export default function EmbeddedGuidancePage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-6 h-64 max-w-lg animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />}>
      <Embedded />
    </Suspense>
  );
}

/** Font family names only (from the institute's page) */
const safeFont = (f: string | null) => (f ? f.replace(/[^\w\s,'"-]/g, "").slice(0, 120) : "");

function Embedded() {
  const { instituteId } = useParams<{ instituteId: string }>();
  const params = useSearchParams();
  const formId = params.get("form");
  const embedded = params.get("embed") === "1";
  const theme = params.get("theme");
  const square = params.get("corners") === "square";
  const font = safeFont(params.get("font"));
  const hideHeading = params.get("heading") === "hide";
  const accent = params.get("accent");
  const campaign = params.get("utm_campaign") || params.get("campaign") || params.get("utm_source");
  const page = params.get("page");
  const base = `${getApiBaseUrl().replace(/\/$/, "")}/api/public/guidance/${instituteId}`;
  const [loaded, setFill] = useState<Fillable | null>(null);
  const [missing, setMissing] = useState(false);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${base}${formId ? `?form=${encodeURIComponent(formId)}` : ""}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) setFill((await res.json()) as Fillable);
        else setMissing(true);
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [base, formId, reloads]);

  // The site's colour, when it set one
  const fill = useMemo(() => {
    if (!loaded || !accent || !/^#[0-9a-fA-F]{6}$/.test(accent)) return loaded;
    return { ...loaded, definition: { ...loaded.definition, settings: { ...loaded.definition.settings, accent } } };
  }, [loaded, accent]);

  // Embedded: blend into the page (transparent, the site's light or dark) and keep the frame as tall as the form
  useEffect(() => {
    if (!embedded) return;
    const html = document.documentElement;
    document.body.style.background = "transparent";
    if (theme === "light" || theme === "dark") {
      html.classList.remove("light", "dark");
      html.classList.add(theme);
      html.style.colorScheme = theme;
    }
    const el = box.current;
    if (!el || window.parent === window) return;
    const send = () => window.parent.postMessage({ type: "edulexa-guidance:height", height: Math.ceil(el.getBoundingClientRect().height) + 4 }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, [embedded, theme, fill, missing, checkEmail]);

  const upload = async (file: File) => {
    const data = new FormData();
    data.append("file", file);
    const res = await fetch(`${base}/upload?form=${fill?.formId}`, { method: "POST", body: data });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? (res.status === 429 ? "Too many files from here just now." : "The file couldn't be attached."));
    return body as { id: string; name: string; size: number };
  };

  const submit = async (p: SubmitPayload) => {
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: p.name, email: p.email, phone: p.phone, unsure: p.unsure, answers: p.answers, consent: true, meta: p.meta }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok) {
      if (body?.confirmEmail) setCheckEmail(p.email);
      return null;
    }
    // The form was open too long: get a fresh one (answers stay) and ask to send again
    if (body?.code === "reload") {
      setReloads((n) => n + 1);
      return "This form had been open a long time. Please press Send again.";
    }
    return res.status === 429 ? "Too many requests from here just now. Please try again later." : (body?.error ?? "Your request couldn't be sent. Please try again.");
  };

  return (
    <div
      ref={box}
      data-gf-square={square ? "" : undefined}
      style={font ? { fontFamily: font } : undefined}
      className={`mx-auto max-w-lg ${embedded ? "px-3 py-4 sm:px-4" : "p-4 sm:p-6"} ${params.get("popup") === "1" ? "pt-8" : ""}`}
    >
      {square && (
        <style>{`[data-gf-square] .rounded-xl,[data-gf-square] .rounded-2xl,[data-gf-square] .rounded-lg,[data-gf-square] .rounded-full{border-radius:4px}`}</style>
      )}
      {missing ? (
        <p className="p-6 text-center text-sm text-muted-foreground">This form isn&apos;t available right now.</p>
      ) : checkEmail ? (
        <div className="p-6 text-center" role="status">
          <p className="text-base font-semibold">Check your email to confirm</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a link to <span className="font-medium text-foreground">{checkEmail}</span>. Your request reaches {fill?.instituteName ?? "the institute"} once you click it. The
            link works for 48 hours; check your spam folder if you don&apos;t see it.
          </p>
        </div>
      ) : !fill ? (
        <div className="h-64 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />
      ) : (
        <GuidanceForm
          fill={fill}
          mode="website"
          bare={hideHeading}
          consentText={`Send this to ${fill.instituteName} so an advisor can contact me.`}
          upload={upload}
          onSubmit={submit}
          campaign={campaign}
          referrer={page}
          resumeToken={params.get("resume")}
          apiBase={base}
        />
      )}
    </div>
  );
}
