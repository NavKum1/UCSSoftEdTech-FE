"use client";

/** Company profile fields, used for employer sign-up and the company page. */

import React, { useState } from "react";
import { Button, Field, useCareerT } from "@/components/career/ui";

export interface CompanyValues {
  name: string;
  website: string;
  industry: string;
  sizeBand: string;
  description: string;
  logoUrl: string;
  hqCity: string;
  hqState: string;
  hqCountry: string;
  title?: string;
}

export const SIZE_BANDS = ["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+"];

export const emptyCompany: CompanyValues = { name: "", website: "", industry: "", sizeBand: "", description: "", logoUrl: "", hqCity: "", hqState: "", hqCountry: "US", title: "" };

export default function CompanyForm({
  initial,
  submitLabel,
  busy,
  disabled,
  withTitle,
  onSubmit,
}: {
  initial: CompanyValues;
  submitLabel: string;
  busy?: boolean;
  disabled?: boolean;
  withTitle?: boolean;
  onSubmit: (v: CompanyValues) => void;
}) {
  const t = useCareerT("companyForm");
  const [v, setV] = useState<CompanyValues>(initial);
  const set = (k: keyof CompanyValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
        <Field label={t("companyName")}>{(p) => <input {...p} required value={v.name} onChange={set("name")} autoComplete="organization" />}</Field>
        <Field label={t("website")} hint={t("weCompareItWithYour")}>
          {(p) => <input {...p} value={v.website} onChange={set("website")} placeholder={t("httpsExampleCom")} inputMode="url" />}
        </Field>
        <Field label={t("industry")}>{(p) => <input {...p} value={v.industry} onChange={set("industry")} />}</Field>
        <Field label={t("companySize")}>
          {(p) => (
            <select {...p} value={v.sizeBand} onChange={set("sizeBand")}>
              <option value="">{t("notSpecified")}</option>
              {SIZE_BANDS.map((s) => (
                <option key={s} value={s}>
                  {t("sEmployees", { s })}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("headquartersCity")}>{(p) => <input {...p} value={v.hqCity} onChange={set("hqCity")} />}</Field>
        <Field label={t("stateOrRegion")}>{(p) => <input {...p} value={v.hqState} onChange={set("hqState")} />}</Field>
        <Field label={t("countryCode")} hint={t("twoLettersForExampleUS")}>
          {(p) => <input {...p} value={v.hqCountry} maxLength={2} onChange={(e) => setV({ ...v, hqCountry: e.target.value.toUpperCase() })} />}
        </Field>
        <Field label={t("logoURL")}>{(p) => <input {...p} type="url" value={v.logoUrl} onChange={set("logoUrl")} />}</Field>
        {withTitle && <Field label={t("yourJobTitle")}>{(p) => <input {...p} value={v.title ?? ""} onChange={set("title")} autoComplete="organization-title" />}</Field>}
        <div className="sm:col-span-2">
          <Field label={t("aboutTheCompany")}>{(p) => <textarea {...p} rows={4} value={v.description} onChange={set("description")} />}</Field>
        </div>
        {!disabled && (
          <div className="sm:col-span-2">
            <Button type="submit" busy={busy}>
              {submitLabel}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}

/** Blank strings become null so optional fields stay unset on create. */
export function companyPayload(v: CompanyValues) {
  const n = (s?: string) => (s && s.trim() ? s.trim() : null);
  return {
    name: v.name.trim(),
    website: n(v.website),
    industry: n(v.industry),
    sizeBand: n(v.sizeBand),
    description: n(v.description),
    logoUrl: n(v.logoUrl),
    hqCity: n(v.hqCity),
    hqState: n(v.hqState),
    hqCountry: n(v.hqCountry),
    title: n(v.title),
  };
}
