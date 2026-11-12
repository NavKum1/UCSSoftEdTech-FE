"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import {
  Accessibility,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Flag,
  Gavel,
  Lightbulb,
  Mic,
  PenLine,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import {
  ACCOMMODATION_TYPES,
  APPEAL_CATEGORIES,
  APPEAL_MAX,
  APPEAL_MIN,
  STATUS_STYLES,
  SubmissionReport,
  accommodationLabel,
  categoryLabel,
  errorMessage,
  fmtDate,
  statusLabel,
} from "@/lib/candidateExperience";
import SignInRequired from "@/components/SignInRequired";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, ErrorBanner, Loading, PageHeader, StatTile } from "@/components/career/ui";

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground [&>svg]:text-muted-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/40 border border-border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const en = useEn();
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {en(statusLabel(status))}
    </span>
  );
}

function DiffView({ diff }: { diff: string }) {
  const lines = diff.replace(/\n$/, "").split("\n");
  return (
    <pre className="text-xs font-mono overflow-x-auto rounded-xl border border-border bg-muted/30 py-2">
      {lines.map((line, i) => {
        const cls = line.startsWith("+ ")
          ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          : line.startsWith("- ")
            ? "bg-rose-500/10 text-rose-800 dark:text-rose-300"
            : "text-muted-foreground";
        return (
          <div key={i} className={`px-3 whitespace-pre ${cls}`}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

export default function SubmissionReportPage() {
  const en = useEn();
  const params = useParams<{ submissionId: string }>();
  const submissionId = params?.submissionId ?? "";
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [report, setReport] = useState<SubmissionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());

  const [category, setCategory] = useState<string>("");
  const [reason, setReason] = useState("");
  const [appealBusy, setAppealBusy] = useState(false);
  const [appealMsg, setAppealMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [accType, setAccType] = useState<string>("WrittenDefense");
  const [accDetails, setAccDetails] = useState("");
  const [accThisSprint, setAccThisSprint] = useState(true);
  const [accBusy, setAccBusy] = useState(false);
  const [accMsg, setAccMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [wdBusy, setWdBusy] = useState(false);
  const [wdError, setWdError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !submissionId) return;
    let active = true;
    authenticatedFetch(`/api/me/submissions/${submissionId}/report`, {}, getToken)
      .then(async (res) => {
        if (res.status === 404) throw new Error("This submission was not found in your account.");
        if (!res.ok) throw new Error(await errorMessage(res, "Could not load the report"));
        return (await res.json()) as SubmissionReport;
      })
      .then((data) => {
        if (!active) return;
        setReport(data);
        setError(null);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load the report."));
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, submissionId, getToken, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const toggleFile = (file: string) =>
    setOpenFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });

  const reasonLength = reason.trim().length;
  const reasonValid = reasonLength >= APPEAL_MIN && reasonLength <= APPEAL_MAX;

  const submitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !reasonValid) return;
    setAppealBusy(true);
    setAppealMsg(null);
    try {
      const res = await authenticatedFetch(
        `/api/me/submissions/${submissionId}/appeals`,
        { method: "POST", body: JSON.stringify({ category, reason: reason.trim() }) },
        getToken
      );
      if (!res.ok) {
        setAppealMsg({ kind: "error", text: await errorMessage(res, "Could not submit your appeal") });
        return;
      }
      setAppealMsg({ kind: "ok", text: en("Your appeal was submitted. A reviewer who did not make the original decision will look at it, and you will get an email when it is resolved.") });
      setCategory("");
      setReason("");
      reload();
    } catch {
      setAppealMsg({ kind: "error", text: en("We couldn't reach Edulexa while submitting your appeal. Please check your connection and try again.") });
    } finally {
      setAppealBusy(false);
    }
  };

  const withdrawAppeal = async (id: string) => {
    setAppealMsg(null);
    try {
      const res = await authenticatedFetch(`/api/me/appeals/${id}/withdraw`, { method: "POST" }, getToken);
      if (!res.ok) {
        setAppealMsg({ kind: "error", text: await errorMessage(res, "Could not withdraw the appeal") });
        return;
      }
      reload();
    } catch {
      setAppealMsg({ kind: "error", text: en("We couldn't reach Edulexa while withdrawing the appeal. Please check your connection and try again.") });
    }
  };

  const requestAccommodation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accDetails.trim().length < 10) return;
    setAccBusy(true);
    setAccMsg(null);
    try {
      const res = await authenticatedFetch(
        "/api/me/accommodations",
        {
          method: "POST",
          body: JSON.stringify({ type: accType, details: accDetails.trim(), sprintId: accThisSprint ? report?.sprint.id : null }),
        },
        getToken
      );
      if (!res.ok) {
        setAccMsg({ kind: "error", text: await errorMessage(res, "Could not send your request") });
        return;
      }
      setAccMsg({ kind: "ok", text: en("Request sent. You will get an email when a reviewer decides.") });
      setAccDetails("");
      reload();
    } catch {
      setAccMsg({ kind: "error", text: en("We couldn't reach Edulexa while sending your request. Please check your connection and try again.") });
    } finally {
      setAccBusy(false);
    }
  };

  const startWrittenDefense = async () => {
    if (!report) return;
    if (report.writtenDefense.activeSessionId) {
      router.push(`/written-defense/${report.writtenDefense.activeSessionId}`);
      return;
    }
    setWdBusy(true);
    setWdError(null);
    try {
      const res = await authenticatedFetch(
        "/api/written-defense/start",
        { method: "POST", body: JSON.stringify({ sprintSubmissionId: submissionId }) },
        getToken
      );
      if (!res.ok) {
        setWdError(await errorMessage(res, "Could not start the written defense"));
        return;
      }
      const data = (await res.json()) as { sessionId: string };
      router.push(`/written-defense/${data.sessionId}`);
    } catch {
      setWdError("We couldn't reach Edulexa while starting the written defense. Please check your connection and try again.");
    } finally {
      setWdBusy(false);
    }
  };

  if (isLoaded && !isSignedIn) {
    return (
      <SignInRequired title={en("Your assessment report")} message="Sign in to see this report." />
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/my/results" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />{en(" My results")}
        </Link>
        <ErrorBanner error={error} onRetry={reload} />
      </div>
    );
  }

  if (!report) {
    return <Loading label={en("Loading your report...")} />;
  }

  const { tests, defense, feedback, review, writtenDefense } = report;
  const openAppeal = report.appeals.find((a) => a.status === "Open");

  return (
    <div className="text-foreground">
      <div className="space-y-6">
        <Link href="/my/results" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />{en(" My results")}
        </Link>

        {/* Header */}
        <div>
          <PageHeader title={report.sprint.title} description={en("Submitted {date}", { date: fmtDate(report.submittedAt) })} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label={en("Tests passed")} value={`${tests.passed}/${tests.total}`} />
            <StatTile
              label={en("Defense score")}
              value={defense?.technicalScore != null ? `${Math.round(defense.technicalScore)}/100` : defense ? defense.status : "Not defended yet"}
            />
            <StatTile label={en("Review")} value={review.status.replace(/([a-z])([A-Z])/g, "$1 $2")} />
            <StatTile label={en("Integrity")} value={report.integrity} />
          </div>
        </div>

        {/* Review status */}
        <Section title={en("Review status")} icon={<Gavel className="w-4 h-4" aria-hidden />}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-foreground">{review.status.replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
            {review.reviewedAt && <span className="text-xs text-muted-foreground">on {fmtDate(review.reviewedAt)}</span>}
            {review.outcome && (
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
                  review.outcome === "Advanced"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {review.outcome}
              </span>
            )}
          </div>
          {review.note && <p className="text-xs text-muted-foreground">{review.note}</p>}
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {report.integrity === "No concerns"
              ? en("Integrity: no concerns.")
              : en("Integrity: a person is reviewing parts of this submission. This is routine and is not a finding of misconduct.")}
          </p>
        </Section>

        {/* Feedback */}
        <Section title={en("Personalised feedback")} icon={<Lightbulb className="w-4 h-4" aria-hidden />}>
          {!feedback ? (
            <p className="text-xs text-muted-foreground">{en("Personalised feedback is not available right now.")}</p>
          ) : (
            <div className="space-y-3 text-sm">
              {feedback.simulated && (
                <p className="text-xs px-2 py-1 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400 inline-block">
                  {en("Sample feedback: written without AI")}
                </p>
              )}
              {feedback.summary && <p className="text-foreground">{feedback.summary}</p>}
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-foreground mb-1">{en("Strengths")}</h3>
                  <ul className="list-disc ms-5 space-y-1 text-xs text-foreground">
                    {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground mb-1">{en("Gaps")}</h3>
                  {feedback.gaps.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{en("None noted.")}</p>
                  ) : (
                    <ul className="list-disc ms-5 space-y-1 text-xs text-foreground">
                      {feedback.gaps.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground mb-1">{en("Three next steps")}</h3>
                <ol className="list-decimal ms-5 space-y-1 text-xs text-foreground">
                  {feedback.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
              <p className="text-xs text-muted-foreground">
                {en("Generated {date} from your tests, the automated code review and your defense. It is developmental feedback, not the employer's decision.", { date: fmtDate(feedback.generatedAt) })}
              </p>
            </div>
          )}
        </Section>

        {/* Tests */}
        <Section title={`Tests: ${tests.passed}/${tests.total} passed`} icon={<CheckCircle2 className="w-4 h-4" aria-hidden />}>
          {tests.cases.length === 0 ? (
            <p className="text-xs text-muted-foreground">{en("No per-test results were recorded (status: {value}).", { value: tests.status.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase() })}</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-1.5">
              {tests.cases.map((c) => (
                <li key={c.name} className="flex items-center gap-2 text-xs">
                  {c.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span className="font-mono text-foreground break-all">{c.name}</span>
                  <span className="sr-only">{c.passed ? "passed" : "failed"}</span>
                </li>
              ))}
            </ul>
          )}
          {report.defects.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs font-semibold text-foreground mb-1.5">{en("Planted defects (revealed after submission)")}</h3>
              <ul className="space-y-1">
                {report.defects.map((d, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-full border font-semibold ${
                        d.fixedDefect
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      {d.fixedDefect ? en("Fixed") : en("Not fixed")}
                    </span>
                    <span className="text-foreground">{d.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Code changes */}
        <Section title={en("Your changes compared with the starter code")} icon={<FileCode2 className="w-4 h-4" aria-hidden />}>
          {report.codeChanges.length === 0 ? (
            <p className="text-xs text-muted-foreground">{en("No files recorded.")}</p>
          ) : (
            <div className="space-y-2">
              {report.codeChanges.map((c) => {
                const open = openFiles.has(c.file);
                return (
                  <div key={c.file} className="rounded-xl border border-border">
                    <button
                      onClick={() => toggleFile(c.file)}
                      aria-expanded={open}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-muted/50 rounded-xl cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-mono text-foreground">
                        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        {c.file}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-emerald-700 dark:text-emerald-400">+{c.linesAdded}</span>
                        <span className="text-rose-700 dark:text-rose-400">-{c.linesRemoved}</span>
                      </span>
                    </button>
                    {open && (
                      <div className="px-3 pb-3">
                        <DiffView diff={c.diff} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Defense */}
        <Section title={en("Your defense")} icon={<Mic className="w-4 h-4" aria-hidden />}>
          {!defense ? (
            <p className="text-xs text-muted-foreground">{en("You have not completed a defense of this submission yet.")}</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Stat label={en("Format")} value={defense.mode === "written" ? "Written" : "Voice"} />
                <Stat label={en("Technical score")} value={defense.technicalScore != null ? `${Math.round(defense.technicalScore)}/100` : defense.status} />
                <Stat
                  label={en("Skills to work on")}
                  value={defense.missingSkills.length > 0 ? defense.missingSkills.join(", ") : "None noted"}
                />
              </div>
              {defense.recordingUrl && (
                <div>
                  <h3 className="text-xs font-semibold text-foreground mb-1">{en("Recording")}</h3>
                  <audio controls preload="none" src={defense.recordingUrl} className="w-full">
                    {en("Your browser does not support audio playback.")}
                  </audio>
                </div>
              )}
              {defense.questionsAndAnswers.length === 0 ? (
                <p className="text-xs text-muted-foreground">{en("We couldn't pick out the questions and answers from this conversation.")}</p>
              ) : (
                <ol className="space-y-2">
                  {defense.questionsAndAnswers.map((qa, i) => (
                    <li key={i} className="space-y-1 rounded-lg border border-border p-3 text-sm">
                      <p className="text-muted-foreground"><span className="font-semibold text-foreground">Q: </span>{qa.question}</p>
                      <p className="text-foreground"><span className="font-semibold">A: </span>{qa.answer}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-border space-y-2">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" />{en(" Written defense")}
            </h3>
            <p className="text-xs text-muted-foreground">{writtenDefense.reason}</p>
            {writtenDefense.eligible && (
              <Button onClick={startWrittenDefense} busy={wdBusy}>
                {writtenDefense.activeSessionId ? en("Continue written defense") : writtenDefense.alreadyDefended ? en("Start another written defense") : en("Start written defense")}
              </Button>
            )}
            {wdError && (
              <p className="text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {wdError}</p>
            )}
          </div>
        </Section>

        {/* Appeals */}
        <Section title={en("Appeal")} icon={<Flag className="w-4 h-4" aria-hidden />}>
          <p className="text-xs text-muted-foreground">
            {en("If something went wrong or you think the assessment was unfair, tell us. A reviewer who did not make the original decision handles appeals, and you will receive their written response by email.")}
          </p>

          {report.appeals.length > 0 && (
            <ul className="space-y-2">
              {report.appeals.map((a) => (
                <li key={a.id} className="space-y-1.5 rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <StatusPill status={a.status} />
                    <span className="font-semibold text-foreground">{en(categoryLabel(a.category))}</span>
                    <span className="text-muted-foreground">{fmtDate(a.createdAt)}</span>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap text-xs">{a.reason}</p>
                  {a.response && (
                    <div className="rounded-lg bg-muted/40 border border-border p-2 text-xs">
                      <span className="font-semibold text-foreground">{en("Response{value}:", { value: a.resolverName ? ` from ${a.resolverName}` : "" })}{" "}</span>
                      <span className="text-foreground whitespace-pre-wrap">{a.response}</span>
                    </div>
                  )}
                  {a.status === "Open" && (
                    <button onClick={() => withdrawAppeal(a.id)} className="text-xs underline text-muted-foreground hover:text-foreground cursor-pointer">
                      {en("Withdraw appeal")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {report.canAppeal ? (
            <form onSubmit={submitAppeal} className="space-y-3">
              <fieldset className="grid sm:grid-cols-2 gap-2">
                <legend className="text-xs font-semibold text-foreground mb-1">{en("What is the appeal about?")}</legend>
                {APPEAL_CATEGORIES.map((c) => (
                  <label
                    key={c.value}
                    className={`rounded-xl border p-3 cursor-pointer text-sm transition-colors ${
                      category === c.value ? "border-indigo-500 bg-indigo-500/10" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold text-foreground">
                      <input type="radio" name="category" value={c.value} checked={category === c.value} onChange={() => setCategory(c.value)} />
                      {en(c.label)}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-1">{en(c.hint)}</span>
                  </label>
                ))}
              </fieldset>
              <div>
                <label htmlFor="appeal-reason" className="text-xs font-semibold text-foreground">{en("Explain what happened")}</label>
                <textarea
                  id="appeal-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={APPEAL_MAX}
                  rows={5}
                  placeholder={en("Be specific: what happened, when, and what you would like the reviewer to reconsider.")}
                  className="mt-1 w-full rounded-xl bg-card border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground"
                  aria-describedby="appeal-counter"
                />
                <div id="appeal-counter" className={`text-xs mt-1 ${reasonValid ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}`}>
                  {en("{reasonLength}/{aPPEAL_MAX} characters ({aPPEAL_MIN} minimum)", { reasonLength, aPPEAL_MAX: APPEAL_MAX, aPPEAL_MIN: APPEAL_MIN })}
                </div>
              </div>
              <Button type="submit" busy={appealBusy} disabled={!category || !reasonValid}>
                {en("Submit appeal")}
              </Button>
            </form>
          ) : (
            openAppeal && <p className="text-xs text-muted-foreground">{en("You have an open appeal for this submission. You can withdraw it above.")}</p>
          )}
          {appealMsg && (
            <p className={`text-xs ${appealMsg.kind === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>{appealMsg.text}</p>
          )}
        </Section>

        {/* Accommodations */}
        <Section title={en("Accommodations")} icon={<Accessibility className="w-4 h-4" aria-hidden />}>
          <p className="text-xs text-muted-foreground">
            {en("Request extra time, a written defense instead of voice, screen-reader support or anything else you need. Reviewers see approved accommodations alongside your submission so they can interpret timing fairly.")}
          </p>
          {report.accommodations.length > 0 && (
            <ul className="space-y-2">
              {report.accommodations.map((a) => (
                <li key={a.id} className="space-y-1 rounded-lg border border-border p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={a.status} />
                    <span className="font-semibold text-foreground">{en(accommodationLabel(a.type))}</span>
                    <span className="text-muted-foreground">{a.sprintId ? en("This challenge") : en("All assessments")} · {fmtDate(a.createdAt)}</span>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap">{a.details}</p>
                  {a.decisionNote && <p className="text-muted-foreground">{en("Reviewer note: {decisionNote}", { decisionNote: a.decisionNote })}</p>}
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={requestAccommodation} className="space-y-2">
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-foreground">{en("Type")}</span>
                <select
                  value={accType}
                  onChange={(e) => setAccType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground"
                >
                  {ACCOMMODATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{en(t.label)}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground sm:mt-6">
                <input type="checkbox" checked={accThisSprint} onChange={(e) => setAccThisSprint(e.target.checked)} disabled={!report.sprint.id} />
                {en("Only for this challenge (otherwise for all my assessments)")}
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-foreground">{en("What do you need?")}</span>
              <textarea
                value={accDetails}
                onChange={(e) => setAccDetails(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={en("Describe what would help. You don't have to share a diagnosis.")}
                className="w-full rounded-xl bg-card border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </label>
            <Button type="submit" variant="secondary" busy={accBusy} disabled={accDetails.trim().length < 10}>
              {en("Send request")}
            </Button>
            {accMsg && (
              <p className={`text-xs ${accMsg.kind === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>{accMsg.text}</p>
            )}
          </form>
        </Section>
      </div>
    </div>
  );
}
