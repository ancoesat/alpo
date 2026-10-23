import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Runs before every request that matches `config.matcher` below.
// This is the actual gate: no valid session cookie, no access.
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isValid = await verifySessionToken(token);

  if (isValid) {
    return NextResponse.next();
  }

  // API routes should get a 401 JSON response (fetch() callers expect that),
  // page routes should get redirected to the login screen.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "You need to sign in." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

// Everything is protected EXCEPT: Next's static assets, the favicon,
// the /login page itself, and the /api/login + /api/auth/google endpoints
// (which are how you get a session cookie in the first place).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/login|api/auth/google).*)"],
};
