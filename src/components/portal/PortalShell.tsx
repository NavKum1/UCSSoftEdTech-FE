"use client";

/**
 * One header for the recruiter, institute, admin and advisor portals: a top row with the brand and the portal's name and
 * the shared controls (language, light/dark, the account menu with "Switch to"), and the section tabs underneath
 * (underlined when current). Sections with a `group` are shown as one tab per group (5 Nov 2026: the recruiter portal's
 * ten flat tabs became Candidates, Review, Fairness and Settings). 7 Nov 2026, the same menus as every other role
 * (components/layout/SectionNav): a group's tab opens its pages when the mouse points at it, and the current group's
 * pages show as a bar under the header, so every page is one click away; small screens get a menu button with every
 * page. The global navigation is hidden on these routes (lib/careerNav PORTAL_PREFIXES), so this is the only header.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { FRAME, PAGE_Y } from "@/components/layout/Frame";
import { HeaderControls } from "@/components/layout/AccountMenu";
import BrandMark from "@/components/brand/BrandMark";
import { SectionBar, SectionDrawerList, SectionTabs, findCurrent, type NavTab } from "@/components/layout/SectionNav";
import { useEn } from "@/lib/english/EnglishProvider";

export interface PortalSection {
  href: string;
  label: string;
  /** Sections with the same group share one tab; the group's pages show as its menu and as a bar under the header */
  group?: string;
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  // Tabs: one per group, or one per section when it has no group
  const tabs = useMemo(() => {
    const list: NavTab[] = [];
    for (const s of sections) {
      const key = (s.group ?? s.href).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const page = { href: s.href, label: en(s.label) };
      const tab = list.find((t) => t.key === key);
      if (tab) tab.pages.push(page);
      else list.push({ key, label: en(s.group ?? s.label), pages: [page] });
    }
    return list;
  }, [sections, en]);
  const { tab: currentTab, page: currentPage } = findCurrent(tabs, pathname);

  // Close the phone menu on a new page; Escape closes it and returns focus to its button
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const several = tabs.length > 1 || (tabs[0]?.pages.length ?? 0) > 1;
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-200 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:shadow-lg"
      >
        {en("Skip to content")}
      </a>
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
        <div className={`${FRAME} flex h-14 items-center justify-between gap-4`}>
          <Link href={home} className="flex min-w-0 items-center gap-2.5">
            <BrandMark area={en(name)} />
            {badge}
          </Link>
          <div className="flex items-center gap-2">
            <HeaderControls area={home} bell />
            {several && (
              <button
                ref={menuButton}
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
                aria-label={en("Menu")}
                aria-expanded={menuOpen}
                aria-controls="portal-navigation"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
        {several && (
          <SectionTabs
            tabs={tabs}
            current={currentPage}
            idPrefix="portal-menu"
            label={en("{name} sections", { name: en(name) })}
            className={`${FRAME} hidden !px-1 sm:!px-3 lg:block`}
          />
        )}
        {menuOpen && (
          <nav id="portal-navigation" aria-label={en("{name} sections", { name: en(name) })} className="max-h-[75vh] overflow-y-auto border-t border-border px-4 py-4 lg:hidden">
            <SectionDrawerList tabs={tabs} current={currentPage} onNavigate={() => setMenuOpen(false)} />
          </nav>
        )}
      </header>
      <SectionBar tabs={tabs} tab={currentTab} current={currentPage} />
      <main id="main-content" tabIndex={-1} className={`${FRAME} ${PAGE_Y} flex-1 focus:outline-none`}>
        {children}
      </main>
      {footer}
    </div>
  );
}
