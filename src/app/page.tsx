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
import { useEn } from "@/lib/english/EnglishProvider";
import { brandFill, buttonClass } from "@/components/career/ui";

const FEATURES = [
  {
    icon: Code2,
    title: "Coding challenges you defend",
    text: "Write real code against hidden tests in your browser, then explain your choices in a short voice conversation.",
  },
  {
    icon: GraduationCap,
    title: "Skills exams with verified credentials",
    text: "Timed exams graded by Edulexa. Pass one and claim a credential anyone can check with its link.",
  },
  {
    icon: Terminal,
    title: "Daily drills",
    text: "A production incident and a code review every day, with the answers explained once you submit.",
  },
  {
    icon: Mic,
    title: "Interview practice",
    text: "Practise technical interviews with an AI interviewer and get feedback afterwards." /* en() where shown */,
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
  const en = useEn();
  const { isLoaded, isSignedIn } = useAppAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/dashboard");
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn)
    return <div className="py-16" aria-busy="true" aria-label={en("Loading")} />;

  return (
    <div className="pt-8">
      <section className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{en("Show what you can build, and explain how it works.")}</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {en("Practise real engineering work, get graded on it fairly, and turn the results into credentials people can verify.")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {CAN_SIGN_UP && (
            <Link href="/login?mode=signup&redirect_url=%2Fdashboard" className={`${buttonClass("primary")} h-11 px-5`} style={brandFill}>
              {en("Create a free account")}
            </Link>
          )}
          <Link href="/login?redirect_url=%2Fdashboard" className={`${buttonClass("secondary")} h-11 px-5`}>
            {en("Sign in")}
          </Link>
        </div>
      </section>

      <section aria-label={en("What you can do")} className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Icon aria-hidden="true" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="mt-3 font-semibold">{en(title)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{en(text)}</p>
          </div>
        ))}
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        <Link href="/verify" className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-indigo-400">
          <ShieldCheck aria-hidden="true" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="mt-3 font-semibold">{en("Check a credential")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{en("Employers and schools can verify an Edulexa credential from its link.")}</p>
        </Link>
        <Link href="/pricing" className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-indigo-400">
          <h2 className="font-semibold">{en("Plans")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{en("What's free and what's included in each plan.")}</p>
        </Link>
        {/* P3 (5 Nov 2026): schools sign up here (the free student plan is switched off) */}
        <Link href="/start" className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-indigo-400">
          <h2 className="font-semibold">{en("For schools and colleges")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{en("Start a 30-day free trial and set up your school in a few minutes.")}</p>
        </Link>
      </section>
    </div>
  );
}
