"use client";

/**
 * A shared skill passport (/passport/public/[token]): anyone with the link the member shared. No sign-in. Shows what
 * the API returns for an enabled link (name, target role, skills, credentials; never email or activity history).
 */

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import PassportView, { type PassportData } from "@/components/passport/PassportView";
import { API_BASE_URL } from "@/lib/apiClient";

export default function PublicPassportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PassportData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/passport/public/${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (res.status === 404) return setState("missing");
        if (!res.ok) return setState("error");
        const body = (await res.json()) as PassportData;
        setData(body);
        setState("ready");
        document.title = body.fullName ? `${body.fullName} · Skill passport` : "Skill passport";
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6">
      <p className="mb-6 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        Skill passport shared by its owner. Results are graded by Edulexa; each credential can be verified on its own page.
      </p>
      {state === "loading" && <div className="h-40 animate-pulse rounded-2xl border border-border bg-card motion-reduce:animate-none" aria-busy="true" />}
      {state === "missing" && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">This passport isn&apos;t available</h1>
          <p className="mt-2 text-sm text-muted-foreground">The link may be wrong, or its owner has stopped sharing it or created a new link.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
            Go to Edulexa
          </Link>
        </div>
      )}
      {state === "error" && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">We couldn&apos;t load this passport</h1>
          <p className="mt-2 text-sm text-muted-foreground">Please try again in a moment.</p>
        </div>
      )}
      {state === "ready" && data && <PassportView data={data} publicView />}
    </main>
  );
}
