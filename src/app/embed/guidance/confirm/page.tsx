"use client";

/**
 * Confirming a career guidance request from the link in the email (forms that require email confirmation). The request
 * is already in the institute's CRM, marked unconfirmed; once confirmed, its messages to them go out. The institute's
 * thank-you message is shown, or its own page opens.
 */

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { getApiBaseUrl } from "@/lib/apiClient";
import { MeetingNotice } from "@/components/guidance/form/Meeting";
import type { MeetingTold } from "@/components/guidance/form/GuidanceForm";
import { UI } from "@/components/guidance/form/uiText";

export default function ConfirmGuidancePage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-40 max-w-md animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />}>
      <Confirm />
    </Suspense>
  );
}

function Confirm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<{ ok: boolean; institute?: string | null; thankYou?: string | null; meeting?: MeetingTold | null; error?: string } | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch(`${getApiBaseUrl().replace(/\/$/, "")}/api/public/guidance-forms/confirm/${encodeURIComponent(token)}`, { method: "POST" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) return setState({ ok: false, error: body?.error ?? "This link didn't work. Please fill in the form again." });
        // A meeting they asked for is arranged now: they see it before going on to the institute's own page
        if (body?.redirectUrl && !body?.booking) {
          window.location.href = body.redirectUrl;
          return;
        }
        setState({ ok: true, institute: body?.instituteName, thankYou: body?.thankYou, meeting: body?.booking ?? null });
      })
      .catch(() => setState({ ok: false, error: "We couldn't reach the server. Please check your connection and open the link again." }));
  }, [token]);

  if (!state) return <div className="mx-auto mt-10 h-40 max-w-md animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />;
  return (
    <div className="mx-auto mt-10 max-w-md p-6 text-center" role="status">
      {state.ok ? (
        <>
          <CheckCircle2 aria-hidden="true" className="mx-auto h-10 w-10 text-emerald-600" />
          <h1 className="mt-3 text-lg font-semibold">Confirmed. Thank you.</h1>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {state.thankYou || `Your request is with ${state.institute ?? "the institute"}. An advisor will get back to you by email.`}
          </p>
          {state.meeting && (
            <div className="mt-4 text-left" style={{ "--gf-accent": "#059669" } as React.CSSProperties}>
              <MeetingNotice meeting={state.meeting} t={(k) => UI.en[k as keyof typeof UI.en] ?? k} />
            </div>
          )}
        </>
      ) : (
        <>
          <XCircle aria-hidden="true" className="mx-auto h-10 w-10 text-red-600" />
          <h1 className="mt-3 text-lg font-semibold">This link didn&apos;t work</h1>
          <p className="mt-1 text-sm text-muted-foreground">{state.error}</p>
        </>
      )}
    </div>
  );
}
