import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Route Matchers
// /verify, /transparency and /pricing are intentionally public
const isProtectedRoute = createRouteMatcher([
  "/sprint(.*)",
  "/dashboard(.*)",
  "/campus(.*)",
  "/my(.*)",
  "/settings(.*)",
  "/written-defense(.*)",
  "/credentials(.*)",
  "/defend-repo(.*)",
  "/referrals(.*)",
]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isInstituteRoute = createRouteMatcher(["/institute(.*)", "/campus/admin(.*)"]);
// Employers' institute admins manage these settings too
const isInstituteOrRecruiterRoute = createRouteMatcher(["/recruiter/transparency-settings(.*)"]);
const isRecruiterRoute = createRouteMatcher(["/recruiter(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const isDev = process.env.NODE_ENV === "development";

  // In local development, permit seamless traversal across portals for live evaluation and testability
  if (isDev) {
    return NextResponse.next();
  }

  const { userId, sessionClaims } = await auth();

  // Roles may arrive as `role` or a `roles` array, on the claims or in (public) metadata, matching the API's role mapping
  const claims = (sessionClaims ?? {}) as Record<string, unknown>;
  const roleList: string[] = [claims, claims.metadata, claims.publicMetadata, claims.public_metadata]
    .flatMap((source) => {
      if (!source || typeof source !== "object") return [];
      const s = source as { role?: unknown; roles?: unknown };
      return [s.role, ...(Array.isArray(s.roles) ? s.roles : [])];
    })
    .filter((r): r is string => typeof r === "string" && r.length > 0)
    .map((r) => r.toLowerCase());
  const hasRole = (...wanted: string[]) => wanted.some((w) => roleList.includes(w.toLowerCase()));

  if (isInstituteOrRecruiterRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/login?redirect_url=" + encodeURIComponent(req.nextUrl.pathname), req.url));
    }
    if (!hasRole("Recruiter", "InstituteAdmin", "SuperAdmin")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // 1. Super Admin Route Protection
  if (isAdminRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/login?redirect_url=" + encodeURIComponent(req.nextUrl.pathname), req.url));
    }

    const isSuperAdmin = hasRole("SuperAdmin");
    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  } 
  // 2. Institute Partner Portal Protection
  else if (isInstituteRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/login?redirect_url=" + encodeURIComponent(req.nextUrl.pathname), req.url));
    }

    const isInstituteAdmin = hasRole("InstituteAdmin", "SuperAdmin");
    if (!isInstituteAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }
  // 3. Corporate Recruiter Portal Protection
  else if (isRecruiterRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/login?redirect_url=" + encodeURIComponent(req.nextUrl.pathname), req.url));
    }

    const isRecruiter = hasRole("Recruiter", "SuperAdmin");
    if (!isRecruiter) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }
  // 4. General Candidate Protected Routes
  else if (isProtectedRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/login?redirect_url=" + encodeURIComponent(req.nextUrl.pathname), req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|webmanifest|fontawesome|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
