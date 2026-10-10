import type { Metadata } from "next";

// Brand-neutral: the page itself shows the issuing school's brand
export const metadata: Metadata = {
  title: "Verify an internship",
  description: "Check a verified internship credential and its live status.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function VerifyInternshipLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
