"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { authenticatedFetch } from "@/lib/apiClient";
import {
  Briefcase,
  Plus,
  Link as LinkIcon,
  Copy,
  Check,
  RefreshCw,
  Users,
  ShieldCheck,
  AlertTriangle,
  Code2,
  Terminal,
  ExternalLink,
  Sparkles,
  Lock,
} from "lucide-react";

interface CustomSprint {
  id: string;
  title: string;
  description: string;
  requiredLanguage: string;
  isPremium: boolean;
  isPrivate: boolean;
  companyId: string;
  inviteCode: string;
  candidateInviteUrl: string;
  totalSubmissions: number;
}

interface CandidateSubmission {
  id: string;
  sprintId: string;
  sprintTitle: string;
  userId: string;
  candidateName: string;
  candidateEmail: string;
  status: string;
  submittedAt: string;
  suspectedPasting: boolean;
  suspectedAi: boolean;
  verificationFlagged: boolean;
}

export default function RecruiterDashboardPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"sprints" | "submissions">("sprints");

  const [sprints, setSprints] = useState<CustomSprint[]>([]);
  const [submissions, setSubmissions] = useState<CandidateSubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Sprint Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [formTitle, setFormTitle] = useState<string>("");
  const [formDesc, setFormDesc] = useState<string>("");
  const [formLanguage, setFormLanguage] = useState<string>("Python");
  const [formPremium, setFormPremium] = useState<boolean>(false);
  const [createMessage, setCreateMessage] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Custom Sprints
      const sprintsRes = await authenticatedFetch("/api/recruiter/sprints", {}, getToken);
      if (sprintsRes.ok) {
        const sprintsData = await sprintsRes.json();
        setSprints(sprintsData || []);
      }

      // 2. Fetch Submissions with Anti-Cheat Flags
      const subsRes = await authenticatedFetch("/api/recruiter/submissions", {}, getToken);
      if (subsRes.ok) {
        const subsData = await subsRes.json();
        setSubmissions(subsData || []);
      }
    } catch (err) {
      console.error("Error loading recruiter data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopyInvite = (sprintId: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(sprintId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    setCreating(true);
    setCreateMessage("");

    try {
      const res = await authenticatedFetch(
        "/api/recruiter/sprints",
        {
          method: "POST",
          body: JSON.stringify({
            title: formTitle.trim(),
            description: formDesc.trim(),
            requiredLanguage: formLanguage,
            isPremium: formPremium,
          }),
        },
        getToken
      );

      if (res.ok) {
        setCreateMessage("Custom sprint and candidate invite link created successfully!");
        setFormTitle("");
        setFormDesc("");
        setShowCreateModal(false);
        fetchData();
      } else {
        const errData = await res.json();
        setCreateMessage("Error creating sprint: " + (errData.error || res.statusText));
      }
    } catch (err: any) {
      setCreateMessage("Failed to connect to API: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const flaggedCount = submissions.filter((s) => s.verificationFlagged).length;

  return (
    <div className="space-y-8">
      {/* Welcome Banner & Action */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Corporate Talent Engine</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 font-semibold border border-purple-500/20 flex items-center space-x-1">
              <Lock className="w-3 h-3 mr-0.5" />
              <span>Private Assessment Vault</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Build proprietary micro-internship coding sprints, generate unique candidate invite links, and audit live code submissions with automated anti-cheat detection.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start md:self-auto">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-purple-500/20 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Custom Sprint</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Custom Sprints</span>
            <Code2 className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{sprints.length}</p>
          <p className="text-[11px] text-purple-400 font-medium">Private assessments active</p>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Candidate Submissions</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{submissions.length}</p>
          <p className="text-[11px] text-indigo-400 font-medium">Total evaluated submissions</p>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Verified Authentic</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-400">
            {submissions.length - flaggedCount}
          </p>
          <p className="text-[11px] text-emerald-400/80 font-medium">Clean submission profile</p>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Anti-Cheat Flagged</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-amber-400">{flaggedCount}</p>
          <p className="text-[11px] text-amber-400/80 font-medium">Pasting or AI detected</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-8">
        <button
          onClick={() => setActiveTab("sprints")}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === "sprints"
              ? "text-purple-400 border-b-2 border-purple-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Custom Sprints & Invite Links ({sprints.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("submissions")}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === "submissions"
              ? "text-purple-400 border-b-2 border-purple-400"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Candidate Submissions & Anti-Cheat Audit ({submissions.length})</span>
        </button>
      </div>

      {/* Tab 1: Custom Sprints List */}
      {activeTab === "sprints" && (
        <div className="space-y-4">
          {sprints.length === 0 && !loading ? (
            <div className="glass-panel rounded-2xl p-12 border border-slate-800 text-center space-y-3">
              <Code2 className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-white">No Custom Sprints Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Create a private technical sprint to generate candidate invite links for your recruitment pipeline.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl"
              >
                Create First Custom Sprint
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sprints.map((sprint) => (
                <div key={sprint.id} className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold text-white">{sprint.title}</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                          Private
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{sprint.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-slate-300">
                    <span className="flex items-center space-x-1">
                      <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{sprint.requiredLanguage}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-purple-400" />
                      <span>{sprint.totalSubmissions} Candidate Submissions</span>
                    </span>
                  </div>

                  {/* Candidate Invite Link Box */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Candidate Invite URL
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={sprint.candidateInviteUrl}
                        className="w-full bg-slate-950 font-mono text-[11px] text-purple-300 px-3 py-2 rounded-xl border border-slate-800 focus:outline-none"
                      />
                      <button
                        onClick={() => handleCopyInvite(sprint.id, sprint.candidateInviteUrl)}
                        className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-xl border border-purple-500/30 flex items-center space-x-1.5 text-xs font-semibold transition-all cursor-pointer shrink-0"
                      >
                        {copiedId === sprint.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Candidate Submissions & Anti-Cheat Audit */}
      {activeTab === "submissions" && (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-3">Candidate</th>
                  <th className="px-6 py-3">Custom Sprint</th>
                  <th className="px-6 py-3">Submission Date</th>
                  <th className="px-6 py-3">Execution Status</th>
                  <th className="px-6 py-3">Anti-Cheat Audit Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Loading candidate submissions...
                    </td>
                  </tr>
                ) : submissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No candidate submissions recorded for custom sprints yet. Share candidate invite links to start assessments.
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{sub.candidateName}</div>
                        <div className="text-[11px] font-mono text-purple-300">{sub.candidateEmail}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-200">{sub.sprintTitle}</td>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(sub.submittedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          {sub.suspectedPasting && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>Paste Flagged (&gt;50 lines)</span>
                            </span>
                          )}

                          {sub.suspectedAi && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              <span>AI Boilerplate Flagged</span>
                            </span>
                          )}

                          {!sub.suspectedPasting && !sub.suspectedAi && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              <span>Verified Authentic</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Custom Sprint */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Create Custom Sprint</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {createMessage && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300">
                {createMessage}
              </div>
            )}

            <form onSubmit={handleCreateSprint} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Sprint Title</label>
                <input
                  type="text"
                  placeholder="e.g. Distributed Ledger Payment Pipeline Challenge"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Task Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe the engineering challenge candidates must implement and defend..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Language</label>
                  <select
                    value={formLanguage}
                    onChange={(e) => setFormLanguage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
                  >
                    <option value="Python">Python</option>
                    <option value="C#">C#</option>
                    <option value="TypeScript">TypeScript</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="isPremium"
                    checked={formPremium}
                    onChange={(e) => setFormPremium(e.target.checked)}
                    className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="isPremium" className="text-xs text-slate-300">
                    Pro Tier Required
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-purple-500/20"
                >
                  {creating ? "Creating..." : "Create & Generate Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
