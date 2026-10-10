"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, X } from "lucide-react";
import { AppUserButton, getSelectedSchool, setSelectedSchool, useApi, useAppAuth } from "@/lib/appAuth";
import { careerNav, personaTitle, type CareerPersona } from "@/lib/careerNav";
import { accessibleBrandColor } from "@/components/career/brandColor";

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
  const items = careerNav[persona].filter((i) => i.ready);
  const schools = (me?.memberships ?? [])
    .filter((m) => STAFF_ROLES[persona].includes(m.role))
    .filter((m, i, all) => all.findIndex((x) => x.instituteId === m.instituteId) === i);
  const notificationsHref = `${careerNav[persona][0]?.href ?? "/student"}/notifications`;

  const isActive = (href: string) => {
    const root = careerNav[persona][0]?.href;
    return href === root ? pathname === href : pathname === href || pathname?.startsWith(href + "/");
  };

  const activeItem = items.filter((i) => isActive(i.href)).sort((x, y) => y.href.length - x.href.length)[0];
  const activeLabel = activeItem && activeItem.href !== careerNav[persona][0]?.href ? activeItem.label : null;

  // Each page gets its own title (WCAG 2.4.2), e.g. "Appointments · Career · Brand"
  useEffect(() => {
    if (brand) document.title = [activeLabel, personaTitle[persona], brand.displayName].filter(Boolean).join(" · ");
  }, [brand, persona, activeLabel]);

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
      <div className="min-h-screen bg-background text-foreground" style={{ ["--brand" as string]: brandSolid }}>
        <a href="#career-main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
            <button
              ref={menuButtonRef}
              type="button"
              className="rounded-md p-2 md:hidden hover:bg-muted"
              aria-controls="career-nav"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
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
              <span className="hidden text-sm font-normal text-muted-foreground sm:inline">· {personaTitle[persona]}</span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              {schools.length > 1 && (
                <label className="flex items-center gap-2 text-sm">
                  <span className="sr-only">School</span>
                  <select
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    value={schoolId ?? ""}
                    onChange={(e) => {
                      setSelectedSchool(e.target.value || null);
                      setSchoolId(e.target.value || null);
                      window.location.reload();
                    }}
                  >
                    <option value="">Choose school…</option>
                    {schools.map((s) => (
                      <option key={s.instituteId} value={s.instituteId}>
                        {s.school ?? s.instituteId}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Link href={notificationsHref} className="relative rounded-md p-2 hover:bg-muted" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full px-1 text-center text-[10px] font-semibold leading-4 text-white" style={{ background: brandSolid }} aria-hidden>
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <AppUserButton />
            </div>
          </div>
        </header>

        <div className="mx-auto flex max-w-7xl gap-6 px-4">
          <nav id="career-nav" aria-label={`${personaTitle[persona]} navigation`} className={`${menuOpen ? "block" : "hidden"} fixed inset-x-0 top-14 z-30 border-b border-border bg-card p-3 md:static md:block md:w-56 md:shrink-0 md:border-0 md:bg-transparent md:p-0 md:pt-6`}>
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm ${isActive(item.href) ? "font-semibold text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                    style={isActive(item.href) ? { background: brandSolid } : undefined}
                  >
                    {item.label}
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
            <span>© {new Date().getFullYear()} {b.displayName}</span>
            {b.privacyUrl && <a className="hover:underline" href={b.privacyUrl}>Privacy</a>}
            {b.termsUrl && <a className="hover:underline" href={b.termsUrl}>Terms</a>}
            {b.supportEmail && <a className="hover:underline" href={`mailto:${b.supportEmail}`}>Support</a>}
            {b.showPoweredBy && !b.isWhiteLabel && b.key !== "edulexa" && <span>Powered by Edulexa</span>}
          </div>
        </footer>
      </div>
    </CareerShellContext.Provider>
  );
}
