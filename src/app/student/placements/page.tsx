"use client";

/**
 * A student's own campus placement record (G14a), read only: round results and offers as the placement office
 * recorded them. No list of drives, no criteria and no apply buttons: drives are the placement office's records.
 */

import React from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Card, EmptyState, ErrorBanner, Loading, PageHeader, ScrollArea, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { OFFER_TONE, RESULT_TONE, inrFull, label, useResultLabels, useOfferStatusLabels } from "@/components/career/placements/shared";

interface Mine {
  drives: { id: string; companyName: string; driveDate?: string | null; rounds: { name: string; roundDate?: string | null; result?: string | null }[] }[];
  offers: {
    id: string;
    companyName: string;
    roleTitle: string;
    employmentType: string;
    ctcAnnual?: number | null;
    stipendMonthly?: number | null;
    offerDate?: string | null;
    joiningDate?: string | null;
    location?: string | null;
    status: string;
  }[];
  note: string;
}

const th = "py-2 pe-3 font-medium";
const td = "py-2 pe-3 align-top";

export default function StudentPlacementsPage() {
  const t = useCareerT("studentPlacements");
  const OFFER_STATUS_LABELS = useOfferStatusLabels();
  const RESULT_LABELS = useResultLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const mine = useLoad(() => api<Mine>("/api/career/placement-office/me"), [api, schoolId]);

  return (
    <div>
      <PageHeader title={t("myPlacementRecord")} description={t("yourRoundResultsAndOffers")} />
      {mine.loading && !mine.data ? (
        <Loading />
      ) : mine.error ? (
        <ErrorBanner error={mine.error} onRetry={mine.reload} />
      ) : (
        mine.data && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">{mine.data.note}</p>
            <Card title={t("offers")}>
              {mine.data.offers.length === 0 ? (
                <EmptyState title={t("noOffersRecorded")} />
              ) : (
                <ScrollArea>
                  <table className="w-full text-sm">
                    <caption className="sr-only">{t("myOffers")}</caption>
                    <thead>
                      <tr className="border-b border-border [&_th]:text-start">
                        <th scope="col" className={th}>{t("company")}</th>
                        <th scope="col" className={th}>{t("role")}</th>
                        <th scope="col" className={th}>{t("packagePerYear")}</th>
                        <th scope="col" className={th}>{t("offerDate")}</th>
                        <th scope="col" className={th}>{t("joiningDate")}</th>
                        <th scope="col" className={th}>{t("status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mine.data.offers.map((o) => (
                        <tr key={o.id} className="border-b border-border last:border-0">
                          <th scope="row" className={`${td} text-start font-normal`}>{o.companyName}</th>
                          <td className={td}>{o.roleTitle}</td>
                          <td className={td}>{inrFull(o.ctcAnnual)}</td>
                          <td className={td}>{formatDate(o.offerDate)}</td>
                          <td className={td}>{formatDate(o.joiningDate)}</td>
                          <td className={td}>
                            <Badge tone={OFFER_TONE[o.status] ?? "neutral"}>{label(OFFER_STATUS_LABELS, o.status)}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </Card>
            <Card title={t("driveResults")}>
              {mine.data.drives.length === 0 ? (
                <EmptyState title={t("noResultsRecorded")} />
              ) : (
                <ul className="space-y-4">
                  {mine.data.drives.map((d) => (
                    <li key={d.id}>
                      <h3 className="font-medium">
                        {d.companyName} <span className="text-sm font-normal text-muted-foreground">{formatDate(d.driveDate)}</span>
                      </h3>
                      <ol className="mt-2 space-y-1 text-sm">
                        {d.rounds.map((r) => (
                          <li key={r.name} className="flex flex-wrap items-center gap-2">
                            <span>{r.name}</span>
                            <Badge tone={r.result ? RESULT_TONE[r.result] ?? "neutral" : "neutral"}>{r.result ? label(RESULT_LABELS, r.result) : t("notRecorded")}</Badge>
                          </li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )
      )}
    </div>
  );
}
