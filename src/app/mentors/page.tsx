"use client";

/**
 * Mentoring for Edulexa members (phase D, 24 Oct 2026). Members whose school runs mentoring use their school's network;
 * everyone else can join the Edulexa community: as a mentee, or as a mentor whose profile Edulexa staff review before
 * members see it. Free; no payments. The mentoring pages themselves are the career suite's (search, requests, sessions,
 * feedback, reports), opened inside the community. (This replaced a paid marketplace of invented mentors.)
 */

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, ShieldCheck, Users } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { setSelectedSchool } from "@/lib/appAuth";
import { COMMUNITY_INSTITUTE_ID } from "@/lib/community";

interface CommunityStatus {
  instituteId: string;
  name: string;
  emailVerified: boolean;
  joined: boolean;
  mentorStatus: string | null;
  approvedMentors: number;
  isSuperAdmin: boolean;
}

const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const secondary = "inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50";

const MENTOR_STATUS: Record<string, string> = {
  Draft: "Your mentor profile is a draft. Finish it and send it for review.",
  Pending: "Your mentor profile is waiting for review by the Edulexa team.",
  Approved: "You're a mentor in the community. Members can find you and ask you to mentor them.",
  Paused: "Your mentor profile is paused: members can't send you new requests.",
  Rejected: "Your mentor profile wasn't approved. You can update it and send it again.",
  Suspended: "Your mentor profile has been suspended.",
};

export default function MentorsPage() {
  const router = useRouter();
  const { apiFetch, ready, access } = useLegacyApi();
  const [status, setStatus] = useState<CommunityStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/career/mentoring/community");
    if (res.ok) setStatus((await res.json()) as CommunityStatus);
    else setError("Mentoring couldn't be loaded. Please refresh the page.");
  }, [apiFetch]);
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
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6">
      <header>
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
          <HeartHandshake aria-hidden="true" className="h-4 w-4" /> Mentoring
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Learn from people who have done it</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Find a mentor for your resume, interviews, a career change or your first job, or volunteer as one. Mentoring here is free. If your school runs
          its own mentoring, you&apos;ll find it in your school&apos;s career pages.
        </p>
      </header>

      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {!status ? (
        !error && <div className={`${card} mt-6 h-40 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Loading" />
      ) : (
        <>
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Users aria-hidden="true" className="h-4 w-4" />
            {status.approvedMentors === 0
              ? "There are no community mentors yet. Mentors appear once the Edulexa team has reviewed them."
              : `${status.approvedMentors} mentor${status.approvedMentors === 1 ? "" : "s"} in the Edulexa community, each reviewed by the Edulexa team.`}
          </p>

          {!status.emailVerified ? (
            <section className={`${card} mt-4 p-6`}>
              <h2 className="text-base font-semibold">Verify your email first</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Mentors and mentees reach each other by email, so mentoring needs a verified email address on your account.
              </p>
            </section>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <section className={`${card} flex flex-col p-6`}>
                <h2 className="text-base font-semibold">Find a mentor</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tell us what you&apos;d like help with and see mentors who match, with the reasons for each match. A mentor accepts before you share
                  contact details.
                </p>
                <div className="mt-auto pt-5">
                  {status.joined ? (
                    <button type="button" className={primary} onClick={() => open("/student/mentoring")}>
                      Open mentoring
                    </button>
                  ) : (
                    <button type="button" className={primary} disabled={busy} onClick={() => void join(false)}>
                      Join the community
                    </button>
                  )}
                </div>
              </section>
              <section className={`${card} flex flex-col p-6`}>
                <h2 className="text-base font-semibold">Become a mentor</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {status.mentorStatus
                    ? MENTOR_STATUS[status.mentorStatus] ?? status.mentorStatus
                    : "Share your experience a few times a month. You choose your topics, how you meet and how many mentees you take. The Edulexa team reviews each profile (your role and employer) before members can see it."}
                </p>
                <div className="mt-auto pt-5">
                  {status.mentorStatus ? (
                    <button type="button" className={secondary} onClick={() => open("/alumni/mentoring")}>
                      Your mentor profile
                    </button>
                  ) : (
                    <button type="button" className={secondary} disabled={busy} onClick={() => void join(true)}>
                      Apply to mentor
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

          {status.isSuperAdmin && (
            <section className={`${card} mt-4 flex flex-wrap items-center justify-between gap-3 p-5`}>
              <p className="flex items-center gap-2 text-sm">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600" /> Edulexa staff: review mentor applications and reports for the community.
              </p>
              <button type="button" className={secondary} onClick={() => open("/career-center/mentoring")}>
                Review the community
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
