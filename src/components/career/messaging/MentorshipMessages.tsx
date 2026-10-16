"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Button, ErrorBanner, useCareerT } from "@/components/career/ui";
import { ThreadView } from "@/components/career/messaging/shared";

/**
 * Private messages between a mentor and mentee, for the mentorship detail view (student or mentor side).
 * Opens (or creates) the thread on demand; new messages are accepted only while the mentorship is Active.
 */
export default function MentorshipMessages({ mentorshipId, status }: { mentorshipId: string; status: string }) {
  const t = useCareerT("mentorshipMessages");
  const api = useApi();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ id: string }>(`/api/career/messaging/mentorships/${mentorshipId}/thread`, { method: "POST" });
      setThreadId(res.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (threadId) return <ThreadView threadId={threadId} />;
  return (
    <div>
      <ErrorBanner error={error} />
      <Button variant="secondary" busy={busy} onClick={open}>
        {status === "Active" ? t("openMessages") : t("viewMessageHistory")}
      </Button>
    </div>
  );
}
