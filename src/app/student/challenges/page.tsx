"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";

interface Challenge {
  id: string;
  title: string;
  description: string;
  opensAt: string;
  closesAt: string;
  degreeLevels: string[];
  majors: string[];
  gradFrom?: string | null;
  gradTo?: string | null;
  externalJobUrl?: string | null;
  prizeText?: string | null;
  maxParticipants?: number | null;
  status: string;
}
interface BrowseItem {
  challenge: Challenge;
  employer?: { id: string; name: string; website?: string | null; verificationStatus: string } | null;
  isOpen: boolean;
  eligible: boolean;
  ineligibleReason?: string | null;
  full: boolean;
  joined: boolean;
  consentCategories: string[];
}
interface Participation {
  participantId: string;
  joinedAt: string;
  withdrawnAt?: string | null;
  consentActive: boolean;
  attemptUrl?: string | null;
  submissions: number;
  score?: number | null;
  testsPassed?: number | null;
  testsTotal?: number | null;
  defended: boolean;
  defenseScore?: number | null;
  credentialSlug?: string | null;
  inviteCount: number;
}
interface MineItem { challenge: Challenge; employer?: string | null; participation: Participation }

const CATEGORY_LABELS: Record<string, string> = { Profile: "your name", Education: "your program and graduation date", Assessments: "your challenge results", EvidencePack: "your evidence pack (code, tests, defense, integrity signals)" };

export default function StudentChallengesPage() {
  const api = useApi();
  const browse = useLoad(() => api<BrowseItem[]>("/api/career/challenges/student"), [api]);
  const mine = useLoad(() => api<MineItem[]>("/api/career/challenges/student/mine"), [api]);
  const [joining, setJoining] = useState<BrowseItem | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = () => { browse.reload(); mine.reload(); };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joining) return;
    setBusy("join");
    setErr(null);
    setMsg(null);
    try {
      await api(`/api/career/challenges/student/${joining.challenge.id}/join`, { method: "POST", json: { consent: agree } });
      setMsg(`You joined "${joining.challenge.title}". Start your attempt from My challenges below.`);
      setJoining(null);
      setAgree(false);
      reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (item: MineItem) => {
    setBusy(`w-${item.challenge.id}`);
    setErr(null);
    setMsg(null);
    try {
      await api(`/api/career/challenges/student/${item.challenge.id}/withdraw`, { method: "POST" });
      setMsg(`You left "${item.challenge.title}" and stopped sharing your results with ${item.employer ?? "the employer"}.`);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const active = (mine.data ?? []).filter((m) => !m.participation.withdrawnAt);
  const open = (browse.data ?? []).filter((b) => !b.joined);

  return (
    <div>
      <PageHeader
        title="Employer challenges"
        description="Short skills exercises from employers your career center approved. Take them in the regular sprint editor, defend your work, and decide who sees your results."
      />
      <ErrorBanner error={err ?? browse.error ?? mine.error} />
      <SuccessBanner message={msg} />

      <section aria-labelledby="mine-h" className="mb-8">
        <h2 id="mine-h" className="mb-3 text-lg font-semibold">My challenges</h2>
        {mine.loading && !mine.data ? (
          <Loading />
        ) : active.length === 0 ? (
          <EmptyState title="You haven't joined a challenge yet" />
        ) : (
          <ul className="space-y-3">
            {active.map((m) => {
              const p = m.participation;
              return (
                <li key={m.challenge.id}>
                  <Card title={m.challenge.title}>
                    <div className="space-y-2 text-sm">
                      <p>{m.employer} · closes {formatDate(m.challenge.closesAt, true)}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={p.submissions ? "good" : "neutral"}>{p.submissions ? `Submitted (${p.score ?? "running"}${p.score != null ? "%" : ""})` : "Not submitted"}</Badge>
                        <Badge tone={p.defended ? "good" : "neutral"}>{p.defended ? `Defended (${p.defenseScore ?? "—"})` : "Not defended yet"}</Badge>
                        <Badge tone={p.consentActive ? "info" : "warn"}>{p.consentActive ? "Sharing with employer" : "Not sharing"}</Badge>
                        {p.inviteCount > 0 && <Badge tone="info">Invited to talk</Badge>}
                      </div>
                      {!p.consentActive && <p className="text-muted-foreground">You stopped sharing, so the employer doesn&apos;t see your results.</p>}
                      <div className="flex flex-wrap gap-2">
                        {p.attemptUrl && (
                          <Link href={p.attemptUrl} className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand, #4f46e5)" }}>
                            {p.submissions ? "Try again" : "Start the challenge"}
                          </Link>
                        )}
                        {p.credentialSlug && <Link className="underline" href={`/credential/${p.credentialSlug}`}>Your credential</Link>}
                        {m.challenge.externalJobUrl && <a className="underline" href={m.challenge.externalJobUrl} target="_blank" rel="noreferrer">Employer&apos;s job page</a>}
                        <Button variant="secondary" busy={busy === `w-${m.challenge.id}`} onClick={() => withdraw(m)}>Leave and stop sharing</Button>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="open-h">
        <h2 id="open-h" className="mb-3 text-lg font-semibold">Open challenges</h2>
        {browse.loading && !browse.data ? (
          <Loading />
        ) : open.length === 0 ? (
          <EmptyState title="No open challenges at your school right now" />
        ) : (
          <ul className="space-y-3">
            {open.map((b) => (
              <li key={b.challenge.id}>
                <Card title={b.challenge.title}>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>{b.employer?.name}</strong> · {formatDate(b.challenge.opensAt)} – {formatDate(b.challenge.closesAt)}
                    </p>
                    {b.challenge.description && <p className="whitespace-pre-line">{b.challenge.description}</p>}
                    {b.challenge.prizeText && <p>Recognition: {b.challenge.prizeText}</p>}
                    <p className="text-muted-foreground">
                      For: {b.challenge.degreeLevels.length ? b.challenge.degreeLevels.join(", ") : "all degree levels"}
                      {b.challenge.majors.length ? ` · ${b.challenge.majors.join(", ")}` : ""}
                      {b.challenge.gradFrom || b.challenge.gradTo ? ` · graduating ${formatDate(b.challenge.gradFrom)} – ${formatDate(b.challenge.gradTo)}` : ""}
                    </p>
                    {!b.eligible && <p role="note">Not eligible: {b.ineligibleReason}{" "}<Link href="/student/record" className="underline">My record</Link></p>}
                    {b.full && <p>This challenge is full.</p>}
                    {!b.isOpen && <p>Not open yet.</p>}
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={!b.eligible || b.full || !b.isOpen} onClick={() => { setJoining(b); setAgree(false); }}>Join</Button>
                      {b.challenge.externalJobUrl && <a className="self-center underline" href={b.challenge.externalJobUrl} target="_blank" rel="noreferrer">Employer&apos;s job page</a>}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {joining && (
        <div role="dialog" aria-modal="true" aria-labelledby="join-h" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={join} className="w-full max-w-lg space-y-3 rounded-xl bg-background p-5 shadow-lg">
            <h2 id="join-h" className="text-lg font-semibold">Join “{joining.challenge.title}”</h2>
            <p className="text-sm">Joining shares the following with <strong>{joining.employer?.name}</strong>:</p>
            <ul className="list-disc pl-5 text-sm">
              {joining.consentCategories.map((c) => <li key={c}>{CATEGORY_LABELS[c] ?? c}</li>)}
            </ul>
            <p className="text-sm text-muted-foreground">Your email and phone are not shared. You can stop sharing at any time from this page or Privacy &amp; sharing; the employer then no longer sees your results.</p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
              I agree to share this with {joining.employer?.name} for this challenge.
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={!agree} busy={busy === "join"}>Join challenge</Button>
              <Button type="button" variant="secondary" onClick={() => setJoining(null)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
