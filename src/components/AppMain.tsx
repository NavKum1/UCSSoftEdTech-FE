"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AUTH_PAGES, SIGNUP_PREFIXES, hidesGlobalNavigation, isCareerSuitePath, isPortalPath } from "@/lib/careerNav";
import { FRAME, PAGE_Y } from "@/components/layout/Frame";

/**
 * Give routes that use the global navigation the same frame as their header.
 * The career, portal, help, login, and school signup shells provide their own main landmark.
 */
export default function AppMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ownMain = pathname && (
    AUTH_PAGES.includes(pathname) || pathname === "/help" || pathname.startsWith("/help/") ||
    SIGNUP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))
  );
  if (ownMain || isCareerSuitePath(pathname) || isPortalPath(pathname)) return <div className="flex-1">{children}</div>;
  const framed = !hidesGlobalNavigation(pathname);
  return (
    <main id="main-content" tabIndex={-1} className={`flex-1 focus:outline-none ${framed ? `${FRAME} ${PAGE_Y}` : ""}`.trim()}>
      {children}
    </main>
  );
}
