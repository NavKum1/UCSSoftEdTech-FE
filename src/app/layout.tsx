import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { AppAuthProvider } from "@/lib/appAuth";
import GlobalNavigation from "@/components/GlobalNavigation";
import AppMain from "@/components/AppMain";
import { GeoProvider } from "@/context/GeoContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  // Not preloaded on every page, so data saver (G10) can skip the download
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Edulexa — AI Technical Assessment & Career Platform",
  description: "AI Voice Interview Simulations, Real-World Sprints, 1-on-1 Mentorship & Verifiable Certificates",
};

// ClerkProvider stays in both modes: pages not yet moved to lib/appAuth still call Clerk hooks.
// AppAuthProvider adds the Auth.js session when NEXT_PUBLIC_AUTH_PROVIDER=keycloak (no-op for Clerk).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/login">
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body 
          className="min-h-full flex flex-col bg-background text-foreground" 
          suppressHydrationWarning
        >
          <AppAuthProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <GeoProvider>
                <GlobalNavigation />
                <AppMain>{children}</AppMain>
              </GeoProvider>
            </ThemeProvider>
          </AppAuthProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
