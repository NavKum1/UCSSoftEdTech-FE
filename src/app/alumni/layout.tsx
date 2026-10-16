import type { Metadata } from "next";
import CareerShell from "@/components/career/CareerShell";
import CareerI18nRoot from "@/components/career/i18n/CareerI18nRoot";
import CareerMobileRoot from "@/components/career/mobile/CareerMobileRoot";

// G10: installable web app (brand-aware manifest) and data saver
export const metadata: Metadata = { manifest: "/career.webmanifest?persona=alumni" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <CareerI18nRoot>
      <CareerMobileRoot>
        <CareerShell persona="alumni">{children}</CareerShell>
      </CareerMobileRoot>
    </CareerI18nRoot>
  );
}
