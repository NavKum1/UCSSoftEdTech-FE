"use client";

/**
 * The account menu and header controls, the same for every role (5 Nov 2026): the person's name, their account pages,
 * the other areas they work in ("Switch to"), light or dark, and sign out. A developer session shows the same menu, with
 * "End session" in place of sign out. HeaderControls puts the language, the light/dark switch and this menu together;
 * every header (members, portals, career suite) uses it, so the controls can't drift apart again.
 */
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { ArrowRightLeft, Bell, CircleHelp, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useAppAuth } from "@/lib/appAuth";
import { endDevSession, useDevSession } from "@/lib/devSession";
import { useEn } from "@/lib/english/EnglishProvider";
import { platformHome, schoolAreas, schoolHome, type CareerMe } from "@/lib/roleHome";
import { authenticatedFetch } from "@/lib/apiClient";
import EnglishPicker from "@/components/EnglishPicker";
import { useHelpPanel } from "@/components/help/helpPanelContext";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface AccountLink {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

const has = (roles: string[], wanted: string[]) => roles.some((r) => wanted.includes(r.toLowerCase()));

/** The areas a person can work in, by role ("/dashboard", practice and results, is for members: staff work in their own area) */
const AREAS: { href: string; label: string; roles: string[] | null }[] = [
  { href: "/dashboard", label: "Practice and results", roles: null },
  { href: "/recruiter/dashboard", label: "Recruiter portal", roles: ["recruiter", "admin", "instituteadmin", "superadmin"] },
  { href: "/institute/dashboard", label: "Institute", roles: ["instituteadmin", "counselor", "superadmin"] },
  { href: "/advisor/guidance", label: "Advisors", roles: ["edulexaadvisor", "superadmin"] },
  { href: "/admin", label: "Admin console", roles: ["superadmin"] },
];

const noSubscribe = () => () => {};

function Appearance() {
  const en = useEn();
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(noSubscribe, () => true, () => false);
  const options = [
    { id: "light", label: en("Light"), Icon: Sun },
    { id: "dark", label: en("Dark"), Icon: Moon },
    { id: "system", label: en("System"), Icon: Monitor },
  ];
  return (
    <div className="px-3 py-2">
      <p id="appearance-label" className="text-xs text-muted-foreground">
        {en("Appearance")}
      </p>
      <div role="group" aria-labelledby="appearance-label" className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {options.map(({ id, label, Icon }) => {
          const on = mounted && (theme ?? "system") === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => setTheme(id)}
              className={`flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs ${on ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AccountMenu({ links = [], area }: { links?: AccountLink[]; /** The area this header belongs to: left out of "Switch to" */ area?: string }) {
  const en = useEn();
  const router = useRouter();
  const { data: session } = useSession();
  const { roles, getToken } = useAppAuth();
  const dev = useDevSession();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const name = dev ? dev.label : (session?.user?.name ?? session?.user?.email ?? en("Account"));
  const initials =
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?";
  const member = platformHome(roles) === null;
  // P1 (5 Nov 2026): a school's student works in the school's area (practice is in its menu); others keep the member dashboard
  // S4b: the person's memberships (career center, faculty, employer, their school); undefined until looked up: once, the
  // first time the menu opens. Everyone gets every area they belong to, e.g. career-center staff who also teach.
  const [me, setMe] = useState<CareerMe | null | undefined>(undefined);
  useEffect(() => {
    if (!open || me !== undefined) return;
    let live = true;
    authenticatedFetch("/api/career/me", {}, getToken)
      .then(async (res) => (res.ok ? ((await res.json()) as CareerMe) : null))
      .catch(() => null)
      .then((m) => live && setMe(m));
    return () => {
      live = false;
    };
  }, [open, me, getToken]);
  const school = me ? schoolHome(me) : null;
  const areas = [
    ...(me ? schoolAreas(me) : []).filter((a) => a.href !== area).map((a) => ({ ...a, roles: null })),
    ...AREAS.filter((a) => a.href !== area && (a.roles === null ? member && !school : has(roles, a.roles))),
  ];
  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted";

  return (
    <div className="relative" ref={boxRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-[var(--brand-foreground,#fff)] ${dev ? "ring-2 ring-amber-500 ring-offset-2 ring-offset-card" : ""}`}
        style={{ background: "var(--brand)" }}
        title={name}
        aria-label={en("Account menu for {name}", { name })}
        aria-expanded={open}
        aria-controls="account-menu"
      >
        {initials}
      </button>
      {open && (
        <div id="account-menu" className="absolute end-0 z-100 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-1.5 shadow-xl">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{dev ? en("Developer session") : session?.user?.email}</p>
          </div>
          <ul className="border-b border-border py-1">
            <li>
              <Link href="/settings/account" onClick={() => setOpen(false)} className={item}>
                <UserRound aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                {en("Your account")}
              </Link>
            </li>
          </ul>
          {links.length > 0 && (
            <ul className="border-b border-border py-1">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className={item}>
                    {l.icon}
                    {en(l.label)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {areas.length > 0 && (
            <div className="border-b border-border py-1">
              <p className="px-3 pt-1 text-xs text-muted-foreground">{en("Switch to")}</p>
              <ul>
                {areas.map((a) => (
                  <li key={a.href}>
                    <Link href={a.href} onClick={() => setOpen(false)} className={item}>
                      <ArrowRightLeft aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                      {en(a.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="border-b border-border">
            <Appearance />
          </div>
          <div className="pt-1">
            {dev ? (
              <button
                type="button"
                className={item}
                onClick={() => {
                  endDevSession();
                  router.push("/login");
                }}
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                {en("End session")}
              </button>
            ) : (
              // Full-page GET (no client routing/prefetch): the route ends the Keycloak session as well
              <form method="get" action="/api/auth/federated-logout">
                <button type="submit" className={item}>
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  {en("Sign out")}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Language, light/dark and the account menu: the right-hand side of every header */
/** S4: the help center, opened from any page with the way back to it. S4b: it opens help beside the page (the side panel) */
function HelpButton() {
  const en = useEn();
  const pathname = usePathname();
  const panel = useHelpPanel();
  if (pathname?.startsWith("/help")) return null;
  return (
    <Link
      href={`/help?from=${encodeURIComponent(pathname ?? "/")}`}
      onClick={(e) => {
        if (!panel || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        panel.open(null);
      }}
      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={en("Help center")} title={en("Help center")}>
      <CircleHelp aria-hidden="true" className="h-5 w-5" />
    </Link>
  );
}

/** S4b: the bell for people whose pages have no school area of their own (members, recruiters, mentors, admissions) */
function NotificationBell() {
  const en = useEn();
  const pathname = usePathname();
  const { isLoaded, isSignedIn, getToken } = useAppAuth();
  const dev = useDevSession();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!isLoaded || (!isSignedIn && !dev)) return;
    let live = true;
    authenticatedFetch("/api/career/notifications?unreadOnly=true&take=1", {}, getToken)
      .then(async (res) => (res.ok ? ((await res.json()) as { unread: number }) : null))
      .catch(() => null)
      .then((n) => live && n && setUnread(n.unread));
    return () => {
      live = false;
    };
  }, [isLoaded, isSignedIn, dev, getToken, pathname]);
  if (!isLoaded || (!isSignedIn && !dev)) return null;
  return (
    <Link
      href="/notifications"
      className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={unread ? en("Notifications, {count} unread", { count: String(unread) }) : en("Notifications")}
      title={en("Notifications")}
    >
      <Bell aria-hidden="true" className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -end-0.5 -top-0.5 min-w-4 rounded-full px-1 text-center text-[10px] font-semibold leading-4 text-[var(--brand-foreground,#fff)]" style={{ background: "var(--brand)" }} aria-hidden="true">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

export function HeaderControls({ links, area, bell, children }: { links?: AccountLink[]; area?: string; /** Show the notifications bell (areas without their own) */ bell?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {children}
      {bell && <NotificationBell />}
      <HelpButton />
      <EnglishPicker className="hidden md:inline-flex" />
      <span className="hidden sm:inline-flex">
        <ThemeToggle />
      </span>
      <AccountMenu links={links} area={area} />
    </div>
  );
}
