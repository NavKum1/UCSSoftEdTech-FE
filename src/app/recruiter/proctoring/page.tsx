"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  ShieldCheck, ShieldAlert, Video, Eye,
  Search, ArrowRight
} from "lucide-react";

interface ProctoringSession {
  id: string;
  candidateName: string;
  candidateEmail: string;
  assessmentTitle: string;
  company: string;
  status: "FLAGGED" | "CLEAN" | "IN_REVIEW";
  riskScore: number;
  durationMinutes: number;
  recordedAt: string;
  violationsSummary: {
    critical: number;
    high: number;
    medium: number;
  };
  hasScreenRecording: boolean;
  hasWebcamRecording: boolean;
}

export default function RecruiterProctoringPortalPage() {
  const [filter, setFilter] = useState<"ALL" | "FLAGGED" | "CLEAN">("ALL");
  const [search, setSearch] = useState("");

  const sessions: ProctoringSession[] = [
    {
      id: "REC-UBER-7712",
      candidateName: "Jordan Vance",
      candidateEmail: "jordan.vance@example.com",
      assessmentTitle: "Senior Distributed Systems Engineer (Uber)",
      company: "Uber",
      status: "FLAGGED",
      riskScore: 88,
      durationMinutes: 45,
      recordedAt: "Today, 10:15 AM",
      violationsSummary: { critical: 1, high: 2, medium: 1 },
      hasScreenRecording: true,
      hasWebcamRecording: true
    },
    {
      id: "REC-STRIPE-4409",
      candidateName: "Elena Rostova",
      candidateEmail: "elena.r@example.com",
      assessmentTitle: "Staff Infrastructure Architect (Stripe)",
      company: "Stripe",
      status: "CLEAN",
      riskScore: 12,
      durationMinutes: 60,
      recordedAt: "Today, 08:30 AM",
      violationsSummary: { critical: 0, high: 0, medium: 0 },
      hasScreenRecording: true,
      hasWebcamRecording: true
    },
    {
      id: "REC-META-9921",
      candidateName: "Marcus Thorne",
      candidateEmail: "m.thorne@example.com",
      assessmentTitle: "L6 Production Engineer (Meta)",
      company: "Meta",
      status: "IN_REVIEW",
      riskScore: 45,
      durationMinutes: 52,
      recordedAt: "Yesterday, 04:20 PM",
      violationsSummary: { critical: 0, high: 1, medium: 2 },
      hasScreenRecording: true,
      hasWebcamRecording: true
    }
  ];

  const filtered = sessions.filter(s => {
    if (filter === "FLAGGED" && s.status !== "FLAGGED") return false;
    if (filter === "CLEAN" && s.status !== "CLEAN") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.candidateName.toLowerCase().includes(q) || s.candidateEmail.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase tracking-wider">
              Forensic Proctoring
            </span>
            <span className="text-xs text-muted-foreground">• Dual-Stream Video Audit</span>
          </div>
          <h1 className="text-2xl font-black text-foreground mt-1">
            Live AI Video Proctoring & Session Audit Vault
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Session recordings alongside logged browser and environment events (tab switches, focus loss, paste activity) for a human reviewer to assess. No gaze or face detection is performed.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            href="/recruiter/dashboard"
            className="px-3.5 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold border border-border transition-colors"
          >
            Candidate Sprints
          </Link>
          <Link
            href="/recruiter/benchmark"
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            AI Benchmarking
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Recordings Stored</span>
            <Video className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-foreground mt-1">1,482</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Encrypted AES-256 cloud vault</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Flagged for Human Review</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">14 Sessions</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Logged browser/environment events for a reviewer to look at</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Verified Clean Ratio</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">98.9%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">No integrity signals logged</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidate name, email, or session ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-background border border-border focus:outline-none focus:ring-1 focus:ring-purple-500 text-foreground"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filter === "ALL" ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All Sessions
          </button>
          <button
            onClick={() => setFilter("FLAGGED")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filter === "FLAGGED" ? "bg-rose-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Flagged Only
          </button>
          <button
            onClick={() => setFilter("CLEAN")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filter === "CLEAN" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Clean
          </button>
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {filtered.map((session) => (
          <div
            key={session.id}
            className="p-5 rounded-2xl bg-card border border-border hover:border-purple-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-muted-foreground">
                  {session.id}
                </span>
                <span className="font-bold text-foreground text-sm">
                  {session.candidateName}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  session.status === "FLAGGED"
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : session.status === "CLEAN"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                }`}>
                  {session.status} (Risk: {session.riskScore}%)
                </span>
              </div>

              <div className="text-xs text-muted-foreground">
                <span>{session.assessmentTitle}</span> • <span className="font-mono text-[11px]">{session.candidateEmail}</span>
              </div>

              <div className="flex items-center space-x-3 text-[11px] text-muted-foreground pt-1">
                <span>Duration: {session.durationMinutes}m</span>
                <span>•</span>
                <span>Recorded: {session.recordedAt}</span>
                <span>•</span>
                <span className="text-purple-600 dark:text-purple-400 font-medium">
                  {session.hasWebcamRecording && session.hasScreenRecording ? "Dual HD Stream (Webcam + Screen)" : "Single Stream"}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3 self-end md:self-center">
              <div className="text-right hidden sm:block">
                <span className="text-[10px] text-muted-foreground block">Anomaly Markers</span>
                <span className="font-mono text-xs font-bold text-foreground">
                  {session.violationsSummary.critical} Crit / {session.violationsSummary.high} High
                </span>
              </div>

              <Link
                href={`/recruiter/proctoring/video/${session.id}`}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Review Video Feed</span>
                <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
