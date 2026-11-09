"use client";

/**
 * The main app header for members (candidates and students), in the same design as the portal headers
 * (components/portal/PortalShell): a top row with the brand, voice minutes and the shared controls (language,
 * light/dark, the account menu), and a row with Dashboard and three menus (5 Nov 2026: Practice, Guidance and Your
 * record replaced seven tabs and a "More" menu of eighteen). 7 Nov 2026: the menus open when the mouse points at them,
 * their pages are grouped by what the person wants to do, and the current menu's pages show as a bar under the header,
 * so every page is one click away (components/layout/SectionNav). Account pages live in the account menu, and so do the
 * other areas a person works in ("Switch to"). Small screens get a drawer with the same groups. Hidden on routes with a
 * header of their own (lib/careerNav hidesGlobalNavigation).
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, LogIn, Menu, Mic, Scale, ShieldCheck, X } from "lucide-react";
import { useAppAuth } from "@/lib/appAuth";
import { CAN_SIGN_UP, signInHref, signUpHref, useReturnPath } from "@/components/SignInRequired";
import { hidesGlobalNavigation } from "@/lib/careerNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import EnglishPicker from "@/components/EnglishPicker";
import { useEn } from "@/lib/english/EnglishProvider";
import { FRAME } from "@/components/layout/Frame";
import { HeaderControls, type AccountLink } from "@/components/layout/AccountMenu";
import BrandMark from "@/components/brand/BrandMark";
import { authenticatedFetch } from "@/lib/apiClient";
import { SectionBar, SectionDrawerList, SectionTabs, findCurrent, type NavTab } from "@/components/layout/SectionNav";

// en() where shown. Menus grouped by what the person wants to do (7 Nov 2026); every page is one click away: menus open
// when the mouse points at them, and the current menu's pages show as a bar under the header (components/layout/SectionNav)
const MENUS: NavTab[] = [
  {
    key: "practice",
    label: "Practice",
    pages: [
      { sub: "Interviews", label: "Interview practice", href: "/interview/practice", desc: "A spoken interview with an AI interviewer" },
      { sub: "Interviews", label: "Speaking practice", short: "Speaking", href: "/prep/delivery", desc: "Pace, filler words and pauses (private)" },
      { sub: "Interviews", label: "Leadership practice", short: "Leadership", href: "/leadership/simulator", desc: "Hard conversations, scored with feedback" },
      { sub: "Engineering drills", label: "Code review drills", short: "Code review", href: "/daily/review", desc: "Find the defect in a real-looking pull request" },
      { sub: "Engineering drills", label: "Incident drills", short: "Incidents", href: "/daily/incident", desc: "Find and fix a production problem" },
      { sub: "Engineering drills", label: "Failover practice", short: "Failover", href: "/practice/failover", desc: "Lead the response to a failing region" },
      { sub: "Engineering drills", label: "System design duels", short: "System design", href: "/duels/arena", desc: "Design against practice bots, graded on the server" },
      { sub: "Prove your skills", label: "Coding challenges", href: "/sprint/distributed-database", match: ["/sprint"], desc: "Build a feature, then explain your code" },
      { sub: "Prove your skills", label: "Written exams", href: "/prep/exam", desc: "Timed exams; pass one to earn a credential" },
      { sub: "Prove your skills", label: "Defend your repo", href: "/defend-repo", desc: "Defend code you wrote on GitHub" },
      { label: "Leaderboard", href: "/leaderboard", desc: "How you rank in drills and verified challenges" },
      { label: "My results", href: "/my/results", shortcut: true, desc: "Feedback on every attempt, reviews and appeals" },
    ],
  },
  {
    key: "guidance",
    label: "Guidance",
    pages: [
      { sub: "Find your direction", label: "Counseling quiz", href: "/prep/counselling", desc: "A short quiz that matches you to a career track" },
      { sub: "Find your direction", label: "Career path", href: "/prep/career", desc: "Where you are and what to learn next" },
      { sub: "Find your direction", label: "Recommendations", href: "/referrals", desc: "Courses for skills to strengthen; you control sharing" },
      { sub: "Talk to someone", label: "Mentoring", href: "/mentors", desc: "Find a mentor, or volunteer as one; free" },
      { sub: "Talk to someone", label: "My guidance requests", href: "/my/guidance", desc: "Your questions to Edulexa and the replies" },
    ],
  },
  {
    key: "record",
    label: "Your record",
    pages: [
      { label: "My results", href: "/my/results", desc: "Feedback on every submission, reviews and appeals" },
      { label: "Credentials", href: "/credentials", desc: "Signed credentials you can share with employers" },
      { label: "Skill passport", href: "/passport", desc: "Your verified skills and a link to share" },
      { label: "Résumés", href: "/resumes", desc: "Your résumés in one place, ready to send" },
      { label: "Job check", href: "/resumes/job-check", desc: "See where your résumé meets a job's requirements" },
      { label: "Campus", href: "/campus", desc: "College assignments and connection check" },
    ],
  },
];

const icon = "h-4 w-4 text-muted-foreground";
const ACCOUNT_LINKS: AccountLink[] = [
  { label: "Pricing and minutes", href: "/pricing", icon: <CreditCard aria-hidden="true" className={icon} /> },
  { label: "Privacy and your data", href: "/settings/privacy", icon: <ShieldCheck aria-hidden="true" className={icon} /> },
  { label: "Fairness self-ID", href: "/settings/self-identification", icon: <Scale aria-hidden="true" className={icon} /> },
  { label: "Transparency report", href: "/transparency", icon: <BarChart3 aria-hidden="true" className={icon} /> },
];

const TABS: NavTab[] = [{ key: "dashboard", label: "Dashboard", pages: [{ label: "Dashboard", href: "/dashboard" }] }, ...MENUS];

export default function GlobalNavigation() {
  const en = useEn();
  const pathname = usePathname();
  const { isLoaded, isSignedIn, getToken } = useAppAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);

  // Signed out: Sign in / Sign up return to this page. On the sign-in page itself, keep its own redirect_url.
  const returnPath = useReturnPath();
  const onLoginPage = pathname === "/login" || !!pathname?.startsWith("/login/");
  const loginRedirect = onLoginPage
    ? (() => {
        const q = returnPath.indexOf("?");
        return q >= 0 ? new URLSearchParams(returnPath.slice(q)).get("redirect_url") : null;
      })()
    : returnPath;
  const signInLink = loginRedirect ? signInHref(loginRedirect) : "/login";
  const signUpLink = signUpHref(loginRedirect || "/dashboard");

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    authenticatedFetch("/api/billing/usage", {}, getToken)
      .then((res) => (res.ok ? (res.json() as Promise<{ remainingMinutes: number }>) : null))
      .then((usage) => {
        if (!cancelled && usage) setMinutes(usage.remainingMinutes);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, pathname]);

  // Escape closes the phone menu and returns focus to its button (SectionTabs handles its own menus)
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMobileOpen(false);
      mobileButtonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const tabs = useMemo(
    () =>
      TABS.map((t) => ({
        ...t,
        label: en(t.label),
        pages: t.pages.map((p) => ({ ...p, label: en(p.label), short: p.short && en(p.short), desc: p.desc && en(p.desc), sub: p.sub && en(p.sub) })),
      })),
    [en],
  );
  const { tab: currentTab, page: currentPage } = findCurrent(tabs, pathname, ["/dashboard"]);

  // Close menus on route change
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  if (hidesGlobalNavigation(pathname)) return null;

  const signedOut = (
    <div className="flex items-center gap-1.5" data-nav-signed-out>
      <Link href={signInLink} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-foreground,#fff)] hover:opacity-90">
        <LogIn aria-hidden="true" className="h-3.5 w-3.5" />
        {en("Sign in")}
      </Link>
      {CAN_SIGN_UP && (
        <Link href={signUpLink} className="hidden rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted sm:inline-flex">
          {en("Sign up")}
        </Link>
      )}
    </div>
  );

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-200 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:shadow-lg"
      >
        {en("Skip to content")}
      </a>
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
        <div className={`${FRAME} flex h-14 items-center justify-between gap-3`}>
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-2">
            {isSignedIn && minutes !== null && (
              <Link
                href="/pricing"
                title={en("{minutes} voice minutes left", { minutes })}
                className="hidden items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground md:inline-flex"
              >
                <Mic aria-hidden="true" className="h-3.5 w-3.5" />
                {en("{minutes} min left", { minutes })}
              </Link>
            )}
            {isSignedIn ? (
              <HeaderControls links={ACCOUNT_LINKS} area="/dashboard" />
            ) : !isLoaded ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" aria-hidden="true" />
            ) : (
              <>
                <EnglishPicker className="hidden md:inline-flex" />
                <span className="hidden sm:inline-flex">
                  <ThemeToggle />
                </span>
                {signedOut}
              </>
            )}
            <button
              ref={mobileButtonRef}
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
              aria-label={en("Menu")}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <SectionTabs tabs={tabs} current={currentPage} label={en("Main")} className={`${FRAME} hidden !px-1 sm:!px-3 lg:block`} />

        {mobileOpen && (
          <nav id="mobile-navigation" aria-label={en("Main (mobile)")} className="max-h-[75vh] space-y-3 overflow-y-auto border-t border-border px-4 py-4 lg:hidden">
            <div className="flex flex-wrap items-center gap-2 sm:hidden">
              <EnglishPicker />
              {!isSignedIn && <ThemeToggle />}
            </div>
            <SectionDrawerList tabs={tabs} current={currentPage} onNavigate={() => setMobileOpen(false)} />
            {!isSignedIn && isLoaded && <div className="border-t border-border pt-3">{signedOut}</div>}
          </nav>
        )}
      </header>
      <SectionBar tabs={tabs} tab={currentTab} current={currentPage} />
    </>
  );
}
