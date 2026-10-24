"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, X } from "lucide-react";
import { AppUserButton, getSelectedSchool, setSelectedSchool, useApi, useAppAuth } from "@/lib/appAuth";
import { careerNav, type CareerPersona } from "@/lib/careerNav";
import { COMMUNITY_INSTITUTE_ID } from "@/lib/community";
import { useCareerFormat, useCareerI18n, useCareerT } from "@/components/career/i18n/CareerI18nProvider";
import { useCareerNavLabels } from "@/components/career/i18n/nav";
import LanguagePicker from "@/components/career/i18n/LanguagePicker";
import { accessibleBrandColor, brandCssVars } from "@/components/career/brandColor";
import { useDataSaver } from "@/components/career/mobile/dataSaver";

export interface CareerBrand {
  key: string;
  displayName: string;
  logoUrl?: string | null;
  primaryColor: string;
  supportEmail?: string | null;
  privacyUrl?: string | null;
  termsUrl?: string | null;
  showPoweredBy: boolean;
  isWhiteLabel: boolean;
}

export interface CareerMembershipInfo {
  id: string;
  instituteId: string;
  school: string | null;
  slug: string | null;
  role: string;
  status: string;
  ferpaHold: boolean;
}

export interface CareerMe {
  userId: string;
  email: string | null;
  name: string;
  isSuperAdmin: boolean;
  memberships: CareerMembershipInfo[];
  employers: { id: string; name: string; role: string; verificationStatus: string }[];
}

interface CareerShellState {
  brand: CareerBrand | null;
  me: CareerMe | null;
  meError: string | null;
  schoolId: string | null;
  reloadMe: () => void;
}

const CareerShellContext = createContext<CareerShellState>({ brand: null, me: null, meError: null, schoolId: null, reloadMe: () => {} });

export function useCareerShell() {
  return useContext(CareerShellContext);
}

function setDocumentTitle(title: string) {
  document.title = title;
}

// Platform name for the "Powered by" line, shown only to schools on the platform's own brand (never white-label)
const PLATFORM_NAME = "Edulexa";

const FALLBACK_BRAND: CareerBrand = { key: "edulexa", displayName: "Edulexa", primaryColor: "#4f46e5", showPoweredBy: true, isWhiteLabel: false };

const STAFF_ROLES: Record<CareerPersona, string[]> = {
  student: ["Student", "Alumni"],
  "career-center": ["CareerAdmin", "Counselor", "EmployerRelations"],
  employer: [],
  faculty: ["Faculty", "CareerAdmin"],
  alumni: ["Alumni"],
};

/** Brand-aware frame for every career-suite page: header, persona navigation, school switcher, notifications. */
export default function CareerShell({ persona, children }: { persona: CareerPersona; children: React.ReactNode }) {
  const pathname = usePathname();
  const api = useApi();
  const { isLoaded, isSignedIn } = useAppAuth();
  const [brand, setBrand] = useState<CareerBrand | null>(null);
  const [me, setMe] = useState<CareerMe | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const t = useCareerT("shell");
  const fmt = useCareerFormat();
  const { locale, dir } = useCareerI18n();
  const nav = useCareerNavLabels(persona);

  useEffect(() => {
    let cancelled = false;
    api<CareerBrand>(`/api/career/brand?host=${encodeURIComponent(window.location.host)}`)
      .then((b) => {
        if (!cancelled) setBrand(b);
      })
      .catch(() => {
        if (!cancelled) setBrand(FALLBACK_BRAND);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    api<CareerMe>("/api/career/me")
      .then((m) => {
        if (cancelled) return;
        setMe(m);
        setMeError(null);
        // Keep the chosen school only if it fits this persona; pick the only one automatically
        const relevant = m.memberships.filter((x) => STAFF_ROLES[persona].includes(x.role));
        const ids = Array.from(new Set(relevant.map((x) => x.instituteId)));
        const saved = getSelectedSchool();
        const chosen = saved && ids.includes(saved) ? saved : ids.length === 1 ? ids[0] : saved && ids.length === 0 ? saved : null;
        if (ids.length > 0 && chosen !== saved) setSelectedSchool(chosen);
        setSchoolId(chosen);
      })
      .catch((e: Error) => {
        if (!cancelled) setMeError(e.message);
      });
    api<{ unread: number }>("/api/career/notifications?unreadOnly=true&take=1")
      .then((n) => {
        if (!cancelled) setUnread(n.unread);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, isLoaded, isSignedIn, persona, version, pathname]);

  const reloadMe = useCallback(() => setVersion((v) => v + 1), []);
  const b = brand ?? FALLBACK_BRAND;
  // White text sits on the brand color (active nav, primary buttons): darken it when the school's color is too light
  const brandSolid = accessibleBrandColor(b.primaryColor);
  // The Edulexa community (members without a school) offers mentoring only
  const inCommunity = schoolId === COMMUNITY_INSTITUTE_ID;
  const items = careerNav[persona].filter((i) => i.ready && (!inCommunity || i.module === "C10"));
  const schools = (me?.memberships ?? [])
    .filter((m) => STAFF_ROLES[persona].includes(m.role))
    .filter((m, i, all) => all.findIndex((x) => x.instituteId === m.instituteId) === i);
  const notificationsHref = `${careerNav[persona][0]?.href ?? "/student"}/notifications`;

  const isActive = (href: string) => {
    const root = careerNav[persona][0]?.href;
    return href === root ? pathname === href : pathname === href || pathname?.startsWith(href + "/");
  };

  const activeItem = items.filter((i) => isActive(i.href)).sort((x, y) => y.href.length - x.href.length)[0];
  // Only the most specific match is the current page (e.g. /reports/india marks its own entry, not also "Reports")
  const isCurrent = (href: string) => activeItem?.href === href;
  // Data saver: the menu does not load every linked page in the background
  const dataSaver = useDataSaver();
  const activeLabel = activeItem && activeItem.href !== careerNav[persona][0]?.href ? nav.label(activeItem) : null;

  // Each page gets its own title (WCAG 2.4.2), e.g. "Appointments · Career · Brand"
  const separator = t("titleSeparator");
  useEffect(() => {
    if (brand) setDocumentTitle([activeLabel, nav.title, brand.displayName].filter(Boolean).join(separator));
  }, [brand, nav.title, activeLabel, separator]);

  // Mobile menu: Escape closes it and returns focus to the toggle
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <CareerShellContext.Provider value={{ brand: b, me, meError, schoolId, reloadMe }}>
      <div className="min-h-screen bg-background text-foreground" lang={locale} dir={dir} style={brandCssVars(b.primaryColor) as React.CSSProperties}>
        <a href="#career-main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
          {t("skipToContent")}
        </a>
        <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
            <button
              ref={menuButtonRef}
              type="button"
              className="rounded-md p-2 md:hidden hover:bg-muted"
              aria-controls="career-nav"
              aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href={careerNav[persona][0]?.href ?? "/"} className="flex items-center gap-2 font-semibold">
              {b.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logoUrl} alt="" className="h-7 w-7 rounded object-contain" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-white" style={{ background: brandSolid }} aria-hidden>
                  {b.displayName.slice(0, 1)}
                </span>
              )}
              <span>{b.displayName}</span>
              <span className="hidden text-sm font-normal text-muted-foreground sm:inline">· {nav.title}</span>
            </Link>
            <div className="ms-auto flex items-center gap-2">
              {schools.length > 1 && (
                <label className="flex items-center gap-2 text-sm">
                  <span className="sr-only">{t("school")}</span>
                  <select
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    value={schoolId ?? ""}
                    onChange={(e) => {
                      setSelectedSchool(e.target.value || null);
                      setSchoolId(e.target.value || null);
                      window.location.reload();
                    }}
                  >
                    <option value="">{t("chooseSchool")}</option>
                    {schools.map((s) => (
                      <option key={s.instituteId} value={s.instituteId}>
                        {s.school ?? s.instituteId}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Link href={notificationsHref} className="relative rounded-md p-2 hover:bg-muted" aria-label={unread ? t("notificationsUnread", { count: unread }) : t("notifications")}>
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -end-0.5 -top-0.5 min-w-4 rounded-full px-1 text-center text-[10px] font-semibold leading-4 text-white" style={{ background: brandSolid }} aria-hidden>
                    {unread > 99 ? t("unreadOverflow") : fmt.number(unread)}
                  </span>
                )}
              </Link>
              <AppUserButton />
            </div>
          </div>
        </header>

        <div className="mx-auto flex max-w-7xl gap-6 px-4">
          <nav id="career-nav" aria-label={t("navigation", { persona: nav.title })} className={`${menuOpen ? "block" : "hidden"} fixed inset-x-0 top-14 z-30 border-b border-border bg-card p-3 md:static md:block md:w-56 md:shrink-0 md:border-0 md:bg-transparent md:p-0 md:pt-6`}>
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={dataSaver.on ? false : undefined}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isCurrent(item.href) ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm ${isCurrent(item.href) ? "font-semibold text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                    style={isCurrent(item.href) ? { background: brandSolid } : undefined}
                  >
                    {nav.label(item)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <main id="career-main" tabIndex={-1} className="min-w-0 flex-1 py-6 focus:outline-none">
            {children}
          </main>
        </div>

        <footer className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-4 border-t border-border pt-4">
            <span>{t("copyright", { year: String(new Date().getFullYear()), brand: b.displayName })}</span>
            {b.privacyUrl && <a className="hover:underline" href={b.privacyUrl}>{t("privacy")}</a>}
            {b.termsUrl && <a className="hover:underline" href={b.termsUrl}>{t("terms")}</a>}
            {b.supportEmail && <a className="hover:underline" href={`mailto:${b.supportEmail}`}>{t("support")}</a>}
            {b.showPoweredBy && !b.isWhiteLabel && b.key !== "edulexa" && <span>{t("poweredBy", { product: PLATFORM_NAME })}</span>}
            <LanguagePicker className="ms-auto" />
          </div>
        </footer>
      </div>
    </CareerShellContext.Provider>
  );
}
