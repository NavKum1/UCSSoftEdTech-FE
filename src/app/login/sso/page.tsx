"use client";

import React, { useState } from "react";
import { 
  Building2, ShieldCheck, ArrowRight, Lock, 
  Sparkles, CheckCircle2, AlertCircle, Globe,
  KeyRound, RefreshCw, Download, FileCode
} from "lucide-react";

export default function EnterpriseSsoLoginPage() {
  const [email, setEmail] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<any>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid institutional or enterprise email address.");
      return;
    }

    setErrorMsg(null);
    setDiscoveryResult(null);
    setAuthSuccess(null);
    setIsDiscovering(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sso/discovery?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ssoEnabled) {
          setDiscoveryResult(data);
        } else {
          setErrorMsg(`Domain '@${data.domain}' is not enrolled in Enterprise SSO yet. Please use standard email sign-in or contact your IT administrator.`);
        }
      } else {
        setErrorMsg("Failed to connect to identity discovery service.");
      }
    } catch (err: any) {
      setErrorMsg("Network error connecting to API: " + err.message);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleSimulatedSamlLogin = async () => {
    if (!discoveryResult) return;
    setIsAuthenticating(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sso/saml/acs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: email.split("@")[0].replace(".", " "),
          domain: discoveryResult.domain,
          role: discoveryResult.defaultRole || "Candidate",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAuthSuccess(data);
        // Persist token in localStorage
        if (typeof window !== "undefined" && data.token) {
          localStorage.setItem("sso_bearer_token", data.token);
          localStorage.setItem("sso_user_role", data.user.role);
        }
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.error || "SAML assertion processing failed.");
      }
    } catch (err: any) {
      setErrorMsg("Authentication error: " + err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-400 mb-2">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Enterprise Single Sign-On
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your organization's SAML 2.0 or OIDC Identity Provider (Okta, Azure AD, PingIdentity).
          </p>
        </div>

        {/* Card */}
        <div className="bg-card/90 border border-border rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          {!authSuccess ? (
            <>
              <form onSubmit={handleDiscovery} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Work or University Email
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. alex@stanford.edu or dev@uber.com"
                      required
                      className="w-full bg-background/80 border border-border/80 rounded-xl px-4 py-3 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                    />
                    <Globe className="absolute right-3.5 top-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isDiscovering}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition duration-200 shadow-lg shadow-indigo-600/20 text-sm"
                >
                  {isDiscovering ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Discovering Identity Provider...
                    </>
                  ) : (
                    <>
                      Discover Organization SSO
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Discovered IdP Card */}
              {discoveryResult && (
                <div className="p-4 rounded-xl bg-background/90 border border-indigo-500/30 space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-semibold text-sm">
                      <ShieldCheck className="w-4 h-4" />
                      <span>{discoveryResult.organizationName}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 uppercase">
                      {discoveryResult.protocol}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Domain: <span className="text-foreground font-mono">@{discoveryResult.domain}</span></div>
                    <div>Default Role: <span className="text-foreground font-mono">{discoveryResult.defaultRole}</span></div>
                  </div>

                  <button
                    onClick={handleSimulatedSamlLogin}
                    disabled={isAuthenticating}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl transition duration-200 shadow-lg shadow-emerald-600/20 text-sm"
                  >
                    {isAuthenticating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Validating SAML Assertion...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Authenticate via {discoveryResult.organizationName} SSO
                      </>
                    )}
                  </button>

                  <div className="pt-1 text-center">
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sso/metadata/${discoveryResult.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-indigo-700 dark:text-indigo-400 transition"
                    >
                      <Download className="w-3 h-3" />
                      Download SAML SP Metadata XML
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Auth Success State */
            <div className="text-center space-y-4 py-2 animate-in zoom-in-95 duration-300">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">Federation Authenticated!</h3>
                <p className="text-xs text-muted-foreground">
                  Welcome, <span className="text-indigo-600 dark:text-indigo-300 font-medium">{authSuccess.user.name}</span>. Your enterprise role is:
                </p>
                <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-600 dark:text-indigo-300 text-xs font-semibold mt-1">
                  {authSuccess.user.role}
                </div>
              </div>

              <div className="p-3 bg-background rounded-xl border border-border text-left text-xs font-mono text-muted-foreground break-all space-y-1">
                <div className="text-muted-foreground text-[10px] uppercase font-semibold">JWT Bearer Token</div>
                <div className="line-clamp-2 text-muted-foreground">{authSuccess.token}</div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <a
                  href="/dashboard"
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition text-center"
                >
                  Proceed to Candidate Workspace
                </a>
                <button
                  onClick={() => {
                    setAuthSuccess(null);
                    setDiscoveryResult(null);
                    setEmail("");
                  }}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Sign Out / Switch Account
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Links */}
        <div className="text-center text-xs text-muted-foreground">
          Not an enterprise user?{" "}
          <a href="/login" className="text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:text-indigo-300 underline underline-offset-4">
            Sign in with Standard Account
          </a>
        </div>
      </div>
    </div>
  );
}
