"use client";

/**
 * One header for the recruiter, institute and admin portals: a top row with the brand, the portal's name, a link back to
 * the main app and the account button, and a row of section tabs underneath (underlined when current; they scroll
 * sideways without a visible scrollbar when they don't fit). The global navigation is hidden on these routes
 * (lib/careerNav PORTAL_PREFIXES), so this is the only header.
 */

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppUserButton, useAppAuth } from "@/lib/appAuth";
import { platformHome } from "@/lib/roleHome";
import { endDevSession, useDevSession } from "@/lib/devSession";
import EnglishPicker from "@/components/EnglishPicker";
import { FRAME, PAGE_Y } from "@/components/layout/Frame";
import { useEn } from "@/lib/english/EnglishProvider";

export interface PortalSection {
  href: string;
  label: string;
}

export default function PortalShell({
  name,
  icon,
  accent,
  home,
  sections,
  badge,
  footer,
  children,
}: {
  /** The portal's name, e.g. "Recruiter" */
  name: string;
  /** The portal icon, e.g. <Briefcase /> (an element, so server layouts can pass it) */
  icon: React.ReactNode;
  /** Tailwind classes for the icon tile, e.g. "bg-indigo-600" */
  accent: string;
  home: string;
  sections: PortalSection[];
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const en = useEn();
  const pathname = usePathname();
  const router = useRouter();
  const dev = useDevSession();
  // "Main app" opens the member dashboard, which sends staff back to their own area: not shown in that area
  const { roles } = useAppAuth();
  const ownArea = platformHome(roles) === home || (home === "/institute/dashboard" && roles.some((r) => r.toLowerCase() === "counselor"));
  // The most specific section that matches the current page
  const current = [...sections].sort((a, b) => b.href.length - a.href.length).find((s) => pathname === s.href || pathname?.startsWith(s.href + "/"));

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
        <div className={`${FRAME} flex h-14 items-center justify-between gap-4`}>
          <Link href={home} className="flex min-w-0 items-center gap-2.5">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${accent}`}>
              {icon}
            </span>
            <span className="truncate text-sm font-semibold tracking-tight">
              {en("Edulexa ")}<span className="font-normal text-muted-foreground">· {name}</span>
            </span>
            {badge}
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <EnglishPicker className="hidden md:inline-flex" />
            {!ownArea && (
              <Link href="/" className="hidden items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:inline-flex">
                <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                {en("Main app")}
              </Link>
            )}
            {dev ? (
              <span className="inline-flex items-center gap-2 text-xs">
                <span className="rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-1 font-medium text-amber-800 dark:text-amber-300">{en("Dev: {label}", { label: dev.label })}</span>
                <button
                  type="button"
                  onClick={() => {
                    endDevSession();
                    router.push("/login");
                  }}
                  className="rounded-md border border-border px-2 py-1 font-medium hover:bg-muted"
                >
                  {en("End")}
                </button>
              </span>
            ) : (
              <AppUserButton />
            )}
          </div>
        </div>
        {sections.length > 1 && (
          <nav aria-label={`${name} sections`} className={`${FRAME} !px-1 sm:!px-3`}>
            <ul className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sections.map((s) => {
                const active = s === current;
                return (
                  <li key={s.href} className="shrink-0">
                    <Link
                      href={s.href}
                      aria-current={active ? "page" : undefined}
                      className={`block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                        active ? "border-indigo-600 font-medium text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      {en(s.label)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>
      <main className={`${FRAME} ${PAGE_Y} flex-1`}>{children}</main>
      {footer}
    </div>
  );
}
