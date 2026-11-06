import { useMemo } from "react";
import { useApi } from "@/lib/appAuth";
import { useLoad } from "@/components/career/ui";
import { useCareerShell } from "@/components/career/CareerShell";
import { useCareerFormat, useCareerT } from "@/components/career/i18n/CareerI18nProvider";
import { inrFull, inrGrouped, inrShort } from "@/components/career/placements/shared";

/**
 * P5 (5 Nov 2026): what the school's country changes in the career suite, in one place.
 * India keeps what it has always had: rupees with lakh and crore, CTC and LPA, CGPA out of 10, backlogs, dream and
 * super-dream tiers. The US gets GPA out of 4.0. Every other country gets neutral defaults: its own currency with normal
 * grouping, "salary per year", a minimum grade on the school's own scale, and no backlogs or tiers.
 * 6 Nov 2026: every job, drive, offer and offer letter carries its own currency (ISO 4217), so an amount is shown in that
 * currency (moneyIn / moneyFullIn); the school's (or, on an employer's pages, the head office's) currency is only the
 * fallback for a record without one.
 */

// Euro area (ISO 3166-1 alpha-2)
const EURO = new Set(["AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"]);

// Country -> ISO 4217 currency (the same table the API uses for plans and payouts); others fall back to USD
const CURRENCY: Record<string, string> = {
  US: "USD", IN: "INR", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", SG: "SGD", AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD",
  OM: "OMR", EG: "EGP", MX: "MXN", BR: "BRL", AR: "ARS", CO: "COP", CL: "CLP", PE: "PEN", ZA: "ZAR", NG: "NGN", KE: "KES", GH: "GHS",
  PH: "PHP", MY: "MYR", ID: "IDR", TH: "THB", VN: "VND", JP: "JPY", KR: "KRW", CN: "CNY", HK: "HKD", TW: "TWD", PK: "PKR", BD: "BDT",
  LK: "LKR", NP: "NPR", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", TR: "TRY", IL: "ILS",
};

// A round yearly salary to show in input hints, per currency (an example, not data)
const SALARY_EXAMPLE: Record<string, number> = {
  USD: 60000, GBP: 32000, EUR: 40000, CAD: 65000, AUD: 75000, NZD: 65000, SGD: 54000, AED: 180000, SAR: 180000, QAR: 180000,
  MYR: 48000, PHP: 420000, ZAR: 350000, KES: 1200000, NGN: 6000000, JPY: 4000000, CHF: 85000,
};

const norm = (country?: string | null) => (country ?? "").trim().toUpperCase();

/** Every currency the API accepts for a job, drive or offer (the same table, the euro included), sorted for a picker. */
export const CURRENCIES: string[] = Array.from(new Set([...Object.values(CURRENCY), "EUR"])).sort();

/** A round yearly salary in this currency for input hints (as typed, not formatted). */
export function salaryExampleFor(currency: string): string {
  return currency === "INR" ? "1200000" : String(SALARY_EXAMPLE[currency] ?? 60000);
}

export const isIndia = (country?: string | null) => norm(country) === "IN";
export const isUS = (country?: string | null) => norm(country) === "US";

/** The country's currency (USD when the country has no mapping or isn't known). */
export function currencyFor(country?: string | null): string {
  const c = norm(country);
  return EURO.has(c) ? "EUR" : CURRENCY[c] ?? "USD";
}

/** How the school records grades: India CGPA out of 10, US GPA out of 4.0, elsewhere a number on the school's own scale (up to 100). */
export type GradeScale = "cgpa10" | "gpa4" | "free";
export function gradeScaleFor(country?: string | null): { scale: GradeScale; max: number } {
  if (isIndia(country)) return { scale: "cgpa10", max: 10 };
  if (isUS(country)) return { scale: "gpa4", max: 4 };
  return { scale: "free", max: 100 };
}

/** A sample mobile number with the country code, for hints. */
export function phoneExampleFor(country?: string | null): string {
  const c = norm(country);
  if (c === "IN") return "+91 98765 43210";
  if (c === "GB") return "+44 20 7946 0958";
  return "+1 202 555 0143";
}

function plainMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString(locale)}`;
  }
}

/** An amount in the country's currency: India "₹12 lakh", elsewhere "$60,000" (the page language's grouping). */
export function formatMoney(amount: number | null | undefined, country: string | null | undefined, locale: string): string {
  if (amount === null || amount === undefined) return "—";
  return isIndia(country) ? inrShort(amount) : plainMoney(amount, currencyFor(country), locale);
}

/** An amount in its own currency: rupees "₹12 lakh" (as before), anything else "$120,000" in the page language's grouping. */
export function formatMoneyIn(amount: number | null | undefined, currency: string, locale: string): string {
  if (amount === null || amount === undefined) return "—";
  return currency === "INR" ? inrShort(amount) : plainMoney(amount, currency, locale);
}

/** A full amount in its own currency: rupees "₹12 lakh (₹12,00,000)", anything else the same as formatMoneyIn. */
export function formatMoneyFullIn(amount: number | null | undefined, currency: string, locale: string): string {
  if (amount === null || amount === undefined) return "—";
  return currency === "INR" ? inrFull(amount) : plainMoney(amount, currency, locale);
}

/** A full amount: India "₹12 lakh (₹12,00,000)", elsewhere the same as formatMoney. */
export function formatMoneyFull(amount: number | null | undefined, country: string | null | undefined, locale: string): string {
  if (amount === null || amount === undefined) return "—";
  return isIndia(country) ? inrFull(amount) : plainMoney(amount, currencyFor(country), locale);
}

export interface CountryRules {
  // ISO code of the country in use; null while the school isn't known yet
  country: string | null;
  india: boolean;
  us: boolean;
  currency: string;
  /** Short display, e.g. "₹12 lakh" or "$60,000" */
  money: (amount: number | null | undefined) => string;
  /** Full display, e.g. "₹12 lakh (₹12,00,000)" or "$60,000" */
  moneyFull: (amount: number | null | undefined) => string;
  /** Exact amount with grouping, e.g. "₹12,00,000" or "$60,000" */
  moneyExact: (amount: number | null | undefined) => string;
  /** An amount in a record's own currency (a job's, drive's, offer's); without one, the same as money */
  moneyIn: (amount: number | null | undefined, currency?: string | null) => string;
  /** A full amount in a record's own currency; without one, the same as moneyFull */
  moneyFullIn: (amount: number | null | undefined, currency?: string | null) => string;
  /** Example yearly salary for hints, e.g. "60000" (not formatted, as typed) */
  salaryExample: string;
  grade: { scale: GradeScale; max: number };
  phoneExample: string;
}

/**
 * The rules for the school in use (from the career shell), or for an explicit country (an employer's head office).
 * While the school is loading the rules are neutral (no rupees), so India-only words never flash for other schools.
 */
export function useCountryRules(explicit?: string | null): CountryRules {
  const { schoolCountry } = useCareerShell();
  const { locale } = useCareerFormat();
  const country = explicit !== undefined ? (explicit ? norm(explicit) : null) : schoolCountry ? norm(schoolCountry) : null;
  return useMemo(() => {
    const india = isIndia(country);
    const currency = currencyFor(country);
    return {
      country,
      india,
      us: isUS(country),
      currency,
      money: (a) => formatMoney(a, country, locale),
      moneyFull: (a) => formatMoneyFull(a, country, locale),
      moneyExact: (a) => (a === null || a === undefined ? "—" : india ? `₹${inrGrouped(a)}` : plainMoney(a, currency, locale)),
      moneyIn: (a, cur) => (cur ? formatMoneyIn(a, cur.toUpperCase(), locale) : formatMoney(a, country, locale)),
      moneyFullIn: (a, cur) => (cur ? formatMoneyFullIn(a, cur.toUpperCase(), locale) : formatMoneyFull(a, country, locale)),
      salaryExample: india ? "1200000" : String(SALARY_EXAMPLE[currency] ?? 60000),
      grade: gradeScaleFor(country),
      phoneExample: phoneExampleFor(country),
    };
  }, [country, locale]);
}

/**
 * Words for schools outside India (Career.countryWords). India keeps each page's own words (CTC, CGPA, branches), so a
 * page picks: rules.india ? its own key : the neutral word from here.
 */
export function useCountryWords(explicit?: string | null) {
  const rules = useCountryRules(explicit);
  const t = useCareerT("countryWords");
  return useMemo(() => {
    const ex = { currency: rules.currency, example: rules.salaryExample };
    const gpa = rules.grade.scale === "gpa4";
    return {
      rules,
      t,
      salaryPerYear: t("salaryPerYear"),
      salaryPerYearCurrency: t("salaryPerYearCurrency", { currency: rules.currency }),
      salaryHint: t("salaryHint", ex),
      salaryFromRoleHint: t("salaryFromRoleHint", ex),
      salaryFromDriveHint: t("salaryFromDriveHint", ex),
      stipendPerMonth: t("stipendPerMonth", { currency: rules.currency }),
      programs: t("programs"),
      program: t("program"),
      programsHint: t("programsHint"),
      minGrade: gpa ? t("minGpa") : t("minGrade"),
      minGradeHint: gpa ? undefined : t("minGradeHint"),
      grade: gpa ? t("gpa") : t("grade"),
      gradeAtLeast: (value: number | string) => (gpa ? t("gpaAtLeast", { value }) : t("gradeAtLeast", { value })),
      applicantGrade: (grade: number | string) => (gpa ? t("applicantGpa", { grade }) : t("applicantGrade", { grade })),
      criteria: (programs: string, grade: number | string, batches: string) =>
        gpa ? t("criteriaGpa", { programs, grade, batches }) : t("criteriaGrade", { programs, grade, batches }),
      phoneHint: t("phoneHint", { example: rules.phoneExample }),
      /** The pay labels and hints for amounts in a given currency (a job's own, or the one chosen on a form) */
      payIn: (currency: string) => {
        const e = { currency, example: salaryExampleFor(currency) };
        return {
          salaryPerYearCurrency: t("salaryPerYearCurrency", { currency }),
          salaryHint: t("salaryHint", e),
          salaryFromDriveHint: t("salaryFromDriveHint", e),
          salaryFromRoleHint: t("salaryFromRoleHint", e),
          stipendPerMonth: t("stipendPerMonth", { currency }),
        };
      },
    };
  }, [rules, t]);
}

/**
 * P13: the privacy law named on the privacy pages. US schools keep the FERPA wording (us = true); other schools get the
 * law of their privacy pack (for example "India DPDP Act 2023" or "UK GDPR"), or null when no pack names one.
 */
export function usePrivacyLaw(source: "staff" | "student"): { us: boolean; law: string | null } {
  const { schoolCountry, schoolId } = useCareerShell();
  const api = useApi();
  const us = isUS(schoolCountry);
  const loaded = useLoad<string | null>(async () => {
    if (!schoolCountry || us) return null;
    try {
      const law =
        source === "staff"
          ? (await api<{ effective?: { law?: string | null } }>("/api/career/privacy/admin/policy")).effective?.law
          : (await api<{ policy?: { law?: string | null } }>("/api/career/privacy/student")).policy?.law;
      return law && law !== "Default" ? law : null;
    } catch {
      return null;
    }
  }, [api, schoolId, schoolCountry, us, source]);
  return { us, law: loaded.data ?? null };
}
