"use client";

/**
 * Self-serve sign-up for schools and colleges (plan item S1, 1 Nov 2026): /start. Five steps: the school's country and
 * kind (a country hosted in another region continues there), a plan, an account (Keycloak registration or sign-in), the
 * school's details, then the payment method with the provider (Stripe Checkout, or Razorpay Checkout in India): 30 days
 * free, nothing charged today. The choices are kept in this tab (sessionStorage) across the sign-in round trip.
 */
import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Loader2, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { keycloakSignIn, useAppAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { openRazorpayCheckout, type RazorpayStart } from "@/lib/razorpayCheckout";
import { SCHOOL_KINDS, countryList, type SchoolKind } from "@/lib/schoolKinds";
import { useEn } from "@/lib/english/EnglishProvider";

type Kind = SchoolKind;
interface Plan {
  key: string;
  name: string;
  summary: string;
  includes: string[];
  monthMinor: number;
  yearMinor: number;
}
interface Plans {
  country: string;
  currency: "USD" | "INR";
  provider: "stripe" | "razorpay";
  region: string;
  regionUrl: string | null;
  trialDays: number;
  timeZone: string;
  plans: Plan[];
}
interface Draft {
  step: number;
  country: string;
  kind: Kind | "";
  plan: string;
  interval: "month" | "year";
  schoolName: string;
  website: string;
  size: string;
  timeZone: string;
  slug: string;
}

const KEY = "edulexa.start";
const EMPTY: Draft = { step: 1, country: "", kind: "", plan: "Growth", interval: "month", schoolName: "", website: "", size: "", timeZone: "", slug: "" };
const KINDS = SCHOOL_KINDS.map((k) => (k.value === "other" ? { ...k, text: "Tell us more after you sign up" } : k));
const SIZES = [
  ["under-100", "Under 100 students"],
  ["100-500", "100 to 500"],
  ["500-2000", "500 to 2,000"],
  ["2000-10000", "2,000 to 10,000"],
  ["over-10000", "Over 10,000"],
];
const STEPS = ["Your school", "Plan", "Account", "Details", "Start your trial"];
// ISO 3166-1 alpha-2 codes; names come from Intl.DisplayNames

const noSubscribe = () => () => {};
const load = (): Draft => {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
};
const money = (minor: number, currency: string) =>
  new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
const slugOf = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export default function StartPage() {
  // The draft lives in this tab's storage, so the page renders on the client only
  const client = useSyncExternalStore(noSubscribe, () => true, () => false);
  return client ? <Wizard /> : <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
}

function Wizard() {
  const en = useEn();
  const { isSignedIn, isLoaded, getToken } = useAppAuth();
  const router = useRouter();
  const [d, setD] = useState<Draft>(load);
  const [plans, setPlans] = useState<Plans | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugFree, setSlugFree] = useState<boolean | null>(null);

  const update = useCallback((patch: Partial<Draft>) => {
    setD((prev) => {
      const next = { ...prev, ...patch };
      try {
        sessionStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // storage blocked: the draft lives as long as the page
      }
      return next;
    });
  }, []);

  const countries = useMemo(() => countryList(), []);
  const timeZones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      return ["UTC"];
    }
  }, []);

  const fetchPlans = useCallback(async (country: string) => {
    const res = await authenticatedFetch(`/api/signup/plans?country=${encodeURIComponent(country)}`);
    if (!res.ok) throw new Error("The plans couldn't be loaded. Please try again.");
    return (await res.json()) as Plans;
  }, []);

  // Back from the sign-in, or a reload: the plans for the chosen country again
  useEffect(() => {
    if (!d.country || plans) return;
    let live = true;
    fetchPlans(d.country)
      .then((p) => live && setPlans(p))
      .catch(() => live && setError("The plans couldn't be loaded. Please try again."));
    return () => {
      live = false;
    };
  }, [d.country, plans, fetchPlans]);

  // Signed in now: the account step is done
  const step = d.step === 3 && isSignedIn ? 4 : d.step;

  const go = (next: number) => {
    setError(null);
    update({ step: next });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseSchool = async () => {
    if (!d.country || !d.kind) return setError(en("Choose your country and what kind of organisation you are."));
    setBusy(true);
    try {
      const p = await fetchPlans(d.country);
      setPlans(p);
      if (!d.timeZone) update({ timeZone: p.timeZone });
      if (!p.regionUrl) go(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const checkSlug = async (value: string) => {
    if (!value || !isSignedIn) return setSlugFree(null);
    const res = await authenticatedFetch(`/api/signup/slug?value=${encodeURIComponent(value)}`, {}, getToken);
    setSlugFree(res.ok ? Boolean((await res.json()).available) : null);
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await authenticatedFetch(
        "/api/signup",
        {
          method: "POST",
          body: JSON.stringify({
            country: d.country,
            kind: d.kind,
            schoolName: d.schoolName,
            website: d.website || null,
            size: d.size,
            timeZone: d.timeZone,
            slug: d.slug,
            plan: d.plan,
            interval: d.interval,
          }),
        },
        getToken,
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Your school couldn't be set up. Please try again.");
      const checkout = body.checkout as { provider: string; url: string | null; razorpay: RazorpayStart | null };
      if (checkout.provider === "stripe" && checkout.url) {
        window.location.assign(checkout.url);
        return;
      }
      if (checkout.razorpay) await openRazorpay(body.signupId, checkout.razorpay);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  const openRazorpay = (signupId: string, rzp: RazorpayStart) =>
    openRazorpayCheckout({
      signupId,
      start: rzp,
      description: `${rzp.name}: 30 days free, then your plan`,
      getToken,
      onDone: () => router.push(`/start/done?signup=${signupId}`),
      onClose: () => setBusy(false),
    });

  const plan = plans?.plans.find((p) => p.key === d.plan);
  const price = (p: Plan) => money(d.interval === "year" ? p.yearMinor : p.monthMinor, plans?.currency ?? "USD");
  const per = d.interval === "year" ? "a year" : "a month";
  const country = countries.find((c) => c.code === d.country)?.name;
  const input = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const primary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-[15px] font-semibold text-white shadow-[0_8px_24px_-10px_rgb(79_70_229/0.8)] transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:grid lg:grid-cols-[minmax(320px,400px)_1fr]">
      {/* The steps, and what to expect */}
      <aside className="relative hidden overflow-hidden bg-[#1e1b4b] px-10 py-12 text-indigo-50 lg:block">
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5 text-lg font-semibold text-white">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-400 to-violet-600 ring-1 ring-white/20">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            Edulexa
          </Link>
          <h1 className="mt-14 text-[2rem] font-semibold leading-tight tracking-tight text-white">Set up your school in about five minutes</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-indigo-100/80">Guidance forms, admissions CRM and career services for your students, ready to use today.</p>
          <ol className="mt-10 space-y-1">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const now = n === step;
              return (
                <li key={label} aria-current={now ? "step" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${now ? "bg-white/10" : ""}`}>
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      done ? "bg-emerald-400 text-emerald-950" : now ? "bg-white text-indigo-900" : "border border-white/25 text-indigo-100/70"
                    }`}
                  >
                    {done ? <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} /> : n}
                  </span>
                  <span className={now ? "font-medium text-white" : done ? "text-indigo-100" : "text-indigo-100/60"}>{label}</span>
                </li>
              );
            })}
          </ol>
          <ul className="mt-12 space-y-3 border-t border-white/10 pt-8 text-sm text-indigo-100/85">
            {["30 days free on any plan", "Nothing is charged today", "Cancel any time from Billing"].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <Check aria-hidden="true" className="h-4 w-4 text-emerald-300" strokeWidth={3} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 lg:py-14">
        {/* Phones: a compact progress line instead of the panel */}
        <div className="mb-6 lg:hidden">
          <Link href="/" className="text-base font-semibold">
            Edulexa
          </Link>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Step {step} of 5: {STEPS[step - 1]}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(step / 5) * 100}%` }} />
          </div>
        </div>

        {step > 1 && (
          <button type="button" onClick={() => go(step === 4 && isSignedIn ? 2 : step - 1)} className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Back
          </button>
        )}

        {step === 1 && (
          <section aria-labelledby="s1">
            <h2 id="s1" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Tell us about your school
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">Your country decides your currency and where your school&apos;s data is kept.</p>
            <label className="mt-8 block text-sm font-medium">
              Country
              <select className={input} value={d.country} onChange={(e) => {
                  setPlans(null);
                  update({ country: e.target.value, timeZone: "" });
                }}>
                <option value="">Choose your country</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="mt-7">
              <legend className="text-sm font-medium">{en("What kind of organisation are you?")}</legend>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                {KINDS.map((k) => (
                  <label
                    key={k.value}
                    className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                      d.kind === k.value ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600 dark:bg-indigo-950/40" : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <input type="radio" name="kind" className="mt-1 accent-indigo-600" checked={d.kind === k.value} onChange={() => update({ kind: k.value })} />
                    <span>
                      <span className="block font-medium">{en(k.label)}</span>
                      <span className="block text-sm text-slate-500 dark:text-slate-400">{en(k.text)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {plans?.regionUrl && plans.country === d.country && (
              <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950/40">
                <p className="font-medium">Schools in {country} are hosted in our {plans.region === "US" ? "Americas" : plans.region === "IN" ? "India" : plans.region} region.</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Your school will be set up there, so its data stays in that region.</p>
                <a className={`${primary} mt-4`} href={`${plans.regionUrl}/start`}>
                  Continue there
                </a>
              </div>
            )}
            <div className="mt-8">
              <button type="button" className={primary} disabled={busy} onClick={chooseSchool}>
                {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />} Continue
              </button>
            </div>
          </section>
        )}

        {step === 2 && plans && (
          <section aria-labelledby="s2">
            <h2 id="s2" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Choose a plan
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">Every plan starts with {plans.trialDays} days free. You can change it any time.</p>
            <div role="radiogroup" aria-label="Billing period" className="mt-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
              {(["month", "year"] as const).map((i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={d.interval === i}
                  onClick={() => update({ interval: i })}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${d.interval === i ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-400"}`}
                >
                  {i === "month" ? "Monthly" : "Yearly: 2 months free"}
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-3">
              {plans.plans.map((p) => (
                <label
                  key={p.key}
                  className={`block cursor-pointer rounded-2xl border p-5 transition ${
                    d.plan === p.key ? "border-indigo-600 bg-white ring-2 ring-indigo-600 dark:bg-slate-900" : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                  }`}
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="flex items-center gap-2.5">
                      <input type="radio" name="plan" className="accent-indigo-600" checked={d.plan === p.key} onChange={() => update({ plan: p.key })} />
                      <span className="text-lg font-semibold">{p.name}</span>
                    </span>
                    <span>
                      <span className="text-2xl font-semibold tracking-tight">{price(p)}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400"> {per}</span>
                    </span>
                  </span>
                  <span className="mt-1 block pl-6 text-sm text-slate-600 dark:text-slate-400">{p.summary}</span>
                  <ul className="mt-3 grid gap-1.5 pl-6 text-sm sm:grid-cols-2">
                    {p.includes.map((x) => (
                      <li key={x} className="flex gap-2">
                        <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={3} />
                        {x}
                      </li>
                    ))}
                  </ul>
                </label>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{en("Universities and districts: contact us for an annual licence.")}</p>
            <div className="mt-8">
              <button type="button" className={primary} onClick={() => go(isSignedIn ? 4 : 3)}>
                Continue with {plan?.name ?? "this plan"}
              </button>
            </div>
          </section>
        )}

        {step === 3 && !isSignedIn && (
          <section aria-labelledby="s3">
            <h2 id="s3" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Create your account
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">You&apos;ll be your school&apos;s administrator. We&apos;ll ask you to confirm your e-mail address.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" className={primary} disabled={!isLoaded} onClick={() => void keycloakSignIn("/start", { signUp: true })}>
                Create my account
              </button>
              <button
                type="button"
                disabled={!isLoaded}
                onClick={() => void keycloakSignIn("/start")}
                className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-[15px] font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                I already have one
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section aria-labelledby="s4">
            <h2 id="s4" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Your school&apos;s details
            </h2>
            <form
              className="mt-8 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!d.schoolName.trim() || !d.size || !d.slug) return setError("Fill in your school's name, its size and its web address.");
                go(5);
              }}
            >
              <label className="block text-sm font-medium">
                School name
                <input
                  className={input}
                  required
                  maxLength={120}
                  value={d.schoolName}
                  onChange={(e) => update({ schoolName: e.target.value, slug: d.slug && d.slug !== slugOf(d.schoolName) ? d.slug : slugOf(e.target.value) })}
                />
              </label>
              <label className="block text-sm font-medium">
                Website <span className="font-normal text-slate-500">(optional)</span>
                <input className={input} maxLength={300} value={d.website} placeholder="yourschool.edu" onChange={(e) => update({ website: e.target.value })} />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Number of students
                  <select className={input} required value={d.size} onChange={(e) => update({ size: e.target.value })}>
                    <option value="">Choose</option>
                    {SIZES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Time zone
                  <select className={input} value={d.timeZone || plans?.timeZone || "UTC"} onChange={(e) => update({ timeZone: e.target.value })}>
                    {timeZones.map((z) => (
                      <option key={z} value={z}>
                        {z.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-medium">
                Web address for your forms
                <span className="mt-1.5 flex items-stretch overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-600/15 dark:border-slate-700 dark:bg-slate-900">
                  <input
                    className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-[15px] outline-none"
                    required
                    maxLength={50}
                    value={d.slug}
                    onChange={(e) => {
                      setSlugFree(null);
                      update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") });
                    }}
                    onBlur={(e) => void checkSlug(e.target.value)}
                  />
                  <span className="flex items-center border-l border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">.edulexa.com</span>
                </span>
                {slugFree === false && <span className="mt-1.5 block text-sm font-normal text-red-700 dark:text-red-400">That address is taken. Try another.</span>}
                {slugFree === true && <span className="mt-1.5 block text-sm font-normal text-emerald-700 dark:text-emerald-400">Available</span>}
              </label>
              <button type="submit" className={primary} disabled={slugFree === false}>
                Continue
              </button>
            </form>
          </section>
        )}

        {step === 5 && plans && plan && (
          <section aria-labelledby="s5">
            <h2 id="s5" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Start your free trial
            </h2>
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <dl className="grid gap-4 text-[15px] sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-slate-500">School</dt>
                  <dd className="font-medium">{d.schoolName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Web address</dt>
                  <dd className="font-medium">{d.slug}.edulexa.com</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Plan</dt>
                  <dd className="font-medium">
                    {plan.name}, {price(plan)} {per}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Today</dt>
                  <dd className="font-medium text-emerald-700 dark:text-emerald-400">Nothing to pay</dd>
                </div>
              </dl>
              <p className="mt-5 flex gap-2.5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                Your {plans.trialDays}-day trial starts now. We&apos;ll remind you 7 days before it ends. If you keep the plan, the first payment of {price(plan)} is taken on day{" "}
                {plans.trialDays + 1}; cancel before then and you won&apos;t be charged.
              </p>
            </div>
            <button type="button" className={`${primary} mt-8 w-full sm:w-auto`} disabled={busy} onClick={start}>
              {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Lock aria-hidden="true" className="h-4 w-4" />}
              {plans.provider === "razorpay" ? "Add card or UPI and start" : "Add a card and start"}
            </button>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Payment details are handled by {plans.provider === "razorpay" ? "Razorpay" : "Stripe"}; Edulexa never sees your card number.
            </p>
          </section>
        )}

        {error && (
          <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
