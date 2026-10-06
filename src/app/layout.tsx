import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import GlobalNavigation from "@/components/GlobalNavigation";
import { GeoProvider } from "@/context/GeoContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Edulexa — AI Technical Assessment & Career Platform",
  description: "AI Voice Interview Simulations, Real-World Sprints, 1-on-1 Mentorship & Verifiable Certificates",
};

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
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <GeoProvider>
              <GlobalNavigation />
              <main className="flex-1">{children}</main>
            </GeoProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
