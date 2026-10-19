"use client";

/** H1 student: my campus-drive applications (rounds, results, interview slots), withdrawing, and answering offers. */

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { OFFER_TONE, RESULT_TONE, inrFull, label, useOfferStatusLabels, useResultLabels } from "@/components/career/placements/shared";
import { APP_TONE, useAppStatusLabels, useTierLabels, type CampusOffer } from "@/components/career/campus/shared";
import { StudentOfferLetter } from "@/components/career/campus/StudentOfferLetter";

interface MyApp {
  id: string;
  driveId: string;
  status: string;
  companyName?: string | null;
  title?: string | null;
  appliedAt: string;
  sharedWith?: string | null;
  consentCategories: string[];
  documents: { fileId: string; kind: string; fileName?: string | null }[];
  rounds: { id: string; name: string; sequence: number; result?: string | null; slot?: { startUtc: string; endUtc: string; location?: string | null; videoUrl?: string | null; panel?: string | null } | null; ocrLinked: boolean }[];
  offer?: CampusOffer | null;
}

interface Mine {
  timeZone: string;
  items: MyApp[];
}

export default function StudentApplicationsPage() {
  const t = useCareerT("studentApplications");
  const STATUS = useAppStatusLabels();
  const RESULT = useResultLabels();
  const OFFER = useOfferStatusLabels();
  const TIER = useTierLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const mine = useLoad(() => api<Mine>("/api/career/campus/student/applications"), [api, schoolId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(done);
      mine.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const respond = (o: CampusOffer, accept: boolean, release = false) =>
    act("o-" + o.id, () => api(`/api/career/campus/student/offers/${o.id}/respond`, { method: "POST", json: { accept, releaseOtherOffers: release } }), accept ? t("accepted") : t("declined"));

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link className="text-sm underline" href="/student/jobs">
            {t("backToBoard")}
          </Link>
        }
      />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      {mine.loading && !mine.data ? (
        <Loading />
      ) : mine.error ? (
        <ErrorBanner error={mine.error} onRetry={mine.reload} />
      ) : mine.data!.items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="space-y-4">
          {mine.data!.items.map((a) => (
            <Card key={a.id} title={`${a.companyName ?? ""}: ${a.title ?? ""}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={APP_TONE[a.status] ?? "neutral"}>{label(STATUS, a.status)}</Badge>
                <span>{t("appliedOn", { date: formatDate(a.appliedAt) })}</span>
                {a.sharedWith && <span>· {t("sharedWith", { company: a.sharedWith })}</span>}
              </div>
              {a.rounds.length > 0 && (
                <ol className="mt-3 space-y-2 text-sm">
                  {a.rounds.map((r) => (
                    <li key={r.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>
                          {r.sequence}. {r.name}
                        </span>
                        <Badge tone={r.result ? RESULT_TONE[r.result] ?? "neutral" : "neutral"}>{r.result ? label(RESULT, r.result) : t("notYet")}</Badge>
                      </div>
                      {r.slot && (
                        <p className="ms-4 text-muted-foreground">
                          {t("slot", { when: formatDate(r.slot.startUtc, true) })} {r.slot.location ? t("place", { place: r.slot.location }) : ""}{" "}
                          {r.slot.videoUrl && (
                            <a className="underline" href={r.slot.videoUrl} target="_blank" rel="noreferrer">
                              {t("join")}
                            </a>
                          )}
                        </p>
                      )}
                      {r.ocrLinked && r.result === "Pending" && (
                        <p className="ms-4 text-muted-foreground">
                          {t.rich("bookSlot", { link: (c) => <Link className="underline" href="/student/interviews">{c}</Link> })}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {a.offer && (
                <div className="mt-4 rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t("offer", { role: a.offer.roleTitle, ctc: inrFull(a.offer.ctcAnnual) })}</span>
                    <Badge tone={OFFER_TONE[a.offer.status] ?? "neutral"}>{label(OFFER, a.offer.status)}</Badge>
                    <span>{label(TIER, a.offer.tier)}</span>
                  </div>
                  {a.offer.joiningDate && <p>{t("joining", { date: formatDate(a.offer.joiningDate) })}</p>}
                  {a.offer.respondBy && <p>{t("respondBy", { date: formatDate(a.offer.respondBy) })}</p>}
                  {a.offer.letter && <StudentOfferLetter offerId={a.offer.id} onSigned={mine.reload} />}
                  {a.offer.canRespond && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {a.offer.letter?.status !== "Issued" && (
                        <>
                          <Button busy={busy === "o-" + a.offer.id} onClick={() => respond(a.offer!, true)}>
                            {t("accept")}
                          </Button>
                          <Button variant="secondary" busy={busy === "o-" + a.offer.id} onClick={() => respond(a.offer!, true, true)}>
                            {t("acceptAndRelease")}
                          </Button>
                        </>
                      )}
                      <Button variant="danger" busy={busy === "o-" + a.offer.id} onClick={() => respond(a.offer!, false)}>
                        {t("decline")}
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {(a.status === "Applied" || a.status === "InProcess") && (
                <Button
                  className="mt-3"
                  variant="ghost"
                  busy={busy === "w-" + a.id}
                  onClick={() => act("w-" + a.id, () => api(`/api/career/campus/student/applications/${a.id}/withdraw`, { method: "POST", json: {} }), t("withdrawn"))}
                >
                  {t("withdraw")}
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
