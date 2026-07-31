import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/api";

//24h to match the backend's JWT expiresIn.
const TOKEN_MAX_AGE_SECONDS = 24 * 60 * 60;

export async function POST(request: Request) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: "Something went wrong, please try again" }, { status: 500 });
  }

  const { email, password } = await request.json().catch(() => ({}));

  const backendRes = await fetch(`${backendUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const body = await backendRes.json().catch(() => null);

  if (!backendRes.ok) {
    return NextResponse.json(body, { status: backendRes.status });
  }

  const { token, user } = body;

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ user });
}
