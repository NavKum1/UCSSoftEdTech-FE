"use client";

import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { Card, ErrorBanner, Loading, PageHeader, useLoad, useCareerT } from "@/components/career/ui";
import { useCareerShell } from "@/components/career/CareerShell";
import { StatusBadge } from "@/components/career/mentoring/MentorshipPanel";

interface AlumniHome {
  instituteId: string;
  school: string | null;
  isAlumni: boolean;
  name: string;
  profile: { status: string; capacity: number; activeMentees: number } | null;
  counts: { pendingRequests: number; activeMentees: number; completed: number };
}

export default function AlumniHomePage() {
  const t = useCareerT("alumniHome");
  const api = useApi();
  const { brand } = useCareerShell();
  const home = useLoad(() => api<AlumniHome>("/api/career/mentoring/alumni/home"), [api]);

  if (home.loading && !home.data) return <Loading />;
  if (!home.data) return <ErrorBanner error={home.error} onRetry={home.reload} />;
  const h = home.data;

  return (
    <div>
      <PageHeader
        title={t("welcomeName", { name: h.name })}
        description={h.isAlumni ? t("yourePartOfTheSchool", { school: h.school ?? t("school") }) : t("youreAVolunteerMentorFor", { school: h.school ?? t("thisSchool") })}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Card title={t("mentoring")}>
          {h.profile ? (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                {t("yourMentorProfile")}{" "}<StatusBadge status={h.profile.status} />
              </p>
              <ul className="list-disc ps-5">
                <li>{t("pendingRequestsRequestsWaitingForYour", { pendingRequests: h.counts.pendingRequests })}</li>
                <li>
                  {t("activeMenteesOfCapacityMenteeSpots", { activeMentees: h.counts.activeMentees, capacity: h.profile.capacity })}
                </li>
                <li>{t("completedCompletedMentorships", { completed: h.counts.completed })}</li>
              </ul>
            </div>
          ) : (
            <p className="text-sm">{t("shareWhatYouveLearnedWith")}</p>
          )}
          <Link href="/alumni/mentoring" className="mt-4 inline-block text-sm font-medium underline">
            {h.profile ? t("goToMentoring") : t("becomeAMentor")}
          </Link>
        </Card>
        {h.isAlumni && (
          <Card title={t("careerServices")}>
            <p className="text-sm">
              {t("asAnAlumYouCan", { displayName: brand?.displayName ?? t("career") })}
            </p>
            <Link href="/student" className="mt-4 inline-block text-sm font-medium underline">
              {t("openCareerServices")}
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
