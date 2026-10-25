"use client";

/**
 * My guidance requests: the person's questions to Edulexa, the replies (from advisors or community mentors), their own
 * replies, and any institute an advisor suggested: it gets the request only if they approve here.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { Messages, ReplyBox, STATUS_LABEL, type GuidanceRequestView } from "@/components/guidance/Conversation";

export default function MyGuidancePage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [items, setItems] = useState<GuidanceRequestView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/guidance/requests/mine");
    setItems(res.ok ? ((await res.json()) as GuidanceRequestView[]) : []);
  }, [apiFetch]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  const post = async (path: string, body: unknown) => {
    setError(null);
    const res = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) {
      setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work. Please try again.");
      return false;
    }
    await load();
    return true;
  };

  if (access) return <AccessNotice problem={access} feature="your guidance requests" />;
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My guidance requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your questions to Edulexa and the replies. You can also reply to our emails.{" "}
          <Link href="/prep/counselling" className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">
            Ask something new
          </Link>
        </p>
      </header>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!items ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">You haven&apos;t asked anything yet.</p>
      ) : (
        items.map((r) => (
          <section key={r.id} className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="whitespace-pre-wrap text-sm font-medium">{r.question}</p>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{STATUS_LABEL[r.status] ?? r.status}</span>
            </div>
            <Messages messages={r.messages} />
            {r.status === "InstituteSuggested" && r.suggestedInstitute && (
              <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/5 p-4 text-sm">
                <p>
                  We suggest talking to <span className="font-semibold">{r.suggestedInstitute}</span>. Send them your request so they can contact you?
                  Nothing goes to them unless you agree.
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void post(`/api/guidance/requests/${r.id}/suggestion`, { approve: true })} className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500">
                    Yes, send it
                  </button>
                  <button type="button" onClick={() => void post(`/api/guidance/requests/${r.id}/suggestion`, { approve: false })} className="rounded-xl border border-border px-4 py-2 font-medium hover:bg-muted">
                    No, thanks
                  </button>
                </div>
              </div>
            )}
            {r.status !== "Resolved" && <ReplyBox onSend={(body) => post(`/api/guidance/requests/${r.id}/messages`, { body })} />}
          </section>
        ))
      )}
    </main>
  );
}
