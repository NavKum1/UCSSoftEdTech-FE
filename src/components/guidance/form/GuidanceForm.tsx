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
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Copy, Paperclip, Save, X } from "lucide-react";
import { getApiBaseUrl } from "@/lib/apiClient";
import {
  check,
  estimateMinutes,
  onAccent,
  OTHER,
  questionVisible,
  sectionVisible,
  toApi,
  tr,
  trOptions,
  type Answer,
  type Answers,
  type Fillable,
  type Question,
} from "./model";
import { RTL, UI, type UiKey } from "./uiText";
import { HumanCheck, PhoneCheck } from "./Protection";


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
  "mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-2 focus:outline-[var(--gf-accent)]";

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
  onSubmit: (p: SubmitPayload) => Promise<string | null>;
  /** Called after sending (the caller shows its own confirmation); without it the form thanks the person */
  onSent?: () => void;
  campaign?: string | null;
  /** The page the form is on (embedded); else the referring site */
  referrer?: string | null;
  resumeToken?: string | null;
  /** Website forms: the public API for this institute (phone codes) */
  apiBase?: string;
}) {
  const def = fill.definition;
  const s = def.settings;
  // Website forms remember their answers in this browser, so a reload or a later visit picks up where the person left off
  // (not when opening a "finish later" link, which brings its own answers)
  const [stored] = useState<Stored | null>(() => (mode === "website" && !resumeToken && typeof window !== "undefined" ? readStored(fill.formId) : null));
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
    if (mode !== "website" || sent) return;
    writeStored(fill.formId, {
      answers, unsure, name: typedName ?? "", email: typedEmail ?? "", phone, language: picked, step: current,
      visitId: visit.current?.id ?? null, partialToken: partialToken.current, savedAt: Date.now(),
    });
  }, [mode, sent, fill.formId, answers, unsure, typedName, typedEmail, phone, picked, current]);

  const set = (id: string, a: Answer) => {
    if (!visit.current?.started) track(id, true);
    setAnswers((x) => ({ ...x, [id]: a }));
    setErrors((e) => (e[id] ? { ...e, [id]: "" } : e));
  };

  const validateStep = (): boolean => {
    const e: Record<string, string> = {};
    if (current === unsureStep && s.askUnsure && !unsure.trim()) e.__unsure = "Please tell us what you'd like help with.";
    if (isDetails && !isLast) {
      if (!name.trim()) e.__name = "Please give your name.";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.__email = "Please give a valid email address.";
      if (s.phoneRequired && !phone.trim()) e.__phone = "Please give your phone number.";
    }
    for (const q of stepQuestions) {
      const msg = check(q, answers[q.id]);
      if (msg) e[q.id] = msg;
    }
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) document.getElementById(`gf-${first}`)?.focus();
    return !first;
  };

  const go = (to: number) => {
    setStep(to);
    setError(null);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Forms that save as people go: what's been given so far, once there's an email or phone to follow up on. In the
  // background; a failure never holds the person up.
  const saveProgress = () => {
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
    if (!validateStep()) return;
    track(stepQuestions[stepQuestions.length - 1]?.id, true);
    if (current >= saveFrom) saveProgress();
    go(current + 1);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLast) return next();
    if (!validateStep()) return;
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
    if (err) return setError(err);
    // Sent: nothing more to resume in this browser
    if (mode === "website") writeStored(fill.formId, null);
    // With email confirmation the redirect happens after the person confirms (the confirm page does it)
    if (s.redirectUrl && mode === "website" && s.requireEmailConfirmation === false) {
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
  const style = { "--gf-accent": accent, "--gf-on": onAccent(accent) } as React.CSSProperties;
  const title = tr(s.translations, lang, "title", s.title) || `Get career guidance from ${fill.instituteName}`;
  const intro = tr(s.translations, lang, "description", s.intro);

  if (sent)
    return (
      <div className="p-6 text-center" role="status" style={style}>
        <CheckCircle2 aria-hidden="true" className="mx-auto h-9 w-9" style={{ color: accent }} />
        <p className="mt-2 whitespace-pre-wrap text-base font-semibold">{tr(s.translations, lang, "label", s.thankYou) || t("thanks")}</p>
        {!s.thankYou && <p className="mt-1 text-sm text-muted-foreground">An advisor from {fill.instituteName} will contact you at {email.trim()}.</p>}
      </div>
    );

  return (
    <div ref={top} style={style} className="text-sm" dir={RTL.includes(lang) ? "rtl" : "ltr"} lang={lang}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {!bare && s.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoUrl} alt={fill.instituteName} className="mb-3 h-10 w-auto max-w-48 object-contain" />
          )}
          {!bare && <h1 className="text-lg font-semibold">{title}</h1>}
          {intro && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{intro}</p>}
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock aria-hidden="true" className="h-3.5 w-3.5" /> {t("minutes").replace("{n}", String(estimateMinutes(def)))}
          </p>
          {savesPartial && (
            <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
              <Save aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
              {(s.partialNotice?.trim() ? tr(s.translations, lang, "notice", s.partialNotice) : t("partialNotice")).replaceAll("{institute}", fill.instituteName)}
            </p>
          )}
        </div>
        {def.languages.length > 1 && (
          <label className="shrink-0 text-xs">
            <span className="sr-only">{t("language")}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5">
              {def.languages.map((l) => (
                <option key={l} value={l}>
                  {fill.languageNames[l] ?? l}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Progress */}
      {steps > 1 && (
        <div className="mt-4" aria-label={`${t("step")} ${current + 1} ${t("of")} ${steps}`}>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {t("step")} {current + 1} {t("of")} {steps}
            </span>
            <span>{section ? tr(section.translations, lang, "title", section.title) : t("details")}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-[var(--gf-accent)] transition-all" style={{ width: `${((current + 1) / steps) * 100}%` }} />
          </div>
        </div>
      )}

      <form onSubmit={submit} className="mt-5 space-y-5" noValidate>
        {current === unsureStep && s.askUnsure && (
          <label className="block">
            <span className="font-medium">{t("unsure")}</span>
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
            {errors.__unsure && <span className="mt-1 block text-red-700 dark:text-red-400">{errors.__unsure}</span>}
          </label>
        )}

        {section && (
          <>
            {(sections.length > 1 || section.description) && (
              <div>
                {sections.length > 1 && <h2 className="text-base font-semibold">{tr(section.translations, lang, "title", section.title)}</h2>}
                {section.description && <p className="text-muted-foreground">{tr(section.translations, lang, "description", section.description)}</p>}
              </div>
            )}
            {stepQuestions.map((q) => (
              <Field key={q.id} q={q} lang={lang} t={t} a={answers[q.id]} error={errors[q.id]} onChange={(a) => set(q.id, a)} upload={upload} preview={mode === "preview"} />
            ))}
          </>
        )}

        {isDetails && (
          <>
            <h2 className="text-base font-semibold">{t("details")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="font-medium">{t("name")}</span>
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
                {errors.__name && <span className="mt-1 block text-red-700 dark:text-red-400">{errors.__name}</span>}
              </label>
              <label className="block">
                <span className="font-medium">{t("email")}</span>
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
                {errors.__email && <span className="mt-1 block text-red-700 dark:text-red-400">{errors.__email}</span>}
              </label>
              {checksPhone ? (
                <PhoneCheck apiBase={apiBase!} formId={fill.formId} phone={phone} setPhone={setPhone} onVerified={setPhoneCheckId} label={t("phone")} />
              ) : s.askPhone && (
                <label className="block sm:col-span-2">
                  <span className="font-medium">{t("phone")}</span> {!s.phoneRequired && <span className="text-muted-foreground">({t("optional")})</span>}
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
                    className={field}
                    autoComplete="tel"
                    aria-invalid={!!errors.__phone}
                  />
                  {errors.__phone && <span className="mt-1 block text-red-700 dark:text-red-400">{errors.__phone}</span>}
                </label>
              )}
            </div>
          </>
        )}

        {/* Hidden from people on every step (bots fill it in) */}
        <label className="absolute -left-[9999px]" aria-hidden="true">
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>

        {isLast && (
          <>
            {extras}
            {needsHuman && <HumanCheck siteKey={fill.turnstileSiteKey!} onToken={setHuman} />}
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--gf-accent)]" />
              <span>{consentText}</span>
            </label>
          </>
        )}

        {error && (
          <p role="alert" className="text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        {saveLink && (
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs" role="status">
            <p>{t("saved")}</p>
            <div className="mt-1.5 flex gap-2">
              <input readOnly value={saveLink} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 font-mono" onFocus={(e) => e.target.select()} />
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1"
                onClick={() => navigator.clipboard?.writeText(saveLink).then(() => setCopied(true))}
              >
                {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />} {copied ? t("copied") : t("copy")}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {current > 0 && (
            <button type="button" onClick={() => go(current - 1)} className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-2.5 font-medium hover:bg-muted">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" /> {t("back")}
            </button>
          )}
          {isLast ? (
            <button
              type="submit"
              disabled={sending || mode === "preview"}
              title={mode === "preview" ? "This is a preview; nothing is sent" : undefined}
              className="flex-1 rounded-xl bg-[var(--gf-accent)] px-4 py-2.5 font-semibold text-[var(--gf-on)] hover:opacity-90 disabled:opacity-60"
            >
              {sending ? t("sending") : t("send")}
            </button>
          ) : (
            <button type="button" onClick={next} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[var(--gf-accent)] px-4 py-2.5 font-semibold text-[var(--gf-on)] hover:opacity-90">
              {t("next")} <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
          {mode === "website" && (
            <button type="button" onClick={saveForLater} className="inline-flex items-center gap-1 px-2 py-2 text-xs text-muted-foreground hover:text-foreground">
              <Save aria-hidden="true" className="h-3.5 w-3.5" /> {t("saveLater")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Label({ q, lang, t, htmlFor }: { q: Question; lang: string; t: (k: string) => string; htmlFor?: string }) {
  const help = tr(q.translations, lang, "help", q.help);
  const content = (
    <>
      <span className="font-medium">{tr(q.translations, lang, "label", q.label)}</span>
      {!q.required && q.kind !== "info" && <span className="text-muted-foreground"> ({t("optional")})</span>}
      {help && <span className="mt-0.5 block text-xs text-muted-foreground">{help}</span>}
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

function Pill({ on, onClick, children, id }: { on: boolean; onClick: () => void; children: React.ReactNode; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? "border-[var(--gf-accent)] bg-[var(--gf-accent)] text-[var(--gf-on)]" : "border-border hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}

function Field({
  q,
  lang,
  t,
  a,
  error,
  onChange,
  upload,
  preview,
}: {
  q: Question;
  lang: string;
  t: (k: string) => string;
  a: Answer | undefined;
  error?: string;
  onChange: (a: Answer) => void;
  upload?: (file: File) => Promise<{ id: string; name: string; size: number }>;
  preview: boolean;
}) {
  const id = `gf-${q.id}`;
  const options = trOptions(q, lang);
  const v = a?.value ?? "";
  const placeholder = tr(q.translations, lang, "placeholder", q.placeholder);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const err = error || uploadError;
  const errorEl = err ? <span className="mt-1 block text-red-700 dark:text-red-400">{err}</span> : null;

  if (q.kind === "info")
    return (
      <div className="rounded-xl bg-muted/50 p-3">
        <p className="whitespace-pre-wrap">{tr(q.translations, lang, "label", q.label)}</p>
        {q.help && <p className="mt-1 text-xs text-muted-foreground">{tr(q.translations, lang, "help", q.help)}</p>}
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
        <div className="mt-1.5 flex flex-wrap gap-2">
          {list.map((o, i) => {
            const on = multi ? values.includes(o) : v === o;
            return (
              <Pill
                key={o}
                id={i === 0 ? id : undefined}
                on={on}
                onClick={() => (multi ? onChange({ ...a, values: on ? values.filter((x) => x !== o) : [...values, o] }) : onChange({ value: on ? "" : o }))}
              >
                {shown[i]}
              </Pill>
            );
          })}
          {q.allowOther && (
            <Pill
              on={otherOn}
              onClick={() =>
                multi
                  ? onChange({ ...a, values: otherOn ? values.filter((x) => x !== OTHER) : [...values.filter((x) => x !== OTHER), OTHER], other: otherOn ? "" : a?.other })
                  : onChange({ value: otherOn ? "" : OTHER, other: a?.other })
              }
            >
              {t("other")}
            </Pill>
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
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)).map((n, i) => (
            <button
              key={n}
              id={i === 0 ? id : undefined}
              type="button"
              aria-pressed={v === n}
              onClick={() => onChange({ value: v === n ? "" : n })}
              className={`h-10 w-10 rounded-xl border text-sm font-medium ${v === n ? "border-[var(--gf-accent)] bg-[var(--gf-accent)] text-[var(--gf-on)]" : "border-border hover:bg-muted"}`}
            >
              {n}
            </button>
          ))}
        </div>
        {(q.minLabel || q.maxLabel) && (
          <div className="mt-1 flex max-w-md justify-between text-xs text-muted-foreground">
            <span>{q.minLabel}</span>
            <span>{q.maxLabel}</span>
          </div>
        )}
        {errorEl}
      </fieldset>
    );
  }

  if (q.kind === "consent")
    return (
      <div>
        <label className="flex items-start gap-2">
          <input id={id} type="checkbox" checked={v === "Yes"} onChange={(e) => onChange({ value: e.target.checked ? "Yes" : "" })} className="mt-0.5 h-4 w-4 accent-[var(--gf-accent)]" />
          <span>
            {tr(q.translations, lang, "label", q.label)}
            {q.help && <span className="block text-xs text-muted-foreground">{tr(q.translations, lang, "help", q.help)}</span>}
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
          <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 hover:bg-muted">
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
        <span className="mt-1 block text-xs text-muted-foreground">{t("fileHint")}</span>
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
