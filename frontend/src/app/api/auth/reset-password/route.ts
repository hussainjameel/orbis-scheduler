import { NextResponse } from "next/server";

// No cookie here — a successful reset does not log the user in.
export async function POST(request: Request) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { error: "Something went wrong, please try again" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));

  const backendRes = await fetch(`${backendUrl}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);

  return NextResponse.json(data, { status: backendRes.status });
}
