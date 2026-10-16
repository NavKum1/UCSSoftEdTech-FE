"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, Modal, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT, useCareerLabels } from "@/components/career/ui";

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

const CATEGORY_LABELS_KEYS = ["Profile", "Education", "Assessments", "EvidencePack"];
/** category labels in the career language (G1) */
function useCategoryLabels(): Record<string, string> {
  return useCareerLabels("studentChallenges.category", CATEGORY_LABELS_KEYS);
}

export default function StudentChallengesPage() {
  const t = useCareerT("studentChallenges");
  const CATEGORY_LABELS = useCategoryLabels();
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
      setMsg(t("youJoinedTitleStartYour", { title: joining.challenge.title }));
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
      setMsg(t("youLeftTitleAndStopped", { title: item.challenge.title, employer: item.employer ?? t("theEmployer") }));
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
        title={t("employerChallenges")}
        description={t("shortSkillsExercisesFromEmployers")}
      />
      <ErrorBanner error={err ?? browse.error ?? mine.error} />
      <SuccessBanner message={msg} />

      <section aria-labelledby="mine-h" className="mb-8">
        <h2 id="mine-h" className="mb-3 text-lg font-semibold">{t("myChallenges")}</h2>
        {mine.loading && !mine.data ? (
          <Loading />
        ) : active.length === 0 ? (
          <EmptyState title={t("youHaventJoinedAChallenge")} />
        ) : (
          <ul className="space-y-3">
            {active.map((m) => {
              const p = m.participation;
              return (
                <li key={m.challenge.id}>
                  <Card title={m.challenge.title}>
                    <div className="space-y-2 text-sm">
                      <p>{t("employerClosesClosesAt", { employer: m.employer, closesAt: formatDate(m.challenge.closesAt, true) })}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={p.submissions ? "good" : "neutral"}>{p.submissions ? t("submittedScoreValue", { score: p.score ?? t("running"), value: p.score != null ? "%" : "" }) : t("notSubmitted")}</Badge>
                        <Badge tone={p.defended ? "good" : "neutral"}>{p.defended ? t("defendedDefenseScore", { defenseScore: p.defenseScore ?? "—" }) : t("notDefendedYet")}</Badge>
                        <Badge tone={p.consentActive ? "info" : "warn"}>{p.consentActive ? t("sharingWithEmployer") : t("notSharing")}</Badge>
                        {p.inviteCount > 0 && <Badge tone="info">{t("invitedToTalk")}</Badge>}
                      </div>
                      {!p.consentActive && <p className="text-muted-foreground">{t("youStoppedSharingSoThe")}</p>}
                      <div className="flex flex-wrap gap-2">
                        {p.attemptUrl && (
                          <Link href={p.attemptUrl} className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-white" style={{ background: "var(--brand, #4f46e5)" }}>
                            {p.submissions ? t("tryAgain") : t("startTheChallenge")}
                          </Link>
                        )}
                        {p.credentialSlug && <Link className="underline" href={`/credential/${p.credentialSlug}`}>{t("yourCredential")}</Link>}
                        {m.challenge.externalJobUrl && <a className="underline" href={m.challenge.externalJobUrl} target="_blank" rel="noreferrer">{t("employersJobPage")}</a>}
                        <Button variant="secondary" busy={busy === `w-${m.challenge.id}`} onClick={() => withdraw(m)}>{t("leaveAndStopSharing")}</Button>
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
        <h2 id="open-h" className="mb-3 text-lg font-semibold">{t("openChallenges")}</h2>
        {browse.loading && !browse.data ? (
          <Loading />
        ) : open.length === 0 ? (
          <EmptyState title={t("noOpenChallengesAtYour")} />
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
                    {b.challenge.prizeText && <p>{t("recognitionPrizeText", { prizeText: b.challenge.prizeText })}</p>}
                    <p className="text-muted-foreground">
                      {t("for")}{" "}{b.challenge.degreeLevels.length ? b.challenge.degreeLevels.join(", ") : t("allDegreeLevels")}
                      {b.challenge.majors.length ? ` · ${b.challenge.majors.join(", ")}` : ""}
                      {b.challenge.gradFrom || b.challenge.gradTo ? t("graduatingGradFromGradTo", { gradFrom: formatDate(b.challenge.gradFrom), gradTo: formatDate(b.challenge.gradTo) }) : ""}
                    </p>
                    {!b.eligible && <p role="note">{t.rich("notEligibleIneligibleReasonMyRecord", { ineligibleReason: b.ineligibleReason, link: (chunks) => <Link href="/student/record" className="underline">{chunks}</Link> })}</p>}
                    {b.full && <p>{t("thisChallengeIsFull")}</p>}
                    {!b.isOpen && <p>{t("notOpenYet")}</p>}
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={!b.eligible || b.full || !b.isOpen} onClick={() => { setJoining(b); setAgree(false); }}>{t("join")}</Button>
                      {b.challenge.externalJobUrl && <a className="self-center underline" href={b.challenge.externalJobUrl} target="_blank" rel="noreferrer">{t("employersJobPage")}</a>}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {joining && (
        <Modal labelledBy="join-h" onClose={() => setJoining(null)}>
          <form onSubmit={join} className="w-full max-w-lg space-y-3 rounded-xl bg-background p-5 shadow-lg">
            <h2 id="join-h" className="text-lg font-semibold">{t("joinTitle", { title: joining.challenge.title })}</h2>
            <p className="text-sm">{t.rich("joiningSharesTheFollowingWith", { strong: (chunks) => <strong>{chunks}</strong>, name: joining.employer?.name })}</p>
            <ul className="list-disc ps-5 text-sm">
              {joining.consentCategories.map((c) => <li key={c}>{CATEGORY_LABELS[c] ?? c}</li>)}
            </ul>
            <p className="text-sm text-muted-foreground">{t("yourEmailAndPhoneAre")}</p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
              {t("iAgreeToShareThis", { name: joining.employer?.name })}
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={!agree} busy={busy === "join"}>{t("joinChallenge")}</Button>
              <Button type="button" variant="secondary" onClick={() => setJoining(null)}>{t("cancel")}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
