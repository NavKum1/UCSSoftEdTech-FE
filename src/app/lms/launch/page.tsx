"use client";

import React, { useState, useEffect } from "react";
import { 
  GraduationCap, CheckCircle2, ArrowRight, ShieldCheck, 
  Sparkles, BookOpen, Layers, Award, ExternalLink,
  Laptop, RefreshCw
} from "lucide-react";
import Link from "next/link";

export default function LmsLaunchTransitionPage() {
  const [loading, setLoading] = useState(true);
  const [courseInfo, setCourseInfo] = useState({
    courseTitle: "CS 401: Distributed Cloud Architecture",
    courseId: "STANFORD-CS401",
    assignmentTitle: "Distributed Stream Worker & Resilient Consensus",
    studentName: "Elena Rostova",
    lmsPlatform: "Canvas LMS (Instructure)",
    proTierGranted: true,
  });

  useEffect(() => {
    // Simulated load and query param extraction
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-xl w-full relative z-10 space-y-6">
        {/* LMS Badge & Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            <GraduationCap className="w-4 h-4" />
            <span>1EdTech LTI 1.3 Advantage Certified Launch</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Welcome to Build & Defend
          </h1>
          <p className="text-sm text-slate-400">
            Authenticated via <span className="text-slate-200 font-semibold">{courseInfo.lmsPlatform}</span> single sign-on.
          </p>
        </div>

        {/* Main Enrollment Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <div className="text-xs text-slate-400">Connecting to university gradebook & verifying enrollment...</div>
            </div>
          ) : (
            <>
              {/* Course Context Details */}
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-semibold flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Course & Assignment Context</span>
                  </div>
                  <div className="text-base font-bold text-white">
                    {courseInfo.courseTitle}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span className="font-mono text-slate-400">Assignment:</span>
                    <span className="text-emerald-400 font-medium">{courseInfo.assignmentTitle}</span>
                  </div>
                </div>

                {/* Academic License Perks Banner */}
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                    <Sparkles className="w-4 h-4" />
                    <span>Academic Pro Tier License Active</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Your university enrollment unlocks full access to polyglot compiler runtimes, AI voice defense evaluations, and verified credentials at zero cost.
                  </p>
                </div>

                {/* Gradebook Sync Protocol Info */}
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-200 font-medium">Automatic Gradebook Synchronization:</span> Upon completing your technical defense review, your score and verification badge will be synced directly back to your Canvas / Blackboard gradebook.
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <Link
                  href="/dashboard"
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium py-3.5 px-6 rounded-xl transition duration-200 shadow-xl shadow-indigo-600/25 text-sm"
                >
                  <span>Launch Sprint Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <div className="text-center">
                  <Link
                    href="/institute/dashboard"
                    className="text-xs text-slate-400 hover:text-slate-400 inline-flex items-center gap-1 transition"
                  >
                    <span>Are you an instructor or teaching assistant? Open Instructor Analytics</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 font-mono">
          IMS Global / 1EdTech LTI 1.3 Core & Assignment Grade Services (AGS) v2.0
        </div>
      </div>
    </div>
  );
}
