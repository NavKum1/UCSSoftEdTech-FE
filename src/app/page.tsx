"use client";

import React, { useState, useEffect } from "react";
import VapiInterviewRoom from "@/components/VapiInterviewRoom";
import {
  ShieldAlert,
  Building2,
  FileText,
  Briefcase,
  Users,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Database,
  ArrowRight,
  Send,
} from "lucide-react";

export default function Dashboard() {
  const [userId, setUserId] = useState<string>("11111111-2222-3333-4444-555555555555");
  const [candidateName, setCandidateName] = useState<string>("Alex Morgan");
  const [jobDescription, setJobDescription] = useState<string>(
    "Senior Full-Stack Engineer requiring deep hands-on expertise in React Hooks, System Architecture, and AWS VPC networking configuration."
  );
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [tenantCourses, setTenantCourses] = useState<any[]>([]);
  const [leadReferrals, setLeadReferrals] = useState<any[]>([]);
  const [resumeText, setResumeText] = useState<string>(
    "Alex Morgan - Full-Stack Developer with 4 years experience in JavaScript, basic React, Node.js, and SQL."
  );
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  const fetchTenantDetails = async (tenantId: string) => {
    try {
      const headers: Record<string, string> = {};
      if (tenantId) {
        headers["X-Institute-Id"] = tenantId;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/institute`, { headers });
      const data = await res.json();
      if (res.ok) {
        setInstitutes(data.institutes || []);
        setTenantCourses(data.courses || []);
        setLeadReferrals(data.leadReferrals || []);
      }
    } catch (err) {
      console.log("Error fetching institute details.");
    }
  };

  useEffect(() => {
    fetchTenantDetails(selectedTenantId);
  }, [selectedTenantId]);

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/institute/seed`, { method: "POST" });
      await fetchTenantDetails(selectedTenantId);
    } catch (err) {
      console.log("Error seeding database.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleLeadReferralGenerated = (newReferrals: any[]) => {
    setLeadReferrals((prev) => [...newReferrals, ...prev]);
    fetchTenantDetails(selectedTenantId);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              BD
            </div>
            <div>
              <span className="font-bold text-lg bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                BUILD & DEFEND
              </span>
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                EdTech Platform
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Multi-Tenant Institute Switcher */}
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span className="text-xs text-slate-400 font-medium">B2B Tenant Context:</span>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-white">
                  🌐 All Partner Institutes (Platform View)
                </option>
                {institutes.map((inst) => (
                  <option key={inst.id} value={inst.id} className="bg-slate-900 text-white">
                    🏢 {inst.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSeedData}
              disabled={isSeeding}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 flex items-center space-x-1.5 transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isSeeding ? "Seeding DB..." : "Seed Institutes"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 pt-8 flex-1 w-full space-y-8">
        {/* Banner Section */}
        <div className="relative rounded-3xl p-8 overflow-hidden bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-indigo-500/20 shadow-2xl">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Voice Assessment & Lead Routing Engine</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3 leading-tight">
              Evaluate Tech Candidates & Bridge Skill Gaps with Partner Certifications
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              When a candidate fails a technical evaluation during their AI voice interview, our system automatically routes them to partner institutes (e.g. Global ITech) for targeted certification courses.
            </p>
          </div>
        </div>

        {/* 2-Column Workflow Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Candidate & Job Spec Setup */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">1. Candidate Resume & Profile</h3>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Candidate Name</label>
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Parsed Resume Content</label>
                <textarea
                  rows={3}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
                <Briefcase className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">2. Job Description & Technical Requirements</h3>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Job Description Specification</label>
                <textarea
                  rows={4}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Voice Room Simulator & Lead Marketplace */}
          <div className="lg:col-span-2 space-y-8">
            <VapiInterviewRoom
              userId={userId}
              jobDescription={jobDescription}
              selectedTenantId={selectedTenantId}
              onLeadReferralGenerated={handleLeadReferralGenerated}
            />

            {/* B2B Partner Institute Certification Marketplace */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      B2B Partner Lead Referrals & Certification Marketplace
                    </h3>
                    <p className="text-xs text-slate-400">
                      {selectedTenantId
                        ? "Filtered view (EF Core Global Query Filter applied for tenant)"
                        : "Global view across all partner institutes"}
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold">
                  {leadReferrals.length} Active Lead Referrals
                </span>
              </div>

              {/* Mapped Courses */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Partner Certification Courses
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tenantCourses.length === 0 ? (
                    <div className="col-span-2 p-4 bg-slate-900/50 rounded-xl text-xs text-slate-500 italic text-center">
                      No courses mapped yet. Click "Seed Institutes" to populate Global ITech.
                    </div>
                  ) : (
                    tenantCourses.map((c) => (
                      <div key={c.id} className="glass-card rounded-xl p-4 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-400">{c.courseName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            Partner Course
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2">{c.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Lead Referrals Table */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Generated Skill Gap Lead Referrals
                </h4>
                <div className="bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
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
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">
                            No lead referrals generated yet. Complete an interview call to trigger lead routing.
                          </td>
                        </tr>
                      ) : (
                        leadReferrals.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="px-4 py-3 font-mono text-[11px] text-indigo-400">
                              {l.id ? l.id.substring(0, 8) + "..." : "REF-1092"}
                            </td>
                            <td className="px-4 py-3 font-medium text-white">{candidateName}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium">
                                Global ITech
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                <Send className="w-2.5 h-2.5 mr-1" />
                                {l.status || "Pending"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-[11px]">
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
          </div>
        </div>
      </main>
    </div>
  );
}
