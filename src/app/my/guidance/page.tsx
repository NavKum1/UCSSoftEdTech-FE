"use client";

/**
 * My guidance requests: the person's questions to Edulexa, the replies (from advisors or community mentors), their own
 * replies, and any institute an advisor suggested: it gets the request only if they approve here.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { Messages, ReplyBox, STATUS_LABEL, type GuidanceRequestView } from "@/components/guidance/Conversation";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, buttonClass, ErrorBanner, PageHeader } from "@/components/career/ui";

export default function MyGuidancePage() {
  const en = useEn();
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
    <div className="space-y-6">
      <PageHeader
        title={en("My guidance requests")}
        description={en("Your questions to Edulexa and the replies. You can also reply to our emails.")}
        actions={
          <Link href="/prep/counselling" className={buttonClass("secondary")}>
            {en("Ask something new")}
          </Link>
        }
      />
      <ErrorBanner error={error} />
      {!items ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-busy="true" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{en("You haven't asked anything yet.")}</p>
      ) : (
        items.map((r) => (
          <section key={r.id} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="whitespace-pre-wrap text-sm font-medium">{r.question}</p>
              <Badge>{en(STATUS_LABEL[r.status] ?? r.status)}</Badge>
            </div>
            <Messages messages={r.messages} />
            {r.status === "InstituteSuggested" && r.suggestedInstitute && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <p>
                  {en("We suggest talking to ")}<span className="font-semibold">{r.suggestedInstitute}</span>{en(". Send them your request so they can contact you? Nothing goes to them unless you agree.")}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button type="button" onClick={() => void post(`/api/guidance/requests/${r.id}/suggestion`, { approve: true })}>
                    {en("Yes, send it")}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void post(`/api/guidance/requests/${r.id}/suggestion`, { approve: false })}>
                    {en("No, thanks")}
                  </Button>
                </div>
              </div>
            )}
            {r.status !== "Resolved" && <ReplyBox onSend={(body) => post(`/api/guidance/requests/${r.id}/messages`, { body })} />}
          </section>
        ))
      )}
    </div>
  );
}
