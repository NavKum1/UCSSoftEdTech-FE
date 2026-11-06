"use client";

/**
 * Build & Defend pilot, Stage 1 item 1.8 (6 Nov 2026): AI usage per school this month, from the token counts the AI
 * providers report and the voice minutes of each school's defenses. Costs appear only for prices set on the server
 * (Ai:Prices:{model}:InputPerMillion / OutputPerMillion, Ai:Prices:VoicePerMinute). A school's monthly token allowance can
 * be set here: its admins are e-mailed at 80%, and AI work for it stops at 100%. API: /api/admin/platform/ai-usage.
 */
import React, { useEffect, useState } from "react";
import { useLegacyApi, useLatestRef } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, Card, ErrorBanner, Loading } from "@/components/career/ui";

interface Row {
  instituteId: string | null;
  name: string;
  kind: string | null;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  voiceMinutes: number;
  students: number;
  costUsd: number | null;
  costPerStudentUsd: number | null;
  monthlyTokenLimit: number | null;
  usedPercent: number | null;
}
interface Report {
  month: string;
  pricesSet: boolean;
  schools: Row[];
}

const n = (v: number) => v.toLocaleString();
const usd = (v: number | null) => (v == null ? "—" : `$${v.toFixed(2)}`);

export default function AiUsageCard() {
  const en = useEn();
  const { apiFetch, ready } = useLegacyApi();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await apiFetch(`/api/admin/platform/ai-usage?month=${encodeURIComponent(month)}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? en("AI usage couldn't be loaded."));
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof TypeError ? en("We couldn't reach the server. Please check your connection and try again.") : (e as Error).message);
    }
  };
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, month, loadRef]);

  const saveLimit = async () => {
    if (!editing) return;
    const tokens = editing.value.trim() === "" ? null : Number(editing.value.replace(/[,\s]/g, ""));
    if (tokens != null && (!Number.isFinite(tokens) || tokens < 0)) return setError(en("Enter the allowance as a number of tokens, or leave it empty for no limit."));
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/platform/ai-usage/limits/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyTokens: tokens }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? en("The allowance couldn't be saved."));
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title={en("AI usage")}
      actions={
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {en("Month")}
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1 text-sm text-foreground" />
        </label>
      }
    >
      <p className="text-sm text-muted-foreground">
        {en("Tokens come from what the AI providers report for each call; voice minutes from each school's defenses. A school's admins are e-mailed at 80% of its allowance, and AI work for it stops at 100%.")}
      </p>
      <div className="mt-3">
        <ErrorBanner error={error} onRetry={() => void load()} />
      </div>
      {!data ? (
        !error && <Loading />
      ) : data.schools.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{en("No AI use this month.")}</p>
      ) : (
        <>
          {!data.pricesSet && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              {en("Costs show once the providers' prices are set on the server (Ai:Prices:<model>:InputPerMillion and :OutputPerMillion, Ai:Prices:VoicePerMinute).")}
            </p>
          )}
          <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={en("AI usage per school")}>
            <table className="w-full text-start text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pe-3 text-start font-medium">{en("School")}</th>
                  <th className="py-2 pe-3 text-end font-medium">{en("AI calls")}</th>
                  <th className="py-2 pe-3 text-end font-medium">{en("Tokens")}</th>
                  <th className="py-2 pe-3 text-end font-medium">{en("Voice minutes")}</th>
                  <th className="py-2 pe-3 text-end font-medium">{en("Students")}</th>
                  <th className="py-2 pe-3 text-end font-medium">{en("Cost")}</th>
                  <th className="py-2 pe-3 text-end font-medium">{en("Per student")}</th>
                  <th className="py-2 text-start font-medium">{en("Monthly allowance")}</th>
                </tr>
              </thead>
              <tbody>
                {data.schools.map((s) => (
                  <tr key={s.instituteId ?? "none"} className="border-t border-border align-top">
                    <td className="py-2 pe-3">
                      {s.name}
                      {s.kind === "Company" && <span className="ms-1 text-xs text-muted-foreground">({en("recruiter company")})</span>}
                    </td>
                    <td className="py-2 pe-3 text-end tabular-nums">{n(s.calls)}</td>
                    <td className="py-2 pe-3 text-end tabular-nums">{n(s.inputTokens + s.outputTokens)}</td>
                    <td className="py-2 pe-3 text-end tabular-nums">{s.voiceMinutes}</td>
                    <td className="py-2 pe-3 text-end tabular-nums">{n(s.students)}</td>
                    <td className="py-2 pe-3 text-end tabular-nums">{usd(s.costUsd)}</td>
                    <td className="py-2 pe-3 text-end tabular-nums">{usd(s.costPerStudentUsd)}</td>
                    <td className="py-2">
                      {!s.instituteId ? (
                        <span className="text-muted-foreground">—</span>
                      ) : editing?.id === s.instituteId ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <input
                            aria-label={en("Monthly allowance in tokens for {name}", { name: s.name })}
                            inputMode="numeric"
                            value={editing.value}
                            onChange={(e) => setEditing({ id: editing.id, value: e.target.value })}
                            placeholder={en("No limit")}
                            className="w-32 rounded-lg border border-border bg-card px-2 py-1 text-sm"
                          />
                          <Button busy={busy} onClick={() => void saveLimit()}>{en("Save")}</Button>
                          <Button variant="ghost" onClick={() => setEditing(null)}>{en("Cancel")}</Button>
                        </span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-2">
                          {s.monthlyTokenLimit == null ? (
                            <span className="text-muted-foreground">{en("No limit")}</span>
                          ) : (
                            <>
                              <span className="tabular-nums">{n(s.monthlyTokenLimit)}</span>
                              <Badge tone={(s.usedPercent ?? 0) >= 100 ? "bad" : (s.usedPercent ?? 0) >= 80 ? "warn" : "neutral"}>{en("{percent}% used", { percent: s.usedPercent ?? 0 })}</Badge>
                            </>
                          )}
                          <Button variant="ghost" onClick={() => setEditing({ id: s.instituteId!, value: s.monthlyTokenLimit?.toString() ?? "" })}>
                            {en("Change")}
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
