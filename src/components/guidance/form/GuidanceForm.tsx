"use client";

/**
 * A career guidance form as people fill it in: on an institute's website (embedded), inside Edulexa ("Ask an advisor",
 * "Ask Edulexa") and in the editor's preview. Sections are steps with a progress bar; questions appear only when earlier
 * answers call for them; the form can be shown in the institute's languages, in its colours and with its logo; files are
 * uploaded as they're chosen; on websites answers can be saved to finish later, and are kept in the browser so a reload
 * or a later visit resumes. The person's details and consent are the last step; on forms that save as people go, the
 * details come first (with a short notice) and what's given so far reaches the CRM as an Incomplete lead at each step.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Copy, FileText, Paperclip, Plus, Save, X } from "lucide-react";
import { getApiBaseUrl } from "@/lib/apiClient";
import {
  check,
  computeResult,
  estimateMinutes,
  nextFor,
  onAccent,
  OTHER,
  questionVisible,
  sectionVisible,
  sliderMiddle,
  toApi,
  tr,
  trColumns,
  trOptions,
  trResult,
  type Answer,
  type Answers,
  type Fillable,
  type FormResult,
  type NextSteps,
  type Question,
} from "./model";
import { NextStepsBlock, ScoreDial, ShareRow } from "./ReportParts";
import { RTL, UI, type UiKey } from "./uiText";
import { HumanCheck, PhoneCheck } from "./Protection";
import { MeetingField, MeetingNotice } from "./Meeting";


export interface SubmitPayload {
  unsure: string;
  name: string;
  email: string;
  phone: string | null;
  answers: ReturnType<typeof toApi>;
  meta: {
    formId: string;
    language: string;
    campaign: string | null;
    referrer: string | null;
    visitId: string;
    durationSeconds: number;
    startToken?: string | null;
    turnstile?: string | null;
    phoneCheckId?: string | null;
    /** Forms that save as people go: finishes this visit's Incomplete lead instead of making another */
    partialToken?: string | null;
  };
}

/** What the person is told about the meeting they asked for (the API's answer once the inquiry is in) */
export interface MeetingTold {
  status: "Requested" | "Booked";
  start?: string | null;
  when?: string | null;
  mode?: string;
  counsellor?: string | null;
  /** The picked time went before their request arrived (the team agrees another) */
  taken?: boolean;
}

/** onSubmit's answer: an error message, or done (with the meeting, when one was asked for) */
export type SubmitResult = string | null | { meeting?: MeetingTold | null; report?: string | null };

/** What the browser keeps of a website form between visits (per form; never sent anywhere) */
interface Stored {
  answers: Answers;
  unsure: string;
  name: string;
  email: string;
  phone: string;
  language: string | null;
  step: number;
  visitId: string | null;
  partialToken: string | null;
  savedAt: number;
  /** When it was read back (this visit), for how long the form took */
  openedAt?: number;
}
const storeKey = (formId: string) => `edulexa-guidance:${formId}`;
const KEEP_MS = 30 * 86400e3;

function readStored(formId: string): Stored | null {
  try {
    const raw = window.localStorage.getItem(storeKey(formId));
    const d = raw ? (JSON.parse(raw) as Stored) : null;
    return d && typeof d === "object" && Date.now() - (d.savedAt ?? 0) < KEEP_MS ? { ...d, openedAt: Date.now() } : null;
  } catch {
    return null;
  }
}

function writeStored(formId: string, d: Stored | null) {
  try {
    if (d) window.localStorage.setItem(storeKey(formId), JSON.stringify(d));
    else window.localStorage.removeItem(storeKey(formId));
  } catch {
    // Private browsing or storage turned off: the form works, it just won't remember
  }
}

const api = () => getApiBaseUrl().replace(/\/$/, "");
const field =
  "mt-2.5 block w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[15px] shadow-xs transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:border-[var(--gf-accent)] focus:outline-none focus:ring-4 focus:ring-[var(--gf-ring)]";
/** The form's main button (Next, Send) and its quiet partner (Back) */
const primary =
  "inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-[var(--gf-accent)] px-7 text-[15px] font-semibold text-[var(--gf-on)] shadow-sm transition-[filter] hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gf-ring)] disabled:opacity-60";
const secondary =
  "inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-5 text-[15px] font-medium transition-colors hover:bg-muted focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gf-ring)]";

/** Seconds since a moment (for how long the form took) */
const secondsSince = (t: number | undefined) => Math.round((Date.now() - (t ?? Date.now())) / 1000);
const noSubscribe = () => () => undefined;

function randomId() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function GuidanceForm({
  fill,
  mode,
  bare,
  prefill,
  consentText,
  extras,
  upload,
  onSubmit,
  onSent,
  campaign,
  referrer,
  resumeToken,
  apiBase,
  sentNotice,
  remember = true,
}: {
  fill: Fillable;
  /** website (public), app (signed in) or preview (editor; nothing is sent) */
  mode: "website" | "app" | "preview";
  /** Inside a dialog that has its own title: no heading or logo */
  bare?: boolean;
  prefill?: { name?: string; email?: string };
  consentText: string;
  extras?: React.ReactNode;
  upload?: (file: File) => Promise<{ id: string; name: string; size: number }>;
  onSubmit: (p: SubmitPayload) => Promise<SubmitResult>;
  /** Called after sending (the caller shows its own confirmation); without it the form thanks the person */
  onSent?: () => void;
  campaign?: string | null;
  /** The page the form is on (embedded); else the referring site */
  referrer?: string | null;
  resumeToken?: string | null;
  /** Website forms: the public API for this institute (phone codes) */
  apiBase?: string;
  /** Shown once sent, instead of the thank-you (e.g. "check your email to confirm"), under the results when there are any */
  sentNotice?: React.ReactNode;
  /** Website forms keep unfinished answers in this browser; false for the Share page's preview, which starts empty each time */
  remember?: boolean;
}) {
  const def = fill.definition;
  const s = def.settings;
  // Website forms remember their answers in this browser, so a reload or a later visit picks up where the person left off
  // (not when opening a "finish later" link, which brings its own answers)
  const [stored] = useState<Stored | null>(() => (mode === "website" && remember && !resumeToken && typeof window !== "undefined" ? readStored(fill.formId) : null));
  // Said plainly when answers come back, with a way to start afresh (a shared computer, or someone else's turn)
  // Start over: a new round remounts the phone and human checks, so nothing of theirs carries over
  const [round, setRound] = useState(0);
  const [resumed, setResumed] = useState(() => !!stored && (Object.keys(stored.answers ?? {}).length > 0 || !!stored.name || !!stored.email || !!stored.unsure));
  // The browser's language when the form offers it (read after hydration), until the person picks one
  const browserLang = useSyncExternalStore(noSubscribe, () => navigator.language.slice(0, 2), () => "");
  const [picked, setLang] = useState<string | null>(stored?.language && def.languages.includes(stored.language) ? stored.language : null);
  const lang = picked ?? (def.languages.includes(browserLang) ? browserLang : (def.languages[0] ?? "en"));
  const t = (k: string) => UI[lang]?.[k as UiKey] ?? UI.en[k as UiKey] ?? k;
  const [answers, setAnswers] = useState<Answers>(stored?.answers ?? {});
  const [unsure, setUnsure] = useState(stored?.unsure ?? "");
  // Prefill (inside Edulexa it arrives after the first render) until the person types
  const [typedName, setName] = useState<string | null>(stored?.name || null);
  const [typedEmail, setEmail] = useState<string | null>(stored?.email || null);
  const name = typedName ?? prefill?.name ?? "";
  const email = typedEmail ?? prefill?.email ?? "";
  const [phone, setPhone] = useState(stored?.phone ?? "");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // hidden bot trap
  const [human, setHuman] = useState<string | null>(null);
  const [phoneCheckId, setPhoneCheckId] = useState<string | null>(null);
  const checksPhone = mode === "website" && !!s.requirePhoneCheck && !!apiBase;
  const needsHuman = mode === "website" && !!fill.turnstileSiteKey;
  const [step, setStep] = useState(stored?.step ?? 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // The results the person sees after sending (forms with results shown to people)
  const [result, setResult] = useState<FormResult | null>(null);
  const [meeting, setMeeting] = useState<MeetingTold | null>(null);
  /** The person's private report, once the server has made it (website forms) */
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [saveLink, setSaveLink] = useState<string | null>(null);
  const [draftToken, setDraftToken] = useState<string | null>(resumeToken ?? null);
  const [copied, setCopied] = useState(false);
  // A returning visitor keeps their visit (and its Incomplete lead, when the form saves as people go)
  const visit = useRef<{ id: string; started: boolean; at: number } | null>(stored?.visitId ? { id: stored.visitId, started: true, at: stored.openedAt ?? 0 } : null);
  const partialToken = useRef<string | null>(stored?.partialToken ?? null);
  const top = useRef<HTMLDivElement>(null);
  // Saving as people go (website forms that turn it on): the contact details come first unless the institute picked a question
  const savesPartial = mode !== "app" && !!s.savePartial;
  const contactFirst = savesPartial && !s.partialAfter;

  // Insights: the visit (opened / started / last question reached); not in the editor's preview
  const track = useCallback(
    (lastQuestionId?: string, started?: boolean) => {
      if (mode === "preview") return;
      if (!visit.current) visit.current = { id: randomId(), started: false, at: Date.now() };
      if (started) visit.current.started = true;
      fetch(`${api()}/api/public/guidance-forms/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: fill.formId, visitId: visit.current.id, lastQuestionId: lastQuestionId ?? null, started: visit.current.started, channel: mode, campaign: campaign ?? null }),
        keepalive: true,
      }).catch(() => undefined);
    },
    [mode, fill.formId, campaign],
  );
  useEffect(() => {
    track();
  }, [track]);

  // Saved answers (link from "Save and finish later")
  useEffect(() => {
    if (!resumeToken) return;
    fetch(`${api()}/api/public/guidance-forms/drafts/${resumeToken}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setAnswers(d.answers ?? {});
        setUnsure(d.unsure ?? "");
        setName(d.name ?? "");
        setEmail(d.email ?? "");
        setPhone(d.phone ?? "");
        if (typeof d.language === "string" && def.languages.includes(d.language)) setLang(d.language);
      })
      .catch(() => undefined);
  }, [resumeToken, def.languages]);

  const sections = useMemo(() => def.sections.filter((x) => sectionVisible(def, x, answers) && def.questions.some((q) => q.sectionId === x.id && questionVisible(def, q, answers))), [def, answers]);
  // Steps: each visible section, then "Your details" (first instead when saving as people go); the unsure box sits at the
  // top of the first section's step. Sending (consent, human check) is always on the last step.
  const steps = sections.length + 1;
  const current = Math.min(step, steps - 1);
  const detailsStep = contactFirst ? 0 : steps - 1;
  const isDetails = current === detailsStep;
  const isLast = current === steps - 1;
  const unsureStep = Math.min(contactFirst ? 1 : 0, steps - 1);
  const section = isDetails ? null : sections[contactFirst ? current - 1 : current];
  const stepQuestions = section ? def.questions.filter((q) => q.sectionId === section.id && questionVisible(def, q, answers)) : [];
  // The step after which progress is saved: the contact details, or the step with the question the institute picked
  const afterSection = s.partialAfter ? sections.findIndex((x) => x.id === def.questions.find((q) => q.id === s.partialAfter)?.sectionId) : -1;
  const saveFrom = contactFirst ? 0 : afterSection >= 0 ? afterSection : Number.POSITIVE_INFINITY;

  // Kept in this browser as the person types (website forms), cleared once sent
  useEffect(() => {
    if (mode !== "website" || !remember || sent) return;
    writeStored(fill.formId, {
      answers, unsure, name: typedName ?? "", email: typedEmail ?? "", phone, language: picked, step: current,
      visitId: visit.current?.id ?? null, partialToken: partialToken.current, savedAt: Date.now(),
    });
  }, [mode, remember, sent, fill.formId, answers, unsure, typedName, typedEmail, phone, picked, current]);

  const set = (id: string, a: Answer) => {
    if (!visit.current?.started) track(id, true);
    setAnswers((x) => ({ ...x, [id]: a }));
    setErrors((e) => (e[id] ? { ...e, [id]: "" } : e));
  };

  /** Sliders on this step left where they started count as the middle (the person saw them and moved on) */
  const withSliders = (): Answers => {
    const untouched = stepQuestions.filter((q) => q.kind === "slider" && !answers[q.id]?.value);
    if (untouched.length === 0) return answers;
    const next = { ...answers };
    for (const q of untouched) next[q.id] = { value: sliderMiddle(q) };
    setAnswers(next);
    return next;
  };

  const validateStep = (ans: Answers = answers): boolean => {
    const e: Record<string, string> = {};
    if (current === unsureStep && s.askUnsure && !unsure.trim()) e.__unsure = "Please tell us what you'd like help with.";
    if (isDetails && !isLast) {
      if (!name.trim()) e.__name = "Please give your name.";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.__email = "Please give a valid email address.";
      if (s.phoneRequired && !phone.trim()) e.__phone = "Please give your phone number.";
    }
    for (const q of stepQuestions) {
      const msg = check(q, ans[q.id]);
      if (msg) e[q.id] = msg;
    }
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) document.getElementById(`gf-${first}`)?.focus();
    return !first;
  };

  /**
   * Start over: forgets what this browser kept and begins a new visit, so the answers given now become a lead of their own
   * (never added to the earlier person's unfinished one)
   */
  const startOver = () => {
    writeStored(fill.formId, null);
    visit.current = null;
    partialToken.current = null;
    setAnswers({});
    setUnsure("");
    setName(null);
    setEmail(null);
    setPhone("");
    setLang(null);
    // Their phone check, saved-for-later link (saving again would overwrite their draft), consent and human check go too
    setPhoneCheckId(null);
    setSaveLink(null);
    setDraftToken(null);
    setCopied(false);
    setConsent(false);
    setHuman(null);
    setRound((r) => r + 1);
    setStep(0);
    setErrors({});
    setError(null);
    setResumed(false);
    track();
  };

  const go = (to: number) => {
    setStep(to);
    setResumed(false);
    setError(null);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Forms that save as people go: what's been given so far, once there's an email or phone to follow up on. In the
  // background; a failure never holds the person up.
  const saveProgress = (answers: Answers) => {
    if (mode !== "website" || !s.savePartial || !apiBase || website || !fill.startToken) return;
    const asked = (kind: string) => def.questions.some((q) => q.kind === kind && answers[q.id]?.value?.trim());
    if (!email.trim() && !phone.trim() && !asked("email") && !asked("phone")) return;
    fetch(`${apiBase}/partial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(), email: email.trim(), phone: phone.trim() || null, unsure: unsure.trim(), answers: toApi(def, answers),
        meta: { formId: fill.formId, language: lang, campaign: campaign ?? null, referrer: referrer ?? null, visitId: visit.current?.id, startToken: fill.startToken, partialToken: partialToken.current },
      }),
      keepalive: true,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.partialToken === "string") partialToken.current = d.partialToken;
      })
      .catch(() => undefined);
  };

  const next = () => {
    const ans = withSliders();
    if (!validateStep(ans)) return;
    track(stepQuestions[stepQuestions.length - 1]?.id, true);
    if (current >= saveFrom) saveProgress(ans);
    go(current + 1);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLast) return next();
    const answers = withSliders();
    if (!validateStep(answers)) return;
    if (!consent) return setError("Please tick the box to send.");
    if (s.phoneRequired && !phone.trim()) return setError("Please give your phone number.");
    if (checksPhone && !phoneCheckId) return setError("Please verify your phone number with the code we send by SMS.");
    if (needsHuman && !human) return setError("Please complete the check that you're not a robot.");
    if (website) return setSent(true);
    setSending(true);
    setError(null);
    const err = await onSubmit({
      unsure: unsure.trim(),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      answers: toApi(def, answers),
      meta: {
        formId: fill.formId,
        language: lang,
        campaign: campaign ?? null,
        referrer: referrer || (typeof document !== "undefined" && document.referrer ? new URL(document.referrer).hostname : null),
        visitId: visit.current?.id ?? randomId(),
        durationSeconds: secondsSince(visit.current?.at),
        startToken: fill.startToken ?? null,
        turnstile: human,
        phoneCheckId,
        partialToken: partialToken.current,
      },
    }).catch(() => "We couldn't send your request. Please check your connection and try again.");
    setSending(false);
    if (typeof err === "string") return setError(err);
    if (err?.meeting) setMeeting(err.meeting);
    if (err?.report) setReportUrl(err.report);
    // Sent: nothing more to resume in this browser
    if (mode === "website") writeStored(fill.formId, null);
    // Results to show: they stay on screen (the page after sending opens from a button; "Done" closes it inside Edulexa)
    const shown = def.results?.showToPerson ? computeResult(def, answers) : null;
    if (shown) {
      setResult(trResult(def, shown, lang));
      setSent(true);
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // With email confirmation the redirect happens after the person confirms (the confirm page does it)
    if (s.redirectUrl && mode === "website" && s.requireEmailConfirmation === false && !err?.meeting) {
      window.open(s.redirectUrl, "_top");
      return;
    }
    if (onSent) onSent();
    else setSent(true);
  };

  const saveForLater = async () => {
    try {
      const res = await fetch(`${api()}/api/public/guidance-forms/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: fill.formId, token: draftToken, state: { answers, unsure, name, email, phone, language: lang } }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.token) return setError(d?.error ?? "Your answers couldn't be saved. Please try again.");
      setDraftToken(d.token);
      const u = new URL(window.location.href);
      u.searchParams.set("resume", d.token);
      setSaveLink(u.toString());
    } catch {
      setError("Your answers couldn't be saved. Please try again.");
    }
  };

  const accent = s.accent || "#4f46e5";
  // The accent, a tint of it for chosen answers, a soft ring for focus, and a deep shade for the photo layout's panel
  const deep = `color-mix(in srgb, ${accent} 52%, #0a0e1a)`;
  const style = {
    "--gf-accent": accent,
    "--gf-on": onAccent(accent),
    "--gf-tint": `color-mix(in srgb, ${accent} 8%, transparent)`,
    "--gf-ring": `color-mix(in srgb, ${accent} 22%, transparent)`,
  } as React.CSSProperties;
  const title = tr(s.translations, lang, "title", s.title) || `Get career guidance from ${fill.instituteName}`;
  const intro = tr(s.translations, lang, "description", s.intro);
  const minutes = t("minutes").replace("{n}", String(estimateMinutes(def)));
  const partialText = (s.partialNotice?.trim() ? tr(s.translations, lang, "notice", s.partialNotice) : t("partialNotice")).replaceAll("{institute}", fill.instituteName);
  // After sending: the school's next steps for this score, and sharing it (a link to this form, never their answers)
  const nextSteps = sent ? nextFor(def, result, lang, fill.instituteName) : null;
  const share = mode === "website" && def.results?.share && result?.match ? shareOf(result.match.percent, title, t) : null;
  // Each step's name: the visible sections, and "Your details" (first when saving as people go, else last)
  /** The panel's list of steps: back to an earlier one */
  const jumpTo = (e: React.MouseEvent<HTMLButtonElement>) => go(Number(e.currentTarget.dataset.step));
  const stepLabels = Array.from({ length: steps }, (_, i) => {
    if (i === detailsStep) return t("details");
    const x = sections[contactFirst ? i - 1 : i];
    return x ? tr(x.translations, lang, "title", x.title) : "";
  });

  // The photo layout: a split page, the institute's panel (logo, the form's name, its steps) beside a wide sheet with the
  // questions. On phones the panel is a band above the sheet. Not inside Edulexa's own dialogs, which have their own frame.
  const cover = s.layout === "cover" && mode !== "app";
  const segments = (light: boolean) => (
    <div className="mt-2 flex gap-1" aria-hidden="true">
      {stepLabels.map((_, i) => (
        <span
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${i <= current ? (light ? "bg-white" : "bg-[var(--gf-accent)]") : light ? "bg-white/25" : "bg-muted"}`}
        />
      ))}
    </div>
  );
  const frame = (children: React.ReactNode, done = false) =>
    !cover ? (
      children
    ) : (
      // Split by the room the form has (the editor's preview is narrow even on a wide screen), not the window's width
      <div className="@container relative flex flex-1 flex-col bg-background">
        <div className="flex-1 @4xl:grid @4xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]" style={style}>
          <aside className="relative isolate overflow-hidden text-white">
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-20 bg-cover bg-center"
              style={{ backgroundColor: deep, backgroundImage: s.backgroundUrl ? `url(${JSON.stringify(s.backgroundUrl)})` : undefined }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10"
              style={{
                background: s.backgroundUrl
                  ? "linear-gradient(180deg, rgb(8 10 18 / .45), rgb(8 10 18 / .82))"
                  : "radial-gradient(120% 70% at 0% 0%, rgb(255 255 255 / .12), transparent 62%)",
              }}
            />
            {/* The panel's colour fills the column; what's on it stays in view while the questions scroll */}
            <div className="flex flex-col px-5 py-5 sm:px-8 sm:py-7 @4xl:sticky @4xl:top-0 @4xl:h-dvh @4xl:min-h-[560px] @4xl:px-10 @4xl:py-12">
              {/* heading=hide: the page has its own name and logo; the panel keeps the steps */}
              {bare ? null : s.logoUrl ? (
                <span className="inline-flex self-start rounded-xl bg-white px-3 py-2 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.logoUrl} alt={fill.instituteName} className="h-7 w-auto max-w-40 object-contain" />
                </span>
              ) : (
                <span className="text-[15px] font-semibold">{fill.instituteName}</span>
              )}
              {!bare && <p className="mt-5 text-balance text-xl font-semibold leading-tight tracking-tight @4xl:mt-14 @4xl:text-[26px]">{title}</p>}
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-white/70">
                <Clock aria-hidden="true" className="h-4 w-4" /> {minutes}
              </p>
              {!done && steps > 1 && (
                <div className="mt-5 @4xl:hidden">
                  <p className="text-xs text-white/75">
                    {t("step")} {current + 1} {t("of")} {steps}
                  </p>
                  {segments(true)}
                </div>
              )}
              {steps > 1 && (
                <ol className="mt-12 hidden space-y-0.5 @4xl:block" aria-label={`${t("step")} ${current + 1} ${t("of")} ${steps}`}>
                  {stepLabels.map((label, i) => {
                    const past = done || i < current;
                    const now = !done && i === current;
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          disabled={done || i >= current}
                          data-step={i}
                          onClick={jumpTo}
                          aria-current={now ? "step" : undefined}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[15px] transition-colors enabled:hover:bg-white/10 disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        >
                          <span
                            aria-hidden="true"
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                              past ? "bg-white" : now ? "text-white ring-2 ring-white" : "text-white/55 ring-1 ring-white/30"
                            }`}
                            style={past ? { color: deep } : undefined}
                          >
                            {past ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                          </span>
                          <span className={now ? "font-semibold text-white" : past ? "text-white/85" : "text-white/55"}>{label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              {savesPartial && !done && (
                <p className="mt-auto hidden items-start gap-2 pt-10 text-xs leading-relaxed text-white/65 @4xl:flex">
                  <Save aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" /> {partialText}
                </p>
              )}
            </div>
          </aside>
          <div className="mx-auto w-full max-w-[700px] px-5 pb-12 pt-8 text-foreground sm:px-10 @4xl:px-14 @4xl:pb-16 @4xl:pt-16">{children}</div>
        </div>
      </div>
    );

  if (sent)
    return frame(
      <div ref={top} className={result ? "space-y-6 text-[15px]" : "py-6 text-center"} role="status" style={style} dir={RTL.includes(lang) ? "rtl" : "ltr"} lang={lang}>
        {result ? (
          <>
            <h1 className={cover ? "text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]" : "text-xl font-semibold tracking-tight"}>{t("yourResults")}</h1>
            <ResultsView result={result} accent={accent} t={t} next={nextSteps} share={share} reportUrl={reportUrl} />
            {meeting && <MeetingNotice meeting={meeting} t={t} />}
            {sentNotice ?? <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{tr(s.translations, lang, "label", s.thankYou) || t("thanks")}</p>}
            {(onSent || (s.redirectUrl && mode === "website" && s.requireEmailConfirmation === false)) && (
              <div className="flex flex-wrap gap-3">
                {s.redirectUrl && mode === "website" && s.requireEmailConfirmation === false && (
                  <a href={s.redirectUrl} target="_top" rel="noopener" className={`${primary} flex-1`}>
                    {t("continue")} <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </a>
                )}
                {onSent && (
                  <button type="button" onClick={onSent} className={`${primary} flex-1`}>
                    {t("done")}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {sentNotice ?? (
              <>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--gf-tint)]">
                  <CheckCircle2 aria-hidden="true" className="h-8 w-8" style={{ color: accent }} />
                </span>
                <p className="mt-4 whitespace-pre-wrap text-xl font-semibold tracking-tight">{tr(s.translations, lang, "label", s.thankYou) || t("thanks")}</p>
                {!s.thankYou && <p className="mt-2 text-muted-foreground">An advisor from {fill.instituteName} will contact you at {email.trim()}.</p>}
                {meeting && (
                  <div className="mt-6 text-left">
                    <MeetingNotice meeting={meeting} t={t} />
                  </div>
                )}
              </>
            )}
            {/* No results shown: the school's next steps for everyone, and their report, still are */}
            {nextSteps && (
              <div className="mt-6 rounded-2xl border border-border px-5 py-6">
                <NextStepsBlock next={nextSteps} />
              </div>
            )}
            {reportUrl && (
              <div className="mt-4">
                <ReportLink url={reportUrl} accent={accent} t={t} />
              </div>
            )}
          </>
        )}
      </div>,
      true,
    );

  const stepTitle = stepLabels[current];
  // The heading, introduction and time: in the panel on the photo layout (the introduction opens the first step), at the
  // top of the card otherwise
  const showHead = !cover;
  const languagePicker = def.languages.length > 1 && (
    <label className="shrink-0 text-sm">
      <span className="sr-only">{t("language")}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-lg border border-border bg-background px-2.5 py-1.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gf-ring)]">
        {def.languages.map((l) => (
          <option key={l} value={l}>
            {fill.languageNames[l] ?? l}
          </option>
        ))}
      </select>
    </label>
  );

  return frame(
    <div ref={top} style={style} className="scroll-mt-4 text-[15px]" dir={RTL.includes(lang) ? "rtl" : "ltr"} lang={lang}>
      {resumed && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-[var(--gf-tint)] px-4 py-3" role="status">
          <p className="text-sm leading-relaxed">{t("welcomeBack")}</p>
          <button type="button" onClick={startOver} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gf-ring)]">
            {t("startOver")}
          </button>
        </div>
      )}
      {showHead ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {!bare && s.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logoUrl} alt={fill.instituteName} className="mb-4 h-10 w-auto max-w-48 object-contain" />
            )}
            {!bare && <h1 className="text-xl font-semibold tracking-tight">{title}</h1>}
            {intro && <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-muted-foreground">{intro}</p>}
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock aria-hidden="true" className="h-4 w-4" /> {minutes}
            </p>
            {savesPartial && (
              <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                <Save aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {partialText}
              </p>
            )}
          </div>
          {languagePicker}
        </div>
      ) : (
        (languagePicker || (current === 0 && intro) || savesPartial) && (
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              {current === 0 && intro && <p className="max-w-[60ch] whitespace-pre-wrap text-[17px] leading-relaxed text-muted-foreground">{intro}</p>}
              {savesPartial && (
                <p className="flex items-start gap-1.5 text-sm text-muted-foreground @4xl:hidden">
                  <Save aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {partialText}
                </p>
              )}
            </div>
            {languagePicker}
          </div>
        )
      )}

      {/* Progress (the photo layout shows it in its panel) */}
      {!cover && steps > 1 && (
        <div className="mt-6" aria-label={`${t("step")} ${current + 1} ${t("of")} ${steps}`}>
          <p className="text-xs text-muted-foreground">
            {t("step")} {current + 1} {t("of")} {steps}
          </p>
          {segments(false)}
        </div>
      )}

      <form onSubmit={submit} className={`@container ${cover ? "" : "mt-7"}`} noValidate>
        {def.questions.some((q) => q.kind === "slider") && <style>{SLIDER_CSS}</style>}

        {/* The step's heading and what it's about */}
        {(steps > 1 || (section?.description ?? "") !== "") && (
          <div className="mb-8">
            {steps > 1 && <h2 className={cover ? "text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]" : "text-lg font-semibold tracking-tight"}>{stepTitle}</h2>}
            {section?.description && (
              <p className={`max-w-[62ch] leading-relaxed text-muted-foreground ${cover ? "mt-3 text-base" : "mt-1"}`}>{tr(section.translations, lang, "description", section.description)}</p>
            )}
          </div>
        )}

        <div className="space-y-9">
          {current === unsureStep && s.askUnsure && (
            <label className="block">
              <span className="text-base font-semibold leading-snug">{t("unsure")}</span>
              <textarea
                id="gf-__unsure"
                value={unsure}
                maxLength={2000}
                rows={3}
                onChange={(e) => {
                  setUnsure(e.target.value);
                  if (!visit.current?.started) track(undefined, true);
                }}
                className={field}
                placeholder={t("unsurePh")}
                aria-invalid={!!errors.__unsure}
              />
              {errors.__unsure && <span className="mt-1.5 block text-sm text-red-700 dark:text-red-400">{errors.__unsure}</span>}
            </label>
          )}

          {section &&
            stepQuestions.map((q) => (
              <Field key={q.id} q={q} lang={lang} t={t} a={answers[q.id]} error={errors[q.id]} onChange={(a) => set(q.id, a)} upload={upload} preview={mode === "preview"} fill={fill} />
            ))}

          {isDetails && (
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="text-base font-semibold">{t("name")}</span>
                <input
                  id="gf-__name"
                  required
                  value={name}
                  maxLength={200}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((x) => (x.__name ? { ...x, __name: "" } : x));
                  }}
                  className={field}
                  autoComplete="name"
                  aria-invalid={!!errors.__name}
                />
                {errors.__name && <span className="mt-1.5 block text-sm text-red-700 dark:text-red-400">{errors.__name}</span>}
              </label>
              <label className="block">
                <span className="text-base font-semibold">{t("email")}</span>
                <input
                  id="gf-__email"
                  required
                  type="email"
                  value={email}
                  maxLength={254}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((x) => (x.__email ? { ...x, __email: "" } : x));
                  }}
                  className={field}
                  autoComplete="email"
                  aria-invalid={!!errors.__email}
                />
                {errors.__email && <span className="mt-1.5 block text-sm text-red-700 dark:text-red-400">{errors.__email}</span>}
              </label>
              {checksPhone ? (
                <PhoneCheck key={round} apiBase={apiBase!} formId={fill.formId} phone={phone} setPhone={setPhone} onVerified={setPhoneCheckId} label={t("phone")} />
              ) : s.askPhone && (
                <label className="block sm:col-span-2">
                  <span className="text-base font-semibold">{t("phone")}</span> {!s.phoneRequired && <span className="text-muted-foreground">({t("optional")})</span>}
                  <input
                    id="gf-__phone"
                    type="tel"
                    required={s.phoneRequired}
                    value={phone}
                    maxLength={64}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setErrors((x) => (x.__phone ? { ...x, __phone: "" } : x));
                    }}
                    className={`${field} sm:max-w-[calc(50%-0.625rem)]`}
                    autoComplete="tel"
                    aria-invalid={!!errors.__phone}
                  />
                  {errors.__phone && <span className="mt-1.5 block text-sm text-red-700 dark:text-red-400">{errors.__phone}</span>}
                </label>
              )}
            </div>
          )}

          {isLast && (
            <>
              {extras}
              {needsHuman && <HumanCheck key={round} siteKey={fill.turnstileSiteKey!} onToken={setHuman} />}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition-colors has-[:checked]:border-[var(--gf-accent)] has-[:checked]:bg-[var(--gf-tint)]">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--gf-accent)]" />
                <span className="leading-relaxed">{consentText}</span>
              </label>
            </>
          )}
        </div>

        {/* Hidden from people on every step (bots fill it in) */}
        <label className="absolute -left-[9999px]" aria-hidden="true">
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>

        {error && (
          <p role="alert" className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-300">
            {error}
          </p>
        )}

        {saveLink && (
          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-sm" role="status">
            <p>{t("saved")}</p>
            <div className="mt-2 flex gap-2">
              <input readOnly value={saveLink} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 hover:bg-muted"
                onClick={() => navigator.clipboard?.writeText(saveLink).then(() => setCopied(true))}
              >
                {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />} {copied ? t("copied") : t("copy")}
              </button>
            </div>
          </div>
        )}

        {/* Actions: finish later on the left, Back and Next (or Send) on the right */}
        <div className={`mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center ${cover ? "border-t border-border pt-6" : ""}`}>
          {mode === "website" ? (
            <button
              type="button"
              onClick={saveForLater}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gf-ring)] sm:justify-start"
            >
              <Save aria-hidden="true" className="h-4 w-4" /> {t("saveLater")}
            </button>
          ) : null}
          <div className="flex gap-3 sm:ml-auto">
            {current > 0 && (
              <button type="button" onClick={() => go(current - 1)} className={secondary}>
                <ArrowLeft aria-hidden="true" className="h-4 w-4" /> {t("back")}
              </button>
            )}
            {isLast ? (
              <button
                type="submit"
                disabled={sending || mode === "preview"}
                title={mode === "preview" ? "This is a preview; nothing is sent" : undefined}
                className={`${primary} flex-1 sm:min-w-44 sm:flex-none`}
              >
                {sending ? t("sending") : t("send")}
              </button>
            ) : (
              <button type="button" onClick={next} className={`${primary} flex-1 sm:min-w-44 sm:flex-none`}>
                {t("next")} <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>,
  );
}

/** The slider's look in the form's colour: a quiet track, and a thumb that fills in once the person moves it */
const SLIDER_CSS = `
.gf-slider{-webkit-appearance:none;appearance:none;height:28px;background:transparent;cursor:pointer}
.gf-slider::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:color-mix(in srgb,currentColor 15%,transparent)}
.gf-slider::-moz-range-track{height:6px;border-radius:999px;background:color-mix(in srgb,currentColor 15%,transparent)}
.gf-slider::-webkit-slider-thumb{-webkit-appearance:none;height:22px;width:22px;margin-top:-8px;border-radius:999px;background:#fff;border:3px solid var(--gf-accent);box-shadow:0 1px 4px rgb(0 0 0/.25);transition:transform .15s,background .15s}
.gf-slider::-moz-range-thumb{height:16px;width:16px;border-radius:999px;background:#fff;border:3px solid var(--gf-accent);box-shadow:0 1px 4px rgb(0 0 0/.25)}
.gf-slider.gf-moved::-webkit-slider-thumb{background:var(--gf-accent)}
.gf-slider.gf-moved::-moz-range-thumb{background:var(--gf-accent)}
.gf-slider:active::-webkit-slider-thumb{transform:scale(1.15)}
.gf-slider:focus-visible{outline:2px solid var(--gf-accent);outline-offset:4px;border-radius:999px}
@media (prefers-reduced-motion:reduce){.gf-slider::-webkit-slider-thumb{transition:none}}
`;

/** What the form worked out: the outcome (e.g. a work style) and the match score as a ring */
/** What a share says and links to: the score and this form's own address (its "form" choice kept, nothing else) */
function shareOf(percent: number, formTitle: string, t: (k: string) => string): { url: string; text: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const u = new URL(window.location.href);
    const form = u.searchParams.get("form");
    u.search = "";
    u.hash = "";
    if (form) u.searchParams.set("form", form);
    return { url: u.toString(), text: t("shareText").replace("{n}", String(percent)).replace("{form}", formTitle) };
  } catch {
    return null;
  }
}

/**
 * The results after sending (and in the editor's preview): the score on a dial with the school's next steps and share
 * buttons, the outcome, and a link to the person's full report once the server has made it.
 */
export function ResultsView({
  result,
  accent,
  t,
  next,
  share,
  reportUrl,
  showOutcome = true,
}: {
  result: FormResult;
  accent: string;
  t: (k: string) => string;
  next?: NextSteps | null;
  share?: { url: string; text: string } | null;
  reportUrl?: string | null;
  showOutcome?: boolean;
}) {
  return (
    <div className="space-y-4">
      {result.match && (
        <section className="space-y-5 rounded-2xl border border-border px-5 py-7 sm:px-8">
          <ScoreDial percent={result.match.percent} label={result.match.label} title={result.matchTitle || t("yourScore")} />
          {result.match.message && <p className="mx-auto max-w-prose text-pretty text-center leading-relaxed text-muted-foreground">{result.match.message}</p>}
          {next && (
            <div className="border-t border-border pt-5">
              <NextStepsBlock next={next} />
            </div>
          )}
          {share && <ShareRow url={share.url} text={share.text} t={t} />}
        </section>
      )}
      {!result.match && next && (
        <section className="rounded-2xl border border-border px-5 py-6">
          <NextStepsBlock next={next} />
        </section>
      )}
      {showOutcome && result.outcome && (
        <section className="overflow-hidden rounded-2xl border border-border">
          <div className="px-6 py-5" style={{ background: `color-mix(in srgb, ${accent} 10%, transparent)` }}>
            <h2 className="text-sm font-medium" style={{ color: accent }}>
              {result.outcomeTitle || t("yourResult")}
            </h2>
            <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">{result.outcome.name}</p>
          </div>
          {result.outcome.summary && <p className="whitespace-pre-wrap px-6 py-5 leading-relaxed">{result.outcome.summary}</p>}
        </section>
      )}
      {reportUrl && <ReportLink url={reportUrl} accent={accent} t={t} />}
    </div>
  );
}

/** The button to the person's full report (opens in a new tab) */
function ReportLink({ url, accent, t }: { url: string; accent: string; t: (k: string) => string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-5 py-2.5 font-semibold transition-colors hover:bg-[var(--gf-tint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gf-accent)]"
      style={{ borderColor: accent, color: accent }}
    >
      <FileText aria-hidden="true" className="h-4 w-4" /> {t("seeReport")}
    </a>
  );
}

function Label({ q, lang, t, htmlFor }: { q: Question; lang: string; t: (k: string) => string; htmlFor?: string }) {
  const help = tr(q.translations, lang, "help", q.help);
  const content = (
    <>
      <span className="text-base font-semibold leading-snug text-foreground">{tr(q.translations, lang, "label", q.label)}</span>
      {!q.required && q.kind !== "info" && <span className="text-[15px] font-normal text-muted-foreground"> ({t("optional")})</span>}
      {help && <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{help}</span>}
    </>
  );
  return htmlFor ? (
    <label htmlFor={htmlFor} className="block">
      {content}
    </label>
  ) : (
    <legend className="block">{content}</legend>
  );
}

/**
 * One answer as a tile: a round marker where one answer is picked, a square one where several can be. Chosen: the
 * form's colour on the border and marker, and a tint behind.
 */
function Option({ on, multi, onClick, children, id }: { on: boolean; multi: boolean; onClick: () => void; children: React.ReactNode; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] leading-snug transition-[border-color,background-color,box-shadow] focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gf-ring)] ${
        on ? "border-[var(--gf-accent)] bg-[var(--gf-tint)] shadow-[inset_0_0_0_1px_var(--gf-accent)]" : "border-border bg-background hover:border-foreground/30"
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid h-5 w-5 shrink-0 place-items-center border-2 transition-colors ${multi ? "rounded-md" : "rounded-full"} ${
          on ? "border-[var(--gf-accent)] bg-[var(--gf-accent)] text-[var(--gf-on)]" : "border-foreground/25"
        }`}
      >
        {on && (multi ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-[var(--gf-on)]" />)}
      </span>
      <span className={on ? "font-medium" : ""}>{children}</span>
    </button>
  );
}

/**
 * Answers side by side, so a long list stays short: short ones (Yes, CompTIA) two to a row, three where the form is wide;
 * everyday ones (Cloud computing) two to a row; longer ones wider; sentences one under another
 */
const optionGrid = (labels: string[]) => {
  const longest = Math.max(0, ...labels.map((l) => l.length));
  return longest > 32
    ? "grid gap-2.5"
    : longest > 24
      ? "grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,13.5rem),1fr))]"
      : longest > 14
        ? "grid grid-cols-2 gap-2.5"
        : "grid grid-cols-2 gap-2.5 @xl:grid-cols-3";
};

function Field({
  q,
  lang,
  t,
  a,
  error,
  onChange,
  upload,
  preview,
  fill,
}: {
  q: Question;
  lang: string;
  t: (k: string) => string;
  a: Answer | undefined;
  error?: string;
  onChange: (a: Answer) => void;
  upload?: (file: File) => Promise<{ id: string; name: string; size: number }>;
  preview: boolean;
  fill: Fillable;
}) {
  const id = `gf-${q.id}`;
  // The words at each end of a scale or slider, in the person's language
  const minLabel = tr(q.translations, lang, "minLabel", q.minLabel);
  const maxLabel = tr(q.translations, lang, "maxLabel", q.maxLabel);
  const options = trOptions(q, lang);
  const v = a?.value ?? "";
  const placeholder = tr(q.translations, lang, "placeholder", q.placeholder);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const err = error || uploadError;
  const errorEl = err ? <span className="mt-2 block text-sm text-red-700 dark:text-red-400">{err}</span> : null;

  if (q.kind === "info")
    return (
      <div className="rounded-xl border-l-4 border-[var(--gf-accent)] bg-[var(--gf-tint)] px-4 py-3">
        <p className="whitespace-pre-wrap leading-relaxed">{tr(q.translations, lang, "label", q.label)}</p>
        {q.help && <p className="mt-1 text-sm text-muted-foreground">{tr(q.translations, lang, "help", q.help)}</p>}
      </div>
    );

  if (q.kind === "choice" || q.kind === "multi" || q.kind === "yesno") {
    const multi = q.kind === "multi";
    const list = q.kind === "yesno" ? ["Yes", "No"] : q.options;
    const shown = q.kind === "yesno" ? [t("yes"), t("no")] : options;
    const values = a?.values ?? [];
    const otherOn = multi ? (a?.other ?? "") !== "" || values.includes(OTHER) : v === OTHER;
    return (
      <fieldset aria-invalid={!!err}>
        <Label q={q} lang={lang} t={t} />
        <div className={`mt-3 ${q.kind === "yesno" ? "grid max-w-md grid-cols-2 gap-2.5" : optionGrid(shown)}`}>
          {list.map((o, i) => {
            const on = multi ? values.includes(o) : v === o;
            return (
              <Option
                key={o}
                id={i === 0 ? id : undefined}
                on={on}
                multi={multi}
                onClick={() => (multi ? onChange({ ...a, values: on ? values.filter((x) => x !== o) : [...values, o] }) : onChange({ value: on ? "" : o }))}
              >
                {shown[i]}
              </Option>
            );
          })}
          {q.allowOther && (
            <Option
              multi={multi}
              on={otherOn}
              onClick={() =>
                multi
                  ? onChange({ ...a, values: otherOn ? values.filter((x) => x !== OTHER) : [...values.filter((x) => x !== OTHER), OTHER], other: otherOn ? "" : a?.other })
                  : onChange({ value: otherOn ? "" : OTHER, other: a?.other })
              }
            >
              {t("other")}
            </Option>
          )}
        </div>
        {q.allowOther && otherOn && (
          <input className={field} value={a?.other ?? ""} maxLength={300} placeholder={t("otherPh")} onChange={(e) => onChange({ ...a, other: e.target.value })} aria-label={t("other")} />
        )}
        {errorEl}
      </fieldset>
    );
  }

  if (q.kind === "dropdown")
    return (
      <div>
        <Label q={q} lang={lang} t={t} htmlFor={id} />
        <select id={id} className={field} value={v} onChange={(e) => onChange({ value: e.target.value, other: a?.other })} aria-invalid={!!err}>
          <option value="">{t("choose")}</option>
          {q.options.map((o, i) => (
            <option key={o} value={o}>
              {options[i]}
            </option>
          ))}
          {q.allowOther && <option value={OTHER}>{t("other")}</option>}
        </select>
        {v === OTHER && <input className={field} value={a?.other ?? ""} maxLength={300} placeholder={t("otherPh")} onChange={(e) => onChange({ value: OTHER, other: e.target.value })} aria-label={t("other")} />}
        {errorEl}
      </div>
    );

  if (q.kind === "scale") {
    const lo = q.min ?? 1;
    const hi = q.max ?? 5;
    return (
      <fieldset aria-invalid={!!err}>
        <Label q={q} lang={lang} t={t} />
        <div className="mt-3 flex max-w-md flex-wrap gap-2">
          {Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)).map((n, i) => (
            <button
              key={n}
              id={i === 0 ? id : undefined}
              type="button"
              aria-pressed={v === n}
              onClick={() => onChange({ value: v === n ? "" : n })}
              className={`h-12 min-w-12 flex-1 rounded-xl border text-[15px] font-medium transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gf-ring)] ${
                v === n ? "border-[var(--gf-accent)] bg-[var(--gf-accent)] text-[var(--gf-on)]" : "border-border bg-background hover:border-foreground/30"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {(minLabel || maxLabel) && (
          <div className="mt-2 flex max-w-md justify-between text-sm text-muted-foreground">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>
        )}
        {errorEl}
      </fieldset>
    );
  }

  if (q.kind === "slider") {
    const lo = q.min ?? 1;
    const hi = q.max ?? 7;
    const moved = v !== "";
    const pos = moved ? Number(v) : Number(sliderMiddle(q));
    const mid = (lo + hi) / 2;
    const where = pos === mid ? t("middle") : t("leansTo").replace("{x}", pos < mid ? minLabel : maxLabel);
    return (
      <div>
        <Label q={q} lang={lang} t={t} htmlFor={id} />
        <div className="mt-3 flex justify-between gap-4 text-sm font-medium" aria-hidden="true">
          <span>{minLabel}</span>
          <span className="text-right">{maxLabel}</span>
        </div>
        <input
          id={id}
          type="range"
          min={lo}
          max={hi}
          step={1}
          value={pos}
          onChange={(e) => onChange({ value: e.target.value })}
          aria-valuetext={`${where} (${minLabel} – ${maxLabel})`}
          className={`gf-slider mt-1 block w-full ${moved ? "gf-moved" : ""}`}
        />
        <div aria-hidden="true" className="flex justify-between px-[9px]">
          {Array.from({ length: hi - lo + 1 }, (_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${lo + i === pos && moved ? "bg-[var(--gf-accent)]" : "bg-muted-foreground/30"}`} />
          ))}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground" aria-hidden="true">
          {moved ? where : t("sliderHint")}
        </p>
        {errorEl}
      </div>
    );
  }

  if (q.kind === "list") {
    const cols = trColumns(q, lang);
    const rows = a?.rows?.length ? a.rows : [{}];
    const max = q.max ?? 5;
    const setRows = (next: Record<string, string>[]) => onChange({ rows: next.length ? next : [{}] });
    return (
      <fieldset aria-invalid={!!err}>
        <Label q={q} lang={lang} t={t} />
        <ul className="mt-3 space-y-2.5">
          {rows.map((r, i) => (
            <li
              key={i}
              className="grid items-end gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-[repeat(var(--gf-cols),minmax(0,1fr))_auto]"
              style={{ "--gf-cols": cols.length } as React.CSSProperties}
            >
              {cols.map((c, ci) => {
                const cid = i === 0 && ci === 0 ? id : `${id}-${i}-${c.id}`;
                const value = r[c.id] ?? "";
                const set = (x: string) => setRows(rows.map((row, j) => (j === i ? { ...row, [c.id]: x } : row)));
                return (
                  <label key={c.id} htmlFor={cid} className="block text-sm font-medium text-muted-foreground">
                    {c.label}
                    {c.options.length > 0 ? (
                      <select id={cid} className={field} value={value} onChange={(e) => set(e.target.value)}>
                        <option value="">{t("choose")}</option>
                        {c.options.map((o, oi) => (
                          <option key={o} value={o}>
                            {c.optionLabels[oi]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input id={cid} className={field} value={value} maxLength={120} onChange={(e) => set(e.target.value)} />
                    )}
                  </label>
                );
              })}
              <button
                type="button"
                aria-label={`${t("remove")} ${i + 1}`}
                disabled={rows.length === 1 && !cols.some((c) => (r[c.id] ?? "").trim())}
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="justify-self-end rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:invisible"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {rows.length < max && (
          <button
            type="button"
            onClick={() => setRows([...rows, {}])}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-[15px] font-medium hover:border-foreground/30 hover:bg-muted focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gf-ring)]"
          >
            <Plus aria-hidden="true" className="h-4 w-4" /> {t("addRow")}
          </button>
        )}
        {errorEl}
      </fieldset>
    );
  }

  if (q.kind === "booking")
    return (
      <fieldset aria-invalid={!!err}>
        <Label q={q} lang={lang} t={t} />
        <MeetingField q={q} a={a} onChange={onChange} t={t} lang={lang} options={options} preview={preview} fill={fill} id={id} />
        {errorEl}
      </fieldset>
    );

  if (q.kind === "consent")
    return (
      <div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition-colors has-[:checked]:border-[var(--gf-accent)] has-[:checked]:bg-[var(--gf-tint)]">
          <input id={id} type="checkbox" checked={v === "Yes"} onChange={(e) => onChange({ value: e.target.checked ? "Yes" : "" })} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--gf-accent)]" />
          <span className="leading-relaxed">
            {tr(q.translations, lang, "label", q.label)}
            {q.help && <span className="mt-0.5 block text-sm text-muted-foreground">{tr(q.translations, lang, "help", q.help)}</span>}
          </span>
        </label>
        {errorEl}
      </div>
    );

  if (q.kind === "file") {
    const files = a?.files ?? [];
    const max = q.max ?? 1;
    return (
      <div>
        <Label q={q} lang={lang} t={t} htmlFor={id} />
        <ul className="mt-1 space-y-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-xs">
              <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-muted-foreground">{Math.ceil(f.size / 1024)} KB</span>
              <button type="button" aria-label={`${t("remove")} ${f.name}`} onClick={() => onChange({ files: files.filter((x) => x.id !== f.id) })} className="rounded p-0.5 hover:bg-muted">
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        {files.length < max && (
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-[15px] font-medium hover:border-foreground/30 hover:bg-muted has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[var(--gf-ring)]">
            <Paperclip aria-hidden="true" className="h-4 w-4" /> {busy ? t("uploading") : t("attach")}
            <input
              id={id}
              type="file"
              className="sr-only"
              disabled={busy || preview || !upload}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file || !upload) return;
                if (file.size > 5 * 1024 * 1024) return setUploadError("Files can be up to 5 MB.");
                setBusy(true);
                setUploadError(null);
                try {
                  const up = await upload(file);
                  onChange({ files: [...files, up] });
                } catch (x) {
                  setUploadError((x as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        )}
        <span className="mt-1.5 block text-sm text-muted-foreground">{t("fileHint")}</span>
        {errorEl}
      </div>
    );
  }

  const type = { number: "number", date: "date", email: "email", phone: "tel" }[q.kind as string] ?? "text";
  return (
    <div>
      <Label q={q} lang={lang} t={t} htmlFor={id} />
      {q.kind === "longtext" ? (
        <textarea id={id} rows={3} maxLength={4000} value={v} placeholder={placeholder} onChange={(e) => onChange({ value: e.target.value })} className={field} aria-invalid={!!err} />
      ) : (
        <input
          id={id}
          type={type}
          inputMode={q.kind === "number" ? "decimal" : undefined}
          min={q.kind === "number" ? (q.min ?? undefined) : undefined}
          max={q.kind === "number" ? (q.max ?? undefined) : undefined}
          maxLength={q.kind === "text" ? 500 : undefined}
          value={v}
          placeholder={placeholder}
          autoComplete={q.kind === "email" ? "email" : q.kind === "phone" ? "tel" : undefined}
          onChange={(e) => onChange({ value: e.target.value })}
          className={field}
          aria-invalid={!!err}
        />
      )}
      {errorEl}
    </div>
  );
}
