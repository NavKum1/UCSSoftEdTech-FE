"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, ScrollArea, useCareerT } from "@/components/career/ui";
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

// Labels and hints: messages careerCenterCaseloadSettings.threshold.<key>
const THRESHOLDS: [keyof TriageSettings, number, number][] = [
  ["finalYearMonths", 1, 36],
  ["noAppointmentMonths", 1, 24],
  ["agreementDaysBeforeStart", 0, 120],
  ["docReturnedDays", 1, 180],
  ["unansweredThreadDays", 1, 60],
  ["mentoringPendingDays", 1, 90],
  ["passingSprintPercent", 1, 100],
];

export default function TriageSettingsPage() {
  const t = useCareerT("careerCenterCaseloadSettings");
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
        title={t("signalCopilotSettings")}
        description={t("thresholdsForThisSchoolsCaseload")}
        actions={
          <Link className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href="/career-center/caseload">
            {t("backToCaseload")}
          </Link>
        }
      />
      <SuccessBanner message={msg} />
      <ErrorBanner error={err || loaded.error} />
      {!s ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          <Card title={t("signals")}>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const patch: Partial<TriageSettings> = { disabledRules: s.disabledRules };
                for (const [k] of THRESHOLDS) (patch as Record<string, unknown>)[k] = s[k];
                save(patch, t("signalSettingsSaved"));
              }}
            >
              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t("signalsInUse")}</legend>
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
                {THRESHOLDS.map(([k, min, max]) => (
                  <Field key={k} label={t(`threshold.${k}.label`)} hint={t(`threshold.${k}.hint`)}>
                    {(p) => <input {...p} type="number" min={min} max={max} value={Number(s[k])} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} />}
                  </Field>
                ))}
              </div>
              <Button type="submit" busy={busy}>
                {t("saveSignalSettings")}
              </Button>
            </form>
          </Card>

          <Card title={t("aICopilot")}>
            <p className="text-sm text-muted-foreground">
              {t("whenOnCounselorsCanGenerate")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={s.copilotEnabled ? "good" : "neutral"}>{s.copilotEnabled ? t("on") : t("off")}</Badge>
              {!s.copilotAvailable && <Badge tone="warn">{t("noAIProviderConfigured")}</Badge>}
              {s.copilotSimulated && <Badge tone="warn">{t("developmentStubOutputNoProvider")}</Badge>}
            </div>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={s.copilotIncludePrivateNotes} onChange={(e) => setS({ ...s, copilotIncludePrivateNotes: e.target.checked })} />
                {t("includeStaffOnlyAdvisingNotes")}
              </label>
              <div className="flex gap-2">
                <Button busy={busy} onClick={() => save({ copilotEnabled: !s.copilotEnabled, copilotIncludePrivateNotes: s.copilotIncludePrivateNotes }, s.copilotEnabled ? t("copilotTurnedOff") : t("copilotTurnedOn"))}>
                  {s.copilotEnabled ? t("turnCopilotOff") : t("turnCopilotOn")}
                </Button>
                <Button variant="secondary" busy={busy} onClick={() => save({ copilotIncludePrivateNotes: s.copilotIncludePrivateNotes }, t("copilotSettingsSaved"))}>
                  {t("saveNoteSetting")}
                </Button>
              </div>
            </div>
          </Card>

          <Card title={t("aIGenerationLog")}>
            <ErrorBanner error={log.error} onRetry={log.reload} />
            {log.loading && !log.data ? (
              <Loading />
            ) : !log.data || log.data.length === 0 ? (
              <EmptyState title={t("noAIGenerationsYet")} />
            ) : (
              <ScrollArea>
                <table className="w-full text-sm">
                  <caption className="sr-only">{t("aIGenerationsNewestFirst")}</caption>
                  <thead>
                    <tr className="text-start text-muted-foreground [&_th]:text-start">
                      <th scope="col" className="py-2">{t("when")}</th>
                      <th scope="col">{t("type")}</th>
                      <th scope="col">{t("by")}</th>
                      <th scope="col">{t("student")}</th>
                      <th scope="col">{t("model")}</th>
                      <th scope="col">{t("promptHash")}</th>
                      <th scope="col">{t("notes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.data.map((x) => (
                      <tr key={x.id} className="border-t border-border">
                        <td className="py-2">{formatDate(x.createdAt, true)}</td>
                        <td>{x.kind === "Brief" ? t("prepBrief") : t("outreachDraft")}</td>
                        <td>{x.actorName || "—"}</td>
                        <td>{x.studentName || "—"}</td>
                        <td>
                          {x.provider} / {x.model}
                        </td>
                        <td>
                          <code title={x.promptSha256}>{x.promptSha256.slice(0, 12)}…</code>
                        </td>
                        <td className="space-x-1">
                          {x.simulated && <Badge tone="warn">{t("stub")}</Badge>}
                          {x.injectionSuspected && <Badge tone="warn">{t("instructionLikeText")}</Badge>}
                          {x.sentThreadId && <Badge tone="good">{t("sentAfterReview")}</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
