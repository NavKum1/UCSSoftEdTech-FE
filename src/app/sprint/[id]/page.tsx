"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Editor from "@monaco-editor/react";
import VapiInterviewRoom, { type DefenseResult } from "@/components/VapiInterviewRoom";
import MultiFileEditor, { type EditorFile, type MultiFileEditorApi } from "@/components/MultiFileEditor";
import AiAssistantPanel, { AiPolicyNotice, type AiPolicy } from "@/components/AiAssistantPanel";
import AgentSupervisorPanel from "@/components/AgentSupervisorPanel";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { API_BASE_URL, authenticatedFetch } from "@/lib/apiClient";
import { useAppAuth } from "@/lib/appAuth";
import SignInRequired from "@/components/SignInRequired";
import { EditorTelemetry, type TelemetryState } from "@/lib/editorTelemetry";
import {
  Code,
  Play,
  AlertTriangle,
  Award,
  ArrowRight,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Lock,
  Clock,
  KeyRound,
  Sparkles,
  BookOpen,
  Loader2,
  Layers,
  CloudOff,
} from "lucide-react";
import { useTheme } from "next-themes";
import I18nProvider from "@/components/I18nProvider";
import { useTranslations } from "next-intl";

type CandidateTrack =
  | "DevOps"
  | "Backend"
  | "Frontend"
  | "FullStack"
  | "DataMLOps"
  | "Cybersecurity"
  | "Mobile"
  | "CloudFinOps"
  | "DatabaseRE";

const PRACTICE_TRACKS: CandidateTrack[] = ["DevOps", "Backend", "Frontend", "FullStack", "DataMLOps", "Cybersecurity", "Mobile", "CloudFinOps", "DatabaseRE"];

const TRACK_LANGUAGES: Record<CandidateTrack, { defaultLang: string; options: string[] }> = {
  DevOps: {
    defaultLang: "Go",
    options: ["Go", "Python", "Bash", "Terraform (HCL)"],
  },
  Backend: {
    defaultLang: "Python",
    options: ["Python", "Go", "C#", "Java", "Rust", "C++", "TypeScript (Node)"],
  },
  Frontend: {
    defaultLang: "React (TSX)",
    options: ["React (TSX)", "TypeScript", "Next.js", "Vue.js", "JavaScript"],
  },
  FullStack: {
    defaultLang: "TypeScript (Next.js)",
    options: ["TypeScript (Next.js)", "Python (FastAPI)", "Go", "C# (.NET)"],
  },
  DataMLOps: {
    defaultLang: "Python",
    options: ["Python", "SQL", "Scala", "C++"],
  },
  Cybersecurity: {
    defaultLang: "Python",
    options: ["Python", "Go", "C / C++", "Rust", "Bash"],
  },
  Mobile: {
    defaultLang: "React Native (TSX)",
    options: ["React Native (TSX)", "Kotlin (Android)", "Swift (iOS)", "Flutter (Dart)"],
  },
  CloudFinOps: {
    defaultLang: "Python",
    options: ["Python", "Terraform (HCL)", "Go", "Bash"],
  },
  DatabaseRE: {
    defaultLang: "SQL",
    options: ["SQL", "Go", "Python", "Rust", "C++"],
  },
};

function getSnippetForTrackAndLanguage(
  track: CandidateTrack,
  tier: "Bronze (Junior)" | "Diamond (Staff)",
  lang: string
): { task: string; code: string } {
  const isDiamond = tier === "Diamond (Staff)";

  switch (track) {
    case "DevOps":
      if (isDiamond) {
        const task = "Task (Diamond DevOps): Implement a zero-downtime Blue/Green canary deployment controller with automated rollback on p99 latency threshold breach (>250ms).";
        if (lang === "Go") {
          return {
            task,
            code: `package main\n\nimport (\n    "context"\n    "fmt"\n    "time"\n)\n\ntype CanaryController struct {\n    RolloutStepsPct []int\n    LatencyLimitMs  int\n}\n\nfunc (c *CanaryController) ShiftTraffic(ctx context.Context, version string) error {\n    // TODO: Implement progressive weight shifting and automated abort on p99 latency spike\n    fmt.Printf("Deploying Canary %s...\\n", version)\n    return nil\n}\n\nfunc main() {\n    controller := &CanaryController{RolloutStepsPct: []int{5, 25, 50, 100}, LatencyLimitMs: 250}\n    _ = controller.ShiftTraffic(context.Background(), "v2.5.0")\n}`
          };
        } else if (lang === "Bash") {
          return {
            task,
            code: `#!/usr/bin/env bash\n# Diamond DevOps: Canary rollout with threshold monitor\nTARGET_VERSION="v2.5.0"\nLATENCY_LIMIT_MS=250\n\nfunction check_p99_latency() {\n  echo 180\n}\n\nfor weight in 5 25 50 100; do\n  echo "Shifting $weight% traffic to $TARGET_VERSION..."\n  latency=$(check_p99_latency)\n  if [ "$latency" -gt "$LATENCY_LIMIT_MS" ]; then\n    echo "CRITICAL: Latency breached ($latency ms). Initiating automated rollback!"\n    exit 1\n  fi\ndone\necho "Canary promotion complete."`
          };
        } else if (lang === "Terraform (HCL)") {
          return {
            task,
            code: `# Diamond DevOps: Zero-downtime weighted target group routing\nresource "aws_lb_listener_rule" "canary_routing" {\n  listener_arn = var.alb_listener_arn\n  priority     = 100\n\n  action {\n    type = "forward"\n    forward {\n      target_group {\n        arn    = var.production_target_group_arn\n        weight = 80\n      }\n      target_group {\n        arn    = var.canary_target_group_arn\n        weight = 20\n      }\n    }\n  }\n\n  condition {\n    path_pattern {\n      values = ["/api/v2/*"]\n    }\n  }\n}`
          };
        } else {
          return {
            task,
            code: `class CanaryController:\n    """Zero-downtime progressive canary deployment controller."""\n    def __init__(self, latency_limit_ms: int = 250):\n        self.latency_limit_ms = latency_limit_ms\n\n    def shift_traffic(self, version: str):\n        # TODO: Implement step-wise traffic shift & rollback on latency breach\n        print(f"Deploying Canary {version}...")\n\nif __name__ == '__main__':\n    controller = CanaryController()\n    controller.shift_traffic("v2.5.0")`
          };
        }
      } else {
        const task = "Task (Bronze DevOps): Fix the unhandled container crash loop and healthcheck probe failure in this microservice deployment script.";
        if (lang === "Bash") {
          return {
            task,
            code: `#!/usr/bin/env bash\nENDPOINT="http://localhost:8080/healthz"\n\nstatus=$(curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT" || echo "000")\nif [ "$status" -eq 200 ]; then\n  echo "Healthy"\n  exit 0\nelse\n  echo "Probe failed with status $status"\n  exit 1\nfi`
          };
        } else if (lang === "Go") {
          return {
            task,
            code: `package main\n\nimport (\n    "net/http"\n    "time"\n    "fmt"\n)\n\nfunc checkHealth(url string) bool {\n    client := http.Client{Timeout: 2 * time.Second}\n    resp, err := client.Get(url)\n    if err != nil {\n        return false\n    }\n    defer resp.Body.Close()\n    return resp.StatusCode == http.StatusOK\n}\n\nfunc main() {\n    fmt.Println("Health:", checkHealth("http://localhost:8080/healthz"))\n}`
          };
        } else {
          return {
            task,
            code: `import urllib.request\n\ndef check_service_health():\n    # TODO: Add socket timeout and connection retry with backoff\n    try:\n        res = urllib.request.urlopen("http://localhost:8080/healthz", timeout=2)\n        return res.status == 200\n    except Exception as e:\n        print(f"Healthcheck failed: {e}")\n        return False\n\nif __name__ == '__main__':\n    print("Healthy:", check_service_health())`
          };
        }
      }

    case "Frontend":
      if (isDiamond) {
        const task = "Task (Diamond Frontend): Implement a custom virtualized rendering engine for a high-frequency trading canvas chart to avoid DOM repaint bottlenecks.";
        if (lang === "Vue.js") {
          return {
            task,
            code: `<template>\n  <div class="p-4 bg-slate-900 text-white rounded-xl">\n    <h3>Orderflow Engine (Vue 3)</h3>\n    <canvas ref="canvasEl" width="800" height="400" class="w-full bg-black rounded" />\n  </div>\n</template>\n\n<script setup lang="ts">\nimport { ref } from 'vue';\nconst canvasEl = ref<HTMLCanvasElement | null>(null);\n// TODO: Implement batch-rendering to bypass DOM repaint limits\n</script>`
          };
        } else if (lang === "TypeScript") {
          return {
            task,
            code: `export class HighFrequencyChartVirtualizer {\n  private canvas: HTMLCanvasElement;\n  private buffer: Array<{ price: number; volume: number }> = [];\n\n  constructor(canvas: HTMLCanvasElement) {\n    this.canvas = canvas;\n  }\n\n  public ingestTick(price: number, volume: number): void {\n    // TODO: Ring-buffer aggregation and requestAnimationFrame scheduling\n  }\n}`
          };
        } else {
          return {
            task,
            code: `import React, { useRef, useEffect } from 'react';\n\n// Staff Frontend: High-performance canvas chart virtualization\nexport default function TradingChart({ ticker = "BTC/USDT" }) {\n  const canvasRef = useRef<HTMLCanvasElement | null>(null);\n\n  useEffect(() => {\n    // TODO: Implement batch-rendering to bypass DOM repaint limits\n  }, [ticker]);\n\n  return (\n    <div className="p-4 bg-slate-900 text-white rounded-xl">\n      <h3 className="font-bold text-sm">Realtime Orderflow: {ticker}</h3>\n      <canvas ref={canvasRef} width={800} height={400} className="w-full mt-2 bg-black rounded-lg" />\n    </div>\n  );\n}`
          };
        }
      } else {
        const task = "Task (Bronze Frontend): Create an accessible responsive button component with hover states and loading spinner using Tailwind CSS.";
        return {
          task,
          code: `import React from 'react';\n\ninterface ButtonProps {\n  label: string;\n  isLoading?: boolean;\n  onClick?: () => void;\n}\n\nexport default function ActionButton({ label, isLoading, onClick }: ButtonProps) {\n  return (\n    <button\n      onClick={onClick}\n      disabled={isLoading}\n      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50"\n    >\n      {isLoading ? "Processing..." : label}\n    </button>\n  );\n}`
        };
      }

    case "Mobile":
      if (isDiamond) {
        const task = "Task (Diamond Mobile): Implement an offline-first SQLite sync manager with vector clock conflict resolution and exponential backoff retry.";
        if (lang === "Kotlin (Android)") {
          return {
            task,
            code: `package com.edulexa.mobile\n\ndata class SyncMutation(val id: String, val table: String, val clock: Map<String, Long>, val payloadJson: String)\n\nclass OfflineSyncManager {\n    private val queue = mutableListOf<SyncMutation>()\n\n    fun enqueue(mutation: SyncMutation) {\n        // TODO: Store in Room database & schedule WorkManager sync\n    }\n\n    fun resolveConflict(local: SyncMutation, remote: SyncMutation): SyncMutation {\n        // TODO: Vector clock conflict resolution\n        return remote\n    }\n}`
          };
        } else if (lang === "Swift (iOS)") {
          return {
            task,
            code: `import Foundation\n\nstruct SyncMutation: Codable {\n    let id: UUID\n    let table: String\n    let vectorClock: [String: Int]\n    let payload: String\n}\n\nclass OfflineSyncManager: ObservableObject {\n    @Published var queue: [SyncMutation] = []\n\n    func queueMutation(_ mutation: SyncMutation) async {\n        // TODO: Persist mutation locally and trigger background URLSession sync\n    }\n}`
          };
        } else if (lang === "Flutter (Dart)") {
          return {
            task,
            code: `class SyncMutation {\n  final String id;\n  final String table;\n  final Map<String, int> vectorClock;\n  final dynamic payload;\n\n  SyncMutation({required this.id, required this.table, required this.vectorClock, required this.payload});\n}\n\nclass OfflineSyncService {\n  Future<void> enqueue(SyncMutation mutation) async {\n    // TODO: Write to Hive/Isar and schedule sync\n  }\n}`
          };
        } else {
          return {
            task,
            code: `export interface SyncMutation {\n  id: string;\n  table: string;\n  vectorClock: Record<string, number>;\n  payload: any;\n}\n\nexport class OfflineSyncManager {\n  private queue: SyncMutation[] = [];\n\n  async queueMutation(mutation: SyncMutation): Promise<void> {\n    // TODO: Persist mutation locally and trigger exponential backoff sync\n  }\n\n  async resolveConflict(local: SyncMutation, remote: SyncMutation): Promise<SyncMutation> {\n    // TODO: Vector clock conflict resolution\n    return remote;\n  }\n}`
          };
        }
      } else {
        const task = "Task (Bronze Mobile): Fix the unbounded list re-rendering performance bottleneck by implementing memoized row keys.";
        return {
          task,
          code: `import React from 'react';\n\nexport default function ChatList({ messages }: { messages: Array<{ id: string; text: string }> }) {\n  // TODO: Fix missing key warning and unnecessary re-renders\n  return (\n    <div>\n      {messages.map((m, index) => (\n        <div key={index}>{m.text}</div>\n      ))}\n    </div>\n  );\n}`
        };
      }

    case "DatabaseRE":
      if (isDiamond) {
        const task = "Task (Diamond DatabaseRE): Implement a distributed leasing lock manager with lease expiration heartbeat renewal and deadlock detection.";
        if (lang === "SQL") {
          return {
            task: "Task (Diamond DatabaseRE): Write a distributed multi-tenant partition migration procedure with advisory locks to prevent write-starvation.",
            code: `-- Staff DatabaseRE: Non-blocking partition swap with advisory lock\nCREATE OR REPLACE PROCEDURE migrate_tenant_partition(\n    p_tenant_id UUID,\n    p_target_tablespace TEXT\n)\nLANGUAGE plpgsql AS $$\nDECLARE\n    v_lock_obtained BOOLEAN;\nBEGIN\n    -- TODO: Acquire session-level advisory lock\n    -- Perform ALTER TABLE DETACH PARTITION CONCURRENTLY\nEND;\n$$;`
          };
        } else if (lang === "Go") {
          return {
            task,
            code: `package main\n\nimport (\n    "context"\n    "sync"\n    "time"\n)\n\ntype DistributedLock struct {\n    OwnerID   string\n    ExpiresAt time.Time\n}\n\ntype LockManager struct {\n    mu    sync.Mutex\n    locks map[string]DistributedLock\n}\n\nfunc (lm *LockManager) TryAcquire(ctx context.Context, key, owner string, ttl time.Duration) bool {\n    lm.mu.Lock()\n    defer lm.mu.Unlock()\n    // TODO: Atomic lease verification\n    return true\n}\n\nfunc main() {}`
          };
        } else {
          return {
            task,
            code: `import time\nimport threading\n\nclass DistributedLockManager:\n    """Raft-compatible distributed lease lock manager with automatic heartbeat renewal."""\n    def __init__(self, lease_ttl_ms: int = 5000):\n        self.lease_ttl_ms = lease_ttl_ms\n        self._locks = {}\n        self._mutex = threading.Lock()\n\n    def acquire_lock(self, resource_key: str, owner_id: str) -> bool:\n        with self._mutex:\n            now = time.time() * 1000\n            if resource_key not in self._locks or self._locks[resource_key]['expires_at'] < now:\n                self._locks[resource_key] = {'owner': owner_id, 'expires_at': now + self.lease_ttl_ms}\n                return True\n            return False\n\nif __name__ == '__main__':\n    dlm = DistributedLockManager()\n    print("Database Reliability Lock Manager operational.")`
          };
        }
      } else {
        const task = "Task (Bronze DatabaseRE): Fix the missing composite database index and resolve an N+1 query problem in this query builder.";
        if (lang === "SQL") {
          return {
            task,
            code: `-- Fix the sequential table scan on high-cardinality orders table\n-- Query: SELECT * FROM orders WHERE tenant_id = '...' AND created_at > '...' ORDER BY created_at DESC;\n\n-- TODO: Add optimal composite B-Tree index\nCREATE INDEX CONCURRENTLY idx_orders_tenant_created ON orders (tenant_id, created_at DESC);`
          };
        } else {
          return {
            task,
            code: `def fetch_users_with_recent_orders():\n    # TODO: Eliminate N+1 loop by using single JOIN or batch IN query\n    users = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]\n    results = []\n    for u in users:\n        # Simulated slow query for each user\n        results.append({"user": u, "orders": []})\n    return results\n\nif __name__ == '__main__':\n    print(fetch_users_with_recent_orders())`
          };
        }
      }

    case "DataMLOps":
      if (isDiamond) {
        const task = "Task (Diamond DataMLOps): Implement an in-memory streaming feature store with sliding-window aggregations and vector embedding cache eviction.";
        if (lang === "SQL") {
          return {
            task: "Task (Diamond DataMLOps): Write an incremental rolling window feature aggregation query for real-time fraud scoring.",
            code: `SELECT\n    user_id,\n    transaction_time,\n    amount,\n    AVG(amount) OVER (\n        PARTITION BY user_id\n        ORDER BY transaction_time\n        RANGE BETWEEN INTERVAL '1 hour' PRECEDING AND CURRENT ROW\n    ) AS avg_amount_1h,\n    COUNT(*) OVER (\n        PARTITION BY user_id\n        ORDER BY transaction_time\n        RANGE BETWEEN INTERVAL '5 minutes' PRECEDING AND CURRENT ROW\n    ) AS velocity_count_5m\nFROM transaction_stream;`
          };
        } else {
          return {
            task,
            code: `from collections import deque\nimport time\n\nclass StreamingFeatureStore:\n    """High-throughput sliding-window feature aggregation store."""\n    def __init__(self, window_seconds: int = 300):\n        self.window_seconds = window_seconds\n        self.events = deque()\n\n    def record_event(self, entity_id: str, feature_value: float):\n        # TODO: Append timestamped record & evict expired events outside sliding window\n        pass\n\n    def get_sliding_average(self, entity_id: str) -> float:\n        # TODO: Compute real-time sliding average for feature inference\n        return 0.0\n\nif __name__ == '__main__':\n    store = StreamingFeatureStore(window_seconds=60)\n    print("Feature store initialized.")`
          };
        }
      } else {
        const task = "Task (Bronze DataMLOps): Fix the missing null-check and NaN division error in this feature scaling transformer.";
        return {
          task,
          code: `def min_max_scaler(values: list[float]) -> list[float]:\n    # TODO: Fix division by zero when min == max and handle None values\n    valid = [v for v in values if v is not None]\n    min_v, max_v = min(valid), max(valid)\n    return [(v - min_v) / (max_v - min_v) for v in valid]\n\nif __name__ == '__main__':\n    data = [10.0, 20.0, None, 50.0]\n    print(min_max_scaler(data))`
        };
      }

    case "FullStack":
      if (isDiamond) {
        const task = "Task (Diamond FullStack): Build an optimistic UI order-book stream with an idempotent server-action state reconciler handling race conditions.";
        if (lang === "Python (FastAPI)") {
          return {
            task,
            code: `from fastapi import FastAPI, Header, HTTPException\nfrom pydantic import BaseModel\n\napp = FastAPI()\nprocessed_idempotency_keys = set()\n\nclass OrderRequest(BaseModel):\n    symbol: str\n    quantity: int\n\n@app.post("/orders")\nasync def place_order(order: OrderRequest, x_idempotency_key: str = Header(None)):\n    if not x_idempotency_key:\n        raise HTTPException(status_code=400, detail="Missing idempotency key")\n    if x_idempotency_key in processed_idempotency_keys:\n        return {"status": "already_processed"}\n    processed_idempotency_keys.add(x_idempotency_key)\n    return {"status": "created", "order": order}`
          };
        } else {
          return {
            task,
            code: `import React, { useState, useOptimistic } from 'react';\n\ninterface Order { id: string; symbol: string; qty: number; status: 'pending' | 'settled'; }\n\nexport default function OrderStream() {\n  const [orders, setOrders] = useState<Order[]>([]);\n  // TODO: Implement optimistic state mutation and rollback on server error\n  const handlePlaceOrder = async (symbol: string, qty: number) => {\n    // 1. Optimistic insert\n    // 2. Async server action RPC with idempotency key\n  };\n\n  return (\n    <div className="p-6 space-y-4">\n      <h2 className="text-base font-bold">FullStack Optimistic Order Reconciler</h2>\n    </div>\n  );\n}`
          };
        }
      } else {
        const task = "Task (Bronze FullStack): Fix the unvalidated form input submission and handle the pending server state.";
        return {
          task,
          code: `import React, { useState } from 'react';\n\nexport default function ContactForm() {\n  const [email, setEmail] = useState('');\n  const [error, setError] = useState('');\n\n  const handleSubmit = (e: React.FormEvent) => {\n    e.preventDefault();\n    // TODO: Add email validation and error feedback\n  };\n\n  return (\n    <form onSubmit={handleSubmit} className="p-4 space-y-2">\n      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" className="border p-2 rounded" />\n      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Submit</button>\n    </form>\n  );\n}`
        };
      }

    case "CloudFinOps":
      if (isDiamond) {
        const task = "Task (Diamond CloudFinOps): Build an automated multi-region compute rightsizer that monitors P95 CPU/memory metrics and reclaims idle clusters.";
        if (lang === "Terraform (HCL)") {
          return {
            task: "Task (Diamond CloudFinOps): Write an auto-scaling target tracking policy with predictive scaling for off-peak cost reduction.",
            code: `resource "aws_autoscaling_policy" "cost_optimized_cpu" {\n  name                   = "target-tracking-cpu50"\n  autoscaling_group_name = var.asg_name\n  policy_type            = "TargetTrackingScaling"\n\n  target_tracking_configuration {\n    predefined_metric_specification {\n      predefined_metric_type = "ASGAverageCPUUtilization"\n    }\n    target_value = 50.0\n  }\n}`
          };
        } else {
          return {
            task,
            code: `class CloudCostGovernor:\n    """Automated compute rightsizing and idle resource reclamation daemon."""\n    def __init__(self, idle_cpu_threshold_pct: float = 5.0, idle_duration_hours: int = 24):\n        self.idle_cpu_threshold = idle_cpu_threshold_pct\n        self.idle_duration_hours = idle_duration_hours\n\n    def evaluate_fleet(self, instances: list[dict]) -> list[dict]:\n        # TODO: Return action plan: Downsize, Terminate, or Retain based on p95 metrics\n        return []\n\nif __name__ == '__main__':\n    governor = CloudCostGovernor()\n    print("FinOps Governor operational.")`
          };
        }
      } else {
        const task = "Task (Bronze CloudFinOps): Validate mandatory cloud cost allocation tags (Owner, CostCenter, Environment) and flag untagged resources.";
        return {
          task,
          code: `REQUIRED_TAGS = {"Owner", "CostCenter", "Environment"}\n\ndef validate_resource_tags(resource: dict) -> list[str]:\n    # TODO: Check tags and return list of missing mandatory tags\n    tags = set(resource.get("Tags", {}).keys())\n    return list(REQUIRED_TAGS - tags)\n\nif __name__ == '__main__':\n    sample = {"Id": "i-098abc", "Tags": {"Owner": "eng-team"}}\n    print("Missing tags:", validate_resource_tags(sample))`
        };
      }

    case "Cybersecurity":
      if (isDiamond) {
        const task = "Task (Diamond Cybersecurity): Implement a cryptographic token replay protection engine with sliding nonce validation and constant-time signature verification.";
        if (lang === "Go") {
          return {
            task,
            code: `package main\n\nimport (\n    "crypto/hmac"\n    "crypto/sha256"\n    "sync"\n    "time"\n)\n\ntype TokenValidator struct {\n    secretKey  []byte\n    mu         sync.Mutex\n    seenNonces map[string]time.Time\n}\n\nfunc (tv *TokenValidator) Verify(payload, nonce, sig []byte) bool {\n    // TODO: Constant-time HMAC comparison and nonce replay protection\n    return hmac.Equal([]byte("expected"), sig)\n}\n\nfunc main() {}`
          };
        } else {
          return {
            task,
            code: `import hmac\nimport hashlib\nimport time\n\nclass TokenValidator:\n    """Constant-time token verification with nonce replay protection."""\n    def __init__(self, secret_key: bytes, nonce_ttl_sec: int = 60):\n        self.secret_key = secret_key\n        self.nonce_ttl_sec = nonce_ttl_sec\n        self.seen_nonces = {}\n\n    def verify_request(self, payload: str, nonce: str, signature: str) -> bool:\n        # TODO: 1. Check nonce freshness & replay\n        # TODO: 2. Constant-time HMAC comparison to prevent timing attacks\n        return True\n\nif __name__ == '__main__':\n    validator = TokenValidator(secret_key=b"enterprise_secret_key_2026")\n    print("Cybersecurity token validator ready.")`
          };
        }
      } else {
        const task = "Task (Bronze Cybersecurity): Fix the vulnerable regex pattern and sanitize untrusted HTML input against Cross-Site Scripting (XSS).";
        return {
          task,
          code: `import html\n\ndef sanitize_comment(user_input: str) -> str:\n    # TODO: Properly escape HTML entities to prevent stored XSS attacks\n    return user_input.replace("<script>", "")\n\nif __name__ == '__main__':\n    payload = "<img src=x onerror=alert(1)>"\n    print("Sanitized:", sanitize_comment(payload))`
        };
      }

    case "Backend":
    default:
      if (isDiamond) {
        const task = "Task (Diamond Backend): Implement an idempotent payment queue processor capable of handling 10k messages/sec without deadlocks.";
        if (lang === "Go") {
          return {
            task,
            code: `package main\n\nimport "fmt"\n\nfunc main() {\n    // Staff-level payment queue processor\n    fmt.Println("Processing 10k msgs/sec idempotent queue...")\n}`
          };
        } else if (lang === "C#") {
          return {
            task,
            code: `using System;\n\npublic class PaymentProcessor {\n    public void ProcessQueue() {\n        // Staff-level payment queue processor\n    }\n}`
          };
        } else if (lang === "Java") {
          return {
            task,
            code: `public class Main {\n    public static void main(String[] args) {\n        // Staff-level payment queue processor\n    }\n}`
          };
        } else if (lang === "Rust") {
          return {
            task,
            code: `fn main() {\n    // Staff-level payment queue processor\n}`
          };
        } else if (lang === "C++") {
          return {
            task,
            code: `#include <iostream>\n\nint main() {\n    // Staff-level payment queue processor\n    return 0;\n}`
          };
        } else {
          return {
            task,
            code: `def main():\n    # Staff-level payment queue processor\n    pass\n\nif __name__ == '__main__':\n    main()`
          };
        }
      } else {
        const task = "Task (Bronze Backend): Fix the SQL syntax error and SQL injection vulnerability in this basic payment script.";
        if (lang === "Go") {
          return {
            task,
            code: `package main\n\nimport "fmt"\n\nfunc main() {\n    amount := "250.00"\n    // TODO: Fix injection\n    query := fmt.Sprintf("INSERT INTO Payments (Amount) VALUES (%s)", amount)\n}`
          };
        } else if (lang === "C#") {
          return {
            task,
            code: `using System;\n\npublic class PaymentProcessor {\n    public void ProcessQueue() {\n        string amount = "250.00";\n        // TODO: Fix injection\n        string query = $"INSERT INTO Payments (Amount) VALUES ({amount})";\n    }\n}`
          };
        } else {
          return {
            task,
            code: `def main():\n    # Basic SQL fix\n    amount = 250.00\n    # TODO: Fix the SQL injection vulnerability below\n    query = f"INSERT INTO Payments (Amount) VALUES ({amount})"\n    print("Processing...")\n\nif __name__ == '__main__':\n    main()`
          };
        }
      }
  }
}

type Tier = "Bronze (Junior)" | "Diamond (Staff)";

type PipelineState = "editor" | "submitting" | "running" | "completed" | "voice_interview" | "passed" | "not_passed";

interface AttemptInfo {
  attemptId: string;
  resumed: boolean;
  aiPolicy: AiPolicy;
  taskType: string;
  language: string;
  entryFile: string | null;
  files: EditorFile[];
  serverElapsedMs: number;
  clientStartedAt: number;
}

interface SprintMeta {
  title?: string;
  description?: string;
  starterCode?: string | null;
  starterFiles?: EditorFile[] | null;
}

type StartIssue = { kind: "invite" | "pro" | "notFound" | "error"; message: string };

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toAiPolicy(value: unknown): AiPolicy {
  return value === "Allowed" || value === "Evaluated" ? value : "Prohibited";
}

function toFiles(value: unknown): EditorFile[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((f) => f && typeof f.name === "string")
    .map((f) => ({ name: f.name as string, content: typeof f.content === "string" ? f.content : "" }));
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatChallengeId(sprintId: string): string {
  if (!sprintId) return "CHLG-DEMO-01";
  if (GUID_RE.test(sprintId)) return `CHLG-${sprintId.substring(0, 8).toUpperCase()}`;
  const cleanSlug = sprintId
    .replace(/-database$/i, "-DB")
    .replace(/-architecture$/i, "-ARCH")
    .replace(/-incident$/i, "-INC")
    .toUpperCase();
  return `CHLG-${cleanSlug}`;
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function useIsOffline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => !navigator.onLine,
    () => false
  );
}

function getMonacoLanguage(language: string): string {
  switch (language) {
    case "Python":
    case "Python (FastAPI)":
      return "python";
    case "C#":
    case "C# (.NET)":
      return "csharp";
    case "Java":
      return "java";
    case "C++":
    case "C / C++":
      return "cpp";
    case "Go":
      return "go";
    case "Rust":
      return "rust";
    case "React (TSX)":
    case "React Native (TSX)":
    case "TypeScript":
    case "TypeScript (Next.js)":
    case "TypeScript (Node)":
      return "typescript";
    case "JavaScript":
    case "Vue.js":
      return "javascript";
    case "SQL":
      return "sql";
    case "Bash":
    case "Terraform (HCL)":
      return "shell";
    case "Kotlin (Android)":
      return "kotlin";
    case "Swift (iOS)":
      return "swift";
    case "Flutter (Dart)":
      return "dart";
    case "Scala":
      return "scala";
    default:
      return "python";
  }
}

function monacoLanguageForSprint(language: string): string {
  const lang = language.trim().toLowerCase();
  if (["c#", "csharp", "cs", ".net"].includes(lang)) return "csharp";
  if (["py", "python", "python3"].includes(lang)) return "python";
  if (["js", "javascript", "node"].includes(lang)) return "javascript";
  if (["ts", "typescript"].includes(lang)) return "typescript";
  if (["go", "golang"].includes(lang)) return "go";
  if (["rs", "rust"].includes(lang)) return "rust";
  if (["c++", "cpp"].includes(lang)) return "cpp";
  if (["bash", "sh", "shell"].includes(lang)) return "shell";
  return lang || "plaintext";
}

/** Runs code in the sandbox (POST /api/code/execute, signed-in only). `status` is the HTTP status, 0 when unreachable. */
async function executeCode(
  language: string,
  code: string,
  getToken: () => Promise<string | null>
): Promise<{ output: string; status: number }> {
  try {
    const res = await authenticatedFetch(
      "/api/code/execute",
      { method: "POST", body: JSON.stringify({ language, code }) },
      getToken
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { output: `Run failed: ${data.error || res.statusText}`, status: res.status };
    const parts = [data.stdOut, data.stdErr].filter((p: unknown) => typeof p === "string" && p.trim().length > 0);
    const footer = `\n[exit code ${data.exitCode ?? "?"}${data.executionTimeMs != null ? `, ${data.executionTimeMs} ms` : ""}]`;
    return { output: (parts.join("\n") || "(no output)") + footer, status: res.status };
  } catch (err) {
    return { output: `Couldn't reach the code runner: ${err instanceof Error ? err.message : String(err)}`, status: 0 };
  }
}

function ElapsedClock({ baseMs, startedAt }: { baseMs: number; startedAt: number }) {
  const [elapsed, setElapsed] = useState(baseMs);
  useEffect(() => {
    const id = setInterval(() => setElapsed(baseMs + performance.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [baseMs, startedAt]);
  return (
    <span className="flex items-center gap-1 font-mono text-[11px] text-foreground" title="Time since this attempt started">
      <Clock className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
      {formatElapsed(elapsed)}
    </span>
  );
}

function WorkspaceHeader({
  title,
  sprintId,
  badges,
  controls,
}: {
  title: string;
  sprintId: string;
  badges?: React.ReactNode;
  controls?: React.ReactNode;
}) {
  const isOffline = useIsOffline();
  return (
    <header className="border-b border-border bg-card/90 backdrop-blur-md sticky top-16 z-20">
      {isOffline && (
        <div className="w-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-center text-xs py-1.5 font-semibold border-b border-amber-500/20">
          No internet connection. Your edits stay in this tab and sync when you reconnect.
        </div>
      )}
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          <Link
            href="/dashboard"
            className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition flex items-center gap-1"
          >
            <span>←</span> Dashboard
          </Link>
          <span className="text-border">|</span>
          <div className="flex items-center space-x-2 min-w-0">
            <span className="font-bold text-sm text-foreground truncate">{title}</span>
            {badges}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {controls}
          <span
            className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-semibold font-mono tracking-wide"
            title={`Sprint Identifier: ${sprintId}`}
          >
            ID: {formatChallengeId(sprintId)}
          </span>
        </div>
      </div>
    </header>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="max-w-xl mx-auto px-6 pt-16 w-full">
      <div className="glass-panel rounded-2xl p-8 border border-border text-center space-y-4">{children}</div>
    </main>
  );
}

function GradedWorkspace({ sprintId }: { sprintId: string }) {
  const searchParams = useSearchParams();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const t = useTranslations("SprintHUD");
  const { resolvedTheme } = useTheme();
  const isOffline = useIsOffline();

  const [inviteCode, setInviteCode] = useState<string>(() => searchParams.get("invite")?.trim() || "");
  const [inviteInput, setInviteInput] = useState<string>("");
  const [starting, setStarting] = useState<boolean>(true);
  const [startIssue, setStartIssue] = useState<StartIssue | null>(null);
  const [upgrading, setUpgrading] = useState<boolean>(false);
  const [attempt, setAttempt] = useState<AttemptInfo | null>(null);
  const [telemetry, setTelemetry] = useState<EditorTelemetry | null>(null);
  const [syncState, setSyncState] = useState<TelemetryState>("ok");
  const [meta, setMeta] = useState<SprintMeta | null>(null);

  const [pipelineState, setPipelineState] = useState<PipelineState>("editor");
  const [submissionId, setSubmissionId] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [stdOutLogs, setStdOutLogs] = useState<string>("");
  const [testSummary, setTestSummary] = useState<{ passed: number; total: number } | null>(null);
  const [architecturalFlaws, setArchitecturalFlaws] = useState<string[]>([]);
  const [defenseResult, setDefenseResult] = useState<DefenseResult | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const editorApiRef = useRef<MultiFileEditorApi | null>(null);
  const startRequestedRef = useRef<boolean>(false);
  const pollFlags = useRef<{ cancelled: boolean }>({ cancelled: false });

  const isBrownfield = attempt?.taskType === "Brownfield";
  const isAgentSupervision = attempt?.taskType === "AgentSupervision";
  const editorLocked = pipelineState !== "editor";

  const startAttempt = useCallback(
    async (code: string) => {
      let res: Response;
      try {
        res = await authenticatedFetch(
          "/api/attempts/start",
          { method: "POST", body: JSON.stringify({ sprintId, inviteCode: code || undefined }) },
          getToken
        );
      } catch {
        setStartIssue({ kind: "error", message: "Couldn't reach the server. Check your connection and try again." });
        setStarting(false);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.attemptId) {
        const files = toFiles(data.files);
        const serverElapsedMs = Number(data.serverElapsedMs) || 0;
        setTelemetry(
          new EditorTelemetry({
            attemptId: data.attemptId,
            nextSequence: Number(data.nextSequence) || 0,
            serverElapsedMs,
            apiBaseUrl: API_BASE_URL,
            getToken,
            onStateChange: setSyncState,
          })
        );
        setAttempt({
          attemptId: data.attemptId,
          resumed: Boolean(data.resumed),
          aiPolicy: toAiPolicy(data.aiPolicy),
          taskType: typeof data.taskType === "string" ? data.taskType : "Greenfield",
          language: typeof data.language === "string" ? data.language : "python",
          entryFile: typeof data.entryFile === "string" ? data.entryFile : files[0]?.name ?? null,
          files: files.length > 0 ? files : [{ name: "main.py", content: "" }],
          serverElapsedMs,
          clientStartedAt: performance.now(),
        });
        setStartIssue(null);
      } else if (res.status === 403 && data.requiresInviteCode) {
        setStartIssue({
          kind: "invite",
          message: code
            ? "That invite code isn't valid for this sprint. Check the code from your invitation and try again."
            : "This is a private sprint. Enter the invite code from your invitation to start.",
        });
      } else if (res.status === 403 && data.requiresPro) {
        setStartIssue({ kind: "pro", message: data.message || "This sprint requires a Pro subscription." });
      } else if (res.status === 404 || res.status === 400) {
        setStartIssue({ kind: "notFound", message: data.error || "We couldn't find this sprint." });
      } else if (res.status === 401) {
        setStartIssue({ kind: "error", message: "Your session has expired. Sign in again to continue." });
      } else {
        setStartIssue({ kind: "error", message: data.error || "The sprint couldn't be started. Please try again." });
      }
      setStarting(false);
    },
    [getToken, sprintId]
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn || startRequestedRef.current) return;
    startRequestedRef.current = true;
    void startAttempt(inviteCode);
  }, [isLoaded, isSignedIn, inviteCode, startAttempt]);

  useEffect(() => {
    let cancelled = false;
    // A private sprint's details need its invite code (or an attempt the user already started with it)
    const query = inviteCode ? `?invite=${encodeURIComponent(inviteCode)}` : "";
    authenticatedFetch(`/api/sprint/${sprintId}${query}`, {}, getToken)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setMeta({
          title: data.title,
          description: data.description,
          starterCode: data.starterCode ?? null,
          starterFiles: data.starterFiles ? toFiles(data.starterFiles) : null,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sprintId, inviteCode, getToken]);

  useEffect(() => {
    if (!telemetry) return;
    telemetry.start();
    return () => telemetry.dispose({ flush: true });
  }, [telemetry]);

  useEffect(() => {
    const flags = pollFlags.current;
    flags.cancelled = false;
    return () => {
      flags.cancelled = true;
    };
  }, []);

  const starterFiles = useMemo<EditorFile[] | null>(() => {
    if (!attempt || !meta) return null;
    if (isBrownfield || isAgentSupervision) return meta.starterFiles ?? null;
    if (meta.starterCode == null || attempt.files.length !== 1) return null;
    return [{ name: attempt.files[0].name, content: meta.starterCode }];
  }, [attempt, meta, isBrownfield, isAgentSupervision]);

  const retryWithInvite = () => {
    const code = inviteInput.trim();
    if (!code) return;
    setInviteCode(code);
    setStarting(true);
    setStartIssue(null);
    void startAttempt(code);
  };

  const retryStart = () => {
    setStarting(true);
    setStartIssue(null);
    void startAttempt(inviteCode);
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const res = await authenticatedFetch("/api/billing/create-checkout-session", { method: "POST" }, getToken);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setStartIssue({ kind: "pro", message: data.error || "Checkout is unavailable right now. Please try again later." });
    } catch {
      setStartIssue({ kind: "pro", message: "Couldn't reach the server. Check your connection and try again." });
    }
    setUpgrading(false);
  };

  const startPolling = (subId: string) => {
    const flags = pollFlags.current;
    const tick = async (n: number) => {
      if (flags.cancelled) return;
      try {
        const res = await authenticatedFetch(`/api/sprint/submission/${subId}`, {}, getToken);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "Completed") {
            if (flags.cancelled) return;
            setStdOutLogs(data.stdOutLogs || "");
            setTestSummary({ passed: Number(data.passedTestsCount) || 0, total: Number(data.totalTestsCount) || 0 });
            try {
              const review = JSON.parse(data.architecturalReview || "{}");
              setArchitecturalFlaws(Array.isArray(review.flaws) ? review.flaws.map(String) : []);
            } catch {
              setArchitecturalFlaws([]);
            }
            setPipelineState("completed");
            setStatusMessage("Tests finished. Your voice defense is next.");
            setTimeout(() => setPipelineState((s) => (s === "completed" ? "voice_interview" : s)), 2500);
            return;
          }
        }
      } catch {
        // keep polling
      }
      if (n >= 200) {
        setStatusMessage("Tests are taking longer than usual. Your submission is saved; check back from your dashboard.");
        return;
      }
      setTimeout(() => void tick(n + 1), 1500);
    };
    setTimeout(() => void tick(0), 1000);
  };

  const handleRun = async () => {
    const api = editorApiRef.current;
    if (!api || !attempt || isRunning) return;
    telemetry?.recordRun();
    setIsRunning(true);
    setStdOutLogs("");
    setStatusMessage("Running your code...");
    const { output } = await executeCode(attempt.language, api.getFiles()[0]?.content ?? "", getToken);
    setStdOutLogs(output);
    setIsRunning(false);
  };

  const handleSubmitCode = async () => {
    const api = editorApiRef.current;
    if (!api || !attempt) return;
    setPipelineState("submitting");
    setStatusMessage("Saving your work...");

    if (telemetry && !(await telemetry.flushAll())) {
      setStatusMessage(
        syncState === "stopped"
          ? "Your editor activity can't be saved for this attempt. Reload the page to continue."
          : "Your latest edits haven't reached the server yet. Check your connection and submit again."
      );
      setPipelineState("editor");
      return;
    }

    const files = api.getFiles();
    const payload = isBrownfield
      ? { sprintId, attemptId: attempt.attemptId, files, inviteCode: inviteCode || undefined }
      : { sprintId, attemptId: attempt.attemptId, codePayload: files[0]?.content ?? "", inviteCode: inviteCode || undefined };

    setStatusMessage("Submitting your solution for automated testing...");
    try {
      const res = await authenticatedFetch(
        "/api/sprint/submit",
        { method: "POST", body: JSON.stringify(payload) },
        getToken
      );
      const data = await res.json().catch(() => ({}));
      if ((res.status === 202 || res.status === 200) && data.submissionId) {
        telemetry?.dispose();
        setTelemetry(null);
        setSubmissionId(data.submissionId);
        setPipelineState("running");
        setStatusMessage("Running hidden tests in the sandbox...");
        startPolling(data.submissionId);
      } else if (res.status === 409) {
        setStatusMessage("This attempt was already submitted. Reload the page to see your latest attempt.");
        setPipelineState("editor");
      } else {
        setStatusMessage("Submission failed: " + (data.error || data.message || res.statusText));
        setPipelineState("editor");
      }
    } catch (err) {
      setStatusMessage("Error connecting to server: " + (err instanceof Error ? err.message : String(err)));
      setPipelineState("editor");
    }
  };

  const handleDefenseResult = useCallback((result: DefenseResult) => {
    setDefenseResult(result);
    if (result.status !== "evaluated") return;
    setPipelineState(result.credentialIssued || result.credentialUnderReview ? "passed" : "not_passed");
  }, []);

  const getFilesForAssistant = useCallback(() => editorApiRef.current?.getFiles() ?? [], []);
  const applyAgentFile = useCallback((name: string, content: string, proposalId: string) => {
    editorApiRef.current?.replaceFile(name, content, proposalId);
  }, []);
  const insertFromAssistant = useCallback(
    (code: string, interactionId: string) => editorApiRef.current?.insertAtCursor(code, interactionId) ?? false,
    []
  );

  const title = meta?.title || "Coding Sprint";
  const header = (
    <WorkspaceHeader
      title={title}
      sprintId={sprintId}
      badges={
        attempt && (
          <>
            {isBrownfield && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/30">
                Multi-file
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/30">
              {attempt.aiPolicy === "Prohibited" ? "No AI tools" : attempt.aiPolicy === "Evaluated" ? "AI use reviewed" : "AI allowed"}
            </span>
          </>
        )
      }
    />
  );

  if (!isLoaded || (isSignedIn && starting)) {
    return (
      <div className="flex flex-col font-sans pb-16">
        {header}
        <CenteredCard>
          <Loader2 className="w-8 h-8 text-indigo-700 dark:text-indigo-400 mx-auto animate-spin" />
          <p className="text-sm text-muted-foreground">Preparing your sprint...</p>
        </CenteredCard>
      </div>
    );
  }

  if (!isSignedIn) {
    const back = `/sprint/${sprintId}${inviteCode ? `?invite=${encodeURIComponent(inviteCode)}` : ""}`;
    return (
      <div className="flex flex-col font-sans pb-16">
        {header}
        <SignInRequired
          title="Sign in to start this sprint"
          message="Your attempt is timed from when you open it, and your progress is saved to your account."
          returnTo={back}
        />
      </div>
    );
  }

  if (!attempt || startIssue) {
    return (
      <div className="flex flex-col font-sans pb-16">
        {header}
        <CenteredCard>
          {startIssue?.kind === "invite" ? (
            <>
              <KeyRound className="w-10 h-10 text-indigo-700 dark:text-indigo-400 mx-auto" />
              <h2 className="text-lg font-bold text-foreground">Invite code required</h2>
              <p className="text-xs text-muted-foreground">{startIssue.message}</p>
              <form
                className="flex gap-2 max-w-sm mx-auto"
                onSubmit={(e) => {
                  e.preventDefault();
                  retryWithInvite();
                }}
              >
                <input
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  placeholder="Invite code"
                  autoFocus
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!inviteInput.trim()}
                  className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs disabled:bg-muted disabled:text-muted-foreground cursor-pointer disabled:cursor-not-allowed"
                >
                  Start sprint
                </button>
              </form>
            </>
          ) : startIssue?.kind === "pro" ? (
            <>
              <Sparkles className="w-10 h-10 text-purple-700 dark:text-purple-400 mx-auto" />
              <h2 className="text-lg font-bold text-foreground">Pro sprint</h2>
              <p className="text-xs text-muted-foreground">{startIssue.message}</p>
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="inline-flex items-center gap-2 py-2.5 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-indigo-500/25 cursor-pointer disabled:opacity-60"
              >
                {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Upgrade to Pro
              </button>
            </>
          ) : (
            <>
              <AlertTriangle className="w-10 h-10 text-amber-700 dark:text-amber-400 mx-auto" />
              <h2 className="text-lg font-bold text-foreground">
                {startIssue?.kind === "notFound" ? "Sprint not found" : "Couldn't start the sprint"}
              </h2>
              <p className="text-xs text-muted-foreground">{startIssue?.message || "Please try again."}</p>
              <div className="flex items-center justify-center gap-2">
                {startIssue?.kind !== "notFound" && (
                  <button
                    onClick={retryStart}
                    className="inline-flex items-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" /> Try again
                  </button>
                )}
                <Link
                  href="/dashboard"
                  className="py-2 px-4 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Back to dashboard
                </Link>
              </div>
            </>
          )}
        </CenteredCard>
      </div>
    );
  }

  const aiEnabled = attempt.aiPolicy !== "Prohibited";
  const showDefense = pipelineState === "voice_interview" || pipelineState === "passed" || pipelineState === "not_passed";

  return (
    <div className="flex flex-col font-sans pb-16">
      {header}

      <main className="max-w-7xl mx-auto px-6 pt-8 flex-1 w-full space-y-6">
        {/* Session notice */}
        <div className="glass-panel rounded-2xl p-4 border border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <span>
                Your editing activity (edits, pastes and switching away from this window) is recorded and shared with
                reviewers alongside your submission.
              </span>
            </div>
            {attempt.aiPolicy === "Prohibited" && <AiPolicyNotice aiPolicy="Prohibited" />}
            {attempt.resumed && (
              <div className="flex items-start gap-2 text-[11px] text-indigo-700 dark:text-indigo-300">
                <RefreshCw className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Welcome back. Your attempt was resumed with the work saved so far.</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <ElapsedClock baseMs={attempt.serverElapsedMs} startedAt={attempt.clientStartedAt} />
            {telemetry && (
              <span
                className={`flex items-center gap-1 text-[11px] font-medium ${
                  syncState === "ok"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : syncState === "retrying"
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-red-700 dark:text-red-400"
                }`}
              >
                {syncState === "ok" ? <Lock className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
                {syncState === "ok" ? "Progress saved" : syncState === "retrying" ? "Reconnecting..." : "Not saving - reload the page"}
              </span>
            )}
          </div>
        </div>

        {/* Pipeline Progress Bar */}
        <div className="glass-panel rounded-2xl p-4 border border-border flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "editor" || pipelineState === "submitting" ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
              1. Code Submission
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "running" || pipelineState === "completed" ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
              2. Automated Test Runner
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "voice_interview" ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
              3. Voice Defense
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className={`px-3 py-1 rounded-lg ${pipelineState === "passed" ? "bg-emerald-600 text-white" : pipelineState === "not_passed" ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>
              4. Result
            </span>
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
                {isBrownfield ? `${attempt.files.length} files · ${attempt.language}` : `Language: ${attempt.language}`}
              </span>
            </div>

            {meta?.description && (
              <p className="text-xs text-foreground font-medium bg-card/80 p-3 rounded-lg border border-border/80 leading-relaxed shadow-inner whitespace-pre-wrap">
                {meta.description}
              </p>
            )}
            {isBrownfield && (
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <Layers className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                This is an existing project. Find and fix the defects across its files; hidden tests run when you submit.
              </p>
            )}

            <MultiFileEditor
              key={attempt.attemptId}
              modelKey={attempt.attemptId}
              files={attempt.files}
              entryFile={attempt.entryFile}
              fallbackLanguage={monacoLanguageForSprint(attempt.language)}
              theme={resolvedTheme === "light" ? "light" : "vs-dark"}
              readOnly={editorLocked}
              height={isBrownfield ? "420px" : "350px"}
              telemetry={telemetry}
              starterFiles={editorLocked ? null : starterFiles}
              onReady={(api) => {
                editorApiRef.current = api;
              }}
            />

            <div className="flex gap-3">
              {!isBrownfield && !isAgentSupervision && (
                <button
                  onClick={handleRun}
                  disabled={editorLocked || isRunning || isOffline}
                  className="py-3 px-4 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer border border-border text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
                  <span>Run</span>
                </button>
              )}
              <button
                onClick={handleSubmitCode}
                disabled={editorLocked || isOffline}
                className={`flex-1 py-3 px-4 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  !editorLocked && !isOffline
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                <Play className="w-4 h-4" />
                <span>
                  {isOffline ? "Offline - reconnect to submit" : pipelineState === "submitting" ? t("submitting") : t("submitSprint")}
                </span>
              </button>
            </div>
          </div>

          {/* Right Pane: Assistant, Output & Voice Defense */}
          <div className="space-y-6">
            {isAgentSupervision ? (
              <AgentSupervisorPanel
                attemptId={attempt.attemptId}
                getFiles={getFilesForAssistant}
                applyFile={applyAgentFile}
                onTestRun={() => telemetry?.recordRun()}
                disabled={editorLocked}
              />
            ) : aiEnabled && (
              <AiAssistantPanel
                attemptId={attempt.attemptId}
                aiPolicy={attempt.aiPolicy}
                getToken={getToken}
                getFiles={getFilesForAssistant}
                onInsert={insertFromAssistant}
                disabled={editorLocked}
              />
            )}

            <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <h3 className="text-sm font-semibold text-foreground">Execution Output & Test Results</h3>
                </div>
                {pipelineState === "running" && <RefreshCw className="w-4 h-4 text-amber-700 dark:text-amber-400 animate-spin" />}
                {testSummary && (
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded font-semibold border ${
                      testSummary.total > 0 && testSummary.passed === testSummary.total
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    }`}
                  >
                    Tests passed: {testSummary.passed} / {testSummary.total}
                  </span>
                )}
              </div>

              <div className="bg-slate-950 p-4 rounded-xl font-mono text-[11px] text-emerald-400 h-36 overflow-y-auto border border-slate-900 leading-relaxed whitespace-pre-wrap">
                {stdOutLogs || statusMessage || "Awaiting submission..."}
              </div>
              {stdOutLogs && statusMessage && pipelineState !== "editor" && (
                <p className="text-[11px] text-muted-foreground">{statusMessage}</p>
              )}

              {architecturalFlaws.length > 0 && (
                <div className="p-3 bg-indigo-500/5 border border-indigo-500/30 rounded-xl space-y-1">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Review topics for discussion:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-foreground space-y-0.5 pl-2">
                    {architecturalFlaws.map((flaw, idx) => (
                      <li key={idx}>{flaw}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {showDefense && submissionId && (
              <VapiInterviewRoom
                sprintSubmissionId={submissionId}
                jobDescription="Coding challenge review"
                onResult={handleDefenseResult}
              />
            )}

            {pipelineState === "passed" && defenseResult && (
              <div className="glass-panel rounded-2xl p-6 border border-emerald-500/40 bg-emerald-500/5 text-center space-y-4">
                <ShieldCheck className="w-12 h-12 text-emerald-700 dark:text-emerald-400 mx-auto" />
                <h3 className="text-lg font-bold text-foreground">Congratulations! Certificate Issued</h3>
                <p className="text-xs text-muted-foreground">
                  {defenseResult.credentialUnderReview
                    ? "You defended your implementation. Your certificate is under review and becomes publicly verifiable once a reviewer confirms it."
                    : "You successfully defended your implementation. Your verified certificate has been issued."}
                </p>
                {defenseResult.publicUrlSlug && (
                  <Link
                    href={`/credential/${defenseResult.publicUrlSlug}`}
                    className="py-2.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-emerald-500/25 inline-flex items-center space-x-2 transition-all"
                  >
                    <Award className="w-4 h-4" />
                    <span>View Certificate</span>
                  </Link>
                )}
              </div>
            )}

            {pipelineState === "not_passed" && defenseResult && (
              <div className="glass-panel rounded-2xl p-6 border border-border text-center space-y-4">
                <BookOpen className="w-10 h-10 text-indigo-700 dark:text-indigo-400 mx-auto" />
                <h3 className="text-lg font-bold text-foreground">Defense scored</h3>
                <p className="text-xs text-muted-foreground">
                  A certificate wasn&apos;t issued for this attempt. Your scores and the skills to work on are shown above.
                </p>
                <Link
                  href="/referrals"
                  className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs inline-flex items-center space-x-2 transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>See learning recommendations</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

interface PublicSprint {
  sprintId: string;
  title: string;
  requiredLanguage: string;
  isPremium: boolean;
}

function PracticeWorkspace({ sprintId }: { sprintId: string }) {
  // The practice editor is public; the challenge list (GET /api/sprint) and Run (POST /api/code/execute) need an account
  const { getToken, isLoaded, isSignedIn } = useAppAuth();
  const { resolvedTheme } = useTheme();
  const t = useTranslations("SprintHUD");

  // ?track= (e.g. from a counselling result) opens that track's exercises
  const searchParams = useSearchParams();
  const requestedTrack = searchParams.get("track");
  const initialTrack: CandidateTrack = PRACTICE_TRACKS.includes(requestedTrack as CandidateTrack) ? (requestedTrack as CandidateTrack) : "Backend";
  const [candidateTrack, setCandidateTrack] = useState<CandidateTrack>(initialTrack);
  const [difficultyTier, setDifficultyTier] = useState<Tier>("Diamond (Staff)");
  const [language, setLanguage] = useState<string>("Python");
  const [snippet, setSnippet] = useState(() => getSnippetForTrackAndLanguage(initialTrack, "Diamond (Staff)", "Python"));
  const [code, setCode] = useState<string>(snippet.code);
  const [output, setOutput] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [challenges, setChallenges] = useState<PublicSprint[]>([]);
  // "loading" until the list arrives; "signin" when the API refused the session (401), as when it ended
  const [challengeState, setChallengeState] = useState<"loading" | "ready" | "signin" | "error">("loading");
  // Set when Run was refused for want of a session, so the output panel offers sign-in instead of an error line
  const [runNeedsSignIn, setRunNeedsSignIn] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    authenticatedFetch("/api/sprint", {}, getToken)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) return setChallengeState("signin");
        if (!res.ok) return setChallengeState("error");
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        setChallenges(data && Array.isArray(data.sprints) ? data.sprints.slice(0, 8) : []);
        setChallengeState("ready");
      })
      .catch(() => !cancelled && setChallengeState("error"));
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const challengeView = !isLoaded ? "loading" : !isSignedIn ? "signin" : challengeState;

  const applySelection = (track: CandidateTrack, tier: Tier, lang: string) => {
    const next = getSnippetForTrackAndLanguage(track, tier, lang);
    setCandidateTrack(track);
    setDifficultyTier(tier);
    setLanguage(lang);
    setSnippet(next);
    setCode(next.code);
  };

  const handleTrackChange = (newTrack: CandidateTrack) => {
    const config = TRACK_LANGUAGES[newTrack];
    applySelection(newTrack, difficultyTier, config.options.includes(language) ? language : config.defaultLang);
  };

  const handleRun = async () => {
    // Signed out: don't send a request the API will refuse; say what's needed instead
    if (isLoaded && !isSignedIn) {
      setOutput("");
      setRunNeedsSignIn(true);
      return;
    }
    setRunNeedsSignIn(false);
    setIsRunning(true);
    setOutput("Running...");
    const monacoLang = getMonacoLanguage(language);
    const result = await executeCode(monacoLang === "shell" ? "bash" : monacoLang, code, getToken);
    if (result.status === 401) {
      setOutput("");
      setRunNeedsSignIn(true);
    } else {
      setOutput(result.output);
    }
    setIsRunning(false);
  };

  return (
    <div className="flex flex-col font-sans pb-16">
      <WorkspaceHeader
        title={humanizeSlug(sprintId)}
        sprintId={sprintId}
        badges={
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold border border-border">
            Practice
          </span>
        }
        controls={
          <div className="hidden lg:flex items-center space-x-2 bg-card border border-border rounded-xl px-3 py-1.5 shadow-xs">
            <select aria-label="Track" value={candidateTrack} onChange={(e) => handleTrackChange(e.target.value as CandidateTrack)} className="bg-transparent text-xs text-indigo-600 dark:text-indigo-400 font-semibold focus:outline-none cursor-pointer">
              <option value="DevOps">🚀 DevOps &amp; SRE</option>
              <option value="Backend">⚙️ Backend Systems</option>
              <option value="Frontend">💻 Frontend &amp; Web</option>
              <option value="FullStack">🌐 FullStack Systems</option>
              <option value="DataMLOps">🧠 Data &amp; MLOps</option>
              <option value="Cybersecurity">🛡️ Cybersecurity</option>
              <option value="Mobile">📱 Mobile Architecture</option>
              <option value="CloudFinOps">💰 Cloud FinOps</option>
              <option value="DatabaseRE">🗄️ Database Reliability</option>
            </select>
            <span className="text-border">|</span>
            <select aria-label="Difficulty" value={difficultyTier} onChange={(e) => applySelection(candidateTrack, e.target.value as Tier, language)} className="bg-transparent text-xs text-emerald-700 dark:text-emerald-400 font-semibold focus:outline-none cursor-pointer">
              <option value="Bronze (Junior)">Bronze (Junior)</option>
              <option value="Diamond (Staff)">Diamond (Staff)</option>
            </select>
            <span className="text-border">|</span>
            <select aria-label="Language" value={language} onChange={(e) => applySelection(candidateTrack, difficultyTier, e.target.value)} className="bg-transparent text-xs text-purple-700 dark:text-purple-400 font-semibold focus:outline-none cursor-pointer">
              {TRACK_LANGUAGES[candidateTrack].options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <main className="max-w-7xl mx-auto px-6 pt-8 flex-1 w-full space-y-6">
        <div className="glass-panel rounded-2xl p-4 border border-border flex items-start gap-2 text-[11px] text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-700 dark:text-indigo-400" />
          <span>
            Practice mode: nothing here is graded or submitted. Pick a challenge below to start a timed sprint with
            hidden tests and a voice defense.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
              {snippet.task}
            </p>

            <div className="border border-border rounded-xl overflow-hidden mt-2 bg-background">
              <Editor
                height="350px"
                language={getMonacoLanguage(language)}
                theme={resolvedTheme === "light" ? "light" : "vs-dark"}
                value={code}
                onChange={(val) => setCode(val || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "var(--font-geist-mono), monospace",
                  padding: { top: 16 },
                }}
              />
            </div>

            <button
              onClick={handleRun}
              disabled={isRunning}
              className="py-3 px-4 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer border border-border text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
              <span>Run code</span>
            </button>
          </div>

          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-border">
                <Terminal className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h3 className="text-sm font-semibold text-foreground">Output</h3>
              </div>
              <div aria-live="polite">
                {runNeedsSignIn ? (
                  <SignInRequired
                    variant="inline"
                    headingLevel={4}
                    title="Sign in to run your code"
                    message="Editing here is open to everyone. Running code on our servers needs an account."
                    className="rounded-xl border border-border bg-card"
                  />
                ) : (
                  <div className="bg-slate-950 p-4 rounded-xl font-mono text-[11px] text-emerald-400 h-36 overflow-y-auto border border-slate-900 leading-relaxed whitespace-pre-wrap">
                    {output || "Run your code to see its output."}
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 border border-border space-y-3">
              <div className="flex items-center space-x-2 pb-3 border-b border-border">
                <Award className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
                <h3 className="text-sm font-semibold text-foreground">Graded challenges</h3>
              </div>
              {challengeView === "loading" ? (
                <p role="status" className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Loading challenges...
                </p>
              ) : challengeView === "signin" ? (
                <SignInRequired
                  variant="inline"
                  headingLevel={4}
                  title="Sign in to see graded challenges"
                  message="Graded challenges are timed, with hidden tests and a voice defense, and count toward your results."
                />
              ) : challengeView === "error" ? (
                <p role="status" className="text-xs text-muted-foreground">Couldn&apos;t load the graded challenges. Try again in a moment.</p>
              ) : challenges.length === 0 ? (
                <p className="text-xs text-muted-foreground">No public challenges are available right now.</p>
              ) : (
                <ul className="space-y-2">
                  {challenges.map((c) => (
                    <li key={c.sprintId}>
                      <Link
                        href={`/sprint/${c.sprintId}`}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border hover:bg-muted transition-colors"
                      >
                        <span className="text-xs font-semibold text-foreground truncate">{c.title}</span>
                        <span className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
                          {c.requiredLanguage}
                          {c.isPremium && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold">Pro</span>
                          )}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SprintWorkspaceInner() {
  const params = useParams();
  const sprintId = (params?.id as string) || "";
  return GUID_RE.test(sprintId) ? <GradedWorkspace sprintId={sprintId} /> : <PracticeWorkspace sprintId={sprintId || "practice"} />;
}

export default function SprintWorkspace() {
  return (
    <I18nProvider>
      <Suspense fallback={null}>
        <SprintWorkspaceInner />
      </Suspense>
    </I18nProvider>
  );
}
