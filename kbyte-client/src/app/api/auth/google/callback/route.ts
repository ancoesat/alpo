import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";

// Step 2 of Google sign-in: trade the code for an ID token and let in
// exactly one Google account (GOOGLE_ALLOWED_EMAIL).
export async function GET(request: NextRequest) {
  const base = process.env.PUBLIC_URL!;
  const fail = () => {
    const response = NextResponse.redirect(new URL("/login?error=google", base));
    response.cookies.set("g_state", "", { path: "/", maxAge: 0 });
    return response;
  };

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || state !== request.cookies.get("g_state")?.value) return fail();

  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: new URL("/api/auth/google/callback", base).toString(),
      grant_type: "authorization_code",
    }),
  }).catch(() => null);
  if (!tokenRes?.ok) return fail();

  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  // Token came straight from Google over TLS, so reading the payload without
  // checking the signature is allowed (OpenID Connect Core 3.1.3.7).
  let claims: { aud?: string; email?: string; email_verified?: boolean };
  try {
    claims = JSON.parse(Buffer.from(id_token!.split(".")[1], "base64url").toString());
  } catch {
    return fail();
  }

  const allowed = process.env.GOOGLE_ALLOWED_EMAIL?.trim().toLowerCase();
  if (!allowed || claims.aud !== clientId || !claims.email_verified || claims.email?.toLowerCase() !== allowed) {
    return fail();
  }

  const { value, maxAgeSeconds } = await createSessionToken(true);
  const response = NextResponse.redirect(new URL("/", base));
  response.cookies.set(SESSION_COOKIE, value, sessionCookieOptions(maxAgeSeconds));
  response.cookies.set("g_state", "", { path: "/", maxAge: 0 });
  return response;
}
