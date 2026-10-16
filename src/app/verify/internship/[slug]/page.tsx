"use client";

/**
 * Public verification page for an internship-defense credential (linked from the Open Badges evidence).
 * Shows the issuing school's brand, the internship and the credential's live status.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiClient";
import { BRAND_TEXT_CLASS, brandCssVars } from "@/components/career/brandColor";
import { Badge, Card, ErrorBanner, Loading, formatDate, useCareerT } from "@/components/career/ui";

interface Brand {
  displayName: string;
  logoUrl?: string | null;
  primaryColor: string;
}

interface PublicInternship {
  credentialId: string;
  status: string;
  issuedAt: string;
  validUntil: string;
  revokedAt?: string | null;
  holderName: string;
  title: string;
  roleTitle: string;
  employerName: string;
  startDate: string;
  endDate: string;
  school: { displayName: string; slug: string } | null;
  defenseScore: number | null;
  supervisorConfirmedAt?: string | null;
  decidedByPerson: boolean;
  disclaimer: string;
}

async function request<T>(path: string, failed: (status: number) => string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", referrerPolicy: "no-referrer" });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : failed(res.status);
    throw new Error(message);
  }
  return data as T;
}

/** The API helper with its fallback error in the page language (G1). */
function useGet() {
  const t = useCareerT("verifyInternship");
  return useCallback(<T,>(path: string) => request<T>(path, (status) => t("somethingWentWrongStatus", { status })), [t]);
}

const TONES: Record<string, "good" | "bad" | "warn" | "neutral"> = { Valid: "good", Revoked: "bad", Expired: "warn", "Under review": "warn" };

export default function VerifyInternshipPage() {
  const t = useCareerT("verifyInternship");
  const get = useGet();
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicInternship | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<PublicInternship>(`/api/career/internship-defense/public/${encodeURIComponent(slug)}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (d.school) get<Brand>(`/api/career/brand?school=${encodeURIComponent(d.school.slug)}`).then((b) => !cancelled && setBrand(b)).catch(() => {});
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [slug, get]);

  const color = brand?.primaryColor ?? "#4f46e5";
  return (
    <div className="min-h-screen bg-background text-foreground" style={brandCssVars(color) as React.CSSProperties}>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.displayName} className="h-8 w-auto" />
          ) : (
            <span className={`font-semibold ${BRAND_TEXT_CLASS}`}>
              {brand?.displayName ?? ""}
            </span>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">{t("verifiedInternship")}</h1>
        <ErrorBanner error={error} />
        {!data && !error && <Loading />}
        {data && (
          <>
            <Card>
              <p role="status" className="mb-4 text-sm">
                {t("status")}{" "}<Badge tone={TONES[data.status] ?? "neutral"}>{data.status}</Badge>
                {data.revokedAt && <span className="ms-2">{t("revokedOnRevokedAt", { revokedAt: formatDate(data.revokedAt) })}</span>}
              </p>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">{t("holder")}</dt>
                  <dd>{data.holderName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("issuedBy")}</dt>
                  <dd>{data.school?.displayName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("role")}</dt>
                  <dd>
                    {data.roleTitle}, {data.employerName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("internshipDates")}</dt>
                  <dd>
                    {t("startDateToEndDate", { startDate: formatDate(data.startDate), endDate: formatDate(data.endDate) })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("howItWasVerified")}</dt>
                  <dd>
                    {data.supervisorConfirmedAt ? t("siteSupervisorConfirmedOnSupervisorConfi", { supervisorConfirmedAt: formatDate(data.supervisorConfirmedAt) }) : t("schoolStaffVerifiedIt")}
                    {data.decidedByPerson ? t("decisionRecordedBySchoolStaff") : ""}
                    {data.defenseScore != null ? t("defenseScoreDefenseScore100", { defenseScore: data.defenseScore }) : "."}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("valid")}</dt>
                  <dd>
                    {t("issuedAtToValidUntil", { issuedAt: formatDate(data.issuedAt), validUntil: formatDate(data.validUntil) })}
                  </dd>
                </div>
              </dl>
            </Card>
            <p className="text-xs text-muted-foreground">{data.disclaimer}</p>
          </>
        )}
      </div>
    </div>
  );
}
