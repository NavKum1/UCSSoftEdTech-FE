"use client";

/**
 * Home (phase B, 24 Oct 2026). Signed-in members go straight to their dashboard. Visitors see what Edulexa does and can
 * sign in or create an account. No figures, testimonials or partner names: only what the product actually does.
 * (This page used to be a demo console with a fixed user and a sample resume.)
 */

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Code2, Compass, GraduationCap, Mic, ShieldCheck, Terminal } from "lucide-react";
import { useAppAuth } from "@/lib/appAuth";
import { CAN_SIGN_UP } from "@/components/SignInRequired";

const FEATURES = [
  {
    icon: Code2,
    title: "Coding challenges you defend",
    text: "Write real code against hidden tests in your browser, then explain your choices in a short voice conversation.",
  },
  {
    icon: GraduationCap,
    title: "Skills exams with verified credentials",
    text: "Timed exams graded on the server. Pass one and claim a credential anyone can check with its link.",
  },
  {
    icon: Terminal,
    title: "Daily drills",
    text: "A production incident and a code review every day, with the answers explained once you submit.",
  },
  {
    icon: Mic,
    title: "Interview practice",
    text: "Practise technical interviews with an AI interviewer and get feedback afterwards.",
  },
  {
    icon: Compass,
    title: "Career quiz",
    text: "Find the area of tech your interests point to, with the reasons and where to start.",
  },
  {
    icon: BadgeCheck,
    title: "A skill passport you control",
    text: "Your verified results in one place. You decide whether to share it, and you can turn the link off.",
  },
];

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAppAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/dashboard");
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn)
    return <main className="mx-auto max-w-5xl px-4 py-24" aria-busy="true" aria-label="Loading" />;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-16 sm:px-6">
      <section className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Edulexa</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Show what you can build, and explain how it works.</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Practise real engineering work, get graded on it fairly, and turn the results into credentials people can verify.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {CAN_SIGN_UP && (
            <Link
              href="/login?mode=signup&redirect_url=%2Fdashboard"
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Create a free account
            </Link>
          )}
          <Link href="/login?redirect_url=%2Fdashboard" className="rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-muted">
            Sign in
          </Link>
        </div>
      </section>

      <section aria-label="What you can do" className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-5">
            <Icon aria-hidden="true" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        <Link href="/verify" className="rounded-2xl border border-border p-5 hover:border-indigo-400">
          <ShieldCheck aria-hidden="true" className="h-5 w-5 text-emerald-600" />
          <h2 className="mt-3 font-semibold">Check a credential</h2>
          <p className="mt-1 text-sm text-muted-foreground">Employers and schools can verify an Edulexa credential from its link.</p>
        </Link>
        <Link href="/pricing" className="rounded-2xl border border-border p-5 hover:border-indigo-400">
          <h2 className="font-semibold">Plans</h2>
          <p className="mt-1 text-sm text-muted-foreground">What&apos;s free and what&apos;s included in each plan.</p>
        </Link>
        <Link href="/free" className="rounded-2xl border border-border p-5 hover:border-indigo-400">
          <h2 className="font-semibold">Free for students</h2>
          <p className="mt-1 text-sm text-muted-foreground">See whether the free student plan is offered where you are.</p>
        </Link>
      </section>
    </main>
  );
}
