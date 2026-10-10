"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import type { TriageSettings } from "@/components/career/triage/shared";

interface AiLogRow {
  id: string;
  kind: string;
  createdAt: string;
  actorName?: string | null;
  studentName?: string | null;
  promptSha256: string;
  provider: string;
  model: string;
  simulated: boolean;
  injectionSuspected: boolean;
  sentThreadId?: string | null;
}

const THRESHOLDS: [keyof TriageSettings, string, string, number, number][] = [
  ["finalYearMonths", "Final-year window (months before graduation)", "Used by: final year, no recent appointment", 1, 36],
  ["noAppointmentMonths", "Months without an appointment", "Used by: final year, no recent appointment", 1, 24],
  ["agreementDaysBeforeStart", "Days before internship start", "Used by: internship agreement unsigned", 0, 120],
  ["docReturnedDays", "Days since a document review was returned", "Used by: document review not acted on", 1, 180],
  ["unansweredThreadDays", "Days a student message can go unanswered", "Used by: unanswered message", 1, 60],
  ["mentoringPendingDays", "Days a mentoring request can wait", "Used by: mentoring request pending", 1, 90],
  ["passingSprintPercent", "Passing sprint (% of hidden tests)", "Used by: no verified evidence", 1, 100],
];

export default function TriageSettingsPage() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const loaded = useLoad(() => api<TriageSettings>("/api/career/triage/settings"), [api, schoolId]);
  const log = useLoad(() => api<AiLogRow[]>("/api/career/triage/copilot/log?take=100"), [api, schoolId]);
  const s = loaded.data;
  const setS = loaded.setData;
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(patch: Partial<TriageSettings>, success: string) {
    if (!s) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api<TriageSettings>("/api/career/triage/settings", { method: "PUT", json: patch });
      setS(r);
      setMsg(success);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Signal & copilot settings"
        description="Thresholds for this school's caseload signals, and the opt-in AI copilot. Signals are transparent rules for counselors; they are never shown to students and never make decisions."
        actions={
          <Link className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href="/career-center/caseload">
            Back to caseload
          </Link>
        }
      />
      <SuccessBanner message={msg} />
      <ErrorBanner error={err || loaded.error} />
      {!s ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          <Card title="Signals">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const patch: Partial<TriageSettings> = { disabledRules: s.disabledRules };
                for (const [k] of THRESHOLDS) (patch as Record<string, unknown>)[k] = s[k];
                save(patch, "Signal settings saved.");
              }}
            >
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Signals in use</legend>
                <ul className="space-y-2">
                  {s.rules.map((r) => (
                    <li key={r.key}>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={!s.disabledRules.includes(r.key)}
                          onChange={(e) => setS({ ...s, disabledRules: e.target.checked ? s.disabledRules.filter((x) => x !== r.key) : [...s.disabledRules, r.key] })}
                        />
                        <span>
                          <span className="font-medium">{r.title}</span>
                          <span className="block text-muted-foreground">{r.description}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                {THRESHOLDS.map(([k, label, hint, min, max]) => (
                  <Field key={k} label={label} hint={hint}>
                    {(p) => <input {...p} type="number" min={min} max={max} value={Number(s[k])} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} />}
                  </Field>
                ))}
              </div>
              <Button type="submit" busy={busy}>
                Save signal settings
              </Button>
            </form>
          </Card>

          <Card title="AI copilot">
            <p className="text-sm text-muted-foreground">
              When on, counselors can generate an appointment prep brief and a drafted outreach message. Everything is labelled as AI-drafted, nothing is sent automatically (counselors edit and send through
              messaging), and every generation is logged below. Student data is sent to the school&apos;s configured AI provider only for these drafts and is never released to employers.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={s.copilotEnabled ? "good" : "neutral"}>{s.copilotEnabled ? "On" : "Off"}</Badge>
              {!s.copilotAvailable && <Badge tone="warn">No AI provider configured</Badge>}
              {s.copilotSimulated && <Badge tone="warn">Development stub output (no provider keys)</Badge>}
            </div>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={s.copilotIncludePrivateNotes} onChange={(e) => setS({ ...s, copilotIncludePrivateNotes: e.target.checked })} />
                Include staff-only advising notes in prep briefs (marked as staff-only; never used in outreach drafts)
              </label>
              <div className="flex gap-2">
                <Button busy={busy} onClick={() => save({ copilotEnabled: !s.copilotEnabled, copilotIncludePrivateNotes: s.copilotIncludePrivateNotes }, s.copilotEnabled ? "Copilot turned off." : "Copilot turned on.")}>
                  {s.copilotEnabled ? "Turn copilot off" : "Turn copilot on"}
                </Button>
                <Button variant="secondary" busy={busy} onClick={() => save({ copilotIncludePrivateNotes: s.copilotIncludePrivateNotes }, "Copilot settings saved.")}>
                  Save note setting
                </Button>
              </div>
            </div>
          </Card>

          <Card title="AI generation log">
            <ErrorBanner error={log.error} onRetry={log.reload} />
            {log.loading && !log.data ? (
              <Loading />
            ) : !log.data || log.data.length === 0 ? (
              <EmptyState title="No AI generations yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">AI generations, newest first</caption>
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th scope="col" className="py-2">When</th>
                      <th scope="col">Type</th>
                      <th scope="col">By</th>
                      <th scope="col">Student</th>
                      <th scope="col">Model</th>
                      <th scope="col">Prompt hash</th>
                      <th scope="col">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.data.map((x) => (
                      <tr key={x.id} className="border-t border-border">
                        <td className="py-2">{formatDate(x.createdAt, true)}</td>
                        <td>{x.kind === "Brief" ? "Prep brief" : "Outreach draft"}</td>
                        <td>{x.actorName || "—"}</td>
                        <td>{x.studentName || "—"}</td>
                        <td>
                          {x.provider} / {x.model}
                        </td>
                        <td>
                          <code title={x.promptSha256}>{x.promptSha256.slice(0, 12)}…</code>
                        </td>
                        <td className="space-x-1">
                          {x.simulated && <Badge tone="warn">Stub</Badge>}
                          {x.injectionSuspected && <Badge tone="warn">Instruction-like text</Badge>}
                          {x.sentThreadId && <Badge tone="good">Sent after review</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
