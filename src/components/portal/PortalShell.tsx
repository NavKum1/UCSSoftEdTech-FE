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
import { AppUserButton } from "@/lib/appAuth";
import { endDevSession, useDevSession } from "@/lib/devSession";

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
  const pathname = usePathname();
  const router = useRouter();
  const dev = useDevSession();
  // The most specific section that matches the current page
  const current = [...sections].sort((a, b) => b.href.length - a.href.length).find((s) => pathname === s.href || pathname?.startsWith(s.href + "/"));

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href={home} className="flex min-w-0 items-center gap-2.5">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${accent}`}>
              {icon}
            </span>
            <span className="truncate text-sm font-semibold tracking-tight">
              Edulexa <span className="font-normal text-muted-foreground">· {name}</span>
            </span>
            {badge}
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/" className="hidden items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:inline-flex">
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
              Main app
            </Link>
            {dev ? (
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
            ) : (
              <AppUserButton />
            )}
          </div>
        </div>
        {sections.length > 1 && (
          <nav aria-label={`${name} sections`} className="mx-auto max-w-7xl px-2 sm:px-4">
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
                      {s.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      {footer}
    </div>
  );
}
