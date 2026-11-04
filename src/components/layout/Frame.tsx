/**
 * The page frame (5 Nov 2026): one width and one pair of side margins for every page of every role, so the logo, the
 * menu and each page's content start and end at the same place everywhere. The shells (PortalShell, CareerShell,
 * GlobalNavigation) use FRAME for their header, menu and content; member pages without a shell wrap themselves in
 * <Page>. Pages never set their own outer width or side padding (scripts/check-frame.ts fails the build when one does):
 * content fills the frame, and forms use columns on wide screens instead of a narrow strip.
 */
import React from "react";

/** The standard width and side margins */
export const FRAME = "mx-auto w-full max-w-7xl px-4 sm:px-6";
/** The space above and below a page's content */
export const PAGE_Y = "py-8";

/** A page outside a shell (member pages): the standard frame, with the standard space above and below */
export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`${FRAME} ${PAGE_Y} ${className}`.trim()}>{children}</div>;
}
