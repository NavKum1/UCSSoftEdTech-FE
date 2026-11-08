"use client";

/**
 * The menus every role shares (7 Nov 2026): one click to any page.
 * - SectionTabs: the row of tabs under the header (wide screens). A tab with several pages opens its menu when the mouse
 *   points at it (or from its arrow button, for keyboards and touch); clicking the tab itself opens its first page.
 * - SectionBar: the current tab's pages as a row under the header, on every screen, so the next page in a section is one
 *   click away.
 * - SectionDrawerList: every tab and page, for the phone menu.
 * Used by GlobalNavigation (members), PortalShell (recruiter, institute, advisor, admin) and CareerShell (school roles).
 * Labels come in translated; the shells translate them.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";

export interface NavPage {
  href: string;
  label: string;
  /** A shorter label for the section bar */
  short?: string;
  /** One line under the label in the menu */
  desc?: string;
  /** A heading inside the tab's menu; pages without one go in the menu's bottom row */
  sub?: string;
  /** Also listed here as a shortcut; the page belongs to another tab */
  shortcut?: boolean;
  /** Other routes that count as this page (e.g. every coding challenge for "Coding challenges") */
  match?: string[];
}

export interface NavTab {
  key: string;
  label: string;
  pages: NavPage[];
}

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/** The current page and its tab: the most specific match; `exact` routes (a home page) match only themselves */
export function findCurrent(tabs: NavTab[], pathname: string | null, exact: string[] = []) {
  if (!pathname) return { tab: undefined, page: undefined };
  let best: { tab: NavTab; page: NavPage; len: number } | undefined;
  for (const tab of tabs)
    for (const page of tab.pages) {
      if (page.shortcut) continue;
      for (const route of [page.href, ...(page.match ?? [])]) {
        const hit = exact.includes(route) ? pathname === route : under(pathname, route);
        if (hit && (!best || route.length > best.len)) best = { tab, page, len: route.length };
      }
    }
  return { tab: best?.tab, page: best?.page };
}

const sameHref = (a: NavPage | undefined, b: NavPage) => !!a && a.href === b.href;

/** The pages of a menu in display order: its headed groups first, in order of appearance, then the bottom row */
function splitPages(pages: NavPage[]) {
  const subs: { name: string; pages: NavPage[] }[] = [];
  const rest: NavPage[] = [];
  for (const p of pages) {
    if (!p.sub) rest.push(p);
    else {
      const s = subs.find((x) => x.name === p.sub);
      if (s) s.pages.push(p);
      else subs.push({ name: p.sub, pages: [p] });
    }
  }
  return { subs, rest };
}

const tabClass = (on: boolean) =>
  `flex items-center whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
    on ? "border-[var(--brand)] font-medium text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
  }`;

function MenuLink({ page, current, onNavigate, prefetch }: { page: NavPage; current?: NavPage; onNavigate: () => void; prefetch?: boolean }) {
  const on = sameHref(current, page);
  return (
    <Link
      href={page.href}
      prefetch={prefetch}
      onClick={onNavigate}
      aria-current={on ? "page" : undefined}
      className={`block rounded-lg px-3 py-2 hover:bg-muted ${on ? "bg-muted" : ""}`}
    >
      <span className={`block text-sm text-foreground ${on ? "font-semibold" : "font-medium"}`}>{page.label}</span>
      {page.desc && <span className="block text-xs text-muted-foreground">{page.desc}</span>}
    </Link>
  );
}

export function SectionTabs({
  tabs,
  current,
  label,
  idPrefix = "nav-menu",
  prefetch,
  className = "",
}: {
  tabs: NavTab[];
  current?: NavPage;
  /** The navigation landmark's name */
  label: string;
  idPrefix?: string;
  prefetch?: boolean;
  className?: string;
}) {
  const en = useEn();
  const [open, setOpen] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const currentTab = current ? tabs.find((t) => t.pages.some((p) => !p.shortcut && p.href === current.href)) : undefined;

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  // A short delay, so the pointer can cross the gap between the tab and its menu
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(null), 150);
  };
  useEffect(() => () => cancelClose(), []);

  // An open menu starts under its tab and moves sideways just enough to stay on screen
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!open || !el) return;
    el.style.transform = "";
    const r = el.getBoundingClientRect();
    const gap = 12;
    const shift = r.right > window.innerWidth - gap ? Math.max(window.innerWidth - gap - r.right, gap - r.left) : r.left < gap ? gap - r.left : 0;
    if (shift) el.style.transform = `translateX(${shift}px)`;
  }, [open]);

  // A click outside closes the menu; Escape closes it and returns focus to its button
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      buttons.current[open]?.focus();
      setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav aria-label={label} className={className}>
      <ul ref={listRef} className="-mb-px flex items-center gap-1">
        {tabs.map((t) => {
          const on = t === currentTab;
          const first = t.pages.find((p) => !p.shortcut) ?? t.pages[0];
          if (!first) return null;
          if (t.pages.length < 2)
            return (
              <li key={t.key}>
                <Link href={first.href} prefetch={prefetch} aria-current={on ? "page" : undefined} className={tabClass(on)}>
                  {t.label}
                </Link>
              </li>
            );
          const isOpen = open === t.key;
          const { subs, rest } = splitPages(t.pages);
          const columns = subs.length > 1 ? subs.length : t.pages.length > 8 ? 2 : 1;
          const width = columns >= 3 ? "w-[min(92vw,860px)]" : columns === 2 ? "w-[min(92vw,600px)]" : "w-80";
          const close = () => setOpen(null);
          return (
            <li
              key={t.key}
              className={`relative -mb-px flex items-center border-b-2 transition-colors ${on ? "border-[var(--brand)]" : "border-transparent hover:border-border"}`}
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                cancelClose();
                setOpen(t.key);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") closeSoon();
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen((o) => (o === t.key ? null : o));
              }}
            >
              <Link
                href={first.href}
                prefetch={prefetch}
                onClick={close}
                className={`whitespace-nowrap py-2.5 ps-3 pe-1 text-sm transition-colors ${on ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t.label}
              </Link>
              <button
                ref={(el) => {
                  buttons.current[t.key] = el;
                }}
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${idPrefix}-${t.key}`}
                aria-label={en("{name} pages", { name: t.label })}
                onClick={() => setOpen(isOpen ? null : t.key)}
                className="self-stretch pe-2 ps-0.5 text-muted-foreground hover:text-foreground"
              >
                <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div
                  id={`${idPrefix}-${t.key}`}
                  ref={panelRef}
                  className="absolute start-0 top-full z-100 pt-1"
                >
                  <div className={`${width} rounded-xl border border-border bg-card p-2 text-start shadow-xl`}>
                    {subs.length > 0 ? (
                      <div className={`grid gap-x-2 ${columns >= 3 ? "grid-cols-3" : columns === 2 ? "grid-cols-2" : ""}`}>
                        {subs.map((s) => (
                          <div key={s.name}>
                            <p className="px-3 pb-1 pt-2 text-xs font-semibold text-[var(--brand-text-light,var(--brand))] dark:text-[var(--brand-text-dark,var(--brand))]">{s.name}</p>
                            <ul>
                              {s.pages.map((p) => (
                                <li key={p.href}>
                                  <MenuLink page={p} current={current} onNavigate={close} prefetch={prefetch} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {rest.length > 0 && (
                      <ul
                        className={`grid gap-x-2 ${subs.length ? "mt-1 border-t border-border pt-1" : ""} ${
                          (subs.length ? rest.length >= 2 : columns === 2) ? "grid-cols-2" : ""
                        }`}
                      >
                        {rest.map((p) => (
                          <li key={p.href}>
                            <MenuLink page={p} current={current} onNavigate={close} prefetch={prefetch} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The current tab's pages in a row (scrolls sideways on narrow screens, with the current page kept in view). On a page
 * whose tab has no other pages, phones get the tabs themselves in the row instead (wide screens already show the tabs).
 */
export function SectionBar({ tabs, tab, current, prefetch }: { tabs?: NavTab[]; tab?: NavTab; current?: NavPage; prefetch?: boolean }) {
  const en = useEn();
  const rowRef = useRef<HTMLUListElement>(null);
  const href = current?.href;
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !chip) return;
    // Scroll the row only (never the page), so the current page is visible on a phone
    const left = chip.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + chip.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = left - 16;
  }, [href]);
  if (!tab) return null;
  let groups: NavPage[][];
  let name: string;
  let selected = current;
  let phoneOnly = false;
  if (tab.pages.length >= 2) {
    const { subs, rest } = splitPages(tab.pages);
    groups = [...subs.map((s) => s.pages), ...(rest.length ? [rest] : [])];
    name = en("Pages in {name}", { name: tab.label });
  } else {
    const firsts = (tabs ?? []).map((t) => ({ tab: t, page: { href: (t.pages.find((p) => !p.shortcut) ?? t.pages[0])?.href ?? "", label: t.label } })).filter((x) => x.page.href);
    if (firsts.length < 2) return null;
    groups = [firsts.map((x) => x.page)];
    selected = firsts.find((x) => x.tab === tab)?.page;
    name = en("Sections");
    phoneOnly = true;
  }
  return (
    <nav aria-label={name} className={`border-b border-border bg-muted/60 ${phoneOnly ? "lg:hidden" : ""}`}>
      <ul ref={rowRef} className="mx-auto flex w-full max-w-7xl items-center gap-1 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        {groups.map((pages, g) => (
          <React.Fragment key={g}>
            {g > 0 && <li aria-hidden="true" className="mx-1.5 h-4 w-px shrink-0 bg-border" />}
            {pages.map((p) => {
              const on = sameHref(selected, p);
              return (
                <li key={p.href} className="shrink-0">
                  <Link
                    href={p.href}
                    prefetch={prefetch}
                    aria-current={on ? "page" : undefined}
                    className={`block whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                      on ? "bg-card font-semibold text-[var(--brand-text-light,var(--brand))] dark:text-[var(--brand-text-dark,var(--brand))] shadow-sm ring-1 ring-border" : "text-foreground/80 hover:bg-card hover:text-foreground"
                    }`}
                  >
                    {p.short ?? p.label}
                  </Link>
                </li>
              );
            })}
          </React.Fragment>
        ))}
      </ul>
    </nav>
  );
}

/** Every tab and its pages, for the phone menu */
export function SectionDrawerList({ tabs, current, onNavigate, prefetch }: { tabs: NavTab[]; current?: NavPage; onNavigate?: () => void; prefetch?: boolean }) {
  const link = (p: NavPage, label = p.label) => {
    const on = sameHref(current, p);
    return (
      <li key={p.href}>
        <Link
          href={p.href}
          prefetch={prefetch}
          onClick={onNavigate}
          aria-current={on ? "page" : undefined}
          className={`block rounded-lg px-3 py-2 text-sm ${on ? "bg-muted font-semibold text-foreground" : "text-foreground/80 hover:bg-muted hover:text-foreground"}`}
        >
          {label}
        </Link>
      </li>
    );
  };
  const singles = tabs.filter((t) => t.pages.length < 2 && t.pages[0]);
  const menus = tabs.filter((t) => t.pages.length >= 2);
  return (
    <div className="space-y-3">
      {singles.length > 0 && <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">{singles.map((t) => link(t.pages[0], t.label))}</ul>}
      {menus.map((t) => {
        const { subs, rest } = splitPages(t.pages);
        return (
          <div key={t.key} className="border-t border-border pt-3">
            <p className="px-3 text-sm font-semibold text-foreground">{t.label}</p>
            {subs.map((s) => (
              <div key={s.name}>
                <p className="px-3 pb-0.5 pt-2 text-xs font-semibold text-[var(--brand-text-light,var(--brand))] dark:text-[var(--brand-text-dark,var(--brand))]">{s.name}</p>
                <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">{s.pages.map((p) => link(p))}</ul>
              </div>
            ))}
            {rest.length > 0 && <ul className={`grid grid-cols-1 gap-0.5 sm:grid-cols-2 ${subs.length ? "mt-1 border-t border-border pt-1" : "mt-1"}`}>{rest.map((p) => link(p))}</ul>}
          </div>
        );
      })}
    </div>
  );
}
