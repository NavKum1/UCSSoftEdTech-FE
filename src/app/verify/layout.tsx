import type { Metadata } from "next";

// Share links carry a bearer token in the URL: keep them out of referrers and search indexes
export const metadata: Metadata = {
  title: "Verify a credential | Edulexa",
  description: "Check an Edulexa Build & Defend credential and the evidence its holder chose to share.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
