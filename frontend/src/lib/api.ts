import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const AUTH_COOKIE = "token";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed with status ${status}`
    );
    this.status = status;
    this.body = body;
  }
}

// Calls the Express backend from server-side code (Server Components, Route Handlers).
// Attaches the auth cookie as a Bearer token. On 401 the session is treated as invalid
// and the caller is hard-redirected to /login — a 403 is left to the caller, since it
// carries a business-status message that must be shown inline, not redirected past.
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    throw new Error("BACKEND_URL is not set");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${backendUrl}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (res.status === 401) {
    // Cookies can't be modified during a Server Component render — only in a Route
    // Handler or Server Action — so we don't attempt to clear it here. A stale cookie
    // is harmless and gets overwritten on next login.
    redirect("/login?expired=1");
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}
