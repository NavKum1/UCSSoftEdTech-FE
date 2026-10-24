"use client";

/**
 * Landing page for a launch from a learning management system (LTI 1.3, phase C, 24 Oct 2026). The API's
 * /api/lti/launch sends the learner's browser here with #token=...&role=...&course=...&assignment=...&grades=1 (or
 * #error=...). The fragment never reaches a server; we remove it from the address bar at once, keep the session token
 * for this tab (as for partner sign-ins) and show the course the learner came from. (This page used to show an
 * invented course and student and claimed a certification it doesn't have.)
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import { setSelectedSchool } from "@/lib/appAuth";
import { clearPartnerSession, savePartnerSession } from "@/lib/partnerSession";

interface Launch {
  role: string | null;
  course: string | null;
  assignment: string | null;
  grades: boolean;
}

export default function LmsLaunchPage() {
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    // Remove the token from the address bar and history before doing anything else
    window.history.replaceState(null, "", window.location.pathname);
    const done = (fn: () => void) => queueMicrotask(fn);

    const failure = params.get("error");
    const token = params.get("token");
    if (failure || !token) {
      clearPartnerSession();
      done(() => setError(failure ?? "This page is opened from your course in your learning platform. Please launch Edulexa from there."));
      return;
    }
    const session = savePartnerSession(token);
    if (!session) {
      done(() => setError("This launch link is not valid or has expired. Please launch Edulexa again from your course."));
      return;
    }
    if (session.instituteId) setSelectedSchool(session.instituteId);
    done(() => setLaunch({ role: params.get("role") ?? session.role, course: params.get("course"), assignment: params.get("assignment"), grades: params.get("grades") === "1" }));
  }, []);

  const faculty = launch?.role === "Faculty";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
          <GraduationCap aria-hidden="true" className="h-4 w-4" /> From your course
        </p>
        {error ? (
          <>
            <h1 className="mt-2 text-xl font-semibold">We couldn&apos;t open Edulexa</h1>
            <p role="alert" className="mt-2 text-sm text-muted-foreground">
              {error}
            </p>
          </>
        ) : !launch ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Signing you in…
          </p>
        ) : (
          <>
            <h1 className="mt-2 text-xl font-semibold">Welcome to Edulexa</h1>
            {(launch.course || launch.assignment) && (
              <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BookOpen aria-hidden="true" className="h-3.5 w-3.5" /> Course
                </p>
                {launch.course && <p className="mt-1 font-semibold">{launch.course}</p>}
                {launch.assignment && <p className="mt-0.5 text-sm text-muted-foreground">Activity: {launch.assignment}</p>}
              </div>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              {faculty
                ? "You're signed in as teaching staff for this course."
                : launch.grades
                  ? "Your result for this activity is sent back to your course's gradebook when it is graded."
                  : "You're signed in for this session through your course."}
            </p>
            <Link
              href={faculty ? "/institute/dashboard" : "/dashboard"}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              {faculty ? "Open the institute portal" : "Continue"} <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
