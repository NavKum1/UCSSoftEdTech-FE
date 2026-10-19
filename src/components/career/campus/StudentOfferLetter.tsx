"use client";

/**
 * H5 student: read the offer letter, accept the offer by signing it (typed name; the college's placement-policy rules
 * apply), and download the letter and the signed copy. Declining stays on the applications page.
 */

import React, { useId, useState } from "react";
import { Badge, Button, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useCareerT, useLoad } from "@/components/career/ui";
import { useRunner } from "@/components/career/placements/useRunner";
import { label } from "@/components/career/placements/shared";
import { LETTER_TONE, useLetterStatusLabels, type OfferLetter } from "@/components/career/campus/OfferLetterPanel";

interface StudentLetter {
  letter: OfferLetter;
  offerStatus: string;
  canSign: boolean;
  sharesSignedCopyWith?: string | null;
  signatureProvider: string;
}

export function StudentOfferLetter({ offerId, onSigned }: { offerId: string; onSigned: () => void }) {
  const t = useCareerT("campusStudentOfferLetter");
  const STATUS = useLetterStatusLabels();
  const textId = useId();
  const { api, busy, err, msg, setMsg, setErr, run, download } = useRunner();
  const base = `/api/career/campus/student/offers/${offerId}/letter`;
  const view = useLoad(() => api<StudentLetter>(base), [api, base]);
  const [typed, setTyped] = useState("");
  const [agree, setAgree] = useState(false);
  const [release, setRelease] = useState(false);

  if (view.loading && !view.data) return <Loading />;
  if (!view.data) return <ErrorBanner error={view.error} onRetry={view.reload} />;
  const { letter: l, canSign, sharesSignedCopyWith } = view.data;

  const sign = () =>
    run("sign", async () => {
      if (!agree) {
        setErr(t("agreeFirst"));
        return;
      }
      await api(`${base}/sign`, { method: "POST", json: { sha256: l.sha256, typedName: typed, releaseOtherOffers: release } });
      setMsg(t("signed"));
      view.reload();
      onSigned();
    });

  return (
    <div className="mt-3 space-y-3 rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{t("title", { version: l.version })}</span>
        <Badge tone={LETTER_TONE[l.status] ?? "neutral"}>{label(STATUS, l.status)}</Badge>
        {l.respondBy && l.status === "Issued" && <span>{t("respondBy", { date: formatDate(l.respondBy) })}</span>}
      </div>
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      {l.text && (
        <div id={textId} role="region" aria-label={t("textLabel")} tabIndex={0} className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded border border-border bg-muted/40 p-3 text-start">
          {l.text}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {l.hasFile && (
          <Button variant="secondary" busy={busy === "file"} onClick={() => download(`${base}/file`, "file", "offer-letter.pdf")}>
            {l.kind === "Uploaded" ? t("downloadUploaded") : t("downloadLetter")}
          </Button>
        )}
        {l.hasSignedCopy && (
          <Button variant="secondary" busy={busy === "signed"} onClick={() => download(`${base}/signed`, "signed", "offer-letter-signed.pdf")}>
            {t("downloadSigned")}
          </Button>
        )}
      </div>
      {l.signedAt && <p>{t("signedOn", { date: formatDate(l.signedAt, true), name: l.typedName ?? "" })}</p>}
      {canSign && (
        <fieldset className="space-y-3 border-t border-border pt-3">
          <legend className="font-medium">{t("signTitle")}</legend>
          <p className="text-xs text-muted-foreground">{t("signHelp")}</p>
          <Field label={t("typedName")} hint={t("typedNameHint")}>
            {(p) => <input {...p} autoComplete="name" value={typed} onChange={(e) => setTyped(e.target.value)} />}
          </Field>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} aria-describedby={textId} />
            <span>{sharesSignedCopyWith ? t("agreeShare", { company: sharesSignedCopyWith }) : t("agree")}</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={release} onChange={(e) => setRelease(e.target.checked)} />
            <span>{t("release")}</span>
          </label>
          <Button busy={busy === "sign"} disabled={typed.trim().length < 2 || !agree} onClick={sign}>
            {t("signAndAccept")}
          </Button>
        </fieldset>
      )}
    </div>
  );
}
