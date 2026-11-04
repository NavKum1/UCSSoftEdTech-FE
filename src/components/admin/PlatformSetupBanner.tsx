"use client";

/**
 * On the platform admin's overview: a warning when email isn't set up (nothing is being sent) or the virus check isn't
 * answering (uploads are refused), with a link to Email and uploads (A7). Shows nothing when both are fine, or for users
 * who can't read the settings.
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useAppAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";

export default function PlatformSetupBanner() {
  const { getToken, isLoaded, isSignedIn } = useAppAuth();
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let active = true;
    Promise.all([authenticatedFetch("/api/admin/platform/email", {}, getToken), authenticatedFetch("/api/admin/platform/uploads", {}, getToken)])
      .then(async ([e, u]) => {
        const found: string[] = [];
        if (e.ok && !(await e.json()).working) found.push("Email isn't set up, so no email is being sent.");
        if (u.ok) {
          const d = await u.json();
          if (d.enabled && !d.scannerUp) found.push("The virus check isn't answering, so uploads are refused.");
        }
        if (active) setProblems(found);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [getToken, isLoaded, isSignedIn]);

  if (problems.length === 0) return null;
  return (
    <div role="alert" className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <ul className="space-y-1">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      <Link href="/admin/settings" className="font-semibold underline underline-offset-2">
        Open Email and uploads
      </Link>
    </div>
  );
}
