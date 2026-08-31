import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Protect dashboard, sprint workspace, and candidate routes
const isProtectedRoute = createRouteMatcher(["/sprint(.*)", "/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
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
