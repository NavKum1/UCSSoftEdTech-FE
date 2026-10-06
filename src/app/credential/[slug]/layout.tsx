import { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  
  // Base URL resolution
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3000";
  const ogImageUrl = `${baseUrl}/api/og/credential/${slug}`;
  const pageUrl = `${baseUrl}/credential/${slug}`;

  return {
    title: "Verified Credential | Build & Defend",
    description: "View this verified Build & Defend architectural engineering credential.",
    openGraph: {
      title: "Verified Credential | Build & Defend",
      description: "View this verified Build & Defend architectural engineering credential.",
      url: pageUrl,
      siteName: "Build & Defend",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "Build & Defend Verified Credential",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Verified Credential | Build & Defend",
      description: "View this verified Build & Defend architectural engineering credential.",
      images: [ogImageUrl],
    },
  };
}

export default function CredentialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
