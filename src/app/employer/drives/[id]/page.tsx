"use client";

/** H1 employer: one campus drive at one college: its approval, the college's policy, applicants, rounds, slots and offers. */

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { Badge, Card, EmptyState, ErrorBanner, Loading, PageHeader, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { useEmployers } from "@/components/career/EmployerPicker";
import { inrShort, label } from "@/components/career/placements/shared";
import { DriveWorkspace } from "@/components/career/campus/DriveWorkspace";
import { HireDriveStatus } from "@/components/career/campus/HireDrivePanels";
import { APPROVAL_TONE, useApprovalLabels, useTierLabels, type Applicant, type CampusDrive, type CampusJob, type CampusRound } from "@/components/career/campus/shared";

interface DriveView {
  drive: CampusDrive;
  job?: CampusJob | null;
  rounds: CampusRound[];
  counts: Record<string, number>;
  policy: { oneOfferPerStudent: boolean; blockAfterAcceptance: boolean; tiersOn: boolean; dreamCtcMin?: number | null; superDreamCtcMin?: number | null };
  pricing: { employerPostingFeeRequired: boolean; premiumVisibilityEnabled: boolean };
}

export default function EmployerDrivePage() {
  const t = useCareerT("employerDrive");
  const { id } = useParams<{ id: string }>();
  const emp = useEmployers();
  const employerId = emp.current?.employer.id;
  if (emp.loading) return <Loading />;
  if (!employerId) return <EmptyState title={t("noEmployer")} />;
  return <Drive employerId={employerId} driveId={id} />;
}

function Drive({ employerId, driveId }: { employerId: string; driveId: string }) {
  const t = useCareerT("employerDrive");
  const APPROVAL = useApprovalLabels();
  const TIER = useTierLabels();
  const api = useApi();
  const base = `/api/career/campus/employer/${employerId}/drives/${driveId}`;
  const view = useLoad(() => api<DriveView>(base), [api, base]);
  const approved = view.data?.drive.approvalStatus === "Approved";
  const applicants = useLoad(
    () => (approved ? api<{ applicants: Applicant[] }>(`${base}/applicants`) : Promise.resolve({ applicants: [] as Applicant[] })),
    [api, base, approved],
  );

  if (view.loading && !view.data) return <Loading />;
  if (view.error) return <ErrorBanner error={view.error} onRetry={view.reload} />;
  const { drive: d, job, policy, pricing } = view.data!;
  const reload = () => {
    view.reload();
    applicants.reload();
  };

  return (
    <div>
      <PageHeader
        title={t("title", { company: d.companyName, school: d.school ?? "" })}
        description={d.title}
        actions={
          job ? (
            <Link className="text-sm underline" href={`/employer/jobs/${job.id}`}>
              {t("backToJob")}
            </Link>
          ) : undefined
        }
      />
      <div className="space-y-6">
        <Card title={t("summary")}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={APPROVAL_TONE[d.approvalStatus] ?? "neutral"}>{label(APPROVAL, d.approvalStatus)}</Badge>
            <span>{label(TIER, d.tier)}</span>
            <span>· {t("deadline", { date: formatDate(d.applyDeadline, true) })}</span>
            <span>· {d.applicationsOpen ? t("open") : t("closedForApplications")}</span>
          </div>
          {d.approvalNote && <p className="mt-2 text-sm">{t("collegeNote", { note: d.approvalNote })}</p>}
          <p className="mt-2 text-sm text-muted-foreground">
            {policy.tiersOn
              ? t("policyTiers", { dream: inrShort(policy.dreamCtcMin), superDream: inrShort(policy.superDreamCtcMin) })
              : policy.oneOfferPerStudent
                ? t("policyOneOffer")
                : t("policyNone")}{" "}
            {policy.blockAfterAcceptance ? t("policyBlock") : ""}
          </p>
          {pricing.employerPostingFeeRequired && <p className="mt-1 text-xs text-muted-foreground">{t("feeFlag")}</p>}
        </Card>
        {!approved ? (
          <EmptyState title={t("notApprovedYet")} />
        ) : applicants.loading && !applicants.data ? (
          <Loading />
        ) : applicants.error ? (
          <ErrorBanner error={applicants.error} onRetry={applicants.reload} />
        ) : (
          <>
            <DriveWorkspace base={base} mode="employer" rounds={view.data!.rounds} applicants={applicants.data?.applicants ?? []} onChanged={reload} />
            <HireDriveStatus base={base} mode="employer" applicants={applicants.data?.applicants ?? []} />
          </>
        )}
      </div>
    </div>
  );
}
