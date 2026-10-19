"use client";

/**
 * H5: the offer letter of one H1 offer, for the employer (/employer/drives/[id]) and the placement office
 * (/career-center/placements/drives/[id]). Issue a letter from the template (CTC breakup, joining date, answer-by) or upload
 * the employer's own PDF/Word letter, see its status and versions, and download the letter or the signed copy. For an
 * employer every download of the signed copy is a logged disclosure under the student's consent.
 */

import React, { useState } from "react";
import { Badge, Button, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useCareerLabels, useCareerT, useLoad } from "@/components/career/ui";
import { useRunner } from "@/components/career/placements/useRunner";
import { inrFull, label } from "@/components/career/placements/shared";
import { toNum } from "@/components/career/campus/shared";

export const LETTER_STATUS_KEYS = ["Issued", "Signed", "Declined", "Superseded", "Withdrawn"];
export const LETTER_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = { Issued: "info", Signed: "good", Declined: "neutral", Superseded: "neutral", Withdrawn: "bad" };
export function useLetterStatusLabels(): Record<string, string> {
  return useCareerLabels("campusShared.letterStatus", LETTER_STATUS_KEYS);
}

export interface OfferLetter {
  id: string;
  version: number;
  kind: string;
  status: string;
  roleTitle: string;
  ctcAnnual?: number | null;
  ctcBreakup: { label: string; amount: number }[];
  joiningDate?: string | null;
  respondBy?: string | null;
  text?: string | null;
  sha256: string;
  hasFile: boolean;
  hasSignedCopy: boolean;
  issuedBy: string;
  issuedAt: string;
  signedAt?: string | null;
  typedName?: string | null;
  signatureProvider?: string | null;
}

interface LetterView {
  offer: { id: string; status: string; ctcAnnual?: number | null; joiningDate?: string | null; respondBy?: string | null; location?: string | null };
  current?: OfferLetter | null;
  history: OfferLetter[];
  signatureProvider: string;
  canIssue: boolean;
}

export function OfferLetterPanel({ base, offerId, onChanged }: { base: string; offerId: string; onChanged?: () => void }) {
  const t = useCareerT("campusOfferLetter");
  const STATUS = useLetterStatusLabels();
  const { api, busy, err, msg, setMsg, run, download } = useRunner();
  const view = useLoad(() => api<LetterView>(`${base}/offers/${offerId}/letter`), [api, base, offerId]);
  const [mode, setMode] = useState<"generate" | "upload">("generate");
  const [rows, setRows] = useState<{ label: string; amount: string }[]>([{ label: "", amount: "" }]);
  const [form, setForm] = useState({ joiningDate: "", respondBy: "", location: "", terms: "", signatoryName: "", signatoryTitle: "" });
  const [file, setFile] = useState<File | null>(null);

  if (view.loading && !view.data) return <Loading />;
  if (!view.data) return <ErrorBanner error={view.error} onRetry={view.reload} />;
  const v = view.data;
  const cur = v.current;
  const sum = rows.reduce((s, r) => s + (toNum(r.amount) ?? 0), 0);
  const done = (m: string) => {
    setMsg(m);
    view.reload();
    onChanged?.();
  };

  const generate = () =>
    run("generate", async () => {
      await api(`${base}/offers/${offerId}/letter`, {
        method: "POST",
        json: {
          ctcBreakup: rows.filter((r) => r.label.trim()).map((r) => ({ label: r.label.trim(), amount: toNum(r.amount) ?? 0 })),
          joiningDate: form.joiningDate || v.offer.joiningDate || undefined,
          respondBy: form.respondBy || v.offer.respondBy || undefined,
          location: form.location || undefined,
          terms: form.terms || undefined,
          signatoryName: form.signatoryName || undefined,
          signatoryTitle: form.signatoryTitle || undefined,
        },
      });
      done(t("issued"));
    });
  const upload = () =>
    run("upload", async () => {
      if (!file) throw new Error(t("chooseFile"));
      const fd = new FormData();
      fd.append("file", file);
      const rb = form.respondBy || v.offer.respondBy;
      if (rb) fd.append("respondBy", rb);
      const jd = form.joiningDate || v.offer.joiningDate;
      if (jd) fd.append("joiningDate", jd);
      await api(`${base}/offers/${offerId}/letter/upload`, { method: "POST", body: fd });
      done(t("uploaded"));
    });

  return (
    <div className="space-y-4">
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      {cur ? (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{t("version", { version: cur.version })}</span>
            <Badge tone={LETTER_TONE[cur.status] ?? "neutral"}>{label(STATUS, cur.status)}</Badge>
            <span className="text-muted-foreground">{cur.kind === "Uploaded" ? t("kindUploaded") : t("kindGenerated")}</span>
            <span className="text-muted-foreground">{t("issuedOn", { date: formatDate(cur.issuedAt, true) })}</span>
          </div>
          {cur.signedAt && <p>{t("signedOn", { date: formatDate(cur.signedAt, true), name: cur.typedName ?? "", provider: cur.signatureProvider ?? "" })}</p>}
          <p className="text-xs text-muted-foreground">
            {t("hash")} <code dir="ltr" className="break-all">{cur.sha256}</code>
          </p>
          <div className="flex flex-wrap gap-2">
            {cur.hasFile && (
              <Button variant="secondary" busy={busy === "file"} onClick={() => download(`${base}/offers/${offerId}/letter/${cur.id}/file`, "file", "offer-letter.pdf")}>
                {t("downloadLetter")}
              </Button>
            )}
            {cur.hasSignedCopy && (
              <Button variant="secondary" busy={busy === "signed"} onClick={() => download(`${base}/offers/${offerId}/letter/${cur.id}/signed`, "signed", "offer-letter-signed.pdf")}>
                {t("downloadSigned")}
              </Button>
            )}
          </div>
          {cur.hasSignedCopy && <p className="text-xs text-muted-foreground">{t("signedCopyNote")}</p>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      )}

      {v.canIssue && (
        <fieldset className="space-y-3 border-t border-border pt-3">
          <legend className="text-sm font-semibold">{cur ? t("reissueTitle") : t("issueTitle")}</legend>
          <p className="text-xs text-muted-foreground">{t("providerNote", { provider: v.signatureProvider === "dm" ? t("providerDm") : t("providerBuiltin") })}</p>
          <div className="flex flex-wrap gap-4 text-sm" role="radiogroup" aria-label={t("modeLabel")}>
            <label className="flex items-center gap-2">
              <input type="radio" name={`mode-${offerId}`} checked={mode === "generate"} onChange={() => setMode("generate")} />
              {t("modeGenerate")}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name={`mode-${offerId}`} checked={mode === "upload"} onChange={() => setMode("upload")} />
              {t("modeUpload")}
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("joiningDate")}>{(p) => <input {...p} type="date" value={form.joiningDate || v.offer.joiningDate || ""} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />}</Field>
            <Field label={t("respondBy")}>{(p) => <input {...p} type="date" value={form.respondBy || v.offer.respondBy || ""} onChange={(e) => setForm({ ...form, respondBy: e.target.value })} />}</Field>
          </div>
          {mode === "generate" ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("breakupTitle", { ctc: inrFull(v.offer.ctcAnnual) })}</p>
                {rows.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2">
                    <Field label={t("component", { n: i + 1 })}>{(p) => <input {...p} value={r.label} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />}</Field>
                    <Field label={t("amount", { n: i + 1 })}>{(p) => <input {...p} inputMode="numeric" value={r.amount} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />}</Field>
                    {rows.length > 1 && (
                      <Button variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                        {t("removeComponent")}
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="ghost" onClick={() => setRows([...rows, { label: "", amount: "" }])}>
                    {t("addComponent")}
                  </Button>
                  <span className="text-xs text-muted-foreground" aria-live="polite">{t("breakupSum", { sum: inrFull(sum) })}</span>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label={t("location")}>{(p) => <input {...p} value={form.location} placeholder={v.offer.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />}</Field>
                <Field label={t("signatoryName")}>{(p) => <input {...p} value={form.signatoryName} onChange={(e) => setForm({ ...form, signatoryName: e.target.value })} />}</Field>
                <Field label={t("signatoryTitle")}>{(p) => <input {...p} value={form.signatoryTitle} onChange={(e) => setForm({ ...form, signatoryTitle: e.target.value })} />}</Field>
              </div>
              <Field label={t("terms")}>{(p) => <textarea {...p} rows={3} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />}</Field>
              <Button busy={busy === "generate"} onClick={generate}>
                {t("generate")}
              </Button>
            </>
          ) : (
            <>
              <Field label={t("file")} hint={t("fileHint")}>{(p) => <input {...p} type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}</Field>
              <Button busy={busy === "upload"} disabled={!file} onClick={upload}>
                {t("upload")}
              </Button>
            </>
          )}
        </fieldset>
      )}

      {v.history.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer">{t("history", { count: v.history.length })}</summary>
          <ul className="mt-2 space-y-1 ps-5">
            {v.history.map((h) => (
              <li key={h.id}>
                {t("historyLine", { version: h.version, status: label(STATUS, h.status), date: formatDate(h.issuedAt, true) })}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
