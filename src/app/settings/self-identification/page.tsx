"use client";

import React, { useEffect, useState } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { Scale, Loader2, CheckCircle2, AlertTriangle, Trash2, Lock } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import SignInRequired from "@/components/SignInRequired";

const PREFER_NOT = "Prefer not to say";

type FieldKey = "gender" | "raceEthnicity" | "ageBand" | "disability";

const FIELDS: Array<{ key: FieldKey; label: string; options: string[] }> = [
  {
    key: "gender",
    label: "Gender",
    options: ["Woman", "Man", "Non-binary", "Another gender identity", PREFER_NOT],
  },
  {
    key: "raceEthnicity",
    label: "Race / ethnicity",
    options: [
      "American Indian or Alaska Native",
      "Asian",
      "Black or African American",
      "Hispanic or Latino",
      "Middle Eastern or North African",
      "Native Hawaiian or Other Pacific Islander",
      "White",
      "Two or more races or ethnicities",
      "Another race or ethnicity",
      PREFER_NOT,
    ],
  },
  {
    key: "ageBand",
    label: "Age",
    options: ["Under 25", "25-39", "40-49", "50-59", "60 or over", PREFER_NOT],
  },
  {
    key: "disability",
    label: "Disability",
    options: ["Yes, I have a disability (or previously had one)", "No, I don't have a disability", PREFER_NOT],
  },
];

interface SavedAnswers {
  gender?: string | null;
  raceEthnicity?: string | null;
  ageBand?: string | null;
  disability?: string | null;
  consentedAt?: string | null;
}

// Resolves to null when nothing is saved (the API answers 204/empty or a JSON null)
async function fetchSavedAnswers(getToken: () => Promise<string | null>): Promise<SavedAnswers | null> {
  try {
    const res = await authenticatedFetch("/api/validity/self-identification", {}, getToken);
    if (!res.ok || res.status === 204) return null;
    const text = await res.text();
    return text ? ((JSON.parse(text) as SavedAnswers | null) ?? null) : null;
  } catch {
    return null;
  }
}

const EMPTY: Record<FieldKey, string> = {
  gender: PREFER_NOT,
  raceEthnicity: PREFER_NOT,
  ageBand: PREFER_NOT,
  disability: PREFER_NOT,
};

export default function SelfIdentificationPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [values, setValues] = useState<Record<FieldKey, string>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetchSavedAnswers(getToken).then((saved) => {
      if (cancelled) return;
      if (saved) {
        setValues({
          gender: saved.gender || PREFER_NOT,
          raceEthnicity: saved.raceEthnicity || PREFER_NOT,
          ageBand: saved.ageBand || PREFER_NOT,
          disability: saved.disability || PREFER_NOT,
        });
        setSavedAt(saved.consentedAt ?? null);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await authenticatedFetch(
        "/api/validity/self-identification",
        { method: "PUT", body: JSON.stringify(values) },
        getToken
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedAt(new Date().toISOString());
      setMessage({ kind: "ok", text: "Saved. Thank you — your answers are used only in aggregate fairness audits." });
    } catch {
      setMessage({ kind: "error", text: "Could not save your answers. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setMessage(null);
    try {
      const res = await authenticatedFetch("/api/validity/self-identification", { method: "DELETE" }, getToken);
      if (res.status === 404) {
        setMessage({ kind: "ok", text: "There was nothing saved to delete." });
      } else if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      } else {
        setValues(EMPTY);
        setSavedAt(null);
        setMessage({ kind: "ok", text: "Your self-identification answers have been deleted." });
      }
    } catch {
      setMessage({ kind: "error", text: "Could not delete your answers. Please try again." });
    } finally {
      setDeleting(false);
    }
  };

  if (isLoaded && !isSignedIn) {
    return (
      <SignInRequired title="Voluntary self-identification" message="Sign in to manage your answers." />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Scale className="w-6 h-6 text-indigo-700 dark:text-indigo-400" />
            Voluntary self-identification
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Help us check that our assessments treat every group fairly.</p>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-border space-y-2 text-sm text-muted-foreground">
          <p className="flex items-start gap-2 text-foreground font-semibold">
            <Lock className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Completely optional, and it never affects your results.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your answers are never shown to reviewers or employers individually.</li>
            <li>
              They are used only in aggregate fairness audits that compare scoring and selection rates between groups. Groups too
              small to protect anonymity are suppressed.
            </li>
            <li>Every question has a &ldquo;Prefer not to say&rdquo; option, and you can delete your answers at any time.</li>
          </ul>
          {savedAt && (
            <p className="text-xs">Last saved {new Date(savedAt).toLocaleDateString()}. Saving again replaces your previous answers.</p>
          )}
        </div>

        <form onSubmit={handleSave} className="glass-panel rounded-2xl p-5 border border-border space-y-4">
          {FIELDS.map((field) => (
            <label key={field.key} className="block space-y-1">
              <span className="text-xs font-semibold text-foreground">{field.label}</span>
              <select
                value={values[field.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                {(field.options.includes(values[field.key]) ? field.options : [values[field.key], ...field.options]).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          ))}

          {message && (
            <p
              className={`text-xs flex items-center gap-1.5 ${
                message.kind === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
              }`}
            >
              {message.kind === "ok" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {message.text}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || deleting || !loaded}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save answers
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || deleting || !loaded}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-60 text-sm font-semibold"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete my answers
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
