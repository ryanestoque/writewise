import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/middleware";

// Routes that don't require authentication
const publicRoutes = ["/login"];

// Route-to-role mapping (Next.js strips the route group prefix from URLs)
const teacherRoutes = ["/dashboard", "/roster", "/activities", "/settings"];
const parentRoutes = ["/progress"];

// Default landing pages per role
const roleLanding: Record<string, string> = {
  teacher: "/dashboard",
  parent: "/progress",
};

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function getRouteRole(pathname: string): string | null {
  if (teacherRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return "teacher";
  }
  if (parentRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return "parent";
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = await createClient(request);
  const { pathname } = request.nextUrl;

  // Always refresh the session — required by @supabase/ssr
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userRole = user?.user_metadata?.role as string | undefined;

  // Unauthenticated user on a protected route → login
  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated user on /login → redirect to their portal
  if (user && isPublicRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = roleLanding[userRole ?? ""] ?? "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated user — check role matches route
  if (user && userRole) {
    const routeRole = getRouteRole(pathname);

    // Route belongs to a different role → redirect to own portal
    if (routeRole && routeRole !== userRole) {
      const url = request.nextUrl.clone();
      url.pathname = roleLanding[userRole] ?? "/login";
      return NextResponse.redirect(url);
    }
  }

  // Authenticated user with no role metadata (edge case) → sign out
  if (user && !userRole && !isPublicRoute(pathname)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "missing_role");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Image files
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
