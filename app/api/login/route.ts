import { NextResponse } from "next/server";
import { AUTH_COOKIE, DEFAULT_PASSWORD, DEFAULT_USERNAME } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };

  if (body.username !== DEFAULT_USERNAME || body.password !== DEFAULT_PASSWORD) {
    return NextResponse.json({ message: "invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, "ok", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  return response;
}
