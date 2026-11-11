"use client";

import { timeZoneOption } from "@/lib/timeZoneName";
import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad, useCareerT } from "@/components/career/ui";
import { useFerpaCategoryLabels } from "@/components/career/coreLabels";
import { usePrivacyLaw } from "@/components/career/country";
import SchoolLanguageSetting from "@/components/career/i18n/SchoolLanguageSetting";
import { useEn } from "@/lib/english/EnglishProvider";

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
  partnerKey?: string | null;
  // Résumé rules (stage 2): null = the default (on for direct schools, off for partner schools)
  resumeToolsEnabled?: boolean | null;
  resumeTemplate?: string;
  resumePageLimit?: number | null;
  resumeApprovalRequired?: boolean;
  resumeBookEnabled?: boolean;
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
  const t = useCareerT("careerCenterSettings");
  const en = useEn();
  const FERPA_CATEGORY_LABELS = useFerpaCategoryLabels();
  const api = useApi();
  const { me, schoolId } = useCareerShell();
  // P13: FERPA wording for US schools only; others name their own privacy law
  const privacy = usePrivacyLaw("staff");
  const tw = useCareerT("countryWords");
  const { data, error, loading, reload } = useLoad(() => api<Settings>("/api/career/admin/settings"), [api, schoolId]);
  const [draft, setForm] = useState<Settings | null>(null);
  const form = draft ?? data ?? null;
  const [tzOther, setTzOther] = useState(false);
  const tzChoice = form && !tzOther && TIME_ZONES.includes(form.timeZone) ? form.timeZone : OTHER;
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toolsTouched, setToolsTouched] = useState(false);

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
      setErr(t("primaryColorMustLookLike"));
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
          // Sent only when changed here, so a school left on the default keeps following it
          resumeToolsEnabled: toolsTouched ? form.resumeToolsEnabled : undefined,
          resumeTemplate: form.resumeTemplate ?? "classic",
          resumePageLimit: form.resumePageLimit ?? 0,
          resumeApprovalRequired: !!form.resumeApprovalRequired,
          resumeBookEnabled: !!form.resumeBookEnabled,
        },
      });
      setForm(saved);
      setMsg(t("settingsSaved"));
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <Loading />;
  if (!form) return <ErrorBanner error={error ?? t("settingsCouldntBeLoaded")} onRetry={reload} />;

  return (
    <div>
      <PageHeader title={t("settings")} description={isAdmin ? t("howYourSchoolsCareerCenter") : t("onlyCareerCenterAdminsCan")} />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <form onSubmit={save}>
        <fieldset disabled={!isAdmin} className="space-y-6">
          <Card title={t("school")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("displayName")}>{(p) => <input {...p} required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />}</Field>
              <Field label={t("contactEmail")} hint={t("shownToStudentsAndEmployers")}>
                {(p) => <input {...p} type="email" value={form.contactEmail ?? ""} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />}
              </Field>
              <Field label={t("studentEmailDomains")} hint={t("commaSeparatedForExampleState")}>
                {(p) => <input {...p} value={form.emailDomains} onChange={(e) => setForm({ ...form, emailDomains: e.target.value })} />}
              </Field>
              <div className="space-y-2">
                <Field label={t("timeZone")}>
                  {(p) => (
                    <select
                      {...p}
                      value={tzChoice}
                      onChange={(e) => {
                        setTzOther(e.target.value === OTHER);
                        if (e.target.value !== OTHER) setForm({ ...form, timeZone: e.target.value });
                      }}
                    >
                      {TIME_ZONES.map((z) => <option key={z} value={z}>{timeZoneOption(z)}</option>)}
                      <option value={OTHER}>{t("other")}</option>
                    </select>
                  )}
                </Field>
                {tzChoice === OTHER && (
                  <Field label={t("otherTimeZone")} hint={t("anIANANameSuchAs")}>
                    {(p) => <input {...p} value={form.timeZone} onChange={(e) => setForm({ ...form, timeZone: e.target.value })} />}
                  </Field>
                )}
              </div>
              <div className="sm:col-span-2">
                <Field label={t("postalAddress")} hint={t("printedAtTheBottomOf")}>
                  {(p) => <textarea {...p} rows={2} maxLength={500} value={form.postalAddress ?? ""} onChange={(e) => setForm({ ...form, postalAddress: e.target.value })} />}
                </Field>
              </div>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={form.studentSelfJoin} onChange={(e) => setForm({ ...form, studentSelfJoin: e.target.checked })} />
                <span>
                  {t.rich("letStudentsJoinOnTheir", { span: (chunks) => <span className="block text-xs text-muted-foreground">{chunks}</span> })}
                </span>
              </label>
            </div>
          </Card>

          <Card title={t("directoryInformation")}>
            <fieldset>
              <legend className="mb-3 text-sm text-muted-foreground">
                {privacy.us ? t("underFERPAYourSchoolMay") : privacy.law ? tw("privacySettingsLaw", { law: privacy.law }) : tw("privacySettingsNoLaw")}
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

          <Card title={t("look")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("logoURL")}>{(p) => <input {...p} type="url" value={form.logoUrl ?? ""} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />}</Field>
              <Field label={t("primaryColor")} hint={t("hexColorForExample4f46e5")}>
                {(p) => (
                  <div className="flex gap-2">
                    <input
                      type="color"
                      aria-label={t("pickPrimaryColor")}
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

          <Card title={en("Résumés")}>
            <div className="space-y-4">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={form.resumeToolsEnabled ?? !form.partnerKey}
                  onChange={(e) => {
                    setToolsTouched(true);
                    setForm({ ...form, resumeToolsEnabled: e.target.checked });
                  }}
                />
                <span>
                  {en("Students use Edulexa's résumé tools")}
                  <span className="block text-xs text-muted-foreground">
                    {en("Their résumé library and builder, and \"From your library\" in applications, document review and interview sign-up. Turn this off if your students use another résumé tool.")}
                  </span>
                </span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={en("Résumé template")} hint={en("Used for the résumés your students build and export.")}>
                  {(p) => (
                    <select {...p} value={form.resumeTemplate ?? "classic"} onChange={(e) => setForm({ ...form, resumeTemplate: e.target.value })}>
                      <option value="classic">{en("Classic: centered name, roomy spacing")}</option>
                      <option value="compact">{en("Compact: more on each page")}</option>
                    </select>
                  )}
                </Field>
                <Field label={en("Page limit")} hint={en("Students are warned when a résumé runs past it.")}>
                  {(p) => (
                    <select {...p} value={String(form.resumePageLimit ?? 0)} onChange={(e) => setForm({ ...form, resumePageLimit: Number(e.target.value) || null })}>
                      <option value="0">{en("No limit")}</option>
                      <option value="1">{en("One page")}</option>
                      <option value="2">{en("Two pages")}</option>
                    </select>
                  )}
                </Field>
              </div>
              {(form.resumeToolsEnabled ?? !form.partnerKey) && (
                <div className="space-y-4 border-t border-border pt-4">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4" checked={!!form.resumeApprovalRequired} onChange={(e) => setForm({ ...form, resumeApprovalRequired: e.target.checked })} />
                    <span>
                      {en("Campus applications need an approved résumé")}
                      <span className="block text-xs text-muted-foreground">
                        {en("Reviewers approve a résumé when they return a document review. Students then apply with that version.")}
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4" checked={!!form.resumeBookEnabled} onChange={(e) => setForm({ ...form, resumeBookEnabled: e.target.checked })} />
                    <span>
                      {en("Open the résumé book")}
                      <span className="block text-xs text-muted-foreground">
                        {en("Students who choose to can add a résumé. Employers you approved browse by program and graduation year, and every résumé they open is logged.")}
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </div>
          </Card>

          {isAdmin && <Button type="submit" busy={saving}>{t("saveSettings")}</Button>}
        </fieldset>
      </form>
      {/* Saved on its own (PUT /api/career/locale/school), so it sits outside the settings form */}
      <div className="mt-6">
        <SchoolLanguageSetting schoolId={schoolId} />
      </div>
    </div>
  );
}
