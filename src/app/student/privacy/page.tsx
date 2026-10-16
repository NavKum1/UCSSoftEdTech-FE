"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, PageHeader, SuccessBanner, formatDate, useLoad, ScrollArea, useCareerT } from "@/components/career/ui";
import StudentPrivacyRights from "@/components/career/privacy/StudentPrivacyRights";
import { labelOf, useFerpaCategoryLabels, useLegalBasisLabels } from "@/components/career/coreLabels";

interface Consent {
  id: string;
  recipientType: string;
  recipientName: string;
  categories: string[] | null;
  purpose: string;
  source?: string | null;
  grantedAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  active: boolean;
}

interface Disclosure {
  id: string;
  recipientType: string;
  recipientName: string;
  categories: string[] | null;
  purpose: string;
  legalBasis: string;
  occurredAt: string;
}

const catsWith = (FERPA_CATEGORY_LABELS: Record<string, string>) => (c: string[] | null) => (c ?? []).map((x) => labelOf(FERPA_CATEGORY_LABELS, x)).join(", ") || "—";

export default function StudentPrivacyPage() {
  const t = useCareerT("studentPrivacy");
  const LEGAL_BASIS_LABELS = useLegalBasisLabels();
  const cats = catsWith(useFerpaCategoryLabels());
  const api = useApi();
  const record = useLoad(() => api<{ ferpaHold: boolean; school: { displayName: string } }>("/api/career/student/record"), [api]);
  const consents = useLoad(() => api<Consent[]>("/api/career/student/consents"), [api]);
  const disclosures = useLoad(() => api<Disclosure[]>("/api/career/student/disclosures"), [api]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const hold = record.data?.ferpaHold ?? false;

  const toggleHold = async () => {
    const next = !hold;
    if (next && !window.confirm(t("turnOnADirectoryHold"))) return;
    setBusy("hold");
    setErr(null);
    try {
      const r = await api<{ ferpaHold: boolean }>("/api/career/student/ferpa-hold", { method: "PUT", json: { hold: next } });
      record.setData((d) => (d ? { ...d, ferpaHold: r.ferpaHold } : d));
      setMsg(r.ferpaHold ? t("directoryHoldIsOn") : t("directoryHoldIsOff"));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (c: Consent) => {
    if (!window.confirm(t("stopSharingWithRecipientNameThey", { recipientName: c.recipientName }))) return;
    setBusy(c.id);
    setErr(null);
    try {
      await api(`/api/career/student/consents/${c.id}/revoke`, { method: "POST" });
      setMsg(t("sharingWithRecipientNameWasStopped", { recipientName: c.recipientName }));
      consents.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title={t("privacySharing")} description={t("youControlWhoSeesYour")} />
      <ErrorBanner error={err ?? record.error ?? consents.error ?? disclosures.error} />
      <SuccessBanner message={msg} />

      <StudentPrivacyRights />

      <Card title={t("directoryInformation")} className="mb-6">
        {record.loading && !record.data ? (
          <Loading />
        ) : record.data ? (
          <div className="space-y-3 text-sm">
            <p>
              {t.rich("schoolsMayShareSomeBasic", { strong: (chunks) => <strong>{chunks}</strong> })}
            </p>
            <p className="flex flex-wrap items-center gap-2">
              {t("status")}{" "}{hold ? <Badge tone="warn">{t("holdOnNotShared")}</Badge> : <Badge tone="good">{t("noHoldDirectoryInformationMay")}</Badge>}
            </p>
            <Button variant={hold ? "secondary" : "primary"} onClick={toggleHold} busy={busy === "hold"} aria-pressed={hold}>
              {hold ? t("turnOffDirectoryHold") : t("turnOnDirectoryHold")}
            </Button>
          </div>
        ) : null}
      </Card>

      <Card title={t("whatYouveAgreedToShare")} className="mb-6">
        {consents.loading && !consents.data ? (
          <Loading />
        ) : (consents.data ?? []).length === 0 ? (
          <EmptyState title={t("youHaventSharedYourRecord")}>{t("whenYouAgreeToShare")}</EmptyState>
        ) : (
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">{t("yourSharingConsents")}</caption>
              <thead>
                <tr className="border-b border-border text-start [&_th]:text-start">
                  <th scope="col" className="py-2 pe-3 font-medium">{t("sharedWith")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("what")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("why")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("since")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("status2")}</th>
                  <th scope="col" className="py-2"><span className="sr-only">{t("actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {consents.data!.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2 pe-3">{c.recipientName}<div className="text-xs text-muted-foreground">{c.recipientType}</div></td>
                    <td className="py-2 pe-3">{cats(c.categories)}</td>
                    <td className="py-2 pe-3">{c.purpose || "—"}</td>
                    <td className="py-2 pe-3">
                      {formatDate(c.grantedAt)}
                      {c.expiresAt && <div className="text-xs text-muted-foreground">{t("endsExpiresAt", { expiresAt: formatDate(c.expiresAt) })}</div>}
                    </td>
                    <td className="py-2 pe-3">
                      {c.active ? <Badge tone="good">{t("active")}</Badge> : c.revokedAt ? <Badge>{t("stoppedRevokedAt", { revokedAt: formatDate(c.revokedAt) })}</Badge> : <Badge>{t("expired")}</Badge>}
                    </td>
                    <td className="py-2 text-end">
                      {c.active && (
                        <Button variant="secondary" onClick={() => revoke(c)} busy={busy === c.id} aria-label={t("stopSharingWithRecipientName", { recipientName: c.recipientName })}>
                          {t("stopSharing")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Card>

      <Card title={t("whoSawWhatWhenAnd")}>
        <p className="mb-3 text-sm text-muted-foreground">{t("everyTimeYourRecordIs")}</p>
        {disclosures.loading && !disclosures.data ? (
          <Loading />
        ) : (disclosures.data ?? []).length === 0 ? (
          <EmptyState title={t("noOneOutsideYourSchool")} />
        ) : (
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">{t("disclosureHistory")}</caption>
              <thead>
                <tr className="border-b border-border text-start [&_th]:text-start">
                  <th scope="col" className="py-2 pe-3 font-medium">{t("when")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("who")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("what")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("why")}</th>
                  <th scope="col" className="py-2 font-medium">{t("allowedBy")}</th>
                </tr>
              </thead>
              <tbody>
                {disclosures.data!.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2 pe-3 whitespace-nowrap">{formatDate(d.occurredAt, true)}</td>
                    <td className="py-2 pe-3">{d.recipientName}<div className="text-xs text-muted-foreground">{d.recipientType}</div></td>
                    <td className="py-2 pe-3">{cats(d.categories)}</td>
                    <td className="py-2 pe-3">{d.purpose || "—"}</td>
                    <td className="py-2">{labelOf(LEGAL_BASIS_LABELS, d.legalBasis)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}
