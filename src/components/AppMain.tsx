"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { isCareerSuitePath } from "@/lib/careerNav";

/**
 * The page's main landmark. Career-suite pages (and the signed-link supervisor/kiosk pages) render their own
 * <main> inside their shell, so this wrapper must not add a second, nested one there.
 */
export default function AppMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isCareerSuitePath(pathname)) return <div className="flex-1">{children}</div>;
  return (
    <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
      {children}
    </main>
  );
}
