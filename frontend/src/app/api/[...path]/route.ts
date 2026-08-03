import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/api";

// Generic mutation proxy for Client Components (frontend spec decision 9).
// Browser fetch can't read the httpOnly auth cookie, so this route reads it
// server-side, forwards the request to the Express API, and returns the
// backend's response as-is. Unlike apiFetch (used from Server Components),
// this never redirects on 401 — that belongs to the calling client code,
// since a redirect response here would hand the browser HTML instead of JSON.
async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: "Something went wrong, please try again" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  const headers = new Headers();
  headers.set("Content-Type", request.headers.get("content-type") ?? "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const hasBody = !["GET", "HEAD", "DELETE"].includes(request.method);

  const backendRes = await fetch(`${backendUrl}/${path.join("/")}${request.nextUrl.search}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.text() : undefined,
    cache: "no-store",
  });

  const responseBody = backendRes.status === 204 ? null : await backendRes.text();

  return new NextResponse(responseBody, {
    status: backendRes.status,
    headers: { "Content-Type": backendRes.headers.get("content-type") ?? "application/json" },
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}
export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}
export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}
export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, (await context.params).path);
}
