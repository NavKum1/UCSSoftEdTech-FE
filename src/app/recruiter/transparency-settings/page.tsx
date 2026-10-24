"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { AlertCircle, CheckCircle2, ExternalLink, FileBarChart, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/transparency";

interface Participation {
  includeOutcomeData: boolean;
  updatedAt: string | null;
  outcomesRecorded: number;
  explanation: string;
}

async function readParticipation(res: Response): Promise<Participation> {
  if (res.status === 401 || res.status === 403) throw new Error("You need recruiter or institute admin access to change this setting.");
  if (!res.ok) throw new Error(`Could not load the setting (HTTP ${res.status}).`);
  return (await res.json()) as Participation;
}

export default function TransparencySettingsPage() {
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
    <div className="space-y-6 max-w-3xl">
      <div className="pb-4 border-b border-border">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
          <FileBarChart className="w-4 h-4" /> Transparency
        </div>
        <h1 className="text-2xl font-extrabold text-foreground mt-1">Contribute to the public transparency report</h1>
        <p className="text-xs text-muted-foreground mt-1">
          The public{" "}
          <Link href="/transparency" className="text-indigo-700 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5">
            transparency report <ExternalLink className="w-3 h-3" />
          </Link>{" "}
          shows whether assessment scores predict on-the-job outcomes. That needs hire outcomes from employers like you. Taking part is optional and off by default.
        </p>
      </div>

      {state == null ? (
        <div className="glass-panel rounded-2xl border border-border py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : state.error ? (
        <div className="glass-panel rounded-2xl border border-border p-6 text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {state.error}
        </div>
      ) : data ? (
        <div className="glass-panel rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="participation-label" className="text-sm font-bold text-foreground">Include our hire-outcome data</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.outcomesRecorded} outcome{data.outcomesRecorded === 1 ? "" : "s"} recorded by your organisation
                {data.updatedAt ? ` · last changed ${formatDate(data.updatedAt)}` : ""}.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={data.includeOutcomeData}
              aria-labelledby="participation-label"
              disabled={saving}
              onClick={() => toggle(!data.includeOutcomeData)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors cursor-pointer disabled:opacity-50 ${
                data.includeOutcomeData ? "bg-indigo-600 border-indigo-600" : "bg-muted border-border"
              }`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${data.includeOutcomeData ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">{data.explanation}</p>
          <p className="text-xs text-muted-foreground">
            Outcomes are recorded on the <Link href="/recruiter/validity" className="text-indigo-700 dark:text-indigo-400 hover:underline">validity &amp; fairness</Link> page.
          </p>
          {saving && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</p>}
          {message && (
            <p className={`text-xs flex items-center gap-1.5 ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
              {message.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />} {message.text}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
