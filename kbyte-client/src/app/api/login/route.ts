import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";
import { checkPassword } from "@/lib/password";

export async function POST(request: NextRequest) {
  let body: { password?: string; remember?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  if (!body.password || !(await checkPassword(body.password))) {
    return NextResponse.json({ message: "Şifre yanlış." }, { status: 401 });
  }

  const { value, maxAgeSeconds } = await createSessionToken(Boolean(body.remember));

  const response = NextResponse.json({ message: "Signed in." });
  response.cookies.set(SESSION_COOKIE, value, sessionCookieOptions(maxAgeSeconds));
  return response;
}
