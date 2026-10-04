"use client";

import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import VapiInterviewRoom from "@/components/VapiInterviewRoom";
import ProctoringHUD from "./components/ProctoringHUD";
import { useParams, useRouter } from "next/navigation";
import { useAuth, UserButton, useUser } from "@clerk/nextjs";
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
import I18nProvider from "@/components/I18nProvider";
import { useTranslations } from "next-intl";

function SprintWorkspaceInner() {
  const params = useParams();
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const sprintId = (params?.id as string) || "demo-sprint-id";
  const t = useTranslations("SprintHUD");

  const [candidateTrack, setCandidateTrack] = useState<"Backend" | "Frontend">("Backend");
  const [difficultyTier, setDifficultyTier] = useState<"Bronze (Junior)" | "Diamond (Staff)">("Diamond (Staff)");
  const [language, setLanguage] = useState<string>("Python");
  const [taskDescription, setTaskDescription] = useState<string>("Task (Diamond Backend): Implement an idempotent payment queue processor capable of handling 10k messages/sec without deadlocks.");

  const [codePayload, setCodePayload] = useState<string>("");
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
  const [totalPastedLines, setTotalPastedLines] = useState<number>(0);

  // Phase 10: Offline Resilience (Service Workers & Local Storage)
  const [isOffline, setIsOffline] = useState<boolean>(false);

  useEffect(() => {
    if (candidateTrack === "Backend") {
      if (language === "React / TSX") setLanguage("Python"); // reset if leftover from frontend
      
      if (difficultyTier === "Diamond (Staff)") {
        setTaskDescription("Task (Diamond Backend): Implement an idempotent payment queue processor capable of handling 10k messages/sec without deadlocks.");
        
        if (language === "Python") {
            setCodePayload(`def main():\n    # Staff-level payment queue processor\n    pass\n\nif __name__ == '__main__':\n    main()`);
        } else if (language === "C#") {
            setCodePayload(`using System;\n\npublic class PaymentProcessor {\n    public void ProcessQueue() {\n        // Staff-level payment queue processor\n    }\n}`);
        } else if (language === "Go") {
            setCodePayload(`package main\n\nimport "fmt"\n\nfunc main() {\n    // Staff-level payment queue processor\n    fmt.Println("Processing...")\n}`);
        } else if (language === "Java") {
            setCodePayload(`public class Main {\n    public static void main(String[] args) {\n        // Staff-level payment queue processor\n    }\n}`);
        } else if (language === "C++") {
            setCodePayload(`#include <iostream>\n\nint main() {\n    // Staff-level payment queue processor\n    return 0;\n}`);
        } else if (language === "Rust") {
            setCodePayload(`fn main() {\n    // Staff-level payment queue processor\n}`);
        } else {
            setCodePayload(`// Implement in ${language}`);
        }
      } else {
        setTaskDescription("Task (Bronze Backend): Fix the SQL syntax error and SQL injection vulnerability in this basic payment script.");
        if (language === "Python") {
            setCodePayload(`def main():\n    # Basic SQL fix\n    amount = 250.00\n    # TODO: Fix the SQL injection vulnerability below\n    query = f"INSERT INTO Payments (Amount) VALUES ({amount})"\n    print("Processing...")\n\nif __name__ == '__main__':\n    main()`);
        } else if (language === "C#") {
            setCodePayload(`using System;\n\npublic class PaymentProcessor {\n    public void ProcessQueue() {\n        string amount = "250.00";\n        // TODO: Fix injection\n        string query = $"INSERT INTO Payments (Amount) VALUES ({amount})";\n    }\n}`);
        } else if (language === "Go") {
            setCodePayload(`package main\n\nimport "fmt"\n\nfunc main() {\n    amount := "250.00"\n    // TODO: Fix injection\n    query := fmt.Sprintf("INSERT INTO Payments (Amount) VALUES (%s)", amount)\n}`);
        } else if (language === "Java") {
            setCodePayload(`public class Main {\n    public static void main(String[] args) {\n        String amount = "250.00";\n        // TODO: Fix injection\n        String query = "INSERT INTO Payments (Amount) VALUES (" + amount + ")";\n    }\n}`);
        } else if (language === "C++") {
            setCodePayload(`#include <iostream>\n#include <string>\n\nint main() {\n    std::string amount = "250.00";\n    // TODO: Fix injection\n    std::string query = "INSERT INTO Payments (Amount) VALUES (" + amount + ")";\n    return 0;\n}`);
        } else if (language === "Rust") {
            setCodePayload(`fn main() {\n    let amount = "250.00";\n    // TODO: Fix injection\n    let query = format!("INSERT INTO Payments (Amount) VALUES ({})", amount);\n}`);
        } else {
            setCodePayload(`// Implement in ${language}`);
        }
      }
    } else if (candidateTrack === "Frontend") {
      setLanguage("React / TSX"); // Lock frontend to React for this demo
      if (difficultyTier === "Diamond (Staff)") {
        setTaskDescription("Task (Diamond Frontend): Implement a custom React reconciler and virtualization engine for a high-frequency trading canvas chart.");
        setCodePayload(`import React from 'react';\n\nexport default function TradingChart() {\n  // Implement high-frequency rendering logic (avoiding DOM repaints)\n  return <div>Trading Chart</div>;\n}`);
      } else {
        setTaskDescription("Task (Bronze Frontend): Create a responsive button component with hover states using Tailwind CSS.");
        setCodePayload(`import React from 'react';\n\nexport default function Button() {\n  return <button>Click Me</button>;\n}`);
      }
    }
  }, [candidateTrack, difficultyTier, language]);

  useEffect(() => {
    // Check initial online status
    setIsOffline(!navigator.onLine);

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      setStatusMessage("Connection restored! Your code is safely synced.");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // Load any offline draft if it exists for this sprint
    const draft = localStorage.getItem(`sprint_draft_${sprintId}`);
    if (draft) setCodePayload(draft);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [sprintId]);

  // Persist code changes to local storage for offline resilience
  useEffect(() => {
    if (codePayload) {
      localStorage.setItem(`sprint_draft_${sprintId}`, codePayload);
    }
  }, [codePayload, sprintId]);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (pastedText) {
      const lineCount = pastedText.split(/\r\n|\r|\n/).length;
      const newTotal = totalPastedLines + lineCount;
      setTotalPastedLines(newTotal);
      
      if (newTotal > 50) {
        setSuspectedPasting(true);
        setPasteWarning(
          `Notice: Large code paste detected (${newTotal} lines total). Be prepared to discuss and explain your implementation during the review.`
        );
      }
    }
  };

  // Step 1: Submit Code to API
  const handleSubmitCode = async () => {
    setPipelineState("submitting");
    setStatusMessage("Submitting your solution for automated testing...");

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
        setStatusMessage("Running test cases in a secure sandbox...");
        startPollingStatus(data.submissionId);
      } else {
        setStatusMessage("Submission failed: " + (data.error || res.statusText));
        setPipelineState("editor");
      }
    } catch (err: any) {
      setStatusMessage("Error connecting to server: " + err.message);
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
            setArchitecturalFlaws(["Database query optimization", "Resource connection management"]);
          }

          setPipelineState("completed");
          setStatusMessage("Code analysis complete! Preparing your interactive review session...");

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

  const getMonacoLanguage = () => {
    switch(language) {
      case "Python": return "python";
      case "C#": return "csharp";
      case "Java": return "java";
      case "C++": return "cpp";
      case "Go": return "go";
      case "Rust": return "rust";
      case "React / TSX": return "typescript";
      default: return "python";
    }
  };

  return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans pb-16">
        {/* Navbar */}
        <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
          {isOffline && (
            <div className="w-full bg-amber-500/10 text-amber-400 text-center text-xs py-1.5 font-semibold border-b border-amber-500/20">
              No internet connection. Your work is being saved locally.
            </div>
          )}
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push("/")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              BD
            </div>
            <div>
              <span className="font-bold text-lg text-white">BUILD & DEFEND</span>
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                Verified & Secure
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden lg:flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
              <select value={candidateTrack} onChange={(e) => setCandidateTrack(e.target.value as any)} className="bg-transparent text-xs text-indigo-300 font-semibold focus:outline-none cursor-pointer">
                <option value="Backend">Backend Track</option>
                <option value="Frontend">Frontend Track</option>
              </select>
              <span className="text-slate-700">|</span>
              <select value={difficultyTier} onChange={(e) => setDifficultyTier(e.target.value as any)} className="bg-transparent text-xs text-emerald-400 font-semibold focus:outline-none cursor-pointer">
                <option value="Bronze (Junior)">Bronze League (Junior)</option>
                <option value="Diamond (Staff)">Diamond League (Staff)</option>
              </select>
              <span className="text-slate-700">|</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={candidateTrack === "Frontend"} className="bg-transparent text-xs text-purple-400 font-semibold focus:outline-none cursor-pointer disabled:opacity-50">
                <option value="Python">Python</option>
                <option value="C#">C#</option>
                <option value="Java">Java</option>
                <option value="C++">C++</option>
                <option value="Go">Go</option>
                <option value="Rust">Rust</option>
                <option value="React / TSX">React / TSX</option>
              </select>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-medium">
              Challenge ID: {sprintId.substring(0, 8)}
            </span>
            <UserButton />
          </div>
        </div>
      </header>

      {/* Main Split-Pane Workspace */}
      <main className="max-w-7xl mx-auto px-6 pt-8 flex-1 w-full space-y-6">
        <ProctoringHUD sessionId={submissionId || sprintId} />

        {/* Pipeline Progress Bar */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold">
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "editor" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>
              1. Code Submission
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "running" || pipelineState === "completed" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>
              2. Automated Test Runner
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "voice_interview" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>
              3. Interactive Code Review
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "passed" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"}`}>
              4. Verified Certificate
            </span>
          </div>

          <div className="flex items-center space-x-1 text-[11px] text-indigo-400 font-mono">
            <Lock className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            <span>Session Authenticated</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Pane: Code Editor */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">{t("codeEditor")}</h3>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-semibold border border-indigo-500/20">
                Language: {language}
              </span>
            </div>

            <p className="text-xs text-slate-300 font-medium bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 leading-relaxed shadow-inner">
              {taskDescription}
            </p>

            {pasteWarning && (
              <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl flex items-start space-x-2 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{pasteWarning}</span>
              </div>
            )}

            <div className="border border-slate-800 rounded-xl overflow-hidden mt-2 bg-slate-950" onPaste={handlePaste}>
              <Editor
                height="350px"
                language={getMonacoLanguage()}
                theme="vs-dark"
                value={codePayload}
                onChange={(val) => setCodePayload(val || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "var(--font-geist-mono), monospace",
                  padding: { top: 16 },
                  readOnly: pipelineState !== "editor"
                }}
              />
            </div>

            <button
              onClick={handleSubmitCode}
              disabled={pipelineState !== "editor" || isOffline}
              className={`py-3 px-4 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                (pipelineState === "editor" && !isOffline)
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-slate-800 text-slate-400 cursor-not-allowed"
              }`}
            >
              <Play className="w-4 h-4" />
              <span>
                {isOffline 
                  ? "Offline (Code Saved)" 
                  : pipelineState === "submitting" 
                  ? t("submitting") 
                  : t("submitSprint")}
              </span>
            </button>
          </div>

          {/* Right Pane: Execution Output & Voice Defense Room */}
          <div className="space-y-6">
            {/* Terminal Console Output */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Execution Output & Test Results</h3>
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
                    <span>Review Topics for Discussion:</span>
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
                userId={user?.id || "anonymous-user"}
                jobDescription="Build & Defend Sprint Review"
                selectedTenantId={selectedTenantId || "default-tenant"}
                onLeadReferralGenerated={handleLeadOrCredentialGenerated}
                personaCode="StaffArchitectFAANG"
                dialectCode="US_WestCoast_Tech"
              />
            ) : null}

            {/* Public Credential Badge Issuer Section */}
            {pipelineState === "passed" && (
              <div className="glass-panel rounded-2xl p-6 border border-emerald-500/40 bg-emerald-950/20 text-center space-y-4">
                <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">Congratulations! Certificate Issued</h3>
                <p className="text-xs text-slate-400">
                  You successfully defended your implementation. Your verified certificate has been issued.
                </p>
                <button
                  onClick={() => router.push(`/credential/${publicUrlSlug || "cred-demo"}`)}
                  className="py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-emerald-500/25 inline-flex items-center space-x-2 cursor-pointer transition-all"
                >
                  <Award className="w-4 h-4" />
                  <span>View Verified Certificate</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SprintWorkspace() {
  return (
    <I18nProvider>
      <SprintWorkspaceInner />
    </I18nProvider>
  );
}
