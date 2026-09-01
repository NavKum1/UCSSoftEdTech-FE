import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Protect candidate workspace, dashboard, and back-office admin routes
const isProtectedRoute = createRouteMatcher(["/sprint(.*)", "/dashboard(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    const { userId, sessionClaims } = await auth();

    // Dev bypass for local development preview/testing if explicitly enabled
    const isDevMock = req.nextUrl.searchParams.get("mockAdmin") === "true" || 
                      req.cookies.get("mock_admin_role")?.value === "SuperAdmin";

    if (!userId && !isDevMock) {
      await auth.protect();
      return;
    }

    // Role check in Clerk Public Metadata
    const role = (sessionClaims?.metadata as any)?.role 
              || (sessionClaims?.publicMetadata as any)?.role 
              || (sessionClaims as any)?.role
              || (sessionClaims?.public_metadata as any)?.role;

    const isSuperAdmin = isDevMock || role === "SuperAdmin" || role === "superadmin";

    if (!isSuperAdmin) {
      // Redirect non-admin users to the home page
      return NextResponse.redirect(new URL("/", req.url));
    }
  } else if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|webmanifest|fontawesome|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
