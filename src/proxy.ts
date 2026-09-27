import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic check only — every page and action re-validates the session on the server.
const PROTECTED = ["/dashboard", "/lots", "/transfers", "/ledger", "/documents", "/iot", "/insights", "/map", "/passports", "/network", "/onboarding"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|p/|scan|tag/).*)"],
};
