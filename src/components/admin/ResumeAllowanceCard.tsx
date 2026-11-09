"use client";

/**
 * The résumé AI allowance (docs/resume_tools_plan_nov2026.md, item 7): uses of AI help per person per month, for free
 * members (and free-tier students), Pro members, and students at a school on a paid plan. A person who is two of these gets
 * the larger number. API: /api/admin/platform/resume-allowance.
 */
import React, { useEffect, useState } from "react";
import { useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, Card, ErrorBanner, Field, SuccessBanner } from "@/components/career/ui";

interface Limits { free: number; pro: number; student: number }

export default function ResumeAllowanceCard() {
  const en = useEn();
  const { apiFetch, ready } = useLegacyApi();
  const [limits, setLimits] = useState<Limits | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const loadRef = useLatestRef(async () => {
    const res = await apiFetch("/api/admin/platform/resume-allowance");
    if (res.ok) setLimits((await res.json()) as Limits);
    else setError(en("The limits couldn't be loaded."));
  });
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limits) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await apiFetch("/api/admin/platform/resume-allowance", { method: "PUT", body: JSON.stringify(limits) });
      if (!res.ok) setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? en("That didn't work. Please try again."));
      else setSaved(en("Saved. New limits apply within a minute."));
    } catch {
      setError(en("We couldn't reach the server. Please check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  const fields: { key: keyof Limits; label: string; hint: string }[] = [
    { key: "free", label: en("Free members"), hint: en("Also students on the free plan without a school.") },
    { key: "pro", label: en("Pro members"), hint: en("Members on the Pro plan.") },
    { key: "student", label: en("Students at paying schools"), hint: en("Schools on a paid plan or a contract.") },
  ];

  return (
    <Card title={en("Résumé AI help")}>
      <p className="mb-4 text-sm text-muted-foreground">
        {en("How many times a month each person can use AI help with résumés (suggested requirements now; feedback, tailoring and cover letters later). Everything without AI stays free. A school's own AI allowance still applies.")}
      </p>
      <ErrorBanner error={error} />
      <SuccessBanner message={saved} />
      {limits && (
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                {(p) => (
                  <input {...p} type="number" min={0} max={1000} value={limits[f.key]} onChange={(e) => setLimits({ ...limits, [f.key]: Math.max(0, Number(e.target.value) || 0) })} />
                )}
              </Field>
            ))}
          </div>
          <Button type="submit" busy={busy}>{en("Save limits")}</Button>
        </form>
      )}
    </Card>
  );
}
