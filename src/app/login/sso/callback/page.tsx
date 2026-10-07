"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { RefreshCw } from "lucide-react";

// Completes the enterprise SSO round-trip started on /login/sso
export default function SsoCallbackPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-3">
      <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      <p className="text-sm text-muted-foreground">Completing single sign-on…</p>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
        signInUrl="/login"
        signUpUrl="/login"
      />
    </div>
  );
}
