"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, ScrollArea, useCareerT } from "@/components/career/ui";
import { EmployerPicker, useEmployers } from "@/components/career/EmployerPicker";

import { DEGREE_LEVELS, useDegreeLevelLabels } from "@/components/career/interviews/shared";

interface Assessments {
  workTrials: { id: string; title: string; roleTitle: string; language: string; sprintId: string; validated: boolean }[];
  ownSprints: { id: string; title: string; requiredLanguage: string }[];
  catalogSprints: { id: string; title: string; requiredLanguage: string }[];
}
interface ChallengeRow {
  id: string;
  title: string;
  status: string;
  sourceKind: string;
  opensAt: string;
  closesAt: string;
  maxParticipants?: number | null;
  participants: number;
  schools: { instituteId: string; status: string }[];
}
interface Relationship { instituteId: string; school?: string | null; status: string }
interface Detail {
  challenge: { id: string; title: string; status: string; description: string; opensAt: string; closesAt: string; externalJobUrl?: string | null; prizeText?: string | null };
  sprint?: { title: string; requiredLanguage: string } | null;
  participants: number;
  schools: { instituteId: string; school?: string | null; status: string; autoApproved: boolean; decisionNote?: string | null }[];
}
interface ResultRow {
  participantId: string;
  name: string;
  school?: string | null;
  degreeLevel?: string | null;
  majors?: string[] | null;
  graduationDate?: string | null;
  submissions: number;
  score?: number | null;
  testsPassed?: number | null;
  testsTotal?: number | null;
  integrityRiskLevel?: string | null;
  defended: boolean;
  defenseScore?: number | null;
  credentialSlug?: string | null;
  credentialUnderReview: boolean;
  inviteCount: number;
}
interface Results { hiddenWithoutConsent: number; note: string; results: ResultRow[] }

const STATUS_TONES: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = { Draft: "neutral", Published: "good", Closed: "neutral", Pending: "warn", Approved: "good", Declined: "bad" };
const RISK_TONES: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = { Clear: "good", Review: "warn", HighRisk: "bad", Unknown: "neutral" };

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EmployerChallengesPage() {
  const tr = useCareerT("employerChallenges");
  const api = useApi();
  const emp = useEmployers();
  const employerId = emp.current?.employer.id;
  const list = useLoad(() => (employerId ? api<ChallengeRow[]>(`/api/career/challenges/employer/${employerId}`) : Promise.resolve([] as ChallengeRow[])), [api, employerId]);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (emp.loading && !emp.data) return <Loading />;
  if (emp.error) return <ErrorBanner error={emp.error} onRetry={emp.reload} />;
  if (!emp.current)
    return (
      <EmptyState title={tr("noCompanyYet")}>
        {tr.rich("setUpYourCompanyFirst", { link: (chunks) => <Link href="/employer" className="underline">{chunks}</Link> })}
      </EmptyState>
    );

  return (
    <div>
      <PageHeader
        title={tr("challenges")}
        description={tr("inviteStudentsToASkills")}
        actions={
          <div className="flex flex-wrap gap-2">
            <EmployerPicker accounts={emp.accounts} current={emp.current} onSelect={emp.select} />
            <Button onClick={() => { setCreating(true); setOpenId(null); }}>{tr("newChallenge")}</Button>
          </div>
        }
      />
      <ErrorBanner error={list.error} onRetry={list.reload} />
      <SuccessBanner message={msg} />
      {creating && employerId && (
        <CreateForm
          employerId={employerId}
          onCancel={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); setOpenId(id); setMsg(tr("challengeSavedAsADraft")); list.reload(); }}
        />
      )}
      {list.loading && !list.data ? (
        <Loading />
      ) : !list.data?.length ? (
        !creating && <EmptyState title={tr("noChallengesYet")}>{tr("createOneFromAValidated")}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.data.map((c) => (
            <li key={c.id}>
              <Card
                title={c.title}
                actions={
                  <Button variant="secondary" aria-expanded={openId === c.id} onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                    {openId === c.id ? tr("hide") : tr("manage")}
                  </Button>
                }
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={STATUS_TONES[c.status]}>{c.status}</Badge>
                  <span>{formatDate(c.opensAt)} – {formatDate(c.closesAt)}</span>
                  <span>{tr("participantsParticipants", { participants: c.participants })}{c.maxParticipants ? tr("ofMaxParticipants", { maxParticipants: c.maxParticipants }) : ""}</span>
                  <span>{tr("countSchools", { count: c.schools.length })}</span>
                </div>
                {openId === c.id && employerId && <Manage employerId={employerId} challengeId={c.id} onChanged={list.reload} />}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateForm({ employerId, onCancel, onCreated }: { employerId: string; onCancel: () => void; onCreated: (id: string) => void }) {
  const tr = useCareerT("employerChallenges");
  const DEGREES = useDegreeLevelLabels();
  const api = useApi();
  const assessments = useLoad(() => api<Assessments>(`/api/career/challenges/employer/${employerId}/assessments`), [api, employerId]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [opensAt, setOpensAt] = useState(() => toLocalInput(new Date()));
  const [closesAt, setClosesAt] = useState(() => toLocalInput(new Date(Date.now() + 14 * 86400000)));
  const [levels, setLevels] = useState<string[]>([]);
  const [majors, setMajors] = useState("");
  const [gradFrom, setGradFrom] = useState("");
  const [gradTo, setGradTo] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [prize, setPrize] = useState("");
  const [max, setMax] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const [kind, id] = source.split(":");
    if (!id) { setErr(tr("chooseTheAssessmentStudentsWill")); return; }
    setBusy(true);
    try {
      const res = await api<{ challenge: { id: string } }>(`/api/career/challenges/employer/${employerId}`, {
        method: "POST",
        json: {
          title, description,
          workTrialId: kind === "trial" ? id : undefined,
          sprintId: kind === "sprint" ? id : undefined,
          opensAt: new Date(opensAt).toISOString(),
          closesAt: new Date(closesAt).toISOString(),
          degreeLevels: levels,
          majors: majors.split(",").map((m) => m.trim()).filter(Boolean),
          gradFrom: gradFrom || null,
          gradTo: gradTo || null,
          externalJobUrl: jobUrl.trim() || null,
          prizeText: prize.trim() || null,
          maxParticipants: max ? Number(max) : null,
        },
      });
      onCreated(res.challenge.id);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const a = assessments.data;
  return (
    <Card title={tr("newChallenge")} className="mb-4">
      <ErrorBanner error={err ?? assessments.error} />
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <Field label={tr("title")}>{(p) => <input {...p} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />}</Field>
        <Field label={tr("assessment")} hint={tr("onlyWorkTrialsThatPassed")}>
          {(p) => (
            <select {...p} value={source} onChange={(e) => setSource(e.target.value)} required>
              <option value="">{tr("choose")}</option>
              {!!a?.workTrials.length && (
                <optgroup label={tr("yourWorkTrials")}>
                  {a.workTrials.filter((t) => t.validated).map((t) => <option key={t.id} value={`trial:${t.id}`}>{t.title} ({t.language})</option>)}
                </optgroup>
              )}
              {!!a?.ownSprints.length && (
                <optgroup label={tr("yourPrivateSprints")}>
                  {a.ownSprints.map((s) => <option key={s.id} value={`sprint:${s.id}`}>{s.title} ({s.requiredLanguage})</option>)}
                </optgroup>
              )}
              {!!a?.catalogSprints.length && (
                <optgroup label={tr("publicSprints")}>
                  {a.catalogSprints.map((s) => <option key={s.id} value={`sprint:${s.id}`}>{s.title} ({s.requiredLanguage})</option>)}
                </optgroup>
              )}
            </select>
          )}
        </Field>
        <div className="md:col-span-2">
          <Field label={tr("description")}>{(p) => <textarea {...p} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={10000} />}</Field>
        </div>
        <Field label={tr("opens")}>{(p) => <input {...p} type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} required />}</Field>
        <Field label={tr("closes")}>{(p) => <input {...p} type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} required />}</Field>
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium">{tr("degreeLevelsNoneSelectedAll")}</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {DEGREE_LEVELS.map((l) => (
              <label key={l} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={levels.includes(l)} onChange={(e) => setLevels(e.target.checked ? [...levels, l] : levels.filter((x) => x !== l))} />
                {DEGREES[l] ?? l}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={tr("majors")} hint={tr("commaSeparatedLeaveEmptyFor")}>{(p) => <input {...p} value={majors} onChange={(e) => setMajors(e.target.value)} />}</Field>
        <Field label={tr("maximumParticipants")} hint={tr("optional")}>{(p) => <input {...p} type="number" min={1} value={max} onChange={(e) => setMax(e.target.value)} />}</Field>
        <Field label={tr("graduatingFrom")} hint={tr("optional")}>{(p) => <input {...p} type="date" value={gradFrom} onChange={(e) => setGradFrom(e.target.value)} />}</Field>
        <Field label={tr("graduatingBy")} hint={tr("optional")}>{(p) => <input {...p} type="date" value={gradTo} onChange={(e) => setGradTo(e.target.value)} />}</Field>
        <Field label={tr("linkToYourJobPage")} hint={tr("optionalHttpsOnlyApplicationsHappen")}>{(p) => <input {...p} type="url" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />}</Field>
        <Field label={tr("prizeOrRecognition")} hint={tr("optional")}>{(p) => <input {...p} value={prize} onChange={(e) => setPrize(e.target.value)} maxLength={500} />}</Field>
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" busy={busy}>{tr("saveDraft")}</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>{tr("cancel")}</Button>
        </div>
      </form>
    </Card>
  );
}

function Manage({ employerId, challengeId, onChanged }: { employerId: string; challengeId: string; onChanged: () => void }) {
  const tr = useCareerT("employerChallenges");
  const api = useApi();
  const detail = useLoad(() => api<Detail>(`/api/career/challenges/employer/${employerId}/${challengeId}`), [api, employerId, challengeId]);
  const rels = useLoad(() => api<Relationship[]>(`/api/career/employer/${employerId}/schools`), [api, employerId]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  if (detail.loading && !detail.data) return <Loading />;
  if (!detail.data) return <ErrorBanner error={detail.error} onRetry={detail.reload} />;
  const d = detail.data;
  const already = new Set(d.schools.map((s) => s.instituteId));
  const approved = (rels.data ?? []).filter((r) => r.status === "Approved" && !already.has(r.instituteId));

  const act = async (name: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(name);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(done);
      detail.reload();
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <p className="text-sm">
        {tr.rich("assessmentTitle", { strong: (chunks) => <strong>{chunks}</strong>, title: d.sprint?.title ?? "—" })}{" "}{d.sprint && `(${d.sprint.requiredLanguage})`}
        {d.challenge.externalJobUrl && (
          <> · <a className="underline" href={d.challenge.externalJobUrl} target="_blank" rel="noreferrer">{tr("yourJobPage")}</a></>
        )}
      </p>
      <section aria-labelledby={`schools-${challengeId}`}>
        <h3 id={`schools-${challengeId}`} className="text-sm font-semibold">{tr("schools")}</h3>
        {d.schools.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr("notPublishedYet")}</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {d.schools.map((s) => (
              <li key={s.instituteId} className="flex flex-wrap items-center gap-2">
                {s.school ?? s.instituteId} <Badge tone={STATUS_TONES[s.status]}>{s.status}{s.autoApproved ? tr("automatic") : ""}</Badge>
                {s.decisionNote && <span className="text-muted-foreground">“{s.decisionNote}”</span>}
              </li>
            ))}
          </ul>
        )}
        {d.challenge.status !== "Closed" && (
          approved.length > 0 ? (
            <fieldset className="mt-2">
              <legend className="text-sm">{tr("publishToSchoolsThatApproved")}</legend>
              <div className="mt-1 flex flex-wrap gap-3">
                {approved.map((r) => (
                  <label key={r.instituteId} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={picked.includes(r.instituteId)} onChange={(e) => setPicked(e.target.checked ? [...picked, r.instituteId] : picked.filter((x) => x !== r.instituteId))} />
                    {r.school ?? r.instituteId}
                  </label>
                ))}
              </div>
              <Button
                className="mt-2"
                disabled={picked.length === 0}
                busy={busy === "publish"}
                onClick={() => act("publish", () => api(`/api/career/challenges/employer/${employerId}/${challengeId}/publish`, { method: "POST", json: { instituteIds: picked } }), tr("publishedStudentsSeeItOnce")).then(() => setPicked([]))}
              >
                {tr("publish")}
              </Button>
            </fieldset>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {tr.rich("toReachMoreSchoolsRequest", { link: (chunks) => <Link className="underline" href="/employer/schools">{chunks}</Link> })}
            </p>
          )
        )}
      </section>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" aria-expanded={showResults} onClick={() => setShowResults(!showResults)}>{showResults ? tr("hideResults") : tr("resultsParticipants", { participants: d.participants })}</Button>
        {d.challenge.status !== "Closed" && (
          <Button variant="danger" busy={busy === "close"} onClick={() => act("close", () => api(`/api/career/challenges/employer/${employerId}/${challengeId}/close`, { method: "POST" }), tr("challengeClosed"))}>
            {tr("closeChallenge")}
          </Button>
        )}
      </div>
      {showResults && <ResultsView employerId={employerId} challengeId={challengeId} />}
    </div>
  );
}

function ResultsView({ employerId, challengeId }: { employerId: string; challengeId: string }) {
  const tr = useCareerT("employerChallenges");
  const api = useApi();
  const res = useLoad(() => api<Results>(`/api/career/challenges/employer/${employerId}/${challengeId}/results`), [api, employerId, challengeId]);
  const [pack, setPack] = useState<{ id: string; data: Record<string, unknown> } | null>(null);
  const [inviting, setInviting] = useState<ResultRow | null>(null);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (res.loading && !res.data) return <Loading label={tr("loadingResults")} />;
  if (!res.data) return <ErrorBanner error={res.error} onRetry={res.reload} />;

  const openPack = async (row: ResultRow) => {
    setBusy(`pack-${row.participantId}`);
    setErr(null);
    try {
      setPack({ id: row.participantId, data: await api<Record<string, unknown>>(`/api/career/challenges/employer/${employerId}/${challengeId}/participants/${row.participantId}/evidence`) });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviting) return;
    setBusy("invite");
    setErr(null);
    setMsg(null);
    try {
      await api(`/api/career/challenges/employer/${employerId}/${challengeId}/participants/${inviting.participantId}/invite`, { method: "POST", json: { message, link: link.trim() || null } });
      setMsg(tr("invitationSentToNameThey", { name: inviting.name }));
      setInviting(null);
      setMessage("");
      setLink("");
      res.reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const r = res.data;
  return (
    <section aria-label={tr("results")} className="space-y-3">
      <p className="text-sm text-muted-foreground">{r.note}</p>
      {r.hiddenWithoutConsent > 0 && <p className="text-sm" role="status">{tr("hiddenWithoutConsentParticipantSArentSha", { hiddenWithoutConsent: r.hiddenWithoutConsent })}</p>}
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      {r.results.length === 0 ? (
        <EmptyState title={tr("noSharedResultsYet")} />
      ) : (
        <ScrollArea>
          <table className="w-full text-start text-sm [&_th]:text-start">
            <caption className="sr-only">{tr("participantsSharingResults")}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="p-2">{tr("student2")}</th>
                <th scope="col" className="p-2">{tr("program")}</th>
                <th scope="col" className="p-2">{tr("score")}</th>
                <th scope="col" className="p-2">{tr("integritySignal")}</th>
                <th scope="col" className="p-2">{tr("defense")}</th>
                <th scope="col" className="p-2"><span className="sr-only">{tr("actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {r.results.map((row) => (
                <tr key={row.participantId} className="border-b border-border align-top">
                  <td className="p-2">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">{row.school}</div>
                  </td>
                  <td className="p-2">
                    {row.degreeLevel ?? "—"} {row.majors?.length ? `· ${row.majors.join(", ")}` : ""}
                    {row.graduationDate && <div className="text-xs text-muted-foreground">{tr("graduatesGraduationDate", { graduationDate: formatDate(row.graduationDate) })}</div>}
                  </td>
                  <td className="p-2">
                    {row.submissions === 0 ? tr("notSubmitted") : row.score == null ? tr("running") : `${row.score}%`}
                    {row.testsTotal ? <div className="text-xs text-muted-foreground">{tr("testsPassedTestsTotalTests", { testsPassed: row.testsPassed, testsTotal: row.testsTotal })}</div> : null}
                  </td>
                  <td className="p-2">{row.integrityRiskLevel ? <Badge tone={RISK_TONES[row.integrityRiskLevel] ?? "neutral"}>{row.integrityRiskLevel}</Badge> : "—"}</td>
                  <td className="p-2">
                    {row.defended ? tr("defendedDefenseScore", { defenseScore: row.defenseScore ?? "—" }) : tr("notYet")}
                    {row.credentialSlug && (
                      <div><Link className="text-xs underline" href={`/credential/${row.credentialSlug}`}>{tr("credential")}{row.credentialUnderReview ? tr("underReview") : ""}</Link></div>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      {row.submissions > 0 && (
                        <Button variant="secondary" busy={busy === `pack-${row.participantId}`} onClick={() => openPack(row)}>{tr("evidencePack")}</Button>
                      )}
                      <Button variant="ghost" onClick={() => setInviting(row)}>{tr("inviteToTalk")}{row.inviteCount ? tr("inviteCountSent", { inviteCount: row.inviteCount }) : ""}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
      {inviting && (
        <Card title={tr("inviteNameToTalk", { name: inviting.name })}>
          <form onSubmit={sendInvite} className="space-y-3">
            <p className="text-sm text-muted-foreground">{tr("theStudentGetsANotification")}</p>
            <Field label={tr("message")}>{(p) => <textarea {...p} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} minLength={10} maxLength={2000} required />}</Field>
            <Field label={tr("linkOptional")} hint={tr("forExampleASchedulingPage")}>{(p) => <input {...p} type="url" value={link} onChange={(e) => setLink(e.target.value)} />}</Field>
            <div className="flex gap-2">
              <Button type="submit" busy={busy === "invite"}>{tr("sendInvitation")}</Button>
              <Button type="button" variant="secondary" onClick={() => setInviting(null)}>{tr("cancel")}</Button>
            </div>
          </form>
        </Card>
      )}
      {pack && <EvidencePackView pack={pack.data} onClose={() => setPack(null)} />}
    </section>
  );
}

function EvidencePackView({ pack, onClose }: { pack: Record<string, unknown>; onClose: () => void }) {
  const tr = useCareerT("employerChallenges");
  const tests = pack.tests as { passed?: number; total?: number } | undefined;
  const integrity = pack.integrity as { riskLevel?: string; signals?: { description?: string; title?: string; kind?: string }[] } | undefined;
  const defects = (pack.defects as { title?: string; fixedDefect?: boolean }[] | undefined) ?? [];
  const notes = (pack.consistencyNotes as string[] | undefined) ?? [];
  const candidate = pack.candidate as { name?: string } | undefined;
  return (
    <Card title={tr("evidencePackName", { name: candidate?.name ?? tr("student") })} actions={<Button variant="secondary" onClick={onClose}>{tr("close")}</Button>}>
      <div className="space-y-3 text-sm">
        <p>{tr("testsPassedTotal", { passed: tests?.passed ?? 0, total: tests?.total ?? 0 })}</p>
        {defects.length > 0 && (
          <div>
            <h4 className="font-semibold">{tr("plantedDefects")}</h4>
            <ul className="list-disc ps-5">
              {defects.map((d, i) => <li key={i}>{d.title}: {d.fixedDefect ? tr("fixed") : tr("notFixed")}</li>)}
            </ul>
          </div>
        )}
        <div>
          <h4 className="font-semibold">{tr("integritySignals")}</h4>
          <p>{tr("levelRiskLevel", { riskLevel: integrity?.riskLevel ?? "—" })}</p>
          {!!integrity?.signals?.length && (
            <ul className="list-disc ps-5">
              {integrity.signals.map((s, i) => <li key={i}>{s.description ?? s.title ?? s.kind}</li>)}
            </ul>
          )}
        </div>
        {notes.length > 0 && <ul className="list-disc ps-5">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
        <p className="text-xs text-muted-foreground">{String(pack.disclaimer ?? "")}</p>
      </div>
    </Card>
  );
}
