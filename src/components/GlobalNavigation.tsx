"use client";

/**
 * The main app header for members (candidates and students), in the same design as the portal headers
 * (components/portal/PortalShell): a top row with the brand, voice minutes, region, theme and account, and a row of
 * section tabs (underlined when current) with a "More" menu that groups the other tools. Small screens get a drawer
 * with the same groups. Hidden on routes with a header of their own (lib/careerNav hidesGlobalNavigation).
 */

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ChevronDown, CreditCard, LogIn, Menu, Mic, Scale, Shield, X } from "lucide-react";
import { AUTH_PROVIDER, AppUserButton, useAppAuth } from "@/lib/appAuth";
import { endDevSession, useDevSession } from "@/lib/devSession";
import { CAN_SIGN_UP, signInHref, signUpHref, useReturnPath } from "@/components/SignInRequired";
import { hidesGlobalNavigation } from "@/lib/careerNav";
import { ProductRegionSwitcher } from "@/context/GeoContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authenticatedFetch } from "@/lib/apiClient";

interface NavItem {
  name: string;
  href: string;
  desc?: string;
}

const TABS: NavItem[] = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Challenges", href: "/sprint/distributed-database" },
  { name: "Exams", href: "/prep/exam" },
  { name: "Interviews", href: "/interview/practice" },
  { name: "Incidents", href: "/daily/incident" },
  { name: "Counselling", href: "/prep/counselling" },
  { name: "Mentoring", href: "/mentors" },
];

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Practice",
    items: [
      { name: "Code review drills", href: "/daily/review", desc: "Find the defect in a real-looking pull request" },
      { name: "System design duels", href: "/duels/arena", desc: "Design against practice bots, graded on the server" },
      { name: "Speaking practice", href: "/prep/delivery", desc: "Pace, filler words and pauses (private)" },
      { name: "Leadership practice", href: "/leadership/simulator", desc: "Hard conversations, scored with feedback" },
      { name: "Failover practice", href: "/practice/failover", desc: "Lead the response to a failing region" },
      { name: "Leaderboard", href: "/leaderboard", desc: "Weekly rankings from graded practice" },
    ],
  },
  {
    title: "Your record",
    items: [
      { name: "My results", href: "/my/results", desc: "Feedback on every submission, reviews and appeals" },
      { name: "Credentials", href: "/credentials", desc: "Signed credentials you can share with employers" },
      { name: "Skill passport", href: "/passport", desc: "Your verified skills and a link to share" },
      { name: "Career path", href: "/prep/career", desc: "Where you are and what to learn next" },
      { name: "Defend your repo", href: "/defend-repo", desc: "Defend code you wrote on GitHub" },
      { name: "Recommendations", href: "/referrals", desc: "Courses for skills to strengthen; you control sharing" },
      { name: "Campus", href: "/campus", desc: "College assignments and connection check" },
    ],
  },
  {
    title: "Account",
    items: [
      { name: "Pricing and minutes", href: "/pricing", desc: "Plans, voice minutes and top-ups" },
      { name: "Privacy and your data", href: "/settings/privacy", desc: "Download or delete your data" },
      { name: "Fairness self-ID", href: "/settings/self-identification", desc: "Optional answers used only for fairness checks" },
      { name: "Transparency report", href: "/transparency", desc: "How our assessments perform, published" },
    ],
  },
];

const HIRING: NavItem[] = [
  { name: "Recruiter portal", href: "/recruiter/dashboard", desc: "Candidates, evidence packs and work trials" },
  { name: "Placement cell", href: "/campus/admin", desc: "Campus placement for colleges" },
];

const isRecruiterRole = (roles: string[]) => roles.some((r) => ["recruiter", "admin", "instituteadmin", "superadmin"].includes(r.toLowerCase()));
const active = (pathname: string | null, href: string) => (href === "/dashboard" ? pathname === href : !!pathname && (pathname === href || pathname.startsWith(href + "/")));

export default function GlobalNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn, roles, getToken } = useAppAuth();
  const dev = useDevSession();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);
  const moreRef = useRef<HTMLLIElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
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
  const groups = isRecruiterRole(roles) ? [...GROUPS, { title: "Hiring", items: HIRING }] : GROUPS;

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

  // Outside click closes "More"; Escape closes either menu and returns focus to its button
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  useEffect(() => {
    if (!moreOpen && !mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (moreOpen) {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
      if (mobileOpen) {
        setMobileOpen(false);
        mobileButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen, mobileOpen]);

  // Close menus on route change
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMoreOpen(false);
    setMobileOpen(false);
  }

  if (hidesGlobalNavigation(pathname)) return null;
  const moreActive = groups.some((g) => g.items.some((i) => active(pathname, i.href)));

  const account = dev ? (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-1 font-medium text-amber-800 dark:text-amber-300">Dev: {dev.label}</span>
      <button
        type="button"
        onClick={() => {
          endDevSession();
          router.push("/login");
        }}
        className="rounded-md border border-border px-2 py-1 font-medium hover:bg-muted"
      >
        End
      </button>
    </span>
  ) : isSignedIn && AUTH_PROVIDER === "keycloak" ? (
    <AppUserButton />
  ) : isSignedIn ? (
    <UserButton appearance={{ elements: { avatarBox: "w-8 h-8 rounded-lg ring-1 ring-border" } }}>
      <UserButton.MenuItems>
        <UserButton.Link label="Pricing and minutes" labelIcon={<CreditCard className="w-4 h-4" />} href="/pricing" />
        <UserButton.Link label="Fairness self-ID" labelIcon={<Scale className="w-4 h-4" />} href="/settings/self-identification" />
      </UserButton.MenuItems>
    </UserButton>
  ) : !isLoaded ? (
    <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
  ) : (
    <div className="flex items-center gap-1.5" data-nav-signed-out>
      <Link href={signInLink} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">
        <LogIn aria-hidden="true" className="h-3.5 w-3.5" /> Sign in
      </Link>
      {CAN_SIGN_UP && (
        <Link href={signUpLink} className="hidden rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted sm:inline-flex">
          Sign up
        </Link>
      )}
    </div>
  );

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-200 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:shadow-lg"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Shield aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Edulexa</span>
          </Link>
          <div className="flex items-center gap-2">
            {isSignedIn && minutes !== null && (
              <Link
                href="/pricing"
                title={`${minutes} voice minutes left`}
                className="hidden items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground md:inline-flex"
              >
                <Mic aria-hidden="true" className="h-3.5 w-3.5" /> {minutes} min left
              </Link>
            )}
            <ProductRegionSwitcher />
            <ThemeToggle />
            <div className="pl-1">{account}</div>
            <button
              ref={mobileButtonRef}
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
              aria-label="Menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <nav aria-label="Main" className="mx-auto hidden max-w-7xl px-2 sm:px-4 lg:block">
          <ul className="-mb-px flex items-center gap-1">
            {TABS.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active(pathname, t.href) ? "page" : undefined}
                  className={`block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                    active(pathname, t.href) ? "border-indigo-600 font-medium text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {t.name}
                </Link>
              </li>
            ))}
            <li className="relative" ref={moreRef}>
              <button
                ref={moreButtonRef}
                type="button"
                aria-expanded={moreOpen}
                aria-controls="more-menu"
                onClick={() => setMoreOpen(!moreOpen)}
                className={`flex items-center gap-1 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  moreActive ? "border-indigo-600 font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                More <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </button>
              {moreOpen && (
                <div id="more-menu" className="absolute left-0 top-full z-100 mt-1 grid w-[min(92vw,720px)] gap-4 rounded-xl border border-border bg-card p-4 shadow-xl sm:grid-cols-3">
                  {groups.map((g) => (
                    <div key={g.title}>
                      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
                      <ul className="mt-1 space-y-0.5">
                        {g.items.map((i) => (
                          <li key={i.href}>
                            <Link
                              href={i.href}
                              onClick={() => setMoreOpen(false)}
                              aria-current={active(pathname, i.href) ? "page" : undefined}
                              className={`block rounded-lg px-2 py-1.5 hover:bg-muted ${active(pathname, i.href) ? "bg-muted" : ""}`}
                            >
                              <span className="block text-sm font-medium">{i.name}</span>
                              {i.desc && <span className="block text-xs text-muted-foreground">{i.desc}</span>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </li>
          </ul>
        </nav>

        {mobileOpen && (
          <nav id="mobile-navigation" aria-label="Main (mobile)" className="max-h-[75vh] space-y-4 overflow-y-auto border-t border-border px-4 py-4 lg:hidden">
            <ul className="grid grid-cols-2 gap-1">
              {TABS.map((t) => (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={active(pathname, t.href) ? "page" : undefined}
                    className={`block rounded-lg px-3 py-2 text-sm ${active(pathname, t.href) ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
            {groups.map((g) => (
              <div key={g.title} className="border-t border-border pt-3">
                <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
                <ul className="mt-1">
                  {g.items.map((i) => (
                    <li key={i.href}>
                      <Link href={i.href} className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                        {i.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
