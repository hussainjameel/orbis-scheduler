import { headers } from "next/headers";

// No dedicated env var carries the app's own public origin, and inventing
// one risks drifting from wherever this actually deploys — deriving it from
// the incoming request instead means it can't go stale.
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}
