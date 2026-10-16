import type { Metadata } from "next";
import { cookies } from "next/headers";
import CareerI18nRoot from "@/components/career/i18n/CareerI18nRoot";
import { DEFAULT_CAREER_LOCALE, LOCALE_COOKIE, SCHOOL_LOCALE_COOKIE, matchCareerLocale } from "@/components/career/i18n/config";
import { loadCareerMessages, type CareerMessages } from "@/components/career/i18n/messages";

// Brand-neutral: the page itself shows the issuing school's brand. Title and description in the career language (G1).
export async function generateMetadata(): Promise<Metadata> {
  const jar = await cookies();
  const locale = matchCareerLocale(decodeURIComponent(jar.get(LOCALE_COOKIE)?.value ?? "")) ?? matchCareerLocale(decodeURIComponent(jar.get(SCHOOL_LOCALE_COOKIE)?.value ?? "")) ?? DEFAULT_CAREER_LOCALE;
  const messages = await loadCareerMessages(locale);
  const m = ((messages.Career as CareerMessages).verifyInternship as CareerMessages).meta as CareerMessages;
  return {
    title: m.title as string,
    description: m.description as string,
    referrer: "no-referrer",
    robots: { index: false, follow: false },
  };
}

export default function VerifyInternshipLayout({ children }: { children: React.ReactNode }) {
  // G1: no career shell, but the career language still applies
  return <CareerI18nRoot>{children}</CareerI18nRoot>;
}
