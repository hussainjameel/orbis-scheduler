// Client-side counterpart to lib/api.ts's apiFetch. Can't share that module
// directly — it imports next/headers, which can't be bundled into Client
// Components. Calls go through the /api/[...path] proxy (see that route for
// why), which attaches the auth cookie server-side.
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

export async function clientFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const res = await fetch(`/api${path}`, { ...options, headers });

  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}
