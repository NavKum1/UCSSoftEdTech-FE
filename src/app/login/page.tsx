"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { AUTH_PROVIDER, keycloakSignIn } from "@/lib/appAuth";
import { 
  Building2, ShieldCheck, ArrowRight, Lock, 
  Sparkles, CheckCircle2, UserCheck, Briefcase, GraduationCap
} from "lucide-react";

// useSearchParams needs a Suspense boundary for static prerendering
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/dashboard";

  const [demoRole, setDemoRole] = useState<string | null>(null);

  const handleDemoSignIn = (role: string, targetPath: string) => {
    setDemoRole(role);
    if (typeof document !== "undefined") {
      document.cookie = `mock_${role.toLowerCase()}_role=${role}; path=/; max-age=86400`;
    }
    setTimeout(() => {
      router.push(targetPath);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center px-4 py-12 font-sans relative overflow-x-clip">
      {/* Background glow */}
      <div className="absolute top-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center space-x-2 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tight text-foreground">
              BUILD & DEFEND
            </span>
          </Link>
          <h1 className="text-2xl font-black text-foreground">
            Sign In to Edulexa
          </h1>
          <p className="text-xs text-muted-foreground">
            Access your technical assessments, corporate recruiting pipeline, and credentials.
          </p>
        </div>

        {/* Demo One-Click Personas */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block text-center">
            Instant Demo Sign-In (One-Click)
          </span>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => handleDemoSignIn("Recruiter", "/recruiter/dashboard")}
              className="w-full p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/15 text-left flex items-center justify-between text-xs transition-colors group"
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-foreground block">Corporate Recruiter</span>
                  <span className="text-[10px] text-muted-foreground">Candidate assessments & anti-cheat audits</span>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-purple-500 transition-colors" />
            </button>

            <button
              onClick={() => handleDemoSignIn("Candidate", "/dashboard")}
              className="w-full p-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/15 text-left flex items-center justify-between text-xs transition-colors group"
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-foreground block">Software Candidate</span>
                  <span className="text-[10px] text-muted-foreground">Coding sprints, voice defense, and katas</span>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
            </button>

            <button
              onClick={() => handleDemoSignIn("InstituteAdmin", "/institute/dashboard")}
              className="w-full p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 text-left flex items-center justify-between text-xs transition-colors group"
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-foreground block">University Institute Admin</span>
                  <span className="text-[10px] text-muted-foreground">Cohort batching & accreditation metrics</span>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
            </button>
          </div>
        </div>

        {AUTH_PROVIDER === "keycloak" ? (
          <KeycloakSignInCard redirectUrl={redirectUrl} />
        ) : (
        <>
        {/* Standard Clerk Authentication Widget */}
        <div className="flex justify-center">
          <SignIn 
            routing="hash"
            fallbackRedirectUrl={redirectUrl}
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-card border border-border shadow-md rounded-2xl w-full",
                headerTitle: "text-foreground font-black text-lg",
                headerSubtitle: "text-muted-foreground text-xs",
                socialButtonsBlockButton: "border-border text-foreground hover:bg-muted text-xs",
                formButtonPrimary: "bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl",
                formFieldLabel: "text-foreground text-xs font-semibold",
                formFieldInput: "bg-background border-border text-foreground text-xs rounded-xl",
                footerActionLink: "text-purple-600 dark:text-purple-400 font-semibold"
              }
            }}
          />
        </div>

        {/* Enterprise SSO Link */}
        <div className="text-center pt-2">
          <Link
            href="/login/sso"
            className="text-xs text-muted-foreground hover:text-foreground font-semibold inline-flex items-center space-x-1.5 transition-colors"
          >
            <Building2 className="w-3.5 h-3.5 text-purple-500" />
            <span>Sign in with Enterprise SAML / Okta / Azure AD</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

// Keycloak mode: one sign-in for every TotalOffice app. An optional email is passed as login_hint so Keycloak can send
// university and employer users straight to their organization's identity provider (email-domain discovery).
function KeycloakSignInCard({ redirectUrl }: { redirectUrl: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const start = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    void keycloakSignIn(redirectUrl, email.trim() || undefined);
  };
  return (
    <form onSubmit={start} className="p-5 rounded-2xl bg-card border border-border shadow-md space-y-3">
      <label htmlFor="kc-email" className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        University or work email (optional)
      </label>
      <input
        id="kc-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@university.edu"
        className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
      >
        <Lock className="w-3.5 h-3.5" />
        {busy ? "Redirecting to sign-in..." : "Sign in with TotalOffice account"}
      </button>
      <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
        <ShieldCheck className="w-3 h-3" />
        Single sign-on for Edulexa, Hire, Documents and AttendSpot. Your university login works here.
      </p>
    </form>
  );
}
