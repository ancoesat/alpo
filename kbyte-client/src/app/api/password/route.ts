import { NextRequest, NextResponse } from "next/server";
import { checkPassword, setPassword } from "@/lib/password";

// Behind the middleware, so only a signed-in user gets here;
// the current password is still required so an open tab can't be abused.
export async function POST(request: NextRequest) {
  let body: { current?: string; next?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  if (!body.current || !(await checkPassword(body.current))) {
    return NextResponse.json({ message: "Mevcut şifre yanlış." }, { status: 401 });
  }
  if (!body.next || body.next.length < 8) {
    return NextResponse.json({ message: "Yeni şifre en az 8 karakter olmalı." }, { status: 400 });
  }

  await setPassword(body.next);
  return NextResponse.json({ message: "Şifre değiştirildi." });
}
