"use client";

import React, { useState } from "react";
import OpenAIRealtimeInterviewRoom from "@/components/OpenAIRealtimeInterviewRoom";
import Link from "next/link";
import { Building2, FileText, Briefcase, Sparkles, Send, Compass, Upload } from "lucide-react";

export default function Dashboard() {
  // H7b (owner decision 19 Oct 2026): the institute picker and the "Seed Institutes" panel are gone, with their calls
  // (GET /api/institute never existed; seeding is an admin task). This public page calls no institute endpoint.
  const [userId] = useState<string>("11111111-2222-3333-4444-555555555555");
  const [candidateName, setCandidateName] = useState<string>("Alex Morgan");
  const [jobDescription, setJobDescription] = useState<string>(
    "Senior Full-Stack Engineer requiring deep hands-on expertise in React Hooks, System Architecture, and AWS VPC networking configuration."
  );
  const [demoMode, setDemoMode] = useState<"Enterprise" | "University">("University");
  const [leadReferrals, setLeadReferrals] = useState<{ id?: string; status?: string; createdAt?: string }[]>([]);
  const [resumeText, setResumeText] = useState<string>(
    "Alex Morgan - Full-Stack Developer with 4 years experience in JavaScript, basic React, Node.js, and SQL."
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setResumeText(event.target.result as string);
      }
    };
    reader.readAsText(file);
  };

  const handleLeadReferralGenerated = (newReferrals: { id?: string; status?: string; createdAt?: string }[]) => {
    setLeadReferrals((prev) => [...newReferrals, ...prev]);
  };

  return (
    <div className="flex flex-col font-sans pb-16">
      {/* Top Navbar */}
      <header className="border-b border-border/80 bg-card/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/dashboard" className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 hover:scale-105 transition-transform">
              BD
            </Link>
            <div>
              <span className="font-bold text-lg bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
                BUILD & DEFEND
              </span>
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-500/30">
                EdTech Platform
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl border border-indigo-500 flex items-center space-x-1.5 transition-colors mr-2">
              <Compass className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>

            {/* Demo Mode Toggle */}
            <div className="flex items-center space-x-1 bg-card border border-border rounded-xl p-1 mr-4">
              <button
                onClick={() => setDemoMode("Enterprise")}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${demoMode === "Enterprise" ? "bg-indigo-500 text-white shadow" : "text-muted-foreground hover:text-white"}`}
              >
                Enterprise B2B
              </button>
              <button
                onClick={() => setDemoMode("University")}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${demoMode === "University" ? "bg-indigo-500 text-white shadow" : "text-muted-foreground hover:text-white"}`}
              >
                University
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 pt-8 flex-1 w-full space-y-8">
        {/* Banner Section */}
        {/* Banner Section */}
        {demoMode === "Enterprise" && (
          <div className="relative rounded-3xl p-8 overflow-hidden bg-gradient-to-r from-indigo-50 via-purple-50/40 to-slate-100 border border-indigo-200 dark:from-indigo-950 dark:via-slate-900 dark:to-purple-950 dark:border-indigo-500/20 shadow-2xl">
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-300 dark:border-indigo-500/20 text-indigo-800 dark:text-indigo-400 text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Voice Assessment & Opt-In Course Recommendations</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-3 leading-tight">
                Evaluate Tech Candidates & Help Them Close Skill Gaps
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When an AI voice interview reveals skill gaps, the candidate sees course recommendations. Partner-institute courses (e.g. Global ITech) are labeled as sponsored, as we may earn a referral fee, and the candidate&apos;s details are shared with a partner only if they opt in.
              </p>
            </div>
          </div>
        )}

        {/* 2-Column Workflow Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Candidate & Job Spec Setup */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-border">
                <FileText className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
                <h3 className="text-sm font-semibold text-foreground">1. Candidate Resume & Profile</h3>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Candidate Name</label>
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-muted-foreground">Parsed Resume Content</label>
                  <label className="cursor-pointer flex items-center space-x-1 text-[10px] text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:text-indigo-300 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 transition-colors">
                    <Upload className="w-3 h-3" />
                    <span>Upload Text File</span>
                    <input type="file" accept=".txt,.md,.json" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
                <textarea
                  rows={3}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl p-3 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-border">
                <Briefcase className="w-5 h-5 text-purple-700 dark:text-purple-400" />
                <h3 className="text-sm font-semibold text-foreground">2. Job Description & Technical Requirements</h3>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Job Description Specification</label>
                <textarea
                  rows={4}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl p-3 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Voice Room Simulator & Lead Marketplace */}
          <div className="lg:col-span-2 space-y-8">
            <OpenAIRealtimeInterviewRoom
              userId={userId}
              jobDescription={jobDescription}
              onLeadReferralGenerated={handleLeadReferralGenerated}
              personaCode="StartupCTO"
              dialectCode="UK_London_Financial"
            />

            {/* B2B Partner Institute Certification Marketplace */}
            {demoMode === "Enterprise" && (
              <div className="glass-panel rounded-2xl p-6 border border-border space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      B2B Partner Referrals (Candidate Opt-In)
                    </h3>
                    <p className="text-xs text-muted-foreground">Referrals from this session, after the candidate opts in</p>
                  </div>
                </div>

                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold">
                  {leadReferrals.length} Opted-In Referrals
                </span>
              </div>

              {/* Lead Referrals Table */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Opted-In Skill Gap Referrals
                </h4>
                <div className="bg-background/80 rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-left text-xs text-muted-foreground">
                    <thead className="bg-card text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Lead ID</th>
                        <th className="px-4 py-3">Candidate</th>
                        <th className="px-4 py-3">Institute</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {leadReferrals.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground italic">
                            No referrals yet. Referrals appear only when a candidate opts in to share their details with a partner institute.
                          </td>
                        </tr>
                      ) : (
                        leadReferrals.map((l) => (
                          <tr key={l.id} className="hover:bg-card/50 transition-colors">
                            <td className="px-4 py-3 font-mono text-[11px] text-indigo-700 dark:text-indigo-400">
                              {l.id ? l.id.substring(0, 8) + "..." : "REF-1092"}
                            </td>
                            <td className="px-4 py-3 font-medium text-white">{candidateName}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 font-medium">
                                Global ITech
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                <Send className="w-2.5 h-2.5 mr-1" />
                                {l.status || "Pending"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-[11px]">
                              {l.createdAt ? new Date(l.createdAt).toLocaleTimeString() : "Just now"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
