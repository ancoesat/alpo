import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

// Step 1 of Google sign-in: send the browser to Google's consent screen.
export async function GET() {
  const base = process.env.PUBLIC_URL!;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=google-off", base));
  }

  const state = randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: new URL("/api/auth/google/callback", base).toString(),
    response_type: "code",
    scope: "openid email",
    state,
    prompt: "select_account",
  }).toString();

  const response = NextResponse.redirect(url);
  // CSRF guard: the callback must come back with this same value.
  response.cookies.set("g_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
