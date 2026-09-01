"use client";

import React, { useState, useEffect } from "react";
import VapiInterviewRoom from "@/components/VapiInterviewRoom";
import { useParams, useRouter } from "next/navigation";
import { useAuth, UserButton } from "@clerk/nextjs";
import { authenticatedFetch } from "@/lib/apiClient";
import {
  Code,
  Play,
  CheckCircle2,
  AlertTriangle,
  Award,
  Sparkles,
  ArrowRight,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Building2,
  Lock,
} from "lucide-react";

export default function SprintWorkspace() {
  const params = useParams();
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const sprintId = (params?.id as string) || "demo-sprint-id";

  const [codePayload, setCodePayload] = useState<string>(
    `def main():\n    # Payment queue processor with hardcoded SQL insertion\n    amount = 250.00\n    query = f"INSERT INTO Payments (Amount) VALUES ({amount})"\n    print("[EXECUTION]: Processing payment record...")\n    print(f"[EXECUTION]: Executed query: {query}")\n    print("[SUCCESS]: Payment processed successfully.")\n\nif __name__ == '__main__':\n    main()`
  );
  const [submissionId, setSubmissionId] = useState<string>("");
  const [pipelineState, setPipelineState] = useState<"editor" | "submitting" | "running" | "completed" | "voice_interview" | "passed">("editor");
  const [stdOutLogs, setStdOutLogs] = useState<string>("");
  const [architecturalFlaws, setArchitecturalFlaws] = useState<string[]>([]);
  const [publicUrlSlug, setPublicUrlSlug] = useState<string>("");
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Phase 11: Anti-Cheat & Plagiarism Detection — Paste Tracker State
  const [suspectedPasting, setSuspectedPasting] = useState<boolean>(false);
  const [pasteWarning, setPasteWarning] = useState<string | null>(null);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (pastedText) {
      const lineCount = pastedText.split(/\r\n|\r|\n/).length;
      if (lineCount > 50) {
        setSuspectedPasting(true);
        setPasteWarning(
          `Anti-Cheat Alert: Large block paste detected (${lineCount} lines). This submission will be marked with SuspectedPasting = true for audit verification.`
        );
      }
    }
  };

  // Step 1: Submit Code to .NET Core API using Authenticated JWT Fetch
  const handleSubmitCode = async () => {
    setPipelineState("submitting");
    setStatusMessage("Submitting code payload to local .NET API (POST /api/sprint/submit with Clerk Bearer JWT)...");

    try {
      const res = await authenticatedFetch(
        "/api/sprint/submit",
        {
          method: "POST",
          body: JSON.stringify({
            sprintId: sprintId,
            codePayload: codePayload,
            suspectedPasting: suspectedPasting,
          }),
        },
        getToken
      );

      const data = await res.json();
      if ((res.status === 202 || res.status === 200) && data.submissionId) {
        setSubmissionId(data.submissionId);
        setPipelineState("running");
        setStatusMessage("HTTP 202 Accepted! Piston API MicroVM Sandbox running in background worker...");
        startPollingStatus(data.submissionId);
      } else {
        setStatusMessage("Submission failed: " + (data.error || res.statusText));
        setPipelineState("editor");
      }
    } catch (err: any) {
      setStatusMessage("Error connecting to .NET API: " + err.message);
      setPipelineState("editor");
    }
  };

  // Step 2: Poll status until 'Completed'
  const startPollingStatus = (subId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await authenticatedFetch(`/api/sprint/submission/${subId}`, {}, getToken);
        const data = await res.json();

        if (data.status === "Completed") {
          clearInterval(interval);
          setStdOutLogs(data.stdOutLogs || "");
          
          try {
            const review = JSON.parse(data.architecturalReview || "{}");
            setArchitecturalFlaws(review.flaws || []);
          } catch (e) {
            setArchitecturalFlaws(["Did not use connection pooling", "Hardcoded SQL query execution"]);
          }

          setPipelineState("completed");
          setStatusMessage("Piston API execution & GPT-4o static analysis COMPLETE! Preparing Voice Interview...");

          setTimeout(() => {
            setPipelineState("voice_interview");
          }, 2500);
        }
      } catch (err) {
        console.log("Polling submission status...");
      }
    }, 1000);
  };

  const handleLeadOrCredentialGenerated = (data: any) => {
    if (data && data.publicUrlSlug) {
      setPublicUrlSlug(data.publicUrlSlug);
      setPipelineState("passed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push("/")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              BD
            </div>
            <div>
              <span className="font-bold text-lg text-white">BUILD & DEFEND</span>
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                JWT Auth Secured
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-medium">
              Sprint ID: {sprintId.substring(0, 8)}
            </span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Main Split-Pane Workspace */}
      <main className="max-w-7xl mx-auto px-6 pt-8 flex-1 w-full space-y-6">
        {/* Pipeline Progress Bar */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold">
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "editor" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>
              1. Code Submission
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "running" || pipelineState === "completed" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>
              2. Piston API Sandbox
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "voice_interview" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>
              3. Voice AI Defense Review
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "passed" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"}`}>
              4. Public Credential Badge
            </span>
          </div>

          <div className="flex items-center space-x-1 text-[11px] text-indigo-400 font-mono">
            <Lock className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            <span>Clerk JWT Bearer Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Pane: Code Editor */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Micro-Internship Code Submission</h3>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-semibold border border-indigo-500/20">
                Language: Python
              </span>
            </div>

            <p className="text-xs text-slate-300">
              Task: Implement payment queue processing. Write your Python implementation below:
            </p>

            {pasteWarning && (
              <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl flex items-start space-x-2 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{pasteWarning}</span>
              </div>
            )}

            <textarea
              rows={12}
              value={codePayload}
              onChange={(e) => setCodePayload(e.target.value)}
              onPaste={handlePaste}
              disabled={pipelineState !== "editor"}
              className="w-full bg-slate-950 font-mono text-xs text-slate-200 p-4 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500 leading-relaxed"
            />

            <button
              onClick={handleSubmitCode}
              disabled={pipelineState !== "editor"}
              className={`py-3 px-4 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                pipelineState === "editor"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Play className="w-4 h-4" />
              <span>{pipelineState === "submitting" ? "Submitting via JWT Bearer..." : "Submit Code (Authenticated)"}</span>
            </button>
          </div>

          {/* Right Pane: Execution Output & Voice Defense Room */}
          <div className="space-y-6">
            {/* Terminal Console Output */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Live Piston API Output</h3>
                </div>
                {pipelineState === "running" && <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />}
              </div>

              <div className="bg-slate-950 p-4 rounded-xl font-mono text-[11px] text-emerald-400 h-36 overflow-y-auto border border-slate-900 leading-relaxed whitespace-pre-wrap">
                {stdOutLogs || statusMessage || "Awaiting submission..."}
              </div>

              {architecturalFlaws.length > 0 && (
                <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl space-y-1">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span>Identified Flaws (Passed to Voice AI):</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-red-200 space-y-0.5 pl-2">
                    {architecturalFlaws.map((flaw, idx) => (
                      <li key={idx}>{flaw}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Voice Defense Simulator Component */}
            {pipelineState === "voice_interview" || pipelineState === "completed" || pipelineState === "passed" ? (
              <VapiInterviewRoom
                userId="33333333-4444-5555-6666-777777777777"
                jobDescription="Build & Defend Sprint Review"
                selectedTenantId={selectedTenantId}
                onLeadReferralGenerated={handleLeadOrCredentialGenerated}
              />
            ) : null}

            {/* Public Credential Badge Issuer Section */}
            {pipelineState === "passed" && (
              <div className="glass-panel rounded-2xl p-6 border border-emerald-500/40 bg-emerald-950/20 text-center space-y-4">
                <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">Congratulations! Credential Issued</h3>
                <p className="text-xs text-slate-300">
                  You successfully defended your design. Your verifiable credential has been minted.
                </p>
                <button
                  onClick={() => router.push(`/credential/${publicUrlSlug || "cred-demo"}`)}
                  className="py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-emerald-500/25 inline-flex items-center space-x-2 cursor-pointer transition-all"
                >
                  <Award className="w-4 h-4" />
                  <span>View Public Verifiable Credential</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
