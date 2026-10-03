import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Route Matchers
const isProtectedRoute = createRouteMatcher(["/sprint(.*)", "/dashboard(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isInstituteRoute = createRouteMatcher(["/institute(.*)"]);
const isRecruiterRoute = createRouteMatcher(["/recruiter(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  const role = (sessionClaims?.metadata as any)?.role 
            || (sessionClaims?.publicMetadata as any)?.role 
            || (sessionClaims as any)?.role
            || (sessionClaims?.public_metadata as any)?.role;

  // 1. Super Admin Route Protection
  if (isAdminRoute(req)) {
    const isDevMock = process.env.NODE_ENV === "development" && (
      req.nextUrl.searchParams.get("mockAdmin") === "true" || 
      req.cookies.get("mock_admin_role")?.value === "SuperAdmin"
    );

    if (!userId && !isDevMock) {
      await auth.protect();
      return;
    }

    const isSuperAdmin = isDevMock || role === "SuperAdmin" || role === "superadmin";
    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  } 
  // 2. Institute Partner Portal Protection
  else if (isInstituteRoute(req)) {
    const isDevMock = process.env.NODE_ENV === "development" && (
      req.nextUrl.searchParams.get("mockInstitute") === "true" || 
      req.cookies.get("mock_institute_role")?.value === "InstituteAdmin"
    );

    if (!userId && !isDevMock) {
      await auth.protect();
      return;
    }

    const isInstituteAdmin = isDevMock || role === "InstituteAdmin" || role === "SuperAdmin";
    if (!isInstituteAdmin) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
  // 3. Corporate Recruiter Portal Protection
  else if (isRecruiterRoute(req)) {
    const isDevMock = process.env.NODE_ENV === "development" && (
      req.nextUrl.searchParams.get("mockRecruiter") === "true" || 
      req.cookies.get("mock_recruiter_role")?.value === "Recruiter"
    );

    if (!userId && !isDevMock) {
      await auth.protect();
      return;
    }

    const isRecruiter = isDevMock || role === "Recruiter" || role === "SuperAdmin";
    if (!isRecruiter) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
  // 4. General Candidate Protected Routes
  else if (isProtectedRoute(req)) {
    const isDevMock = process.env.NODE_ENV === "development" && (
      req.nextUrl.searchParams.get("mockCandidate") === "true" ||
      req.cookies.get("mock_candidate")?.value === "true"
    );

    if (!userId && !isDevMock) {
      await auth.protect();
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
