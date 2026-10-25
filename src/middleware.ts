import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { auth as keycloakAuth } from "@/auth";

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
  // Career guidance: Edulexa advisors and community mentors (the API decides who sees what)
  "/advisor(.*)",
  "/mentor(.*)",
  // Career suite: sign-in is enough here; the API decides access from career-center, employer and faculty
  // memberships stored per institute. /supervisor and /kiosk use signed single-purpose links and stay public.
  "/student(.*)",
  "/career-center(.*)",
  "/faculty(.*)",
  "/employer(.*)",
  "/alumni(.*)",
]);
// Sign-in-only career routes that partner (e.g. SeekJobs) sessions may open; their token lives in sessionStorage,
// so middleware only sees the career_partner marker cookie. Role-gated routes never accept it.
const isPartnerCareerRoute = createRouteMatcher(["/student(.*)", "/career-center(.*)", "/faculty(.*)", "/employer(.*)", "/alumni(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
// H12: exam administration is also for institute admins and exam creators; sign-in is enough here and the API decides
// which exams the user manages (404 for the rest)
const isExamAdminRoute = createRouteMatcher(["/admin/exams(.*)"]);
const isInstituteRoute = createRouteMatcher(["/institute(.*)", "/campus/admin(.*)"]);
// Employers' institute admins manage these settings too
const isInstituteOrRecruiterRoute = createRouteMatcher(["/recruiter/transparency-settings(.*)"]);
const isRecruiterRoute = createRouteMatcher(["/recruiter(.*)"]);

// Route gating shared by both identity providers (NEXT_PUBLIC_AUTH_PROVIDER, inlined at build time)
function gate(req: NextRequest, userId: string | null | undefined, hasRole: (...wanted: string[]) => boolean) {
  if (isInstituteOrRecruiterRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/login?redirect_url=" + encodeURIComponent(req.nextUrl.pathname), req.url));
    }
    if (!hasRole("Recruiter", "InstituteAdmin", "SuperAdmin")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (isExamAdminRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/login?redirect_url=" + encodeURIComponent(req.nextUrl.pathname), req.url));
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
    // a partner session reaches the career routes; a learning-platform (LTI) session the candidate pages too
    const partnerSession = isPartnerCareerRoute(req) && req.cookies.get("career_partner")?.value === "1";
    const lmsSession = req.cookies.get("lms_session")?.value === "1";
    if (!userId && !partnerSession && !lmsSession) {
      return NextResponse.redirect(new URL("/login?redirect_url=" + encodeURIComponent(req.nextUrl.pathname), req.url));
    }
  }
  return NextResponse.next();
}

// In local development, permit seamless traversal across portals for live evaluation and testability
const isDev = process.env.NODE_ENV === "development";

const clerkHandler = () =>
  clerkMiddleware(async (auth, req) => {
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

    return gate(req, userId, hasRole);
  });

// Keycloak (Auth.js): req.auth is the session; roles are the realm roles from the access token. A failed refresh
// (Keycloak session ended) counts as signed out.
const keycloakHandler = () =>
  keycloakAuth((req) => {
    if (isDev) {
      return NextResponse.next();
    }
    const session = req.auth;
    const signedIn = !!session && !session.error;
    const roleList = (signedIn ? session.roles ?? [] : []).map((r) => r.toLowerCase());
    const hasRole = (...wanted: string[]) => wanted.some((w) => roleList.includes(w.toLowerCase()));
    return gate(req, signedIn ? session.user?.id ?? "signed-in" : null, hasRole);
  });

export default process.env.NEXT_PUBLIC_AUTH_PROVIDER === "keycloak" ? keycloakHandler() : clerkHandler();

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|webmanifest|fontawesome|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
