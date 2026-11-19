"use client";

/**
 * Workplace practice (B3, 18 Nov 2026): everyday situations for any job (an upset customer, conflict in the team, a first
 * job, pay, bad news, feedback) and the leadership, promotion and failover scenarios, on one page. ?track= opens a track;
 * the old leadership, promotion and failover pages send people here with theirs.
 */

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ScenarioPractice from "@/components/practice/ScenarioPractice";
import { PageHeader } from "@/components/career/ui";
import { useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";

// What each track practices, in a line. en() where shown.
const INTROS: Record<string, string> = {
  customer: "Calm an upset customer and sort out the problem within the rules: in a restaurant, a store and a hospital.",
  conflict: "Raise a problem with a colleague fairly and agree a way forward, so you can keep working together.",
  firstjob: "A task you don't understand, a mistake in your first week, and too many people asking for things.",
  pay: "Ask for a raise, negotiate a job offer, or ask for a different schedule, with evidence and a clear ask.",
  badnews: "Tell a customer about a delay, tell your manager you'll miss a deadline, and say no to a colleague.",
  feedback: "Take criticism, a poor review and feedback in front of others, and speak up fairly when it misses something.",
  leadership: "Hard conversations with product, operations and compliance leads after an outage or under a tight deadline.",
  promotion: "Answer a practice committee's questions about your work: evidence, scope, influence and what you learned.",
  failover: "Lead the response when one region of a service starts failing: traffic, data, and keeping customers informed.",
};

interface Track {
  key: string;
  label: string;
}

export default function WorkplacePracticePage() {
  return (
    <Suspense fallback={null}>
      <WorkplacePractice />
    </Suspense>
  );
}

function WorkplacePractice() {
  const en = useEn();
  const router = useRouter();
  const params = useSearchParams();
  const { apiFetch, ready } = useLegacyApi();
  const [tracks, setTracks] = useState<Track[]>([]);
  const requested = params.get("track");
  const track = requested && (tracks.length === 0 || tracks.some((t) => t.key === requested)) ? requested : tracks[0]?.key ?? "customer";

  const load = async () => {
    const res = await apiFetch("/api/practice/scenarios", {}, { quiet: true });
    if (res.ok) setTracks(((await res.json()) as { tracks: Track[] }).tracks);
  };
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  const label = tracks.find((t) => t.key === track)?.label ?? "";
  return (
    <div className="space-y-6">
      <PageHeader
        title={en("Workplace practice")}
        description={en("Short scenarios from everyday work. At each turn, choose how you'd respond, then see feedback and the strongest response. Practice only: nobody else sees your results.")}
      />
      <nav aria-label={en("Situations")} className="flex flex-wrap gap-2">
        {tracks.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={t.key === track}
            onClick={() => router.replace(`/practice/workplace?track=${t.key}`, { scroll: false })}
            className={`rounded-full border px-3 py-1.5 text-sm ${t.key === track ? "border-[var(--brand)] bg-muted font-medium text-foreground" : "border-border text-muted-foreground hover:bg-muted/50"}`}
          >
            {en(t.label)}
          </button>
        ))}
      </nav>
      {tracks.length > 0 && <ScenarioPractice key={track} track={track} title={label} intro={en(INTROS[track] ?? "")} embedded />}
    </div>
  );
}
