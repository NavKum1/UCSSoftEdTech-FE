"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Button, Card, ErrorBanner, Field, Loading, SuccessBanner, useCareerT, useLoad } from "@/components/career/ui";
import { availableCareerLocales, languageName } from "./config";

interface SchoolLocale {
  /** Stored school default; null = platform default. */
  defaultLocale: string | null;
  /** What applies today (stored value, else server configuration, else platform default). */
  effective: string;
  platformDefault: string;
  canEdit: boolean;
  supported: { locale: string; dir: "ltr" | "rtl"; pseudo: boolean }[];
}

const PLATFORM = "";

/**
 * G1: the school's default career-suite language (InstituteCareerSettings.DefaultLocale), for people who have not chosen
 * their own. Career admins change it; other staff see it read-only. Saved on its own (PUT /api/career/locale/school).
 */
export default function SchoolLanguageSetting({ schoolId }: { schoolId: string | null }) {
  const api = useApi();
  const t = useCareerT("schoolLanguage");
  const { data, error, loading, reload } = useLoad(() => api<SchoolLocale>("/api/career/locale/school"), [api, schoolId]);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBanner error={error ? t("loadError") : null} onRetry={reload} />;

  // Only languages this web app can show (pseudo-locales only where the app enables them)
  const webLocales = availableCareerLocales();
  const options = data.supported.map((s) => s.locale).filter((l) => webLocales.includes(l));
  const value = draft ?? data.defaultLocale ?? PLATFORM;

  const save = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await api<SchoolLocale>("/api/career/locale/school", { method: "PUT", json: { locale: value === PLATFORM ? null : value } });
      setDraft(null);
      setMsg(t("saved"));
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={t("title")}>
      <p className="mb-4 text-sm text-muted-foreground">{data.canEdit ? t("description") : t("adminOnly")}</p>
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <div className="max-w-md space-y-3">
        <Field label={t("label")} hint={t("hint")}>
          {(p) => (
            <select {...p} value={value} disabled={!data.canEdit} onChange={(e) => setDraft(e.target.value)}>
              <option value={PLATFORM}>{t("platformDefault", { language: languageName(data.platformDefault) })}</option>
              {options.map((l) => (
                // Each language is named in itself so people can find their own
                <option key={l} value={l} lang={l}>
                  {languageName(l)}
                </option>
              ))}
            </select>
          )}
        </Field>
        {data.defaultLocale === null && data.effective !== data.platformDefault && (
          <p className="text-sm">{t("configured", { language: languageName(data.effective) })}</p>
        )}
        {data.canEdit && (
          <Button type="button" busy={saving} onClick={save}>
            {t("save")}
          </Button>
        )}
      </div>
    </Card>
  );
}
