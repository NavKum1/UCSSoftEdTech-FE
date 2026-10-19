"use client";

/**
 * H1 selection workspace for one campus drive, shared by the employer (/employer/drives/[id]) and the placement office
 * (/career-center/placements/drives/[id]): applicants with their academic record, round-by-round shortlists (also from a
 * CSV/Excel file), results, interview slots, the C4 interview-schedule link and offers.
 * For an employer every load of the applicant list is a logged disclosure (the API releases data with the student's consent).
 */

import React, { useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, ScrollArea, SuccessBanner, formatDate, useCareerT } from "@/components/career/ui";
import { useRunner } from "@/components/career/placements/useRunner";
import { OFFER_TONE, inrFull, label, useOfferStatusLabels, useResultLabels } from "@/components/career/placements/shared";
import { APP_TONE, ELIG_TONE, localToIso, toNum, useAppStatusLabels, useDocKindLabels, useEligLabels, useTierLabels, type Applicant, type CampusRound } from "@/components/career/campus/shared";
import { OfferLetterPanel } from "@/components/career/campus/OfferLetterPanel";

const th = "py-2 pe-3 font-medium";
const td = "py-2 pe-3 align-top";
const RESULTS = ["Pending", "Cleared", "NotCleared", "Absent"];

export function DriveWorkspace({
  base,
  mode,
  rounds,
  applicants,
  onChanged,
}: {
  base: string;
  mode: "employer" | "staff";
  rounds: CampusRound[];
  applicants: Applicant[];
  onChanged: () => void;
}) {
  const t = useCareerT("campusWorkspace");
  const RESULT_LABELS = useResultLabels();
  const STATUS = useAppStatusLabels();
  const ELIG = useEligLabels();
  const KIND = useDocKindLabels();
  const TIER = useTierLabels();
  const OFFER = useOfferStatusLabels();
  const { api, busy, err, msg, setMsg, run, download } = useRunner();
  const [selected, setSelected] = useState<string[]>([]);
  const [roundId, setRoundId] = useState<string>(rounds[0]?.id ?? "");
  const [result, setResult] = useState("Cleared");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ ready: number; issueCount: number; issues: { line: number; message: string }[] } | null>(null);
  const [slot, setSlot] = useState({ start: "", minutes: "30", gap: "0", location: "", videoUrl: "", panel: "" });
  const [newRound, setNewRound] = useState("");
  const [offer, setOffer] = useState({ applicationId: "", ctcText: "", joiningDate: "", respondBy: "", override: false });
  const [ocrId, setOcrId] = useState("");
  const [letterOffer, setLetterOffer] = useState("");
  const withOffers = applicants.filter((a) => a.released && a.student && a.progress?.offer);

  const active = applicants.filter((a) => a.status !== "Withdrawn");
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const after = (m: string) => {
    setMsg(m);
    setSelected([]);
    onChanged();
  };

  const shortlist = () =>
    run("shortlist", async () => {
      const r = await api<{ shortlisted: number; skipped: unknown[] }>(`${base}/rounds/${roundId}/shortlist`, { method: "POST", json: { applicationIds: selected } });
      after(t("shortlistedCount", { count: r.shortlisted, skipped: r.skipped.length }));
    });
  const record = () =>
    run("results", async () => {
      const r = await api<{ written: number }>(`${base}/rounds/${roundId}/results`, { method: "PUT", json: selected.map((applicationId) => ({ applicationId, result })) });
      after(t("resultsRecorded", { count: r.written }));
    });
  const importFile = (commit: boolean) =>
    run(commit ? "import" : "check", async () => {
      if (!file) throw new Error(t("chooseFile"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("commit", commit ? "true" : "false");
      const r = await api<{ ready: number; issueCount: number; issues: { line: number; message: string }[]; written?: number }>(`${base}/rounds/${roundId}/shortlist/import`, { method: "POST", body: fd });
      setPreview(r);
      if (commit) after(t("importDone", { count: r.written ?? 0 }));
      else setMsg(t("checkDone", { ready: r.ready, issues: r.issueCount }));
    });
  const schedule = () =>
    run("slots", async () => {
      const r = await api<{ scheduled: number }>(`${base}/rounds/${roundId}/slots`, {
        method: "POST",
        json: {
          startUtc: localToIso(slot.start),
          slotMinutes: toNum(slot.minutes) ?? 30,
          gapMinutes: toNum(slot.gap) ?? 0,
          location: slot.location || undefined,
          videoUrl: slot.videoUrl || undefined,
          panel: slot.panel || undefined,
          applicationIds: selected.length ? selected : undefined,
        },
      });
      after(t("slotsScheduled", { count: r.scheduled }));
    });
  const addRound = () =>
    run("round", async () => {
      await api(`${base}/rounds`, { method: "POST", json: { name: newRound } });
      setNewRound("");
      after(t("roundAdded"));
    });
  const makeOffer = () =>
    run("offer", async () => {
      await api(`${base}/offers`, {
        method: "POST",
        json: {
          applicationId: offer.applicationId,
          ctcText: offer.ctcText || undefined,
          joiningDate: offer.joiningDate || undefined,
          respondBy: offer.respondBy || undefined,
          overridePolicy: mode === "staff" ? offer.override : false,
        },
      });
      setOffer({ applicationId: "", ctcText: "", joiningDate: "", respondBy: "", override: false });
      after(t("offerMade"));
    });
  const revoke = (offerId: string) =>
    run("revoke-" + offerId, async () => {
      await api(`${base}/offers/${offerId}/revoke`, { method: "POST" });
      after(t("offerRevoked"));
    });
  const linkOcr = () =>
    run("ocr", async () => {
      await api(`${base}/rounds/${roundId}/interview-schedule`, { method: "PUT", json: { ocrScheduleId: ocrId.trim() || null } });
      after(t("scheduleLinked"));
    });
  const inviteOcr = () =>
    run("invite", async () => {
      const r = await api<{ added: number }>(`${base}/rounds/${roundId}/interview-schedule/invite`, { method: "POST" });
      after(t("invited", { count: r.added }));
    });

  const roundSelect = (
    <Field label={t("round")}>
      {(p) => (
        <select {...p} value={roundId} onChange={(e) => setRoundId(e.target.value)}>
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.sequence}. {r.name}
            </option>
          ))}
        </select>
      )}
    </Field>
  );

  return (
    <div className="space-y-6">
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <Card title={t("rounds")}>
        {rounds.length === 0 ? (
          <EmptyState title={t("noRounds")} />
        ) : (
          <ol className="space-y-1 text-sm">
            {rounds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {r.sequence}. {r.name}
                </span>
                <span className="text-muted-foreground">{t("roundCounts", { shortlisted: r.shortlisted, cleared: r.cleared, slots: r.slots })}</span>
                {r.ocrScheduleId && <Badge tone="info">{t("linkedSchedule")}</Badge>}
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <Field label={t("newRound")}>{(p) => <input {...p} value={newRound} onChange={(e) => setNewRound(e.target.value)} />}</Field>
          <Button variant="secondary" busy={busy === "round"} disabled={!newRound.trim()} onClick={addRound}>
            {t("addRound")}
          </Button>
        </div>
      </Card>

      <Card title={t("applicants", { count: active.length })}>
        {applicants.length === 0 ? (
          <EmptyState title={t("noApplicants")} />
        ) : (
          <ScrollArea label={t("applicantsTable")}>
            <table className="w-full text-sm">
              <caption className="sr-only">{t("applicantsTable")}</caption>
              <thead>
                <tr className="border-b border-border [&_th]:text-start">
                  <th scope="col" className={th}>
                    <span className="sr-only">{t("select")}</span>
                  </th>
                  <th scope="col" className={th}>{t("student")}</th>
                  <th scope="col" className={th}>{t("academics")}</th>
                  <th scope="col" className={th}>{t("eligibility")}</th>
                  <th scope="col" className={th}>{t("status")}</th>
                  {rounds.map((r) => (
                    <th key={r.id} scope="col" className={th}>
                      {r.name}
                    </th>
                  ))}
                  <th scope="col" className={th}>{t("slot")}</th>
                  <th scope="col" className={th}>{t("offer")}</th>
                  <th scope="col" className={th}>{t("documents")}</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className={td}>
                      {a.status !== "Withdrawn" && a.released && (
                        <input type="checkbox" aria-label={t("selectApplicant", { name: a.student?.name ?? a.id })} checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
                      )}
                    </td>
                    <th scope="row" className={`${td} text-start font-normal`}>
                      {a.student ? (
                        <>
                          <bdi className="font-medium">{a.student.name}</bdi>
                          <div className="text-xs text-muted-foreground">
                            <bdi>{a.student.email}</bdi> · {a.student.rollNumber ?? "—"}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">{a.status === "Withdrawn" ? t("withdrawnHidden") : (a.reason ?? t("notShared"))}</span>
                      )}
                    </th>
                    <td className={td}>
                      {a.student ? (
                        <>
                          <div>
                            {a.student.degree} {a.student.branch} · {a.student.batch ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">{t("cgpaLine", { cgpa: a.student.cgpa ?? "—", backlogs: a.student.activeBacklogs ?? "—", p10: a.student.class10Percent ?? "—", p12: a.student.class12Percent ?? "—" })}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={td}>{a.eligibilityNow ? <Badge tone={ELIG_TONE[a.eligibilityNow] ?? "neutral"}>{label(ELIG, a.eligibilityNow)}</Badge> : "—"}</td>
                    <td className={td}>
                      <Badge tone={APP_TONE[a.status] ?? "neutral"}>{label(STATUS, a.status)}</Badge>
                    </td>
                    {rounds.map((r) => {
                      const res = a.progress?.rounds.find((x) => x.roundId === r.id)?.result;
                      return (
                        <td key={r.id} className={td}>
                          {res ? label(RESULT_LABELS, res) : "—"}
                        </td>
                      );
                    })}
                    <td className={td}>{a.progress?.slot ? formatDate(a.progress.slot.startUtc, true) : "—"}</td>
                    <td className={td}>
                      {a.progress?.offer ? (
                        <div className="space-y-1">
                          <div>
                            {inrFull(a.progress.offer.ctcAnnual)} · {label(TIER, a.progress.offer.tier)}
                          </div>
                          <Badge tone={OFFER_TONE[a.progress.offer.status] ?? "neutral"}>{label(OFFER, a.progress.offer.status)}</Badge>
                          {a.progress.offer.status === "Offered" && (
                            <Button variant="ghost" busy={busy === "revoke-" + a.progress.offer.id} onClick={() => revoke(a.progress!.offer!.id)}>
                              {t("revokeOffer")}
                            </Button>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={td}>
                      {(a.documents ?? []).map((d) => (
                        <button
                          key={d.fileId}
                          type="button"
                          className="block underline"
                          onClick={() => download(`${base}/applicants/${a.id}/documents/${d.fileId}`, "doc-" + d.fileId, d.fileName)}
                        >
                          {label(KIND, d.kind)}: <bdi>{d.fileName}</bdi>
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
        {mode === "employer" && <p className="mt-3 text-xs text-muted-foreground">{t("disclosureNote")}</p>}
      </Card>

      {rounds.length > 0 && (
        <Card title={t("selection")}>
          <div className="grid gap-4 md:grid-cols-3">
            {roundSelect}
            <div className="flex items-end gap-2">
              <Button busy={busy === "shortlist"} disabled={selected.length === 0} onClick={shortlist}>
                {t("shortlistSelected", { count: selected.length })}
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t("result")}>
                {(p) => (
                  <select {...p} value={result} onChange={(e) => setResult(e.target.value)}>
                    {RESULTS.map((r) => (
                      <option key={r} value={r}>
                        {label(RESULT_LABELS, r)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Button variant="secondary" busy={busy === "results"} disabled={selected.length === 0} onClick={record}>
                {t("recordResult")}
              </Button>
            </div>
          </div>

          <h3 className="mt-6 text-sm font-semibold">{t("importTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("importHelp")}</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Field label={t("file")}>{(p) => <input {...p} type="file" accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}</Field>
            <Button variant="secondary" busy={busy === "check"} disabled={!file} onClick={() => importFile(false)}>
              {t("checkFile")}
            </Button>
            <Button busy={busy === "import"} disabled={!file || !preview} onClick={() => importFile(true)}>
              {t("importFile")}
            </Button>
          </div>
          {preview && preview.issues.length > 0 && (
            <ul className="mt-2 list-disc ps-5 text-sm text-muted-foreground">
              {preview.issues.slice(0, 20).map((i) => (
                <li key={i.line + i.message}>{t("issueLine", { line: i.line, message: i.message })}</li>
              ))}
            </ul>
          )}

          <h3 className="mt-6 text-sm font-semibold">{t("slotsTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("slotsHelp")}</p>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            <Field label={t("firstSlot")}>{(p) => <input {...p} type="datetime-local" value={slot.start} onChange={(e) => setSlot({ ...slot, start: e.target.value })} />}</Field>
            <Field label={t("slotMinutes")}>{(p) => <input {...p} inputMode="numeric" value={slot.minutes} onChange={(e) => setSlot({ ...slot, minutes: e.target.value })} />}</Field>
            <Field label={t("gapMinutes")}>{(p) => <input {...p} inputMode="numeric" value={slot.gap} onChange={(e) => setSlot({ ...slot, gap: e.target.value })} />}</Field>
            <Field label={t("place")}>{(p) => <input {...p} value={slot.location} onChange={(e) => setSlot({ ...slot, location: e.target.value })} />}</Field>
            <Field label={t("videoLink")}>{(p) => <input {...p} type="url" value={slot.videoUrl} onChange={(e) => setSlot({ ...slot, videoUrl: e.target.value })} />}</Field>
            <Field label={t("panel")}>{(p) => <input {...p} value={slot.panel} onChange={(e) => setSlot({ ...slot, panel: e.target.value })} />}</Field>
          </div>
          <Button className="mt-3" busy={busy === "slots"} disabled={!slot.start} onClick={schedule}>
            {selected.length ? t("scheduleSelected", { count: selected.length }) : t("scheduleShortlist")}
          </Button>

          <h3 className="mt-6 text-sm font-semibold">{t("c4Title")}</h3>
          <p className="text-sm text-muted-foreground">{t("c4Help")}</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Field label={t("scheduleId")}>{(p) => <input {...p} value={ocrId} onChange={(e) => setOcrId(e.target.value)} />}</Field>
            <Button variant="secondary" busy={busy === "ocr"} onClick={linkOcr}>
              {t("linkSchedule")}
            </Button>
            <Button variant="secondary" busy={busy === "invite"} onClick={inviteOcr}>
              {t("inviteShortlist")}
            </Button>
          </div>
        </Card>
      )}

      <Card title={t("makeOfferTitle")}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("applicant")}>
            {(p) => (
              <select {...p} value={offer.applicationId} onChange={(e) => setOffer({ ...offer, applicationId: e.target.value })}>
                <option value="">{t("chooseApplicant")}</option>
                {active
                  .filter((a) => a.released && a.student && !a.progress?.offer)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.student!.name}
                    </option>
                  ))}
              </select>
            )}
          </Field>
          <Field label={t("ctc")} hint={t("ctcHint")}>
            {(p) => <input {...p} value={offer.ctcText} onChange={(e) => setOffer({ ...offer, ctcText: e.target.value })} />}
          </Field>
          <Field label={t("joiningDate")}>{(p) => <input {...p} type="date" value={offer.joiningDate} onChange={(e) => setOffer({ ...offer, joiningDate: e.target.value })} />}</Field>
          <Field label={t("respondBy")}>{(p) => <input {...p} type="date" value={offer.respondBy} onChange={(e) => setOffer({ ...offer, respondBy: e.target.value })} />}</Field>
        </div>
        {mode === "staff" && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={offer.override} onChange={(e) => setOffer({ ...offer, override: e.target.checked })} />
            {t("overridePolicy")}
          </label>
        )}
        <Button className="mt-3" busy={busy === "offer"} disabled={!offer.applicationId} onClick={makeOffer}>
          {t("makeOffer")}
        </Button>
      </Card>

      {withOffers.length > 0 && (
        <Card title={t("lettersTitle")}>
          <p className="mb-3 text-sm text-muted-foreground">{t("lettersHelp")}</p>
          <Field label={t("letterFor")}>
            {(p) => (
              <select {...p} value={letterOffer} onChange={(e) => setLetterOffer(e.target.value)}>
                <option value="">{t("chooseOffer")}</option>
                {withOffers.map((a) => (
                  <option key={a.progress!.offer!.id} value={a.progress!.offer!.id}>
                    {`${a.student!.name} · ${label(OFFER, a.progress!.offer!.status)}`}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {letterOffer && (
            <div className="mt-4">
              <OfferLetterPanel key={letterOffer} base={base} offerId={letterOffer} onChanged={onChanged} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
