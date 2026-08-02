import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE } from "@/lib/api";

export type Session = {
  userId: number;
  role: string;
  businessId?: string;
};

// Same runtime check as backend/src/middleware/authenticate.ts's
// isAuthenticatedUserPayload — jwt.verify only proves the signature is
// genuine, not that the payload has the fields this app expects.
function isSessionPayload(payload: unknown): payload is Session {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.userId === "number" &&
    typeof candidate.role === "string" &&
    (candidate.businessId === undefined || typeof candidate.businessId === "string")
  );
}

// Reads and verifies the session cookie server-side, using the same JWT
// library and secret as the backend (decision 10 — no second verification
// library, no middleware). Never throws: a missing/invalid/expired token is
// just "no session" to the caller, which redirects rather than crashes.
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not set");
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    return isSessionPayload(decoded) ? decoded : null;
  } catch {
    return null;
  }
}
