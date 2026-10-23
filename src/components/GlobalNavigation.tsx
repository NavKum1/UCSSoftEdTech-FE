"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { AUTH_PROVIDER, AppUserButton, useAppAuth } from "@/lib/appAuth";
import { CAN_SIGN_UP, signInHref, signUpHref, useReturnPath } from "@/components/SignInRequired";
import { hidesGlobalNavigation } from "@/lib/careerNav";
import {
  Shield,
  Flame,
  Mic,
  Compass,
  Award,
  ChevronDown,
  Layers,
  Swords,
  CalendarCheck,
  GraduationCap,
  Sparkles,
  Trophy,
  Menu,
  X,
  LogIn,
  ShieldCheck,
  LayoutDashboard,
  GitBranch,
  BookOpen,
  CreditCard,
  Scale,
  FileSearch,
  Plug,
  BarChart3,
  ClipboardList,
  Gavel,
  Accessibility,
  Hammer,
  BadgeCheck,
  FileText,
  Lock,
  Building2,
  Eye,
} from "lucide-react";
import { ProductRegionSwitcher } from "@/context/GeoContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authenticatedFetch } from "@/lib/apiClient";

// Recruiter tools (pages under /recruiter)
const recruiterLinks = [
  { name: "Evidence packs", href: "/recruiter/evidence", icon: FileSearch },
  { name: "ATS integrations", href: "/recruiter/integrations", icon: Plug },
  { name: "Validity & bias audit", href: "/recruiter/validity", icon: BarChart3 },
  { name: "Work trials", href: "/recruiter/work-trials", icon: Hammer },
  { name: "Appeals", href: "/recruiter/appeals", icon: Gavel },
  { name: "Accommodations", href: "/recruiter/accommodations", icon: Accessibility },
  { name: "Transparency settings", href: "/recruiter/transparency-settings", icon: Eye },
  { name: "Placement cell (colleges)", href: "/campus/admin", icon: Building2 },
];

const selfIdLink = { name: "Fairness self-ID", href: "/settings/self-identification", icon: Scale };

function hasRecruiterRole(metadata: Record<string, unknown> | undefined): boolean {
  if (!metadata) return false;
  const roles = [
    ...(Array.isArray(metadata.roles) ? metadata.roles : []),
    ...(typeof metadata.role === "string" ? [metadata.role] : []),
  ];
  return roles.some((r) => typeof r === "string" && ["recruiter", "admin", "instituteadmin", "superadmin"].includes(r.toLowerCase()));
}

export default function GlobalNavigation() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn, roles, getToken } = useAppAuth();
  const [practiceHubOpen, setPracticeHubOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);

  const isRecruiter = hasRecruiterRole({ roles });
  // The signed-out mobile menu keeps listing the recruiter tools (each one asks for sign-in)
  const showRecruiterLinks = !isSignedIn || isRecruiter;

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
        if (!cancelled && usage) setRemainingMinutes(usage.remainingMinutes);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, pathname]);

  const practiceHubRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (practiceHubRef.current && !practiceHubRef.current.contains(event.target as Node)) {
        setPracticeHubOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard: Escape closes an open menu and returns focus to the button that opened it
  const practiceHubButtonRef = useRef<HTMLButtonElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!practiceHubOpen && !mobileMenuOpen) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (practiceHubOpen) {
        setPracticeHubOpen(false);
        practiceHubButtonRef.current?.focus();
      }
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
        mobileButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [practiceHubOpen, mobileMenuOpen]);

  // Close menus on route change
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileMenuOpen(false);
    setPracticeHubOpen(false);
  }

  // Primary Student Core Navigation Links
  const primaryLinks = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Challenges", href: "/sprint/distributed-database", icon: Layers },
    { name: "Counselling", fullName: "Career Counselling", href: "/prep/counselling", icon: Compass },
    { name: "Interviews", href: "/interview/practice", icon: Mic },
    { name: "Exams", href: "/prep/exam", icon: GraduationCap },
    { name: "Incidents", href: "/daily/incident", icon: Flame },
  ];

  // Extended Student Learning & Verification Tools (Practice Hub)
  const studentPracticeTools = [
    {
      name: "My results",
      href: "/my/results",
      desc: "Feedback on every submission, review status and appeals",
      icon: ClipboardList,
    },
    {
      name: "Credentials",
      href: "/credentials",
      desc: "Your signed credentials: share with employers, reuse for applications",
      icon: BadgeCheck,
      badge: "New",
    },
    {
      name: "Campus",
      href: "/campus",
      desc: "College assignments, defense language and connection check",
      icon: GraduationCap,
    },
    {
      name: "Defend your repo",
      href: "/defend-repo",
      desc: "Link your GitHub repo or PR and defend the code you wrote",
      icon: GitBranch,
      badge: "New",
    },
    {
      name: "Recommendations",
      href: "/referrals",
      desc: "Course suggestions for skills to strengthen — you control sharing",
      icon: BookOpen,
    },
    {
      name: "Pricing",
      href: "/pricing",
      desc: "Plans, voice minutes and top-ups",
      icon: CreditCard,
    },
    {
      name: "Privacy & your data",
      href: "/settings/privacy",
      desc: "Download or delete your data",
      icon: Lock,
    },
    {
      name: "Transparency report",
      href: "/transparency",
      desc: "How our assessments perform and how fair they are, published",
      icon: FileText,
    },
    {
      name: "1v1 Duels Arena",
      href: "/duels/arena",
      desc: "Live peer speed coding battles & rating ladder",
      icon: Swords,
      badge: "Live",
    },
    {
      name: "Verifiable Skill Passport",
      href: "/passport",
      desc: "Cryptographic Merkle proofs & LinkedIn certificates",
      icon: Award,
      badge: "Verified",
    },
    {
      name: "Career Counselling Diagnostic",
      href: "/prep/counselling",
      desc: "Aptitude assessment & customized 90-day roadmap",
      icon: Compass,
    },
    {
      name: "Daily PR Review Dojo",
      href: "/daily/review",
      desc: "Security vulnerability & code review katas",
      icon: ShieldCheck,
    },
    {
      name: "League Leaderboard",
      href: "/leaderboard",
      desc: "Diamond League weekly rankings & XP standouts",
      icon: Trophy,
    },
  ];

  // Career-suite pages bring their own brand-aware shell or branding (they may be white-labelled for a partner)
  if (hidesGlobalNavigation(pathname)) return null;

  const isPracticeActive = studentPracticeTools.some(
    (tool) => pathname === tool.href || pathname?.startsWith(tool.href)
  );

  return (
    <>
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-200 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:shadow-lg"
    >
      Skip to content
    </a>
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl transition-all shadow-sm">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo & Student Brand */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-3 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-amber-500 flex items-center justify-center font-black text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 text-white" />
            </div>
            {/* Name hidden visually on very small screens so the header fits at 320px (WCAG 1.4.10); still read as the link name */}
            <div className="sr-only sm:not-sr-only">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
                  EDULEXA
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="hidden 2xl:block text-[10px] text-muted-foreground font-mono tracking-tight -mt-0.5">
                AI CAREER &amp; ASSESSMENT PLATFORM
              </p>
            </div>
          </Link>

          {/* Primary Student Navigation Links (Desktop) */}
          <nav aria-label="Main" className="hidden lg:flex items-center space-x-1 shrink-0">
            {primaryLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? "text-indigo-700 dark:text-indigo-400" : "text-muted-foreground"
                    }`}
                  />
                  <span>
                    <span className="hidden 2xl:inline">{link.fullName || link.name}</span>
                    <span className="2xl:hidden">{link.name}</span>
                  </span>
                </Link>
              );
            })}

            {/* Practice Hub Dropdown (Secondary Student Tools) */}
            <div className="relative" ref={practiceHubRef}>
              <button
                ref={practiceHubButtonRef}
                type="button"
                aria-expanded={practiceHubOpen}
                aria-controls="practice-hub-menu"
                onClick={() => setPracticeHubOpen(!practiceHubOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isPracticeActive || practiceHubOpen
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Practice Hub</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    practiceHubOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {practiceHubOpen && (
                <div id="practice-hub-menu" className="absolute left-0 mt-2 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-[100] animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/60 mb-1 flex items-center justify-between">
                    <span>Candidate Practice Tools</span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 lowercase font-mono">
                      student tier
                    </span>
                  </div>
                  <div className="space-y-1">
                    {studentPracticeTools.map((tool) => {
                      const Icon = tool.icon;
                      const isCurrent = pathname === tool.href || pathname?.startsWith(tool.href);
                      return (
                        <Link
                          key={tool.name}
                          href={tool.href}
                          onClick={() => setPracticeHubOpen(false)}
                          className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors group ${
                            isCurrent
                              ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200"
                              : "hover:bg-muted/80 text-foreground"
                          }`}
                        >
                          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold flex items-center gap-1.5">
                              <span className="truncate">{tool.name}</span>
                              {tool.badge && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                                  {tool.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground line-clamp-1">
                              {tool.desc}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Right Section: Status Indicators, Utilities & Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* AI Voice Minutes Balance */}
          <Link
            href="/pricing"
            title={
              isSignedIn && remainingMinutes !== null
                ? `${remainingMinutes} voice-defense minutes remaining`
                : "Plans and voice minutes"
            }
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-800 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors shadow-xs"
          >
            <Mic className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{isSignedIn && remainingMinutes !== null ? `${remainingMinutes}m left` : "Pricing"}</span>
          </Link>

          {/* Regional Currency & Compliance Switcher */}
          <ProductRegionSwitcher />

          {/* Theme Switcher */}
          <ThemeToggle />

          {/* Book Mentor CTA */}
          <Link
            href="/mentors/book"
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Book Mentor</span>
          </Link>

          {/* Student Profile & Account Menu */}
          <div className="relative pl-1 border-l border-border/60">
            {isSignedIn && AUTH_PROVIDER === "keycloak" ? (
              <AppUserButton />
            ) : isSignedIn ? (
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8 rounded-xl shadow-xs ring-1 ring-border",
                  },
                }}
              >
                <UserButton.MenuItems>
                  <UserButton.Link label="Pricing & minutes" labelIcon={<CreditCard className="w-4 h-4" />} href="/pricing" />
                  <UserButton.Link
                    label={selfIdLink.name}
                    labelIcon={<Scale className="w-4 h-4" />}
                    href={selfIdLink.href}
                  />
                  {(isRecruiter ? recruiterLinks : []).map((link) => {
                    const Icon = link.icon;
                    return (
                      <UserButton.Link key={link.href} label={link.name} labelIcon={<Icon className="w-4 h-4" />} href={link.href} />
                    );
                  })}
                </UserButton.MenuItems>
              </UserButton>
            ) : !isLoaded ? (
              // Auth still loading: hold the space without claiming either state
              <div className="w-8 h-8 rounded-xl bg-muted animate-pulse" aria-hidden="true" />
            ) : (
              <div className="flex items-center gap-1.5" data-nav-signed-out>
                <Link
                  href={signInLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400"
                >
                  <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sign in</span>
                </Link>
                {CAN_SIGN_UP && (
                  <Link
                    href={signUpLink}
                    className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400"
                  >
                    Sign up
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            ref={mobileButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation (Small Screens) */}
      {mobileMenuOpen && (
        <nav id="mobile-navigation" aria-label="Main (mobile)" className="xl:hidden border-t border-border bg-white dark:bg-slate-950 px-4 py-4 space-y-4 shadow-xl animate-in slide-in-from-top-2 duration-150">
          <div className="space-y-1">
            <div className="px-3 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Core Navigation
            </div>
            {primaryLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{link.fullName || link.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="space-y-1 pt-2 border-t border-border/60">
            <div className="px-3 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Practice &amp; Growth Hub
            </div>
            {studentPracticeTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.name}
                  href={tool.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{tool.name}</span>
                  </div>
                  {tool.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 uppercase">
                      {tool.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="space-y-1 pt-2 border-t border-border/60">
            <div className="px-3 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Account &amp; Settings
            </div>
            {isLoaded && !isSignedIn && (
              <div className="flex flex-col sm:flex-row gap-2 px-3 py-2">
                <Link
                  href={signInLink}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400"
                >
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  <span>Sign in</span>
                </Link>
                {CAN_SIGN_UP && (
                  <Link
                    href={signUpLink}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 inline-flex items-center justify-center py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400"
                  >
                    Create account
                  </Link>
                )}
              </div>
            )}
            <Link
              href={selfIdLink.href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{selfIdLink.name}</span>
            </Link>
          </div>

          {showRecruiterLinks && (
            <div className="space-y-1 pt-2 border-t border-border/60">
              <div className="px-3 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Hiring Tools
              </div>
              {recruiterLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Icon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>{link.name}</span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="pt-2 border-t border-border/60 flex items-center justify-between">
            <Link
              href="/mentors/book"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold shadow-md"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Book 1-on-1 Mentor Session</span>
            </Link>
          </div>
        </nav>
      )}
    </header>
    </>
  );
}

