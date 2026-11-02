"use client";

/**
 * Setting a school up (S3): four short steps after sign-up, each one skippable: the school (kind, logo, colour, contact
 * details), a first inquiry form from the templates for its kind and country, its team (Staff access), and its website
 * (the form's link and code, or e-mailing them to whoever runs the site). The dashboard checklist links back to each step.
 */
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, ImageUp, Loader2, Mail, Trash2 } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { SCHOOL_KINDS, countryList, countryName } from "@/lib/schoolKinds";
import { CHECK_TEXT, type SetupState } from "@/components/institute/SetupChecklist";
import StaffAccess from "@/components/institute/StaffAccess";
import EmbedBuilder from "@/components/guidance/editor/EmbedBuilder";

const STEPS = [
  { key: "school", title: "Your school", text: "Logo, colour and details" },
  { key: "form", title: "Your first form", text: "From a template" },
  { key: "team", title: "Your team", text: "Counsellors and admins" },
  { key: "website", title: "Your website", text: "Link and code" },
] as const;
type Step = (typeof STEPS)[number]["key"];

const SWATCHES = ["#0e7490", "#4f46e5", "#047857", "#b91c1c", "#c2410c", "#7c3aed", "#0f172a"];
const input =
  "mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[15px] outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/15";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-cyan-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 disabled:opacity-60";
const secondary = "inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[15px] font-medium hover:bg-muted disabled:opacity-60";

export default function SetupPage() {
  return (
    <Suspense fallback={null}>
      <Setup />
    </Suspense>
  );
}

function Setup() {
  const { apiFetch, ready, access, getToken } = useLegacyApi();
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("step");
  const [step, setStep] = useState<Step>(STEPS.some((s) => s.key === requested) ? (requested as Step) : "school");
  const [s, setS] = useState<SetupState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await apiFetch("/api/institute/setup");
    const body = await res.json().catch(() => null);
    if (!res.ok) return setError(body?.error ?? "Setup couldn't be loaded.");
    setS(body);
  };
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  if (access) return <AccessNotice problem={access} feature="school setup" />;
  if (!s) {
    return <div className="mx-auto max-w-5xl p-6">{error ? <p className="text-sm text-red-700">{error}</p> : <Loader2 aria-label="Loading" className="h-5 w-5 animate-spin text-muted-foreground" />}</div>;
  }

  const index = STEPS.findIndex((x) => x.key === step);
  const done = (k: Step) => s.checklist.find((c) => c.key === k)?.done ?? false;
  const go = (k: Step) => {
    setStep(k);
    window.history.replaceState(null, "", `/institute/setup?step=${k}`);
    window.scrollTo({ top: 0 });
  };
  const next = async () => {
    if (index < STEPS.length - 1) return go(STEPS[index + 1].key);
    await apiFetch("/api/institute/setup/finish", { method: "POST" });
    router.push("/institute/dashboard");
  };
  const props = { s, setS, apiFetch, next };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Set up {s.school.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Four short steps. Skip any of them and come back from the checklist on your dashboard.</p>
      </div>

      <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-8">
        {/* Steps: a list on the side on wide screens, a bar on phones */}
        <nav aria-label="Setup steps" className="mb-5 lg:mb-0">
          <p className="mb-2 text-sm text-muted-foreground lg:hidden">
            Step {index + 1} of {STEPS.length}: {STEPS[index].title}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted lg:hidden">
            <div className="h-full rounded-full bg-cyan-600" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
          </div>
          <ol className="hidden space-y-1 lg:block">
            {STEPS.map((x, i) => (
              <li key={x.key}>
                <button
                  type="button"
                  onClick={() => go(x.key)}
                  aria-current={x.key === step ? "step" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${x.key === step ? "bg-cyan-50 dark:bg-cyan-950/40" : "hover:bg-muted"}`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      done(x.key) ? "bg-emerald-600 text-white" : x.key === step ? "bg-cyan-700 text-white" : "border border-border text-muted-foreground"
                    }`}
                  >
                    {done(x.key) ? <Check aria-label="Done" className="h-4 w-4" strokeWidth={3} /> : i + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{x.title}</span>
                    <span className="block text-xs text-muted-foreground">{x.text}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <section aria-labelledby="step-title" className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          {step === "school" && <SchoolStep {...props} />}
          {step === "form" && <FormStep {...props} />}
          {step === "team" && <TeamStep {...props} getToken={getToken} />}
          {step === "website" && <WebsiteStep {...props} />}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            {index > 0 ? (
              <button type="button" onClick={() => go(STEPS[index - 1].key)} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Back
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={() => void next()} className={step === "school" ? "text-sm font-medium text-muted-foreground hover:text-foreground" : secondary}>
              {index === STEPS.length - 1 ? "Finish and open the dashboard" : step === "school" ? "Skip for now" : "Next step"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

type StepProps = {
  s: SetupState;
  setS: (s: SetupState) => void;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  next: () => Promise<void>;
};

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-6">
      <h2 id="step-title" className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {text}
    </p>
  ) : null;
}

// ------------------------------------------------------------------ 1. the school

function SchoolStep({ s, setS, apiFetch, next }: StepProps) {
  const [f, setF] = useState({
    kind: s.school.kind,
    country: s.school.country,
    website: s.school.website ?? "",
    contactEmail: s.school.contactEmail ?? "",
    address: s.school.address ?? "",
    accent: s.school.accent ?? "",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const countries = useMemo(() => countryList(), []);
  const validAccent = /^#[0-9a-fA-F]{6}$/.test(f.accent);

  const upload = async (picked: File | undefined) => {
    if (!picked) return;
    if (picked.size > 1024 * 1024) return setError("The logo can be up to 1 MB.");
    setBusy("logo");
    setError(null);
    const body = new FormData();
    body.append("file", picked);
    const res = await apiFetch("/api/institute/setup/logo", { method: "POST", body });
    const b = await res.json().catch(() => null);
    setBusy(null);
    if (file.current) file.current.value = "";
    if (!res.ok) return setError(b?.error ?? "The logo couldn't be uploaded.");
    setS(b);
  };
  const removeLogo = async () => {
    setBusy("logo");
    const res = await apiFetch("/api/institute/setup/logo", { method: "DELETE" });
    const b = await res.json().catch(() => null);
    setBusy(null);
    if (res.ok) setS(b);
  };
  const save = async () => {
    setBusy("save");
    setError(null);
    const res = await apiFetch("/api/institute/setup/details", { method: "PUT", body: JSON.stringify(f) });
    const b = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) return setError(b?.error ?? "Your details couldn't be saved.");
    setS(b);
    await next();
  };

  return (
    <>
      <Heading title="Your school" text="Your logo and colour go on your inquiry forms, the reports people receive, and your e-mails." />

      <fieldset>
        <legend className="text-sm font-medium">What kind of organisation are you?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SCHOOL_KINDS.map((k) => (
            <label
              key={k.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${f.kind === k.value ? "border-cyan-600 bg-cyan-50/60 ring-1 ring-cyan-600 dark:bg-cyan-950/30" : "border-border hover:bg-muted/50"}`}
            >
              <input type="radio" name="kind" value={k.value} checked={f.kind === k.value} onChange={() => setF({ ...f, kind: k.value })} className="mt-1 accent-cyan-700" />
              <span>
                <span className="block text-sm font-medium">{k.label}</span>
                <span className="block text-xs text-muted-foreground">{k.text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-7 grid gap-6 md:grid-cols-[1fr_1fr]">
        <div>
          <p className="text-sm font-medium">Logo</p>
          <div className="mt-2 flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
              {s.school.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- the school's own image from the API
                <img src={s.school.logoUrl} alt={`${s.school.name} logo`} className="max-h-full max-w-full object-contain p-1.5" />
              ) : (
                <ImageUp aria-hidden="true" className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="logo-file" onChange={(e) => void upload(e.target.files?.[0])} />
              <label htmlFor="logo-file" className={`${secondary} cursor-pointer py-2 text-sm`}>
                {busy === "logo" ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ImageUp aria-hidden="true" className="h-4 w-4" />}
                {s.school.logoUrl ? "Replace" : "Upload"}
              </label>
              {s.school.logoUrl && (
                <button type="button" onClick={() => void removeLogo()} disabled={busy != null} className="ml-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-red-700">
                  <Trash2 aria-hidden="true" className="h-4 w-4" /> Remove
                </button>
              )}
              <p className="text-xs text-muted-foreground">PNG, JPEG or WebP, up to 1 MB. A wide logo on a clear background looks best.</p>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="accent" className="text-sm font-medium">
            Brand colour
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Use ${c}`}
                aria-pressed={f.accent.toLowerCase() === c}
                onClick={() => setF({ ...f, accent: c })}
                className={`h-8 w-8 rounded-full border-2 ${f.accent.toLowerCase() === c ? "border-foreground" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
            <input
              type="color"
              aria-label="Pick any colour"
              value={validAccent ? f.accent : "#0e7490"}
              onChange={(e) => setF({ ...f, accent: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border border-border bg-background"
            />
          </div>
          <input id="accent" value={f.accent} onChange={(e) => setF({ ...f, accent: e.target.value.trim() })} placeholder="#0e7490" className={`${input} max-w-40 font-mono text-sm`} />
          {validAccent && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-white" style={{ background: f.accent }}>
              Book a guidance session
            </p>
          )}
        </div>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="country" className="text-sm font-medium">
            Country
          </label>
          {s.school.countryLocked ? (
            <p id="country" className="mt-1.5 rounded-xl bg-muted/60 px-3.5 py-2.5 text-[15px]">
              {countryName(s.school.country)} <span className="text-xs text-muted-foreground">(set at sign-up: it decides your currency)</span>
            </p>
          ) : (
            <select id="country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} className={input}>
              <option value="">Choose your country</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label htmlFor="website" className="text-sm font-medium">
            Website
          </label>
          <input id="website" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="www.yourschool.edu" className={input} />
        </div>
        <div>
          <label htmlFor="contact" className="text-sm font-medium">
            Contact e-mail for families and students
          </label>
          <input id="contact" type="email" value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} placeholder="admissions@yourschool.edu" className={input} />
        </div>
        <div>
          <label htmlFor="address" className="text-sm font-medium">
            Postal address <span className="font-normal text-muted-foreground">(shown in e-mail footers)</span>
          </label>
          <input id="address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={input} />
        </div>
      </div>

      <Problem text={error} />
      <button type="button" onClick={() => void save()} disabled={busy != null} className={`${primary} mt-6`}>
        {busy === "save" && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />} Save and continue
      </button>
    </>
  );
}

// ------------------------------------------------------------------ 2. the first form

function FormStep({ s, setS, apiFetch }: StepProps) {
  const own = s.forms.find((f) => f.customized && f.publicEnabled);
  const [choice, setChoice] = useState(s.suggested[0]?.key ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await apiFetch("/api/institute/setup/form", { method: "POST", body: JSON.stringify({ template: choice }) });
    const b = await res.json().catch(() => null);
    if (!res.ok) {
      setBusy(false);
      return setError(b?.error ?? "The form couldn't be created.");
    }
    const st = await apiFetch("/api/institute/setup");
    if (st.ok) setS(await st.json());
    setBusy(false);
    setMade(b.name);
  };

  return (
    <>
      <Heading
        title="Your first inquiry form"
        text="Families and students fill it in on your website. Each answer becomes a lead in your CRM, and each person gets a report with their results."
      />
      {own && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <span className="flex items-center gap-2">
            <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
            {made ? `"${made}" is published with your logo and colour.` : `"${own.name}" is published.`}
          </span>
          <Link href="/institute/guidance" className="font-semibold underline underline-offset-2">
            Change its questions
          </Link>
        </div>
      )}
      <fieldset>
        <legend className="text-sm font-medium">{own ? "Or start another from a template" : "Templates for schools like yours"}</legend>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {s.suggested.map((t) => (
            <label
              key={t.key}
              className={`flex cursor-pointer flex-col rounded-xl border p-4 transition ${choice === t.key ? "border-cyan-600 bg-cyan-50/60 ring-1 ring-cyan-600 dark:bg-cyan-950/30" : "border-border hover:bg-muted/50"}`}
            >
              <span className="flex items-start gap-3">
                <input type="radio" name="template" value={t.key} checked={choice === t.key} onChange={() => setChoice(t.key)} className="mt-1 accent-cyan-700" />
                <span>
                  <span className="block font-medium">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    For {t.audience}
                    {t.country !== "any" && `, ${countryName(t.country)}`}
                  </span>
                  <span className="mt-1.5 block text-sm text-muted-foreground">{t.description}</span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-sm text-muted-foreground">
        More templates, and a blank form, are in{" "}
        <Link href="/institute/guidance" className="font-medium text-cyan-700 hover:underline dark:text-cyan-400">
          Guidance forms
        </Link>
        .
      </p>
      <Problem text={error} />
      <button type="button" onClick={() => void create()} disabled={busy || !choice} className={`${primary} mt-6`}>
        {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />} {own ? "Create and publish this one" : "Create and publish my form"}
      </button>
    </>
  );
}

// ------------------------------------------------------------------ 3. the team

function TeamStep({ s, getToken }: StepProps & { getToken: () => Promise<string | null> }) {
  return (
    <>
      <Heading
        title="Your team"
        text="Counsellors work the inquiries and meetings; admins can change everything, including billing. Each person gets an e-mail to set up their sign-in."
      />
      <p className="mb-5 text-sm">
        {s.team.limit == null ? `${s.team.used} on your team.` : `${s.team.used} of ${s.team.limit} places on your ${s.plan?.name ?? ""} plan are used.`}{" "}
        {s.team.limit != null && s.team.used >= s.team.limit && (
          <Link href="/institute/billing" className="font-medium text-cyan-700 hover:underline dark:text-cyan-400">
            Upgrade for more places
          </Link>
        )}
      </p>
      <StaffAccess getToken={getToken} compact />
    </>
  );
}

// ------------------------------------------------------------------ 4. the website

function WebsiteStep({ s, apiFetch }: StepProps) {
  const form = s.forms.find((f) => f.isDefault && f.publicEnabled) ?? s.forms.find((f) => f.publicEnabled);
  const [copied, setCopied] = useState(false);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    setBusy(true);
    setNote(null);
    const res = await apiFetch("/api/institute/setup/website-code", { method: "POST", body: JSON.stringify({ email: to }) });
    const b = await res.json().catch(() => null);
    setBusy(false);
    setNote(res.ok ? { ok: true, text: `Sent to ${to}.` } : { ok: false, text: b?.error ?? "The e-mail couldn't be sent." });
  };

  if (!form) {
    return (
      <>
        <Heading title="Your website" text="Put your inquiry form on your website, or share its link." />
        <p className="rounded-xl bg-muted/60 p-4 text-sm">Publish a form first (the step before this one). Its link and website code then appear here.</p>
      </>
    );
  }
  return (
    <>
      <Heading title="Your website" text={`Put "${form.name}" on your website, or share its link in e-mails, messages and social posts.`} />
      <p className="text-sm font-medium">The form&apos;s link</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <input readOnly value={form.link} aria-label="The form's link" className={`${input} mt-0 min-w-0 flex-1 font-mono text-sm`} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(form.link).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className={secondary}
        >
          {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-7 rounded-xl border border-border p-4">
        <p className="text-sm font-medium">Someone else runs your website?</p>
        <p className="mt-0.5 text-sm text-muted-foreground">We&apos;ll e-mail them the code and the instructions.</p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input type="email" required value={to} onChange={(e) => setTo(e.target.value)} placeholder="webmaster@yourschool.edu" aria-label="Their e-mail" className={`${input} mt-0 min-w-0 sm:flex-1`} />
          <button type="submit" disabled={busy} className={secondary}>
            {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Mail aria-hidden="true" className="h-4 w-4" />} Send the code
          </button>
        </form>
        {note && (
          <p role={note.ok ? "status" : "alert"} className={`mt-2 text-sm ${note.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
            {note.text}
          </p>
        )}
      </div>

      <div className="mt-7">
        <p className="mb-2 text-sm font-medium">Or add it yourself</p>
        <EmbedBuilder instituteId={s.instituteId} formId={form.id} formName={form.name} publicEnabled={form.publicEnabled} />
      </div>

      {s.plan?.customDomain && (
        <p className="mt-6 text-sm text-muted-foreground">
          Your plan includes your own address for the form, such as guidance.yourschool.edu. Set it up in{" "}
          <Link href="/institute/guidance" className="font-medium text-cyan-700 hover:underline dark:text-cyan-400">
            Guidance forms
          </Link>
          .
        </p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">{s.inquiries > 0 ? `${s.inquiries} ${s.inquiries === 1 ? "inquiry has" : "inquiries have"} come in so far.` : CHECK_TEXT.website.text}</p>
    </>
  );
}
