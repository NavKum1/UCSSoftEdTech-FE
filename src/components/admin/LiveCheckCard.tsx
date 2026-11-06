"use client";

/**
 * Build & Defend pilot, Stage 1 item 1.6 (6 Nov 2026): tries every real service an assessment depends on, once, on this
 * server (code runner, AI, voice, credential signing, virus check, sign-in service, payments, and optionally e-mail) and
 * shows which work. Run it after each deployment. API: POST /api/admin/platform/live-check (super admins).
 */
import React, { useState } from "react";
import { CheckCircle2, CircleDashed, PlayCircle, XCircle } from "lucide-react";
import { useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, Card, ErrorBanner, Field } from "@/components/career/ui";

interface Step {
  key: string;
  name: string;
  status: "ok" | "failed" | "not_set_up";
  message: string;
  ms: number;
}

export default function LiveCheckCard() {
  const en = useEn();
  const { apiFetch } = useLegacyApi();
  const [email, setEmail] = useState("");
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/platform/live-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() || null }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? en("The live check couldn't run. Please try again."));
        return;
      }
      setSteps(body.steps);
      setRanAt(body.ranAt);
    } catch {
      setError(en("We couldn't reach the server. Please check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  const failed = steps?.filter((s) => s.status === "failed").length ?? 0;
  const notSetUp = steps?.filter((s) => s.status === "not_set_up").length ?? 0;
  return (
    <Card title={en("Live check")}>
      <p className="text-sm text-muted-foreground">
        {en("Tries every service an assessment needs, once, on this server: the code runner, the AI, voice, credential signing, the virus check, the sign-in service and payments. Nothing reaches a student. Run it after each deployment.")}
      </p>
      <form onSubmit={run} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Field label={en("Also send a test e-mail to (optional)")}>
            {(p) => <input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@your-domain.com" />}
          </Field>
        </div>
        <Button type="submit" busy={busy}>
          <PlayCircle aria-hidden="true" className="h-4 w-4" />
          {en("Run live check")}
        </Button>
      </form>
      <div className="mt-3">
        <ErrorBanner error={error} />
      </div>
      {steps && (
        <div className="mt-4 space-y-2">
          <p role="status" className={`text-sm font-medium ${failed ? "text-red-700 dark:text-red-400" : notSetUp ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            {failed
              ? en("{count} not working.", { count: failed })
              : notSetUp
                ? en("Everything set up works; {count} not set up yet.", { count: notSetUp })
                : en("Everything works.")}
            {ranAt && <span className="ms-2 font-normal text-muted-foreground">{new Date(ranAt).toLocaleString()}</span>}
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {steps.map((s) => (
              <li key={s.key} className="flex items-start gap-3 p-3">
                {s.status === "ok" ? (
                  <CheckCircle2 aria-label={en("Works")} className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : s.status === "failed" ? (
                  <XCircle aria-label={en("Not working")} className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                ) : (
                  <CircleDashed aria-label={en("Not set up")} className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{en(s.name)}</p>
                  <p className="text-sm text-muted-foreground">{s.message}</p>
                </div>
                <span className="ms-auto shrink-0 text-xs tabular-nums text-muted-foreground">{s.ms} ms</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
