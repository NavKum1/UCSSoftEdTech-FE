"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { ErrorBanner, Loading, PageHeader } from "@/components/career/ui";
import { formatDate } from "@/lib/transparency";
import { useEn } from "@/lib/english/EnglishProvider";

interface Participation {
  includeOutcomeData: boolean;
  updatedAt: string | null;
  outcomesRecorded: number;
  explanation: string;
}

async function readParticipation(res: Response): Promise<Participation> {
  if (res.status === 401 || res.status === 403) throw new Error("You need recruiter or institute admin access to change this setting.");
  if (!res.ok) throw new Error(`Could not load the setting. Please try again.`);
  return (await res.json()) as Participation;
}

export default function TransparencySettingsPage() {
  const en = useEn();
  const { getToken } = useAuth();
  const [state, setState] = useState<{ data: Participation | null; error: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    authenticatedFetch("/api/transparency/participation", {}, getToken)
      .then(readParticipation)
      .then((data) => active && setState({ data, error: null }))
      .catch((e) => active && setState({ data: null, error: e instanceof Error ? e.message : "Could not load the setting." }));
    return () => {
      active = false;
    };
  }, [getToken]);

  const toggle = async (include: boolean) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await authenticatedFetch("/api/transparency/participation", { method: "PUT", body: JSON.stringify({ includeOutcomeData: include }) }, getToken);
      const data = await readParticipation(res);
      setState({ data, error: null });
      setMessage({ ok: true, text: include ? "Your hire-outcome data will be included in future reports." : "Your hire-outcome data will not be included in future reports." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not save the setting." });
    } finally {
      setSaving(false);
    }
  };

  const data = state?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={en("Contribute to the public transparency report")}
        description={
          <>
            {en("The public")}{" "}
            <Link href="/transparency" className="inline-flex items-center gap-0.5 text-indigo-700 hover:underline dark:text-indigo-400">
              {en("transparency report ")}<ExternalLink aria-hidden="true" className="h-3 w-3" />
            </Link>{" "}
            {en("shows whether assessment scores predict on-the-job outcomes. That needs hire outcomes from employers like you. Taking part is optional and off by default.")}
          </>
        }
      />

      {state == null ? (
        <Loading />
      ) : state.error ? (
        <ErrorBanner error={state.error} />
      ) : data ? (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="participation-label" className="text-base font-semibold text-foreground">{en("Include our hire-outcome data")}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {en("{outcomesRecorded} outcome{value} recorded by your organization{value2}.", { outcomesRecorded: data.outcomesRecorded, value: data.outcomesRecorded === 1 ? "" : "s", value2: data.updatedAt ? ` · last changed ${formatDate(data.updatedAt)}` : "" })}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={data.includeOutcomeData}
              aria-labelledby="participation-label"
              disabled={saving}
              onClick={() => toggle(!data.includeOutcomeData)}
              style={data.includeOutcomeData ? { background: "var(--brand, #0e7490)", borderColor: "var(--brand, #0e7490)" } : undefined}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${
                data.includeOutcomeData ? "" : "border-border bg-muted"
              }`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${data.includeOutcomeData ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground max-w-3xl">{data.explanation}</p>
          <p className="text-xs text-muted-foreground">
            {en("Outcomes are recorded on the ")}<Link href="/recruiter/validity" className="text-indigo-700 dark:text-indigo-400 hover:underline">{en("validity and fairness")}</Link>{en(" page.")}
          </p>
          {saving && <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />{en("Saving…")}</p>}
          {message && (
            <p role="status" className={`flex items-center gap-1.5 text-sm ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
              {message.ok ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <AlertCircle aria-hidden="true" className="h-4 w-4" />} {message.text}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
