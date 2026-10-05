"use client";

import React, { useState, useEffect, useMemo } from "react";
import Editor from "@monaco-editor/react";
import OpenAIRealtimeInterviewRoom from "@/components/OpenAIRealtimeInterviewRoom";
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
import { useTheme } from "next-themes";
import I18nProvider from "@/components/I18nProvider";
import { useTranslations } from "next-intl";

export type CandidateTrack =
  | "DevOps"
  | "Backend"
  | "Frontend"
  | "FullStack"
  | "DataMLOps"
  | "Cybersecurity"
  | "Mobile"
  | "CloudFinOps"
  | "DatabaseRE";

function SprintWorkspaceInner() {
  const params = useParams();
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const sprintId = (params?.id as string) || "demo-sprint-id";
  const t = useTranslations("SprintHUD");
  const { theme } = useTheme();

  const [candidateTrack, setCandidateTrack] = useState<CandidateTrack>("Backend");
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

  const formattedChallengeId = useMemo(() => {
    if (!sprintId || sprintId === "demo-sprint-id") return "CHLG-DEMO-01";
    // Check if GUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sprintId)) {
      return `CHLG-${sprintId.substring(0, 8).toUpperCase()}`;
    }
    // Clean formatted slug (e.g. distributed-database -> DISTRIBUTED-DB)
    const cleanSlug = sprintId
      .replace(/-database$/i, "-DB")
      .replace(/-architecture$/i, "-ARCH")
      .replace(/-incident$/i, "-INC")
      .toUpperCase();
    return `CHLG-${cleanSlug}`;
  }, [sprintId]);

  useEffect(() => {
    // 1. FRONTEND TRACK
    if (candidateTrack === "Frontend") {
      if (language !== "React / TSX") setLanguage("React / TSX");
      if (difficultyTier === "Diamond (Staff)") {
        setTaskDescription("Task (Diamond Frontend): Implement a custom React reconciler and virtualization engine for a high-frequency trading canvas chart.");
        setCodePayload(`import React, { useRef, useEffect } from 'react';\n\n// Staff Frontend: High-performance canvas chart virtualization\nexport default function TradingChart({ ticker = "BTC/USDT" }) {\n  const canvasRef = useRef<HTMLCanvasElement | null>(null);\n\n  useEffect(() => {\n    // TODO: Implement batch-rendering to bypass DOM repaint limits\n  }, [ticker]);\n\n  return (\n    <div className="p-4 bg-slate-900 text-white rounded-xl">\n      <h3 className="font-bold text-sm">Realtime Orderflow: {ticker}</h3>\n      <canvas ref={canvasRef} width={800} height={400} className="w-full mt-2 bg-black rounded-lg" />\n    </div>\n  );\n}`);
      } else {
        setTaskDescription("Task (Bronze Frontend): Create an accessible responsive button component with hover states and loading spinner using Tailwind CSS.");
        setCodePayload(`import React from 'react';\n\ninterface ButtonProps {\n  label: string;\n  isLoading?: boolean;\n  onClick?: () => void;\n}\n\nexport default function ActionButton({ label, isLoading, onClick }: ButtonProps) {\n  return (\n    <button\n      onClick={onClick}\n      disabled={isLoading}\n      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50"\n    >\n      {isLoading ? "Processing..." : label}\n    </button>\n  );\n}`);
      }
    }
    // 2. FULLSTACK TRACK
    else if (candidateTrack === "FullStack") {
      if (difficultyTier === "Diamond (Staff)") {
        setTaskDescription("Task (Diamond FullStack): Build an optimistic UI order-book stream with an idempotent server-action state reconciler handling race conditions.");
        setCodePayload(`import React, { useState, useOptimistic } from 'react';\n\ninterface Order { id: string; symbol: string; qty: number; status: 'pending' | 'settled'; }\n\nexport default function OrderStream() {\n  const [orders, setOrders] = useState<Order[]>([]);\n  // TODO: Implement optimistic state mutation and rollback on server error\n  const handlePlaceOrder = async (symbol: string, qty: number) => {\n    // 1. Optimistic insert\n    // 2. Async server action RPC with idempotency key\n  };\n\n  return (\n    <div className="p-6 space-y-4">\n      <h2 className="text-base font-bold">FullStack Optimistic Order Reconciler</h2>\n    </div>\n  );\n}`);
      } else {
        setTaskDescription("Task (Bronze FullStack): Fix the unvalidated form input submission and handle the pending server state.");
        setCodePayload(`import React, { useState } from 'react';\n\nexport default function ContactForm() {\n  const [email, setEmail] = useState('');\n  const [error, setError] = useState('');\n\n  const handleSubmit = (e: React.FormEvent) => {\n    e.preventDefault();\n    // TODO: Add email validation and error feedback\n  };\n\n  return (\n    <form onSubmit={handleSubmit} className="p-4 space-y-2">\n      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" className="border p-2 rounded" />\n      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Submit</button>\n    </form>\n  );\n}`);
      }
    }
    // 3. DEVOPS & SRE TRACK
    else if (candidateTrack === "DevOps") {
      if (language === "React / TSX") setLanguage("Go");
      if (difficultyTier === "Diamond (Staff)") {
        setTaskDescription("Task (Diamond DevOps): Implement a zero-downtime Blue/Green canary deployment controller with automated rollback on p99 latency threshold breach (>250ms).");
        if (language === "Go") {
          setCodePayload(`package main\n\nimport (\n    "context"\n    "fmt"\n    "time"\n)\n\ntype CanaryController struct {\n    RolloutSteps []int // e.g. 5, 25, 50, 100\n    LatencyLimitMs int\n}\n\nfunc (c *CanaryController) ShiftTraffic(ctx context.Context, newVersion string) error {\n    // TODO: Implement progressive weight shifting and automated abort on p99 latency spike\n    fmt.Printf("Deploying Canary %s...\\n", newVersion)\n    return nil\n}\n\nfunc main() {\n    controller := &CanaryController{RolloutSteps: []int{5, 25, 50, 100}, LatencyLimitMs: 250}\n    _ = controller.ShiftTraffic(context.Background(), "v2.5.0")\n}`);
        } else {
          setCodePayload(`class CanaryController:\n    """Zero-downtime progressive canary deployment controller."""\n    def __init__(self, latency_limit_ms: int = 250):\n        self.latency_limit_ms = latency_limit_ms\n\n    def shift_traffic(self, version: str):\n        # TODO: Implement step-wise traffic shift & rollback on latency breach\n        print(f"Deploying Canary {version}...")\n\nif __name__ == '__main__':\n    controller = CanaryController()\n    controller.shift_traffic("v2.5.0")`);
        }
      } else {
        setTaskDescription("Task (Bronze DevOps): Fix the unhandled container crash loop and healthcheck probe failure in this microservice deployment script.");
        setCodePayload(`def check_service_health():\n    # TODO: Add socket timeout and connection retry with backoff\n    import urllib.request\n    try:\n        res = urllib.request.urlopen("http://localhost:8080/healthz", timeout=2)\n        return res.status == 200\n    except Exception as e:\n        print(f"Healthcheck failed: {e}")\n        return False\n\nif __name__ == '__main__':\n    print("Healthy:", check_service_health())`);
      }
    }
    // 4. DATA & MLOPS TRACK
    else if (candidateTrack === "DataMLOps") {
      if (language === "React / TSX") setLanguage("Python");
      if (difficultyTier === "Diamond (Staff)") {
        setTaskDescription("Task (Diamond DataMLOps): Implement an in-memory streaming feature store with sliding-window aggregations and vector embedding cache eviction.");
        setCodePayload(`from collections import deque\nimport time\n\nclass StreamingFeatureStore:\n    """High-throughput sliding-window feature aggregation store."""\n    def __init__(self, window_seconds: int = 300):\n        self.window_seconds = window_seconds\n        self.events = deque()\n\n    def record_event(self, entity_id: str, feature_value: float):\n        # TODO: Append timestamped record & evict expired events outside sliding window\n        pass\n\n    def get_sliding_average(self, entity_id: str) -> float:\n        # TODO: Compute real-time sliding average for feature inference\n        return 0.0\n\nif __name__ == '__main__':\n    store = StreamingFeatureStore(window_seconds=60)\n    print("Feature store initialized.")`);
      } else {
        setTaskDescription("Task (Bronze DataMLOps): Fix the missing null-check and NaN division error in this feature scaling transformer.");
        setCodePayload(`def min_max_scaler(values: list[float]) -> list[float]:\n    # TODO: Fix division by zero when min == max and handle None values\n    valid = [v for v in values if v is not None]\n    min_v, max_v = min(valid), max(valid)\n    return [(v - min_v) / (max_v - min_v) for v in valid]\n\nif __name__ == '__main__':\n    data = [10.0, 20.0, None, 50.0]\n    print(min_max_scaler(data))`);
      }
    }
    // 5. CYBERSECURITY TRACK
    else if (candidateTrack === "Cybersecurity") {
      if (language === "React / TSX") setLanguage("Python");
      if (difficultyTier === "Diamond (Staff)") {
        setTaskDescription("Task (Diamond Cybersecurity): Implement a cryptographic token replay protection engine with sliding nonce validation and constant-time signature verification.");
        setCodePayload(`import hmac\nimport hashlib\nimport time\n\nclass TokenValidator:\n    """Zero-trust constant-time token verification with nonce replay protection."""\n    def __init__(self, secret_key: bytes, nonce_ttl_sec: int = 60):\n        self.secret_key = secret_key\n        self.nonce_ttl_sec = nonce_ttl_sec\n        self.seen_nonces = {}\n\n    def verify_request(self, payload: str, nonce: str, signature: str) -> bool:\n        # TODO: 1. Check nonce freshness & replay\n        # TODO: 2. Constant-time HMAC comparison to prevent timing attacks\n        return True\n\nif __name__ == '__main__':\n    validator = TokenValidator(secret_key=b"enterprise_secret_key_2026")\n    print("Cybersecurity token validator ready.")`);
      } else {
        setTaskDescription("Task (Bronze Cybersecurity): Fix the vulnerable regex pattern and sanitize untrusted HTML input against Cross-Site Scripting (XSS).");
        setCodePayload(`import html\n\ndef sanitize_comment(user_input: str) -> str:\n    # TODO: Properly escape HTML entities to prevent stored XSS attacks\n    return user_input.replace("<script>", "")\n\nif __name__ == '__main__':\n    payload = "<img src=x onerror=alert(1)>"\n    print("Sanitized:", sanitize_comment(payload))`);
      }
    }
    // 6. MOBILE ARCHITECTURE TRACK
    else if (candidateTrack === "Mobile") {
      if (difficultyTier === "Diamond (Staff)") {
        setTaskDescription("Task (Diamond Mobile): Implement an offline-first SQLite sync manager with vector clock conflict resolution and exponential backoff retry.");
        setCodePayload(`export interface SyncMutation {\n  id: string;\n  table: string;\n  vectorClock: Record<string, number>;\n  payload: any;\n}\n\nexport class OfflineSyncManager {\n  private queue: SyncMutation[] = [];\n\n  async queueMutation(mutation: SyncMutation): Promise<void> {\n    // TODO: Persist mutation locally and trigger exponential backoff sync\n  }\n\n  async resolveConflict(local: SyncMutation, remote: SyncMutation): Promise<SyncMutation> {\n    // TODO: Vector clock conflict resolution\n    return remote;\n  }\n}`);
      } else {
        setTaskDescription("Task (Bronze Mobile): Fix the unbounded list re-rendering performance bottleneck by implementing memoized row keys.");
        setCodePayload(`import React from 'react';\n\nexport default function ChatList({ messages }: { messages: Array<{ id: string; text: string }> }) {\n  // TODO: Fix missing key warning and unnecessary re-renders\n  return (\n    <div>\n      {messages.map((m, index) => (\n        <div key={index}>{m.text}</div>\n      ))}\n    </div>\n  );\n}`);
      }
    }
    // 7. CLOUD FINOPS TRACK
    else if (candidateTrack === "CloudFinOps") {
      if (language === "React / TSX") setLanguage("Python");
      if (difficultyTier === "Diamond (Staff)") {
        setTaskDescription("Task (Diamond CloudFinOps): Build an automated multi-region compute rightsizer that monitors P95 CPU/memory metrics and reclaims idle clusters.");
        setCodePayload(`class CloudCostGovernor:\n    """Automated compute rightsizing and idle resource reclamation daemon."""\n    def __init__(self, idle_cpu_threshold_pct: float = 5.0, idle_duration_hours: int = 24):\n        self.idle_cpu_threshold = idle_cpu_threshold_pct\n        self.idle_duration_hours = idle_duration_hours\n\n    def evaluate_fleet(self, instances: list[dict]) -> list[dict]:\n        # TODO: Return action plan: Downsize, Terminate, or Retain based on p95 metrics\n        return []\n\nif __name__ == '__main__':\n    governor = CloudCostGovernor()\n    print("FinOps Governor operational.")`);
      } else {
        setTaskDescription("Task (Bronze CloudFinOps): Validate mandatory cloud cost allocation tags (Owner, CostCenter, Environment) and flag untagged resources.");
        setCodePayload(`REQUIRED_TAGS = {"Owner", "CostCenter", "Environment"}\n\ndef validate_resource_tags(resource: dict) -> list[str]:\n    # TODO: Check tags and return list of missing mandatory tags\n    tags = set(resource.get("Tags", {}).keys())\n    return list(REQUIRED_TAGS - tags)\n\nif __name__ == '__main__':\n    sample = {"Id": "i-098abc", "Tags": {"Owner": "eng-team"}}\n    print("Missing tags:", validate_resource_tags(sample))`);
      }
    }
    // 8. DATABASE RELIABILITY TRACK
    else if (candidateTrack === "DatabaseRE") {
      if (language === "React / TSX") setLanguage("Python");
      if (difficultyTier === "Diamond (Staff)") {
        setTaskDescription("Task (Diamond DatabaseRE): Implement a distributed leasing lock manager with lease expiration heartbeat renewal and deadlock detection.");
        setCodePayload(`import time\nimport threading\n\nclass DistributedLockManager:\n    """Raft-compatible distributed lease lock manager with automatic heartbeat renewal."""\n    def __init__(self, lease_ttl_ms: int = 5000):\n        self.lease_ttl_ms = lease_ttl_ms\n        self._locks = {}\n        self._mutex = threading.Lock()\n\n    def acquire_lock(self, resource_key: str, owner_id: str) -> bool:\n        with self._mutex:\n            now = time.time() * 1000\n            if resource_key not in self._locks or self._locks[resource_key]['expires_at'] < now:\n                self._locks[resource_key] = {'owner': owner_id, 'expires_at': now + self.lease_ttl_ms}\n                return True\n            return False\n\nif __name__ == '__main__':\n    dlm = DistributedLockManager()\n    print("Database Reliability Lock Manager operational.")`);
      } else {
        setTaskDescription("Task (Bronze DatabaseRE): Fix the missing composite database index and resolve an N+1 query problem in this query builder.");
        setCodePayload(`def fetch_users_with_recent_orders():\n    # TODO: Eliminate N+1 loop by using single JOIN or batch IN query\n    users = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]\n    results = []\n    for u in users:\n        # Simulated slow query for each user\n        results.append({"user": u, "orders": []})\n    return results\n\nif __name__ == '__main__':\n    print(fetch_users_with_recent_orders())`);
      }
    }
    // 9. BACKEND SYSTEMS TRACK (DEFAULT)
    else {
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

  const handlePaste = (e: React.ClipboardEvent<any>) => {
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
      <div className="flex flex-col font-sans pb-16">
        {/* Navbar */}
        <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-50">
          {isOffline && (
            <div className="w-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-center text-xs py-1.5 font-semibold border-b border-amber-500/20">
              No internet connection. Your work is being saved locally.
            </div>
          )}
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push("/")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              BD
            </div>
            <div>
              <span className="font-bold text-lg text-foreground">BUILD & DEFEND</span>
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-600 dark:text-emerald-300 font-semibold border border-emerald-500/30">
                Verified & Secure
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden lg:flex items-center space-x-2 bg-card border border-border rounded-xl px-3 py-1.5 shadow-sm">
              <select value={candidateTrack} onChange={(e) => setCandidateTrack(e.target.value as any)} className="bg-transparent text-xs text-indigo-600 dark:text-indigo-300 font-semibold focus:outline-none cursor-pointer">
                <option value="DevOps">🚀 DevOps & SRE</option>
                <option value="Backend">⚙️ Backend Systems</option>
                <option value="Frontend">💻 Frontend & Web</option>
                <option value="FullStack">🌐 FullStack Systems</option>
                <option value="DataMLOps">🧠 Data & MLOps</option>
                <option value="Cybersecurity">🛡️ Cybersecurity</option>
                <option value="Mobile">📱 Mobile Architecture</option>
                <option value="CloudFinOps">💰 Cloud FinOps</option>
                <option value="DatabaseRE">🗄️ Database Reliability</option>
              </select>
              <span className="text-slate-700">|</span>
              <select value={difficultyTier} onChange={(e) => setDifficultyTier(e.target.value as any)} className="bg-transparent text-xs text-emerald-700 dark:text-emerald-400 font-semibold focus:outline-none cursor-pointer">
                <option value="Bronze (Junior)">Bronze League (Junior)</option>
                <option value="Diamond (Staff)">Diamond League (Staff)</option>
              </select>
              <span className="text-slate-700">|</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={candidateTrack === "Frontend"} className="bg-transparent text-xs text-purple-700 dark:text-purple-400 font-semibold focus:outline-none cursor-pointer disabled:opacity-50">
                <option value="Python">Python</option>
                <option value="C#">C#</option>
                <option value="Java">Java</option>
                <option value="C++">C++</option>
                <option value="Go">Go</option>
                <option value="Rust">Rust</option>
                <option value="React / TSX">React / TSX</option>
              </select>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 font-semibold font-mono tracking-wide" title={`Sprint Identifier: ${sprintId}`}>
              Challenge ID: {formattedChallengeId}
            </span>
            <UserButton />
          </div>
        </div>
      </header>

      {/* Main Split-Pane Workspace */}
      <main className="max-w-7xl mx-auto px-6 pt-8 flex-1 w-full space-y-6">
        <ProctoringHUD sessionId={submissionId || sprintId} />

        {/* Pipeline Progress Bar */}
        <div className="glass-panel rounded-2xl p-4 border border-border flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold">
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "editor" ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
              1. Code Submission
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "running" || pipelineState === "completed" ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
              2. Automated Test Runner
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "voice_interview" ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
              3. Interactive Code Review
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "passed" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
              4. Verified Certificate
            </span>
          </div>

          <div className="flex items-center space-x-1 text-[11px] text-indigo-700 dark:text-indigo-400 font-mono">
            <Lock className="w-3.5 h-3.5 mr-1 text-emerald-700 dark:text-emerald-400" />
            <span>Session Authenticated</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Pane: Code Editor */}
          <div className="glass-panel rounded-2xl p-6 border border-border flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
                <h3 className="text-sm font-semibold text-foreground">{t("codeEditor")}</h3>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-semibold border border-indigo-500/20">
                Language: {language}
              </span>
            </div>

            <p className="text-xs text-foreground font-medium bg-card/80 p-3 rounded-lg border border-border/80 leading-relaxed shadow-inner">
              {taskDescription}
            </p>

            {pasteWarning && (
              <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl flex items-start space-x-2 text-xs text-amber-600 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>{pasteWarning}</span>
              </div>
            )}

            <div className="border border-border rounded-xl overflow-hidden mt-2 bg-background" onPaste={handlePaste}>
              <Editor
                height="350px"
                language={getMonacoLanguage()}
                theme={theme === "light" ? "vs-light" : "vs-dark"}
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
                  : "bg-muted text-muted-foreground cursor-not-allowed"
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
            <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <h3 className="text-sm font-semibold text-foreground">Execution Output & Test Results</h3>
                </div>
                {pipelineState === "running" && <RefreshCw className="w-4 h-4 text-amber-700 dark:text-amber-400 animate-spin" />}
              </div>

              <div className="bg-slate-950 p-4 rounded-xl font-mono text-[11px] text-emerald-700 dark:text-emerald-400 h-36 overflow-y-auto border border-slate-900 leading-relaxed whitespace-pre-wrap">
                {stdOutLogs || statusMessage || "Awaiting submission..."}
              </div>

              {architecturalFlaws.length > 0 && (
                <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl space-y-1">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-red-600 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400" />
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
              <OpenAIRealtimeInterviewRoom
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
                <ShieldCheck className="w-12 h-12 text-emerald-700 dark:text-emerald-400 mx-auto" />
                <h3 className="text-lg font-bold text-foreground">Congratulations! Certificate Issued</h3>
                <p className="text-xs text-muted-foreground">
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
