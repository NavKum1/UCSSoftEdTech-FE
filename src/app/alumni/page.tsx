"use client";

import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { Card, ErrorBanner, Loading, PageHeader, useLoad } from "@/components/career/ui";
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
  const api = useApi();
  const { brand } = useCareerShell();
  const home = useLoad(() => api<AlumniHome>("/api/career/mentoring/alumni/home"), [api]);

  if (home.loading && !home.data) return <Loading />;
  if (!home.data) return <ErrorBanner error={home.error} onRetry={home.reload} />;
  const h = home.data;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${h.name}`}
        description={h.isAlumni ? `You're part of the ${h.school ?? "school"} alumni network.` : `You're a volunteer mentor for ${h.school ?? "this school"}.`}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Mentoring">
          {h.profile ? (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                Your mentor profile: <StatusBadge status={h.profile.status} />
              </p>
              <ul className="list-disc pl-5">
                <li>{h.counts.pendingRequests} request{h.counts.pendingRequests === 1 ? "" : "s"} waiting for your answer</li>
                <li>
                  {h.counts.activeMentees} of {h.profile.capacity} mentee spots in use
                </li>
                <li>{h.counts.completed} completed mentorship{h.counts.completed === 1 ? "" : "s"}</li>
              </ul>
            </div>
          ) : (
            <p className="text-sm">Share what you&apos;ve learned with current students. Set up a mentor profile; the career center reviews it before students can find you.</p>
          )}
          <Link href="/alumni/mentoring" className="mt-4 inline-block text-sm font-medium underline">
            {h.profile ? "Go to mentoring" : "Become a mentor"}
          </Link>
        </Card>
        {h.isAlumni && (
          <Card title="Career services">
            <p className="text-sm">
              As an alum you can keep using {brand?.displayName ?? "career"} services, including finding a mentor yourself.
            </p>
            <Link href="/student" className="mt-4 inline-block text-sm font-medium underline">
              Open career services
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
