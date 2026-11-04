"use client";

/**
 * Leaderboards (phase B, 24 Oct 2026), both built from graded results only:
 * - Daily practice: points from members' first attempt at each incident drill and code review, this week (Monday 00:00
 *   UTC onwards) or all time.
 * - Verified challenges: each member's best verified coding-challenge credential.
 * Names show as first name and last initial. Members can hide themselves; they still see their own rank.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EyeOff } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { PageHeader, ScrollArea, Tabs } from "@/components/career/ui";

interface PracticeBoard {
  period: "week" | "all";
  startsAt: string | null;
  endsAt: string | null;
  entries: { rank: number; displayName: string; points: number; drills: number; isYou: boolean }[];
  you: { rank: number; points: number; drills: number } | null;
  youAreVisible: boolean;
  rankedMembers: number;
}
interface ChallengeBoard {
  totalPublicCount: number;
  leaderboard: {
    rank: number;
    candidateName: string;
    finalScore: number;
    sprintTitle: string | null;
    language: string | null;
    publicUrlSlug: string;
    completionTimeFormatted: string | null;
    isYou: boolean;
  }[];
  you: { rank: number; finalScore: number; sprintTitle: string | null; visible: boolean } | null;
}

const card = "rounded-xl border border-border bg-card shadow-sm";
type Tab = "week" | "all" | "challenges";

export default function LeaderboardPage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [tab, setTab] = useState<Tab>("week");
  const [practice, setPractice] = useState<PracticeBoard | null>(null);
  const [challenges, setChallenges] = useState<ChallengeBoard | null>(null);
  const [visible, setVisible] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (which: Tab) => {
      setFailed(false);
      try {
        if (which === "challenges") {
          const res = await apiFetch("/api/Leaderboard?limit=100");
          if (!res.ok) return setFailed(true);
          const body = (await res.json()) as ChallengeBoard;
          setChallenges(body);
          if (body.you) setVisible(body.you.visible);
        } else {
          const res = await apiFetch(`/api/practice/leaderboard?period=${which}&take=100`);
          if (!res.ok) return setFailed(true);
          const body = (await res.json()) as PracticeBoard;
          setPractice(body);
          setVisible(body.youAreVisible);
        }
      } catch {
        setFailed(true);
      }
    },
    [apiFetch],
  );
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current(tab);
  }, [ready, tab, loadRef]);

  const toggleVisible = async (value: boolean) => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/practice/leaderboard/visibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: value }),
      });
      if (res.ok) {
        setVisible(value);
        await load(tab);
      }
    } finally {
      setSaving(false);
    }
  };

  if (access) return <AccessNotice problem={access} feature="The leaderboards" />;

  const tabs: { key: Tab; label: string }[] = [
    { key: "week", label: en("This week") },
    { key: "all", label: en("All time") },
    { key: "challenges", label: en("Verified challenges") },
  ];

  return (
    <div>
      <PageHeader
        title={en("Leaderboards")}
        description={en("Built from graded results only. Names show as first name and last initial.")}
        actions={
          visible !== null && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={visible} disabled={saving} onChange={(e) => void toggleVisible(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
              {en("Show me to other members")}
            </label>
          )
        }
      />

      <Tabs label={en("Leaderboards")} value={tab} onChange={setTab} items={tabs.map((t) => ({ id: t.key, label: en(t.label) }))} />

      {visible === false && (
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
          <EyeOff aria-hidden="true" className="h-4 w-4" />{en(" You are hidden from other members. You still see your own rank below.")}
        </p>
      )}
      {failed && <p className="mt-6 text-sm text-muted-foreground">{en("The leaderboard couldn't be loaded. Please try again.")}</p>}

      {tab !== "challenges" && practice && practice.period === tab && (
        <section className="mt-6">
          <p className="mb-3 text-xs text-muted-foreground">
            {en("{value} Your first try at each drill counts.", { value: tab === "week" && practice.endsAt
              ? `Points from daily drills since Monday. Resets ${new Date(practice.endsAt).toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" })}.`
              : en("Points from daily drills since they started.") })}{" "}<Link href="/daily" className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">{en("Today's drills")}</Link>
          </p>
          <Table
            empty="Nobody has earned points in this period yet."
            rows={practice.entries.map((e) => ({ key: `${e.rank}-${e.displayName}`, rank: e.rank, name: e.displayName, isYou: e.isYou, cells: [`${e.drills} drill${e.drills === 1 ? "" : "s"}`, `${e.points} pts`] }))}
            headers={["Drills", "Points"]}
            you={practice.you && !practice.entries.some((e) => e.isYou) ? { rank: practice.you.rank, cells: [`${practice.you.drills} drills`, `${practice.you.points} pts`] } : null}
          />
        </section>
      )}

      {tab === "challenges" && challenges && (
        <section className="mt-6">
          <p className="mb-3 text-xs text-muted-foreground">{en("Each member's best verified coding challenge: best score first, then the fastest verified completion.")}</p>
          <Table
            empty="No verified challenge results yet."
            headers={["Challenge", "Time", "Score"]}
            rows={challenges.leaderboard.map((e) => ({
              key: e.publicUrlSlug,
              rank: e.rank,
              name: e.candidateName,
              isYou: e.isYou,
              href: `/credential/${e.publicUrlSlug}`,
              cells: [e.sprintTitle ?? "—", e.completionTimeFormatted ?? "—", `${Math.round(e.finalScore)}`],
            }))}
            you={challenges.you && !challenges.leaderboard.some((e) => e.isYou) ? { rank: challenges.you.rank, cells: [challenges.you.sprintTitle ?? "—", "", `${Math.round(challenges.you.finalScore)}`] } : null}
          />
        </section>
      )}
    </div>
  );
}

function Table({
  headers,
  rows,
  you,
  empty,
}: {
  headers: string[];
  rows: { key: string; rank: number; name: string; isYou: boolean; href?: string; cells: string[] }[];
  you: { rank: number; cells: string[] } | null;
  empty: string;
}) {
  const en = useEn();
  if (rows.length === 0 && !you) return <p className={`${card} p-6 text-sm text-muted-foreground`}>{empty}</p>;
  return (
    <ScrollArea className={`${card} overflow-x-auto`}>
      <table className="w-full text-sm">
        <thead className="border-b border-border text-start text-xs text-muted-foreground">
          <tr>
            <th className="w-14 p-3 font-medium">{en("Rank")}</th>
            <th className="p-3 font-medium">{en("Member")}</th>
            {headers.map((h) => (
              <th key={h} className="p-3 text-end font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.key} className={r.isYou ? "bg-indigo-50/60 font-semibold dark:bg-indigo-500/10" : ""}>
              <td className="p-3 tabular-nums text-muted-foreground">{r.rank}</td>
              <td className="p-3">
                {r.href ? (
                  <Link href={r.href} className="hover:underline">
                    {r.name}
                  </Link>
                ) : (
                  r.name
                )}
                {r.isYou && <span className="ms-1 text-xs font-normal text-muted-foreground">{en("(you)")}</span>}
              </td>
              {r.cells.map((c, i) => (
                <td key={i} className="p-3 text-end tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {you && (
            <tr className="bg-indigo-50/60 font-semibold dark:bg-indigo-500/10">
              <td className="p-3 tabular-nums text-muted-foreground">{you.rank}</td>
              <td className="p-3">{en("You")}</td>
              {you.cells.map((c, i) => (
                <td key={i} className="p-3 text-end tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </ScrollArea>
  );
}
