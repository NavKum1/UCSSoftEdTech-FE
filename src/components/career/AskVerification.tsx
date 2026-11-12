"use client";

/**
 * H52 "Ask Edulexa to verify us" (12 Nov 2026): the company's request to Edulexa staff, shown wherever the company is told it
 * needs staff verification (the employer home's verification card, the Campus jobs page outside India). The account owner asks;
 * a waiting request shows its date; a declined one shows the reason and lets the owner ask again. Staff decide on /admin/career.
 */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Button, ErrorBanner, formatDate, useCareerT } from "@/components/career/ui";

export interface VerificationRequestState {
  status: string;
  campusVerified: boolean;
  basis: string;
  staffVerified: boolean;
  isOwner: boolean;
  canAsk: boolean;
  requestedAt?: string | null;
  decidedAt?: string | null;
  declineReason?: string | null;
}

export function AskVerification({ employerId, state, onChange }: { employerId: string; state: VerificationRequestState; onChange: (s: VerificationRequestState) => void }) {
  const t = useCareerT("employerVerifyRequest");
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  if (state.staffVerified || state.status === "Flagged") return null;

  const ask = async () => {
    setBusy(true);
    setErr(null);
    try {
      onChange(await api<VerificationRequestState>(`/api/career/employer/${employerId}/verification-request`, { method: "POST" }));
      setSent(true);
    } catch (e) {
      setErr(e instanceof TypeError ? "We couldn't reach Edulexa. Check your internet connection and try again." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 text-sm">
      <ErrorBanner error={err} />
      {state.requestedAt ? (
        <p role="status" className="rounded-lg border border-border bg-muted/40 p-3">
          {sent ? t("sent") : t("askedOn", { date: formatDate(state.requestedAt) })}
        </p>
      ) : (
        <>
          {state.declineReason && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p>{t("declinedOn", { date: formatDate(state.decidedAt), reason: state.declineReason })}</p>
              {state.isOwner && <p className="mt-1">{t("fixThenAsk")}</p>}
            </div>
          )}
          {state.canAsk ? (
            <Button busy={busy} onClick={ask}>
              {state.declineReason ? t("askAgain") : t("ask")}
            </Button>
          ) : (
            !state.isOwner && <p className="text-muted-foreground">{t("ownerAsks")}</p>
          )}
        </>
      )}
    </div>
  );
}
