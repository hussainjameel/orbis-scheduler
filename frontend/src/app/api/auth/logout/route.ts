import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/api";

// JavaScript cannot clear an httpOnly cookie, so logout must go through the server.
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);

  return NextResponse.json({ success: true });
}
