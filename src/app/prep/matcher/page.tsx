"use client";

import React, { useState } from "react";
import { 
  FileText, Briefcase, Sparkles, CheckCircle2, 
  AlertCircle, ArrowRight, Zap, Target, Layers, 
  Code2, RefreshCw, BookmarkCheck, ChevronRight
} from "lucide-react";
import Link from "next/link";

interface TargetRolePreset {
  title: string;
  description: string;
}

const PRESET_ROLES: TargetRolePreset[] = [
  {
    title: "Staff Distributed Systems Engineer - Uber",
    description: "Architecting global real-time ride dispatching pipelines. Required skills: Distributed Systems, Go, Kafka, Raft Consensus, gRPC, Low-Latency concurrency."
  },
  {
    title: "Cloud Native Platform Architect - Netflix",
    description: "Designing multi-region auto-scaling microservices. Required skills: Kubernetes, Docker, Terraform, AWS, eBPF, Prometheus, CI/CD."
  },
  {
    title: "High-Frequency Algorithmic Engineer - Citadel",
    description: "Developing sub-millisecond execution order engines. Required skills: Low-Latency, C++, Rust, Concurrency, Memory Management, Database Sharding."
  }
];

export default function ResumeMatcherPrepPage() {
  const [resumeText, setResumeText] = useState(
    "Senior Full-Stack Engineer with 5+ years building backend systems using Python, TypeScript, Docker, PostgreSQL, Microservices, and Redis. Experienced in REST APIs and CI/CD pipelines."
  );
  const [selectedPreset, setSelectedPreset] = useState<TargetRolePreset>(PRESET_ROLES[0]);
  const [targetTitle, setTargetTitle] = useState(PRESET_ROLES[0].title);
  const [targetDescription, setTargetDescription] = useState(PRESET_ROLES[0].description);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelectPreset = (preset: TargetRolePreset) => {
    setSelectedPreset(preset);
    setTargetTitle(preset.title);
    setTargetDescription(preset.description);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setErrorMsg(null);
    setAnalysisResult(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/resume/analyze-and-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          targetJobTitle: targetTitle,
          targetJobDescription: targetDescription
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysisResult(data);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to analyze resume competencies.");
      }
    } catch (e: any) {
      setErrorMsg("Network error connecting to analysis engine: " + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans relative overflow-hidden">
      {/* Background Radial Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            <Sparkles className="w-4 h-4" />
            <span>Phase 17: Predictive Interview Prep & Skill Gap Engine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            AI Resume Tailoring & Prep Matcher
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Vectorize candidate competencies against target job descriptions to calculate match readiness and synthesize personalized gap-closing micro-internship sprints.
          </p>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Input Form (5 cols) */}
          <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
            <form onSubmit={handleAnalyze} className="space-y-5">
              {/* Target Role Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Target Hiring Benchmark Presets
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {PRESET_ROLES.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`text-left p-3 rounded-xl border text-xs transition flex items-center justify-between ${
                        targetTitle === preset.title
                          ? "bg-indigo-600/20 border-indigo-500 text-white font-medium"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                      }`}
                    >
                      <div className="truncate pr-2">{preset.title}</div>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Job Title & Description */}
              <div className="space-y-3">
                <div>
                  <label htmlFor="targetTitle" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Target Job Title
                  </label>
                  <input
                    id="targetTitle"
                    type="text"
                    value={targetTitle}
                    onChange={(e) => setTargetTitle(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label htmlFor="targetDescription" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Job Description & Required Stack
                  </label>
                  <textarea
                    id="targetDescription"
                    rows={3}
                    value={targetDescription}
                    onChange={(e) => setTargetDescription(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono resize-none focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Resume Text Area */}
              <div>
                <label htmlFor="resumeText" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Candidate Resume Profile</span>
                  <span className="text-slate-500 font-normal">Parsed Plaintext / Markdown</span>
                </label>
                <textarea
                  id="resumeText"
                  rows={5}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  required
                  placeholder="Paste candidate technical resume..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono resize-none focus:outline-none focus:border-indigo-500 transition leading-relaxed"
                />
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isAnalyzing}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3.5 px-6 rounded-xl transition duration-200 shadow-xl shadow-indigo-600/25 text-sm"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Extracting Competencies & Synthesizing Prep...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Synthesize Gap-Closing Micro-Internship
                  </>
                )}
              </button>
            </form>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Right Column: Predictive Match Results (6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            {analysisResult ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6 animate-in fade-in duration-300">
                {/* Score Header */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-5">
                  <div>
                    <div className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                      Role Match Readiness
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {targetTitle}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-400">
                      {analysisResult.matchScore}%
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">Competency Match</div>
                  </div>
                </div>

                {/* Skill Matrix Overlap */}
                <div className="space-y-4">
                  {/* Verified Skills */}
                  <div>
                    <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verified Resume Competencies ({analysisResult.matchedSkills.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResult.matchedSkills.map((s: string, idx: number) => (
                        <span key={idx} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Missing Gap Skills */}
                  <div>
                    <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-2">
                      <Target className="w-3.5 h-3.5" />
                      <span>Target Gap Skills to Defend ({analysisResult.missingSkills.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResult.missingSkills.map((s: string, idx: number) => (
                        <span key={idx} className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actionable Recommendations */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-mono text-indigo-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Personalized Architectural Roadmap</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {analysisResult.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-400 mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Synthesized Tailored Sprint Card */}
                {analysisResult.generatedSprint && (
                  <div className="p-5 rounded-2xl bg-indigo-950/30 border border-indigo-500/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase font-semibold">
                        Synthesized Micro-Internship
                      </span>
                      <span className="text-xs font-mono text-slate-400 uppercase">
                        Language: {analysisResult.generatedSprint.requiredLanguage}
                      </span>
                    </div>

                    <div>
                      <div className="text-sm font-bold text-white">
                        {analysisResult.generatedSprint.title}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {analysisResult.generatedSprint.description}
                      </p>
                    </div>

                    <Link
                      href={`/sprint/${analysisResult.generatedSprint.id}`}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-4 rounded-xl transition text-xs shadow-lg shadow-emerald-600/20"
                    >
                      <span>Launch Tailored Sprint Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              /* Idle Empty State */
              <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950 text-slate-600 border border-slate-800/80">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-300">No Active Analysis</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Select a target job benchmark and click "Synthesize Gap-Closing Micro-Internship" to vectorize competencies.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
