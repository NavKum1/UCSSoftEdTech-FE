"use client";

/**
 * A career guidance form on an institute's own website (iframe) or opened from a link or QR code. A visitor with no
 * account asks the institute's advisor for help. ?form= picks one of the institute's forms (its default otherwise),
 * ?resume= restores answers saved for later, utm_campaign / utm_source / ?campaign= record where the visitor came from.
 * Only forms the institute made public open here.
 */

import React, { Suspense, useEffect, useState } from "react";
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

function Embedded() {
  const { instituteId } = useParams<{ instituteId: string }>();
  const params = useSearchParams();
  const formId = params.get("form");
  const campaign = params.get("utm_campaign") || params.get("campaign") || params.get("utm_source");
  const base = `${getApiBaseUrl().replace(/\/$/, "")}/api/public/guidance/${instituteId}`;
  const [fill, setFill] = useState<Fillable | null>(null);
  const [missing, setMissing] = useState(false);

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
  }, [base, formId]);

  if (missing) return <div className="mx-auto max-w-lg p-6 text-center text-sm text-muted-foreground">This form isn&apos;t available right now.</div>;
  if (!fill) return <div className="mx-auto mt-6 h-64 max-w-lg animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />;

  const upload = async (file: File) => {
    const data = new FormData();
    data.append("file", file);
    const res = await fetch(`${base}/upload?form=${fill.formId}`, { method: "POST", body: data });
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
    if (res.ok) return null;
    const body = await res.json().catch(() => null);
    return res.status === 429 ? "Too many requests from here just now. Please try again later." : (body?.error ?? "Your request couldn't be sent. Please try again.");
  };

  return (
    <div className="mx-auto max-w-lg p-4 sm:p-6">
      <GuidanceForm
        fill={fill}
        mode="website"
        consentText={`Send this to ${fill.instituteName} so an advisor can contact me.`}
        upload={upload}
        onSubmit={submit}
        campaign={campaign}
        resumeToken={params.get("resume")}
      />
    </div>
  );
}
