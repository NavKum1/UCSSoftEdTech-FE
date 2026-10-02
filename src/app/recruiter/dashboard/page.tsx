"use client";

import React, { useState, useEffect } from "react";
import { 
  Briefcase, Users, ShieldAlert, ShieldCheck, Plus, 
  ExternalLink, Search, RefreshCw, KeyRound, Copy, Check,
  AlertTriangle, Sparkles, Filter, Code2
} from "lucide-react";

export default function RecruiterDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLanguage, setNewLanguage] = useState("python");
  const [newCompany, setNewCompany] = useState("Uber");
  const [newInviteCode, setNewInviteCode] = useState("");
  const [createStatus, setCreateStatus] = useState<string | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/recruiter/candidates?companyId=Uber`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("[RECRUITER DASHBOARD ERROR]:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateStatus("Creating private challenge...");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/recruiter/sprint/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          requiredLanguage: newLanguage,
          companyId: newCompany,
          inviteCode: newInviteCode || undefined,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setCreateStatus(`Created! Invite Code: ${created.inviteCode}`);
        setTimeout(() => {
          setShowCreateModal(false);
          setCreateStatus(null);
          setNewTitle("");
          setNewDescription("");
          setNewInviteCode("");
          fetchCandidates();
        }, 2000);
      } else {
        setCreateStatus("Failed to create challenge.");
      }
    } catch (e) {
      setCreateStatus("Network error occurred.");
    }
  };

  const handleCopyInvite = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const candidates = data?.candidates || [
    {
      submissionId: "sub-demo-1",
      candidateName: "Sarah Chen",
      candidateEmail: "sarah.chen@example.com",
      sprintTitle: "Uber Rideshare Geohash Routing Engine Challenge",
      status: "Completed",
      antiCheat: {
        verificationFlagged: false,
        suspectedAi: false,
        suspectedPasting: false,
        flagReason: null,
      },
      evaluation: {
        finalScore: 92.0,
        publicUrlSlug: "cred-sarah-chen-9921",
      },
    },
    {
      submissionId: "sub-demo-2",
      candidateName: "Devon Miller",
      candidateEmail: "devon.m@example.com",
      sprintTitle: "Uber Rideshare Geohash Routing Engine Challenge",
      status: "Completed",
      antiCheat: {
        verificationFlagged: true,
        suspectedAi: true,
        suspectedPasting: true,
        flagReason: "Generative AI conversational watermark and rapid paste velocity detected.",
      },
      evaluation: {
        finalScore: 84.5,
        publicUrlSlug: "cred-devon-miller-4412",
      },
    },
  ];

  const totalApplicants = data?.totalApplicants ?? candidates.length;
  const flaggedCount = data?.flaggedCount ?? candidates.filter((c: any) => c.antiCheat.verificationFlagged).length;
  const cleanCount = totalApplicants - flaggedCount;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Corporate Recruiter Portal</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  UBER HIRING PIPELINE
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-white mt-0.5">
                Candidate Technical Assessment &amp; Integrity Review
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Private Challenge</span>
            </button>

            <button
              onClick={fetchCandidates}
              className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Pipeline</span>
            </button>
          </div>
        </div>

        {/* Live KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="glass-card rounded-2xl p-5 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total Applicants</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-extrabold text-white mt-2">{totalApplicants}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">Completed voice defense review</span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Verified Clean Submissions</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-2">{cleanCount}</div>
            <span className="text-[11px] text-emerald-500/80 mt-1 block">Passed all integrity checks</span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Submissions Under Review</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-amber-400 mt-2">{flaggedCount}</div>
            <span className="text-[11px] text-amber-500/80 mt-1 block">Requires manual review</span>
          </div>
        </div>

        {/* Candidate Applicant Review Table */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Corporate Applicant Pipeline</h2>
              <p className="text-xs text-slate-400">Review candidate assessment scores, project work, and integrity status.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Corporate Challenge</th>
                  <th className="py-3 px-4">Defense Score</th>
                  <th className="py-3 px-4">Anti-Cheat Audit</th>
                  <th className="py-3 px-4 text-right">Verifiable Badge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {candidates.map((cand: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{cand.candidateName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{cand.candidateEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                      {cand.sprintTitle}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-indigo-400">
                      {cand.evaluation?.finalScore ? `${cand.evaluation.finalScore}%` : "Pending"}
                    </td>
                    <td className="py-3.5 px-4">
                      {cand.antiCheat?.verificationFlagged ? (
                        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Flagged (AI / Bulk Paste)</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verified Clean</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {cand.evaluation?.publicUrlSlug ? (
                        <a
                          href={`/credential/${cand.evaluation.publicUrlSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          <span>View Seal</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-600">No Credential</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Corporate Challenge Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl p-6 max-w-md w-full border border-indigo-500/30 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <span>Create Corporate Challenge</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateChallenge} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Company / Team Name</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="e.g. Uber"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Challenge Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Real-Time Geospatial Driver Dispatcher"
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Language</label>
                <select
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="python">Python</option>
                  <option value="csharp">C# (.NET)</option>
                  <option value="typescript">TypeScript</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Technical Problem Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe technical constraints, architecture expectations, and defense criteria..."
                  rows={3}
                  required
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Custom Invite Code (Optional)</label>
                <input
                  type="text"
                  value={newInviteCode}
                  onChange={(e) => setNewInviteCode(e.target.value)}
                  placeholder="e.g. UBER-GEO-2026 (Auto-generated if blank)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {createStatus && (
                <div className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/30">
                  {createStatus}
                </div>
              )}

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 font-medium text-xs border border-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-indigo-600/25"
                >
                  Create & Launch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
