"use client";

/**
 * Landing page for a launch from a learning management system (LTI 1.3, phase C, 24 Oct 2026). The API's
 * /api/lti/launch sends the learner's browser here with #token=...&role=...&course=...&assignment=...&grades=1 (or
 * #error=...). The fragment never reaches a server; we remove it from the address bar at once, keep the session token
 * for this tab (as for partner sign-ins) and show the course the learner came from. (This page used to show an
 * invented course and student and claimed a certification it doesn't have.)
 * Build & Defend 2.10: a launch of an LMS assignment linked to a class assessment (classAssignment=...) doesn't keep the
 * LMS session: the person opens the assessment (or, a teacher, the class) with their own Edulexa account. A student whose
 * course email isn't on the class list is told, since their grade can't reach the gradebook.
 */

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { brandFill, buttonClass } from "@/components/career/ui";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import { setSelectedSchool } from "@/lib/appAuth";
import { clearPartnerSession, savePartnerSession } from "@/lib/partnerSession";
import { useEn } from "@/lib/english/EnglishProvider";

interface Launch {
  role: string | null;
  course: string | null;
  assignment: string | null;
  grades: boolean;
  /** 2.10: a class assessment linked to this LMS assignment */
  classAssignment: string | null;
  classAssessment: string | null;
  matched: boolean;
}

export default function LmsLaunchPage() {
  const en = useEn();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The fragment is read once: the address bar is cleared straight after, so a second run (development's double effects,
  // or the language loading) would find nothing and show an error over a good launch
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
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
    // A class assessment is opened with the person's own Edulexa account, never this LMS session
    const classAssignment = params.get("classAssignment");
    if (classAssignment) {
      clearPartnerSession();
      done(() =>
        setLaunch({
          role: params.get("role"), course: params.get("course"), assignment: params.get("assignment"), grades: params.get("grades") === "1",
          classAssignment, classAssessment: params.get("classAssessment"), matched: params.get("matched") === "1",
        }),
      );
      return;
    }
    const session = savePartnerSession(token);
    if (!session) {
      done(() => setError(en("This launch link is not valid or has expired. Please launch Edulexa again from your course.")));
      return;
    }
    if (session.instituteId) setSelectedSchool(session.instituteId);
    done(() =>
      setLaunch({
        role: params.get("role") ?? session.role, course: params.get("course"), assignment: params.get("assignment"), grades: params.get("grades") === "1",
        classAssignment: null, classAssessment: null, matched: false,
      }),
    );
  }, [en]);

  const faculty = launch?.role === "Faculty";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <GraduationCap aria-hidden="true" className="h-4 w-4" />{en(" From your course")}
        </p>
        {error ? (
          <>
            <h1 className="mt-2 text-xl font-semibold">{en("We couldn't open Edulexa")}</h1>
            <p role="alert" className="mt-2 text-sm text-muted-foreground">
              {error}
            </p>
          </>
        ) : !launch ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            {en("Signing you in…")}
          </p>
        ) : (
          <>
            <h1 className="mt-2 text-xl font-semibold">{en("Welcome to Edulexa")}</h1>
            {(launch.course || launch.assignment) && (
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />{en(" Course")}
                </p>
                {launch.course && <p className="mt-1 font-semibold">{launch.course}</p>}
                {launch.assignment && <p className="mt-0.5 text-sm text-muted-foreground">{en("Activity: {assignment}", { assignment: launch.assignment })}</p>}
              </div>
            )}
            {launch.classAssignment ? (
              <>
                <p className="mt-4 text-sm text-muted-foreground">
                  {faculty
                    ? en("This course assignment is linked to your class assessment in Edulexa. When you decide, the score and your comment go to the course's gradebook.")
                    : launch.matched
                      ? en("Your course's gradebook is connected. Your result goes there when your teacher decides. Open the assessment with your Edulexa account.")
                      : en("Your email in this course isn't on the class list in Edulexa, so your result can't reach the gradebook yet. Ask your teacher to check your email on the class list, then open this again from your course.")}
                </p>
                <Link
                  href={
                    faculty && launch.classAssessment
                      ? `/faculty/assessments/${launch.classAssessment}/classes/${launch.classAssignment}`
                      : `/student/assessments/${launch.classAssignment}`
                  }
                  className={`${buttonClass("primary")} mt-6 w-full`}
                  style={brandFill}
                >
                  {faculty ? en("Open the class") : en("Open the assessment")} <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm text-muted-foreground">
                  {faculty
                    ? en("You're signed in as teaching staff for this course.")
                    : launch.grades
                      ? en("Your result for this activity is sent back to your course's gradebook when it is graded.")
                      : en("You're signed in for this session through your course.")}
                </p>
                <Link
                  href={faculty ? "/institute/dashboard" : "/dashboard"}
                  className={`${buttonClass("primary")} mt-6 w-full`}
                  style={brandFill}
                >
                  {faculty ? en("Open the institute portal") : en("Continue")} <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
