"use client";

/**
 * The main app header for members (candidates and students), in the same design as the portal headers
 * (components/portal/PortalShell): a top row with the brand, voice minutes, region and the shared controls (language,
 * light/dark, the account menu), and a row with Dashboard and three menus (5 Nov 2026: Practice, Guidance and Your
 * record replaced seven tabs and a "More" menu of eighteen). Account pages live in the account menu, and so do the
 * other areas a person works in ("Switch to"). Small screens get a drawer with the same groups. Hidden on routes with a
 * header of their own (lib/careerNav hidesGlobalNavigation).
 */

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ChevronDown, CreditCard, LogIn, Menu, Mic, Scale, ShieldCheck, X } from "lucide-react";
import { useAppAuth } from "@/lib/appAuth";
import { CAN_SIGN_UP, signInHref, signUpHref, useReturnPath } from "@/components/SignInRequired";
import { hidesGlobalNavigation } from "@/lib/careerNav";
import { ProductRegionSwitcher } from "@/context/GeoContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import EnglishPicker from "@/components/EnglishPicker";
import { useEn } from "@/lib/english/EnglishProvider";
import { FRAME } from "@/components/layout/Frame";
import { HeaderControls, type AccountLink } from "@/components/layout/AccountMenu";
import BrandMark from "@/components/brand/BrandMark";
import { authenticatedFetch } from "@/lib/apiClient";

interface NavItem {
  name: string;
  href: string;
  desc?: string;
}

const MENUS: { id: string; title: string; wide?: boolean; items: NavItem[] }[] = [
  {
    id: "practice",
    title: "Practice",
    wide: true,
    items: [
      { name: "Coding challenges", href: "/sprint/distributed-database", desc: "Build a feature, then explain your code" },
      { name: "Written exams", href: "/prep/exam", desc: "Timed exams; pass one to earn a credential" },
      { name: "Interview practice", href: "/interview/practice", desc: "A spoken interview with an AI interviewer" },
      { name: "Incident drills", href: "/daily/incident", desc: "Find and fix a production problem" },
      { name: "Code review drills", href: "/daily/review", desc: "Find the defect in a real-looking pull request" },
      { name: "System design duels", href: "/duels/arena", desc: "Design against practice bots, graded on the server" },
      { name: "Speaking practice", href: "/prep/delivery", desc: "Pace, filler words and pauses (private)" },
      { name: "Leadership practice", href: "/leadership/simulator", desc: "Hard conversations, scored with feedback" },
      { name: "Failover practice", href: "/practice/failover", desc: "Lead the response to a failing region" },
      { name: "Leaderboard", href: "/leaderboard", desc: "Weekly rankings from graded practice" },
    ],
  },
  {
    id: "guidance",
    title: "Guidance",
    items: [
      { name: "Counseling", href: "/prep/counselling", desc: "A short quiz that matches you to a career track" },
      { name: "Mentoring", href: "/mentors", desc: "Find a mentor, or volunteer as one; free" },
      { name: "Career path", href: "/prep/career", desc: "Where you are and what to learn next" },
      { name: "Recommendations", href: "/referrals", desc: "Courses for skills to strengthen; you control sharing" },
      { name: "My guidance requests", href: "/my/guidance", desc: "Your questions to Edulexa and the replies" },
    ],
  },
  {
    id: "record",
    title: "Your record",
    items: [
      { name: "My results", href: "/my/results", desc: "Feedback on every submission, reviews and appeals" },
      { name: "Credentials", href: "/credentials", desc: "Signed credentials you can share with employers" },
      { name: "Skill passport", href: "/passport", desc: "Your verified skills and a link to share" },
      { name: "Defend your repo", href: "/defend-repo", desc: "Defend code you wrote on GitHub" },
      { name: "Campus", href: "/campus", desc: "College assignments and connection check" },
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

const active = (pathname: string | null, href: string) => (href === "/dashboard" ? pathname === href : !!pathname && (pathname === href || pathname.startsWith(href + "/")));
const tab = (on: boolean) =>
  `flex items-center gap-1 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
    on ? "border-[var(--brand)] font-medium text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
  }`;

export default function GlobalNavigation() {
  const en = useEn();
  const pathname = usePathname();
  const { isLoaded, isSignedIn, getToken } = useAppAuth();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);
  const navRef = useRef<HTMLUListElement>(null);
  const menuButtons = useRef<Record<string, HTMLButtonElement | null>>({});
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

  // Outside click closes an open menu; Escape closes it (or the drawer) and returns focus to its button
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  useEffect(() => {
    if (!openMenu && !mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openMenu) {
        menuButtons.current[openMenu]?.focus();
        setOpenMenu(null);
      }
      if (mobileOpen) {
        setMobileOpen(false);
        mobileButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openMenu, mobileOpen]);

  // Close menus on route change
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpenMenu(null);
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
            <span className="hidden sm:inline-flex">
              <ProductRegionSwitcher />
            </span>
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

        <nav aria-label={en("Main")} className={`${FRAME} hidden !px-1 sm:!px-3 lg:block`}>
          <ul ref={navRef} className="-mb-px flex items-center gap-1">
            <li>
              <Link href="/dashboard" aria-current={active(pathname, "/dashboard") ? "page" : undefined} className={tab(active(pathname, "/dashboard"))}>
                {en("Dashboard")}
              </Link>
            </li>
            {MENUS.map((m) => {
              const open = openMenu === m.id;
              const here = m.items.some((i) => active(pathname, i.href));
              return (
                <li key={m.id} className="relative">
                  <button
                    ref={(el) => {
                      menuButtons.current[m.id] = el;
                    }}
                    type="button"
                    aria-expanded={open}
                    aria-controls={`nav-menu-${m.id}`}
                    onClick={() => setOpenMenu(open ? null : m.id)}
                    className={tab(here)}
                  >
                    {en(m.title)}
                    <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div
                      id={`nav-menu-${m.id}`}
                      className={`absolute start-0 top-full z-100 mt-1 rounded-xl border border-border bg-card p-2 shadow-xl ${m.wide ? "w-[min(92vw,640px)]" : "w-80"}`}
                    >
                      <ul className={m.wide ? "grid grid-cols-2 gap-x-2" : ""}>
                        {m.items.map((i) => (
                          <li key={i.href}>
                            <Link
                              href={i.href}
                              onClick={() => setOpenMenu(null)}
                              aria-current={active(pathname, i.href) ? "page" : undefined}
                              className={`block rounded-lg px-3 py-2 hover:bg-muted ${active(pathname, i.href) ? "bg-muted" : ""}`}
                            >
                              <span className="block text-sm font-medium text-foreground">{en(i.name)}</span>
                              {i.desc && <span className="block text-xs text-muted-foreground">{en(i.desc)}</span>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {mobileOpen && (
          <nav id="mobile-navigation" aria-label={en("Main (mobile)")} className="max-h-[75vh] space-y-3 overflow-y-auto border-t border-border px-4 py-4 lg:hidden">
            <div className="flex flex-wrap items-center gap-2 sm:hidden">
              <ProductRegionSwitcher />
              <EnglishPicker />
              {!isSignedIn && <ThemeToggle />}
            </div>
            <Link
              href="/dashboard"
              aria-current={active(pathname, "/dashboard") ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-sm ${active(pathname, "/dashboard") ? "bg-muted font-medium" : "text-foreground hover:bg-muted"}`}
            >
              {en("Dashboard")}
            </Link>
            {MENUS.map((m) => (
              <div key={m.id} className="border-t border-border pt-3">
                <p className="px-3 text-xs font-medium text-muted-foreground">{en(m.title)}</p>
                <ul className="mt-1 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                  {m.items.map((i) => (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        aria-current={active(pathname, i.href) ? "page" : undefined}
                        className={`block rounded-lg px-3 py-2 text-sm ${active(pathname, i.href) ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                      >
                        {en(i.name)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!isSignedIn && isLoaded && <div className="border-t border-border pt-3">{signedOut}</div>}
          </nav>
        )}
      </header>
    </>
  );
}
