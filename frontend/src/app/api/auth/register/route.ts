import { NextResponse } from "next/server";

// No cookie here — registration never logs the user in. The backend's
// response (success message or error) is passed through unchanged.
export async function POST(request: Request) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { error: "Something went wrong, please try again" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));

  const backendRes = await fetch(`${backendUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);

  return NextResponse.json(data, { status: backendRes.status });
}
