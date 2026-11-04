import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppAuthProvider } from "@/lib/appAuth";
import GlobalNavigation from "@/components/GlobalNavigation";
import AppMain from "@/components/AppMain";
import MfaRequiredNotice from "@/components/auth/MfaRequiredNotice";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TextProvider } from "@/lib/english/EnglishProvider";
import { requestLanguage } from "@/lib/i18n/server";
import { directionOf } from "@/lib/i18n/languages";
import "./globals.css";

// The brand's type, the same as edulexa.com: Inter, and JetBrains Mono for code
const brandSans = Inter({
  variable: "--font-brand-sans",
  subsets: ["latin"],
  // Not preloaded on every page, so data saver (G10) can skip the download
  preload: false,
});

const brandMono = JetBrains_Mono({
  variable: "--font-brand-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Edulexa — AI Technical Assessment & Career Platform",
  description: "AI Voice Interview Simulations, Real-World Sprints, 1-on-1 Mentorship & Verifiable Certificates",
};

// AppAuthProvider holds the Keycloak (Auth.js) session for every page; the reader's language is read here (A2), so
// every page is rendered in it and in its direction from the first paint
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { language, messages } = await requestLanguage();
  return (
    <html
      lang={language}
      dir={directionOf(language)}
      className={`${brandSans.variable} ${brandMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body 
        className="min-h-full flex flex-col bg-background text-foreground" 
        suppressHydrationWarning
      >
        <AppAuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <TextProvider language={language} messages={messages}>
              <GlobalNavigation />
              <AppMain>{children}</AppMain>
              <MfaRequiredNotice />
              </TextProvider>
          </ThemeProvider>
        </AppAuthProvider>
      </body>
    </html>
  );
}
