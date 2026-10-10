"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad } from "@/components/career/ui";
import { FERPA_CATEGORY_LABELS } from "@/components/career/coreLabels";

interface Settings {
  instituteId: string;
  slug: string;
  displayName: string;
  emailDomains: string;
  timeZone: string;
  studentSelfJoin: boolean;
  directoryInformation: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  contactEmail?: string | null;
  postalAddress?: string | null;
}

const TIME_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Puerto_Rico",
  "Asia/Kolkata",
];
const OTHER = "__other";

// Categories a school may reasonably publish as directory information
const DIRECTORY_CATEGORIES = ["Profile", "ContactInfo", "Education"];

export default function CareerCenterSettingsPage() {
  const api = useApi();
  const { me, schoolId } = useCareerShell();
  const { data, error, loading, reload } = useLoad(() => api<Settings>("/api/career/admin/settings"), [api, schoolId]);
  const [draft, setForm] = useState<Settings | null>(null);
  const form = draft ?? data ?? null;
  const [tzOther, setTzOther] = useState(false);
  const tzChoice = form && !tzOther && TIME_ZONES.includes(form.timeZone) ? form.timeZone : OTHER;
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = me?.memberships.some((m) => m.instituteId === schoolId && m.role === "CareerAdmin") ?? false;
  const dirCats = (form?.directoryInformation ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const toggleCat = (c: string, on: boolean) => {
    if (!form) return;
    const next = on ? Array.from(new Set([...dirCats, c])) : dirCats.filter((x) => x !== c);
    setForm({ ...form, directoryInformation: next.join(",") });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (form.primaryColor && !/^#[0-9a-fA-F]{6}$/.test(form.primaryColor)) {
      setErr("Primary color must look like #1a2b3c.");
      return;
    }
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const saved = await api<Settings>("/api/career/admin/settings", {
        method: "PUT",
        json: {
          displayName: form.displayName,
          emailDomains: form.emailDomains,
          timeZone: form.timeZone.trim(),
          studentSelfJoin: form.studentSelfJoin,
          directoryInformation: form.directoryInformation,
          contactEmail: form.contactEmail ?? "",
          logoUrl: form.logoUrl ?? "",
          // Empty text clears an optional field
          primaryColor: form.primaryColor ?? "",
          postalAddress: form.postalAddress ?? "",
        },
      });
      setForm(saved);
      setMsg("Settings saved.");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <Loading />;
  if (!form) return <ErrorBanner error={error ?? "Settings couldn't be loaded."} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Settings" description={isAdmin ? "How your school's career center appears and works." : "Only career center admins can change these settings."} />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <form onSubmit={save}>
        <fieldset disabled={!isAdmin} className="space-y-6">
          <Card title="School">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Display name">{(p) => <input {...p} required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />}</Field>
              <Field label="Contact email" hint="Shown to students and employers who need help.">
                {(p) => <input {...p} type="email" value={form.contactEmail ?? ""} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />}
              </Field>
              <Field label="Student email domains" hint="Comma-separated, for example state.edu, mail.state.edu. Each domain can belong to one school only.">
                {(p) => <input {...p} value={form.emailDomains} onChange={(e) => setForm({ ...form, emailDomains: e.target.value })} />}
              </Field>
              <div className="space-y-2">
                <Field label="Time zone">
                  {(p) => (
                    <select
                      {...p}
                      value={tzChoice}
                      onChange={(e) => {
                        setTzOther(e.target.value === OTHER);
                        if (e.target.value !== OTHER) setForm({ ...form, timeZone: e.target.value });
                      }}
                    >
                      {TIME_ZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                      <option value={OTHER}>Other…</option>
                    </select>
                  )}
                </Field>
                {tzChoice === OTHER && (
                  <Field label="Other time zone" hint="An IANA name such as Europe/London.">
                    {(p) => <input {...p} value={form.timeZone} onChange={(e) => setForm({ ...form, timeZone: e.target.value })} />}
                  </Field>
                )}
              </div>
              <div className="sm:col-span-2">
                <Field label="Postal address" hint="Printed at the bottom of campaign emails, as US anti-spam law (CAN-SPAM) requires. Leave empty to remove it.">
                  {(p) => <textarea {...p} rows={2} maxLength={500} value={form.postalAddress ?? ""} onChange={(e) => setForm({ ...form, postalAddress: e.target.value })} />}
                </Field>
              </div>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={form.studentSelfJoin} onChange={(e) => setForm({ ...form, studentSelfJoin: e.target.checked })} />
                <span>
                  Let students join on their own
                  <span className="block text-xs text-muted-foreground">Anyone who signs in with one of the email domains above becomes a student here.</span>
                </span>
              </label>
            </div>
          </Card>

          <Card title="Directory information">
            <fieldset>
              <legend className="mb-3 text-sm text-muted-foreground">
                Under FERPA, your school may share directory information with approved employers unless a student places a hold. Choose what counts as directory information.
              </legend>
              <div className="space-y-2">
                {DIRECTORY_CATEGORIES.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4" checked={dirCats.includes(c)} onChange={(e) => toggleCat(c, e.target.checked)} />
                    {FERPA_CATEGORY_LABELS[c]}
                  </label>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card title="Look">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Logo URL">{(p) => <input {...p} type="url" value={form.logoUrl ?? ""} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />}</Field>
              <Field label="Primary color" hint="Hex color, for example #4f46e5.">
                {(p) => (
                  <div className="flex gap-2">
                    <input
                      type="color"
                      aria-label="Pick primary color"
                      className="h-10 w-12 rounded border border-border"
                      value={/^#[0-9a-fA-F]{6}$/.test(form.primaryColor ?? "") ? form.primaryColor! : "#4f46e5"}
                      onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    />
                    <input {...p} value={form.primaryColor ?? ""} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
                  </div>
                )}
              </Field>
            </div>
          </Card>

          {isAdmin && <Button type="submit" busy={saving}>Save settings</Button>}
        </fieldset>
      </form>
    </div>
  );
}
