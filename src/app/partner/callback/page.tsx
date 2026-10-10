"use client";

/**
 * Landing page for partner sign-in (F9). The API's /api/career/partner/{partner}/launch redirects here with
 * #token=...&returnTo=...&institute=... (or #error=...). The fragment never reaches a server; we remove it from the
 * address bar at once, keep the token in sessionStorage for this tab, and continue to the requested app path.
 * Brand-neutral: no product name is shown.
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setSelectedSchool } from "@/lib/appAuth";
import { clearPartnerSession, safeReturnTo, savePartnerSession } from "@/lib/partnerSession";
import { ErrorBanner, Loading } from "@/components/career/ui";

export default function PartnerCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // State updates are deferred out of the effect body
    const fail = (message: string) => queueMicrotask(() => setError(message));
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    // Remove the token from the address bar and history before doing anything else
    window.history.replaceState(null, "", window.location.pathname);

    const failure = params.get("error");
    if (failure) {
      clearPartnerSession();
      fail(failure);
      return;
    }
    const token = params.get("token");
    const session = token ? savePartnerSession(token) : null;
    if (!session) {
      fail("This sign-in link is incomplete or has expired. Open career services from your account again.");
      return;
    }
    const institute = params.get("institute") ?? session.instituteId;
    if (institute) setSelectedSchool(institute);
    const fallback = session.role === "CareerAdmin" ? "/career-center" : "/student";
    router.replace(safeReturnTo(params.get("returnTo"), fallback));
  }, [router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-4 text-xl font-semibold">Signing you in</h1>
      {error ? (
        <ErrorBanner error={`We couldn't sign you in: ${error}`} />
      ) : (
        <div role="status" aria-live="polite">
          <Loading label="Opening career services…" />
        </div>
      )}
    </div>
  );
}
