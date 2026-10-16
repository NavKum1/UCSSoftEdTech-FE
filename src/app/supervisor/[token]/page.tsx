"use client";

/**
 * Public page for an internship site supervisor (no account). The secure link in the URL does one job:
 * confirm and sign the learning agreement, approve weekly hours, or complete an evaluation.
 * Brand-aware header from /api/career/brand for the student's school.
 */

import type { CareerTranslator } from "@/components/career/i18n/CareerI18nProvider";
import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiClient";
import { BRAND_TEXT_CLASS, brandCssVars } from "@/components/career/brandColor";
import { Badge, Button, Card, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useCareerT } from "@/components/career/ui";
import type { Question } from "@/components/career/experiences/shared";

interface Brand {
  displayName: string;
  logoUrl?: string | null;
  primaryColor: string;
  supportEmail?: string | null;
  privacyUrl?: string | null;
  showPoweredBy: boolean;
}

interface SupervisorView {
  purpose: "Agreement" | "Hours" | "MidtermEvaluation" | "FinalEvaluation";
  expiresAt: string;
  school: { displayName: string; slug: string };
  experience: {
    studentName: string;
    employerName: string;
    roleTitle: string;
    startDate: string;
    endDate: string;
    hoursPerWeek: number;
    paid: boolean;
    location?: string | null;
    remote: boolean;
    supervisorName: string;
    supervisorTitle?: string | null;
    status: string;
    learningObjectives: string[];
    program: { code: string; title: string; creditHours: number; requiredHours: number };
    supervisorConfirmedAt?: string | null;
  };
  agreement: { version: number; text: string; sha256: string; signatures: { role: string; name: string; signedAt: string }[]; supervisorSigned: boolean; canSign: boolean } | null;
  hours: { id: string; weekStart: string; hours: number; description?: string | null; status: string; decisionNote?: string | null }[] | null;
  // G2 country packs: logbook (diary) detail per week, keyed by the hour entry
  logbook?: {
    hourLogId: string;
    days: { date: string; hours: number; activity?: string | null }[];
    tasks: string;
    learning?: string | null;
    challenges?: string | null;
    nextPlan?: string | null;
    supervisorSignedName?: string | null;
    supervisorSignedAt?: string | null;
  }[] | null;
  evaluation: { kind: string; questions: Question[]; ratingScaleMax: number; submitted: boolean; canSubmit: boolean } | null;
}

async function request<T>(path: string, body: unknown, failed: (status: number) => string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : failed(res.status);
    throw new Error(message);
  }
  return data as T;
}

/** The API helper with its fallback error in the page language (G1). */
function useCall() {
  const t = useCareerT("supervisor");
  return useCallback(<T,>(path: string, body?: unknown) => request<T>(path, body, (status) => t("somethingWentWrongStatus", { status })), [t]);
}

export default function SupervisorPage() {
  const tr = useCareerT("supervisor");
  const call = useCall();
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<SupervisorView | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const path = `/api/career/experiences/supervisor/${encodeURIComponent(token)}`;

  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    call<SupervisorView>(path)
      .then((v) => {
        if (cancelled) return;
        setView(v);
        call<Brand>(`/api/career/brand?school=${encodeURIComponent(v.school.slug)}`).then((b) => !cancelled && setBrand(b)).catch(() => {});
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setView(null);
        call<Brand>(`/api/career/brand?host=${encodeURIComponent(window.location.hostname)}`).then((b) => !cancelled && setBrand(b)).catch(() => {});
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, tick, call]);

  const act = async (fn: () => Promise<unknown>, success: string, finished = false) => {
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(success);
      // Single-use links stop working once their job is done, so show the confirmation instead of reloading
      if (finished) setView(null);
      else setTick((t) => t + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const color = brand?.primaryColor ?? "#4f46e5";
  return (
    <div className="min-h-screen bg-background text-foreground" style={brandCssVars(color) as React.CSSProperties}>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.displayName} className="h-8 w-auto" />
          ) : (
            <span className={`font-semibold ${BRAND_TEXT_CLASS}`}>
              {brand?.displayName ?? ""}
            </span>
          )}
          {view && <span className="text-sm text-muted-foreground">{tr("forDisplayName", { displayName: view.school.displayName })}</span>}
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">{view ? titleFor(view, tr) : tr("internshipSupervisor")}</h1>
        <div aria-live="polite">
          <ErrorBanner error={error} />
          <SuccessBanner message={msg} />
        </div>
        {loading && !view ? <Loading /> : view ? <Body view={view} path={path} act={act} /> : null}
        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          <p>{tr("thisSecureLinkIsOnly")}{view ? tr("itExpiresOnExpiresAt", { expiresAt: formatDate(view.expiresAt) }) : ""}</p>
          <p className="mt-1">
            {tr("theStudentsInformationIsShared")}
            {brand?.supportEmail ? tr("questionsSupportEmail", { supportEmail: brand.supportEmail }) : ""}
            {brand?.privacyUrl && (
              <>
                {" "}
                <a href={brand.privacyUrl} className="underline">
                  {tr("privacy")}
                </a>
              </>
            )}
          </p>
        </footer>
      </main>
    </div>
  );
}

function titleFor(v: SupervisorView, t: CareerTranslator) {
  const name = v.experience.studentName;
  switch (v.purpose) {
    case "Agreement":
      return t("titleAgreement", { name });
    case "Hours":
      return t("titleHours", { name });
    case "MidtermEvaluation":
      return t("titleMidterm", { name });
    default:
      return t("titleFinal", { name });
  }
}

function Body({ view, path, act }: { view: SupervisorView; path: string; act: (fn: () => Promise<unknown>, success: string, finished?: boolean) => Promise<void> }) {
  const tr = useCareerT("supervisor");
  const x = view.experience;
  return (
    <>
      <Card title={tr("internship")}>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{tr("student")}</dt>
            <dd>{x.studentName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{tr("role")}</dt>
            <dd>
              {x.roleTitle}, {x.employerName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{tr("dates")}</dt>
            <dd>
              {tr("startDateToEndDate", { startDate: formatDate(x.startDate), endDate: formatDate(x.endDate) })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{tr("hoursPerWeek")}</dt>
            <dd>
              {x.hoursPerWeek} · {x.paid ? tr("paid") : tr("unpaid")} · {x.remote ? tr("remote") : x.location}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{tr("academicProgram")}</dt>
            <dd>
              {tr("codeTitleRequiredHoursHours", { code: x.program.code, title: x.program.title, requiredHours: x.program.requiredHours })}
            </dd>
          </div>
        </dl>
      </Card>
      {view.purpose === "Agreement" && view.agreement && <AgreementSection view={view} path={path} act={act} />}
      {view.purpose === "Hours" && <HoursSection view={view} path={path} act={act} />}
      {view.evaluation && <EvaluationSection view={view} path={path} act={act} />}
    </>
  );
}

function AgreementSection({ view, path, act }: { view: SupervisorView; path: string; act: (fn: () => Promise<unknown>, success: string, finished?: boolean) => Promise<void> }) {
  const tr = useCareerT("supervisor");
  const call = useCall();
  const a = view.agreement!;
  const [typed, setTyped] = useState("");
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState("");
  const [showCorrections, setShowCorrections] = useState(false);
  return (
    <Card title={tr("learningAgreementVersionVersion", { version: a.version })}>
      <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs" tabIndex={0} aria-label={tr("agreementText")}>
        {a.text}
      </pre>
      <p className="mt-2 break-all text-xs text-muted-foreground">{tr("documentFingerprintSHA256Sha256", { sha256: a.sha256 })}</p>
      <p className="mt-3 text-sm">
        {tr("signedSoFar")}{" "}{a.signatures.length ? a.signatures.map((s) => `${s.role.toLowerCase()} (${s.name})`).join(", ") : tr("nobodyYet")}.
      </p>
      {a.supervisorSigned ? (
        <p className="mt-3 text-sm font-medium">{tr("youSignedThisVersionThank")}</p>
      ) : a.canSign ? (
        <>
          {!view.experience.supervisorConfirmedAt && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => act(() => call(`${path}/confirm`, {}), tr("thanksForConfirmingTheDetails"))}>
                {tr("theDetailsAreCorrect")}
              </Button>
              <Button variant="ghost" onClick={() => setShowCorrections(true)}>
                {tr("somethingNeedsCorrecting")}
              </Button>
            </div>
          )}
          {showCorrections && (
            <form
              className="mt-4 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                act(() => call(`${path}/confirm`, { note }), tr("sentTheStudentAndThe"));
                setShowCorrections(false);
              }}
            >
              <Field label={tr("whatNeedsCorrecting")}>{(p) => <textarea {...p} rows={3} value={note} onChange={(e) => setNote(e.target.value)} required />}</Field>
              <Button type="submit" variant="secondary">
                {tr("sendCorrections")}
              </Button>
            </form>
          )}
          <form
            className="mt-6 space-y-3 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => call(`${path}/sign`, { typedName: typed, sha256: a.sha256, consent }), tr("youSignedTheLearningAgreement"), true);
            }}
          >
            <Field label={tr("typeYourFullNameTo")}>{(p) => <input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="name" required />}</Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
              <span>{tr("iHaveReadThisVersion")}</span>
            </label>
            <Button type="submit" disabled={!consent || typed.trim().length < 2}>
              {tr("signAgreement")}
            </Button>
          </form>
        </>
      ) : (
        <p className="mt-3 text-sm">{tr("thisAgreementIsntOpenFor")}</p>
      )}
    </Card>
  );
}

function HoursSection({ view, path, act }: { view: SupervisorView; path: string; act: (fn: () => Promise<unknown>, success: string, finished?: boolean) => Promise<void> }) {
  const tr = useCareerT("supervisor");
  const call = useCall();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [signer, setSigner] = useState(view.experience.supervisorName);
  const hours = view.hours ?? [];
  const logbook = view.logbook ?? [];
  return (
    <Card title={logbook.length ? tr("logbookAndWeeklyHours") : tr("weeklyHours")}>
      {logbook.length > 0 && hours.some((h) => h.status === "Pending") && (
        <div className="mb-4">
          <Field label={tr("yourNameForTheSign")} hint={tr("approvingAWeekSignsOff")}>
            {(p) => <input {...p} value={signer} onChange={(e) => setSigner(e.target.value)} autoComplete="name" required />}
          </Field>
        </div>
      )}
      {hours.length === 0 ? (
        <p className="text-sm">{tr("noHoursLoggedYet")}</p>
      ) : (
        <ul className="space-y-4">
          {hours.map((h) => (
            <li key={h.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {tr("weekOfWeekStartHoursHours", { weekStart: formatDate(h.weekStart), hours: h.hours })}
                </span>
                <Badge tone={h.status === "Approved" ? "good" : h.status === "Rejected" ? "bad" : "warn"}>{h.status === "Rejected" ? tr("returned") : h.status}</Badge>
              </div>
              {(() => {
                const l = logbook.find((x) => x.hourLogId === h.id);
                if (!l) return h.description && <p className="mt-1">{h.description}</p>;
                return (
                  <div className="mt-2 space-y-1">
                    {l.days.length > 0 && (
                      <ul>
                        {l.days.map((d) => (
                          <li key={d.date}>
                            {tr("dateHoursH", { date: formatDate(d.date), hours: d.hours })}{d.activity ? `, ${d.activity}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p>
                      <span className="text-muted-foreground">{tr("workDone")}</span> {l.tasks}
                    </p>
                    {l.learning && (
                      <p>
                        <span className="text-muted-foreground">{tr("learning")}</span> {l.learning}
                      </p>
                    )}
                    {l.challenges && (
                      <p>
                        <span className="text-muted-foreground">{tr("challenges")}</span> {l.challenges}
                      </p>
                    )}
                    {l.nextPlan && (
                      <p>
                        <span className="text-muted-foreground">{tr("planForNextWeek")}</span> {l.nextPlan}
                      </p>
                    )}
                    {l.supervisorSignedAt && <p className="text-xs">{tr("signedOffBySupervisorSignedNameOn", { supervisorSignedName: l.supervisorSignedName, supervisorSignedAt: formatDate(l.supervisorSignedAt, true) })}</p>}
                  </div>
                );
              })()}
              {h.decisionNote && <p className="mt-1 text-muted-foreground">{tr("noteDecisionNote", { decisionNote: h.decisionNote })}</p>}
              {h.status === "Pending" && (
                <div className="mt-3 space-y-2">
                  <Field label={tr("noteToTheStudentNeeded")}>
                    {(p) => <input {...p} value={notes[h.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [h.id]: e.target.value }))} />}
                  </Field>
                  <div className="flex gap-2">
                    <Button disabled={logbook.length > 0 && !signer.trim()} onClick={() => act(() => call(`${path}/hours/${h.id}`, { approve: true, note: notes[h.id], signedName: signer }), logbook.length ? tr("weekSignedOff") : tr("hoursApproved"))}>
                      {logbook.some((x) => x.hourLogId === h.id) ? tr("approveAndSignOff") : tr("approve")}
                    </Button>
                    <Button variant="secondary" disabled={!notes[h.id]?.trim()} onClick={() => act(() => call(`${path}/hours/${h.id}`, { approve: false, note: notes[h.id] }), tr("returnedToTheStudent"))}>
                      {tr("returnForCorrection")}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function EvaluationSection({ view, path, act }: { view: SupervisorView; path: string; act: (fn: () => Promise<unknown>, success: string, finished?: boolean) => Promise<void> }) {
  const tr = useCareerT("supervisor");
  const call = useCall();
  const ev = view.evaluation!;
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [comments, setComments] = useState("");
  const [name, setName] = useState(view.experience.supervisorName);
  if (ev.submitted) return <Card title={tr("kindEvaluation", { kind: ev.kind })}><p className="text-sm">{tr("thisEvaluationWasSubmittedThank")}</p></Card>;
  if (!ev.canSubmit) return <Card title={tr("kindEvaluation", { kind: ev.kind })}><p className="text-sm">{tr("thisEvaluationIsntOpenYet")}</p></Card>;
  const scale = Array.from({ length: ev.ratingScaleMax }, (_, i) => i + 1);
  return (
    <Card title={tr("kindEvaluation", { kind: ev.kind })}>
      <p className="mb-4 text-sm text-muted-foreground">
        {tr("rateFrom1NeedsSignificant", { ratingScaleMax: ev.ratingScaleMax })}
      </p>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => call(`${path}/evaluation`, { answers, comments, evaluatorName: name }), tr("evaluationSubmittedThankYouYou"), true);
        }}
      >
        {ev.questions.map((q) =>
          q.type === "rating" ? (
            <fieldset key={q.key}>
              <legend className="text-sm font-medium">{q.text}</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {scale.map((n) => (
                  <label key={n} className="flex items-center gap-1 text-sm">
                    <input type="radio" name={q.key} value={n} checked={answers[q.key] === n} onChange={() => setAnswers((a) => ({ ...a, [q.key]: n }))} required />
                    {n}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <Field key={q.key} label={q.text}>
              {(p) => <textarea {...p} rows={3} value={(answers[q.key] as string) ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))} />}
            </Field>
          ),
        )}
        <Field label={tr("otherComments")}>{(p) => <textarea {...p} rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />}</Field>
        <Field label={tr("yourName")}>{(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} required />}</Field>
        <Button type="submit">{tr("submitEvaluation")}</Button>
      </form>
    </Card>
  );
}
