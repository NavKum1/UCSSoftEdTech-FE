"use client";

/**
 * Guidance requests an Edulexa advisor handed to this community mentor: reply (or reply to the email), suggest an
 * institute (the person approves first), or hand the request back to the advisors.
 */

import React, { useCallback, useEffect, useState } from "react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { Messages, ReplyBox, RequestDetails, STATUS_LABEL, type GuidanceRequestView } from "@/components/guidance/Conversation";

export default function MentorGuidancePage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [items, setItems] = useState<GuidanceRequestView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/guidance/mentor");
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
      setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work.");
      return false;
    }
    await load();
    return true;
  };

  if (access) return <AccessNotice problem={access} feature="guidance requests" />;
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Guidance requests for you</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edulexa&apos;s advisors asked you to help these people choose an area or certification. Reply here or to the email. If you can&apos;t help, hand it back.
        </p>
      </header>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!items ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requests for you right now.</p>
      ) : (
        items.map((r) => (
          <section key={r.id} className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-semibold">{r.name}</h2>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{STATUS_LABEL[r.status] ?? r.status}</span>
            </div>
            <RequestDetails r={r} />
            <Messages messages={r.messages} />
            <ReplyBox allowInternal onSend={(body, internal) => post(`/api/guidance/mentor/${r.id}/messages`, { body, internal })} />
            <button type="button" onClick={() => void post(`/api/guidance/mentor/${r.id}/hand-back`, { body: "" })} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
              Hand back to the advisors
            </button>
          </section>
        ))
      )}
    </main>
  );
}
