"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { hidesGlobalNavigation, isCareerSuitePath, isPortalPath } from "@/lib/careerNav";
import { FRAME, PAGE_Y } from "@/components/layout/Frame";

/**
 * The page's main landmark. Career-suite pages (and the signed-link supervisor/kiosk pages) and the portals (recruiter,
 * institute, admin, advisor: PortalShell) render their own <main> inside their shell, so this wrapper must not add a
 * second, nested one there.
 *
 * Pages under the global navigation get the standard frame here (components/layout/Frame.tsx): the same width and
 * side margins as the navigation above them, so they don't set their own. Pages with their own shell (admin, school,
 * recruiter, advisor, career suite) or no navigation (sign-in, sign-up, embeds) are framed by that shell, or not at all.
 */
export default function AppMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isCareerSuitePath(pathname) || isPortalPath(pathname)) return <div className="flex-1">{children}</div>;
  const framed = !hidesGlobalNavigation(pathname);
  return (
    <main id="main-content" tabIndex={-1} className={`flex-1 focus:outline-none ${framed ? `${FRAME} ${PAGE_Y}` : ""}`.trim()}>
      {children}
    </main>
  );
}
