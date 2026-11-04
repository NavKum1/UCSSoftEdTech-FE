"use client";

/**
 * One header for the recruiter, institute, admin and advisor portals: a top row with the brand and the portal's name and
 * the shared controls (language, light/dark, the account menu with "Switch to"), and the section tabs underneath
 * (underlined when current; they scroll sideways without a visible scrollbar when they don't fit). Sections with a
 * `group` are shown as one tab per group, with the current group's pages as a second row (5 Nov 2026: the recruiter
 * portal's ten flat tabs became Candidates, Review, Fairness and Settings). The global navigation is hidden on these
 * routes (lib/careerNav PORTAL_PREFIXES), so this is the only header.
 */

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FRAME, PAGE_Y } from "@/components/layout/Frame";
import { HeaderControls } from "@/components/layout/AccountMenu";
import BrandMark from "@/components/brand/BrandMark";
import { useEn } from "@/lib/english/EnglishProvider";

export interface PortalSection {
  href: string;
  label: string;
  /** Sections with the same group share one tab; the group's pages show as a second row */
  group?: string;
}

const tabClass = (on: boolean) =>
  `block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
    on ? "border-[var(--brand)] font-medium text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
  }`;

export default function PortalShell({
  name,
  home,
  sections,
  badge,
  footer,
  children,
}: {
  /** The portal's name, e.g. "Recruiter" */
  name: string;
  home: string;
  sections: PortalSection[];
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const en = useEn();
  const pathname = usePathname();
  // The most specific section that matches the current page
  const current = [...sections].sort((a, b) => b.href.length - a.href.length).find((s) => pathname === s.href || pathname?.startsWith(s.href + "/"));

  // Tabs: one per group (opening the group's first page), or one per section when there are no groups
  const tabs: { key: string; label: string; href: string; on: boolean; pages: PortalSection[] }[] = [];
  for (const s of sections) {
    const key = s.group ?? s.href;
    const tab = tabs.find((t) => t.key === key);
    if (tab) tab.pages.push(s);
    else tabs.push({ key, label: s.group ?? s.label, href: s.href, on: false, pages: [s] });
  }
  for (const t of tabs) t.on = !!current && t.pages.includes(current);
  const subPages = tabs.find((t) => t.on)?.pages ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
        <div className={`${FRAME} flex h-14 items-center justify-between gap-4`}>
          <Link href={home} className="flex min-w-0 items-center gap-2.5">
            <BrandMark area={en(name)} />
            {badge}
          </Link>
          <HeaderControls area={home} />
        </div>
        {tabs.length > 1 && (
          <nav aria-label={en("{name} sections", { name: en(name) })} className={`${FRAME} !px-1 sm:!px-3`}>
            <ul className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((t) => (
                <li key={t.key} className="shrink-0">
                  <Link href={t.href} aria-current={t.on && t.pages.length === 1 ? "page" : undefined} className={tabClass(t.on)}>
                    {en(t.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      {subPages.length > 1 && (
        <nav aria-label={en("Pages in this section")} className="border-b border-border bg-card/60">
          <ul className={`${FRAME} flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
            {subPages.map((s) => {
              const on = s === current;
              return (
                <li key={s.href} className="shrink-0">
                  <Link
                    href={s.href}
                    aria-current={on ? "page" : undefined}
                    className={`block whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
                      on ? "bg-[var(--brand)]/10 font-medium text-foreground ring-1 ring-[var(--brand)]/40" : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
      <main className={`${FRAME} ${PAGE_Y} flex-1`}>{children}</main>
      {footer}
    </div>
  );
}
