"use client";

/**
 * Mentoring for Edulexa members (phase D, 24 Oct 2026). Members whose school runs mentoring use their school's network;
 * everyone else can join the Edulexa community: as a mentee, or as a mentor whose profile Edulexa staff review before
 * members see it. Free; no payments. The mentoring pages themselves are the career suite's (search, requests, sessions,
 * feedback, reports), opened inside the community. (This replaced a paid marketplace of invented mentors.)
 */

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Users } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { setSelectedSchool } from "@/lib/appAuth";
import { COMMUNITY_INSTITUTE_ID } from "@/lib/community";
import { useEn } from "@/lib/english/EnglishProvider";
import { ErrorBanner, PageHeader, brandFill, buttonClass } from "@/components/career/ui";

interface CommunityStatus {
  instituteId: string;
  name: string;
  emailVerified: boolean;
  joined: boolean;
  mentorStatus: string | null;
  approvedMentors: number;
  isSuperAdmin: boolean;
}

const card = "rounded-xl border border-border bg-card shadow-sm";
const primary = buttonClass("primary");
const secondary = buttonClass("secondary");

const MENTOR_STATUS: Record<string, string> = {
  Draft: "Your mentor profile is a draft. Finish it and send it for review.",
  Pending: "Your mentor profile is waiting for review by the Edulexa team.",
  Approved: "You're a mentor in the community. Members can find you and ask you to mentor them.",
  Paused: "Your mentor profile is paused: members can't send you new requests.",
  Rejected: "Your mentor profile wasn't approved. You can update it and send it again.",
  Suspended: "Your mentor profile has been suspended.",
};

export default function MentorsPage() {
  const en = useEn();
  const router = useRouter();
  const { apiFetch, ready, access } = useLegacyApi();
  const [status, setStatus] = useState<CommunityStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/career/mentoring/community");
    if (res.ok) setStatus((await res.json()) as CommunityStatus);
    else setError(en("Mentoring couldn't be loaded. Please refresh the page."));
  }, [apiFetch, en]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  const open = (path: string) => {
    setSelectedSchool(COMMUNITY_INSTITUTE_ID);
    router.push(path);
  };

  const join = async (asMentor: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/career/mentoring/community/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asMentor }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? "That didn't work. Please try again.");
        return;
      }
      setStatus(body as CommunityStatus);
      open(asMentor ? "/alumni/mentoring" : "/student/mentoring");
    } finally {
      setBusy(false);
    }
  };

  if (access) return <AccessNotice problem={access} feature="Mentoring" />;

  return (
    <div>
      <PageHeader
        title={en("Mentoring")}
        description={en("Find a mentor for your resume, interviews, a career change or your first job, or volunteer as one. Mentoring here is free. If your school runs its own mentoring, you'll find it in your school's career pages.")}
      />

      <ErrorBanner error={error} />

      {!status ? (
        !error && <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label={en("Loading")} />
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users aria-hidden="true" className="h-4 w-4" />
            {status.approvedMentors === 0
              ? en("There are no community mentors yet. Mentors appear once the Edulexa team has reviewed them.")
              : `${status.approvedMentors} mentor${status.approvedMentors === 1 ? "" : "s"} in the Edulexa community, each reviewed by the Edulexa team.`}
          </p>

          {!status.emailVerified ? (
            <section className={`${card} mt-4 p-5`}>
              <h2 className="text-base font-semibold">{en("Verify your email first")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {en("Mentors and mentees reach each other by email, so mentoring needs a verified email address on your account.")}
              </p>
            </section>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <section className={`${card} flex flex-col p-5`}>
                <h2 className="text-base font-semibold">{en("Find a mentor")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {en("Tell us what you'd like help with and see mentors who match, with the reasons for each match. A mentor accepts before you share contact details.")}
                </p>
                <div className="mt-auto pt-5">
                  {status.joined ? (
                    <button type="button" className={primary} style={brandFill} onClick={() => open("/student/mentoring")}>
                      {en("Open mentoring")}
                    </button>
                  ) : (
                    <button type="button" className={primary} style={brandFill} disabled={busy} onClick={() => void join(false)}>
                      {en("Join the community")}
                    </button>
                  )}
                </div>
              </section>
              <section className={`${card} flex flex-col p-5`}>
                <h2 className="text-base font-semibold">{en("Become a mentor")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {status.mentorStatus
                    ? MENTOR_STATUS[status.mentorStatus] ?? status.mentorStatus
                    : en("Share your experience a few times a month. You choose your topics, how you meet and how many mentees you take. The Edulexa team reviews each profile (your role and employer) before members can see it.")}
                </p>
                <div className="mt-auto pt-5">
                  {status.mentorStatus ? (
                    <button type="button" className={secondary} onClick={() => open("/alumni/mentoring")}>
                      {en("Your mentor profile")}
                    </button>
                  ) : (
                    <button type="button" className={secondary} disabled={busy} onClick={() => void join(true)}>
                      {en("Apply to mentor")}
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

          {status.isSuperAdmin && (
            <section className={`${card} mt-4 flex flex-wrap items-center justify-between gap-3 p-5`}>
              <p className="flex items-center gap-2 text-sm">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-muted-foreground" />{en(" Edulexa staff: review mentor applications and reports for the community.")}
              </p>
              <button type="button" className={secondary} onClick={() => open("/career-center/mentoring")}>
                {en("Review the community")}
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
