import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Route Matchers
const isProtectedRoute = createRouteMatcher(["/sprint(.*)", "/dashboard(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isInstituteRoute = createRouteMatcher(["/institute(.*)"]);
const isRecruiterRoute = createRouteMatcher(["/recruiter(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const isDev = process.env.NODE_ENV === "development";

  // In local development, permit seamless traversal across portals for live evaluation and testability
  if (isDev) {
    return NextResponse.next();
  }

  const { userId, sessionClaims } = await auth();

  const role = (sessionClaims?.metadata as any)?.role 
            || (sessionClaims?.publicMetadata as any)?.role 
            || (sessionClaims as any)?.role
            || (sessionClaims?.public_metadata as any)?.role;

  // 1. Super Admin Route Protection
  if (isAdminRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/login?redirect_url=" + encodeURIComponent(req.nextUrl.pathname), req.url));
    }

    const isSuperAdmin = role === "SuperAdmin" || role === "superadmin";
    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  } 
  // 2. Institute Partner Portal Protection
  else if (isInstituteRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/login?redirect_url=" + encodeURIComponent(req.nextUrl.pathname), req.url));
    }

    const isInstituteAdmin = role === "InstituteAdmin" || role === "SuperAdmin";
    if (!isInstituteAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }
  // 3. Corporate Recruiter Portal Protection
  else if (isRecruiterRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/login?redirect_url=" + encodeURIComponent(req.nextUrl.pathname), req.url));
    }

    const isRecruiter = role === "Recruiter" || role === "SuperAdmin";
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
